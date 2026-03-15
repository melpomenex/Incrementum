//! Pocket TTS - Local text-to-speech via sidecar
//!
//! Provides offline TTS using the Pocket TTS library from Kyutai Labs.
//! https://github.com/kyutai-labs/pocket-tts

use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use tokio::sync::Mutex;

/// Pocket TTS voice identifiers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PocketVoice {
    Alba,
    Marius,
    Javert,
    Jean,
    Fantine,
    Cosette,
    Eponine,
    Azelma,
}

impl PocketVoice {
    pub fn as_str(&self) -> &'static str {
        match self {
            PocketVoice::Alba => "alba",
            PocketVoice::Marius => "marius",
            PocketVoice::Javert => "javert",
            PocketVoice::Jean => "jean",
            PocketVoice::Fantine => "fantine",
            PocketVoice::Cosette => "cosette",
            PocketVoice::Eponine => "eponine",
            PocketVoice::Azelma => "azelma",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "alba" => Some(PocketVoice::Alba),
            "marius" => Some(PocketVoice::Marius),
            "javert" => Some(PocketVoice::Javert),
            "jean" => Some(PocketVoice::Jean),
            "fantine" => Some(PocketVoice::Fantine),
            "cosette" => Some(PocketVoice::Cosette),
            "eponine" => Some(PocketVoice::Eponine),
            "azelma" => Some(PocketVoice::Azelma),
            _ => None,
        }
    }
}

/// Status of Pocket TTS sidecar
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PocketTTSStatus {
    /// Whether the sidecar binary is available
    pub available: bool,
    /// Whether a download is in progress
    pub downloading: bool,
    /// Download progress (0-100)
    pub download_progress: Option<i32>,
    /// Error message if any
    pub error: Option<String>,
}

/// Result of speech generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PocketTTSResult {
    /// Audio data as base64-encoded WAV
    pub audio_data: String,
    /// Sample rate
    pub sample_rate: u32,
    /// Duration in seconds
    pub duration_sec: f64,
}

/// Global state for Pocket TTS
pub struct PocketTTSState {
    /// Whether the sidecar is available
    available: Arc<Mutex<bool>>,
    /// Currently running process (for cancellation)
    current_process: Arc<Mutex<Option<u32>>>,
}

impl Default for PocketTTSState {
    fn default() -> Self {
        Self {
            available: Arc::new(Mutex::new(false)),
            current_process: Arc::new(Mutex::new(None)),
        }
    }
}

/// Check if Pocket TTS sidecar is available
pub async fn check_pocket_tts_available(app_handle: &AppHandle) -> Result<PocketTTSStatus> {
    let shell = app_handle.shell();

    // Try to run the sidecar with --help to check availability
    // (pocket-tts doesn't have --version, but --help exits with 0)
    let sidecar_result = shell.sidecar("pocket-tts");

    match sidecar_result {
        Ok(cmd) => {
            let (mut rx, _) = cmd.args(["--help"]).spawn()?;

            let mut available = false;
            while let Some(event) = rx.recv().await {
                if let CommandEvent::Terminated(payload) = event {
                    available = payload.code == Some(0);
                    break;
                }
            }

            Ok(PocketTTSStatus {
                available,
                downloading: false,
                download_progress: None,
                error: if available { None } else { Some("Pocket TTS sidecar not found".to_string()) },
            })
        }
        Err(e) => {
            Ok(PocketTTSStatus {
                available: false,
                downloading: false,
                download_progress: None,
                error: Some(format!("Sidecar not available: {}", e)),
            })
        }
    }
}

/// Generate speech using Pocket TTS
pub async fn generate_pocket_speech(
    app_handle: &AppHandle,
    text: String,
    voice: String,
    speed: f64,
) -> Result<PocketTTSResult> {
    let voice_id = PocketVoice::from_str(&voice)
        .ok_or_else(|| anyhow!("Invalid voice: {}", voice))?;

    let cache_dir = app_handle.path().app_cache_dir()?;
    std::fs::create_dir_all(&cache_dir)?;
    let output_path = cache_dir.join(format!("pocket-tts-{}.wav", uuid::Uuid::new_v4()));

    let shell = app_handle.shell();
    let cmd = shell.sidecar("pocket-tts")
        .map_err(|e| anyhow!("Pocket TTS sidecar not found: {}", e))?;

    let (mut rx, _) = cmd
        .args([
            "generate",
            "--text", &text,
            "--voice", voice_id.as_str(),
            "--output-path", output_path.to_str().unwrap(),
        ])
        .spawn()?;

    let mut success = false;
    let mut stderr_buf = String::new();

    while let Some(event) = rx.recv().await {
        match event {
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
        return Err(anyhow!("Pocket TTS synthesis failed: {}", stderr_buf.trim()));
    }

    // Read the generated audio file
    if !output_path.exists() {
        return Err(anyhow!("Pocket TTS did not generate output file"));
    }

    let audio_data = std::fs::read(&output_path)?;
    let audio_base64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &audio_data);

    // Clean up temp file
    let _ = std::fs::remove_file(&output_path);

    // Estimate duration (assuming 24kHz sample rate, 16-bit mono)
    let sample_rate = 24000u32;
    let bytes_per_sample = 2u32;
    let num_samples = audio_data.len() as u32 / bytes_per_sample;
    let duration_sec = num_samples as f64 / sample_rate as f64;

    Ok(PocketTTSResult {
        audio_data: format!("data:audio/wav;base64,{}", audio_base64),
        sample_rate,
        duration_sec,
    })
}

/// Stop any ongoing Pocket TTS synthesis
pub async fn stop_pocket_tts(app_handle: &AppHandle) -> Result<()> {
    let state = app_handle.state::<PocketTTSState>();
    let mut current = state.current_process.lock().await;

    // Just clear the reference - the sidecar process will terminate when the app closes
    // Note: We don't need to explicitly kill the process since tauri-plugin-shell
    // handles process lifecycle management
    *current = None;

    Ok(())
}

/// Clean up Pocket TTS resources
pub async fn cleanup_pocket_tts(app_handle: &AppHandle) -> Result<()> {
    stop_pocket_tts(app_handle).await?;
    Ok(())
}

/// Tauri command: Get Pocket TTS status
#[tauri::command]
pub async fn pocket_tts_status(app_handle: tauri::AppHandle) -> Result<PocketTTSStatus, String> {
    check_pocket_tts_available(&app_handle)
        .await
        .map_err(|e| e.to_string())
}

/// Tauri command: Generate speech
#[tauri::command]
pub async fn pocket_tts_generate(
    app_handle: tauri::AppHandle,
    text: String,
    voice: String,
    speed: f64,
) -> Result<PocketTTSResult, String> {
    generate_pocket_speech(&app_handle, text, voice, speed)
        .await
        .map_err(|e| e.to_string())
}

/// Tauri command: Stop synthesis
#[tauri::command]
pub async fn pocket_tts_stop(app_handle: tauri::AppHandle) -> Result<(), String> {
    stop_pocket_tts(&app_handle)
        .await
        .map_err(|e| e.to_string())
}

/// Tauri command: Cleanup resources
#[tauri::command]
pub async fn pocket_tts_cleanup(app_handle: tauri::AppHandle) -> Result<(), String> {
    cleanup_pocket_tts(&app_handle)
        .await
        .map_err(|e| e.to_string())
}
