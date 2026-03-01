use tauri::{AppHandle, Manager};
use crate::error::{IncrementumError, Result};
use crate::database::Repository;
use crate::models::{Document, FileType, DocumentMetadata};
use std::path::Path;
use serde::Serialize;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use crate::transcription::engine::TranscriptionEngine;
use crate::transcription::model_manager::ModelManager;
use std::sync::{Arc, Mutex};
use tauri::State;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudiobookChapter {
    pub id: i32,
    pub title: String,
    pub start_time: f64,
    pub end_time: Option<f64>,
    pub duration: Option<f64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudiobookMetadata {
    pub title: String,
    pub author: Option<String>,
    pub narrator: Option<String>,
    pub duration: f64,
    pub chapters: Vec<AudiobookChapter>,
    pub cover_url: Option<String>,
    pub description: Option<String>,
    pub publisher: Option<String>,
    pub publish_year: Option<i32>,
    pub language: Option<String>,
    pub genre: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudiobookTranscriptSegment {
    pub id: String,
    pub text: String,
    pub start_time: f64,
    pub end_time: f64,
    pub confidence: Option<f32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudiobookTranscriptResult {
    pub segments: Vec<AudiobookTranscriptSegment>,
    pub language: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PodcastImportResult {
    pub document: Document,
    pub transcript_segments: i32,
}

#[tauri::command]
pub async fn parse_audiobook_metadata(
    app_handle: AppHandle,
    file_path: String,
) -> Result<AudiobookMetadata> {
    let path = Path::new(&file_path);
    let filename = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
    
    // Default metadata from filename
    let mut metadata = AudiobookMetadata {
        title: filename.clone(),
        author: None,
        narrator: None,
        duration: 0.0,
        chapters: vec![],
        cover_url: None,
        description: None,
        publisher: None,
        publish_year: None,
        language: None,
        genre: None,
    };

    // Try to use ffprobe to get metadata
    // ffprobe -v quiet -print_format json -show_format -show_chapters input.mp3
    
    let (mut rx, _) = crate::utils::ffmpeg::ffmpeg_command(&app_handle)? // Uses system ffmpeg on Linux, sidecar on Windows/macOS
        // Wait, did we download ffprobe? No.
        // Can we use ffmpeg to get metadata?
        // ffmpeg -i input.mp3 -f ffmetadata -
        .args([
            "-i", &file_path,
            "-f", "ffmetadata",
            "-" // output to stdout
        ])
        .spawn()?;

    let mut output = String::new();
    while let Some(event) = rx.recv().await {
        if let CommandEvent::Stdout(line) = event {
            output.push_str(&String::from_utf8_lossy(&line));
        }
    }

    // Parse ffmpeg output (INI-like format)
    // ;FFMETADATA1
    // title=Song Title
    // artist=Artist Name
    
    for line in output.lines() {
        if let Some((key, value)) = line.split_once('=') {
            match key.to_lowercase().as_str() {
                "title" => metadata.title = value.to_string(),
                "artist" | "author" | "album_artist" => metadata.author = Some(value.to_string()),
                "album" => {
                    if metadata.title == filename { // Only overwrite if title hasn't been found or is just filename
                         metadata.title = value.to_string(); 
                    }
                },
                "composer" => {
                     if metadata.author.is_none() {
                         metadata.author = Some(value.to_string());
                     }
                },
                "comment" | "description" => metadata.description = Some(value.to_string()),
                "date" | "creation_time" => {
                    if let Ok(year) = value.chars().take(4).collect::<String>().parse::<i32>() {
                        metadata.publish_year = Some(year);
                    }
                },
                "genre" => metadata.genre = Some(vec![value.to_string()]),
                _ => {}
            }
        }
    }
    
    // We also need duration. ffmpeg output to stderr usually has duration.
    // Let's run ffmpeg -i file_path and parse stderr for Duration.
    // Or assume 0 if we can't easily get it without ffprobe.
    
    // Since we don't have ffprobe, obtaining duration/chapters accurately is harder.
    // But basic metadata is better than nothing.
    
    // If chapters are missing, add a default one
    if metadata.chapters.is_empty() {
        metadata.chapters.push(AudiobookChapter {
            id: 1,
            title: "Chapter 1".to_string(),
            start_time: 0.0,
            end_time: None,
            duration: None,
        });
    }

    Ok(metadata)
}

#[tauri::command]
pub async fn import_podcast_audio_file(
    app_handle: AppHandle,
    file_path: String,
    title: Option<String>,
    language: Option<String>,
    repo: State<'_, Repository>,
) -> Result<PodcastImportResult> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(IncrementumError::NotFound(format!("Podcast audio file not found: {}", file_path)));
    }

    let default_title = path
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("Podcast Episode")
        .to_string();
    let mut document = Document::new(title.unwrap_or(default_title), file_path.clone(), FileType::Audio);
    document.tags = vec!["podcast".to_string(), "audio".to_string()];
    document.metadata = Some(DocumentMetadata {
        author: None,
        subject: Some("podcast".to_string()),
        keywords: Some(vec!["podcast".to_string(), "audio".to_string(), "whisper".to_string()]),
        created_at: None,
        modified_at: None,
        file_size: None,
        language: language.clone(),
        page_count: None,
        word_count: None,
    });

    let mut created = repo.create_document(&document).await?;

    let model_manager = ModelManager::new(&app_handle)
        .map_err(|e| IncrementumError::Internal(format!("Failed to initialize model manager: {}", e)))?;
    let selected_model = model_manager
        .list_profiles()
        .into_iter()
        .find(|profile| model_manager.is_model_installed(&profile.id))
        .map(|profile| profile.id);

    let mut transcript_segments = 0_i32;
    if let Some(model_id) = selected_model {
        let model_path = model_manager.get_model_path(&model_id);
        let engine = TranscriptionEngine::new(app_handle);
        let wav_path = engine
            .prepare_audio(path)
            .await
            .map_err(|e| IncrementumError::Internal(format!("Failed to prepare audio: {}", e)))?;

        let transcript_state = Arc::new(Mutex::new((String::new(), 0_i32)));
        let transcript_state_clone = Arc::clone(&transcript_state);
        if engine
            .transcribe(
                &wav_path,
                &model_path,
                language.as_deref().unwrap_or("en"),
                |segment| {
                    if let Ok(mut state) = transcript_state_clone.lock() {
                        state.0.push_str(&segment.text);
                        state.0.push(' ');
                        state.1 += 1;
                    }
                },
            )
            .await
            .is_ok()
        {
            let (transcript_text, segments) = transcript_state
                .lock()
                .map(|state| (state.0.clone(), state.1))
                .unwrap_or_else(|_| (String::new(), 0));
            transcript_segments = segments;
            if !transcript_text.trim().is_empty() {
                let content_hash = Some(crate::processor::generate_content_hash(&transcript_text));
                repo.update_document_content(
                    &created.id,
                    transcript_text.trim(),
                    content_hash,
                    None,
                    created.metadata.clone(),
                )
                .await?;
                if let Some(refreshed) = repo.get_document(&created.id).await? {
                    created = refreshed;
                }
            }
        }

        let _ = std::fs::remove_file(wav_path);
    }

    Ok(PodcastImportResult {
        document: created,
        transcript_segments,
    })
}

#[tauri::command]
pub async fn scan_directory_for_audiobooks(
    dir_path: String,
    extensions: Vec<String>,
) -> Result<Vec<String>> {
    use walkdir::WalkDir;
    
    let mut files = Vec::new();
    let ext_set: std::collections::HashSet<String> = extensions.into_iter().map(|e| e.to_lowercase()).collect();
    
    for entry in WalkDir::new(dir_path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            if let Some(ext) = entry.path().extension().and_then(|e| e.to_str()) {
                if ext_set.contains(&ext.to_lowercase()) {
                    files.push(entry.path().to_string_lossy().to_string());
                }
            }
        }
    }
    
    Ok(files)
}

#[tauri::command]
pub async fn parse_audiobook_chapters(
    _file_path: String,
) -> Result<Vec<AudiobookChapter>> {
    // Placeholder - implementing proper chapter parsing without ffprobe is tricky
    // For now return empty or default
    Ok(vec![
        AudiobookChapter {
            id: 1,
            title: "Chapter 1".to_string(),
            start_time: 0.0,
            end_time: None,
            duration: None,
        }
    ])
}

#[tauri::command]
pub async fn extract_audio_sample(
    _file_path: String,
    _start_time: f64,
    _duration: f64,
) -> Result<String> {
    // Placeholder - returns base64 string
    // Real impl would use ffmpeg to slice
    Ok(String::new()) 
}

/// Extract embedded cover art from an audio file using ffmpeg sidecar.
/// Returns a data:image URL (base64-encoded) or None if no cover is found.
#[tauri::command]
pub async fn extract_audio_cover_art(
    app_handle: AppHandle,
    file_path: String,
) -> Result<Option<String>> {
    use base64::{engine::general_purpose, Engine as _};

    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(IncrementumError::NotFound(format!(
            "Audio file not found: {}", file_path
        )));
    }

    // Create temp directory for cover extraction
    let temp_dir = app_handle.path().app_cache_dir()
        .map_err(|e| IncrementumError::Internal(format!("Failed to get cache dir: {}", e)))?
        .join("cover_art");

    if !temp_dir.exists() {
        std::fs::create_dir_all(&temp_dir)
            .map_err(|e| IncrementumError::Internal(format!("Failed to create temp dir: {}", e)))?;
    }

    let cover_filename = format!("{}.jpg", uuid::Uuid::new_v4());
    let cover_path = temp_dir.join(&cover_filename);

    // Use ffmpeg to extract embedded cover art
    let (mut rx, _) = crate::utils::ffmpeg::ffmpeg_command(&app_handle)
        .map_err(|e| IncrementumError::Internal(format!("Failed to get ffmpeg command: {}", e)))?
        .args([
            "-i", &file_path,
            "-an",              // no audio
            "-vcodec", "copy",  // copy the video stream (cover art)
            "-f", "image2",     // output as image
            "-y",               // overwrite
            cover_path.to_str().unwrap()
        ])
        .spawn()
        .map_err(|e| IncrementumError::Internal(format!("Failed to spawn ffmpeg: {}", e)))?;

    // Wait for ffmpeg to finish
    while let Some(event) = rx.recv().await {
        if let CommandEvent::Terminated(_) = event {
            break;
        }
    }

    // Check if the output file was created and has content
    if cover_path.exists() {
        let file_size = std::fs::metadata(&cover_path)
            .map(|m| m.len())
            .unwrap_or(0);

        if file_size > 0 {
            let bytes = std::fs::read(&cover_path)
                .map_err(|e| IncrementumError::Internal(format!("Failed to read cover: {}", e)))?;

            let _ = std::fs::remove_file(&cover_path);

            // Detect MIME type from file magic bytes
            let mime = if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
                "image/jpeg"
            } else if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
                "image/png"
            } else if bytes.starts_with(b"RIFF") && bytes.len() > 12 && &bytes[8..12] == b"WEBP" {
                "image/webp"
            } else {
                "image/jpeg"
            };

            let encoded = general_purpose::STANDARD.encode(&bytes);
            return Ok(Some(format!("data:{};base64,{}", mime, encoded)));
        } else {
            let _ = std::fs::remove_file(&cover_path);
        }
    }

    Ok(None)
}

