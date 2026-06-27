//! Podcast subscription commands

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};

use futures_util::StreamExt;
use serde::{Serialize, Deserialize};
use tauri::{AppHandle, Emitter, Manager, State};
use crate::database::Repository;
use crate::error::{IncrementumError, Result};
use crate::models::podcast::{PodcastFeed, PodcastFeedResponse, PodcastEpisode, ParsedPodcastFeed, PodcastSearchResult, PodcastSearchResponse};
use crate::models::document::{Document, FileType};
use crate::models::extract::Extract;
use crate::podcast::parser::parse_podcast_feed;
use crate::transcription::engine::TranscriptionEngine;
use crate::transcription::model_manager::ModelManager;
use crate::transcription::engine::TranscriptSegment;
use chrono::Utc;
use tokio::io::AsyncWriteExt;

/// Subscribe to a podcast feed
#[tauri::command]
pub async fn subscribe_podcast(feed_url: String, repo: State<'_, Repository>) -> Result<PodcastFeedResponse> {
    if let Some(existing) = repo.get_podcast_feed_by_url(&feed_url).await? {
        let episodes = repo.get_podcast_episodes(Some(&existing.id), Some(true)).await?;
        let episode_count = episodes.len() as i64;
        let unplayed_count = episodes.iter().filter(|e| !e.played).count() as i64;
        return Ok(PodcastFeedResponse {
            feed: existing,
            episode_count,
            unplayed_count,
        });
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent("Incrementum/1.31.0")
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| IncrementumError::Internal(format!("Failed to build HTTP client: {}", e)))?;

    let response = client
        .get(&feed_url)
        .send()
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to fetch podcast feed: {}", e)))?;

    if !response.status().is_success() {
        return Err(IncrementumError::Internal(format!(
            "Failed to fetch podcast feed: HTTP {}",
            response.status()
        )));
    }

    let xml = response
        .text()
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to read feed response: {}", e)))?;

    let parsed = parse_podcast_feed(&xml)
        .map_err(|e| IncrementumError::Internal(format!("Failed to parse podcast feed: {}", e)))?;

    let feed_id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let feed = PodcastFeed {
        id: feed_id.clone(),
        title: parsed.title,
        description: parsed.description,
        image_url: parsed.image_url,
        author: parsed.author,
        language: parsed.language,
        link: parsed.link,
        feed_url: feed_url.clone(),
        last_fetched: Some(now.clone()),
        subscribed_at: now,
        sort_order: 0,
        auto_transcribe: false,
        transcribe_language: None,
    };

    // Insert feed into DB
    repo.insert_podcast_feed(&feed).await?;

    repo.insert_podcast_episodes_bulk(&feed_id, &parsed.episodes).await?;

    let episode_count = parsed.episodes.len() as i64;

    Ok(PodcastFeedResponse {
        feed,
        episode_count,
        unplayed_count: episode_count, // All new, so all unplayed
    })
}

/// Rename a podcast feed
#[tauri::command]
pub async fn rename_podcast_feed(feed_id: String, new_title: String, repo: State<'_, Repository>) -> Result<()> {
    repo.rename_podcast_feed(&feed_id, &new_title).await
}

/// Unsubscribe from a podcast feed (CASCADE deletes episodes)
#[tauri::command]
pub async fn unsubscribe_podcast(feed_id: String, repo: State<'_, Repository>) -> Result<()> {
    repo.delete_podcast_feed(&feed_id).await
}

/// Get all subscribed podcast feeds
#[tauri::command]
pub async fn get_podcast_feeds(repo: State<'_, Repository>) -> Result<Vec<PodcastFeedResponse>> {
    let feeds = repo.get_podcast_feeds().await?;
    let mut results = Vec::new();

    for feed in feeds {
        let episode_count = repo.count_podcast_episodes(&feed.id).await?;
        let unplayed_count = repo.count_unplayed_podcast_episodes(&feed.id).await?;
        results.push(PodcastFeedResponse {
            feed,
            episode_count,
            unplayed_count,
        });
    }

    Ok(results)
}

/// Refresh a podcast feed (refetch RSS, upsert new episodes).
/// If the feed has `auto_transcribe = true`, background transcription is spawned
/// for up to 3 untranscribed episodes after the refresh completes.
#[tauri::command]
pub async fn refresh_podcast_feed(
    feed_id: String,
    app_handle: AppHandle,
    repo: State<'_, Repository>,
    tokens: State<'_, PodcastTranscriptionTokens>,
) -> Result<PodcastFeedResponse> {
    let feed = repo
        .get_podcast_feed(&feed_id)
        .await?
        .ok_or_else(|| IncrementumError::NotFound(format!("Podcast feed {}", feed_id)))?;

    let feed_url = feed.feed_url.clone();

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent("Incrementum/1.31.0")
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| IncrementumError::Internal(format!("Failed to build HTTP client: {}", e)))?;

    let response = client
        .get(&feed_url)
        .send()
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to fetch podcast feed: {}", e)))?;

    if !response.status().is_success() {
        return Err(IncrementumError::Internal(format!(
            "Failed to fetch podcast feed: HTTP {}",
            response.status()
        )));
    }

    let xml = response
        .text()
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to read feed response: {}", e)))?;

    let parsed = parse_podcast_feed(&xml)
        .map_err(|e| IncrementumError::Internal(format!("Failed to parse podcast feed: {}", e)))?;

    let mut updated_feed = feed.clone();
    updated_feed.title = parsed.title;
    updated_feed.description = parsed.description;
    if parsed.image_url.is_some() {
        updated_feed.image_url = parsed.image_url;
    }
    if parsed.author.is_some() {
        updated_feed.author = parsed.author;
    }
    let now = Utc::now().to_rfc3339();
    updated_feed.last_fetched = Some(now.clone());

    repo.update_podcast_feed_metadata(&updated_feed).await?;
    repo.update_podcast_feed_last_fetched(&feed_id, &now).await?;

    // Upsert episodes (INSERT OR IGNORE preserves existing played/position)
    repo.insert_podcast_episodes_bulk(&feed_id, &parsed.episodes).await?;

    let episode_count = repo.count_podcast_episodes(&feed_id).await?;
    let unplayed_count = repo.count_unplayed_podcast_episodes(&feed_id).await?;

    let response = PodcastFeedResponse {
        feed: updated_feed.clone(),
        episode_count,
        unplayed_count,
    };

    // ── Auto-transcribe background job ──────────────────────────────────
    if updated_feed.auto_transcribe {
        let bg_repo = repo.inner().clone();
        let bg_tokens = tokens.inner().clone();
        let bg_app = app_handle.clone();
        let bg_feed_id = feed_id.clone();
        let bg_language = updated_feed.transcribe_language.clone();

        tokio::spawn(async move {
            match bg_repo.get_untranscribed_episodes(&bg_feed_id).await {
                Ok(episodes) => {
                    for ep in episodes.into_iter().take(3) {
                        let repo = bg_repo.clone();
                        let tokens = bg_tokens.clone();
                        let app = bg_app.clone();
                        let lang = bg_language.clone();
                        let ep_id = ep.id.clone();

                        tokio::spawn(async move {
                            // Background best-effort — errors are logged, not propagated
                            if let Err(e) = run_transcription_job(
                                ep_id,
                                None,
                                lang,
                                None,
                                app,
                                repo,
                                tokens,
                            ).await {
                                eprintln!("[auto-transcribe] Transcription failed: {}", e);
                            }
                        });
                    }
                }
                Err(e) => {
                    eprintln!("[auto-transcribe] Failed to query untranscribed episodes: {}", e);
                }
            }
        });
    }

    Ok(response)
}

