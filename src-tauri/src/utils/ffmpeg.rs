//! FFmpeg command helper
//!
//! Provides a cross-platform way to run ffmpeg commands.
//! Uses system ffmpeg from PATH on all platforms.
//! 
//! Note: Previously bundled ffmpeg as a sidecar, but this caused conflicts
//! with system ffmpeg on Linux (.deb packages). Now requires ffmpeg to be
//! installed on the system or bundled separately by platform-specific packages.

use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::Command;
use anyhow::{Result, anyhow};

/// Get the ffmpeg command using system ffmpeg from PATH
/// 
/// Requires ffmpeg to be installed on the system. For Linux .deb packages,
/// ffmpeg is listed as a dependency. For other platforms, users need to
/// install ffmpeg separately or it can be bundled by the installer.
pub fn ffmpeg_command(app_handle: &AppHandle) -> Result<Command> {
    let shell = app_handle.shell();
    Ok(shell.command("ffmpeg"))
}

/// Check if ffmpeg is available on the system
pub async fn check_ffmpeg_available(app_handle: &AppHandle) -> Result<bool, String> {
    use tauri_plugin_shell::process::CommandEvent;
    
    let shell = app_handle.shell();
    let (mut rx, _) = shell.command("ffmpeg")
        .args(["-version"])
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;
    
    while let Some(event) = rx.recv().await {
        if let CommandEvent::Terminated(payload) = event {
            return Ok(payload.code == Some(0));
        }
    }
    
    Ok(false)
}
