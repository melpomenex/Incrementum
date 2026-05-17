//! Document commands

use tauri::State;
use crate::database::Repository;
use crate::algorithms::calculate_document_priority_score;
use crate::error::{Result, IncrementumError};
use crate::models::{Document, FileType, DocumentMetadata, Extract};
use crate::commands::anna_archive::AnnaArchiveClient;
use crate::processor;
use crate::youtube;
use std::path::{PathBuf, Path};
use lopdf::{Document as LoDocument, Object};

/// Copy a media file to app-managed storage so it survives macOS sandbox revocation.
/// Returns the destination path.
fn copy_media_to_app_storage(source_path: &str, subdir: &str) -> Result<PathBuf> {
    let source = Path::new(source_path);
    if !source.exists() {
        return Err(IncrementumError::NotFound(format!("Source file not found: {}", source_path)));
    }

    let dest_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("incrementum")
        .join(subdir);

    std::fs::create_dir_all(&dest_dir)
        .map_err(|e| IncrementumError::Internal(format!("Failed to create {} directory: {}", subdir, e)))?;

    let timestamp = chrono::Utc::now().timestamp();
    let original_filename = source
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("media");
    let safe_filename = original_filename.replace(['/', '\\', ':'], "_");
    let stored_filename = format!("{}-{}", timestamp, safe_filename);
    let dest_path = dest_dir.join(&stored_filename);

    std::fs::copy(source, &dest_path)
        .map_err(|e| IncrementumError::Internal(format!("Failed to copy file: {}", e)))?;

    Ok(dest_path)
}

fn build_youtube_thumbnail_url(video_id: &str) -> String {
    format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", video_id)
}

fn suggest_auto_tags(title: &str, content: &str) -> Vec<String> {
    let corpus = format!("{} {}", title.to_lowercase(), content.to_lowercase());
    let mut tags = Vec::new();
    let candidates = [
        ("math", vec!["equation", "theorem", "calculus", "algebra"]),
        ("history", vec!["century", "empire", "war", "revolution"]),
        ("biology", vec!["cell", "protein", "genome", "species"]),
        ("language", vec!["vocabulary", "grammar", "translation", "sentence"]),
        ("computer-science", vec!["algorithm", "compiler", "database", "programming"]),
    ];
    for (tag, keywords) in candidates {
        if keywords.iter().any(|keyword| corpus.contains(keyword)) {
            tags.push(tag.to_string());
        }
    }
    tags.push("auto-tagged".to_string());
    tags
}

async fn resolve_cover_for_document(
    doc: &Document,
    allow_anna: bool,
) -> Result<(Option<String>, Option<String>)> {
    if let Some(url) = &doc.cover_image_url {
        return Ok((Some(url.clone()), doc.cover_image_source.clone()));
    }

    match doc.file_type {
        FileType::Pdf => {
            if let Ok(Some(url)) = processor::pdf::extract_pdf_cover_data_url(&doc.file_path).await {
                return Ok((Some(url), Some("embedded".to_string())));
            }
        }
        FileType::Epub => {
            if let Ok(Some(url)) = processor::epub::extract_epub_cover_data_url(&doc.file_path).await {
                return Ok((Some(url), Some("embedded".to_string())));
            }
        }
        FileType::Youtube => {
            if let Some(video_id) = youtube::extract_video_id(&doc.file_path) {
                return Ok((Some(build_youtube_thumbnail_url(&video_id)), Some("youtube".to_string())));
            }
        }
        _ => {}
    }

    if allow_anna && matches!(doc.file_type, FileType::Pdf | FileType::Epub | FileType::Markdown | FileType::Html | FileType::Other) {
        let author = doc.metadata.as_ref().and_then(|meta| meta.author.clone());
        let query = if let Some(author) = author {
            format!("{} {}", doc.title, author)
        } else {
            doc.title.clone()
        };

        if !query.trim().is_empty() {
            let client = AnnaArchiveClient::new();
            if let Ok(results) = client.search_books(&query, 5).await {
                if let Some(result) = results.into_iter().find(|item| item.cover_url.as_ref().map(|u| !u.is_empty()).unwrap_or(false)) {
                    return Ok((result.cover_url, Some("anna".to_string())));
                }
            }
        }
    }

    if allow_anna {
        return Ok((None, Some("fallback".to_string())));
    }

    Ok((None, None))
}

