//! Collections commands for organizing documents

use crate::models::collection::{Collection, DEFAULT_COLLECTION_ID};
use crate::database::Repository;
use sqlx::Row;
use tauri::State;

#[tauri::command]
pub async fn create_collection(
    name: String,
    icon: Option<String>,
    color: Option<String>,
    repo: State<'_, Repository>,
) -> Result<Collection, String> {
    repo.create_collection(&name, icon.as_deref(), color.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_collections(
    repo: State<'_, Repository>,
) -> Result<Vec<Collection>, String> {
    repo.get_collections()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_collection(
    id: String,
    repo: State<'_, Repository>,
) -> Result<Collection, String> {
    repo.get_collection(&id)
        .await
        .map_err(|e| e.to_string())
        .and_then(|opt| opt.ok_or_else(|| "Collection not found".to_string()))
}

#[tauri::command]
pub async fn update_collection(
    id: String,
    name: Option<String>,
    icon: Option<String>,
    color: Option<String>,
    repo: State<'_, Repository>,
) -> Result<Collection, String> {
    repo.update_collection(&id, name.as_deref(), icon.as_deref(), color.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_collection(
    id: String,
    repo: State<'_, Repository>,
) -> Result<(), String> {
    repo.delete_collection(&id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_active_collection(
    repo: State<'_, Repository>,
) -> Result<String, String> {
    let setting = sqlx::query("SELECT value FROM settings WHERE key = 'active_collection_id'")
        .fetch_optional(repo.pool())
        .await
        .map_err(|e| e.to_string())?;
    match setting {
        Some(row) => Ok(row.get::<String, _>("value")),
        None => Ok(DEFAULT_COLLECTION_ID.to_string()),
    }
}

#[tauri::command]
pub async fn set_active_collection(
    id: String,
    repo: State<'_, Repository>,
) -> Result<(), String> {
    let now = chrono::Utc::now();
    sqlx::query(
        "INSERT INTO settings (key, value, date_modified) VALUES ('active_collection_id', ?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = ?1, date_modified = ?2"
    )
    .bind(&id)
    .bind(now)
    .execute(repo.pool())
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_collection_due_count(
    id: String,
    repo: State<'_, Repository>,
) -> Result<i64, String> {
    repo.get_collection_due_count(&id)
        .await
        .map_err(|e| e.to_string())
}
