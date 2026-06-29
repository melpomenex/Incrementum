//! Segmentation commands

use tauri::State;
use crate::database::Repository;
use crate::error::Result;
use crate::segmentation::{DocumentSegmenter, SegmentConfig, SegmentationMethod, SegmentationResult};
use crate::models::{Document, DocumentMetadata};
use chrono::{Utc, Duration};

/// Segment a document into extracts
#[tauri::command]
pub async fn segment_document(
    document_id: String,
    method: String,
    target_length: usize,
    overlap: usize,
    repo: State<'_, Repository>,
) -> Result<SegmentationResult> {
    let doc = repo.get_document(&document_id).await?
        .ok_or_else(|| crate::error::IncrementumError::NotFound("Document not found".to_string()))?;

    let content = doc.content.unwrap_or_default();
    if content.is_empty() {
        return Err(crate::error::IncrementumError::Internal("Document has no content".to_string()));
    }

    let segmentation_method = match method.as_str() {
        "semantic" => SegmentationMethod::Semantic,
        "paragraph" => SegmentationMethod::Paragraph,
        "fixed" => SegmentationMethod::Fixed,
        "smart" => SegmentationMethod::Smart,
        _ => SegmentationMethod::Smart,
    };

    let config = SegmentConfig {
        method: segmentation_method,
        target_length,
        overlap,
        min_length: 50,
        max_length: 1000,
    };

    let segmenter = DocumentSegmenter::new(config);
    let result = segmenter.segment(&content)?;

    Ok(result)
}

/// Auto-segment and create extracts from document
#[tauri::command]
pub async fn auto_segment_and_create_extracts(
    document_id: String,
    method: Option<String>,
    target_length: Option<usize>,
    overlap: Option<usize>,
    repo: State<'_, Repository>,
) -> Result<Vec<String>> {
    let doc = repo.get_document(&document_id).await?
        .ok_or_else(|| crate::error::IncrementumError::NotFound("Document not found".to_string()))?;

    let content = doc.content.unwrap_or_default();
    if content.is_empty() {
        return Err(crate::error::IncrementumError::Internal("Document has no content".to_string()));
    }

    let mut config = SegmentConfig::default();
    if let Some(m) = method {
        config.method = match m.as_str() {
            "semantic" => SegmentationMethod::Semantic,
            "paragraph" => SegmentationMethod::Paragraph,
            "fixed" => SegmentationMethod::Fixed,
            "smart" => SegmentationMethod::Smart,
            _ => SegmentationMethod::Smart,
        };
    }
    if let Some(t) = target_length {
        config.target_length = t;
    }
    if let Some(o) = overlap {
        config.overlap = o;
    }
    let segmenter = DocumentSegmenter::new(config);
    let result = segmenter.segment(&content)?;

    let mut extract_ids = Vec::new();

    for segment in result.segments {
        let extract_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        sqlx::query(
            r#"
            INSERT INTO extracts (id, document_id, content, page_title, date_created, date_modified)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            "#,
        )
        .bind(&extract_id)
        .bind(&document_id)
        .bind(&segment.content)
        .bind(&segment.chapter_title)
        .bind(&now)
        .bind(&now)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to create extract: {}", e)))?;

        extract_ids.push(extract_id);
    }

    Ok(extract_ids)
}

/// Get segmentation preview (first N segments)
#[tauri::command]
pub async fn preview_segmentation(
    content: String,
    method: String,
    target_length: usize,
    overlap: usize,
    max_segments: usize,
) -> Result<SegmentationResult> {
    let segmentation_method = match method.as_str() {
        "semantic" => SegmentationMethod::Semantic,
        "paragraph" => SegmentationMethod::Paragraph,
        "fixed" => SegmentationMethod::Fixed,
        "smart" => SegmentationMethod::Smart,
        _ => SegmentationMethod::Smart,
    };

    let config = SegmentConfig {
        method: segmentation_method,
        target_length,
        overlap,
        min_length: 50,
        max_length: 1000,
    };

    let segmenter = DocumentSegmenter::new(config);
    let mut result = segmenter.segment(&content)?;

    // Limit segments for preview
    if result.segments.len() > max_segments {
        result.segments.truncate(max_segments);
        result.segment_count = max_segments;
    }

    Ok(result)
}

/// Extract key points from text
#[tauri::command]
pub async fn extract_key_points_from_text(
    text: String,
    max_points: usize,
) -> Result<Vec<String>> {
    crate::segmentation::extract_key_points(&text, max_points).await
}

/// Batch segment multiple documents
#[tauri::command]
pub async fn batch_segment_documents(
    document_ids: Vec<String>,
    method: String,
    target_length: usize,
    overlap: usize,
    repo: State<'_, Repository>,
) -> Result<Vec<(String, SegmentationResult)>> {
    let mut results = Vec::new();

    for doc_id in document_ids {
        match segment_document(
            doc_id.clone(),
            method.clone(),
            target_length,
            overlap,
            repo.clone(),
        )
        .await
        {
            Ok(result) => {
                results.push((doc_id, result));
            }
            Err(e) => {
                eprintln!("Failed to segment document {}: {}", doc_id, e);
                // Continue with other documents
            }
        }
    }

    Ok(results)
}