/// Generate a transcript for an audiobook using Whisper (Tauri only)
#[tauri::command]
pub async fn generate_audiobook_transcript(
    app_handle: AppHandle,
    file_path: String,
    model: String,
    language: String,
) -> Result<AudiobookTranscriptResult> {
    let model_manager = ModelManager::new(&app_handle)
        .map_err(|e| IncrementumError::Internal(e.to_string()))?;

    let mut selected_model = model;
    if !model_manager.is_model_installed(&selected_model) {
        if let Some(fallback) = model_manager
            .list_profiles()
            .into_iter()
            .find(|p| model_manager.is_model_installed(&p.id))
        {
            selected_model = fallback.id;
        } else {
            return Err(IncrementumError::InvalidInput(format!(
                "Model '{}' is not installed. Download it in Settings > Audio Transcription.",
                selected_model
            )));
        }
    }

    let input_path = Path::new(&file_path);
    if !input_path.exists() {
        return Err(IncrementumError::NotFound(format!(
            "Audiobook file not found at path: {}",
            file_path
        )));
    }

    let engine = TranscriptionEngine::new(app_handle);
    let mut wav_path: Option<std::path::PathBuf> = None;

    let segments: Arc<Mutex<Vec<crate::transcription::engine::TranscriptSegment>>> =
        Arc::new(Mutex::new(Vec::new()));
    let segments_for_cb = segments.clone();

    let result = async {
        let prepared = engine
            .prepare_audio(input_path)
            .await
            .map_err(|e| IncrementumError::Internal(format!("Failed to prepare audio: {}", e)))?;
        wav_path = Some(prepared.clone());

        let model_path = model_manager.get_model_path(&selected_model);

        engine
            .transcribe(&prepared, &model_path, &language, move |seg| {
                if let Ok(mut guard) = segments_for_cb.lock() {
                    guard.push(seg);
                }
            })
            .await
            .map_err(|e| IncrementumError::Internal(format!("Transcription failed: {}", e)))?;

        Ok::<(), IncrementumError>(())
    }
    .await;

    if let Some(path) = wav_path {
        let _ = std::fs::remove_file(path);
    }

    result?;

    let mut segments_vec = {
        let mut segments = segments.lock().unwrap_or_else(|e| e.into_inner());
        segments.sort_by(|a, b| a.start_ms.cmp(&b.start_ms));
        segments.clone()
    };

    if segments_vec.is_empty() {
        return Ok(AudiobookTranscriptResult {
            segments: Vec::new(),
            language: if language == "auto" { None } else { Some(language) },
        });
    }

    let mut output_segments = Vec::with_capacity(segments_vec.len());
    for seg in segments_vec.drain(..) {
        let text = seg.text.trim().to_string();
        if text.is_empty() {
            continue;
        }

        output_segments.push(AudiobookTranscriptSegment {
            id: uuid::Uuid::new_v4().to_string(),
            text,
            start_time: seg.start_ms as f64 / 1000.0,
            end_time: seg.end_ms as f64 / 1000.0,
            confidence: Some(seg.confidence),
        });
    }

    Ok(AudiobookTranscriptResult {
        segments: output_segments,
        language: if language == "auto" { None } else { Some(language) },
    })
}
