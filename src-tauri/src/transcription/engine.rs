use serde::{Serialize, Deserialize};
use std::path::{Path, PathBuf};
use anyhow::{Result, anyhow};
use tauri::{AppHandle, Manager, Emitter};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct TranscriptSegment {
    pub start_ms: i64,
    pub end_ms: i64,
    pub text: String,
    pub confidence: f32,
}

#[derive(Clone, Serialize)]
struct ProgressPayload {
    progress: i32,
}

#[derive(Clone, Serialize)]
struct PhasePayload {
    phase: String,
}

pub struct TranscriptionEngine {
    app_handle: AppHandle,
}

static VULKAN_CHECKED: AtomicBool = AtomicBool::new(false);
static VULKAN_AVAILABLE: AtomicBool = AtomicBool::new(false);

/// Set library path environment variable so sidecar binaries can find
/// shared libraries (libonnxruntime, libggml, etc.) in the same directory.
macro_rules! set_sidecar_env {
    ($cmd:expr, $bin_dir:expr) => {
        if let Some(bin_str) = $bin_dir.to_str() {
            #[cfg(target_os = "linux")]
            {
                let existing = std::env::var("LD_LIBRARY_PATH").unwrap_or_default();
                let path = if existing.is_empty() {
                    bin_str.to_string()
                } else {
                    format!("{}:{}", bin_str, existing)
                };
                $cmd = $cmd.env("LD_LIBRARY_PATH", path);
            }
            #[cfg(target_os = "macos")]
            {
                let existing = std::env::var("DYLD_LIBRARY_PATH").unwrap_or_default();
                let path = if existing.is_empty() {
                    bin_str.to_string()
                } else {
                    format!("{}:{}", bin_str, existing)
                };
                $cmd = $cmd.env("DYLD_LIBRARY_PATH", path);
            }
            #[cfg(target_os = "windows")]
            {
                let existing = std::env::var("PATH").unwrap_or_default();
                let path = format!("{};{}", bin_str, existing);
                $cmd = $cmd.env("PATH", path);
            }
        }
    };
}

impl TranscriptionEngine {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    /// Returns the directory where sidecar binaries live (resource dir + "bin" in production,
    /// src-tauri/bin in dev). Returns None if the directory can't be resolved.
    fn sidecar_bin_dir(&self) -> Option<PathBuf> {
        let dir = self.app_handle.path().resource_dir().ok()?.join("bin");
        if dir.is_dir() {
            return Some(dir);
        }
        // Dev fallback
        let dev_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("bin");
        if dev_dir.is_dir() {
            return Some(dev_dir);
        }
        None
    }

    /// Checks whether libggml-vulkan.so is present in the sidecar bin directory.
    /// Caches the result after the first check.
    fn vulkan_available(&self) -> bool {
        if VULKAN_CHECKED.load(Ordering::Relaxed) {
            return VULKAN_AVAILABLE.load(Ordering::Relaxed);
        }
        let available = self.sidecar_bin_dir()
            .map(|dir| dir.join("libggml-vulkan.so").exists())
            .unwrap_or(false);
        if available {
            println!("[TranscriptionEngine] Vulkan GPU backend detected");
        }
        VULKAN_AVAILABLE.store(available, Ordering::Relaxed);
        VULKAN_CHECKED.store(true, Ordering::Relaxed);
        available
    }

    /// Converts audio to 16kHz WAV as required by whisper.cpp.
    /// Emits "transcription://phase" with "preparing" so the UI can show a preparing state.
    pub async fn prepare_audio(&self, input_path: &Path) -> Result<PathBuf> {
        let _ = self.app_handle.emit("transcription://phase", PhasePayload { phase: "preparing".to_string() });
        let temp_dir = self.app_handle.path().app_cache_dir()?.join("transcription");
        if !temp_dir.exists() {
            std::fs::create_dir_all(&temp_dir)?;
        }

        let output_path = temp_dir.join(format!("{}.wav", uuid::Uuid::new_v4()));

        let (mut rx, _) = crate::utils::ffmpeg::ffmpeg_command(&self.app_handle)?
            .args([
                "-i", input_path.to_str().expect("input path is valid UTF-8"),
                "-ar", "16000",
                "-ac", "1",
                "-c:a", "pcm_s16le",
                "-y",
                output_path.to_str().expect("output path is valid UTF-8")
            ])
            .spawn()?;

        let mut success = false;
        let mut stderr_buf = String::new();
        while let Some(event) = rx.recv().await {
            if let CommandEvent::Terminated(payload) = event {
                success = payload.code == Some(0);
                break;
            } else if let CommandEvent::Stderr(line) = event {
                let line_str = String::from_utf8_lossy(&line);
                if stderr_buf.len() < 4000 {
                    stderr_buf.push_str(&line_str);
                }
            }
        }

        if !success {
            let msg = if stderr_buf.trim().is_empty() {
                "FFmpeg conversion failed".to_string()
            } else {
                format!("FFmpeg conversion failed: {}", stderr_buf.trim())
            };
            return Err(anyhow!(msg));
        }

        Ok(output_path)
    }

