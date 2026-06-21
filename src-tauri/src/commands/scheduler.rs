//! Scheduler commands
//!
//! Tauri commands for backup scheduler management

use tauri::{AppHandle, Manager, State};

use crate::scheduler::{BackupScheduler, SchedulerConfig, SchedulerResult};
use crate::database::{Database, Repository};
use crate::cloud::auth_store::CloudAuthProvider;
use crate::cloud::{CloudProviderType, BackupOptions};
use crate::backup::BackupManager;

// Global scheduler instance - use tokio Mutex for async safety
static SCHEDULER: tokio::sync::Mutex<Option<BackupScheduler>> =
    tokio::sync::Mutex::const_new(None);

/// Initialize the backup scheduler
#[tauri::command]
pub async fn scheduler_init(
    repo: State<'_, Repository>,
    app: AppHandle,
    auth_provider: State<'_, CloudAuthProvider>,
) -> Result<(), String> {
    let db = Database::from_pool(repo.pool().clone());

    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let db_path = app_dir.join("incrementum.db");

    // Load scheduler config from persisted settings; fall back to defaults.
    let config = load_scheduler_config(&repo).await;

    let scheduler = BackupScheduler::new(db, db_path, config);

    // Attach the first available authenticated provider so the tick can run
    // real backups instead of just logging.
    let provider = [CloudProviderType::Dropbox, CloudProviderType::GoogleDrive, CloudProviderType::OneDrive]
        .iter()
        .find_map(|pt| auth_provider.get_provider(*pt));
    scheduler.set_provider(provider).await;

    let mut guard = SCHEDULER.lock().await;
    *guard = Some(scheduler);

    Ok(())
}

/// Read the scheduler config from the app settings JSON column.
async fn load_scheduler_config(repo: &Repository) -> SchedulerConfig {
    // Best-effort: any failure falls back to SchedulerConfig::default().
    match sqlx::query_scalar::<_, Option<String>>(
        "SELECT value FROM app_settings WHERE key = 'backup_scheduler'",
    )
    .fetch_optional(repo.pool())
    .await
    {
        Ok(Some(Some(raw))) => serde_json::from_str::<SchedulerConfig>(&raw).unwrap_or_default(),
        _ => SchedulerConfig::default(),
    }
}

/// Start the scheduler
#[tauri::command]
pub async fn scheduler_start() -> Result<(), String> {
    let guard = SCHEDULER.lock().await;
    let scheduler = guard.as_ref()
        .ok_or_else(|| "Scheduler not initialized".to_string())?;

    // Clone needed data before dropping guard
    let result = scheduler.start().await;

    result.map_err(|e| e.to_string())
}

/// Stop the scheduler
#[tauri::command]
pub async fn scheduler_stop() -> Result<(), String> {
    let guard = SCHEDULER.lock().await;
    let scheduler = guard.as_ref()
        .ok_or_else(|| "Scheduler not initialized".to_string())?;

    let result = scheduler.stop().await;

    result.map_err(|e| e.to_string())
}

/// Update scheduler configuration
#[tauri::command]
pub async fn scheduler_update_config(config: SchedulerConfig) -> Result<(), String> {
    let mut guard = SCHEDULER.lock().await;
    let scheduler = guard.as_mut()
        .ok_or_else(|| "Scheduler not initialized".to_string())?;

    scheduler.update_config(config).await;
    Ok(())
}

/// Get scheduler status
#[tauri::command]
pub async fn scheduler_get_status() -> Result<SchedulerStatus, String> {
    let guard = SCHEDULER.lock().await;
    let scheduler = guard.as_ref()
        .ok_or_else(|| "Scheduler not initialized".to_string())?;

    let running = scheduler.is_running().await;
    let next_scheduled = scheduler.next_scheduled_time().await;

    Ok(SchedulerStatus {
        running,
        next_scheduled: next_scheduled.map(|d| d.to_rfc3339()),
    })
}

/// Trigger a manual backup
#[tauri::command]
pub async fn scheduler_trigger_backup(
    provider_type: String,
    repo: State<'_, Repository>,
    auth_provider: State<'_, CloudAuthProvider>,
    app: AppHandle,
) -> Result<SchedulerResult, String> {
    let provider_type = CloudProviderType::from_str(&provider_type)
        .ok_or_else(|| format!("Unknown provider type: {}", provider_type))?;

    let provider = auth_provider.get_provider(provider_type)
        .ok_or_else(|| format!("No authenticated {} provider found. Please authenticate first.", provider_type))?;

    let app_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let db_path = app_dir.join("incrementum.db");

    let db = Database::from_pool(repo.pool().clone());
    let manager = BackupManager::new(db, db_path)
        .map_err(|e| e.to_string())?;

    let guard = provider.read().await;
    let options = BackupOptions::default();
    manager.create_backup(guard.as_ref(), options)
        .await
        .map(|info| SchedulerResult {
            success: true,
            backup_id: Some(info.id),
            error: None,
            scheduled_at: chrono::Utc::now(),
            completed_at: Some(chrono::Utc::now()),
        })
        .map_err(|e| e.to_string())
}

/// Scheduler status
#[derive(serde::Serialize, serde::Deserialize)]
pub struct SchedulerStatus {
    pub running: bool,
    pub next_scheduled: Option<String>,
}
