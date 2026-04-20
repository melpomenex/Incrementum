//! Video import and features commands
//! Handles importing local video files and video-specific features

use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use std::sync::{Arc, Mutex};
use crate::transcription::engine::TranscriptionEngine;
use crate::transcription::model_manager::ModelManager;
use crate::database::Repository;
use crate::models::{Document, DocumentMetadata, FileType, VideoExtract, MemoryState, ReviewRating};

/// Video bookmark data structure
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct VideoBookmark {
    pub id: String,
    pub document_id: String,
    pub title: String,
    pub time: f64,
    pub thumbnail_url: Option<String>,
    pub created_at: String,
}

/// Video chapter data structure
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct VideoChapter {
    pub id: String,
    pub document_id: String,
    pub title: String,
    pub start_time: f64,
    pub end_time: f64,
    pub order: i32,
}

/// Video transcript segment
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct VideoTranscriptSegment {
    pub time: f64,
    pub text: String,
}

/// Video transcript data structure
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct VideoTranscript {
    pub document_id: String,
    pub transcript: String,
    pub segments: Vec<VideoTranscriptSegment>,
}

/// Video transcription status event payload
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct VideoTranscriptionStatus {
    pub document_id: String,
    pub status: String,
    pub error: Option<String>,
}

/// Import a local video file into the document system
/// Accepts a file path and copies the file to the app's video storage directory
#[tauri::command]
pub async fn import_video_file(
    source_path: String,
    title: String,
    repo: State<'_, Repository>,
) -> Result<Document, String> {
    let now = chrono::Utc::now();

    // Validate the source file exists
    let source = std::path::Path::new(&source_path);
    if !source.exists() {
        return Err(format!("Source file not found: {}", source_path));
    }

    // Get the video storage directory
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("incrementum")
        .join("videos");

    // Create the videos directory if it doesn't exist
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create video directory: {}", e))?;

    // Generate a unique filename to avoid conflicts
    let timestamp = now.timestamp();
    let original_filename = source
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("video.mp4");
    let safe_filename = original_filename
        .replace(['/', '\\', ':'], "_");
    let stored_filename = format!("{}-{}", timestamp, safe_filename);
    let dest_path = data_dir.join(&stored_filename);

    // Get file size before copying
    let file_size = std::fs::metadata(source)
        .map(|m| m.len() as i64)
        .unwrap_or(0);

    // Copy the file directly (avoids loading entire file into memory)
    std::fs::copy(source, &dest_path)
        .map_err(|e| format!("Failed to copy video file: {}", e))?;

    // Create document for the video file
    let metadata = DocumentMetadata {
        author: None,
        subject: None,
        keywords: None,
        created_at: None,
        modified_at: None,
        file_size: Some(file_size),
        language: None,
        page_count: None,
        word_count: None,
        source: None,
        fetched_at: None,
        site_name: None,
        browser_import_mode: None,
        article_html: None,
        extracted_images: None,
    };

    let mut document = Document::new(title, dest_path.to_string_lossy().to_string(), FileType::Video);
    document.category = Some("Videos".to_string());
    document.metadata = Some(metadata);
    document.current_page = Some(0);

    let created = repo.create_document(&document)
        .await
        .map_err(|e| format!("Failed to create document: {}", e))?;

    Ok(created)
}

/// Get the video storage directory path
#[tauri::command]
pub async fn get_video_storage_path() -> Result<String, String> {
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("incrementum")
        .join("videos");

    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create video directory: {}", e))?;

    Ok(data_dir.to_string_lossy().to_string())
}

/// Add a bookmark to a video
#[tauri::command]
pub async fn add_video_bookmark(
    document_id: String,
    title: Option<String>,
    time: f64,
    repo: State<'_, Repository>,
) -> Result<VideoBookmark, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let bookmark_title = title.unwrap_or_else(|| format!("Bookmark at {}", format_time(time)));

    repo.create_video_bookmark(&id, &document_id, &bookmark_title, time, None)
        .await
        .map_err(|e| format!("Failed to create bookmark: {}", e))?;

    Ok(VideoBookmark {
        id,
        document_id,
        title: bookmark_title,
        time,
        thumbnail_url: None,
        created_at: chrono::Utc::now().to_rfc3339(),
    })
}