#[tauri::command]
pub async fn open_file_picker(
    _title: Option<String>,
    _multiple: Option<bool>,
) -> Result<Vec<String>> {
    // This will be handled by the frontend using Tauri's dialog API
    // The command is a placeholder for future backend processing if needed
    Ok(vec![])
}

#[tauri::command]
pub async fn import_document(
    file_path: String,
    collection_id: Option<String>,
    repo: State<'_, Repository>,
) -> Result<Document> {
    let path = PathBuf::from(&file_path);

    // Determine file type from extension
    let file_type = match path.extension()
        .and_then(|ext| ext.to_str())
        .map(|s| s.to_lowercase())
        .as_deref() {
        Some("pdf") => FileType::Pdf,
        Some("epub") => FileType::Epub,
        Some("md") | Some("markdown") => FileType::Markdown,
        Some("html") | Some("htm") => FileType::Html,
        Some("mp3") | Some("wav") | Some("m4a") | Some("aac") | Some("ogg") | Some("flac") | Some("opus") | Some("m4b") | Some("wma") => FileType::Audio,
        Some("mp4") | Some("webm") | Some("mov") | Some("avi") => FileType::Video,
        _ => FileType::Other,
    };

    // Extract content from the file
    let extracted = processor::extract_content(&file_path, file_type.clone()).await?;

    // For media files, copy to app-managed storage to avoid macOS sandbox issues
    let stored_path = match file_type {
        FileType::Audio => copy_media_to_app_storage(&file_path, "audio")?.to_string_lossy().to_string(),
        _ => file_path.clone(),
    };

    // Generate content hash for duplicate detection
    let content_hash = if !extracted.text.is_empty() {
        Some(processor::generate_content_hash(&extracted.text))
    } else {
        None
    };

    // Check for duplicate by content hash
    if let Some(ref hash) = content_hash {
        let existing_docs = repo.list_documents().await?;
        if let Some(duplicate) = existing_docs.iter().find(|d| d.content_hash.as_ref() == Some(hash)) {
            return Err(crate::error::IncrementumError::NotFound(format!(
                "Duplicate document detected: Already imported as '{}'",
                duplicate.title
            )));
        }
    }

    // Use extracted title or fall back to filename
    let title = extracted.title.clone().unwrap_or_else(|| {
        path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled")
            .to_string()
    });

    // Create metadata from extracted info
    let metadata = Some(DocumentMetadata {
        author: extracted.author,
        subject: None,
        keywords: None,
        created_at: None,
        modified_at: None,
        file_size: None,
        language: None,
        page_count: extracted.page_count.map(|p| p as i32),
        word_count: None,
        source: None,
        fetched_at: None,
        site_name: None,
        browser_import_mode: None,
        article_html: None,
        extracted_images: None,
    });

    // Create the document
    let mut doc = Document::with_collection(title, stored_path, file_type, collection_id.clone());
    doc.content = Some(extracted.text);
    doc.tags = suggest_auto_tags(&doc.title, doc.content.as_deref().unwrap_or(""));
    doc.content_hash = content_hash;
    doc.total_pages = extracted.page_count.map(|p| p as i32);
    doc.metadata = metadata;
    let (cover_url, cover_source) = resolve_cover_for_document(&doc, false).await?;
    doc.cover_image_url = cover_url;
    doc.cover_image_source = cover_source;

    let created = repo.create_document(&doc).await?;

    Ok(created)
}

#[tauri::command]
pub async fn import_documents(
    file_paths: Vec<String>,
    collection_id: Option<String>,
    repo: State<'_, Repository>,
) -> Result<Vec<Document>> {
    let mut imported = Vec::new();

    for file_path in file_paths {
        let path_clone = file_path.clone();
        let coll_id = collection_id.clone();
        match import_document(file_path, coll_id, repo.clone()).await {
            Ok(doc) => imported.push(doc),
            Err(e) => {
                eprintln!("Failed to import {}: {}", path_clone, e);
                // Continue with other files
            }
        }
    }

    Ok(imported)
}

