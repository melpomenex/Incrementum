use tauri::{AppHandle, Manager};
use crate::error::{IncrementumError, Result};
use crate::database::Repository;
use crate::models::{Document, FileType, DocumentMetadata};
use std::path::Path;
use std::hash::{Hash, Hasher};
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

#[derive(Debug)]
struct ParsedAudiobookInfo {
    metadata: AudiobookMetadata,
    ffmpeg_stderr: String,
}

fn parse_duration_seconds(ffmpeg_stderr: &str) -> Option<f64> {
    let marker = "Duration:";
    let start = ffmpeg_stderr.find(marker)?;
    let remainder = ffmpeg_stderr[start + marker.len()..].trim_start();
    let raw = remainder.split(',').next()?.trim();
    let mut parts = raw.split(':');
    let hours = parts.next()?.trim().parse::<f64>().ok()?;
    let minutes = parts.next()?.trim().parse::<f64>().ok()?;
    let seconds = parts.next()?.trim().parse::<f64>().ok()?;
    Some(hours * 3600.0 + minutes * 60.0 + seconds)
}

fn parse_ffmetadata_output(filename: &str, output: &str, ffmpeg_stderr: &str) -> AudiobookMetadata {
    let mut metadata = AudiobookMetadata {
        title: filename.to_string(),
        author: None,
        narrator: None,
        duration: parse_duration_seconds(ffmpeg_stderr).unwrap_or(0.0),
        chapters: vec![],
        cover_url: None,
        description: None,
        publisher: None,
        publish_year: None,
        language: None,
        genre: None,
    };

    let mut current_section: Option<String> = None;
    let mut current_chapter: Option<(String, String, String, Option<String>)> = None;

    let finalize_chapter = |chapter: Option<(String, String, String, Option<String>)>, chapters: &mut Vec<AudiobookChapter>| {
        let Some((timebase, start, end, title)) = chapter else {
            return;
        };

        let parse_fraction = |value: &str| -> Option<f64> {
            let (num, den) = value.split_once('/')?;
            let numerator = num.trim().parse::<f64>().ok()?;
            let denominator = den.trim().parse::<f64>().ok()?;
            if denominator <= 0.0 {
                return None;
            }
            Some(numerator / denominator)
        };

        let timebase_seconds = parse_fraction(&timebase).unwrap_or(1.0);
        let start_raw = start.trim().parse::<f64>().ok();
        let end_raw = end.trim().parse::<f64>().ok();
        let start_time = start_raw.map(|v| v * timebase_seconds).unwrap_or(0.0);
        let end_time = end_raw.map(|v| v * timebase_seconds);
        let duration = end_time.map(|end| (end - start_time).max(0.0));

        chapters.push(AudiobookChapter {
            id: (chapters.len() as i32) + 1,
            title: title.unwrap_or_else(|| format!("Chapter {}", chapters.len() + 1)),
            start_time,
            end_time,
            duration,
        });
    };

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with(';') {
            continue;
        }

        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            if current_section.as_deref() == Some("CHAPTER") {
                finalize_chapter(current_chapter.take(), &mut metadata.chapters);
            }
            current_section = Some(trimmed.trim_matches(['[', ']']).to_string());
            if current_section.as_deref() == Some("CHAPTER") {
                current_chapter = Some((
                    "1/1000".to_string(),
                    "0".to_string(),
                    "0".to_string(),
                    None,
                ));
            }
            continue;
        }

        let Some((raw_key, raw_value)) = trimmed.split_once('=') else {
            continue;
        };

        let key = raw_key.trim().to_lowercase();
        let value = raw_value.trim().to_string();

        if current_section.as_deref() == Some("CHAPTER") {
            if let Some((timebase, start, end, title)) = current_chapter.as_mut() {
                match key.as_str() {
                    "timebase" => *timebase = value,
                    "start" => *start = value,
                    "end" => *end = value,
                    "title" => *title = Some(value),
                    _ => {}
                }
            }
            continue;
        }

        match key.as_str() {
            "title" => metadata.title = value,
            "artist" | "author" | "album_artist" => metadata.author = Some(value),
            "album" => {
                if metadata.title == filename {
                    metadata.title = value;
                }
            }
            "composer" => {
                if metadata.author.is_none() {
                    metadata.author = Some(value);
                }
            }
            "comment" | "description" => metadata.description = Some(value),
            "publisher" => metadata.publisher = Some(value),
            "language" => metadata.language = Some(value),
            "genre" => metadata.genre = Some(vec![value]),
            "date" | "creation_time" => {
                if let Ok(year) = value.chars().take(4).collect::<String>().parse::<i32>() {
                    metadata.publish_year = Some(year);
                }
            }
            _ => {}
        }
    }

    if current_section.as_deref() == Some("CHAPTER") {
        finalize_chapter(current_chapter.take(), &mut metadata.chapters);
    }

    if metadata.chapters.is_empty() {
        metadata.chapters.push(AudiobookChapter {
            id: 1,
            title: "Chapter 1".to_string(),
            start_time: 0.0,
            end_time: None,
            duration: None,
        });
    }

    metadata
}