/// Get all bookmarks for a video
#[tauri::command]
pub async fn get_video_bookmarks(
    document_id: String,
    repo: State<'_, Repository>,
) -> Result<Vec<VideoBookmark>, String> {
    repo.get_video_bookmarks(&document_id)
        .await
        .map_err(|e| format!("Failed to get bookmarks: {}", e))
}

/// Delete a video bookmark
#[tauri::command]
pub async fn delete_video_bookmark(
    bookmark_id: String,
    repo: State<'_, Repository>,
) -> Result<(), String> {
    repo.delete_video_bookmark(&bookmark_id)
        .await
        .map_err(|e| format!("Failed to delete bookmark: {}", e))
}

/// Set chapters for a video
#[tauri::command]
pub async fn set_video_chapters(
    document_id: String,
    chapters: Vec<VideoChapter>,
    repo: State<'_, Repository>,
) -> Result<(), String> {
    repo.set_video_chapters(&document_id, &chapters)
        .await
        .map_err(|e| format!("Failed to set chapters: {}", e))
}

/// Get all chapters for a video
#[tauri::command]
pub async fn get_video_chapters(
    document_id: String,
    repo: State<'_, Repository>,
) -> Result<Vec<VideoChapter>, String> {
    repo.get_video_chapters(&document_id)
        .await
        .map_err(|e| format!("Failed to get chapters: {}", e))
}

/// Set transcript for a video
#[tauri::command]
pub async fn set_video_transcript(
    document_id: String,
    transcript: String,
    segments: Vec<VideoTranscriptSegment>,
    repo: State<'_, Repository>,
) -> Result<(), String> {
    let segments_json = serde_json::to_string(&segments)
        .map_err(|e| format!("Failed to serialize segments: {}", e))?;

    repo.set_video_transcript(&document_id, &transcript, &segments_json)
        .await
        .map_err(|e| format!("Failed to set transcript: {}", e))
}

/// Get transcript for a video
#[tauri::command]
pub async fn get_video_transcript(
    document_id: String,
    repo: State<'_, Repository>,
) -> Result<Option<VideoTranscript>, String> {
    let result = repo.get_video_transcript(&document_id)
        .await
        .map_err(|e| format!("Failed to get transcript: {}", e))?;

    match result {
        Some((transcript, segments_json)) => {
            let segments: Vec<VideoTranscriptSegment> = serde_json::from_str(&segments_json)
                .map_err(|e| format!("Failed to parse segments: {}", e))?;

            Ok(Some(VideoTranscript {
                document_id,
                transcript,
                segments,
            }))
        }
        None => Ok(None),
    }
}