fn pdf_object_to_text(object: &Object) -> Option<String> {
    match object {
        Object::String(bytes, _) => Some(String::from_utf8_lossy(bytes).to_string()),
        Object::Name(bytes) => Some(String::from_utf8_lossy(bytes).to_string()),
        _ => None,
    }
}

#[tauri::command]
pub async fn import_pdf_highlights_as_extracts(
    document_id: String,
    repo: State<'_, Repository>,
) -> Result<i32> {
    let document = repo.get_document(&document_id).await?
        .ok_or_else(|| IncrementumError::NotFound(format!("Document {} not found", document_id)))?;

    if !matches!(document.file_type, FileType::Pdf) {
        return Err(IncrementumError::InvalidInput("Highlight import is only supported for PDF documents".to_string()));
    }

    let pdf = LoDocument::load(&document.file_path)
        .map_err(|e| IncrementumError::Internal(format!("Failed to open PDF: {}", e)))?;
    let mut imported_count = 0_i32;

    for (page_number, page_id) in pdf.get_pages() {
        let page_obj = match pdf.get_object(page_id) {
            Ok(obj) => obj,
            Err(_) => continue,
        };
        let page_dict = match page_obj.as_dict() {
            Ok(dict) => dict,
            Err(_) => continue,
        };

        let annots_obj = match page_dict.get(b"Annots") {
            Ok(obj) => obj,
            Err(_) => continue,
        };
        let annots_array = match annots_obj {
            Object::Array(arr) => arr.clone(),
            Object::Reference(reference) => match pdf.get_object(*reference) {
                Ok(Object::Array(arr)) => arr.clone(),
                _ => Vec::new(),
            },
            _ => Vec::new(),
        };

        for annot in annots_array {
            let reference = match annot.as_reference() {
                Ok(reference) => reference,
                Err(_) => continue,
            };
            let annot_obj = match pdf.get_object(reference) {
                Ok(obj) => obj,
                Err(_) => continue,
            };
            let annot_dict = match annot_obj.as_dict() {
                Ok(dict) => dict,
                Err(_) => continue,
            };

            let subtype = annot_dict
                .get(b"Subtype")
                .ok()
                .and_then(pdf_object_to_text)
                .unwrap_or_default();
            let normalized_subtype = subtype.trim_start_matches('/').to_lowercase();
            if !matches!(normalized_subtype.as_str(), "highlight" | "underline" | "text" | "squiggly") {
                continue;
            }

            let contents = annot_dict
                .get(b"Contents")
                .ok()
                .and_then(pdf_object_to_text)
                .unwrap_or_else(|| format!("Imported highlight on page {}", page_number));

            let mut extract = Extract::new(document_id.clone(), contents);
            extract.page_number = Some(page_number as i32);
            extract.highlight_color = Some("imported".to_string());
            extract.tags.push("imported-highlight".to_string());
            repo.create_extract(&extract).await?;
            imported_count += 1;
        }
    }

    Ok(imported_count)
}

#[tauri::command]
pub async fn get_documents(
    collection_id: Option<String>,
    repo: State<'_, Repository>,
) -> Result<Vec<Document>> {
    let docs = match collection_id {
        Some(ref cid) => repo.list_documents_by_collection(cid).await?,
        None => repo.list_documents().await?,
    };
    Ok(docs)
}

