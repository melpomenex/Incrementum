// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::Write;

fn early_log(message: &str) {
    let log_path = std::env::temp_dir().join("incrementum-startup.log");
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        let timestamp = chrono::Utc::now().to_rfc3339();
        let _ = writeln!(file, "[{timestamp}] {message}");
    }
}

fn install_early_panic_hook() {
    std::panic::set_hook(Box::new(|info| {
        early_log(&format!("panic: {info}"));
    }));
}

fn main() {
    install_early_panic_hook();
    early_log("startup: main begin");

    // Linux WebKitGTK workarounds for "Failed to create GBM buffer" and white screen
    #[cfg(target_os = "linux")]
    {
        // Disable DMA-BUF renderer (fixes EGL display issues)
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        // Disable compositing mode (fixes white screen issues)
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        // Disable sandbox (can cause issues in some environments)
        std::env::set_var("WEBKIT_FORCE_SANDBOX", "0");
        // Use software rendering as fallback
        std::env::set_var("WEBKIT_USE_SURFACE_RENDERING", "1");
    }
    incrementum_tauri_lib::run()
}
