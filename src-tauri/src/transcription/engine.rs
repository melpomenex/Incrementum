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
        while let Some(event) = rx.recv().await {
            if let CommandEvent::Terminated(payload) = event {
                success = payload.code == Some(0);
                break;
            }
        }

        if !success {
            return Err(anyhow!("FFmpeg conversion failed"));
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
        let (mut rx, _) = self.app_handle.shell().sidecar("whisper")?
            .args([
                "-m", model_path.to_str().unwrap(),
                "-f", audio_path.to_str().unwrap(),
                "-l", language,
                "-ojf", // output json full
                "--print-realtime",
                "--print-progress",
            ])
            .spawn()?;

        // Process output events
        let mut success = false;
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    // Whisper output parsing could happen here for real-time updates
                    // For now we rely on the file output or simplified parsing if needed
                    // print!("STDOUT: {}", line_str); 
                }
                CommandEvent::Stderr(_line) => {
                    // let line_str = String::from_utf8_lossy(&line);
                    // print!("STDERR: {}", line_str);
                }
                CommandEvent::Terminated(payload) => {
                    success = payload.code == Some(0);
                    break;
                }
                _ => {}
            }
        }

        if !success {
            return Err(anyhow!("Whisper transcription failed"));
        }

        // After completion, whisper.cpp usually creates a .wav.json file (due to -ojf)
        let json_path = audio_path.with_extension("wav.json");
        if json_path.exists() {
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
        }

        Ok(())
    }
}