/// Generate a transcript for a local video using Whisper (Tauri only)
#[tauri::command]
pub async fn generate_video_transcript(
    document_id: String,
    file_path: String,
    model_id: String,
    language: String,
    repo: State<'_, Repository>,
    app_handle: AppHandle,
) -> Result<VideoTranscript, String> {
    let emit_status = |status: &str, error: Option<String>| {
        let _ = app_handle.emit("video-transcription://status-change", VideoTranscriptionStatus {
            document_id: document_id.clone(),
            status: status.to_string(),
            error,
        });
    };

    emit_status("processing", None);

    let model_manager = ModelManager::new(&app_handle)
        .map_err(|e| format!("Failed to initialize model manager: {}", e))?;

    if !model_manager.is_model_installed(&model_id) {
        let msg = format!("Model '{}' is not installed. Download it in Settings > Audio Transcription.", model_id);
        emit_status("failed", Some(msg.clone()));
        return Err(msg);
    }

    let input_path = std::path::Path::new(&file_path);
    if !input_path.exists() {
        let msg = format!("Video file not found at path: {}", file_path);
        emit_status("failed", Some(msg.clone()));
        return Err(msg);
    }

    let engine = TranscriptionEngine::new(app_handle.clone());
    let mut wav_path: Option<std::path::PathBuf> = None;

    let segments: Arc<Mutex<Vec<VideoTranscriptSegment>>> = Arc::new(Mutex::new(Vec::new()));
    let segments_for_cb = segments.clone();
    let app_for_cb = app_handle.clone();

    let result = async {
        let prepared = engine.prepare_audio(input_path).await
            .map_err(|e| format!("Failed to prepare audio: {}", e))?;
        wav_path = Some(prepared.clone());

        let model_path = model_manager.get_model_path(&model_id);

        engine.transcribe(&prepared, &model_path, &language, move |seg| {
            let text = seg.text.trim().to_string();
            if text.is_empty() {
                return;
            }

            let segment = VideoTranscriptSegment {
                time: seg.start_ms as f64 / 1000.0,
                text,
            };

            if let Ok(mut guard) = segments_for_cb.lock() {
                guard.push(segment.clone());
            }

            let _ = app_for_cb.emit("video-transcription://segment", segment);
        }).await.map_err(|e| format!("Transcription failed: {}", e))?;

        Ok::<(), String>(())
    }.await;

    if let Some(path) = wav_path {
        let _ = std::fs::remove_file(path);
    }

    if let Err(err) = result {
        emit_status("failed", Some(err.clone()));
        return Err(err);
    }

    let segments_vec = {
        let mut segments = segments.lock().unwrap_or_else(|e| e.into_inner());
        segments.sort_by(|a, b| a.time.partial_cmp(&b.time).unwrap_or(std::cmp::Ordering::Equal));
        segments.iter().cloned().collect::<Vec<_>>()
    };

    let transcript = segments_vec.iter().map(|s| s.text.trim()).filter(|t| !t.is_empty()).collect::<Vec<_>>().join(" ");

    let segments_json = serde_json::to_string(&segments_vec)
        .map_err(|e| format!("Failed to serialize segments: {}", e))?;

    repo.set_video_transcript(&document_id, &transcript, &segments_json)
        .await
        .map_err(|e| format!("Failed to save transcript: {}", e))?;

    emit_status("completed", None);

    Ok(VideoTranscript {
        document_id,
        transcript,
        segments: segments_vec,
    })
}

/// Format time in seconds to MM:SS format
fn format_time(seconds: f64) -> String {
    let mins = (seconds / 60.0).floor() as i32;
    let secs = (seconds % 60.0).floor() as i32;
    format!("{}:{:02}", mins, secs)
}

/// Audio chunk info for Groq transcription
#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct AudioChunk {
    pub index: usize,
    pub path: String,
    pub start_time: f64,
    pub end_time: f64,
    pub duration: f64,
}

