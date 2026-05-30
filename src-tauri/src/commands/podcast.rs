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

        let cancel_post = cancel_clone.clone();
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

    // 9. Store transcript in DB
    repo.update_episode_transcript_status(&episode_id, "done", None, Some(&full_text))
        .await?;

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

    // The Whisper engine produces segments during transcription but they are
    // concatenated into the stored transcript. Individual segment timestamps
    // could be added in a future enhancement.
    let segments = vec![TranscriptSegmentInfo {
        start_ms: 0,
        end_ms: episode.duration.unwrap_or(0) * 1000,
        text: text.clone(),
    }];

    Ok(PodcastTranscriptResponse {
        text,
        segments,
        status,
    })
}

/// Cancel an in-progress podcast transcription
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
    repo: State<'_, Repository>,
) -> Result<Document> {
    // 1. Get episode
    let episode = repo
        .get_podcast_episode_by_id(&episode_id)
        .await?
        .ok_or_else(|| IncrementumError::NotFound(format!("Podcast episode {}", episode_id)))?;

    // 2. Check if already imported
    let local_path_str = find_existing_download(&episode_id)
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

fn podcast_audio_dir() -> std::result::Result<PathBuf, IncrementumError> {
    let dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("incrementum")
        .join("podcast-audio");
    std::fs::create_dir_all(&dir)
        .map_err(|e| IncrementumError::Internal(format!("Failed to create podcast-audio dir: {}", e)))?;
    Ok(dir)
}

/// Find existing downloaded file for an episode (checks common extensions)
fn find_existing_download(episode_id: &str) -> Option<PathBuf> {
    let dir = podcast_audio_dir().ok()?;
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
    if let Some(existing) = find_existing_download(&episode_id) {
        return Ok(existing.to_string_lossy().to_string());
    }

    let audio_dir = podcast_audio_dir()?;
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
pub async fn get_downloaded_episode_path(episode_id: String) -> Result<Option<String>> {
    Ok(find_existing_download(&episode_id)
        .map(|p| p.to_string_lossy().to_string()))
}

/// Delete a downloaded episode audio file
#[tauri::command]
pub async fn delete_downloaded_episode(episode_id: String) -> Result<()> {
    if let Some(path) = find_existing_download(&episode_id) {
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