/// Get recommended segmentation settings for document type
#[tauri::command]
pub async fn get_recommended_segmentation(
    file_type: String,
    content_length: usize,
) -> Result<SegmentConfig> {
    let (method, target_length, overlap) = match file_type.as_str() {
        "pdf" => {
            // PDFs often have clear page/section boundaries
            (SegmentationMethod::Smart, 300, 30)
        }
        "epub" => {
            // EPUBs have chapter structure
            (SegmentationMethod::Paragraph, 400, 0)
        }
        "markdown" => {
            (SegmentationMethod::Smart, 250, 20)
        }
        _ => {
            // Default: adaptive based on length
            if content_length < 5000 {
                (SegmentationMethod::Paragraph, 200, 0)
            } else if content_length < 50000 {
                (SegmentationMethod::Smart, 300, 30)
            } else {
                (SegmentationMethod::Fixed, 400, 50)
            }
        }
    };

    Ok(SegmentConfig {
        method,
        target_length,
        overlap,
        min_length: 50,
        max_length: 1000,
    })
}

/// Dynamic part configuration for document splitting
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitPartConfig {
    pub title: String,
    pub start_page: Option<i32>,
    pub end_page: Option<i32>,
    pub start_spine_index: Option<i32>,
    pub end_spine_index: Option<i32>,
    pub start_pos: Option<usize>,
    pub end_pos: Option<usize>,
    pub estimated_reading_time: Option<i32>,
}

/// Split a document into smaller virtual or physical chunks
#[tauri::command]
pub async fn split_document(
    document_id: String,
    parts: Vec<SplitPartConfig>,
    spacing_days: i32,
    archive_parent: bool,
    repo: State<'_, Repository>,
) -> Result<Vec<String>> {
    let parent = repo.get_document(&document_id).await?
        .ok_or_else(|| crate::error::IncrementumError::NotFound("Parent document not found".to_string()))?;

    let total_chunks = parts.len() as i32;
    let mut child_ids = Vec::with_capacity(parts.len());

    for (i, part) in parts.into_iter().enumerate() {
        let chunk_index = i as i32;
        let mut child_doc = Document::with_collection(
            part.title,
            parent.file_path.clone(),
            parent.file_type.clone(),
            Some(parent.collection_id.clone()),
        );

        // Schedule sequentially using FSRS spacing
        let next_reading = Utc::now() + Duration::days((spacing_days * chunk_index) as i64);
        child_doc.next_reading_date = Some(next_reading);
        child_doc.priority_rating = parent.priority_rating;
        child_doc.priority_slider = parent.priority_slider;
        child_doc.priority_score = parent.priority_score;
        child_doc.tags = parent.tags.clone();
        child_doc.category = parent.category.clone();
        child_doc.cover_image_url = parent.cover_image_url.clone();
        child_doc.cover_image_source = parent.cover_image_source.clone();

        // Copy parent's text content but slice it if it's physical text chunking
        if let Some(ref content) = parent.content {
            if let (Some(start), Some(end)) = (part.start_pos, part.end_pos) {
                if start < content.len() && end <= content.len() && start <= end {
                    child_doc.content = Some(content[start..end].to_string());
                } else {
                    child_doc.content = Some(content.clone());
                }
            } else {
                child_doc.content = Some(content.clone());
            }
        }

        // Construct metadata with virtual chunk boundaries
        let parent_metadata = parent.metadata.clone().unwrap_or_else(|| DocumentMetadata {
            author: None,
            subject: None,
            keywords: None,
            created_at: None,
            modified_at: None,
            file_size: None,
            language: None,
            page_count: None,
            word_count: None,
            source: None,
            fetched_at: None,
            site_name: None,
            browser_import_mode: None,
            article_html: None,
            extracted_images: None,
            parent_document_id: None,
            chunk_index: None,
            total_chunks: None,
            chunk_start_page: None,
            chunk_end_page: None,
            chunk_start_spine_index: None,
            chunk_end_spine_index: None,
            chunk_start_pos: None,
            chunk_end_pos: None,
            estimated_reading_time_mins: None,
            ..Default::default()
        });

        let mut child_metadata = parent_metadata.clone();
        child_metadata.parent_document_id = Some(parent.id.clone());
        child_metadata.chunk_index = Some(chunk_index + 1); // 1-indexed for display
        child_metadata.total_chunks = Some(total_chunks);
        child_metadata.chunk_start_page = part.start_page;
        child_metadata.chunk_end_page = part.end_page;
        child_metadata.chunk_start_spine_index = part.start_spine_index;
        child_metadata.chunk_end_spine_index = part.end_spine_index;
        child_metadata.chunk_start_pos = part.start_pos;
        child_metadata.chunk_end_pos = part.end_pos;
        child_metadata.estimated_reading_time_mins = part.estimated_reading_time;

        // If physical article HTML is present, slice it
        if let Some(ref article_html) = parent_metadata.article_html {
            if let (Some(start), Some(end)) = (part.start_pos, part.end_pos) {
                if start < article_html.len() && end <= article_html.len() && start <= end {
                    child_metadata.article_html = Some(article_html[start..end].to_string());
                }
            }
        }

        child_doc.metadata = Some(child_metadata);

        // Calculate and save progress page bounds
        if let Some(start) = part.start_page {
            child_doc.current_page = Some(start);
        }

        // Insert into database
        let saved_child = repo.create_document(&child_doc).await?;
        child_ids.push(saved_child.id);
    }

    if archive_parent {
        repo.update_document_dismiss(&parent.id, true).await?;
    }

    Ok(child_ids)
}
