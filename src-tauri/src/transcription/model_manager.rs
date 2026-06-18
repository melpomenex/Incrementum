use serde::{Serialize, Deserialize};
use std::path::{Path, PathBuf};
use std::fs;
use anyhow::{Result, anyhow};
use reqwest::Client;
use sha2::{Sha256, Digest};
use futures_util::StreamExt;
use tokio::io::AsyncWriteExt;
use tauri::{AppHandle, Manager, Emitter};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelProfile {
    pub id: String,
    pub name: String,
    pub description: String,
    pub url: String,
    pub sha256: String,
    pub size_bytes: u64,
    pub installed: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelStatus {
    pub id: String,
    pub installed: bool,
    pub downloading: bool,
    pub progress: f32,
}

pub struct ModelManager {
    profiles: Vec<ModelProfile>,
    models_dir: PathBuf,
    parakeet_models_dir: PathBuf,
    /// Directory where bundled sidecar binaries live (resource_dir/bin in prod,
    /// src-tauri/bin in dev). None if it can't be resolved.
    sidecar_bin_dir: Option<PathBuf>,
}

async fn fetch_lfs_metadata(client: &Client, profile_url: &str) -> Option<(String, u64)> {
    let raw_url = profile_url.replace("/resolve/", "/raw/");
    let response = client.get(&raw_url).send().await.ok()?;
    if !response.status().is_success() {
        return None;
    }
    let body = response.text().await.ok()?;

    let mut sha256 = None;
    let mut size_bytes = None;

    for line in body.lines() {
        if line.starts_with("oid sha256:") {
            sha256 = Some(line.trim_start_matches("oid sha256:").trim().to_string());
        } else if line.starts_with("size ") {
            if let Ok(sz) = line.trim_start_matches("size ").trim().parse::<u64>() {
                size_bytes = Some(sz);
            }
        }
    }

    if let (Some(hash), Some(size)) = (sha256, size_bytes) {
        Some((hash, size))
    } else {
        None
    }
}

impl ModelManager {
    pub fn new(app_handle: &AppHandle) -> Result<Self> {
        let app_dir = app_handle.path().app_data_dir()?;
        let models_dir = app_dir.join("models").join("whisper");

        if !models_dir.exists() {
            fs::create_dir_all(&models_dir)?;
        }

        let parakeet_models_dir = app_dir.join("models").join("parakeet");
        if !parakeet_models_dir.exists() {
            fs::create_dir_all(&parakeet_models_dir)?;
        }

        // Resolve the sidecar binary directory the same way TranscriptionEngine does,
        // so "installed" reflects whether the model can actually be *used* — not just
        // whether its weights are on disk. This matters when the sidecar binary is a
        // 0-byte placeholder (e.g. sherpa-onnx on a target without a prebuilt asset).
        //
        // In dev, prefer the source `bin/` dir (where the real externalBin sidecars
        // live) over `resource_dir()/bin` (which Tauri populates with resource dylibs
        // but NOT the externalBin executables). See engine.rs::sidecar_bin_dir for
        // the full rationale.
        let sidecar_bin_dir = {
            let dev_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("bin");
            let dev_has_sidecars = std::fs::read_dir(&dev_dir)
                .map(|entries| entries.filter_map(|e| e.ok()).any(|e| {
                    e.file_name().to_string_lossy().starts_with("whisper-")
                        || e.file_name().to_string_lossy().starts_with("sherpa-onnx-")
                }))
                .unwrap_or(false);
            if dev_dir.is_dir() && dev_has_sidecars {
                Some(dev_dir)
            } else {
                let dir = app_handle.path().resource_dir().ok().map(|d| d.join("bin"));
                if dir.as_ref().map(|d| d.is_dir()).unwrap_or(false) {
                    dir
                } else {
                    None
                }
            }
        };

        // Sherpa-onnx models (Parakeet, SenseVoice): converted model tarballs from
        // the sherpa-onnx `asr-models` GitHub release. Each extracts to a dir with
        // model.int8.onnx + tokens.txt. Parakeet-110M (~104MB, English SOTA) and
        // SenseVoice-small (~163MB, zh/en/ja/ko/yue). Run via the sherpa-onnx sidecar.
        // NOTE: pinned to the GitHub `asr-models` release (a stable, long-lived asset
        // URL). HuggingFace mirrors of this exact conversion are not reliably
        // enumerable, so do not switch this to an HF resolve URL without verifying.
        let profiles = vec![
            ModelProfile {
                id: "distil-small.en".to_string(),
                name: "English Fast (Distil)".to_string(),
                description: "Optimized English-only Whisper model. Very fast and accurate.".to_string(),
                url: "https://huggingface.co/distil-whisper/distil-small.en/resolve/main/ggml-distil-small.en.bin".to_string(),
                sha256: "7691eb11167ab7aaf6b3e05d8266f2fd9ad89c550e433f86ac266ebdee6c970a".to_string(),
                size_bytes: 336191657,
                installed: false,
            },
            ModelProfile {
                id: "base".to_string(),
                name: "Multilingual Fast".to_string(),
                description: "Smallest multilingual Whisper model. Good for quick results.".to_string(),
                url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin".to_string(),
                sha256: "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe".to_string(),
                size_bytes: 147951465,
                installed: false,
            },
            ModelProfile {
                id: "small".to_string(),
                name: "Multilingual Balanced".to_string(),
                description: "Good balance of speed and accuracy for most languages.".to_string(),
                url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin".to_string(),
                sha256: "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b".to_string(),
                size_bytes: 487601967,
                installed: false,
            },
            ModelProfile {
                id: "parakeet-tdt-ctc-110m".to_string(),
                name: "Parakeet TDT-CTC 110M".to_string(),
                description: "NVIDIA Parakeet (English). State-of-the-art accuracy at high speed. Runs via sherpa-onnx.".to_string(),
                url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet_tdt_ctc_110m-en-36000-int8.tar.bz2".to_string(),
                sha256: "".to_string(),
                size_bytes: 104_337_827,
                installed: false,
            },
            ModelProfile {
                id: "sense-voice-small".to_string(),
                name: "SenseVoice Small".to_string(),
                description: "Alibaba SenseVoice (Chinese / English / Japanese / Korean / Cantonese). Fast, accurate, with punctuation. Runs via sherpa-onnx.".to_string(),
                url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17.tar.bz2".to_string(),
                sha256: "".to_string(),
                size_bytes: 163_002_883,
                installed: false,
            },
        ];

        Ok(Self { profiles, models_dir, parakeet_models_dir, sidecar_bin_dir })
    }

    pub fn list_profiles(&self) -> Vec<ModelProfile> {
        self.profiles.iter().map(|profile| {
            let mut updated = profile.clone();
            updated.installed = self.is_model_installed(&profile.id);
            updated
        }).collect()
    }

    /// True for any model that runs through the sherpa-onnx sidecar (Parakeet,
    /// SenseVoice, and future sherpa families). All of these store their weights
    /// as a directory of ONNX files under `parakeet_models_dir` (shared dir for
    /// all sherpa families) and share the same download/extract/install logic.
    fn is_sherpa_model(id: &str) -> bool {
        id.starts_with("parakeet-") || id.starts_with("sense-voice-")
    }

    /// Returns the sidecar binary name ("whisper" or "sherpa-onnx") a model needs.
    fn sidecar_for_model(id: &str) -> &'static str {
        if Self::is_sherpa_model(id) { "sherpa-onnx" } else { "whisper" }
    }

    /// Resolve the on-disk path of a named sidecar, searching every layout Tauri
    /// uses across dev and bundled builds. Returns the first existing path.
    ///
    /// Mirrors `TranscriptionEngine::sidecar_path`: probes the dev source `bin/`,
    /// the resource `bin/`, and the bundled externalBin location (next to the main
    /// exe, bare name with no target-triple suffix — e.g. `Contents/MacOS/sherpa-onnx`
    /// on macOS). This matters because `is_model_installed` (which uses this) drives
    /// whether the UI shows the Download vs Delete button, so a wrong "not installed"
    /// verdict hides the Download button entirely.
    fn sidecar_path(&self, name: &str) -> Option<PathBuf> {
        let triple = env!("TAURI_TARGET_TRIPLE");
        let mut candidates: Vec<PathBuf> = Vec::new();

        // 1 & 2: the dev-source / resource bin dir resolved at construction.
        if let Some(bin_dir) = self.sidecar_bin_dir.as_ref() {
            candidates.push(bin_dir.join(format!("{}-{}", name, triple)));
        }
        // Dev source dir (CARGO_MANIFEST_DIR baked at compile time).
        candidates.push(
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("bin").join(format!("{}-{}", name, triple))
        );
        // 3: bundled externalBin — next to the main exe, bare name (no triple).
        if let Some(exe_dir) = std::env::current_exe().ok().and_then(|e| e.parent().map(|p| p.to_path_buf())) {
            if cfg!(windows) {
                candidates.push(exe_dir.join(format!("{}.exe", name)));
            } else {
                candidates.push(exe_dir.join(name));
            }
        }

        candidates.into_iter().find(|p| p.exists())
    }

    /// True if the sidecar binary required by `id` is present and non-empty
    /// (i.e. not a 0-byte placeholder). A model whose sidecar is missing or a
    /// placeholder is not practically usable, so we treat it as not installed.
    fn is_sidecar_usable(&self, id: &str) -> bool {
        let path = match self.sidecar_path(Self::sidecar_for_model(id)) {
            Some(p) => p,
            None => return false,
        };
        std::fs::metadata(&path).map(|m| m.len() > 0).unwrap_or(false)
    }

    fn get_parakeet_model_dir(&self, id: &str) -> PathBuf {
        // Shared directory for all sherpa families (parakeet-*, sense-voice-*).
        self.parakeet_models_dir.join(id)
    }

    pub fn get_model_path(&self, id: &str) -> PathBuf {
        if Self::is_sherpa_model(id) {
            self.get_parakeet_model_dir(id)
        } else {
            self.models_dir.join(format!("ggml-{}.bin", id))
        }
    }

    pub fn is_model_installed(&self, id: &str) -> bool {
        // Weights must be present AND the platform's sidecar binary must be a real,
        // non-empty executable. The sidecar check prevents the UI from advertising a
        // model as installed when its engine binary is a 0-byte placeholder.
        if !self.is_sidecar_usable(id) {
            return false;
        }
        if Self::is_sherpa_model(id) {
            let dir = self.get_parakeet_model_dir(id);
            dir.join("model.int8.onnx").exists() && dir.join("tokens.txt").exists()
        } else {
            self.get_model_path(id).exists()
        }
    }

    pub async fn download_model(&self, id: &str, app_handle: AppHandle) -> Result<()> {
        if Self::is_sherpa_model(id) {
            return self.download_sherpa_model(id, app_handle).await;
        }

        let profile = self.profiles.iter().find(|p| p.id == id)
            .ok_or_else(|| anyhow!("Model profile not found"))?;

        let dest_path = self.get_model_path(id);
        let temp_path = dest_path.with_extension("download");

        let client = Client::new();

        // Fetch dynamic LFS metadata if possible to prevent failure if HF updates the file
        let mut expected_sha256 = profile.sha256.clone();
        let mut expected_size = profile.size_bytes;

        if let Some((dynamic_sha, dynamic_size)) = fetch_lfs_metadata(&client, &profile.url).await {
            expected_sha256 = dynamic_sha;
            expected_size = dynamic_size;
        }

        let mut response = client.get(&profile.url).send().await?;

        if !response.status().is_success() {
            return Err(anyhow!("Failed to download model: {}", response.status()));
        }

        let total_size = response.content_length().unwrap_or(expected_size);
        let mut downloaded: u64 = 0;
        let mut file = tokio::fs::File::create(&temp_path).await?;
        let mut hasher = Sha256::new();

        let mut stream = response.bytes_stream();

        while let Some(item) = stream.next().await {
            let chunk = item?;
            file.write_all(&chunk).await?;
            hasher.update(&chunk);
            downloaded += chunk.len() as u64;

            let progress = (downloaded as f32 / total_size as f32) * 100.0;
            app_handle.emit("transcription://download-progress", ModelStatus {
                id: id.to_string(),
                installed: false,
                downloading: true,
                progress,
            })?;
        }

        file.flush().await?;
        drop(file);

        // Verify hash to ensure model integrity
        let hash = format!("{:x}", hasher.finalize());
        if !expected_sha256.is_empty() && hash != expected_sha256 {
            let _ = fs::remove_file(&temp_path);
            return Err(anyhow!(
                "Model hash verification failed: expected {}, got {}",
                expected_sha256,
                hash
            ));
        }

        fs::rename(&temp_path, &dest_path)?;

        app_handle.emit("transcription://download-complete", id.to_string())?;

        Ok(())
    }

    pub fn delete_model(&self, id: &str) -> Result<()> {
        if Self::is_sherpa_model(id) {
            let dir = self.get_parakeet_model_dir(id);
            if dir.exists() {
                fs::remove_dir_all(dir)?;
            }
        } else {
            let path = self.get_model_path(id);
            if path.exists() {
                fs::remove_file(path)?;
            }
        }
        Ok(())
    }

    /// Download and extract a sherpa-onnx model tarball (Parakeet, SenseVoice,
    /// and any future sherpa family).
    ///
    /// These models ship as `.tar.bz2` from the sherpa-onnx `asr-models` GitHub
    /// release. Each extracts to a top-level dir whose name equals the tarball's
    /// basename without `.tar.bz2` (e.g. `sherpa-onnx-sense-voice-zh-en-ja-ko-yue-
    /// int8-2024-07-17/`), containing `model.int8.onnx`, `tokens.txt`, and a
    /// `test_wavs/` dir. We stream the download to a temp file, shell out to
    /// system `tar` (universally available on macOS/Linux; Windows 10+ ships tar
    /// in System32) to extract it, then move the model files into `<id>/`.
    async fn download_sherpa_model(&self, id: &str, app_handle: AppHandle) -> Result<()> {
        let profile = self.profiles.iter().find(|p| p.id == id)
            .ok_or_else(|| anyhow!("Model profile not found for {}", id))?;

        let dest_dir = self.get_parakeet_model_dir(id);
        // If already extracted, nothing to do.
        if dest_dir.join("model.int8.onnx").exists() && dest_dir.join("tokens.txt").exists() {
            return Ok(());
        }
        fs::create_dir_all(&dest_dir)?;

        let client = Client::new();
        let temp_archive = dest_dir.join(format!("{}.tar.bz2", id));

        // 1. Stream the download with progress + hash.
        let response = client.get(&profile.url).send().await?;
        if !response.status().is_success() {
            let _ = fs::remove_file(&temp_archive);
            return Err(anyhow!("Failed to download {}: {}", id, response.status()));
        }

        let total_size = response.content_length().unwrap_or(profile.size_bytes);
        let mut file = tokio::fs::File::create(&temp_archive).await?;
        let mut hasher = Sha256::new();
        let mut downloaded: u64 = 0;
        let mut stream = response.bytes_stream();
        while let Some(item) = stream.next().await {
            let chunk = item?;
            file.write_all(&chunk).await?;
            hasher.update(&chunk);
            downloaded += chunk.len() as u64;
            let progress = (downloaded as f32 / total_size.max(1) as f32) * 100.0;
            app_handle.emit("transcription://download-progress", ModelStatus {
                id: id.to_string(),
                installed: false,
                downloading: true,
                progress,
            })?;
        }
        file.flush().await?;
        drop(file);

        // 2. Extract via system tar (handles .tar.bz2). Extract into a temp sibling
        //    dir, then locate the top-level model dir and move its model files into
        //    dest_dir. The top-level dir name is derived from the tarball filename
        //    (everything before `.tar.bz2`), so this works for any sherpa family
        //    rather than hardcoding a "parakeet" prefix.
        let extract_dir = dest_dir.join(".extract");
        let _ = fs::remove_dir_all(&extract_dir);
        fs::create_dir_all(&extract_dir)?;

        let tar_output = std::process::Command::new("tar")
            .args(["-xjf", temp_archive.to_string_lossy().as_ref()])
            .arg("-C").arg(&extract_dir)
            .output()
            .map_err(|e| {
                let _ = fs::remove_file(&temp_archive);
                let _ = fs::remove_dir_all(&extract_dir);
                anyhow!("Failed to run tar to extract {}: {}. Ensure `tar` is on PATH.", id, e)
            })?;

        let _ = fs::remove_file(&temp_archive);

        if !tar_output.status.success() {
            let stderr = String::from_utf8_lossy(&tar_output.stderr);
            let _ = fs::remove_dir_all(&extract_dir);
            return Err(anyhow!("tar extraction failed for {}: {}", id, stderr.trim()));
        }

        // 3. Find the extracted top-level directory. Derive the expected name from
        //    the URL's filename (strip ".tar.bz2"); fall back to the first dir in
        //    the extract dir that contains a model.int8.onnx (robustness).
        let expected_root_name = profile
            .url
            .rsplit('/')
            .next()
            .and_then(|f| f.strip_suffix(".tar.bz2"))
            .map(|s| s.to_string());

        let extracted_root = fs::read_dir(&extract_dir)
            .map_err(|e| anyhow!("Failed to read extract dir: {}", e))?
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .find(|p| {
                if !p.is_dir() { return false; }
                if let Some(ref expected) = expected_root_name {
                    return p.file_name().map(|n| n == expected.as_str()).unwrap_or(false);
                }
                false
            })
            .or_else(|| {
                // Fallback: first dir that actually contains model.int8.onnx.
                fs::read_dir(&extract_dir).ok()?
                    .filter_map(|e| e.ok())
                    .map(|e| e.path())
                    .find(|p| p.is_dir() && p.join("model.int8.onnx").exists())
            });

        let root = match extracted_root {
            Some(r) => r,
            None => {
                let _ = fs::remove_dir_all(&extract_dir);
                return Err(anyhow!("Extracted tarball for {} did not contain a model dir", id));
            }
        };

        // Move model.int8.onnx and tokens.txt (skip the bulky test_wavs/ samples).
        for name in ["model.int8.onnx", "tokens.txt"] {
            let src = root.join(name);
            if src.exists() {
                fs::rename(&src, dest_dir.join(name))
                    .or_else(|_| { fs::copy(&src, dest_dir.join(name)).map(|_| ()) })?;
            }
        }

        let _ = fs::remove_dir_all(&extract_dir);

        // Final verification.
        if !dest_dir.join("model.int8.onnx").exists() || !dest_dir.join("tokens.txt").exists() {
            return Err(anyhow!("Model extracted but model.int8.onnx/tokens.txt are missing for {}", id));
        }

        app_handle.emit("transcription://download-complete", id.to_string())?;
        Ok(())
    }
}
