fn main() {
    println!("cargo:rerun-if-changed=build.rs");

    // On macOS, fix the rpath of the whisper sidecar binary so it can find
    // libwhisper.dylib and libggml*.dylib in the Resources/bin directory.
    // The sidecar is placed at Contents/MacOS/whisper, dylibs at
    // Contents/Resources/bin/, so we need @executable_path/../Resources/bin.
    if cfg!(target_os = "macos") {
        let bin_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("bin");
        for entry in std::fs::read_dir(&bin_dir).unwrap() {
            let entry = entry.unwrap();
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.starts_with("whisper-") && name_str.contains("apple") {
                let binary_path = entry.path();
                let _ = std::process::Command::new("install_name_tool")
                    .args(["-add_rpath", "@executable_path/../Resources/bin"])
                    .arg(&binary_path)
                    .output();
            }
        }
    }

    tauri_build::build()
}