/// Split audio file into chunks for Groq transcription (max 25MB each)
/// Uses ffmpeg to split by duration, targeting chunks around 20MB
#[tauri::command]
pub async fn split_audio_for_groq(
    app_handle: AppHandle,
    file_path: String,
    max_chunk_duration_seconds: Option<f64>,
) -> Result<Vec<AudioChunk>, String> {
    let input_path = std::path::Path::new(&file_path);
    if !input_path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    // Get file info using ffmpeg
    let (mut rx, _) = crate::utils::ffmpeg::ffmpeg_command(&app_handle)
        .map_err(|e| format!("Failed to get ffmpeg command: {}", e))?
        .args([
            "-i", &file_path,
            "-f", "null",
            "-"
        ])
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;

    let mut duration: f64 = 0.0;
    let mut bitrate: f64 = 0.0;
    
    // Parse ffmpeg output for duration
    while let Some(event) = rx.recv().await {
        if let CommandEvent::Stderr(line) = event {
            let line_str = String::from_utf8_lossy(&line);
            // Parse duration: Duration: 01:23:45.67
            if let Some(duration_idx) = line_str.find("Duration: ") {
                let duration_str = &line_str[duration_idx + 10..];
                if let Some(comma_idx) = duration_str.find(',') {
                    let time_str = &duration_str[..comma_idx].trim();
                    // Parse HH:MM:SS.ms format
                    let parts: Vec<&str> = time_str.split(':').collect();
                    if parts.len() == 3 {
                        if let (Ok(h), Ok(m), Ok(s)) = (
                            parts[0].parse::<f64>(),
                            parts[1].parse::<f64>(),
                            parts[2].parse::<f64>()
                        ) {
                            duration = h * 3600.0 + m * 60.0 + s;
                        }
                    }
                }
            }
            // Parse bitrate: bitrate: 128 kb/s
            if let Some(bitrate_idx) = line_str.find("bitrate: ") {
                let bitrate_str = &line_str[bitrate_idx + 9..];
                if let Some(space_idx) = bitrate_str.find(' ') {
                    let num_str = &bitrate_str[..space_idx].trim();
                    if let Ok(num) = num_str.parse::<f64>() {
                        bitrate = num;
                    }
                }
            }
        }
    }

    if duration <= 0.0 {
        // Fallback: assume 10 minute chunks if we can't determine duration
        duration = 600.0;
    }

    // Calculate chunk duration based on bitrate to stay under 25MB
    // At 128 kbps, 25MB ≈ 26 minutes
    // At 192 kbps, 25MB ≈ 17 minutes  
    // At 320 kbps, 25MB ≈ 10 minutes
    // We'll use a conservative 8 minutes per chunk (safer for variable bitrate)
    let chunk_duration = max_chunk_duration_seconds.unwrap_or(480.0); // 8 minutes default
    let num_chunks = (duration / chunk_duration).ceil() as usize;
    
    let temp_dir = app_handle.path().app_cache_dir()
        .map_err(|e| format!("Failed to get cache dir: {}", e))?
        .join("groq_chunks");
    
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create chunks directory: {}", e))?;

    let mut chunks = Vec::with_capacity(num_chunks);
    
    // Create chunks using ffmpeg
    for i in 0..num_chunks {
        let start_time = i as f64 * chunk_duration;
        let end_time = (start_time + chunk_duration).min(duration);
        let actual_duration = end_time - start_time;
        
        let chunk_filename = format!("chunk_{:04}.mp3", i);
        let chunk_path = temp_dir.join(&chunk_filename);
        
        // Extract chunk using ffmpeg
        let (mut rx, _) = crate::utils::ffmpeg::ffmpeg_command(&app_handle)
            .map_err(|e| format!("Failed to get ffmpeg command: {}", e))?
            .args([
                "-i", &file_path,
                "-ss", &start_time.to_string(),
                "-t", &actual_duration.to_string(),
                "-ar", "16000",     // 16kHz sample rate (optimal for speech)
                "-ac", "1",          // Mono
                "-b:a", "32k",       // 32 kbps (good quality for speech, small size)
                "-f", "mp3",         // MP3 format
                "-y",                 // Overwrite
                chunk_path.to_str().unwrap()
            ])
            .spawn()
            .map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;

        let mut success = false;
        while let Some(event) = rx.recv().await {
            if let CommandEvent::Terminated(payload) = event {
                success = payload.code == Some(0);
                break;
            }
        }

        if !success {
            return Err(format!("Failed to create chunk {}", i));
        }

        chunks.push(AudioChunk {
            index: i,
            path: chunk_path.to_string_lossy().to_string(),
            start_time,
            end_time,
            duration: actual_duration,
        });
    }

    Ok(chunks)
}

/// Clean up audio chunks after transcription
#[tauri::command]
pub async fn cleanup_audio_chunks(
    app_handle: AppHandle,
) -> Result<(), String> {
    let temp_dir = app_handle.path().app_cache_dir()
        .map_err(|e| format!("Failed to get cache dir: {}", e))?
        .join("groq_chunks");
    
    if temp_dir.exists() {
        let _ = std::fs::remove_dir_all(&temp_dir);
    }
    
    Ok(())
}