#[tauri::command]
pub async fn get_document(
    id: String,
    repo: State<'_, Repository>,
) -> Result<Option<Document>> {
    let mut doc = match repo.get_document(&id).await? {
        Some(doc) => doc,
        None => return Ok(None),
    };

    let has_epub_placeholder = doc
        .content
        .as_ref()
        .map(|content| {
            let normalized = content.trim();
            normalized.starts_with("EPUB file loaded (")
                && normalized.contains("Full content extraction requires additional EPUB library integration.")
        })
        .unwrap_or(false);

    let needs_content = doc
        .content
        .as_ref()
        .map(|content| content.trim().is_empty())
        .unwrap_or(true)
        || has_epub_placeholder;

    if needs_content && matches!(doc.file_type, FileType::Epub | FileType::Markdown | FileType::Html) {
        if let Ok(extracted) = processor::extract_content(&doc.file_path, doc.file_type.clone()).await {
            if !extracted.text.trim().is_empty() {
                let content_hash = Some(processor::generate_content_hash(&extracted.text));
                let metadata = Some(DocumentMetadata {
                    author: extracted.author.clone(),
                    subject: None,
                    keywords: None,
                    created_at: None,
                    modified_at: None,
                    file_size: None,
                    language: extracted
                        .metadata
                        .get("language")
                        .and_then(|value| value.as_str())
                        .map(|value| value.to_string()),
                    page_count: extracted.page_count.map(|p| p as i32),
                    word_count: None,
                    source: None,
                    fetched_at: None,
                    site_name: None,
                    browser_import_mode: None,
                    article_html: None,
                    extracted_images: None,
                });

                repo.update_document_content(
                    &doc.id,
                    &extracted.text,
                    content_hash.clone(),
                    extracted.page_count.map(|p| p as i32),
                    metadata.clone(),
                )
                .await?;

                doc.content = Some(extracted.text);
                doc.content_hash = content_hash;
                doc.total_pages = extracted.page_count.map(|p| p as i32);
                doc.metadata = metadata;
            }
        }
    }

    Ok(Some(doc))
}

#[tauri::command]
pub async fn resolve_document_cover(
    id: String,
    repo: State<'_, Repository>,
) -> Result<Option<Document>> {
    let mut doc = match repo.get_document(&id).await? {
        Some(doc) => doc,
        None => return Ok(None),
    };

    if doc.cover_image_url.is_some() {
        return Ok(Some(doc));
    }

    let (cover_url, cover_source) = resolve_cover_for_document(&doc, true).await?;
    if cover_url.is_some() || cover_source.is_some() {
        repo.update_document_cover(&doc.id, cover_url.clone(), cover_source.clone()).await?;
        doc.cover_image_url = cover_url;
        doc.cover_image_source = cover_source;
    }

    Ok(Some(doc))
}

#[tauri::command]
pub async fn create_document(
    title: String,
    file_path: String,
    file_type: String,
    collection_id: Option<String>,
    repo: State<'_, Repository>,
) -> Result<Document> {
    let file_type = match file_type.as_str() {
        "pdf" => FileType::Pdf,
        "epub" => FileType::Epub,
        "markdown" => FileType::Markdown,
        "html" => FileType::Html,
        "youtube" => FileType::Youtube,
        "audio" => FileType::Audio,
        "video" => FileType::Video,
        _ => FileType::Other,
    };

    let doc = Document::with_collection(title, file_path, file_type, collection_id);
    let created = repo.create_document(&doc).await?;
    Ok(created)
}

#[tauri::command]
pub async fn update_document(
    id: String,
    updates: Document,
    repo: State<'_, Repository>,
) -> Result<Document> {
    let updated = repo.update_document(&id, &updates).await?;
    Ok(updated)
}

#[tauri::command]
pub async fn update_document_content(
    id: String,
    content: String,
    repo: State<'_, Repository>,
) -> Result<Document> {
    repo.update_document_content(&id, &content, None, None, None).await?;
    repo.get_document(&id)
        .await?
        .ok_or_else(|| crate::error::IncrementumError::NotFound(format!("Document {}", id)))
}

#[tauri::command]
pub async fn update_document_priority(
    id: String,
    rating: i32,
    slider: i32,
    repo: State<'_, Repository>,
) -> Result<Document> {
    let rating_value = if (1..=4).contains(&rating) { rating } else { 0 };
    let slider_value = slider.clamp(0, 100);
    let score = calculate_document_priority_score(
        if rating_value > 0 { Some(rating_value) } else { None },
        slider_value,
    );

    let updated = repo
        .update_document_priority(&id, rating_value, slider_value, score)
        .await?;
    Ok(updated)
}

/// Update the current page/progress of a document
/// For YouTube videos, this stores the current playback position in seconds
#[tauri::command]
pub async fn update_document_progress(
    id: String,
    current_page: Option<i32>,
    current_scroll_percent: Option<f64>,
    current_cfi: Option<String>,
    current_view_state: Option<String>,
    repo: State<'_, Repository>,
) -> Result<Document> {
    let updated = repo
        .update_document_progress(&id, current_page, current_scroll_percent, current_cfi, current_view_state)
        .await?;
    Ok(updated)
}

