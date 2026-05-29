//! Collection export/import archive commands

use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::PathBuf;

use chrono::Utc;
use serde::Deserialize;
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;
use zip::ZipArchive;

use crate::database::Repository;
use crate::error::{AppError, Result};
use crate::models::{Document, Extract, LearningItem};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ArchiveManifest {
    archive_type: String,
    version: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ArchiveFileEntry {
    document_id: String,
    filename: String,
    content_type: Option<String>,
    zip_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ArchivePayload {
    documents: Vec<Document>,
    extracts: Vec<Extract>,
    learning_items: Vec<LearningItem>,
    files: Vec<ArchiveFileEntry>,
}

fn normalize_file_type(file_type: &crate::models::FileType) -> String {
    format!("{:?}", file_type).to_lowercase()
}

fn normalize_item_type(item_type: &crate::models::ItemType) -> String {
    format!("{:?}", item_type).to_lowercase()
}

fn normalize_item_state(state: &crate::models::ItemState) -> String {
    format!("{:?}", state).to_lowercase()
}

fn ensure_document_storage(app: &AppHandle) -> Result<PathBuf> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("Failed to get app data dir: {}", e)))?;
    let docs_dir = app_dir.join("documents");
    fs::create_dir_all(&docs_dir)
        .map_err(|e| AppError::Internal(format!("Failed to create documents dir: {}", e)))?;
    Ok(docs_dir)
}

fn read_zip_bytes(archive: &mut ZipArchive<fs::File>, path: &str) -> Result<Vec<u8>> {
    let mut file = archive
        .by_name(path)
        .map_err(|e| AppError::Internal(format!("Missing archive entry '{}': {}", path, e)))?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)
        .map_err(|e| AppError::Internal(format!("Failed to read archive entry '{}': {}", path, e)))?;
    Ok(buffer)
}