    pub async fn transcribe(
        &self,
        audio_path: &Path,
        model_path: &Path,
        language: &str,
        on_segment: impl Fn(TranscriptSegment),
        on_progress: Option<Box<dyn Fn(i32) + Send + Sync>>,
    ) -> Result<()> {
        if !model_path.exists() {
            return Err(anyhow!(
                "Whisper model file not found: {}",
                model_path.display()
            ));
        }

        let mut args = vec![
            "-m".to_string(),
            model_path.to_string_lossy().to_string(),
            "-f".to_string(),
            audio_path.to_string_lossy().to_string(),
            "-ojf".to_string(), // output json full
            "--print-progress".to_string(),
        ];

        if !language.eq_ignore_ascii_case("auto") {
            args.push("-l".to_string());
            args.push(language.to_string());
        }

        let use_gpu = self.vulkan_available();

        let phase = if use_gpu { "transcribing-gpu" } else { "transcribing-cpu" };
        let _ = self.app_handle.emit("transcription://phase", PhasePayload { phase: phase.to_string() });

        // Use the bundled sidecar binary ("whisper").
        let mut cmd = self.app_handle.shell().sidecar("whisper")
            .map_err(|e| anyhow!("Whisper sidecar not found: {}", e))?;

        // Set library path so whisper can find libwhisper, libggml, etc.
        if let Some(bin_dir) = self.sidecar_bin_dir() {
            set_sidecar_env!(cmd, &bin_dir);
        }

        let (mut rx, _) = cmd.args(args).spawn().map_err(|e| {
            anyhow!("Failed to launch sidecar 'whisper': {}", e)
        })?;

        let mut success = false;
        let mut stdout_buf = String::new();
        let mut stderr_buf = String::new();
        let mut stderr_line_buf = String::new();
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    if stdout_buf.len() < 4000 {
                        stdout_buf.push_str(&line_str);
                    }
                }
                CommandEvent::Stderr(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    stderr_line_buf.push_str(&line_str);
                    
                    while let Some(newline_idx) = stderr_line_buf.find('\n') {
                        let line = stderr_line_buf[..newline_idx].trim().to_string();
                        stderr_line_buf = stderr_line_buf[newline_idx + 1..].to_string();
                        
                        // Parse progress: "progress = 5%"
                        if let Some(idx) = line.find("progress =") {
                            let rest = &line[idx + 10..];
                            if let Some(end) = rest.find('%') {
                                if let Ok(p) = rest[..end].trim().parse::<i32>() {
                                    let _ = self.app_handle.emit("transcription://progress", ProgressPayload { progress: p });
                                    if let Some(ref cb) = on_progress {
                                        cb(p);
                                    }
                                }
                            }
                        }
                    }

                    if stderr_buf.len() < 4000 {
                        stderr_buf.push_str(&line_str);
                    }
                }
                CommandEvent::Terminated(payload) => {
                    success = payload.code == Some(0);
                    break;
                }
                _ => {}
            }
        }

        if !success {
            let stderr_clean = stderr_buf.trim();
            let stdout_clean = stdout_buf.trim();
            let msg = if !stderr_clean.is_empty() {
                if stderr_clean.contains("libwhisper.so") || stderr_clean.contains("Shared library") {
                    format!("Whisper binary missing dependencies. Please run: ./fix-whisper.sh\nDetails: {}", stderr_clean)
                } else {
                    format!("Whisper transcription failed: {}", stderr_clean)
                }
            } else if !stdout_clean.is_empty() {
                format!("Whisper transcription failed (stdout): {}", stdout_clean)
            } else {
                "Whisper transcription failed".to_string()
            };
            return Err(anyhow!(msg));
        }

        // After completion, whisper.cpp usually creates a .wav.json file (due to -ojf)
        let json_path = audio_path.with_extension("wav.json");
        if !json_path.exists() {
            return Err(anyhow!(
                "Whisper completed without producing output: {}",
                json_path.display()
            ));
        }

        let json_content = std::fs::read_to_string(&json_path)?;
        let data: serde_json::Value = serde_json::from_str(&json_content)?;
        
        if let Some(transcription) = data.get("transcription") {
            if let Some(segments) = transcription.as_array() {
                for seg in segments {
                    let segment = TranscriptSegment {
                        start_ms: (seg["offsets"]["from"].as_i64().unwrap_or(0)),
                        end_ms: (seg["offsets"]["to"].as_i64().unwrap_or(0)),
                        text: seg["text"].as_str().unwrap_or("").to_string(),
                        confidence: 1.0, 
                    };
                    on_segment(segment);
                }
            }
        }
        
        let _ = std::fs::remove_file(json_path);

        Ok(())
    }

    pub async fn transcribe_moonshine(
        &self,
        audio_path: &Path,
        model_dir: &Path,
        _language: &str,
        on_segment: impl Fn(TranscriptSegment),
        on_progress: Option<Box<dyn Fn(i32) + Send + Sync>>,
    ) -> Result<()> {
        if !model_dir.exists() {
            return Err(anyhow!(
                "Moonshine model directory not found: {}",
                model_dir.display()
            ));
        }

        let _ = self.app_handle.emit("transcription://phase", PhasePayload { phase: "transcribing-cpu".to_string() });

        // Moonshine's encoder has a fixed context window (~30s).
        // Chunk the WAV into overlapping 30s segments for full-length transcription.
        let chunk_duration_ms: i64 = 30_000;
        let total_duration_ms = get_wav_duration_ms(audio_path).unwrap_or(30_000);
        let num_chunks = ((total_duration_ms + chunk_duration_ms - 1) / chunk_duration_ms) as usize;

        let wav_data = std::fs::read(audio_path)
            .map_err(|e| anyhow!("Failed to read WAV file: {}", e))?;

        // Parse WAV to find data chunk offset and parameters
        let channels = u16::from_le_bytes([wav_data[22], wav_data[23]]) as u64;
        let sample_rate = u32::from_le_bytes([wav_data[24], wav_data[25], wav_data[26], wav_data[27]]) as u64;
        let bits_per_sample = u16::from_le_bytes([wav_data[34], wav_data[35]]) as u64;
        let bytes_per_sample = bits_per_sample / 8;

        let data_info = find_wav_data_chunk(&wav_data);
        let (data_offset, data_size) = data_info
            .ok_or_else(|| anyhow!("Failed to parse WAV data chunk"))?;

        let total_samples = (data_size as u64) / (channels * bytes_per_sample);
        let chunk_samples = (sample_rate * chunk_duration_ms as u64) / 1000;

        let mut all_text = String::new();
        let mut chunk_idx = 0usize;

        while (chunk_idx as u64 * chunk_samples) < total_samples {
            let start_sample = (chunk_idx as u64 * chunk_samples);
            let end_sample = std::cmp::min(start_sample + chunk_samples, total_samples);
            let chunk_byte_offset = data_offset as u64 + start_sample * channels * bytes_per_sample;
            let chunk_byte_count = (end_sample - start_sample) * channels * bytes_per_sample;

            if chunk_byte_offset as usize >= wav_data.len() { break; }
            let end_byte = std::cmp::min((chunk_byte_offset + chunk_byte_count) as usize, wav_data.len());
            let chunk_bytes = &wav_data[chunk_byte_offset as usize..end_byte];

            // Build a minimal WAV header for this chunk
            let chunk_wav = build_wav_chunk(chunk_bytes, sample_rate as u32, channels as u16, bits_per_sample as u16);
            let chunk_path = audio_path.with_extension(format!("chunk{}.wav", chunk_idx));
            std::fs::write(&chunk_path, &chunk_wav)
                .map_err(|e| anyhow!("Failed to write chunk WAV: {}", e))?;

            let chunk_start_ms = (start_sample * 1000) / sample_rate;
            let chunk_end_ms = (end_sample * 1000) / sample_rate;

            let text = match self.run_moonshine_sidecar(model_dir, &chunk_path).await {
                Ok(t) => t,
                Err(e) => {
                    tracing::warn!("Moonshine chunk {} failed, continuing: {}", chunk_idx, e);
                    String::new()
                }
            };
            let _ = std::fs::remove_file(&chunk_path);

            if !text.is_empty() {
                if !all_text.is_empty() { all_text.push(' '); }
                all_text.push_str(&text);

                on_segment(TranscriptSegment {
                    start_ms: chunk_start_ms as i64,
                    end_ms: chunk_end_ms as i64,
                    text,
                    confidence: 1.0,
                });
            }

            chunk_idx += 1;
            if let Some(ref cb) = on_progress {
                cb(std::cmp::min(90, 5 + ((chunk_idx * 85) / num_chunks.max(1))) as i32);
            }
        }

        if let Some(ref cb) = on_progress { cb(100); }
        Ok(())
    }

    async fn run_moonshine_sidecar(&self, model_dir: &Path, wav_path: &Path) -> Result<String> {
        let mut cmd = self.app_handle.shell().sidecar("moonshine")
            .map_err(|e| anyhow!("Moonshine sidecar not found: {}", e))?;

        if let Some(bin_dir) = self.sidecar_bin_dir() {
            set_sidecar_env!(cmd, &bin_dir);
        }

        let args = vec![
            model_dir.to_string_lossy().to_string(),
            wav_path.to_string_lossy().to_string(),
        ];

        let (mut rx, _) = cmd.args(args).spawn().map_err(|e| {
            anyhow!("Failed to launch sidecar 'moonshine': {}", e)
        })?;

        let mut success = false;
        let mut stdout_buf = String::new();
        let mut stderr_buf = String::new();
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    stdout_buf.push_str(&line_str);
                }
                CommandEvent::Stderr(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    if stderr_buf.len() < 4000 {
                        stderr_buf.push_str(&line_str);
                    }
                }
                CommandEvent::Terminated(payload) => {
                    success = payload.code == Some(0);
                    break;
                }
                _ => {}
            }
        }

        if !success {
            let stderr_clean = stderr_buf.trim();
            let msg = if !stderr_clean.is_empty() {
                if stderr_clean.contains("onnxruntime") || stderr_clean.contains("Shared library") {
                    format!("Moonshine binary missing ONNX Runtime dependencies.\nDetails: {}", stderr_clean)
                } else {
                    format!("Moonshine transcription failed: {}", stderr_clean)
                }
            } else {
                "Moonshine transcription failed".to_string()
            };
            return Err(anyhow!(msg));
        }

        let text = stdout_buf
            .lines()
            .find(|l| l.starts_with("Detokenized: "))
            .map(|l| l.strip_prefix("Detokenized: ").unwrap().trim())
            .unwrap_or("")
            .trim_start_matches("<s>")
            .trim_end_matches("</s>")
            .trim()
            .to_string();
        Ok(text)
    }
}