#[derive(serde::Serialize)]
pub struct TextExtractionResult {
    pub content: String,
    pub extracted: bool,
}

/// Extract text content from a document (for documents without content)
/// Returns the extracted text and whether it was newly extracted
#[tauri::command]
pub async fn extract_document_text(
    id: String,
    repo: State<'_, Repository>,
) -> Result<TextExtractionResult> {
    // Get the document
    let mut doc = repo.get_document(&id).await?
        .ok_or_else(|| crate::error::IncrementumError::NotFound(format!(
            "Document not found: {}", id
        )))?;

    // Check if we already have content
    if let Some(content) = &doc.content {
        if !content.trim().is_empty() {
            return Ok(TextExtractionResult {
                content: content.clone(),
                extracted: false,
            });
        }
    }

    // Skip file-based extraction for URL-based documents (web pages, YouTube, RSS, etc.)
    if doc.file_path.starts_with("http://") || doc.file_path.starts_with("https://") {
        return Ok(TextExtractionResult {
            content: String::new(),
            extracted: false,
        });
    }

    // Extract content
    let extracted = processor::extract_content(&doc.file_path, doc.file_type.clone()).await?;
    
    if extracted.text.trim().is_empty() {
        return Ok(TextExtractionResult {
            content: String::new(),
            extracted: false,
        });
    }

    // Update document with extracted content
    let content_hash = Some(processor::generate_content_hash(&extracted.text));
    let metadata = Some(DocumentMetadata {
        author: extracted.author.clone().or(doc.metadata.as_ref().and_then(|m| m.author.clone())),
        subject: None,
        keywords: None,
        created_at: None,
        modified_at: None,
        file_size: None,
        language: extracted.metadata.get("language")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .or(doc.metadata.as_ref().and_then(|m| m.language.clone())),
        page_count: extracted.page_count.map(|p| p as i32).or(doc.metadata.as_ref().and_then(|m| m.page_count)),
        word_count: None,
        source: doc.metadata.as_ref().and_then(|m| m.source.clone()),
        fetched_at: doc.metadata.as_ref().and_then(|m| m.fetched_at),
        site_name: doc.metadata.as_ref().and_then(|m| m.site_name.clone()),
        browser_import_mode: doc.metadata.as_ref().and_then(|m| m.browser_import_mode.clone()),
        article_html: doc.metadata.as_ref().and_then(|m| m.article_html.clone()),
        extracted_images: doc.metadata.as_ref().and_then(|m| m.extracted_images.clone()),
    });

    repo.update_document_content(
        &doc.id,
        &extracted.text,
        content_hash.clone(),
        extracted.page_count.map(|p| p as i32),
        metadata.clone(),
    ).await?;

    Ok(TextExtractionResult {
        content: extracted.text,
        extracted: true,
    })
}

#[tauri::command]
pub async fn delete_document(
    id: String,
    repo: State<'_, Repository>,
) -> Result<()> {
    repo.delete_document(&id).await?;
    Ok(())
}

#[tauri::command]
pub async fn dismiss_document(
    id: String,
    dismissed: bool,
    repo: State<'_, Repository>,
) -> Result<Document> {
    let updated = repo.update_document_dismiss(&id, dismissed).await?;
    Ok(updated)
}

#[tauri::command]
pub async fn read_document_file(
    file_path: String,
) -> Result<String> {
    use std::fs;
    use base64::{Engine as _, engine::general_purpose};

    let bytes = match fs::read(&file_path) {
        Ok(bytes) => bytes,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Err(crate::error::IncrementumError::NotFound(format!(
                "Document file not found: {}",
                file_path
            )));
        }
        Err(e) => {
            return Err(crate::error::IncrementumError::Internal(format!(
                "Failed to read file: {}",
                e
            )));
        }
    };

    let base64_string = general_purpose::STANDARD.encode(&bytes);
    Ok(base64_string)
}

