//! AI API Key Keychain Storage
//!
//! Stores and retrieves LLM API keys using the OS keychain (via `keyring`).
//! Falls back to encrypted file storage when the keychain is unavailable.
//! Reuses the same patterns as `cloud::auth_store::AuthStore`.

use crate::error::AppError;
use std::path::PathBuf;

const KEYRING_SERVICE: &str = "com.incrementum.app.ai";
const KEYS_DIR_NAME: &str = "ai_keys";

#[derive(Clone)]
pub struct AIKeyStore {
    app_data_dir: PathBuf,
}

impl AIKeyStore {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self { app_data_dir }
    }

    pub async fn store_key(&self, provider: &str, api_key: &str) -> Result<(), AppError> {
        // Try the OS keychain first.
        if let Err(keychain_err) = Self::keyring_set(provider, api_key) {
            tracing::warn!(
                "Keychain unavailable for AI key {}, falling back to encrypted file: {}",
                provider,
                keychain_err
            );
            self.encrypted_file_store(provider, api_key.as_bytes()).await?;
        }
        Ok(())
    }

    pub async fn get_key(&self, provider: &str) -> Result<Option<String>, AppError> {
        // Try the OS keychain first.
        match Self::keyring_get(provider) {
            Ok(key) => return Ok(Some(key)),
            Err(keychain_err) => {
                tracing::warn!(
                    "Keychain unavailable for AI key {}, trying encrypted file: {}",
                    provider,
                    keychain_err
                );
            }
        }

        // Fallback to encrypted file.
        match self.encrypted_file_load(provider).await {
            Ok(Some(bytes)) => {
                let key = String::from_utf8(bytes).map_err(|e| {
                    AppError::Internal(format!("AI key file contains invalid UTF-8: {e}"))
                })?;
                Ok(Some(key))
            }
            Ok(None) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub async fn remove_key(&self, provider: &str) -> Result<(), AppError> {
        let _ = Self::keyring_delete(provider);

        let enc_path = self.key_enc_path(provider);
        if enc_path.exists() {
            std::fs::remove_file(&enc_path).map_err(|e| {
                AppError::Internal(format!(
                    "Failed to delete AI key file {}: {e}",
                    enc_path.display()
                ))
            })?;
        }
        Ok(())
    }

    /// Check if a key exists without retrieving it.
    pub async fn has_key(&self, provider: &str) -> bool {
        if Self::keyring_get(provider).is_ok() {
            return true;
        }
        self.key_enc_path(provider).exists()
    }

    /// Get the last 4 characters of a key for masked display.
    pub async fn get_masked_key(&self, provider: &str) -> Result<Option<String>, AppError> {
        match self.get_key(provider).await {
            Ok(Some(key)) => {
                if key.len() <= 4 {
                    return Ok(Some("*".repeat(key.len())));
                }
                Ok(Some(format!("{}{}", "*".repeat(key.len() - 4), &key[key.len() - 4..])))
            }
            Ok(None) => Ok(None),
            Err(e) => Err(e),
        }
    }

    // ── keyring helpers ──────────────────────────────────────────

    fn keyring_entry(username: &str) -> Result<keyring::Entry, String> {
        keyring::Entry::new(KEYRING_SERVICE, username)
            .map_err(|e| format!("keyring error: {e}"))
    }

    fn keyring_set(username: &str, key: &str) -> Result<(), String> {
        let entry = Self::keyring_entry(username)?;
        entry.set_password(key).map_err(|e| format!("keyring set: {e}"))
    }

    fn keyring_get(username: &str) -> Result<String, String> {
        let entry = Self::keyring_entry(username)?;
        entry.get_password().map_err(|e| format!("keyring get: {e}"))
    }

    fn keyring_delete(username: &str) -> Result<(), String> {
        let entry = Self::keyring_entry(username)?;
        entry.delete_credential().map_err(|e| format!("keyring delete: {e}"))
    }

    // ── encrypted-file fallback ──────────────────────────────────

    fn keys_dir(&self) -> PathBuf {
        self.app_data_dir.join(KEYS_DIR_NAME)
    }

    fn key_enc_path(&self, provider: &str) -> PathBuf {
        self.keys_dir().join(format!("{}.enc", provider))
    }

    async fn encrypted_file_store(
        &self,
        provider: &str,
        plaintext: &[u8],
    ) -> Result<(), AppError> {
        use aes_gcm::{
            aead::{Aead, KeyInit, OsRng},
            Aes256Gcm, AeadCore,
        };
        use pbkdf2::pbkdf2_hmac;
        use rand::RngCore;
        use sha2::Sha256;

        let dir = self.keys_dir();
        std::fs::create_dir_all(&dir).map_err(|e| {
            AppError::Internal(format!("Failed to create ai_keys dir {}: {e}", dir.display()))
        })?;

        let mut salt = [0u8; 16];
        OsRng.fill_bytes(&mut salt);

        let key = Self::derive_machine_key_with_salt(&salt)?;
        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|e| AppError::Internal(format!("AES init: {e}")))?;
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

        let ciphertext = cipher
            .encrypt(&nonce, plaintext)
            .map_err(|e| AppError::Internal(format!("Encryption failed: {e}")))?;

        // Layout: salt(16) + nonce(12) + ciphertext
        let mut out = Vec::with_capacity(16 + 12 + ciphertext.len());
        out.extend_from_slice(&salt);
        out.extend_from_slice(&nonce);
        out.extend_from_slice(&ciphertext);

        let path = self.key_enc_path(provider);
        std::fs::write(&path, &out).map_err(|e| {
            AppError::Internal(format!("Failed to write AI key file {}: {e}", path.display()))
        })?;

        Ok(())
    }

    async fn encrypted_file_load(&self, provider: &str) -> Result<Option<Vec<u8>>, AppError> {
        use aes_gcm::{aead::Aead, Aes256Gcm, KeyInit, Nonce};

        let path = self.key_enc_path(provider);
        if !path.exists() {
            return Ok(None);
        }

        let data = std::fs::read(&path).map_err(|e| {
            AppError::Internal(format!("Failed to read AI key file {}: {e}", path.display()))
        })?;

        if data.len() < 28 {
            return Err(AppError::Internal(
                "Encrypted AI key file is too short".to_string(),
            ));
        }

        // Try new format first: salt(16) + nonce(12) + ciphertext
        if data.len() >= 44 {
            let salt = &data[..16];
            let nonce = Nonce::from_slice(&data[16..28]);
            let ciphertext = &data[28..];

            let key = Self::derive_machine_key_with_salt(salt)?;
            let cipher = Aes256Gcm::new_from_slice(&key)
                .map_err(|e| AppError::Internal(format!("AES init: {e}")))?;

            if let Ok(plaintext) = cipher.decrypt(nonce, ciphertext) {
                return Ok(Some(plaintext));
            }
        }

        // Fallback: old format with legacy hostname-based derivation
        {
            let old_key = Self::derive_machine_key_legacy()?;
            let cipher = Aes256Gcm::new_from_slice(&old_key)
                .map_err(|e| AppError::Internal(format!("AES init: {e}")))?;
            let nonce = Nonce::from_slice(&data[..12]);
            let ciphertext = &data[12..];

            if let Ok(plaintext) = cipher.decrypt(nonce, ciphertext) {
                let _ = self.encrypted_file_store(provider, &plaintext).await;
                return Ok(Some(plaintext));
            }
        }

        Err(AppError::Internal("Decryption failed: credentials may be from a different machine".to_string()))
    }

    fn derive_machine_key_with_salt(salt: &[u8]) -> Result<[u8; 32], AppError> {
        use pbkdf2::pbkdf2_hmac;
        use sha2::Sha256;

        let username = whoami_username();
        let password = format!("{}:{}", username, user_id());

        let mut key = [0u8; 32];
        pbkdf2_hmac::<Sha256>(
            password.as_bytes(),
            salt,
            100_000,
            &mut key,
        );
        Ok(key)
    }

    fn derive_machine_key_legacy() -> Result<[u8; 32], AppError> {
        use pbkdf2::pbkdf2_hmac;
        use sha2::Sha256;

        let hostname_bytes = hostname::get()
            .map(|h| h.into_string().unwrap_or_default())
            .unwrap_or_else(|_| "unknown".to_string());
        let username = whoami_username();
        let password = format!("{}:{}", username, user_id());

        let mut key = [0u8; 32];
        pbkdf2_hmac::<Sha256>(
            password.as_bytes(),
            hostname_bytes.as_bytes(),
            100_000,
            &mut key,
        );
        Ok(key)
    }
}

fn whoami_username() -> String {
    std::env::var("USER")
        .or_else(|_| std::env::var("USERNAME"))
        .unwrap_or_else(|_| "unknown".to_string())
}

fn user_id() -> String {
    format!(
        "{}@{}",
        whoami_username(),
        hostname::get()
            .map(|h| h.into_string().unwrap_or_default())
            .unwrap_or_else(|_| "unknown".to_string())
    )
}
