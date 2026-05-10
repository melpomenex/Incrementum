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
}

impl ModelManager {
    pub fn new(app_handle: &AppHandle) -> Result<Self> {
        let app_dir = app_handle.path().app_data_dir()?;
        let models_dir = app_dir.join("models").join("whisper");
        
        if !models_dir.exists() {
            fs::create_dir_all(&models_dir)?;
        }

        let profiles = vec![
            ModelProfile {
                id: "distil-small.en".to_string(),
                name: "English Fast (Distil)".to_string(),
                description: "Optimized English-only model. Very fast and accurate.".to_string(),
                url: "https://huggingface.co/distil-whisper/distil-small.en/resolve/main/ggml-distil-small.en.bin".to_string(),
                sha256: "be63364f891ed12037701e85a6431940a025527339796e62c4cf2c68612ca493".to_string(), // placeholder
                size_bytes: 188 * 1024 * 1024,
                installed: false,
            },
            ModelProfile {
                id: "base".to_string(),
                name: "Multilingual Fast".to_string(),
                description: "Smallest multilingual model. Good for quick results.".to_string(),
                url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin".to_string(),
                sha256: "27856f41444bc99a9cf5823158c30932062638843c0802c610b420063c6139f3".to_string(), // placeholder
                size_bytes: 147 * 1024 * 1024,
                installed: false,
            },
            ModelProfile {
                id: "small".to_string(),
                name: "Multilingual Balanced".to_string(),
                description: "Good balance of speed and accuracy for most languages.".to_string(),
                url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin".to_string(),
                sha256: "0c7e2b8655160ef5a40a2f447f5589a19d3f1d5308502c46f38e6a0d4239f604".to_string(), // placeholder
                size_bytes: 488 * 1024 * 1024,
                installed: false,
            },
        ];

        Ok(Self { profiles, models_dir })
    }

    pub fn list_profiles(&self) -> Vec<ModelProfile> {
        self.profiles.iter().map(|profile| {
            let mut updated = profile.clone();
            updated.installed = self.is_model_installed(&profile.id);
            updated
        }).collect()
    }

    pub fn get_model_path(&self, id: &str) -> PathBuf {
        self.models_dir.join(format!("ggml-{}.bin", id))
    }

    pub fn is_model_installed(&self, id: &str) -> bool {
        self.get_model_path(id).exists()
    }

    pub async fn download_model(&self, id: &str, app_handle: AppHandle) -> Result<()> {
        let profile = self.profiles.iter().find(|p| p.id == id)
            .ok_or_else(|| anyhow!("Model profile not found"))?;

        let dest_path = self.get_model_path(id);
        let temp_path = dest_path.with_extension("download");

        let client = Client::new();
        let mut response = client.get(&profile.url).send().await?;

        if !response.status().is_success() {
            return Err(anyhow!("Failed to download model: {}", response.status()));
        }

        let total_size = response.content_length().unwrap_or(profile.size_bytes);
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
        if !profile.sha256.is_empty() && hash != profile.sha256 {
            let _ = fs::remove_file(&temp_path);
            return Err(anyhow!(
                "Model hash verification failed: expected {}, got {}",
                profile.sha256,
                hash
            ));
        }

        fs::rename(&temp_path, &dest_path)?;

        app_handle.emit("transcription://download-complete", id.to_string())?;

        Ok(())
    }

    pub fn delete_model(&self, id: &str) -> Result<()> {
        let path = self.get_model_path(id);
        if path.exists() {
            fs::remove_file(path)?;
        }
        Ok(())
    }
}