fn get_wav_duration_ms(wav_path: &Path) -> Option<i64> {
    let data = std::fs::read(wav_path).ok()?;
    if data.len() < 44 { return None; }

    let channels = u16::from_le_bytes([data[22], data[23]]) as u64;
    let sample_rate = u32::from_le_bytes([data[24], data[25], data[26], data[27]]) as u64;
    let bits_per_sample = u16::from_le_bytes([data[34], data[35]]) as u64;

    let (_offset, data_size) = find_wav_data_chunk(&data)?;

    let bytes_per_sample = bits_per_sample / 8;
    let total_samples = data_size / (channels * bytes_per_sample);
    let duration_ms = (total_samples * 1000) / sample_rate;
    Some(duration_ms as i64)
}

fn find_wav_data_chunk(data: &[u8]) -> Option<(u64, u64)> {
    if data.len() < 44 { return None; }
    let mut offset = 12u64;
    loop {
        if offset + 8 > data.len() as u64 { return None; }
        let chunk_id = &data[offset as usize..(offset + 4) as usize];
        let chunk_size = u32::from_le_bytes([
            data[(offset + 4) as usize],
            data[(offset + 5) as usize],
            data[(offset + 6) as usize],
            data[(offset + 7) as usize],
        ]) as u64;
        if chunk_id == b"data" {
            return Some((offset + 8, chunk_size));
        }
        offset += 8 + chunk_size;
    }
}

