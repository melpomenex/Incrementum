pub mod model_manager;
pub mod engine;
pub mod job_queue;
pub mod auto_queue;
pub mod idle_scanner;

use tauri::{AppHandle, Manager, State, command};
use crate::database::Repository;
use crate::error::Result;
use crate::models::{TranscriptionQueueEntry, TranscriptionJobStatus, TranscriptionQueueEntryWithDoc};
use model_manager::{ModelManager, ModelProfile};
use job_queue::{JobQueue, TranscriptionJob};
use auto_queue::AutoTranscriptionQueue;
use serde::{Serialize, Deserialize};
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize)]
pub struct TranscriptResponse {
    pub id: i64,
    pub status: String,
    pub segments: Vec<engine::TranscriptSegment>,
}

pub struct TranscriptionState {
    pub job_queue: JobQueue,
    pub auto_queue: AutoTranscriptionQueue,
}

#[command]
pub async fn get_transcription_profiles(app_handle: AppHandle) -> Result<Vec<ModelProfile>> {
    let manager = ModelManager::new(&app_handle).map_err(|e| crate::error::IncrementumError::Internal(e.to_string()))?;
    Ok(manager.list_profiles())
}

#[command]
pub async fn download_transcription_model(app_handle: AppHandle, id: String) -> Result<()> {
    let manager = ModelManager::new(&app_handle).map_err(|e| crate::error::IncrementumError::Internal(e.to_string()))?;
    manager.download_model(&id, app_handle).await.map_err(|e| crate::error::IncrementumError::Internal(e.to_string()))
}

#[command]
pub async fn delete_transcription_model(app_handle: AppHandle, id: String) -> Result<()> {
    let manager = ModelManager::new(&app_handle).map_err(|e| crate::error::IncrementumError::Internal(e.to_string()))?;
    manager.delete_model(&id).map_err(|e| crate::error::IncrementumError::Internal(e.to_string()))
}

#[command]
pub async fn start_transcription(
    state: State<'_, TranscriptionState>,
    book_id: String,
    chapter_id: String,
    audio_path: String,
    model_id: String,
    language: String,
) -> Result<()> {
    let job = TranscriptionJob {
        book_id,
        chapter_id,
        audio_path,
        model_id,
        language,
    };
    state.job_queue.enqueue(job).map_err(|e| crate::error::IncrementumError::Internal(e.to_string()))
}

#[command]
pub async fn get_transcript(
    repo: State<'_, Repository>,
    book_id: String,
    chapter_id: String,
) -> Result<Option<TranscriptResponse>> {
    let transcript: Option<(i64, String)> = sqlx::query_as("SELECT id, status FROM transcripts WHERE book_id = ? AND chapter_id = ?")
        .bind(&book_id)
        .bind(&chapter_id)
        .fetch_optional(repo.pool())
        .await?;

    if let Some((id, status)) = transcript {
        let segments: Vec<engine::TranscriptSegment> = sqlx::query_as("SELECT start_ms, end_ms, text, confidence FROM transcript_segments WHERE transcript_id = ? ORDER BY start_ms")
            .bind(id)
            .fetch_all(repo.pool())
            .await?;

        Ok(Some(TranscriptResponse {
            id,
            status,
            segments,
        }))
    } else {
        Ok(None)
    }
}

// Auto-transcription commands

#[command]
pub async fn enqueue_auto_transcription(
    state: State<'_, TranscriptionState>,
    repo: State<'_, Repository>,
    document_id: String,
    audio_path: String,
    provider: String,
    model_id: String,
    language: String,
    priority: Option<i32>,
) -> Result<()> {
    // Don't enqueue if a completed or pending entry already exists
    let existing = repo.get_transcription_queue_entry(&document_id).await
        .map_err(|e| crate::error::IncrementumError::Internal(e.to_string()))?;
    if let Some(entry) = existing {
        if entry.status == TranscriptionJobStatus::Completed || entry.status == TranscriptionJobStatus::Pending || entry.status == TranscriptionJobStatus::Processing {
            return Ok(());
        }
    }

    let entry = TranscriptionQueueEntry::new(document_id, audio_path, provider, model_id, language);
    let entry = TranscriptionQueueEntry {
        priority: priority.unwrap_or(0),
        ..entry
    };
    state.auto_queue.enqueue(entry)
        .map_err(|e| crate::error::IncrementumError::Internal(e.to_string()))
}

#[command]
pub async fn get_transcription_queue(
    repo: State<'_, Repository>,
) -> Result<Vec<TranscriptionQueueEntryWithDoc>> {
    repo.get_full_transcription_queue().await
        .map_err(|e| crate::error::IncrementumError::Internal(e.to_string()))
}

#[command]
pub async fn cancel_transcription_job(
    state: State<'_, TranscriptionState>,
    repo: State<'_, Repository>,
    id: String,
) -> Result<()> {
    repo.cancel_transcription_job(&id).await
        .map_err(|e| crate::error::IncrementumError::Internal(e.to_string()))?;
    state.auto_queue.cancel(id)
        .map_err(|e| crate::error::IncrementumError::Internal(e.to_string()))
}

#[command]
pub async fn retry_transcription_job(
    repo: State<'_, Repository>,
    state: State<'_, TranscriptionState>,
    id: String,
) -> Result<()> {
    repo.reset_transcription_to_pending(&id, 0).await
        .map_err(|e| crate::error::IncrementumError::Internal(e.to_string()))?;
    state.auto_queue.trigger_processing()
        .map_err(|e| crate::error::IncrementumError::Internal(e.to_string()))
}

#[command]
pub async fn prioritize_transcription_job(
    repo: State<'_, Repository>,
    state: State<'_, TranscriptionState>,
    id: String,
) -> Result<()> {
    sqlx::query("UPDATE transcription_queue SET priority = 10 WHERE id = ?1")
        .bind(&id)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(e.to_string()))?;
    state.auto_queue.trigger_processing()
        .map_err(|e| crate::error::IncrementumError::Internal(e.to_string()))
}

#[command]
pub async fn get_transcription_status(
    repo: State<'_, Repository>,
    document_id: String,
) -> Result<Option<TranscriptionQueueEntry>> {
    repo.get_transcription_queue_entry(&document_id).await
        .map_err(|e| crate::error::IncrementumError::Internal(e.to_string()))
}

#[command]
pub async fn enqueue_all_untranscribed(
    repo: State<'_, Repository>,
    state: State<'_, TranscriptionState>,
    provider: String,
    model_id: String,
    language: String,
) -> Result<u32> {
    let untranscribed = repo.get_untranscribed_media_documents().await
        .map_err(|e| crate::error::IncrementumError::Internal(e.to_string()))?;

    let mut count = 0u32;
    for (doc_id, _title, file_path) in untranscribed {
        let entry = TranscriptionQueueEntry::new(
            doc_id,
            file_path,
            provider.clone(),
            model_id.clone(),
            language.clone(),
        );
        if state.auto_queue.enqueue(entry).is_ok() {
            count += 1;
        }
    }

    Ok(count)
}
