use std::sync::{Arc, Mutex, atomic::{AtomicI32, Ordering}};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::mpsc;
use crate::database::Repository;
use crate::models::{TranscriptionQueueEntry, TranscriptionJobStatus};
use super::engine::{TranscriptionEngine, TranscriptSegment};
use super::model_manager::ModelManager;

enum AutoQueueCommand {
    Enqueue(TranscriptionQueueEntry),
    Process,
    Cancel(String),
    Shutdown,
}

pub struct AutoTranscriptionQueue {
    sender: mpsc::UnboundedSender<AutoQueueCommand>,
    active_job_id: Arc<Mutex<Option<String>>>,
}

impl AutoTranscriptionQueue {
    pub fn new(app_handle: AppHandle, repo: Repository) -> Self {
        let (tx, mut rx) = mpsc::unbounded_channel::<AutoQueueCommand>();
        let active_job_id = Arc::new(Mutex::new(None));
        let active_inner = active_job_id.clone();

        let app = app_handle.clone();
        tokio::spawn(async move {
            // On startup, reset any processing jobs back to pending
            if let Err(e) = repo.reset_processing_transcriptions().await {
                tracing::warn!("Failed to reset processing transcriptions: {}", e);
            }

            loop {
                tokio::select! {
                    Some(cmd) = rx.recv() => {
                        match cmd {
                            AutoQueueCommand::Shutdown => break,
                            AutoQueueCommand::Enqueue(entry) => {
                                if let Err(e) = repo.enqueue_transcription(&entry).await {
                                    tracing::warn!("Failed to enqueue transcription: {}", e);
                                    continue;
                                }
                                if let Err(e) = app.emit("transcription://queue-updated", ()) {
                                    tracing::debug!("Failed to emit queue-updated: {}", e);
                                }
                                if active_inner.lock().expect("auto queue mutex poisoned").is_none() {
                                    if let Err(e) = Self::process_next(&repo, &app, &active_inner).await {
                                        tracing::warn!("Auto-transcription process error: {}", e);
                                    }
                                }
                            }
                            AutoQueueCommand::Process => {
                                if active_inner.lock().expect("auto queue mutex poisoned").is_none() {
                                    if let Err(e) = Self::process_next(&repo, &app, &active_inner).await {
                                        tracing::warn!("Auto-transcription process error: {}", e);
                                    }
                                }
                            }
                            AutoQueueCommand::Cancel(id) => {
                                if let Err(e) = repo.cancel_transcription_job(&id).await {
                                    tracing::warn!("Failed to cancel transcription job: {}", e);
                                }
                                let mut active = active_inner.lock().expect("auto queue mutex poisoned");
                                if let Some(ref active_id) = *active {
                                    if active_id == &id {
                                        *active = None;
                                    }
                                }
                                if let Err(e) = app.emit("transcription://queue-updated", ()) {
                                    tracing::debug!("Failed to emit queue-updated: {}", e);
                                }
                            }
                        }
                    }
                }
            }
        });

        Self {
            sender: tx,
            active_job_id,
        }
    }

    pub fn enqueue(&self, entry: TranscriptionQueueEntry) -> Result<(), String> {
        self.sender.send(AutoQueueCommand::Enqueue(entry))
            .map_err(|e| format!("Failed to enqueue: {}", e))
    }

    pub fn trigger_processing(&self) -> Result<(), String> {
        self.sender.send(AutoQueueCommand::Process)
            .map_err(|e| format!("Failed to trigger processing: {}", e))
    }

    pub fn cancel(&self, id: String) -> Result<(), String> {
        self.sender.send(AutoQueueCommand::Cancel(id))
            .map_err(|e| format!("Failed to cancel: {}", e))
    }

    pub fn active_job_id(&self) -> Option<String> {
        self.active_job_id.lock().expect("auto queue mutex poisoned").clone()
    }

    async fn process_next(
        repo: &Repository,
        app: &AppHandle,
        active_job_id: &Arc<Mutex<Option<String>>>,
    ) -> anyhow::Result<()> {
        let entry = repo.dequeue_next_transcription().await?;

        let entry = match entry {
            Some(e) => e,
            None => return Ok(()),
        };

        repo.update_transcription_status(&entry.id, TranscriptionJobStatus::Processing, None, Some(0)).await?;
        {
            let mut active = active_job_id.lock().expect("auto queue mutex poisoned");
            *active = Some(entry.id.clone());
        }
        if let Err(e) = app.emit("transcription://queue-updated", ()) {
            tracing::debug!("Failed to emit queue-updated: {}", e);
        }

        let result = Self::process_entry(&entry, repo, app).await;

        match result {
            Ok(()) => {
                repo.update_transcription_status(&entry.id, TranscriptionJobStatus::Completed, None, Some(100)).await?;
            }
            Err(e) => {
                let err_str = e.to_string();
                repo.update_transcription_status(&entry.id, TranscriptionJobStatus::Failed, Some(&err_str), None).await?;

                // Retry logic
                let updated = repo.get_transcription_queue_entry(&entry.document_id).await?;
                if let Some(updated_entry) = updated {
                    if updated_entry.retry_count < 3 {
                        repo.reset_transcription_to_pending(&entry.id, updated_entry.retry_count).await?;
                    }
                }
            }
        }

        {
            let mut active = active_job_id.lock().expect("auto queue mutex poisoned");
            *active = None;
        }
        if let Err(e) = app.emit("transcription://queue-updated", ()) {
            tracing::debug!("Failed to emit queue-updated: {}", e);
        }

        Box::pin(Self::process_next(repo, app, active_job_id)).await?;

        Ok(())
    }