/// Get episodes for a podcast feed, or all episodes if feed_id is None
#[tauri::command]
pub async fn get_podcast_episodes(
    feed_id: Option<String>,
    include_played: Option<bool>,
    repo: State<'_, Repository>,
) -> Result<Vec<PodcastEpisode>> {
    repo.get_podcast_episodes(feed_id.as_deref(), include_played).await
}

/// Mark an episode as played or unplayed
#[tauri::command]
pub async fn mark_episode_played(
    episode_id: String,
    played: bool,
    repo: State<'_, Repository>,
) -> Result<()> {
    repo.update_episode_played(&episode_id, played).await
}

/// Update the playback position of an episode
#[tauri::command]
pub async fn update_episode_position(
    episode_id: String,
    position: f64,
    repo: State<'_, Repository>,
) -> Result<()> {
    repo.update_episode_position(&episode_id, position).await
}

/// Get the playback position of an episode
#[tauri::command]
pub async fn get_episode_position(
    episode_id: String,
    repo: State<'_, Repository>,
) -> Result<f64> {
    repo.get_episode_position(&episode_id).await
}

// ── Podcast transcription ──────────────────────────────────────────────────

/// Managed state for podcast transcription cancellation tokens
pub type PodcastTranscriptionTokens = Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>;

#[derive(Debug, Serialize, Deserialize)]
pub struct PodcastTranscriptResponse {
    pub text: String,
    pub segments: Vec<TranscriptSegmentInfo>,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TranscriptSegmentInfo {
    pub start_ms: i64,
    pub end_ms: i64,
    pub text: String,
    /// Optional per-word timings as JSON: `[{"word":"...", "start_ms":..., "end_ms":...}, ...]`
    /// Present when the transcript was produced via Groq word-level transcription.
    /// Enables word-by-word (karaoke) highlighting synced to audio playback.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub word_timings_json: Option<String>,
}

/// Transcribe a podcast episode using Whisper
#[tauri::command]
pub async fn transcribe_podcast_episode(
    episode_id: String,
    model: Option<String>,
    language: Option<String>,
    auto_segment: Option<bool>,
    app_handle: AppHandle,
    repo: State<'_, Repository>,
    tokens: State<'_, PodcastTranscriptionTokens>,
) -> Result<()> {
    run_transcription_job(
        episode_id,
        model,
        language,
        auto_segment,
        app_handle,
        repo.inner().clone(),
        tokens.inner().clone(),
    )
    .await
}

/// Shared transcription logic used by both manual invocation and auto-transcribe.
/// Downloads audio, runs Whisper, stores transcript, creates Document + Extract records.
async fn run_transcription_job(
    episode_id: String,
    model: Option<String>,
    language: Option<String>,
    auto_segment: Option<bool>,
    app_handle: AppHandle,
    repo: Repository,
    tokens: PodcastTranscriptionTokens,
) -> Result<()> {
    // 1. Get episode
    let episode = repo
        .get_podcast_episode_by_id(&episode_id)
        .await?
        .ok_or_else(|| IncrementumError::NotFound(format!("Podcast episode {}", episode_id)))?;

    let audio_url = episode.audio_url.clone();
    let model_id = model.unwrap_or_else(|| "base".to_string());
    let lang = language.unwrap_or_else(|| "auto".to_string());

    // 2. Set status to downloading
    repo.update_episode_transcript_status(&episode_id, "downloading", None, None).await?;

    let _ = app_handle.emit(
        "podcast://transcription-progress",
        serde_json::json!({
            "episodeId": &episode_id,
            "status": "downloading",
            "progress": 0
        }),
    );

    // 3. Download audio to temp file
    let temp_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| IncrementumError::Internal(e.to_string()))?
        .join("temp_transcription");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| IncrementumError::Internal(format!("Failed to create temp dir: {}", e)))?;

    let ext = episode
        .audio_type
        .as_deref()
        .and_then(|t| t.split('/').last())
        .unwrap_or("mp3");
    let temp_file = temp_dir.join(format!("{}_episode.{}", episode_id, ext));

    // Insert cancellation token
    let cancel_token = Arc::new(AtomicBool::new(false));
    {
        let mut map = tokens.lock().expect("podcast tokens mutex poisoned");
        map.insert(episode_id.clone(), cancel_token.clone());
    }

    // Cleanup token when done (success or error)
    let cleanup = |tokens: &PodcastTranscriptionTokens, id: &str| {
        if let Ok(mut map) = tokens.lock() {
            map.remove(id);
        }
    };

    // Download with streaming progress
    let download_result: std::result::Result<(), IncrementumError> = async {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(300))
            .build()
            .map_err(|e| IncrementumError::Internal(format!("HTTP client error: {}", e)))?;

        let response = client
            .get(&audio_url)
            .send()
            .await
            .map_err(|e| IncrementumError::Internal(format!("Download failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(IncrementumError::Internal(format!(
                "Download failed: HTTP {}",
                response.status()
            )));
        }

        let total_size = response.content_length().unwrap_or(0);
        let mut downloaded: u64 = 0;
        let mut file = tokio::fs::File::create(&temp_file)
            .await
            .map_err(|e| IncrementumError::Internal(format!("Failed to create temp file: {}", e)))?;

        let mut stream = response.bytes_stream();
        while let Some(item) = stream.next().await {
            if cancel_token.load(Ordering::Relaxed) {
                return Err(IncrementumError::Internal("Transcription cancelled".to_string()));
            }
            let chunk = item
                .map_err(|e| IncrementumError::Internal(format!("Download stream error: {}", e)))?;
            file.write_all(&chunk)
                .await
                .map_err(|e| IncrementumError::Internal(format!("Write error: {}", e)))?;
            downloaded += chunk.len() as u64;

            if total_size > 0 {
                let download_pct = (downloaded as f64 / total_size as f64) * 30.0;
                let _ = app_handle.emit(
                    "podcast://transcription-progress",
                    serde_json::json!({
                        "episodeId": &episode_id,
                        "status": "downloading",
                        "progress": download_pct as i32
                    }),
                );
            }
        }
        file.flush()
            .await
            .map_err(|e| IncrementumError::Internal(format!("Flush error: {}", e)))?;
        Ok(())
    }
    .await;

    if let Err(e) = download_result {
        let _ = std::fs::remove_file(&temp_file);
        repo.update_episode_transcript_status(&episode_id, "error", Some(&e.to_string()), None)
            .await?;
        cleanup(&tokens, &episode_id);
        return Err(e);
    }

    // 5. Set status to transcribing
    repo.update_episode_transcript_status(&episode_id, "transcribing", None, None).await?;
    let _ = app_handle.emit(
        "podcast://transcription-progress",
        serde_json::json!({
            "episodeId": &episode_id,
            "status": "transcribing",
            "progress": 30
        }),
    );

    // 6. Prepare + transcribe using TranscriptionEngine
    let model_manager = ModelManager::new(&app_handle)
        .map_err(|e| IncrementumError::Internal(e.to_string()))?;

    let mut selected_model = model_id;
    if !model_manager.is_model_installed(&selected_model) {
        if let Some(fallback) = model_manager
            .list_profiles()
            .into_iter()
            .find(|p| model_manager.is_model_installed(&p.id))
        {
            selected_model = fallback.id;
        } else {
            let _ = std::fs::remove_file(&temp_file);
            repo.update_episode_transcript_status(
                &episode_id,
                "error",
                Some("No Whisper model installed. Download one in Settings > Audio Transcription."),
                None,
            ).await?;
            cleanup(&tokens, &episode_id);
            return Err(IncrementumError::InvalidInput(
                "No Whisper model installed.".to_string(),
            ));
        }
    }

    let engine = TranscriptionEngine::new(app_handle.clone());
    let segments: Arc<Mutex<Vec<TranscriptSegment>>> = Arc::new(Mutex::new(Vec::new()));
    let segments_clone = segments.clone();
    let cancel_clone = cancel_token.clone();
    let app_clone = app_handle.clone();
    let ep_id = episode_id.clone();

    if cancel_token.load(Ordering::Relaxed) {
        let _ = std::fs::remove_file(&temp_file);
        repo.update_episode_transcript_status(&episode_id, "error", Some("Cancelled"), None)
            .await?;
        cleanup(&tokens, &episode_id);
        return Err(IncrementumError::Internal("Transcription cancelled".to_string()));
    }

    let transcribe_result = async {
        let prepared = engine
            .prepare_audio(Path::new(&temp_file))
            .await
            .map_err(|e| IncrementumError::Internal(format!("Audio preparation failed: {}", e)))?;

        let model_path = model_manager.get_model_path(&selected_model);
        // Route to the right engine based on the model family. Sherpa-onnx models
        // (parakeet-*, sense-voice-*) run via the sherpa-onnx sidecar; everything
        // else is a Whisper (ggml) model.
        let is_parakeet = selected_model.starts_with("parakeet-");
        let is_sense_voice = selected_model.starts_with("sense-voice-");

        let cancel_post = cancel_clone.clone();
        if is_sense_voice {
            engine.transcribe_sensevoice(
                &prepared,
                &model_path,
                &lang,
                move |seg| {
                    if cancel_clone.load(Ordering::Relaxed) {
                        return;
                    }
                    if let Ok(mut guard) = segments_clone.lock() {
                        guard.push(seg);
                    }
                },
                Some(Box::new(move |p: i32| {
                    let mapped = 30 + ((p as f64 / 100.0) * 70.0) as i32;
                    let _ = app_clone.emit(
                        "podcast://transcription-progress",
                        serde_json::json!({
                            "episodeId": &ep_id,
                            "status": "transcribing",
                            "progress": mapped
                        }),
                    );
                })),
            )
            .await
            .map_err(|e| IncrementumError::Internal(format!("Transcription failed: {}", e)))?;
        } else if is_parakeet {
            engine.transcribe_parakeet(
                &prepared,
                &model_path,
                &lang,
                move |seg| {
                    if cancel_clone.load(Ordering::Relaxed) {
                        return;
                    }
                    if let Ok(mut guard) = segments_clone.lock() {
                        guard.push(seg);
                    }
                },
                Some(Box::new(move |p: i32| {
                    let mapped = 30 + ((p as f64 / 100.0) * 70.0) as i32;
                    let _ = app_clone.emit(
                        "podcast://transcription-progress",
                        serde_json::json!({
                            "episodeId": &ep_id,
                            "status": "transcribing",
                            "progress": mapped
                        }),
                    );
                })),
            )
            .await
            .map_err(|e| IncrementumError::Internal(format!("Transcription failed: {}", e)))?;
        } else {
            engine
                .transcribe(
                    &prepared,
                    &model_path,
                    &lang,
                    move |seg| {
                        if cancel_clone.load(Ordering::Relaxed) {
                            return;
                        }
                        if let Ok(mut guard) = segments_clone.lock() {
                            guard.push(seg);
                        }
                    },
                    Some(Box::new(move |p: i32| {
                        let mapped = 30 + ((p as f64 / 100.0) * 70.0) as i32;
                        let _ = app_clone.emit(
                            "podcast://transcription-progress",
                            serde_json::json!({
                                "episodeId": &ep_id,
                                "status": "transcribing",
                                "progress": mapped
                            }),
                        );
                    })),
                )
                .await
                .map_err(|e| IncrementumError::Internal(format!("Transcription failed: {}", e)))?;
        }

        if cancel_post.load(Ordering::Relaxed) {
            return Err(IncrementumError::Internal("Transcription cancelled".to_string()));
        }

        Ok::<(), IncrementumError>(())
    }
    .await;

    let _ = std::fs::remove_file(&temp_file);

    if let Err(e) = transcribe_result {
        repo.update_episode_transcript_status(&episode_id, "error", Some(&e.to_string()), None)
            .await?;
        cleanup(&tokens, &episode_id);
        return Err(e);
    }

    // 8. Concatenate segments into full transcript text
    let mut segments_vec = {
        let mut guard = segments.lock().unwrap_or_else(|e| e.into_inner());
        guard.sort_by(|a, b| a.start_ms.cmp(&b.start_ms));
        guard.clone()
    };

    let full_text: String = segments_vec
        .iter()
        .map(|s| s.text.trim())
        .collect::<Vec<&str>>()
        .join(" ");

    // 9. Store transcript in DB (the text blob for backward-compat search)
    repo.update_episode_transcript_status(&episode_id, "done", None, Some(&full_text))
        .await?;

    // 9b. Persist the real per-segment start_ms/end_ms timings so the viewer can
    //     sync highlighting to playback. (Local Whisper is segment-level only;
    //     word_timings_by_segment is all None here. Groq word-level timings are
    //     persisted via the separate save_podcast_transcript_segments path.)
    let word_timings_none: Vec<Option<String>> = segments_vec.iter().map(|_| None).collect();
    if let Err(e) = repo
        .save_podcast_transcript_segments(&episode_id, &segments_vec, &word_timings_none)
        .await
    {
        eprintln!("[transcription] Failed to persist podcast segment timings for {}: {}", episode_id, e);
        // Non-fatal — the transcript blob is already stored.
    }

    // 10. Create Document + Extract records from transcript
    if let Err(e) = create_transcript_extracts(&repo, &episode, &full_text, auto_segment.unwrap_or(false)).await {
        eprintln!("[transcription] Failed to create transcript extracts for {}: {}", episode_id, e);
        // Non-fatal — transcript itself is still stored
    }

    // 11. Emit completion
    let _ = app_handle.emit(
        "podcast://transcription-complete",
        serde_json::json!({
            "episodeId": &episode_id,
            "segmentCount": segments_vec.len(),
            "duration": episode.duration
        }),
    );

    cleanup(&tokens, &episode_id);
    Ok(())
}

