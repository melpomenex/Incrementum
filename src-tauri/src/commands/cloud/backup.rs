//! Backup commands for cloud storage
//!
//! Commands for creating, restoring, listing, and deleting backups.
//! Providers are retrieved from `CloudAuthProvider` managed state
//! (populated at app startup from persisted OAuth tokens).

use tauri::{AppHandle, Manager, State};

use crate::backup::BackupManager;
use crate::cloud::{
    BackupOptions, BackupInfo, CloudAuthProvider, CloudProvider,
    CloudProviderType,
};
use crate::database::{Database, Repository};

/// Helper: get the provider Arc from managed state.
fn get_provider_arc(
    auth: &State<'_, CloudAuthProvider>,
    provider_type: &str,
) -> Result<std::sync::Arc<tokio::sync::RwLock<Box<dyn CloudProvider>>>, String> {
    let pt = CloudProviderType::from_str(provider_type)
        .ok_or_else(|| "Unknown provider type".to_string())?;

    auth.get_provider(pt)
        .ok_or_else(|| format!("No authenticated {} provider found", provider_type))
}

/// Create a backup
#[tauri::command]
pub async fn backup_create(
    provider_type: String,
    options: BackupOptions,
    repo: State<'_, Repository>,
    auth: State<'_, CloudAuthProvider>,
    app: AppHandle,
) -> Result<BackupInfo, String> {
    let provider_arc = get_provider_arc(&auth, &provider_type)?;

    // Resolve the live database path from the app data directory
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let db_path = app_dir.join("incrementum.db");

    let db = Database::from_pool(repo.pool().clone());
    let manager = BackupManager::new(db, db_path).map_err(|e| e.to_string())?;

    // Lock the provider for the duration of the backup
    let provider = provider_arc.read().await;
    manager
        .create_backup(provider.as_ref(), options)
        .await
        .map_err(|e| e.to_string())
}

/// Restore from a backup
#[tauri::command]
pub async fn backup_restore(
    provider_type: String,
    backup_id: String,
    password: Option<String>,
    repo: State<'_, Repository>,
    auth: State<'_, CloudAuthProvider>,
    app: AppHandle,
) -> Result<crate::cloud::RestoreResult, String> {
    let provider_arc = get_provider_arc(&auth, &provider_type)?;

    // Resolve the live database path from the app data directory
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let db_path = app_dir.join("incrementum.db");

    // Close the connection pool before restoring to avoid SQLite lock conflicts.
    // The restore uses rusqlite directly on the file, not the pool.
    let pool = repo.pool().clone();
    pool.close().await;

    let db = Database::from_pool(pool);
    let manager = BackupManager::new(db, db_path).map_err(|e| e.to_string())?;

    let provider = provider_arc.read().await;
    manager
        .restore_backup(provider.as_ref(), &backup_id, password.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// List available backups
#[tauri::command]
pub async fn backup_list(
    provider_type: String,
    repo: State<'_, Repository>,
    auth: State<'_, CloudAuthProvider>,
    app: AppHandle,
) -> Result<Vec<BackupInfo>, String> {
    let provider_arc = get_provider_arc(&auth, &provider_type)?;

    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let db_path = app_dir.join("incrementum.db");

    let db = Database::from_pool(repo.pool().clone());
    let manager = BackupManager::new(db, db_path).map_err(|e| e.to_string())?;

    let provider = provider_arc.read().await;
    manager
        .list_backups(provider.as_ref())
        .await
        .map_err(|e| e.to_string())
}

/// Delete a backup
#[tauri::command]
pub async fn backup_delete(
    provider_type: String,
    backup_id: String,
    auth: State<'_, CloudAuthProvider>,
) -> Result<(), String> {
    let provider_arc = get_provider_arc(&auth, &provider_type)?;

    // BackupManager only needs the provider for delete; db/db_path
    // are not required so we construct a minimal manager.
    // Instead, call the provider directly since delete is simple.
    let provider = provider_arc.read().await;

    // Delete manifest
    let manifest_path = format!("/backups/{}.manifest.json", backup_id);
    if let Err(e) = provider.delete_file(&manifest_path).await {
        tracing::warn!("Failed to delete backup manifest: {}", e);
    }

    // Try both encrypted and unencrypted data files
    for ext in &["zip", "zip.enc"] {
        let data_path = format!("/backups/{}.{}", backup_id, ext);
        if let Err(e) = provider.delete_file(&data_path).await {
            tracing::warn!("Failed to delete backup data ({}): {}", ext, e);
        }
    }

    Ok(())
}
