/// Extract all LC_RPATH paths from a Mach-O binary via `otool -l`.
/// Returns an empty vec if otool is unavailable or the binary isn't a Mach-O.
fn read_rpaths(binary: &std::path::Path) -> Vec<String> {
    let output = match std::process::Command::new("otool")
        .args(["-l", &binary.to_string_lossy()])
        .output()
    {
        Ok(o) => o,
        Err(_) => return Vec::new(),
    };
    let stdout = String::from_utf8_lossy(&output.stdout);

    // otool prints LC_RPATH entries as two consecutive lines, e.g.:
    //       cmd LC_RPATH
    //   cmdsize 48
    //      path @executable_path/../Resources/bin (offset 12)
    // We walk the lines, and whenever we see `cmd LC_RPATH`, the `path` field
    // follows within the next few lines.
    let lines: Vec<&str> = stdout.lines().collect();
    let mut rpaths = Vec::new();
    let mut i = 0;
    while i < lines.len() {
        let trimmed = lines[i].trim();
        if trimmed.ends_with("LC_RPATH") {
            // Look ahead for the `path ...` line.
            for &peek in lines.iter().take((i + 4).min(lines.len())).skip(i + 1) {
                let p = peek.trim();
                if let Some(rest) = p.strip_prefix("path ") {
                    if let Some(path) = rest.split_whitespace().next() {
                        rpaths.push(path.to_string());
                    }
                    break;
                }
            }
        }
        i += 1;
    }
    rpaths
}

fn main() {
    println!("cargo:rerun-if-changed=build.rs");

    // Expose the full Rust target triple to the library crate as a compile-time
    // env var. Used by engine.rs / model_manager.rs to build sidecar binary paths
    // that match Tauri's externalBin naming convention (<name>-<target-triple>).
    // `std::env::var("TARGET")` is only available here in build.rs, not in lib code.
    let target_triple = std::env::var("TARGET").unwrap_or_default();
    println!("cargo:rustc-env=TAURI_TARGET_TRIPLE={}", target_triple);

    // Ensure the sherpa-onnx sidecar placeholder exists for the current target.
    // Tauri's bundler requires every externalBin entry to be present at build time.
    // If the real binary can't be downloaded (e.g. CI without network), a 0-byte
    // placeholder keeps the build from failing. At runtime, engine.rs detects the
    // empty/placeholder sidecar and returns a clear "sidecar not available" error
    // instead of trying to execute it; model_manager.rs reports such models as not
    // installed.
    let bin_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("bin");
    if bin_dir.is_dir() {
        let target = std::env::var("TARGET").unwrap_or_default();
        if !target.is_empty() {
            let sidecar_name = if target.contains("windows") {
                format!("sherpa-onnx-{}.exe", target)
            } else {
                format!("sherpa-onnx-{}", target)
            };
            let sidecar_path = bin_dir.join(&sidecar_name);
            if !sidecar_path.exists() {
                std::fs::write(&sidecar_path, []).ok();
            }
        }
    }

    // On macOS, fix the whisper/sherpa sidecar binaries' dylib references.
    //
    // Why this matters: these sidecars are dynamically linked
    // (`@rpath/libwhisper.1.dylib`, `@rpath/libggml*.dylib`, `@rpath/libonnxruntime*.dylib`).
    // dyld resolves `@rpath/...` against the binary's LC_RPATH entries. Without the
    // right rpath(s), launching the sidecar dies at startup with
    // "dyld: Library not loaded: @rpath/libwhisper.1.dylib" — which silently breaks
    // *every* transcription (Distil / base / small all share the whisper sidecar)
    // before any model-specific code runs.
    //
    // Two distinct layouts must both work:
    //   • Production (bundled .app): sidecar at Contents/MacOS/<name>, dylibs at
    //     Contents/Resources/bin/*.dylib  → needs rpath "@executable_path/../Resources/bin".
    //   • Dev (tauri dev / cargo build): sidecar runs straight out of src-tauri/bin/
    //     with the dylibs beside it  → needs rpath "@executable_path".
    // We add BOTH rpaths so dylib resolution succeeds in either layout, and we
    // strip stale /Volumes/external/... LC_RPATH entries left over from the build host
    // (those are tried first and mask the correct ones).
    //
    // install_name_tool mutates the Mach-O load commands, which invalidates the
    // embedded ad-hoc signature. On Apple Silicon, an unsigned/invalid binary is
    // SIGKILL'd by the kernel, so we re-sign ad-hoc with codesign afterward.
    if cfg!(target_os = "macos") {
        let bin_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("bin");

        // Both production and dev rpaths must be present on every macOS sidecar.
        const RPATHS: [&str; 2] = [
            "@executable_path/../Resources/bin", // production .app layout
            "@executable_path",                   // dev layout (dylibs beside the binary)
        ];

        let sidecar_bins: Vec<std::path::PathBuf> = std::fs::read_dir(&bin_dir)
            .into_iter()
            .flatten()
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| {
                let name = p
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                let is_apple = name.contains("apple");
                (name.starts_with("whisper-") || name.starts_with("sherpa-")) && is_apple
            })
            .collect();

        for binary_path in &sidecar_bins {
            // Skip 0-byte placeholder sidecars (e.g. an unbuilt sidecar without a
            // prebuilt asset); install_name_tool/codesign would fail on them, and
            // they're handled by the runtime checks in engine.rs / model_manager.rs.
            match std::fs::metadata(binary_path) {
                Ok(md) if md.len() == 0 => continue,
                Ok(_) => {}
                Err(_) => continue,
            }

            // IDEMPOTENCE: this build script runs on every cargo invocation, and in
            // `tauri dev` the file-watcher treats any change under bin/ as a reason to
            // rebuild. If we unconditionally re-sign/re-rpath the sidecars we get an
            // infinite rebuild loop. So we first compute whether any change is actually
            // needed, and only touch the binary (which updates its mtime) when it is.
            let existing_rpaths = read_rpaths(binary_path);
            let stale_rpaths: Vec<&String> = existing_rpaths
                .iter()
                .filter(|r| r.contains("/Volumes/"))
                .collect();
            let missing_rpaths: Vec<&&str> = RPATHS
                .iter()
                .filter(|r| !existing_rpaths.iter().any(|e| e == **r))
                .collect();

            // Check whether the binary already has a valid ad-hoc signature.
            // `codesign --verify` exits 0 only for a valid signature.
            let sig_ok = std::process::Command::new("codesign")
                .args(["--verify", "--strict"])
                .arg(binary_path)
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false);

            if stale_rpaths.is_empty() && missing_rpaths.is_empty() && sig_ok {
                // Nothing to do — leave the binary untouched so its mtime is stable.
                continue;
            }

            // Delete stale /Volumes/external/... rpaths left over from the build host.
            for rpath in &stale_rpaths {
                let _ = std::process::Command::new("install_name_tool")
                    .args(["-delete_rpath", rpath])
                    .arg(binary_path)
                    .output();
            }

            // Add any missing rpaths (install_name_tool errors on duplicate LC_RPATH,
            // which is why we checked `missing_rpaths` first).
            for rpath in &missing_rpaths {
                let _ = std::process::Command::new("install_name_tool")
                    .args(["-add_rpath", rpath])
                    .arg(binary_path)
                    .output();
            }

            // install_name_tool invalidated the ad-hoc signature (or it was missing) —
            // re-apply it so Apple Silicon doesn't SIGKILL the binary on launch.
            let _ = std::process::Command::new("codesign")
                .args(["--force", "--sign", "-"])
                .arg(binary_path)
                .output();
        }
    }

    tauri_build::build()
}