// ── Transcript → Extract generation ────────────────────────────────────────

/// Create a Document and Extract records from a completed transcript so the
/// content is reviewable in the Incrementum extract system.
async fn create_transcript_extracts(
    repo: &Repository,
    episode: &PodcastEpisode,
    full_text: &str,
    auto_segment: bool,
) -> Result<()> {
    let text = full_text.trim();
    if text.is_empty() {
        return Ok(());
    }

    let doc_title = format!("{} (Transcript)", episode.title);
    let mut doc = Document::new(doc_title, format!("podcast://{}", episode.id), FileType::Other);
    doc.content = Some(text.to_string());
    doc.tags = vec!["podcast".to_string(), "transcript".to_string()];
    doc.is_favorite = false;
    let doc = repo.create_document(&doc).await?;

    if auto_segment {
        // Split transcript into chunks for Extract records.
        // Target ~1500 chars per chunk, breaking at sentence boundaries.
        let chunks = split_transcript_into_chunks(text, 1500);

        for chunk in &chunks {
            let mut extract = Extract::new(doc.id.clone(), chunk.clone());
            extract.tags = vec!["podcast".to_string(), "transcript".to_string()];
            extract.category = Some("podcast".to_string());
            extract.source_url = Some(format!("podcast://{}", episode.id));
            repo.create_extract(&extract).await?;
        }
    }

    Ok(())
}