/// Result from fetching URL content
#[derive(serde::Serialize)]
pub struct FetchedUrlContent {
    pub file_path: String,
    pub file_name: String,
    pub content_type: String,
}

/// Result from converting PDF to HTML
#[derive(serde::Serialize)]
pub struct PdfToHtmlResult {
    /// The generated HTML content
    pub html_content: String,
    /// Path where the HTML file was saved (if save_to_file was true)
    pub saved_path: Option<String>,
    /// The original PDF filename
    pub original_filename: String,
}

/// Convert a PDF document to HTML format for better text selection and extraction
/// This creates a structured HTML document that preserves the text content with proper styling
#[tauri::command]
pub async fn convert_pdf_to_html(
    file_path: String,
    save_to_file: Option<bool>,
    output_path: Option<String>,
) -> Result<PdfToHtmlResult> {
    use std::path::Path;

    let path = Path::new(&file_path);
    let original_filename = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("document.pdf")
        .to_string();

    // Convert PDF to HTML
    let html_content = processor::pdf::convert_pdf_to_html(&file_path).await?;

    // Optionally save to file
    let saved_path = if save_to_file.unwrap_or(false) {
        Some(processor::pdf::save_pdf_as_html(&file_path, output_path.as_deref()).await?)
    } else {
        None
    };

    Ok(PdfToHtmlResult {
        html_content,
        saved_path,
        original_filename,
    })
}

/// Convert a PDF document by ID to HTML format
#[tauri::command]
pub async fn convert_document_pdf_to_html(
    id: String,
    save_to_file: Option<bool>,
    output_path: Option<String>,
    repo: State<'_, Repository>,
) -> Result<PdfToHtmlResult> {
    use std::path::Path;

    // Get the document
    let doc = repo.get_document(&id).await?
        .ok_or_else(|| crate::error::IncrementumError::NotFound(format!(
            "Document not found: {}", id
        )))?;

    // Verify it's a PDF
    if !matches!(doc.file_type, FileType::Pdf) {
        return Err(crate::error::IncrementumError::Internal(
            "Document is not a PDF".to_string()
        ));
    }

    let path = Path::new(&doc.file_path);
    let original_filename = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("document.pdf")
        .to_string();

    // Convert PDF to HTML
    let html_content = processor::pdf::convert_pdf_to_html(&doc.file_path).await?;

    // Optionally save to file
    let saved_path = if save_to_file.unwrap_or(false) {
        Some(processor::pdf::save_pdf_as_html(&doc.file_path, output_path.as_deref()).await?)
    } else {
        None
    };

    Ok(PdfToHtmlResult {
        html_content,
        saved_path,
        original_filename,
    })
}

