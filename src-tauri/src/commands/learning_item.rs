//! Learning item commands

use tauri::State;
use crate::database::Repository;
use crate::commands::review::RepositoryExt;
use crate::error::{Result, IncrementumError};
use crate::generator::LearningItemGenerator;
use crate::models::{LearningItem, ItemType, ItemState};
use std::collections::HashSet;
use sqlx::Row;

#[derive(Debug, Clone, serde::Serialize)]
pub struct DuplicateCandidate {
    pub id: String,
    pub question: String,
    pub similarity: f64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CardVersionEntry {
    pub version_id: String,
    pub item_id: String,
    pub timestamp: String,
    pub reason: Option<String>,
    pub question: String,
    pub answer: Option<String>,
}

fn tokenize(text: &str) -> HashSet<String> {
    text.to_lowercase()
        .split_whitespace()
        .map(|part| part.trim_matches(|c: char| !c.is_alphanumeric()).to_string())
        .filter(|token| !token.is_empty())
        .collect()
}

fn jaccard_similarity(a: &str, b: &str) -> f64 {
    let set_a = tokenize(a);
    let set_b = tokenize(b);
    if set_a.is_empty() || set_b.is_empty() {
        return 0.0;
    }
    let intersection = set_a.intersection(&set_b).count() as f64;
    let union = set_a.union(&set_b).count() as f64;
    if union <= 0.0 { 0.0 } else { intersection / union }
}

#[tauri::command]
pub async fn get_due_items(
    repo: State<'_, Repository>,
) -> Result<Vec<LearningItem>> {
    let now = chrono::Utc::now();
    let items = repo.get_due_learning_items(&now).await?;
    let mut filtered = Vec::new();
    for item in items {
        let prerequisite_ids = load_learning_item_prerequisites(&item.id, &repo).await?;
        let mut blocked = false;
        for prerequisite_id in prerequisite_ids {
            if let Some(prerequisite) = repo.get_learning_item(&prerequisite_id).await? {
                let is_mature = prerequisite.review_count > 0
                    && prerequisite.interval >= 21.0
                    && matches!(prerequisite.state, ItemState::Review);
                if !is_mature {
                    blocked = true;
                    break;
                }
            } else {
                blocked = true;
                break;
            }
        }
        if !blocked {
            filtered.push(item);
        }
    }
    Ok(filtered)
}

#[tauri::command]
pub async fn create_learning_item(
    item_type: String,
    question: String,
    answer: Option<String>,
    cloze_text: Option<String>,
    document_id: Option<String>,
    prerequisite_item_ids: Option<Vec<String>>,
    tags: Option<Vec<String>>,
    image_asset_ids: Option<Vec<String>>,
    interaction_metadata: Option<serde_json::Value>,
    allow_duplicate: Option<bool>,
    repo: State<'_, Repository>,
) -> Result<LearningItem> {
    if !allow_duplicate.unwrap_or(false) {
        let candidates = find_duplicate_candidates(&question, 3, &repo).await?;
        if !candidates.is_empty() && candidates[0].similarity >= 0.85 {
            return Err(IncrementumError::InvalidInput(format!(
                "Potential duplicate detected ({}: {:.0}% similarity). Set allow_duplicate=true to save anyway.",
                candidates[0].id,
                candidates[0].similarity * 100.0
            )));
        }
    }

    let item_type = match item_type.as_str() {
        "flashcard" => ItemType::Flashcard,
        "cloze" => ItemType::Cloze,
        "qa" => ItemType::Qa,
        _ => ItemType::Basic,
    };

    let mut item = LearningItem::new(item_type, question);
    item.document_id = document_id;
    item.answer = answer;
    item.cloze_text = cloze_text;
    item.tags = tags.unwrap_or_default();
    item.image_asset_ids = image_asset_ids.unwrap_or_default();
    item.interaction_metadata = interaction_metadata;
    let created = repo.create_learning_item(&item).await?;
    if let Some(prerequisites) = prerequisite_item_ids {
        store_learning_item_prerequisites(&created.id, &prerequisites, &repo).await?;
    }
    append_daily_note_learning_item_link(&created.id, &created.question, &repo).await?;
    Ok(created)
}

#[tauri::command]
pub async fn generate_learning_items_from_extract(
    extract_id: String,
    repo: State<'_, Repository>,
) -> Result<Vec<LearningItem>> {
    // Get the extract
    let extract = repo.get_extract(&extract_id).await?
        .ok_or_else(|| crate::error::IncrementumError::NotFound(format!("Extract {}", extract_id)))?;

    // Generate learning items
    let generator = LearningItemGenerator::new();
    let items = generator.generate_from_extract(&extract);

    // Save each item
    let mut created_items = Vec::new();
    for item in items {
        let created = repo.create_learning_item(&item).await?;
        append_daily_note_learning_item_link(&created.id, &created.question, &repo).await?;
        created_items.push(created);
    }

    Ok(created_items)
}

#[tauri::command]
pub async fn get_learning_items(
    document_id: String,
    repo: State<'_, Repository>,
) -> Result<Vec<LearningItem>> {
    let items = repo.get_learning_items_by_document(&document_id).await?;
    Ok(items)
}

#[tauri::command]
pub async fn get_learning_item(
    item_id: String,
    repo: State<'_, Repository>,
) -> Result<Option<LearningItem>> {
    let item = repo.get_learning_item(&item_id).await?;
    Ok(item)
}

#[tauri::command]
pub async fn get_learning_items_by_extract(
    extract_id: String,
    repo: State<'_, Repository>,
) -> Result<Vec<LearningItem>> {
    let items = repo.get_learning_items_by_extract(&extract_id).await?;
    Ok(items)
}

#[tauri::command]
pub async fn get_all_learning_items(
    repo: State<'_, Repository>,
) -> Result<Vec<LearningItem>> {
    let items = repo.get_all_learning_items().await?;
    Ok(items)
}

#[tauri::command]
pub async fn update_learning_item_content_with_version(
    item_id: String,
    question: String,
    answer: Option<String>,
    reason: Option<String>,
    repo: State<'_, Repository>,
) -> Result<LearningItem> {
    let mut item = repo.get_learning_item(&item_id).await?
        .ok_or_else(|| IncrementumError::NotFound(format!("Learning item {}", item_id)))?;

    let version_id = uuid::Uuid::new_v4().to_string();
    let timestamp = chrono::Utc::now().to_rfc3339();
    let version = CardVersionEntry {
        version_id: version_id.clone(),
        item_id: item_id.clone(),
        timestamp: timestamp.clone(),
        reason,
        question: item.question.clone(),
        answer: item.answer.clone(),
    };

    sqlx::query(
        "INSERT INTO settings (key, value, date_modified) VALUES (?1, ?2, ?3)"
    )
    .bind(format!("card_version:{}:{}", item_id, version_id))
    .bind(serde_json::to_string(&version).unwrap_or_else(|_| "{}".to_string()))
    .bind(chrono::Utc::now())
    .execute(repo.pool())
    .await?;

    item.question = question;
    item.answer = answer;
    item.date_modified = chrono::Utc::now();
    repo.update_learning_item(&item).await?;
    Ok(item)
}

#[tauri::command]
pub async fn get_learning_item_versions(
    item_id: String,
    repo: State<'_, Repository>,
) -> Result<Vec<CardVersionEntry>> {
    let rows = sqlx::query(
        "SELECT key, value FROM settings WHERE key LIKE ?1 ORDER BY date_modified DESC"
    )
    .bind(format!("card_version:{}:%", item_id))
    .fetch_all(repo.pool())
    .await?;

    let mut versions = Vec::new();
    for row in rows {
        let value: String = row.try_get("value").unwrap_or_default();
        if let Ok(version) = serde_json::from_str::<CardVersionEntry>(&value) {
            versions.push(version);
        }
    }
    Ok(versions)
}

#[tauri::command]
pub async fn revert_learning_item_version(
    item_id: String,
    version_id: String,
    repo: State<'_, Repository>,
) -> Result<LearningItem> {
    let key = format!("card_version:{}:{}", item_id, version_id);
    let row = sqlx::query("SELECT value FROM settings WHERE key = ?1")
        .bind(&key)
        .fetch_optional(repo.pool())
        .await?;

    let value: String = row
        .ok_or_else(|| IncrementumError::NotFound(format!("Version {}", version_id)))?
        .try_get("value")
        .unwrap_or_default();
    let version: CardVersionEntry = serde_json::from_str(&value)
        .map_err(|e| IncrementumError::Internal(format!("Invalid version payload: {}", e)))?;

    let mut item = repo.get_learning_item(&item_id).await?
        .ok_or_else(|| IncrementumError::NotFound(format!("Learning item {}", item_id)))?;
    item.question = version.question;
    item.answer = version.answer;
    item.date_modified = chrono::Utc::now();
    repo.update_learning_item(&item).await?;
    Ok(item)
}

#[tauri::command]
pub async fn export_mnemosyne(
    output_path: Option<String>,
    repo: State<'_, Repository>,
) -> Result<String> {
    let items = repo.get_all_learning_items().await?;
    let mut content = String::from("# Mnemosyne Export\n");
    for item in items {
        let question = item.question.replace('\n', " ");
        let answer = item.answer.unwrap_or_default().replace('\n', " ");
        content.push_str(&format!("{}\t{}\n", question, answer));
    }

    let target = output_path.unwrap_or_else(|| {
        std::env::temp_dir()
            .join(format!("incrementum-mnemosyne-{}.txt", chrono::Utc::now().timestamp()))
            .to_string_lossy()
            .to_string()
    });
    std::fs::write(&target, content)
        .map_err(|e| IncrementumError::Internal(format!("Failed to write export: {}", e)))?;
    Ok(target)
}

#[tauri::command]
pub async fn set_learning_item_prerequisites(
    item_id: String,
    prerequisite_item_ids: Vec<String>,
    repo: State<'_, Repository>,
) -> Result<()> {
    store_learning_item_prerequisites(&item_id, &prerequisite_item_ids, &repo).await
}

#[tauri::command]
pub async fn get_learning_item_prerequisites(
    item_id: String,
    repo: State<'_, Repository>,
) -> Result<Vec<String>> {
    load_learning_item_prerequisites(&item_id, &repo).await
}

#[tauri::command]
pub async fn get_daily_note_links(
    date: Option<String>,
    repo: State<'_, Repository>,
) -> Result<Vec<serde_json::Value>> {
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let key = format!("daily_note:{}", date.unwrap_or(today));
    let row = sqlx::query("SELECT value FROM settings WHERE key = ?1")
        .bind(key)
        .fetch_optional(repo.pool())
        .await?;
    let value = row
        .and_then(|record| record.try_get::<String, _>("value").ok())
        .unwrap_or_else(|| "[]".to_string());
    let parsed = serde_json::from_str::<Vec<serde_json::Value>>(&value).unwrap_or_default();
    Ok(parsed)
}

async fn store_learning_item_prerequisites(
    item_id: &str,
    prerequisite_item_ids: &[String],
    repo: &Repository,
) -> Result<()> {
    let key = format!("card_prereq:{}", item_id);
    let value = serde_json::to_string(prerequisite_item_ids).unwrap_or_else(|_| "[]".to_string());
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

async fn load_learning_item_prerequisites(
    item_id: &str,
    repo: &Repository,
) -> Result<Vec<String>> {
    let key = format!("card_prereq:{}", item_id);
    let row = sqlx::query("SELECT value FROM settings WHERE key = ?1")
        .bind(key)
        .fetch_optional(repo.pool())
        .await?;
    if let Some(record) = row {
        let value: String = record.try_get("value").unwrap_or_default();
        let parsed = serde_json::from_str::<Vec<String>>(&value).unwrap_or_default();
        return Ok(parsed);
    }
    Ok(Vec::new())
}

async fn append_daily_note_learning_item_link(
    item_id: &str,
    question: &str,
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
        "type": "learning_item",
        "id": item_id,
        "title": question,
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

async fn find_duplicate_candidates(
    question: &str,
    limit: usize,
    repo: &Repository,
) -> Result<Vec<DuplicateCandidate>> {
    let items = repo.get_all_learning_items().await?;
    let mut scored = items
        .into_iter()
        .map(|item| DuplicateCandidate {
            id: item.id,
            question: item.question.clone(),
            similarity: jaccard_similarity(question, &item.question),
        })
        .filter(|candidate| candidate.similarity >= 0.6)
        .collect::<Vec<_>>();

    scored.sort_by(|a, b| b.similarity.partial_cmp(&a.similarity).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(limit);
    Ok(scored)
}

#[tauri::command]
pub async fn check_semantic_duplicate_candidates(
    question: String,
    limit: Option<i32>,
    repo: State<'_, Repository>,
) -> Result<Vec<DuplicateCandidate>> {
    let top_k = limit.unwrap_or(5).max(1) as usize;
    find_duplicate_candidates(&question, top_k, &repo).await
}