    async fn process_entry(
        entry: &TranscriptionQueueEntry,
        repo: &Repository,
        app: &AppHandle,
    ) -> anyhow::Result<()> {
        let engine = TranscriptionEngine::new(app.clone());
        let model_manager = ModelManager::new(app)?;

        let model_path = model_manager.get_model_path(&entry.model_id);
        if !model_path.exists() {
            return Err(anyhow::anyhow!("Whisper model not found: {}", entry.model_id));
        }

        let audio_path = std::path::Path::new(&entry.audio_path);
        if !audio_path.exists() {
            return Err(anyhow::anyhow!("Audio file not found: {}", entry.audio_path));
        }

        // Prepare audio
        let wav_path = engine.prepare_audio(std::path::Path::new(&entry.audio_path)).await?;

        sqlx::query("INSERT OR REPLACE INTO transcripts (book_id, chapter_id, model_used, language, status) VALUES (?, ?, ?, ?, 'processing')")
            .bind(&entry.document_id)
            .bind(&entry.document_id)
            .bind(&entry.model_id)
            .bind(&entry.language)
            .execute(repo.pool())
            .await?;

        // Collect segments
        let segments: Arc<Mutex<Vec<TranscriptSegment>>> = Arc::new(Mutex::new(Vec::new()));
        let segments_clone = segments.clone();
        let repo_clone = repo.clone();
        let entry_id = entry.id.clone();
        let app_clone = app.clone();

        let last_progress: Arc<AtomicI32> = Arc::new(AtomicI32::new(0));
        let progress_entry_id = entry.id.clone();
        let progress_repo = repo.clone();
        let progress_app = app.clone();
        let progress_cb: Box<dyn Fn(i32) + Send + Sync> = Box::new(move |p: i32| {
            let last = last_progress.load(Ordering::Relaxed);
            if p < last + 5 && p < 100 { return; }
            last_progress.store(p, Ordering::Relaxed);
            let repo = progress_repo.clone();
            let id = progress_entry_id.clone();
            let app = progress_app.clone();
            tokio::spawn(async move {
                if let Err(e) = repo.update_transcription_progress(&id, p).await {
                    tracing::warn!("Failed to update transcription progress: {}", e);
                }
                if let Err(e) = app.emit("transcription://queue-updated", ()) {
                    tracing::debug!("Failed to emit queue-updated: {}", e);
                }
            });
        });

        engine.transcribe(&wav_path, &model_path, &entry.language, move |seg| {
            segments_clone.lock().expect("transcription segments mutex poisoned").push(seg.clone());

            let repo = repo_clone.clone();
            let entry_id = entry_id.clone();
            let app = app_clone.clone();
            tokio::spawn(async move {
                let transcript_id: i64 = sqlx::query_scalar("SELECT id FROM transcripts WHERE book_id = ? AND chapter_id = ?")
                    .bind(&entry_id)
                    .bind(&entry_id)
                    .fetch_one(repo.pool())
                    .await
                    .unwrap_or(0);

                if transcript_id > 0 {
                    if let Err(e) = sqlx::query("INSERT INTO transcript_segments (transcript_id, start_ms, end_ms, text, confidence) VALUES (?, ?, ?, ?, ?)")
                        .bind(transcript_id)
                        .bind(seg.start_ms)
                        .bind(seg.end_ms)
                        .bind(&seg.text)
                        .bind(seg.confidence)
                        .execute(repo.pool())
                        .await
                    {
                        tracing::warn!("Failed to insert transcript segment: {}", e);
                    }
                }
                if let Err(e) = app.emit("transcription://segment", &seg) {
                    tracing::debug!("Failed to emit transcription segment: {}", e);
                }
            });
        }, Some(progress_cb)).await?;

        let full_text: String = {
            let all_segments = segments.lock().expect("transcription segments mutex poisoned");
            all_segments.iter()
                .map(|s| s.text.trim())
                .filter(|t| !t.is_empty())
                .collect::<Vec<_>>()
                .join(" ")
        };

        if !full_text.is_empty() {
            sqlx::query("UPDATE documents SET content = ? WHERE id = ?")
                .bind(&full_text)
                .bind(&entry.document_id)
                .execute(repo.pool())
                .await?;
        }

        // Mark transcript as completed
        sqlx::query("UPDATE transcripts SET status = 'completed' WHERE book_id = ? AND chapter_id = ?")
            .bind(&entry.document_id)
            .bind(&entry.document_id)
            .execute(repo.pool())
            .await?;

        // Cleanup WAV (best-effort)
        if let Err(e) = std::fs::remove_file(&wav_path) {
            tracing::debug!("Failed to clean up WAV file {}: {}", wav_path.display(), e);
        }

        Ok(())
    }
}
