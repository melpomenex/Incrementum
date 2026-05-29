use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;
use anyhow::Result;
use tauri::{AppHandle, Manager};
use crate::database::Repository;
use super::engine::{TranscriptionEngine, TranscriptSegment};
use super::model_manager::ModelManager;
use serde::Serialize;
use tauri::Emitter;
use sqlx::Executor;

#[derive(Debug, Clone, Serialize)]
pub struct TranscriptionJob {
    pub book_id: String,
    pub chapter_id: String,
    pub audio_path: String,
    pub model_id: String,
    pub language: String,
}

pub struct JobQueue {
    sender: mpsc::UnboundedSender<TranscriptionJob>,
    active_job: Arc<Mutex<Option<TranscriptionJob>>>,
}

impl JobQueue {
    pub fn new(app_handle: AppHandle, repo: Repository) -> Self {
        let (tx, mut rx) = mpsc::unbounded_channel::<TranscriptionJob>();
        let active_job = Arc::new(Mutex::new(None));
        let active_job_inner = active_job.clone();

        tokio::spawn(async move {
            let engine = TranscriptionEngine::new(app_handle.clone());
            let model_manager = ModelManager::new(&app_handle).expect("failed to create model manager");

            while let Some(job) = rx.recv().await {
                {
                    let mut active = active_job_inner.lock().expect("job queue mutex poisoned");
                    *active = Some(job.clone());
                }

                app_handle.emit("transcription://status-change", &job).expect("event emit failed");

                if let Err(e) = Self::process_job(&job, &engine, &model_manager, &repo, &app_handle).await {
                    eprintln!("Error processing transcription job: {:?}", e);
                    let _ = repo.pool().execute(
                        sqlx::query("UPDATE transcripts SET status = 'failed', error_message = ? WHERE book_id = ? AND chapter_id = ?")
                            .bind(e.to_string())
                            .bind(&job.book_id)
                            .bind(&job.chapter_id)
                    ).await;
                }

                {
                    let mut active = active_job_inner.lock().expect("job queue mutex poisoned");
                    *active = None;
                }
                app_handle.emit("transcription://idle", ()).expect("event emit failed");
            }
        });

        Self {
            sender: tx,
            active_job,
        }
    }

    pub fn enqueue(&self, job: TranscriptionJob) -> Result<()> {
        self.sender.send(job)?;
        Ok(())
    }

    async fn process_job(
        job: &TranscriptionJob,
        engine: &TranscriptionEngine,
        model_manager: &ModelManager,
        repo: &Repository,
        app_handle: &AppHandle,
    ) -> Result<()> {
        // 1. Update status to processing
        sqlx::query("INSERT OR REPLACE INTO transcripts (book_id, chapter_id, model_used, language, status) VALUES (?, ?, ?, ?, 'processing')")
            .bind(&job.book_id)
            .bind(&job.chapter_id)
            .bind(&job.model_id)
            .bind(&job.language)
            .execute(repo.pool())
            .await?;

        // 2. Prepare audio (convert to WAV)
        let wav_path = engine.prepare_audio(std::path::Path::new(&job.audio_path)).await?;

        // 3. Get model path
        let model_path = model_manager.get_model_path(&job.model_id);

        // 4. Transcribe
        let job_clone = job.clone();
        let repo_clone = repo.clone();
        let app_handle_clone = app_handle.clone();

        engine.transcribe(&wav_path, &model_path, &job.language, move |seg| {
            // Store segments in DB incrementally (or batch them)
            // For simplicity, we'll just insert them as they come
            let repo = repo_clone.clone();
            let job = job_clone.clone();
            let app_handle = app_handle_clone.clone();
            
            tokio::spawn(async move {
                let transcript_id: i64 = sqlx::query_scalar("SELECT id FROM transcripts WHERE book_id = ? AND chapter_id = ?")
                    .bind(&job.book_id)
                    .bind(&job.chapter_id)
                    .fetch_one(repo.pool())
                    .await.unwrap_or(0);

                if transcript_id > 0 {
                    let _ = sqlx::query("INSERT INTO transcript_segments (transcript_id, start_ms, end_ms, text, confidence) VALUES (?, ?, ?, ?, ?)")
                        .bind(transcript_id)
                        .bind(seg.start_ms)
                        .bind(seg.end_ms)
                        .bind(&seg.text)
                        .bind(seg.confidence)
                        .execute(repo.pool())
                        .await;
                    
                    app_handle.emit("transcription://segment", seg).expect("event emit failed");
                }
            });
        }, None).await?;

        // 5. Update status to completed
        sqlx::query("UPDATE transcripts SET status = 'completed' WHERE book_id = ? AND chapter_id = ?")
            .bind(&job.book_id)
            .bind(&job.chapter_id)
            .execute(repo.pool())
            .await?;

        // 6. Cleanup WAV
        let _ = std::fs::remove_file(wav_path);

        Ok(())
    }
}