/// Read file bytes for Groq upload
#[tauri::command]
pub async fn read_file_bytes(file_path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

// ============================================================================
// Video Extract commands
// ============================================================================

/// Create a video extract
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn create_video_extract(
    document_id: String,
    start_time: f64,
    end_time: f64,
    title: String,
    transcript_text: Option<String>,
    notes: Option<String>,
    tags: Option<Vec<String>>,
    add_to_queue: Option<bool>,
    repo: State<'_, Repository>,
) -> Result<VideoExtract, String> {
    // Validate timestamps
    if start_time < 0.0 {
        return Err("Start time cannot be negative".to_string());
    }
    if end_time <= start_time {
        return Err("End time must be greater than start time".to_string());
    }

    let duration = end_time - start_time;
    if duration > 600.0 {
        return Err("Extract duration cannot exceed 10 minutes (600 seconds)".to_string());
    }

    let mut extract = VideoExtract::new(document_id, start_time, end_time, title);
    extract.transcript_text = transcript_text;
    extract.notes = notes;
    extract.tags = tags.unwrap_or_default();

    // Schedule for review if requested
    if add_to_queue.unwrap_or(false) {
        let tomorrow = chrono::Utc::now() + chrono::Duration::days(1);
        extract.next_review_date = Some(tomorrow);
    }

    repo.create_video_extract(&extract)
        .await
        .map_err(|e| format!("Failed to create video extract: {}", e))?;

    Ok(extract)
}

/// Get all video extracts for a document
#[tauri::command]
pub async fn get_video_extracts(
    document_id: String,
    repo: State<'_, Repository>,
) -> Result<Vec<VideoExtract>, String> {
    repo.get_video_extracts_by_document(&document_id)
        .await
        .map_err(|e| format!("Failed to get video extracts: {}", e))
}

/// Get a single video extract by ID
#[tauri::command]
pub async fn get_video_extract(
    extract_id: String,
    repo: State<'_, Repository>,
) -> Result<Option<VideoExtract>, String> {
    repo.get_video_extract(&extract_id)
        .await
        .map_err(|e| format!("Failed to get video extract: {}", e))
}

/// Update a video extract
#[tauri::command]
pub async fn update_video_extract(
    extract_id: String,
    title: Option<String>,
    notes: Option<String>,
    tags: Option<Vec<String>>,
    repo: State<'_, Repository>,
) -> Result<VideoExtract, String> {
    let mut extract = repo.get_video_extract(&extract_id)
        .await
        .map_err(|e| format!("Failed to get video extract: {}", e))?
        .ok_or_else(|| "Video extract not found".to_string())?;

    // Apply updates
    if let Some(new_title) = title {
        extract.title = new_title;
    }
    if let Some(new_notes) = notes {
        extract.notes = Some(new_notes);
    }
    if let Some(new_tags) = tags {
        extract.tags = new_tags;
    }
    extract.date_modified = chrono::Utc::now();

    repo.update_video_extract(&extract)
        .await
        .map_err(|e| format!("Failed to update video extract: {}", e))
}

/// Delete a video extract
#[tauri::command]
pub async fn delete_video_extract(
    extract_id: String,
    repo: State<'_, Repository>,
) -> Result<(), String> {
    repo.delete_video_extract(&extract_id)
        .await
        .map_err(|e| format!("Failed to delete video extract: {}", e))
}

/// Rate a video extract (update FSRS scheduling)
#[tauri::command]
pub async fn rate_video_extract(
    extract_id: String,
    rating: i32,
    repo: State<'_, Repository>,
) -> Result<String, String> {
    use crate::algorithms::DocumentScheduler;

    // Validate rating
    if !(1..=4).contains(&rating) {
        return Err("Rating must be between 1 (Again) and 4 (Easy)".to_string());
    }

    let mut extract = repo.get_video_extract(&extract_id)
        .await
        .map_err(|e| format!("Failed to get video extract: {}", e))?
        .ok_or_else(|| "Video extract not found".to_string())?;

    let scheduler = DocumentScheduler::default_params();
    let now = chrono::Utc::now();

    // Calculate elapsed days since last review
    let elapsed_days = extract.last_review_date
        .map(|lr| (now - lr).num_seconds() as f64 / 86400.0)
        .unwrap_or_else(|| {
            (now - extract.date_created).num_seconds() as f64 / 86400.0
        })
        .max(0.0);

    let review_rating = ReviewRating::from(rating);

    // Get current stability and difficulty from memory state
    let current_stability = extract.memory_state.as_ref().map(|ms| ms.stability);
    let current_difficulty = extract.memory_state.as_ref().map(|ms| ms.difficulty);

    // Schedule the extract using FSRS
    let result = scheduler.schedule_document(
        review_rating,
        current_stability,
        current_difficulty,
        elapsed_days
    );
    let result = result.map_err(|e| format!("Failed to schedule: {}", e))?;

    // Update the extract with new scheduling data
    let new_review_count = extract.review_count + 1;
    let new_reps = extract.reps + 1;

    repo.update_video_extract_scheduling(
        &extract.id,
        Some(result.next_review),
        Some(crate::models::MemoryState {
            stability: result.stability,
            difficulty: result.difficulty,
        }),
        Some(new_review_count),
        Some(new_reps),
        Some(now),
    )
    .await
    .map_err(|e| format!("Failed to update scheduling: {}", e))?;

    Ok(format!("Next review: {}", result.next_review.format("%Y-%m-%d %H:%M")))
}
