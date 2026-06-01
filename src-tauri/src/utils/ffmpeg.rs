//! FFmpeg command helper
//!
//! Provides a cross-platform way to run ffmpeg commands.
//! Uses system ffmpeg from PATH on all platforms.
//!
//! Note: Previously bundled ffmpeg as a sidecar, but this caused conflicts
//! with system ffmpeg on Linux (.deb packages). Now requires ffmpeg to be
//! installed on the system or bundled separately by platform-specific packages.

use std::path::PathBuf;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::Command;
use anyhow::{Result, anyhow};

/// Homebrew binary directories to search for ffmpeg on macOS.
const HOMEBREW_BIN_DIRS: &[&str] = &[
    "/opt/homebrew/bin",  // Apple Silicon
    "/usr/local/bin",     // Intel Mac
];

/// The ffmpeg binary name (platform-specific).
fn ffmpeg_binary_name() -> &'static str {
    if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" }
}

/// PATH separator character.
const PATH_SEP: char = if cfg!(windows) { ';' } else { ':' };

/// Resolve ffmpeg to an absolute path, checking common locations.
fn resolve_ffmpeg_path() -> Option<PathBuf> {
    let binary = ffmpeg_binary_name();

    // On macOS, GUI apps don't inherit shell PATH — check Homebrew locations directly
    for dir in HOMEBREW_BIN_DIRS {
        let candidate = PathBuf::from(dir).join(binary);
        if candidate.exists() {
            return Some(candidate);
        }
    }

    // Fall back to PATH resolution
    let path_var = std::env::var("PATH").unwrap_or_default();
    for dir in path_var.split(PATH_SEP) {
        let candidate = PathBuf::from(dir).join(binary);
        if candidate.exists() {
            return Some(candidate);
        }
    }

    None
}

/// Build an enhanced PATH string that includes Homebrew directories.
fn enhanced_path() -> String {
    let existing = std::env::var("PATH").unwrap_or_default();
    let homebrew_dirs: Vec<&str> = HOMEBREW_BIN_DIRS.iter()
        .filter(|dir| !existing.contains(**dir))
        .copied()
        .collect();

    if homebrew_dirs.is_empty() {
        existing
    } else {
        format!("{}{}{}", homebrew_dirs.join(&PATH_SEP.to_string()), PATH_SEP, existing)
    }
}

/// Get the ffmpeg command with PATH enhanced for macOS Homebrew.
pub fn ffmpeg_command(app_handle: &AppHandle) -> Result<Command> {
    let ffmpeg_path = resolve_ffmpeg_path().ok_or_else(|| {
        anyhow!(
            "ffmpeg is not installed. Install it with: brew install ffmpeg (macOS) or apt install ffmpeg (Linux)"
        )
    })?;

    let shell = app_handle.shell();
    let cmd = shell.command(ffmpeg_path).env("PATH", enhanced_path());
    Ok(cmd)
}

/// Check if ffmpeg is available on the system
pub async fn check_ffmpeg_available(app_handle: &AppHandle) -> Result<bool, String> {
    use tauri_plugin_shell::process::CommandEvent;

    let shell = app_handle.shell();
    let (mut rx, _) = shell.command("ffmpeg")
        .args(["-version"])
        .env("PATH", enhanced_path())
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;

    while let Some(event) = rx.recv().await {
        if let CommandEvent::Terminated(payload) = event {
            return Ok(payload.code == Some(0));
        }
    }

    Ok(false)
}