/// Split text into chunks of roughly `target_len` characters at sentence boundaries.
fn split_transcript_into_chunks(text: &str, target_len: usize) -> Vec<String> {
    let sentences: Vec<&str> = text
        .split(|c: char| c == '.' || c == '!' || c == '?' || c == '\n')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();

    if sentences.is_empty() {
        return vec![];
    }

    let mut chunks = Vec::new();
    let mut current = String::new();

    for sentence in sentences {
        // Add separator if not the first sentence in the chunk
        if !current.is_empty() {
            if current.len() + sentence.len() + 2 > target_len && !current.is_empty() {
                chunks.push(std::mem::take(&mut current));
            } else {
                current.push(' ');
            }
        }
        current.push_str(sentence);
    }

    if !current.is_empty() {
        chunks.push(current);
    }

    chunks
}

/// Get the transcript for a podcast episode
#[tauri::command]
pub async fn get_podcast_transcript(
    episode_id: String,
    repo: State<'_, Repository>,
) -> Result<PodcastTranscriptResponse> {
    let episode = repo
        .get_podcast_episode_by_id(&episode_id)
        .await?
        .ok_or_else(|| IncrementumError::NotFound(format!("Podcast episode {}", episode_id)))?;

    let status = episode.transcript_status.clone();
    let text = episode.transcript_text.unwrap_or_default();

    if text.is_empty() {
        return Ok(PodcastTranscriptResponse {
            text,
            segments: Vec::new(),
            status,
        });
    }

    // Prefer real per-segment timings (with optional per-word timings) persisted
    // by transcription. These enable audio-synced highlighting and, when Groq
    // word-level transcription was used, word-by-word (karaoke) highlighting.
    // Fall back to the single-blob segment (old behavior) only when no real
    // segments are stored, so existing transcripts keep working.
    match repo.get_podcast_transcript_segments_with_words(&episode_id).await {
        Ok(stored) if !stored.is_empty() => {
            return Ok(PodcastTranscriptResponse {
                text,
                segments: stored,
                status,
            });
        }
        _ => {}
    }

    let segments = vec![TranscriptSegmentInfo {
        start_ms: 0,
        end_ms: episode.duration.unwrap_or(0) * 1000,
        text: text.clone(),
        word_timings_json: None,
    }];

    Ok(PodcastTranscriptResponse {
        text,
        segments,
        status,
    })
}

/// Payload for a single segment when persisting Groq transcription results.
/// `word_timings_json` is optional (present for Groq word-level transcription,
/// enabling karaoke highlighting; absent for segment-only).
#[derive(Debug, Deserialize)]
pub struct SaveSegmentInput {
    pub start_ms: i64,
    pub end_ms: i64,
    pub text: String,
    pub word_timings_json: Option<String>,
}

