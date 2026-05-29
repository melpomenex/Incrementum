//! Cloud sync commands
//!
//! Tauri commands for cloud synchronization

use tauri::State;

use crate::cloud::{SyncResult, ConflictResolution, CloudProviderType, FileInfo};
use crate::database::{Database, Repository};
use crate::cloud_sync::CloudSyncManager;
use crate::cloud::auth_store::CloudAuthProvider;

// Global cloud sync manager - use tokio Mutex for async safety
static CLOUD_SYNC_MANAGER: tokio::sync::Mutex<Option<CloudSyncManager>> =
    tokio::sync::Mutex::const_new(None);

/// Initialize cloud sync manager
#[tauri::command]
pub async fn cloud_sync_init(repo: State<'_, Repository>) -> Result<(), String> {
    let db = Database::from_pool(repo.pool().clone());

    let manager = CloudSyncManager::new(db)
        .map_err(|e| e.to_string())?;

    let mut guard = CLOUD_SYNC_MANAGER.lock().await;
    *guard = Some(manager);

    Ok(())
}

/// Perform two-way sync
#[tauri::command]
pub async fn cloud_sync_now() -> Result<SyncResult, String> {
    let mut guard = CLOUD_SYNC_MANAGER.lock().await;
    let manager = guard.as_mut()
        .ok_or_else(|| "Cloud sync not initialized".to_string())?;

    manager.two_way_sync().await
        .map_err(|e| e.to_string())
}

/// Get sync status
#[tauri::command]
pub async fn cloud_sync_get_status() -> Result<crate::cloud_sync::SyncStatus, String> {
    let guard = CLOUD_SYNC_MANAGER.lock().await;
    let manager = guard.as_ref()
        .ok_or_else(|| "Cloud sync not initialized".to_string())?;

    manager.get_sync_status().await
        .map_err(|e| e.to_string())
}

/// Resolve sync conflicts
#[tauri::command]
pub async fn cloud_sync_resolve_conflicts(
    resolutions: Vec<ConflictResolution>,
) -> Result<(), String> {
    let mut guard = CLOUD_SYNC_MANAGER.lock().await;
    let manager = guard.as_mut()
        .ok_or_else(|| "Cloud sync not initialized".to_string())?;

    manager.resolve_conflicts(resolutions).await
        .map_err(|e| e.to_string())
}

/// List cloud files for import
#[tauri::command]
pub async fn cloud_list_files(
    provider_type: String,
    path: String,
    auth_provider: State<'_, CloudAuthProvider>,
) -> Result<Vec<FileInfo>, String> {
    let provider_type = CloudProviderType::from_str(&provider_type)
        .ok_or_else(|| format!("Unknown provider type: {}", provider_type))?;

    let provider = auth_provider.get_provider(provider_type)
        .ok_or_else(|| format!("No authenticated {} provider found. Please authenticate first.", provider_type))?;

    let guard = provider.read().await;
    guard.list_files(&path).await.map_err(|e| e.to_string())
}

/// Import files from cloud
#[tauri::command]
pub async fn cloud_import_files(
    provider_type: String,
    files: Vec<String>,
    repo: State<'_, Repository>,
    auth_provider: State<'_, CloudAuthProvider>,
) -> Result<ImportResult, String> {
    let provider_type = CloudProviderType::from_str(&provider_type)
        .ok_or_else(|| format!("Unknown provider type: {}", provider_type))?;

    let provider = auth_provider.get_provider(provider_type)
        .ok_or_else(|| format!("No authenticated {} provider found. Please authenticate first.", provider_type))?;

    let guard = provider.read().await;

    let mut imported = 0;
    let mut failed = 0;
    let mut errors = Vec::new();

    for file_path in &files {
        match guard.download_file(file_path, None).await {
            Ok(_) => imported += 1,
            Err(e) => {
                failed += 1;
                errors.push(format!("{}: {}", file_path, e));
            }
        }
    }

    Ok(ImportResult { imported, failed, errors })
}

/// Import result
#[derive(serde::Serialize, serde::Deserialize)]
pub struct ImportResult {
    pub imported: usize,
    pub failed: usize,
    pub errors: Vec<String>,
}
