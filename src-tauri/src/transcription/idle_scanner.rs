use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager};
use tokio::time::{Duration, interval};
use crate::database::Repository;
use crate::models::TranscriptionQueueEntry;
use super::auto_queue::AutoTranscriptionQueue;
use super::model_manager::ModelManager;

pub struct IdleScanner {
    running: AtomicBool,
}

impl IdleScanner {
    pub fn new() -> Self {
        Self {
            running: AtomicBool::new(false),
        }
    }

    pub fn start(
        &self,
        app_handle: AppHandle,
        repo: Repository,
        interval_minutes: u64,
    ) {
        if self.running.swap(true, Ordering::SeqCst) {
            return; // Already running
        }

        tokio::spawn(async move {
            let mut ticker = interval(Duration::from_secs(interval_minutes * 60));

            loop {
                ticker.tick().await;

                // Check if auto_queue is idle (no active job)
                let is_active = app_handle.try_state::<super::TranscriptionState>()
                    .map(|s| s.auto_queue.active_job_id().is_some())
                    .unwrap_or(false);

                if is_active {
                    continue; // Already processing
                }

                // Find untranscribed media documents
                let untranscribed = match repo.get_untranscribed_media_documents().await {
                    Ok(docs) => docs,
                    Err(e) => {
                        eprintln!("Idle scanner error querying untranscribed docs: {}", e);
                        continue;
                    }
                };

                if untranscribed.is_empty() {
                    continue;
                }

                // Determine default provider/model
                let provider = "local";
                let model_id = "distil-small.en";
                let language = "en";

                // Check if a model is installed
                let model_manager = match ModelManager::new(&app_handle) {
                    Ok(m) => m,
                    Err(_) => continue,
                };
                let has_model = model_manager.list_profiles().iter().any(|p| p.installed);
                if !has_model {
                    continue;
                }

                let mut enqueued = 0u32;
                for (doc_id, _title, file_path) in untranscribed {
                    let entry = TranscriptionQueueEntry::new(
                        doc_id,
                        file_path,
                        provider.to_string(),
                        model_id.to_string(),
                        language.to_string(),
                    );
                    // Low priority for idle-scanned documents
                    let entry = TranscriptionQueueEntry {
                        priority: -1,
                        ..entry
                    };
                    let state = app_handle.try_state::<super::TranscriptionState>();
                    let enqueued_ok = state.as_ref().map_or(false, |s| s.auto_queue.enqueue(entry).is_ok());
                    if enqueued_ok {
                        enqueued += 1;
                    }
                }

                if enqueued > 0 {
                    eprintln!("Idle scanner enqueued {} documents for transcription", enqueued);
                    let _ = app_handle.emit("transcription://queue-updated", ());
                }
            }
        });
    }
}
