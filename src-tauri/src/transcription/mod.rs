pub mod model_manager;
pub mod engine;
pub mod job_queue;

use tauri::{AppHandle, Manager, State, command};
use crate::database::Repository;
use crate::error::Result;
use model_manager::{ModelManager, ModelProfile};
use job_queue::{JobQueue, TranscriptionJob};
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct TranscriptResponse {
    pub id: i64,
    pub status: String,
    pub segments: Vec<engine::TranscriptSegment>,
}

pub struct TranscriptionState {
    pub job_queue: JobQueue,
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
