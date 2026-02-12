// Prevents additional console window on Windows in release, DO NOT REMOVE!!
// TEMPORARILY DISABLED for debugging Windows startup crash
// #![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![cfg_attr(all(not(debug_assertions), windows), windows_subsystem = "console")]

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
    // Keep the default panic output (stderr) while also logging to a file for
    // cases where the terminal output is not visible (e.g., GUI launches).
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        early_log(&format!("panic: {info}"));
        default_hook(info);
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
        // WebKitGTK 2.44+ requires this env var for sandbox opt-out in dev.
        std::env::set_var("WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS", "1");
        // Use software rendering as fallback
        std::env::set_var("WEBKIT_USE_SURFACE_RENDERING", "1");
        // Force software GL where EGL/DRI3 is unavailable.
        std::env::set_var("LIBGL_ALWAYS_SOFTWARE", "1");
    }
    incrementum_tauri_lib::run()
}
