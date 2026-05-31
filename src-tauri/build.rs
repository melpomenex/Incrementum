fn main() {
    println!("cargo:rerun-if-changed=build.rs");

    // On macOS, fix the whisper sidecar binary's dylib references.
    //
    // The upstream whisper binary has hardcoded LC_RPATH entries pointing to
    // the original build directory (e.g. /Volumes/external/.../whisper.cpp/build/...).
    // macOS resolves @rpath entries in order, so those stale paths are tried first
    // and all fail — even if we add a correct rpath, the dylib load errors out.
    //
    // The dylibs are bundled via tauri.conf.json "resources" and land in
    // Contents/Resources/bin/. The sidecar binary lives at Contents/MacOS/whisper.
    // So we need @executable_path/../Resources/bin as the rpath.
    //
    // Fix: delete all stale LC_RPATH entries first, then add the correct one.
    if cfg!(target_os = "macos") {
        let bin_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("bin");

        // Collect all whisper-apple binaries in bin/
        let whisper_bins: Vec<std::path::PathBuf> = std::fs::read_dir(&bin_dir)
            .unwrap()
            .filter_map(|e| {
                let e = e.unwrap();
                let name = e.file_name().to_string_lossy().to_string();
                if name.starts_with("whisper-") && name.contains("apple") {
                    Some(e.path())
                } else {
                    None
                }
            })
            .collect();

        for binary_path in &whisper_bins {
            // Read existing rpaths and delete any that point to /Volumes/external/
            let output = std::process::Command::new("otool")
                .args(["-l", &binary_path.to_string_lossy()])
                .output()
                .ok();

            if let Some(output) = output {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let mut rpaths = Vec::new();
                for line in stdout.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("path ") && trimmed.contains("/Volumes/") {
                        if let Some(path) = trimmed.strip_prefix("path ") {
                            if let Some(path) = path.split_whitespace().next() {
                                rpaths.push(path.to_string());
                            }
                        }
                    }
                }

                for rpath in &rpaths {
                    let _ = std::process::Command::new("install_name_tool")
                        .args(["-delete_rpath", rpath])
                        .arg(binary_path)
                        .output();
                }
            }

            let _ = std::process::Command::new("install_name_tool")
                .args(["-add_rpath", "@executable_path/../Resources/bin"])
                .arg(binary_path)
                .output();
        }

        // Collect all moonshine-apple binaries in bin/
        let moonshine_bins: Vec<std::path::PathBuf> = std::fs::read_dir(&bin_dir)
            .unwrap()
            .filter_map(|e| {
                let e = e.unwrap();
                let name = e.file_name().to_string_lossy().to_string();
                if name.starts_with("moonshine-") && name.contains("apple") {
                    Some(e.path())
                } else {
                    None
                }
            })
            .collect();

        for binary_path in &moonshine_bins {
            let output = std::process::Command::new("otool")
                .args(["-l", &binary_path.to_string_lossy()])
                .output()
                .ok();

            if let Some(output) = output {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let mut rpaths = Vec::new();
                for line in stdout.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("path ") && trimmed.contains("/Volumes/") {
                        if let Some(path) = trimmed.strip_prefix("path ") {
                            if let Some(path) = path.split_whitespace().next() {
                                rpaths.push(path.to_string());
                            }
                        }
                    }
                }

                for rpath in &rpaths {
                    let _ = std::process::Command::new("install_name_tool")
                        .args(["-delete_rpath", rpath])
                        .arg(binary_path)
                        .output();
                }
            }

            let _ = std::process::Command::new("install_name_tool")
                .args(["-add_rpath", "@executable_path/../Resources/bin"])
                .arg(binary_path)
                .output();
        }
    }

    tauri_build::build()
}
