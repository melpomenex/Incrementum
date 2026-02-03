use serde::{Serialize, Deserialize};
use std::path::{Path, PathBuf};
use anyhow::{Result, anyhow};
use tauri::{AppHandle, Manager, Emitter};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

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

pub struct TranscriptionEngine {
    app_handle: AppHandle,
}

impl TranscriptionEngine {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    /// Converts audio to 16kHz WAV as required by whisper.cpp
    pub async fn prepare_audio(&self, input_path: &Path) -> Result<PathBuf> {
        let temp_dir = self.app_handle.path().app_cache_dir()?.join("transcription");
        if !temp_dir.exists() {
            std::fs::create_dir_all(&temp_dir)?;
        }

        let output_path = temp_dir.join(format!("{}.wav", uuid::Uuid::new_v4()));

        let (mut rx, _) = self.app_handle.shell().sidecar("ffmpeg")?
            .args([
                "-i", input_path.to_str().unwrap(),
                "-ar", "16000",
                "-ac", "1",
                "-c:a", "pcm_s16le",
                "-y", // overwrite
                output_path.to_str().unwrap()
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

        // Use the bundled sidecar binary ("whisper"). The repo config only ships this name.
        let cmd = self.app_handle.shell().sidecar("whisper")
            .map_err(|e| anyhow!("Whisper sidecar not found: {}", e))?;
        let (mut rx, _) = cmd.args(args).spawn().map_err(|e| {
            anyhow!("Failed to launch sidecar 'whisper': {}", e)
        })?;

        // Process output events
        let mut success = false;
        let mut stdout_buf = String::new();
        let mut stderr_buf = String::new();
        let mut stderr_line_buf = String::new();
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    // Whisper output parsing could happen here for real-time updates
                    // For now we rely on the file output or simplified parsing if needed
                    // print!("STDOUT: {}", line_str); 
                    if stdout_buf.len() < 4000 {
                        stdout_buf.push_str(&line_str);
                    }
                }
                CommandEvent::Stderr(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    stderr_line_buf.push_str(&line_str);
                    
                    while let Some(newline_idx) = stderr_line_buf.find('\n') {
                        let line = stderr_line_buf[..newline_idx].trim().to_string();
                        // Advance buffer
                        stderr_line_buf = stderr_line_buf[newline_idx + 1..].to_string();
                        
                        // Parse progress: "progress = 5%"
                        if let Some(idx) = line.find("progress =") {
                            let rest = &line[idx + 10..];
                            if let Some(end) = rest.find('%') {
                                if let Ok(p) = rest[..end].trim().parse::<i32>() {
                                    let _ = self.app_handle.emit("transcription://progress", ProgressPayload { progress: p });
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
                format!("Whisper transcription failed: {}", stderr_clean)
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
        
        // Cleanup
        let _ = std::fs::remove_file(json_path);

        Ok(())
    }
}