/// Resolve a podcast audio URL through its redirect chain to the final media
/// URL. Many podcast feeds wrap the real audio in tracking-redirect chains
/// (podtrac → pdst → chrt → mgln → megaphone, etc., often 5-8 hops). Groq's
/// transcription API does NOT follow redirects on its `url` parameter — it
/// fetches exactly one hop and fails with "received status code: 302". So the
/// mobile Groq transcription path resolves the chain here (reqwest follows up
/// to 10 redirects) and passes the final 200-OK URL to Groq.
#[tauri::command]
pub async fn resolve_podcast_audio_url(url: String) -> Result<String> {
    let client = reqwest::Client::builder()
        // Mirror a browser-ish UA so CDN edge nodes don't block the HEAD.
        .user_agent("Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Incrementum")
        .build()
        .map_err(|e| IncrementumError::Internal(format!("Failed to build HTTP client: {}", e)))?;
    // Use GET (not HEAD): some podcast CDNs respond 405/404 to HEAD but 200 to
    // a range GET. We request 0 bytes via Range so we don't download the file —
    // we only need the final URL after redirects.
    let resp = client
        .get(&url)
        .header("Range", "bytes=0-0")
        .send()
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to resolve audio URL: {}", e)))?;
    Ok(resp.url().to_string())
}

/// An audio chunk produced by the mobile splitter (ffmpeg-free). Mirrors the
/// desktop `AudioChunk` shape so the frontend chunked-transcription path is
/// shared, but the offset is in MILLISECONDS (mobile path works in ms) and the
/// path points at a temp file written by this command.
#[derive(Debug, serde::Serialize, Clone)]
pub struct MobileAudioChunk {
    pub index: usize,
    pub path: String,
    /// Approximate start time of this chunk within the original audio, in ms.
    /// Estimated from byte offset ÷ bitrate; the final per-segment timestamps
    /// come from Groq, this is just for assembling chunked results in order.
    pub start_ms: i64,
    pub end_ms: i64,
    pub bytes: u64,
}

/// Target chunk size for the mobile splitter. Groq's free-tier limit is 25 MB;
/// we target 20 MB to stay safely under and leave room for the multipart upload
/// overhead. Podcast MP3s are typically 64-128 kbps, so 20 MB ≈ 20-40 min/chunk.
const MOBILE_CHUNK_TARGET: u64 = 20 * 1024 * 1024;

/// Split a remote podcast audio file into <25 MB chunks on-device WITHOUT ffmpeg
/// (ffmpeg isn't available on Android). The audio is downloaded in full to a temp
/// file, then split on **MP3 frame boundaries** (the 11-bit sync word 0x7FF) so
/// each chunk is independently decodable by Groq. For non-MP3 formats (M4A/MP4)
/// we fall back to raw byte-range chunks — less clean at arbitrary boundaries,
/// but Groq's Whisper decoder is tolerant, and the vast majority of podcasts are
/// MP3. Each chunk's start_ms is estimated from byte offset ÷ bitrate (parsed
/// from the first MP3 frame header). This is what makes full-episode (40-100MB)
/// podcast transcription work on mobile within Groq's 25 MB limit.
#[tauri::command]
pub async fn split_audio_for_groq_mobile(
    app_handle: AppHandle,
    url: String,
) -> Result<Vec<MobileAudioChunk>> {
    use futures_util::StreamExt;
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Incrementum")
        .build()
        .map_err(|e| IncrementumError::Internal(format!("Failed to build HTTP client: {}", e)))?;

    // 1. Stream-download the full audio to a temp file (follows redirects).
    let cache_dir = app_handle
        .path()
        .app_cache_dir()
        .map_err(|e| IncrementumError::Internal(format!("Failed to resolve cache dir: {}", e)))?;
    let chunks_dir = cache_dir.join("groq_mobile_chunks");
    let _ = std::fs::remove_dir_all(&chunks_dir);
    std::fs::create_dir_all(&chunks_dir)?;

    let full_path = chunks_dir.join("source.bin");
    let mut file = tokio::fs::File::create(&full_path)
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to create temp file: {}", e)))?;

    let resp = client.get(&url).send().await
        .map_err(|e| IncrementumError::Internal(format!("Failed to download audio: {}", e)))?;
    if !resp.status().is_success() {
        return Err(IncrementumError::Internal(format!(
            "Audio download failed: HTTP {}", resp.status()
        )));
    }
    // Detect format from Content-Type / URL extension to pick the split strategy.
    let content_type = resp.headers().get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_ascii_lowercase();
    let is_mp3 = content_type.contains("mpeg") || content_type.contains("mp3")
        || url.to_ascii_lowercase().ends_with(".mp3");

    let mut stream = resp.bytes_stream();
    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| IncrementumError::Internal(format!("Download stream error: {}", e)))?;
        file.write_all(&chunk).await
            .map_err(|e| IncrementumError::Internal(format!("Failed to write temp file: {}", e)))?;
    }
    file.flush().await?;
    drop(file);

    // 2. Read the downloaded bytes.
    let data = std::fs::read(&full_path)
        .map_err(|e| IncrementumError::Internal(format!("Failed to read temp file: {}", e)))?;
    let total = data.len() as u64;

    // 3. Parse the bitrate from the first valid MP3 frame header (for start_ms
    //    estimation). If we can't find a frame or it's not MP3, fall back to raw
    //    byte splitting with a nominal 128kbps assumption.
    let bitrate_bps: u64 = if is_mp3 {
        find_mp3_frame_bitrate(&data).unwrap_or(128_000)
    } else {
        128_000
    };

    // 4. Compute split boundaries. For MP3, advance to MOBILE_CHUNK_TARGET then
    //    scan forward for the next frame sync so the chunk starts cleanly. For
    //    non-MP3, split at raw byte boundaries.
    let mut boundaries: Vec<u64> = vec![0];
    let mut cursor: u64 = MOBILE_CHUNK_TARGET;
    while cursor < total {
        let boundary = if is_mp3 {
            find_next_mp3_frame(&data, cursor).unwrap_or(cursor)
        } else {
            cursor
        };
        boundaries.push(boundary.min(total));
        cursor = boundary + MOBILE_CHUNK_TARGET;
    }
    if *boundaries.last().unwrap() < total {
        boundaries.push(total);
    }

    // 5. Write each chunk to its own file and record its byte range + est. start_ms.
    let mut chunks_out = Vec::new();
    for i in 0..boundaries.len().saturating_sub(1) {
        let start_byte = boundaries[i];
        let end_byte = boundaries[i + 1];
        let chunk_bytes = &data[start_byte as usize..end_byte as usize];
        let chunk_path = chunks_dir.join(format!("chunk_{:04}.mp3", i));
        std::fs::write(&chunk_path, chunk_bytes)
            .map_err(|e| IncrementumError::Internal(format!("Failed to write chunk {}: {}", i, e)))?;
        let start_ms = (start_byte * 8000 / bitrate_bps.max(1)) as i64;
        let end_ms = (end_byte * 8000 / bitrate_bps.max(1)) as i64;
        chunks_out.push(MobileAudioChunk {
            index: i,
            path: chunk_path.to_string_lossy().to_string(),
            start_ms,
            end_ms,
            bytes: (end_byte - start_byte),
        });
    }

    // Remove the full source file; chunk files remain for upload + later cleanup.
    let _ = std::fs::remove_file(&full_path);

    if chunks_out.is_empty() {
        return Err(IncrementumError::Internal(
            "Audio split produced no chunks (empty download?)".to_string(),
        ));
    }
    Ok(chunks_out)
}