fn build_wav_chunk(pcm_data: &[u8], sample_rate: u32, channels: u16, bits_per_sample: u16) -> Vec<u8> {
    let mut wav = Vec::with_capacity(44 + pcm_data.len());
    // RIFF header
    wav.extend_from_slice(b"RIFF");
    let file_size = (36 + pcm_data.len()) as u32;
    wav.extend_from_slice(&file_size.to_le_bytes());
    wav.extend_from_slice(b"WAVE");
    // fmt sub-chunk
    wav.extend_from_slice(b"fmt ");
    wav.extend_from_slice(&16u32.to_le_bytes()); // sub-chunk size
    wav.extend_from_slice(&1u16.to_le_bytes());  // PCM format
    wav.extend_from_slice(&channels.to_le_bytes());
    wav.extend_from_slice(&sample_rate.to_le_bytes());
    let byte_rate = sample_rate as u32 * channels as u32 * (bits_per_sample as u32 / 8);
    wav.extend_from_slice(&byte_rate.to_le_bytes());
    let block_align = channels as u16 * (bits_per_sample as u16 / 8);
    wav.extend_from_slice(&block_align.to_le_bytes());
    wav.extend_from_slice(&bits_per_sample.to_le_bytes());
    // data sub-chunk
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&(pcm_data.len() as u32).to_le_bytes());
    wav.extend_from_slice(pcm_data);
    wav
}