async fn extract_audiobook_info(
    app_handle: &AppHandle,
    file_path: &str,
) -> Result<ParsedAudiobookInfo> {
    let path = Path::new(file_path);
    let filename = path.file_stem().unwrap_or_default().to_string_lossy().to_string();

    let (mut rx, _) = crate::utils::ffmpeg::ffmpeg_command(app_handle)?
        .args([
            "-i", file_path,
            "-f", "ffmetadata",
            "-"
        ])
        .spawn()?;

    let mut stdout = String::new();
    let mut stderr = String::new();

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) => stdout.push_str(&String::from_utf8_lossy(&line)),
            CommandEvent::Stderr(line) => stderr.push_str(&String::from_utf8_lossy(&line)),
            CommandEvent::Terminated(payload) => {
                if payload.code != Some(0) && stdout.trim().is_empty() {
                    return Err(IncrementumError::Internal(format!(
                        "ffmpeg metadata extraction failed for {}: {}",
                        file_path,
                        stderr.trim()
                    )));
                }
                break;
            }
            _ => {}
        }
    }

    let metadata = parse_ffmetadata_output(&filename, &stdout, &stderr);
    Ok(ParsedAudiobookInfo { metadata, ffmpeg_stderr: stderr })
}

#[tauri::command]
pub async fn parse_audiobook_metadata(
    app_handle: AppHandle,
    file_path: String,
) -> Result<AudiobookMetadata> {
    Ok(extract_audiobook_info(&app_handle, &file_path).await?.metadata)
}