/// Scan `data` for the first valid MP3 frame header and return its bitrate in
/// bits/sec. MP3 frame headers start with an 11-bit sync word (0x7FF): the first
/// byte is 0xFF and the upper 3 bits of the second byte are all 1. We then read
/// the 4-bit bitrate index from the frame header using the MPEG1 Layer III
/// bitrate table. Returns None if no valid frame is found (non-MP3 data).
fn find_mp3_frame_bitrate(data: &[u8]) -> Option<u64> {
    // MPEG1 Layer III bitrate table (kbps), indexed by the 4-bit bitrate field.
    const BITRATES: [u64; 16] = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
    let n = data.len().saturating_sub(4);
    for i in 0..n {
        if data[i] != 0xFF {
            continue;
        }
        let b = data[i + 1];
        // 11-bit sync: 0xFF followed by upper-3-bits set (0xE0 mask). Also
        // require Layer III (bits 2-1 == 01, i.e. (b >> 1) & 0x3 == 0x1).
        if (b & 0xE0) != 0xE0 {
            continue;
        }
        let layer = (b >> 1) & 0x3;
        if layer != 0x1 {
            // Layer III encoded as 01 in the header bits.
            continue;
        }
        // Bitrate index is the high nibble of byte 2.
        let bitrate_index = ((data[i + 2] >> 4) & 0xF) as usize;
        let kbps = BITRATES[bitrate_index];
        if kbps > 0 {
            return Some(kbps * 1000);
        }
    }
    None
}

/// From `min_byte`, scan forward (up to a small window) for the next MP3 frame
/// sync (0xFF then upper-3-bits 0xE0). Returns the byte offset of that frame, or
/// None if no frame is found within the window (caller falls back to raw split).
fn find_next_mp3_frame(data: &[u8], min_byte: u64) -> Option<u64> {
    let start = (min_byte as usize).min(data.len().saturating_sub(2));
    // Search window: ~256 KB. A frame at 128kbps is ~0.5-1.5KB, so 256KB is
    // hundreds of frames — plenty to find a clean boundary. If none, the file is
    // likely not actually MP3 despite the extension; fall back.
    let end = (start + 256 * 1024).min(data.len().saturating_sub(1));
    let mut i = start;
    while i < end {
        if data[i] == 0xFF && i + 1 < data.len() && (data[i + 1] & 0xE0) == 0xE0 {
            return Some(i as u64);
        }
        i += 1;
    }
    None
}

#[cfg(test)]
mod mp3_tests {
    use super::*;

    /// Build a synthetic MP3-like byte stream: a valid frame header (0xFF 0xFB =
    /// MPEG1 Layer III, no CRC) followed by `payload_len` padding bytes, repeated
    /// `frame_count` times. The bitrate nibble is set to index 9 (128 kbps).
    fn synthetic_mp3(frame_count: usize, payload_len: usize) -> Vec<u8> {
        let mut out = Vec::new();
        for _ in 0..frame_count {
            out.push(0xFF);
            out.push(0xFB); // sync + MPEG1 Layer III
            // Byte 2 high nibble = bitrate index 9 (128kbps) → 0x90; low nibble
            // can be anything valid; use 0x00.
            out.push(0x90);
            out.push(0x00);
            out.extend(std::iter::repeat(0u8).take(payload_len));
        }
        out
    }

    #[test]
    fn finds_bitrate_from_first_mp3_frame() {
        let data = synthetic_mp3(3, 100);
        assert_eq!(find_mp3_frame_bitrate(&data), Some(128_000));
    }

    #[test]
    fn bitrate_none_for_non_mp3_data() {
        // No 0xFF sync byte → not MP3.
        let data = vec![0x00u8; 2048];
        assert_eq!(find_mp3_frame_bitrate(&data), None);
    }

    #[test]
    fn finds_next_frame_after_a_byte_offset() {
        // Two frames of 104 bytes each (4 header + 100 payload).
        let data = synthetic_mp3(3, 100);
        // Look for a frame starting somewhere in the middle of frame 0's payload
        // — should find the start of frame 1.
        let next = find_next_mp3_frame(&data, 50);
        assert_eq!(next, Some(104), "should land on the next frame boundary");
    }

    #[test]
    fn find_next_frame_returns_none_if_no_sync_in_window() {
        let data = vec![0x00u8; 2048]; // no sync bytes at all
        assert_eq!(find_next_mp3_frame(&data, 0), None);
    }

    #[test]
    fn bitrate_ignores_false_sync_followed_by_non_layer3() {
        // 0xFF 0xF0 has the sync bits but layer bits 00 (reserved), not Layer III.
        let mut data = vec![0xFF, 0xF0];
        data.extend(std::iter::repeat(0u8).take(100));
        // A real Layer III frame later in the stream should still be found.
        data.push(0xFF);
        data.push(0xFB);
        data.push(0x90);
        data.push(0x00);
        // Trailing padding so the real frame is within the scanner's bound
        // (find_mp3_frame_bitrate loops i in 0..len-4, so the real frame at the
        // tail needs ≥4 bytes after it to be examined).
        data.extend(std::iter::repeat(0u8).take(10));
        assert_eq!(find_mp3_frame_bitrate(&data), Some(128_000));
    }
}

