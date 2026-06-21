//! Extract commands

use tauri::State;
use crate::database::Repository;
use crate::error::Result;
use crate::models::Extract;
use sqlx::Row;

#[tauri::command]
pub async fn get_extracts(
    document_id: Option<String>,
    repo: State<'_, Repository>,
) -> Result<Vec<Extract>> {
    let extracts = if let Some(id) = document_id {
        repo.list_extracts_by_document(&id).await?
    } else {
        repo.list_all_extracts().await?
    };
    Ok(extracts)
}

#[tauri::command]
pub async fn get_extract(
    id: String,
    repo: State<'_, Repository>,
) -> Result<Option<Extract>> {
    let extract = repo.get_extract(&id).await?;
    Ok(extract)
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn create_extract(
    document_id: String,
    content: String,
    html_content: Option<String>,
    source_url: Option<String>,
    note: Option<String>,
    tags: Option<Vec<String>>,
    category: Option<String>,
    color: Option<String>,
    page_number: Option<i32>,
    selection_context: Option<serde_json::Value>,
    max_disclosure_level: Option<i32>,
    repo: State<'_, Repository>,
) -> Result<Extract> {
    let mut extract = Extract::new(document_id.clone(), content);
    extract.html_content = html_content;
    extract.source_url = source_url;
    extract.notes = note;
    extract.tags = tags.unwrap_or_default();
    extract.category = category;
    extract.highlight_color = color;
    extract.page_number = page_number;
    extract.selection_context = selection_context;
    if let Some(level) = max_disclosure_level {
        extract.max_disclosure_level = level;
    }
    // Inherit the parent document's priority score (SuperMemo-style IR
    // priority chain). Falls back to 0.0 when the document is unknown or
    // has no priority set.
    if let Ok(Some(doc)) = repo.get_document(&document_id).await {
        extract.priority_score = doc.priority_score;
    }
    let created = repo.create_extract(&extract).await?;
    append_daily_note_extract_link(&created, &repo).await?;
    Ok(created)
}

/// Manually override an extract's priority score. Once set, the extract
/// will no longer inherit from document priority updates (its score will
/// differ from the previous document score, so the cascade skips it).
#[tauri::command]
pub async fn set_extract_priority(
    id: String,
    priority_score: f64,
    repo: State<'_, Repository>,
) -> Result<()> {
    repo.update_extract_priority(&id, priority_score).await
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn update_extract(
    id: String,
    content: Option<String>,
    html_content: Option<String>,
    source_url: Option<String>,
    note: Option<String>,
    tags: Option<Vec<String>>,
    category: Option<String>,
    color: Option<String>,
    max_disclosure_level: Option<i32>,
    repo: State<'_, Repository>,
) -> Result<Extract> {
    let mut extract = repo.get_extract(&id).await?
        .ok_or_else(|| crate::error::IncrementumError::NotFound(format!("Extract {}", id)))?;

    if let Some(content) = content {
        extract.content = content;
    }
    if let Some(html_content) = html_content {
        extract.html_content = Some(html_content);
    }
    if let Some(source_url) = source_url {
        extract.source_url = Some(source_url);
    }
    if let Some(note) = note {
        extract.notes = Some(note);
    }
    if let Some(tags) = tags {
        extract.tags = tags;
    }
    if let Some(category) = category {
        extract.category = Some(category);
    }
    if let Some(color) = color {
        extract.highlight_color = Some(color);
    }
    if let Some(level) = max_disclosure_level {
        extract.max_disclosure_level = level;
    }
    extract.date_modified = chrono::Utc::now();

    repo.update_extract(&extract).await?;
    Ok(extract)
}

#[tauri::command]
pub async fn delete_extract(
    id: String,
    repo: State<'_, Repository>,
) -> Result<()> {
    repo.delete_extract(&id).await?;
    Ok(())
}

async fn append_daily_note_extract_link(
    extract: &Extract,
    repo: &Repository,
) -> Result<()> {
    let key = format!("daily_note:{}", chrono::Utc::now().format("%Y-%m-%d"));
    let row = sqlx::query("SELECT value FROM settings WHERE key = ?1")
        .bind(&key)
        .fetch_optional(repo.pool())
        .await?;
    let mut entries = row
        .and_then(|record| record.try_get::<String, _>("value").ok())
        .and_then(|value| serde_json::from_str::<Vec<serde_json::Value>>(&value).ok())
        .unwrap_or_default();
    entries.push(serde_json::json!({
        "type": "extract",
        "id": extract.id,
        "title": extract.content.chars().take(120).collect::<String>(),
        "timestamp": chrono::Utc::now().to_rfc3339(),
    }));
    let value = serde_json::to_string(&entries).unwrap_or_else(|_| "[]".to_string());
    sqlx::query(
        "INSERT INTO settings (key, value, date_modified) VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, date_modified = excluded.date_modified"
    )
    .bind(key)
    .bind(value)
    .bind(chrono::Utc::now())
    .execute(repo.pool())
    .await?;
    Ok(())
}