#[tauri::command]
pub async fn import_podcast_audio_file(
    app_handle: AppHandle,
    file_path: String,
    title: Option<String>,
    language: Option<String>,
    model_id: Option<String>,
    auto_transcribe: Option<bool>,
    repo: State<'_, Repository>,
) -> Result<PodcastImportResult> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(IncrementumError::NotFound(format!("Podcast audio file not found: {}", file_path)));
    }

    // Copy to app-managed storage to avoid macOS sandbox issues
    let audio_dir = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("incrementum")
        .join("audio");
    std::fs::create_dir_all(&audio_dir)
        .map_err(|e| IncrementumError::Internal(format!("Failed to create audio directory: {}", e)))?;

    let timestamp = chrono::Utc::now().timestamp();
    let original_filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("audio");
    let safe_filename = original_filename.replace(['/', '\\', ':'], "_");
    let stored_filename = format!("{}-{}", timestamp, safe_filename);
    let dest_path = audio_dir.join(&stored_filename);

    std::fs::copy(path, &dest_path)
        .map_err(|e| IncrementumError::Internal(format!("Failed to copy audio file: {}", e)))?;

    let stored_path = dest_path.to_string_lossy().to_string();

    let default_title = path
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("Podcast Episode")
        .to_string();
    let mut document = Document::new(title.unwrap_or(default_title), stored_path.clone(), FileType::Audio);
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
        source: None,
        fetched_at: None,
        site_name: None,
        browser_import_mode: None,
        article_html: None,
        extracted_images: None,
        ..Default::default()
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
    let had_model = selected_model.is_some();
    if let Some(model_id) = selected_model {
        let model_path = model_manager.get_model_path(&model_id);
        let engine = TranscriptionEngine::new(app_handle.clone());
        let wav_path = engine
            .prepare_audio(&dest_path)
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
                None,
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

    // If no model was available for inline transcription, enqueue for auto-transcription
    if !had_model && auto_transcribe.unwrap_or(true) {
        if let Some(transcription_state) = app_handle.try_state::<crate::transcription::TranscriptionState>() {
            let m_id = model_id.unwrap_or_else(|| "distil-small.en".to_string());
            let entry = crate::models::TranscriptionQueueEntry::new(
                created.id.clone(),
                stored_path.clone(),
                "local".to_string(),
                m_id,
                language.as_deref().unwrap_or("en").to_string(),
            );
            if let Err(e) = transcription_state.auto_queue.enqueue(entry) {
                tracing::warn!("Failed to enqueue podcast transcription: {}", e);
            }
        }
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
    app_handle: AppHandle,
    file_path: String,
) -> Result<Vec<AudiobookChapter>> {
    Ok(extract_audiobook_info(&app_handle, &file_path).await?.metadata.chapters)
}

#[tauri::command]
pub async fn prepare_audiobook_playback(
    app_handle: AppHandle,
    file_path: String,
) -> Result<String> {
    let input_path = Path::new(&file_path);
    if !input_path.exists() {
        return Err(IncrementumError::NotFound(format!(
            "Audiobook file not found: {}",
            file_path
        )));
    }

    let ext = input_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_lowercase();

    if ext != "m4b" {
        return Ok(file_path);
    }

    let source_metadata = std::fs::metadata(input_path)
        .map_err(|e| IncrementumError::Internal(format!("Failed to stat audiobook file: {}", e)))?;
    let modified = source_metadata
        .modified()
        .ok()
        .and_then(|ts| ts.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs())
        .unwrap_or(0);

    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    file_path.hash(&mut hasher);
    source_metadata.len().hash(&mut hasher);
    modified.hash(&mut hasher);
    let cache_key = hasher.finish();

    let cache_dir = app_handle
        .path()
        .app_cache_dir()
        .map_err(|e| IncrementumError::Internal(format!("Failed to resolve cache dir: {}", e)))?
        .join("audiobook_playback");
    std::fs::create_dir_all(&cache_dir)
        .map_err(|e| IncrementumError::Internal(format!("Failed to create audiobook cache dir: {}", e)))?;

    let stem = input_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("audiobook");
    let sanitized_stem = stem
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '_' })
        .collect::<String>();
    let output_path = cache_dir.join(format!("{sanitized_stem}-{cache_key}.mp3"));

    if output_path.exists() {
        return Ok(output_path.to_string_lossy().to_string());
    }

    let output_str = output_path.to_string_lossy().to_string();
    let (mut rx, _) = crate::utils::ffmpeg::ffmpeg_command(&app_handle)
        .map_err(|e| IncrementumError::Internal(format!("Failed to get ffmpeg command: {}", e)))?
        .args([
            "-y",
            "-i", &file_path,
            "-vn",
            "-map_metadata", "-1",
            "-c:a", "libmp3lame",
            "-b:a", "96k",
            &output_str
        ])
        .spawn()
        .map_err(|e| IncrementumError::Internal(format!("Failed to spawn ffmpeg: {}", e)))?;

    let mut stderr = String::new();
    let mut exit_code = None;
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stderr(line) => stderr.push_str(&String::from_utf8_lossy(&line)),
            CommandEvent::Terminated(payload) => {
                exit_code = payload.code;
                break;
            }
            _ => {}
        }
    }

    if exit_code != Some(0) || !output_path.exists() {
        let _ = std::fs::remove_file(&output_path);
        return Err(IncrementumError::Internal(format!(
            "Failed to prepare m4b playback. ffmpeg output: {}",
            stderr.trim()
        )));
    }

    Ok(output_str)
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
            cover_path.to_str().expect("cover path is valid UTF-8")
        ])
        .spawn()
        .map_err(|e| IncrementumError::Internal(format!("Failed to spawn ffmpeg: {}", e)))?;

    // Wait for ffmpeg to finish
    while let Some(event) = rx.recv().await {
        if let CommandEvent::Terminated(_) = event {
            break;
        }
    }

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
        let is_moonshine = selected_model.starts_with("moonshine-");

        if is_moonshine {
            engine.transcribe_moonshine(&prepared, &model_path, &language, move |seg| {
                if let Ok(mut guard) = segments_for_cb.lock() {
                    guard.push(seg);
                }
            }, None)
            .await
            .map_err(|e| IncrementumError::Internal(format!("Transcription failed: {}", e)))?;
        } else {
            engine
                .transcribe(&prepared, &model_path, &language, move |seg| {
                    if let Ok(mut guard) = segments_for_cb.lock() {
                        guard.push(seg);
                    }
                }, None)
                .await
                .map_err(|e| IncrementumError::Internal(format!("Transcription failed: {}", e)))?;
        }

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
