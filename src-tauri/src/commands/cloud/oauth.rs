//! OAuth commands for cloud storage providers
//!
//! Handles OAuth authentication flow for OneDrive, Google Drive, and Dropbox.
//! Persists tokens via AuthStore (OS keychain / encrypted file fallback).

use tauri::State;

use crate::cloud::{
    AccountInfo, AuthResult, CloudProvider, CloudProviderType,
    OneDriveConfig, OneDriveProvider,
    GoogleDriveConfig, GoogleDriveProvider,
    DropboxConfig, DropboxProvider,
};
use crate::cloud::auth_store::{CloudAuthProvider, AuthStore};

/// Start OAuth authentication flow
#[tauri::command]
pub async fn oauth_start(provider_type: String) -> Result<String, String> {
    let provider_type = CloudProviderType::from_str(&provider_type)
        .ok_or_else(|| format!("Unknown provider type: {}", provider_type))?;

    // Create provider instance
    let mut provider: Box<dyn CloudProvider> = match provider_type {
        CloudProviderType::OneDrive => {
            Box::new(OneDriveProvider::new(OneDriveConfig::default()))
        }
        CloudProviderType::GoogleDrive => {
            Box::new(GoogleDriveProvider::new(GoogleDriveConfig::default()))
        }
        CloudProviderType::Dropbox => {
            Box::new(DropboxProvider::new(DropboxConfig::default()))
        }
    };

    // Start authentication
    provider
        .authenticate()
        .await
        .map_err(|e| e.to_string())
}

/// Handle OAuth callback
#[tauri::command]
pub async fn oauth_callback(
    provider_type: String,
    code: String,
    state: String,
    auth_provider: State<'_, CloudAuthProvider>,
    auth_store: State<'_, AuthStore>,
) -> Result<AuthResult, String> {
    let provider_type = CloudProviderType::from_str(&provider_type)
        .ok_or_else(|| format!("Unknown provider type: {}", provider_type))?;

    // Create provider instance
    let mut provider: Box<dyn CloudProvider> = match provider_type {
        CloudProviderType::OneDrive => {
            Box::new(OneDriveProvider::new(OneDriveConfig::default()))
        }
        CloudProviderType::GoogleDrive => {
            Box::new(GoogleDriveProvider::new(GoogleDriveConfig::default()))
        }
        CloudProviderType::Dropbox => {
            Box::new(DropboxProvider::new(DropboxConfig::default()))
        }
    };

    // Handle the callback
    let result = provider
        .handle_callback(&code, &state)
        .await
        .map_err(|e| e.to_string())?;

    if result.success {
        // Persist the token to the OS keychain / encrypted file
        if let Some(token) = provider.auth_token() {
            auth_store
                .store_token(provider_type, &token)
                .await
                .map_err(|e| e.to_string())?;
        }

        // Store the authenticated provider in Tauri state
        auth_provider.inner().set_provider(provider_type, provider);
    }

    Ok(result)
}

/// Get account info for authenticated provider
#[tauri::command]
pub async fn oauth_get_account(
    provider_type: String,
    auth_provider: State<'_, CloudAuthProvider>,
) -> Result<AccountInfo, String> {
    let provider_type = CloudProviderType::from_str(&provider_type)
        .ok_or_else(|| format!("Unknown provider type: {}", provider_type))?;

    let provider = auth_provider
        .get_provider(provider_type)
        .ok_or_else(|| {
            format!(
                "No authenticated {} provider found. Please authenticate first.",
                provider_type
            )
        })?;

    let guard = provider.read().await;
    guard.get_account_info().await.map_err(|e| e.to_string())
}

/// Disconnect provider
#[tauri::command]
pub async fn oauth_disconnect(
    provider_type: String,
    auth_provider: State<'_, CloudAuthProvider>,
    auth_store: State<'_, AuthStore>,
) -> Result<(), String> {
    let provider_type = CloudProviderType::from_str(&provider_type)
        .ok_or_else(|| format!("Unknown provider type: {}", provider_type))?;

    // Remove persisted token
    auth_store
        .remove_token(provider_type)
        .await
        .map_err(|e| e.to_string())?;

    // Remove provider from state
    auth_provider.inner().remove_provider(provider_type);

    Ok(())
}

/// Check if provider is authenticated
#[tauri::command]
pub async fn oauth_is_authenticated(
    provider_type: String,
    auth_provider: State<'_, CloudAuthProvider>,
) -> Result<bool, String> {
    let provider_type = CloudProviderType::from_str(&provider_type)
        .ok_or_else(|| format!("Unknown provider type: {}", provider_type))?;

    Ok(auth_provider.is_authenticated(provider_type))
}