/// Clean up temp chunk files created by split_audio_for_groq_mobile after the
/// transcription uploads are done (success or failure).
#[tauri::command]
pub async fn cleanup_mobile_audio_chunks(app_handle: AppHandle) -> Result<()> {
    if let Ok(cache_dir) = app_handle.path().app_cache_dir() {
        let _ = std::fs::remove_dir_all(cache_dir.join("groq_mobile_chunks"));
    }
    Ok(())
}



/// Persist per-segment (and optional per-word) timings produced by Groq cloud
/// transcription. Used by the mobile/Groq transcription path, which runs the
/// transcription in the frontend (plain HTTP) and sends the results here for
/// storage — Groq fetches the audio URL directly, so no FFmpeg/sidecar needed.
/// Also stores the concatenated full text on the episode row for search/back-compat.
#[tauri::command]
pub async fn save_podcast_transcript_segments(
    episode_id: String,
    segments: Vec<SaveSegmentInput>,
    repo: State<'_, Repository>,
) -> Result<()> {
    if segments.is_empty() {
        return Ok(());
    }
    let full_text = segments
        .iter()
        .map(|s| s.text.trim())
        .collect::<Vec<&str>>()
        .join(" ");

    // Store the text blob (back-compat / search) + mark status done.
    repo.update_episode_transcript_status(&episode_id, "done", None, Some(&full_text))
        .await?;

    // Persist real per-segment timings + per-word timings.
    let seg_models: Vec<TranscriptSegment> = segments
        .iter()
        .map(|s| TranscriptSegment {
            start_ms: s.start_ms,
            end_ms: s.end_ms,
            text: s.text.clone(),
            confidence: 1.0,
        })
        .collect();
    let word_timings: Vec<Option<String>> = segments
        .iter()
        .map(|s| s.word_timings_json.clone())
        .collect();
    repo.save_podcast_transcript_segments(&episode_id, &seg_models, &word_timings)
        .await?;
    Ok(())
}

#[tauri::command]
pub async fn cancel_podcast_transcription(
    episode_id: String,
    tokens: State<'_, PodcastTranscriptionTokens>,
) -> Result<()> {
    let map = tokens.lock().expect("podcast tokens mutex poisoned");
    if let Some(token) = map.get(&episode_id) {
        token.store(true, Ordering::Relaxed);
        Ok(())
    } else {
        Err(IncrementumError::NotFound(format!(
            "No active transcription for episode {}",
            episode_id
        )))
    }
}

/// Import a podcast episode as a document in the incremental reading system
#[tauri::command]
pub async fn import_podcast_episode_as_document(
    episode_id: String,
    collection_id: Option<String>,
    app_handle: AppHandle,
    repo: State<'_, Repository>,
) -> Result<Document> {
    // 1. Get episode
    let episode = repo
        .get_podcast_episode_by_id(&episode_id)
        .await?
        .ok_or_else(|| IncrementumError::NotFound(format!("Podcast episode {}", episode_id)))?;

    // 2. Check if already imported
    let local_path_str = find_existing_download(&app_handle, &episode_id)
        .map(|p| p.to_string_lossy().to_string());

    if let Some(existing) = repo.find_document_by_url(&episode.audio_url).await? {
        return Ok(existing);
    }
    if let Some(ref local_path) = local_path_str {
        if let Some(existing) = repo.find_document_by_url(local_path).await? {
            return Ok(existing);
        }
    }

    // 3. Create a new Document record
    let file_path = local_path_str.unwrap_or_else(|| episode.audio_url.clone());
    let mut doc = Document::with_collection(episode.title, file_path, FileType::Audio, collection_id);
    doc.date_added = Utc::now();
    doc.date_modified = Utc::now();
    doc.next_reading_date = Some(Utc::now()); // Make it due immediately
    doc.priority_rating = 8; // High priority for new items
    doc.tags = vec!["podcast".to_string()];
    
    if let Some(image_url) = episode.image_url {
        doc.cover_image_url = Some(image_url);
        doc.cover_image_source = Some("podcast".to_string());
    }

    // 4. Save to DB
    let created = repo.create_document(&doc).await?;
    
    Ok(created)
}

/// Set auto-transcribe settings for a podcast feed
#[tauri::command]
pub async fn set_feed_auto_transcribe(
    feed_id: String,
    enabled: bool,
    language: Option<String>,
    repo: State<'_, Repository>,
) -> Result<()> {
    repo.set_feed_auto_transcribe(&feed_id, enabled, language.as_deref()).await
}

fn podcast_audio_dir(app_handle: &AppHandle) -> std::result::Result<PathBuf, IncrementumError> {
    // Use the Tauri-resolved app data dir, which is the app's private writable
    // storage on every platform (on Android this is /data/data/<pkg>/files via
    // app_data_dir; dirs::data_dir() instead resolves to a READ-ONLY system path
    // on Android and fails with "Read-only file system" when creating the dir).
    let base = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| IncrementumError::Internal(format!("Failed to resolve app_data_dir: {}", e)))?;
    let dir = base.join("podcast-audio");
    std::fs::create_dir_all(&dir)
        .map_err(|e| IncrementumError::Internal(format!("Failed to create podcast-audio dir: {}", e)))?;
    Ok(dir)
}

/// Find existing downloaded file for an episode (checks common extensions)
fn find_existing_download(app_handle: &AppHandle, episode_id: &str) -> Option<PathBuf> {
    let dir = podcast_audio_dir(app_handle).ok()?;
    for entry in std::fs::read_dir(&dir).ok()? {
        let entry = entry.ok()?;
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if name_str.starts_with(&format!("{}.", episode_id)) {
            return Some(entry.path());
        }
    }
    None
}