/// Fetch a web page preview (title, description, favicon) for URL import
#[tauri::command]
pub async fn fetch_web_page_preview(url: String) -> Result<serde_json::Value> {
    use regex::Regex;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent("Incrementum/1.0 (https://incrementum.app)")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client.get(&url).send().await
        .map_err(|e| format!("Failed to fetch URL: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()).into());
    }

    let body = response.text().await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    // Extract title
    let title = Regex::new(r"<title[^>]*>([^<]+)</title>")
        .ok()
        .and_then(|re| re.captures(&body).map(|c| c[1].trim().to_string()))
        .unwrap_or_default();

    // Extract meta description (prefer og:description)
    let description = Regex::new(r#"<meta[^>]+property\s*=\s*["']og:description["'][^>]+content\s*=\s*["']([^"']+)["']"#)
        .ok()
        .and_then(|re| re.captures(&body).map(|c| c[1].trim().to_string()))
        .or_else(|| {
            Regex::new(r#"<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+name\s*=\s*["']description["']"#)
                .ok()
                .and_then(|re| re.captures(&body).map(|c| c[1].trim().to_string()))
        })
        .or_else(|| {
            Regex::new(r#"<meta[^>]+name\s*=\s*["']description["'][^>]+content\s*=\s*["']([^"']+)["']"#)
                .ok()
                .and_then(|re| re.captures(&body).map(|c| c[1].trim().to_string()))
        })
        .unwrap_or_default();

    // Extract og:image
    let image = Regex::new(r#"<meta[^>]+property\s*=\s*["']og:image["'][^>]+content\s*=\s*["']([^"']+)["']"#)
        .ok()
        .and_then(|re| re.captures(&body).map(|c| c[1].trim().to_string()))
        .or_else(|| {
            Regex::new(r#"<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+property\s*=\s*["']og:image["']"#)
                .ok()
                .and_then(|re| re.captures(&body).map(|c| c[1].trim().to_string()))
        });

    // Extract favicon
    let favicon = Regex::new(r#"<link[^>]+rel\s*=\s*["'][^"']*icon[^"']*["'][^>]+href\s*=\s*["']([^"']+)["']"#)
        .ok()
        .and_then(|re| re.captures(&body).map(|c| c[1].trim().to_string()))
        .or_else(|| {
            Regex::new(r#"<link[^>]+href\s*=\s*["']([^"']+)["'][^>]+rel\s*=\s*["'][^"']*icon[^"']*["']"#)
                .ok()
                .and_then(|re| re.captures(&body).map(|c| c[1].trim().to_string()))
        })
        .map(|href| {
            if href.starts_with("http://") || href.starts_with("https://") {
                href
            } else if href.starts_with("//") {
                format!("https:{}", href)
            } else {
                url.parse::<reqwest::Url>().ok()
                    .map(|u| format!("{}://{}", u.scheme(), u.host_str().unwrap_or("")))
                    .map(|base| format!("{}/{}", base.trim_end_matches('/'), href.trim_start_matches('/')))
                    .unwrap_or(href)
            }
        });

    Ok(serde_json::json!({
        "url": url,
        "title": title,
        "description": description,
        "image": image,
        "favicon": favicon,
    }))
}

/// Fetch content from a URL and save it to a temporary location
/// Used for Arxiv PDF downloads and URL-based imports
#[tauri::command]
pub async fn fetch_url_content(url: String) -> Result<FetchedUrlContent> {
    use reqwest;
    use std::time::Duration;

    // Parse URL to determine file name
    let url_parsed = url.parse::<reqwest::Url>()
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Invalid URL: {}", e)))?;

    // Extract filename from URL or generate one
    let file_name = url_parsed
        .path_segments()
        .and_then(|mut segments| segments.next_back())
        .unwrap_or("download")
        .to_string();

    // Determine content type from URL extension
    let content_type = if file_name.ends_with(".pdf") {
        "pdf"
    } else if file_name.ends_with(".epub") {
        "epub"
    } else if file_name.ends_with(".md") || file_name.ends_with(".markdown") {
        "markdown"
    } else if file_name.ends_with(".html") || file_name.ends_with(".htm") {
        "html"
    } else {
        // Try to determine from content type header
        "unknown"
    };

    // Create a temporary directory for downloads
    let temp_dir = std::env::temp_dir();
    let download_dir = temp_dir.join("incrementum-downloads");

    std::fs::create_dir_all(&download_dir)
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to create download directory: {}", e)))?;

    // Generate a unique filename
    let timestamp = chrono::Utc::now().timestamp();
    let unique_filename = format!("{}-{}", timestamp, file_name);
    let file_path = download_dir.join(&unique_filename);

    // Download the file
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .user_agent("Incrementum/1.0 (https://incrementum.app)")
        .build()
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to create HTTP client: {}", e)))?;

    let response = client.get(&url)
        .send()
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to fetch URL: {}", e)))?;

    if !response.status().is_success() {
        return Err(crate::error::IncrementumError::Internal(format!(
            "HTTP error: {}",
            response.status()
        )));
    }

    // Get content type from response if unknown
    let final_content_type = if content_type == "unknown" {
        response
            .headers()
            .get("content-type")
            .and_then(|ct| ct.to_str().ok())
            .unwrap_or("")
            .to_string()
    } else {
        content_type.to_string()
    };

    // Save the downloaded content
    let bytes = response
        .bytes()
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to download content: {}", e)))?;

    std::fs::write(&file_path, &bytes)
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to save downloaded file: {}", e)))?;

    Ok(FetchedUrlContent {
        file_path: file_path.to_string_lossy().to_string(),
        file_name,
        content_type: final_content_type,
    })
}
