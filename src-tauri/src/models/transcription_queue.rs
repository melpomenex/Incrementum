//! Transcription queue model for auto-transcription of media documents.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionQueueEntry {
    pub id: String,
    pub document_id: String,
    pub audio_path: String,
    pub provider: String,
    pub model_id: String,
    pub language: String,
    pub status: TranscriptionJobStatus,
    pub error_message: Option<String>,
    pub priority: i32,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub retry_count: i32,
    pub progress: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TranscriptionJobStatus {
    Pending,
    Processing,
    Completed,
    Failed,
    Cancelled,
}

impl TranscriptionQueueEntry {
    pub fn new(document_id: String, audio_path: String, provider: String, model_id: String, language: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            document_id,
            audio_path,
            provider,
            model_id,
            language,
            status: TranscriptionJobStatus::Pending,
            error_message: None,
            priority: 0,
            created_at: Utc::now(),
            started_at: None,
            completed_at: None,
            retry_count: 0,
            progress: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionQueueEntryWithDoc {
    #[serde(flatten)]
    pub entry: TranscriptionQueueEntry,
    pub document_title: String,
}