/// Download a podcast episode audio file for local playback
#[tauri::command]
pub async fn download_podcast_episode(
    episode_id: String,
    audio_url: String,
    audio_type: Option<String>,
    app_handle: AppHandle,
) -> Result<String> {
    if let Some(existing) = find_existing_download(&app_handle, &episode_id) {
        return Ok(existing.to_string_lossy().to_string());
    }

    let audio_dir = podcast_audio_dir(&app_handle)?;
    let ext = audio_type
        .as_deref()
        .and_then(|t| t.split('/').last())
        .unwrap_or("mp3");
    let dest_path = audio_dir.join(format!("{}.{}", episode_id, ext));
    let temp_path = dest_path.with_extension("downloading");

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| IncrementumError::Internal(format!("HTTP client error: {}", e)))?;

    let response = client
        .get(&audio_url)
        .send()
        .await
        .map_err(|e| IncrementumError::Internal(format!("Download failed: {}", e)))?;

    if !response.status().is_success() {
        return Err(IncrementumError::Internal(format!(
            "Download failed: HTTP {}",
            response.status()
        )));
    }

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut file = tokio::fs::File::create(&temp_path)
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to create temporary download file: {}", e)))?;

    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| IncrementumError::Internal(format!("Download error: {}", e)))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| IncrementumError::Internal(format!("Write error: {}", e)))?;
        downloaded += chunk.len() as u64;

        if total_size > 0 {
            let progress = ((downloaded as f64 / total_size as f64) * 100.0) as u32;
            let _ = app_handle.emit(
                "podcast://download-progress",
                serde_json::json!({ "episodeId": &episode_id, "progress": progress }),
            );
        }
    }

    file.flush()
        .await
        .map_err(|e| IncrementumError::Internal(format!("Flush error: {}", e)))?;

    // Download complete, now handle SponsorBlock skipping
    let repo = app_handle.state::<Repository>();
    let mut video_id = crate::youtube::extract_video_id(&audio_url);
    if video_id.is_none() {
        if let Ok(Some(episode)) = repo.get_podcast_episode_by_id(&episode_id).await {
            if let Some(ref link) = episode.link {
                video_id = crate::youtube::extract_video_id(link);
            }
        }
    }

    let mut cut_applied = false;
    if let Some(ref vid) = video_id {
        println!("[SponsorBlock] Checking segments for video ID: {}", vid);
        if let Ok(segments) = crate::sponsorblock::fetch_sponsorblock_segments(vid).await {
            if !segments.is_empty() {
                println!("[SponsorBlock] Found {} skippable segments. Cutting using ffmpeg...", segments.len());
                let _ = app_handle.emit(
                    "podcast://download-progress",
                    serde_json::json!({ "episodeId": &episode_id, "progress": 100, "status": "cutting" }),
                );
                
                match crate::sponsorblock::cut_audio_file(&app_handle, &temp_path, &dest_path, &segments).await {
                    Ok(cuts) => {
                        println!("[SponsorBlock] Cutting successful. Saved {} cuts metadata.", cuts.len());
                        let _ = crate::sponsorblock::save_cuts_metadata(&episode_id, &cuts);
                        let _ = std::fs::remove_file(&temp_path);
                        cut_applied = true;
                    }
                    Err(e) => {
                        eprintln!("[SponsorBlock] Cutting failed: {}. Falling back to uncut download.", e);
                    }
                }
            } else {
                println!("[SponsorBlock] No skippable segments found.");
            }
        } else {
            eprintln!("[SponsorBlock] Failed to fetch SponsorBlock segments.");
        }
    }

    if !cut_applied {
        // No cuts applied, rename raw downloaded file to dest path
        std::fs::rename(&temp_path, &dest_path)
            .map_err(|e| IncrementumError::Internal(format!("Failed to save final download file: {}", e)))?;
    }

    // Update matching imported document with local download path
    if let Ok(Some(mut doc)) = repo.find_document_by_url(&audio_url).await {
        doc.file_path = dest_path.to_string_lossy().to_string();
        doc.date_modified = Utc::now();
        let _ = repo.update_document(&doc.id, &doc).await;
    }

    let _ = app_handle.emit(
        "podcast://download-complete",
        serde_json::json!({ "episodeId": &episode_id, "path": dest_path.to_string_lossy() }),
    );

    Ok(dest_path.to_string_lossy().to_string())
}

/// Get the local file path for a downloaded episode (null if not downloaded)
#[tauri::command]
pub async fn get_downloaded_episode_path(
    episode_id: String,
    app_handle: AppHandle,
) -> Result<Option<String>> {
    Ok(find_existing_download(&app_handle, &episode_id)
        .map(|p| p.to_string_lossy().to_string()))
}

/// Delete a downloaded episode audio file
#[tauri::command]
pub async fn delete_downloaded_episode(
    episode_id: String,
    app_handle: AppHandle,
) -> Result<()> {
    if let Some(path) = find_existing_download(&app_handle, &episode_id) {
        std::fs::remove_file(&path)
            .map_err(|e| IncrementumError::Internal(format!("Failed to delete: {}", e)))?;
    }
    Ok(())
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ITunesPodcastResult {
    pub collection_name: String,
    pub feed_url: Option<String>,
    pub artist_name: Option<String>,
    pub artwork_url600: Option<String>,
    pub artwork_url100: Option<String>,
    pub track_view_url: Option<String>,
    pub track_count: Option<i64>,
    pub primary_genre_name: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ITunesSearchResponse {
    pub results: Vec<ITunesPodcastResult>,
}

/// Search for podcasts via iTunes Search API (completely keyless and highly reliable)
#[tauri::command]
pub async fn search_podcasts(query: String) -> Result<Vec<PodcastSearchResult>> {
    let q = query.trim();
    if q.is_empty() {
        return Ok(Vec::new());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| IncrementumError::Internal(format!("Failed to build HTTP client: {}", e)))?;

    let response = client
        .get("https://itunes.apple.com/search")
        .query(&[("media", "podcast"), ("term", q)])
        .send()
        .await
        .map_err(|e| IncrementumError::Internal(format!("Search request failed: {}", e)))?;

    if !response.status().is_success() {
        return Err(IncrementumError::Internal(format!(
            "Search API returned HTTP {}",
            response.status()
        )));
    }

    let data: ITunesSearchResponse = response
        .json()
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to parse search response: {}", e)))?;

    let results = data.results.into_iter()
        .filter_map(|r| {
            let feed_url = r.feed_url?;
            Some(PodcastSearchResult {
                title: r.collection_name,
                url: feed_url,
                author: r.artist_name,
                description: r.primary_genre_name.clone(),
                image_url: r.artwork_url600.or(r.artwork_url100),
                link: r.track_view_url,
                episode_count: r.track_count,
                categories: r.primary_genre_name.map(|genre| {
                    let mut hm = std::collections::HashMap::new();
                    hm.insert("0".to_string(), genre);
                    hm
                }),
            })
        })
        .collect();

    Ok(results)
}

/// Save a podcast transcript from the frontend
#[tauri::command]
pub async fn save_podcast_transcript(
    episode_id: String,
    status: String,
    error: Option<String>,
    transcript: Option<String>,
    repo: State<'_, Repository>,
) -> Result<()> {
    repo.update_episode_transcript_status(&episode_id, &status, error.as_deref(), transcript.as_deref()).await?;
    Ok(())
}
