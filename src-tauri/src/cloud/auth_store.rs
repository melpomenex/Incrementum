//! OAuth Token Persistence
//!
//! Stores and retrieves OAuth tokens using the OS keychain (via the `keyring` crate).
//! Falls back to encrypted file storage when the keychain is unavailable.

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, AeadCore, Nonce,
};
use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use sha2::Sha256;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

use super::provider::{AuthToken, CloudProvider, CloudProviderType};
use crate::error::AppError;

const KEYRING_SERVICE: &str = "com.incrementum.app";
const TOKENS_DIR_NAME: &str = "tokens";

#[derive(Clone)]
pub struct AuthStore {
    app_data_dir: PathBuf,
}

impl AuthStore {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self { app_data_dir }
    }

    // ── public API ────────────────────────────────────────────

    pub async fn store_token(
        &self,
        provider_type: CloudProviderType,
        token: &AuthToken,
    ) -> Result<(), AppError> {
        let json =
            serde_json::to_string(token).map_err(|e| AppError::Internal(format!(
                "Failed to serialize token: {e}"
            )))?;

        let username = provider_type.as_str();

        // Try the OS keychain first.
        if let Err(keychain_err) = Self::keyring_set(username, &json) {
            tracing::warn!(
                "Keychain unavailable for {}, falling back to encrypted file: {}",
                username,
                keychain_err
            );
            self.encrypted_file_store(provider_type, json.as_bytes())
                .await?;
        }
        Ok(())
    }

    pub async fn get_token(
        &self,
        provider_type: CloudProviderType,
    ) -> Result<Option<AuthToken>, AppError> {
        let username = provider_type.as_str();

        // Try the OS keychain first.
        match Self::keyring_get(username) {
            Ok(json) => {
                let token: AuthToken = serde_json::from_str(&json).map_err(|e| {
                    AppError::Internal(format!("Failed to deserialize token from keychain: {e}"))
                })?;
                return Ok(Some(token));
            }
            Err(keychain_err) => {
                tracing::warn!(
                    "Keychain unavailable for {}, trying encrypted file: {}",
                    username,
                    keychain_err
                );
            }
        }

        // Fallback to encrypted file.
        match self.encrypted_file_load(provider_type).await {
            Ok(Some(bytes)) => {
                let json = String::from_utf8(bytes).map_err(|e| {
                    AppError::Internal(format!("Token file contains invalid UTF-8: {e}"))
                })?;
                let token: AuthToken = serde_json::from_str(&json).map_err(|e| {
                    AppError::Internal(format!(
                        "Failed to deserialize token from encrypted file: {e}"
                    ))
                })?;
                Ok(Some(token))
            }
            Ok(None) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub async fn remove_token(&self, provider_type: CloudProviderType) -> Result<(), AppError> {
        let username = provider_type.as_str();

        // Best-effort keychain delete (ignore error – token may not exist).
        let _ = Self::keyring_delete(username);

        // Also delete the encrypted fallback file.
        let enc_path = self.token_enc_path(provider_type);
        if enc_path.exists() {
            std::fs::remove_file(&enc_path).map_err(|e| {
                AppError::Internal(format!("Failed to delete token file {}: {e}", enc_path.display()))
            })?;
        }
        Ok(())
    }

    fn keyring_entry(username: &str) -> Result<keyring::Entry, String> {
        keyring::Entry::new(KEYRING_SERVICE, username)
            .map_err(|e| format!("keyring error: {e}"))
    }

    fn keyring_set(username: &str, json: &str) -> Result<(), String> {
        let entry = Self::keyring_entry(username)?;
        entry.set_password(json).map_err(|e| format!("keyring set: {e}"))
    }

    fn keyring_get(username: &str) -> Result<String, String> {
        let entry = Self::keyring_entry(username)?;
        entry.get_password().map_err(|e| format!("keyring get: {e}"))
    }

    fn keyring_delete(username: &str) -> Result<(), String> {
        let entry = Self::keyring_entry(username)?;
        entry.delete_credential().map_err(|e| format!("keyring delete: {e}"))
    }

    // ── encrypted-file fallback ───────────────────────────────

    fn tokens_dir(&self) -> PathBuf {
        self.app_data_dir.join(TOKENS_DIR_NAME)
    }

    fn token_enc_path(&self, provider_type: CloudProviderType) -> PathBuf {
        self.tokens_dir()
            .join(format!("{}.enc", provider_type.as_str()))
    }

    fn derive_machine_key_with_salt(salt: &[u8]) -> Result<[u8; 32], AppError> {
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

    /// Legacy key derivation using predictable hostname-as-salt (for migration)
    fn derive_machine_key_legacy() -> Result<[u8; 32], AppError> {
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

    async fn encrypted_file_store(
        &self,
        provider_type: CloudProviderType,
        plaintext: &[u8],
    ) -> Result<(), AppError> {
        let dir = self.tokens_dir();
        std::fs::create_dir_all(&dir).map_err(|e| {
            AppError::Internal(format!("Failed to create tokens dir {}: {e}", dir.display()))
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

        let path = self.token_enc_path(provider_type);
        std::fs::write(&path, &out).map_err(|e| {
            AppError::Internal(format!(
                "Failed to write token file {}: {e}",
                path.display()
            ))
        })?;

        Ok(())
    }

    async fn encrypted_file_load(
        &self,
        provider_type: CloudProviderType,
    ) -> Result<Option<Vec<u8>>, AppError> {
        let path = self.token_enc_path(provider_type);
        if !path.exists() {
            return Ok(None);
        }

        let data = std::fs::read(&path).map_err(|e| {
            AppError::Internal(format!(
                "Failed to read token file {}: {e}",
                path.display()
            ))
        })?;

        // New format minimum: salt(16) + nonce(12) + tag(16) = 44 bytes
        // Old format minimum: nonce(12) + tag(16) = 28 bytes
        if data.len() < 28 {
            return Err(AppError::Internal(
                "Encrypted token file is too short".to_string(),
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

        // Fallback: old format (no salt) with legacy hostname-based derivation
        {
            let old_key = Self::derive_machine_key_legacy()?;
            let cipher = Aes256Gcm::new_from_slice(&old_key)
                .map_err(|e| AppError::Internal(format!("AES init: {e}")))?;
            let nonce = Nonce::from_slice(&data[..12]);
            let ciphertext = &data[12..];

            if let Ok(plaintext) = cipher.decrypt(nonce, ciphertext) {
                // Migrate to new format
                let _ = self.encrypted_file_store(provider_type, &plaintext).await;
                return Ok(Some(plaintext));
            }
        }

        Err(AppError::Internal("Decryption failed: credentials may be from a different machine".to_string()))
    }
}

// ── helper: current username ─────────────────────────────────

fn whoami_username() -> String {
    std::env::var("USER")
        .or_else(|_| std::env::var("USERNAME"))
        .unwrap_or_else(|_| "unknown".to_string())
}

fn user_id() -> String {
    // Use a stable machine+user identifier for key derivation.
    format!(
        "{}@{}",
        whoami_username(),
        hostname::get()
            .map(|h| h.into_string().unwrap_or_default())
            .unwrap_or_else(|_| "unknown".to_string())
    )
}

pub struct CloudAuthProvider {
    providers: std::sync::Arc<std::sync::Mutex<
        HashMap<CloudProviderType, Arc<RwLock<Box<dyn CloudProvider>>>>,
    >>,
}

impl Clone for CloudAuthProvider {
    fn clone(&self) -> Self {
        Self {
            providers: std::sync::Arc::clone(&self.providers),
        }
    }
}

impl CloudAuthProvider {
    pub fn new() -> Self {
        Self {
            providers: std::sync::Arc::new(std::sync::Mutex::new(HashMap::new())),
        }
    }

    pub fn get_provider(
        &self,
        provider_type: CloudProviderType,
    ) -> Option<Arc<RwLock<Box<dyn CloudProvider>>>> {
        self.providers
            .lock()
            .expect("auth_store mutex poisoned")
            .get(&provider_type)
            .cloned()
    }

    pub fn set_provider(
        &self,
        provider_type: CloudProviderType,
        provider: Box<dyn CloudProvider>,
    ) {
        self.providers
            .lock()
            .expect("auth_store mutex poisoned")
            .insert(provider_type, Arc::new(RwLock::new(provider)));
    }

    pub fn remove_provider(&self, provider_type: CloudProviderType) {
        self.providers.lock().expect("auth_store mutex poisoned").remove(&provider_type);
    }

    pub fn is_authenticated(&self, provider_type: CloudProviderType) -> bool {
        self.providers.lock().expect("auth_store mutex poisoned").contains_key(&provider_type)
    }
}
