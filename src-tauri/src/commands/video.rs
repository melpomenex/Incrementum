//! Video import and features commands
//! Handles importing local video files and video-specific features

use tauri::State;
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

/// Import a local video file into the document system
#[tauri::command]
pub async fn import_video_file(
    filename: String,
    title: String,
    content: Vec<u8>,
    repo: State<'_, Repository>,
) -> Result<Document, String> {
    let now = chrono::Utc::now();

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
    let safe_filename = filename
        .replace('/', "_")
        .replace('\\', "_")
        .replace(':', "_");
    let stored_filename = format!("{}-{}", timestamp, safe_filename);
    let file_path = data_dir.join(&stored_filename);

    // Write the video file to disk
    std::fs::write(&file_path, &content)
        .map_err(|e| format!("Failed to write video file: {}", e))?;

    // Create document for the video file
    let metadata = DocumentMetadata {
        author: None,
        subject: None,
        keywords: None,
        created_at: None,
        modified_at: None,
        file_size: Some(content.len() as i64),
        language: None,
        page_count: None,
        word_count: None,
    };

    let mut document = Document::new(title, file_path.to_string_lossy().to_string(), FileType::Video);
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

/// Format time in seconds to MM:SS format
fn format_time(seconds: f64) -> String {
    let mins = (seconds / 60.0).floor() as i32;
    let secs = (seconds % 60.0).floor() as i32;
    format!("{}:{:02}", mins, secs)
}

// ============================================================================
// Video Extract commands
// ============================================================================

/// Create a video extract
#[tauri::command]
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
    if rating < 1 || rating > 4 {
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
