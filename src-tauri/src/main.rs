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

    #[cfg(target_os = "linux")]
    {
        // Disable sandbox (required for YouTube iframe playback on WebKitGTK 2.44+)
        std::env::set_var("WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS", "1");

        // Conditional GPU acceleration (D8):
        // Only disable HW accel for software renderers (llvmpipe, softpipe, swrast).
        // Real GPU drivers (Mesa, NVIDIA proprietary) work fine with HW accel.
        let mut needs_workaround = true; // Default to safe behavior
        if let Ok(output) = std::process::Command::new("glxinfo")
            .args(&["-B"])
            .output()
        {
            if let Ok(renderer) = String::from_utf8(output.stdout) {
                let is_software = renderer.contains("llvmpipe")
                    || renderer.contains("softpipe")
                    || renderer.contains("swrast");
                needs_workaround = is_software;
            }
        }

        if needs_workaround {
            // Disable DMA-BUF renderer (fixes EGL display issues)
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
            // Disable compositing mode (fixes white screen and video issues)
            std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
            // Disable hardware acceleration (required for YouTube video playback)
            std::env::set_var("WEBKIT_DISABLE_HARDWARE_ACCELERATION", "1");
        }

        // Point GStreamer at bundled plugins when running from an AppImage
        if let Ok(appdir) = std::env::var("APPDIR") {
            let plugin_path = format!("{appdir}/usr/lib/gstreamer-1.0");
            std::env::set_var("GST_PLUGIN_PATH", &plugin_path);
            std::env::set_var("GST_REGISTRY", "/dev/null");
        }
    }
    incrementum_tauri_lib::run()
}