#[tauri::command]
pub async fn import_collection_archive(
    archive_path: String,
    repo: State<'_, Repository>,
    app: AppHandle,
) -> Result<String> {
    let archive_file = fs::File::open(&archive_path)
        .map_err(|e| AppError::Internal(format!("Failed to open archive: {}", e)))?;
    let mut archive = ZipArchive::new(archive_file)
        .map_err(|e| AppError::Internal(format!("Invalid archive: {}", e)))?;

    let manifest_bytes = read_zip_bytes(&mut archive, "manifest.json")?;
    let manifest: ArchiveManifest = serde_json::from_slice(&manifest_bytes)
        .map_err(|e| AppError::Internal(format!("Invalid manifest: {}", e)))?;
    if manifest.archive_type != "incrementum-collection-export" {
        return Err(AppError::Internal("Unsupported archive type".to_string()));
    }
    if manifest.version != "1.0" {
        return Err(AppError::Internal("Unsupported archive version".to_string()));
    }

    let payload_bytes = read_zip_bytes(&mut archive, "data/payload.json")?;
    let mut payload: ArchivePayload = serde_json::from_slice(&payload_bytes)
        .map_err(|e| AppError::Internal(format!("Invalid archive payload: {}", e)))?;

    let docs_dir = ensure_document_storage(&app)?;

    for file_entry in &payload.files {
        let file_bytes = read_zip_bytes(&mut archive, &file_entry.zip_path)?;
        let doc_dir = docs_dir.join(&file_entry.document_id);
        fs::create_dir_all(&doc_dir)
            .map_err(|e| AppError::Internal(format!("Failed to create doc dir: {}", e)))?;
        let file_path = doc_dir.join(&file_entry.filename);
        fs::write(&file_path, file_bytes)
            .map_err(|e| AppError::Internal(format!("Failed to write document file: {}", e)))?;

        if let Some(doc) = payload.documents.iter_mut().find(|d| d.id == file_entry.document_id) {
            doc.file_path = file_path.to_string_lossy().to_string();
        }
    }

    let pool = repo.pool();
    let mut tx = pool.begin().await?;

    sqlx::query("DELETE FROM learning_items").execute(&mut *tx).await?;
    sqlx::query("DELETE FROM extracts").execute(&mut *tx).await?;
    sqlx::query("DELETE FROM documents").execute(&mut *tx).await?;

    for doc in &payload.documents {
        let tags_json = serde_json::to_string(&doc.tags)?;
        let metadata_json = doc.metadata.as_ref().map(serde_json::to_string).transpose()?;
        let file_type_str = normalize_file_type(&doc.file_type);

        sqlx::query(
            r#"
            INSERT INTO documents (
                id, title, file_path, file_type, content, content_hash,
                total_pages, current_page, current_scroll_percent, current_cfi, current_view_state,
                position_json, progress_percent, category, tags, date_added, date_modified, date_last_reviewed,
                extract_count, learning_item_count, priority_rating, priority_slider, priority_score,
                is_archived, is_favorite, is_dismissed, metadata, cover_image_url, cover_image_source,
                next_reading_date, reading_count, stability, difficulty, reps, total_time_spent, consecutive_count
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6,
                ?7, ?8, ?9, ?10, ?11,
                ?12, ?13, ?14, ?15, ?16, ?17, ?18,
                ?19, ?20, ?21, ?22, ?23,
                ?24, ?25, ?26, ?27, ?28, ?29,
                ?30, ?31, ?32, ?33, ?34, ?35, ?36
            )
            "#,
        )
        .bind(&doc.id)
        .bind(&doc.title)
        .bind(&doc.file_path)
        .bind(&file_type_str)
        .bind(&doc.content)
        .bind(&doc.content_hash)
        .bind(doc.total_pages)
        .bind(doc.current_page)
        .bind(doc.current_scroll_percent)
        .bind(&doc.current_cfi)
        .bind(&doc.current_view_state)
        .bind(&doc.position_json)
        .bind(doc.progress_percent)
        .bind(&doc.category)
        .bind(&tags_json)
        .bind(doc.date_added)
        .bind(doc.date_modified)
        .bind(doc.date_last_reviewed)
        .bind(doc.extract_count)
        .bind(doc.learning_item_count)
        .bind(doc.priority_rating)
        .bind(doc.priority_slider)
        .bind(doc.priority_score)
        .bind(doc.is_archived)
        .bind(doc.is_favorite)
        .bind(doc.is_dismissed)
        .bind(metadata_json)
        .bind(&doc.cover_image_url)
        .bind(&doc.cover_image_source)
        .bind(doc.next_reading_date)
        .bind(doc.reading_count)
        .bind(doc.stability)
        .bind(doc.difficulty)
        .bind(doc.reps)
        .bind(doc.total_time_spent)
        .bind(doc.consecutive_count)
        .execute(&mut *tx)
        .await?;
    }

    for extract in &payload.extracts {
        let tags_json = serde_json::to_string(&extract.tags)?;
        let selection_context_json = extract
            .selection_context
            .as_ref()
            .map(serde_json::to_string)
            .transpose()?;

        let (stability, difficulty) = extract
            .memory_state
            .as_ref()
            .map(|s| (Some(s.stability), Some(s.difficulty)))
            .unwrap_or((None, None));

        sqlx::query(
            r#"
            INSERT INTO extracts (
                id, document_id, content, html_content, source_url, page_title, page_number,
                selection_context, highlight_color, notes, progressive_disclosure_level,
                max_disclosure_level, date_created, date_modified, tags, category,
                memory_state_stability, memory_state_difficulty, next_review_date, last_review_date,
                review_count, reps
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7,
                ?8, ?9, ?10, ?11,
                ?12, ?13, ?14, ?15, ?16,
                ?17, ?18, ?19, ?20,
                ?21, ?22
            )
            "#,
        )
        .bind(&extract.id)
        .bind(&extract.document_id)
        .bind(&extract.content)
        .bind(&extract.html_content)
        .bind(&extract.source_url)
        .bind(&extract.page_title)
        .bind(extract.page_number)
        .bind(selection_context_json)
        .bind(&extract.highlight_color)
        .bind(&extract.notes)
        .bind(extract.progressive_disclosure_level)
        .bind(extract.max_disclosure_level)
        .bind(extract.date_created)
        .bind(extract.date_modified)
        .bind(&tags_json)
        .bind(&extract.category)
        .bind(stability)
        .bind(difficulty)
        .bind(extract.next_review_date)
        .bind(extract.last_review_date)
        .bind(extract.review_count)
        .bind(extract.reps)
        .execute(&mut *tx)
        .await?;
    }

    for item in &payload.learning_items {
        let tags_json = serde_json::to_string(&item.tags)?;
        let cloze_ranges_json = item
            .cloze_ranges
            .as_ref()
            .map(serde_json::to_string)
            .transpose()?;
        let (stability, difficulty) = item
            .memory_state
            .as_ref()
            .map(|s| (Some(s.stability), Some(s.difficulty)))
            .unwrap_or((None, None));

        let item_type_str = normalize_item_type(&item.item_type);
        let state_str = normalize_item_state(&item.state);

        sqlx::query(
            r#"
            INSERT INTO learning_items (
                id, extract_id, document_id, item_type, question,
                answer, cloze_text, cloze_ranges, difficulty, interval,
                ease_factor, due_date, date_created, date_modified,
                last_review_date, review_count, lapses, state,
                is_suspended, tags, memory_state_stability, memory_state_difficulty
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5,
                ?6, ?7, ?8, ?9, ?10,
                ?11, ?12, ?13, ?14,
                ?15, ?16, ?17, ?18,
                ?19, ?20, ?21, ?22
            )
            "#,
        )
        .bind(&item.id)
        .bind(&item.extract_id)
        .bind(&item.document_id)
        .bind(&item_type_str)
        .bind(&item.question)
        .bind(&item.answer)
        .bind(&item.cloze_text)
        .bind(cloze_ranges_json)
        .bind(item.difficulty)
        .bind(item.interval)
        .bind(item.ease_factor)
        .bind(item.due_date)
        .bind(item.date_created)
        .bind(item.date_modified)
        .bind(item.last_review_date)
        .bind(item.review_count)
        .bind(item.lapses)
        .bind(&state_str)
        .bind(item.is_suspended)
        .bind(&tags_json)
        .bind(stability)
        .bind(difficulty)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(format!(
        "Imported {} documents, {} extracts, {} learning items at {}",
        payload.documents.len(),
        payload.extracts.len(),
        payload.learning_items.len(),
        Utc::now().to_rfc3339()
    ))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MergeManifest {
    archive_type: String,
    version: String,
    collection_id: Option<String>,
    collection_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MergePayload {
    documents: Vec<Document>,
    extracts: Vec<Extract>,
    learning_items: Vec<LearningItem>,
    files: Vec<ArchiveFileEntry>,
    review_sessions: Option<Vec<serde_json::Value>>,
    review_results: Option<Vec<serde_json::Value>>,
    categories: Option<Vec<serde_json::Value>>,
}

/// Import a collection archive alongside existing data (non-destructive).
/// All entity IDs are remapped to new UUIDs to prevent collisions.
#[tauri::command]
pub async fn import_collection_archive_merge(
    archive_path: String,
    repo: State<'_, Repository>,
    app: AppHandle,
) -> Result<String> {
    let archive_file = fs::File::open(&archive_path)
        .map_err(|e| AppError::Internal(format!("Failed to open archive: {}", e)))?;
    let mut archive = ZipArchive::new(archive_file)
        .map_err(|e| AppError::Internal(format!("Invalid archive: {}", e)))?;

    let manifest_bytes = read_zip_bytes(&mut archive, "manifest.json")?;
    let manifest: MergeManifest = serde_json::from_slice(&manifest_bytes)
        .map_err(|e| AppError::Internal(format!("Invalid manifest: {}", e)))?;
    if manifest.archive_type != "incrementum-collection-export" {
        return Err(AppError::Internal("Unsupported archive type".to_string()));
    }

    let payload_bytes = read_zip_bytes(&mut archive, "data/payload.json")?;
    let payload: MergePayload = serde_json::from_slice(&payload_bytes)
        .map_err(|e| AppError::Internal(format!("Invalid archive payload: {}", e)))?;

    let mut collection_name = manifest.collection_name
        .unwrap_or_else(|| "Imported Collection".to_string());

    let existing_collections = repo.get_collections().await.unwrap_or_default();
    let existing_names: Vec<String> = existing_collections.iter().map(|c| c.name.clone()).collect();
    if existing_names.contains(&collection_name) {
        collection_name = format!("{} (imported)", collection_name);
    }
    let new_collection = repo.create_collection(&collection_name, None, None).await?;
    let new_collection_id = new_collection.id;

    let mut doc_id_map: HashMap<String, String> = HashMap::new();
    let mut extract_id_map: HashMap<String, String> = HashMap::new();
    let mut item_id_map: HashMap<String, String> = HashMap::new();
    let mut session_id_map: HashMap<String, String> = HashMap::new();
    let mut category_id_map: HashMap<String, String> = HashMap::new();

    for doc in &payload.documents {
        doc_id_map.insert(doc.id.clone(), Uuid::new_v4().to_string());
    }
    for extract in &payload.extracts {
        extract_id_map.insert(extract.id.clone(), Uuid::new_v4().to_string());
    }
    for item in &payload.learning_items {
        item_id_map.insert(item.id.clone(), Uuid::new_v4().to_string());
    }
    for session in payload.review_sessions.as_deref().unwrap_or(&[]) {
        if let Some(id) = session.get("id").and_then(|v| v.as_str()) {
            session_id_map.insert(id.to_string(), Uuid::new_v4().to_string());
        }
    }
    for cat in payload.categories.as_deref().unwrap_or(&[]) {
        if let Some(id) = cat.get("id").and_then(|v| v.as_str()) {
            category_id_map.insert(id.to_string(), Uuid::new_v4().to_string());
        }
    }

    let docs_dir = ensure_document_storage(&app)?;
    for file_entry in &payload.files {
        let file_bytes = read_zip_bytes(&mut archive, &file_entry.zip_path)?;
        let new_doc_id = doc_id_map.get(&file_entry.document_id).unwrap_or(&file_entry.document_id);
        let doc_dir = docs_dir.join(new_doc_id);
        fs::create_dir_all(&doc_dir)
            .map_err(|e| AppError::Internal(format!("Failed to create doc dir: {}", e)))?;
        let file_path = doc_dir.join(&file_entry.filename);
        fs::write(&file_path, file_bytes)
            .map_err(|e| AppError::Internal(format!("Failed to write document file: {}", e)))?;
    }

    let pool = repo.pool();
    let mut tx = pool.begin().await?;

    // Insert documents with remapped IDs and new collection_id
    for doc in &payload.documents {
        let new_id = doc_id_map.get(&doc.id).unwrap_or(&doc.id);
        let tags_json = serde_json::to_string(&doc.tags)?;
        let metadata_json = doc.metadata.as_ref().map(serde_json::to_string).transpose()?;
        let file_type_str = normalize_file_type(&doc.file_type);

        // Resolve file path for the new doc ID
        let resolved_path = if let Some(entry) = payload.files.iter().find(|f| f.document_id == doc.id) {
            let new_doc_id = new_id.clone();
            docs_dir.join(&new_doc_id).join(&entry.filename).to_string_lossy().to_string()
        } else {
            doc.file_path.clone()
        };

        sqlx::query(
            r#"INSERT INTO documents (
                id, collection_id, title, file_path, file_type, content, content_hash,
                total_pages, current_page, current_scroll_percent, current_cfi, current_view_state,
                position_json, progress_percent, category, tags, date_added, date_modified, date_last_reviewed,
                extract_count, learning_item_count, priority_rating, priority_slider, priority_score,
                is_archived, is_favorite, is_dismissed, metadata, cover_image_url, cover_image_source,
                next_reading_date, reading_count, stability, difficulty, reps, total_time_spent, consecutive_count
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7,
                ?8, ?9, ?10, ?11, ?12,
                ?13, ?14, ?15, ?16, ?17, ?18, ?19,
                ?20, ?21, ?22, ?23, ?24,
                ?25, ?26, ?27, ?28, ?29, ?30,
                ?31, ?32, ?33, ?34, ?35, ?36, ?37
            )"#
        )
        .bind(new_id)
        .bind(&new_collection_id)
        .bind(&doc.title)
        .bind(&resolved_path)
        .bind(&file_type_str)
        .bind(&doc.content)
        .bind(&doc.content_hash)
        .bind(doc.total_pages)
        .bind(doc.current_page)
        .bind(doc.current_scroll_percent)
        .bind(&doc.current_cfi)
        .bind(&doc.current_view_state)
        .bind(&doc.position_json)
        .bind(doc.progress_percent)
        .bind(&doc.category)
        .bind(&tags_json)
        .bind(doc.date_added)
        .bind(doc.date_modified)
        .bind(doc.date_last_reviewed)
        .bind(doc.extract_count)
        .bind(doc.learning_item_count)
        .bind(doc.priority_rating)
        .bind(doc.priority_slider)
        .bind(doc.priority_score)
        .bind(doc.is_archived)
        .bind(doc.is_favorite)
        .bind(doc.is_dismissed)
        .bind(metadata_json)
        .bind(&doc.cover_image_url)
        .bind(&doc.cover_image_source)
        .bind(doc.next_reading_date)
        .bind(doc.reading_count)
        .bind(doc.stability)
        .bind(doc.difficulty)
        .bind(doc.reps)
        .bind(doc.total_time_spent)
        .bind(doc.consecutive_count)
        .execute(&mut *tx)
        .await?;
    }

    // Insert extracts with remapped IDs
    for extract in &payload.extracts {
        let new_id = extract_id_map.get(&extract.id).unwrap_or(&extract.id);
        let new_doc_id = doc_id_map.get(&extract.document_id).unwrap_or(&extract.document_id);
        let tags_json = serde_json::to_string(&extract.tags)?;
        let selection_context_json = extract.selection_context.as_ref().map(serde_json::to_string).transpose()?;
        let (stability, difficulty) = extract.memory_state.as_ref()
            .map(|s| (Some(s.stability), Some(s.difficulty)))
            .unwrap_or((None, None));

        sqlx::query(
            r#"INSERT INTO extracts (
                id, document_id, content, html_content, source_url, page_title, page_number,
                selection_context, highlight_color, notes, progressive_disclosure_level,
                max_disclosure_level, date_created, date_modified, tags, category,
                memory_state_stability, memory_state_difficulty, next_review_date, last_review_date,
                review_count, reps, collection_id
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7,
                ?8, ?9, ?10, ?11,
                ?12, ?13, ?14, ?15, ?16,
                ?17, ?18, ?19, ?20,
                ?21, ?22, ?23
            )"#
        )
        .bind(new_id)
        .bind(new_doc_id)
        .bind(&extract.content)
        .bind(&extract.html_content)
        .bind(&extract.source_url)
        .bind(&extract.page_title)
        .bind(extract.page_number)
        .bind(selection_context_json)
        .bind(&extract.highlight_color)
        .bind(&extract.notes)
        .bind(extract.progressive_disclosure_level)
        .bind(extract.max_disclosure_level)
        .bind(extract.date_created)
        .bind(extract.date_modified)
        .bind(&tags_json)
        .bind(&extract.category)
        .bind(stability)
        .bind(difficulty)
        .bind(extract.next_review_date)
        .bind(extract.last_review_date)
        .bind(extract.review_count)
        .bind(extract.reps)
        .bind(&new_collection_id)
        .execute(&mut *tx)
        .await?;
    }

    // Insert learning items with remapped IDs
    for item in &payload.learning_items {
        let new_id = item_id_map.get(&item.id).unwrap_or(&item.id);
        let new_extract_id = item.extract_id.as_ref().and_then(|eid| extract_id_map.get(eid));
        let new_doc_id = item.document_id.as_ref().and_then(|did| doc_id_map.get(did));
        let tags_json = serde_json::to_string(&item.tags)?;
        let cloze_ranges_json = item.cloze_ranges.as_ref().map(serde_json::to_string).transpose()?;
        let (stability, difficulty) = item.memory_state.as_ref()
            .map(|s| (Some(s.stability), Some(s.difficulty)))
            .unwrap_or((None, None));
        let item_type_str = normalize_item_type(&item.item_type);
        let state_str = normalize_item_state(&item.state);

        sqlx::query(
            r#"INSERT INTO learning_items (
                id, extract_id, document_id, item_type, question,
                answer, cloze_text, cloze_ranges, difficulty, interval,
                ease_factor, due_date, date_created, date_modified,
                last_review_date, review_count, lapses, state,
                is_suspended, tags, memory_state_stability, memory_state_difficulty, collection_id
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5,
                ?6, ?7, ?8, ?9, ?10,
                ?11, ?12, ?13, ?14,
                ?15, ?16, ?17, ?18,
                ?19, ?20, ?21, ?22, ?23
            )"#
        )
        .bind(new_id)
        .bind(new_extract_id)
        .bind(new_doc_id)
        .bind(&item_type_str)
        .bind(&item.question)
        .bind(&item.answer)
        .bind(&item.cloze_text)
        .bind(cloze_ranges_json)
        .bind(item.difficulty)
        .bind(item.interval)
        .bind(item.ease_factor)
        .bind(&item.due_date)
        .bind(item.date_created)
        .bind(item.date_modified)
        .bind(item.last_review_date)
        .bind(item.review_count)
        .bind(item.lapses)
        .bind(&state_str)
        .bind(item.is_suspended)
        .bind(&tags_json)
        .bind(stability)
        .bind(difficulty)
        .bind(&new_collection_id)
        .execute(&mut *tx)
        .await?;
    }

    // Insert review sessions with remapped IDs
    for session in payload.review_sessions.as_deref().unwrap_or(&[]) {
        let old_id = session.get("id").and_then(|v| v.as_str()).unwrap_or("");
        let new_id = session_id_map.get(old_id).cloned().unwrap_or_else(|| old_id.to_string());

        sqlx::query(
            r#"INSERT INTO review_sessions (id, collection_id, start_time, end_time, items_reviewed, correct_answers, total_time)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"#
        )
        .bind(new_id)
        .bind(&new_collection_id)
        .bind(session.get("startTime").and_then(|v| v.as_str()))
        .bind(session.get("endTime").and_then(|v| v.as_str()))
        .bind(session.get("itemsReviewed").and_then(|v| v.as_i64()).unwrap_or(0) as i32)
        .bind(session.get("correctAnswers").and_then(|v| v.as_i64()).unwrap_or(0) as i32)
        .bind(session.get("totalTime").and_then(|v| v.as_i64()).unwrap_or(0) as i32)
        .execute(&mut *tx)
        .await?;
    }

    // Insert review results with remapped IDs
    for result in payload.review_results.as_deref().unwrap_or(&[]) {
        let new_id = Uuid::new_v4().to_string();
        let old_session_id = result.get("reviewSessionId").and_then(|v| v.as_str());
        let new_session_id = old_session_id.and_then(|sid| session_id_map.get(sid));
        let old_item_id = result.get("itemId").and_then(|v| v.as_str()).unwrap_or("");
        let new_item_id = item_id_map.get(old_item_id);

        sqlx::query(
            r#"INSERT INTO review_results (id, collection_id, session_id, item_id, rating, time_taken, new_due_date, new_interval, new_ease_factor, timestamp)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"#
        )
        .bind(&new_id)
        .bind(&new_collection_id)
        .bind(new_session_id)
        .bind(new_item_id)
        .bind(result.get("rating").and_then(|v| v.as_i64()).unwrap_or(0) as i32)
        .bind(result.get("timeTaken").and_then(|v| v.as_i64()).unwrap_or(0) as i32)
        .bind(result.get("newDueDate").and_then(|v| v.as_str()))
        .bind(result.get("newInterval").and_then(|v| v.as_f64()).unwrap_or(0.0))
        .bind(result.get("newEaseFactor").and_then(|v| v.as_f64()).unwrap_or(0.0))
        .bind(result.get("timestamp").and_then(|v| v.as_str()))
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(format!(
        "Imported collection '{}' ({} documents, {} extracts, {} learning items) at {}",
        collection_name,
        payload.documents.len(),
        payload.extracts.len(),
        payload.learning_items.len(),
        Utc::now().to_rfc3339()
    ))
}
