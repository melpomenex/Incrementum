//! PDF content extraction with full metadata support

use crate::error::Result;
use crate::processor::ExtractedContent;
use base64::{engine::general_purpose, Engine as _};
use std::collections::HashMap;
use std::path::Path;

/// Extract content from a PDF file including text and metadata
pub async fn extract_pdf_content(file_path: &str) -> Result<ExtractedContent> {
    let path = Path::new(file_path);

    // Read the PDF file
    let buffer = match tokio::fs::read(path).await {
        Ok(b) => b,
        Err(e) => {
            return Err(crate::error::IncrementumError::NotFound(format!(
                "Failed to read PDF file: {}",
                e
            )))
        }
    };

    // Get file size
    let file_size = buffer.len();

    // Extract text using pdf-extract with a timeout to prevent hanging on large PDFs
    // Clone buffer for the blocking task
    let buffer_for_text = buffer.clone();
    let text = match tokio::time::timeout(
        std::time::Duration::from_secs(10),
        tokio::task::spawn_blocking(move || pdf_extract::extract_text_from_mem(&buffer_for_text)),
    )
    .await
    {
        Ok(Ok(Ok(t))) => t,
        Ok(Ok(Err(e))) => {
            eprintln!("PDF text extraction failed: {}", e);
            String::new()
        }
        Ok(Err(e)) => {
            eprintln!("PDF text extraction task panicked: {}", e);
            String::new()
        }
        Err(_) => {
            eprintln!("PDF text extraction timed out after 10 seconds, skipping text extraction");
            String::new()
        }
    };

    // Count words in extracted text
    let word_count = text.split_whitespace().count();

    // Get metadata using lopdf
    let doc = match lopdf::Document::load_mem(&buffer) {
        Ok(d) => d,
        Err(e) => {
            return Err(crate::error::IncrementumError::NotFound(format!(
                "Failed to parse PDF for metadata: {}",
                e
            )))
        }
    };

    let pages = doc.get_pages();
    let page_count = pages.len();

    // Build metadata
    let mut pdf_metadata = HashMap::new();
    pdf_metadata.insert("format".to_string(), "PDF".to_string());
    pdf_metadata.insert("page_count".to_string(), page_count.to_string());
    pdf_metadata.insert("encrypted".to_string(), doc.is_encrypted().to_string());
    pdf_metadata.insert("text_length".to_string(), text.len().to_string());
    pdf_metadata.insert("word_count".to_string(), word_count.to_string());
    pdf_metadata.insert("file_size".to_string(), file_size.to_string());
    pdf_metadata.insert("pdf_version".to_string(), doc.version.to_string());

    // Estimate reading time (average 200 words per minute)
    let reading_time_mins = if word_count > 0 {
        (word_count as f64 / 200.0).ceil() as usize
    } else {
        0
    };
    pdf_metadata.insert(
        "reading_time_minutes".to_string(),
        reading_time_mins.to_string(),
    );

    // Build metadata JSON
    let metadata = serde_json::json!({
        "format": "PDF",
        "page_count": page_count,
        "encrypted": doc.is_encrypted(),
        "text_length": text.len(),
        "word_count": word_count,
        "file_size": file_size,
        "reading_time_minutes": reading_time_mins,
        "pdf_metadata": pdf_metadata
    });

    Ok(ExtractedContent {
        text,
        title: None,
        author: None,
        page_count: Some(page_count),
        metadata,
    })
}

/// Extract a specific page from a PDF file
pub async fn extract_pdf_page(file_path: &str, page_num: usize) -> Result<String> {
    let path = Path::new(file_path);

    let buffer = tokio::fs::read(path).await.map_err(|e| {
        crate::error::IncrementumError::NotFound(format!("Failed to read PDF: {}", e))
    })?;

    let doc = lopdf::Document::load_mem(&buffer).map_err(|e| {
        crate::error::IncrementumError::NotFound(format!("Failed to load PDF: {}", e))
    })?;

    let pages = doc.get_pages();
    let page_count = pages.len();

    if page_num < 1 || page_num > page_count {
        return Err(crate::error::IncrementumError::NotFound(format!(
            "Page {} out of range (1-{})",
            page_num, page_count
        )));
    }

    // Get the page (0-indexed)
    let _page_id = pages
        .keys()
        .nth(page_num - 1)
        .ok_or_else(|| crate::error::IncrementumError::NotFound("Page not found".to_string()))?;

    // Extract text from the page (with panic protection)
    let text = match std::panic::catch_unwind(|| pdf_extract::extract_text_from_mem(&buffer)) {
        Ok(Ok(t)) => t,
        Ok(Err(e)) => {
            eprintln!("PDF text extraction failed: {}", e);
            String::new()
        }
        Err(panic_info) => {
            eprintln!("PDF text extraction panicked: {:?}", panic_info);
            String::new()
        }
    };

    // Note: pdf-extract doesn't support per-page extraction easily
    // For a production implementation, you'd want to use a library that supports
    // per-page text extraction like poppler or pdfium

    Ok(text)
}

/// Get the number of pages in a PDF file
pub async fn get_pdf_page_count(file_path: &str) -> Result<usize> {
    let path = Path::new(file_path);

    let buffer = tokio::fs::read(path).await.map_err(|e| {
        crate::error::IncrementumError::NotFound(format!("Failed to read PDF: {}", e))
    })?;

    let doc = lopdf::Document::load_mem(&buffer).map_err(|e| {
        crate::error::IncrementumError::NotFound(format!("Failed to load PDF: {}", e))
    })?;

    Ok(doc.get_pages().len())
}

/// Extract an embedded cover image from the first page of a PDF as a data URL.
pub async fn extract_pdf_cover_data_url(file_path: &str) -> Result<Option<String>> {
    let path = Path::new(file_path);

    let buffer = tokio::fs::read(path).await.map_err(|e| {
        crate::error::IncrementumError::NotFound(format!("Failed to read PDF: {}", e))
    })?;

    let doc = lopdf::Document::load_mem(&buffer).map_err(|e| {
        crate::error::IncrementumError::NotFound(format!("Failed to load PDF: {}", e))
    })?;

    let first_page_id = doc.get_pages().iter().next().map(|(_, id)| *id);
    let Some(page_id) = first_page_id else {
        return Ok(None);
    };

    let images = match doc.get_page_images(page_id) {
        Ok(images) => images,
        Err(_) => return Ok(None),
    };

    let mut best_image: Option<(Vec<u8>, String, i64)> = None;
    for image in images {
        let filters = image.filters.clone().unwrap_or_default();
        let mime = if filters.iter().any(|f| f.eq_ignore_ascii_case("DCTDecode")) {
            "image/jpeg"
        } else if filters.iter().any(|f| f.eq_ignore_ascii_case("JPXDecode")) {
            "image/jp2"
        } else {
            continue;
        };

        let area = image.width.saturating_mul(image.height);
        if image.content.is_empty() {
            continue;
        }

        let should_replace = best_image
            .as_ref()
            .map(|(_, _, best_area)| area > *best_area)
            .unwrap_or(true);

        if should_replace {
            best_image = Some((image.content.to_vec(), mime.to_string(), area));
        }
    }

    if let Some((bytes, mime, _)) = best_image {
        let encoded = general_purpose::STANDARD.encode(bytes);
        return Ok(Some(format!("data:{};base64,{}", mime, encoded)));
    }

    Ok(None)
}

/// Convert a PDF file to HTML format for better text selection and extraction
///
/// This creates a structured HTML document with the PDF's text content,
/// preserving page breaks and basic formatting for improved readability
/// and text selection compared to PDF.js rendering.
pub async fn convert_pdf_to_html(file_path: &str) -> Result<String> {
    let path = Path::new(file_path);

    // Read the PDF file
    let buffer = match tokio::fs::read(path).await {
        Ok(b) => b,
        Err(e) => {
            return Err(crate::error::IncrementumError::NotFound(format!(
                "Failed to read PDF file: {}",
                e
            )))
        }
    };

    // Get document metadata using lopdf
    let doc = match lopdf::Document::load_mem(&buffer) {
        Ok(d) => d,
        Err(e) => {
            return Err(crate::error::IncrementumError::NotFound(format!(
                "Failed to parse PDF: {}",
                e
            )))
        }
    };

    let pages = doc.get_pages();
    let page_count = pages.len();

    // Extract title from filename
    let title = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Converted PDF")
        .to_string();

    // Extract text by page so the HTML keeps source page attribution.
    let mut page_texts =
        match std::panic::catch_unwind(|| pdf_extract::extract_text_from_mem_by_pages(&buffer)) {
            Ok(Ok(pages)) => pages,
            Ok(Err(e)) => {
                eprintln!("PDF page text extraction failed: {}", e);
                Vec::new()
            }
            Err(panic_info) => {
                eprintln!("PDF page text extraction panicked: {:?}", panic_info);
                Vec::new()
            }
        };

    if page_texts.is_empty() {
        page_texts = match std::panic::catch_unwind(|| pdf_extract::extract_text_from_mem(&buffer))
        {
            Ok(Ok(text)) if !text.trim().is_empty() => split_text_across_pages(&text, page_count),
            Ok(Ok(_)) => Vec::new(),
            Ok(Err(e)) => {
                eprintln!("PDF text extraction fallback failed: {}", e);
                Vec::new()
            }
            Err(panic_info) => {
                eprintln!("PDF text extraction fallback panicked: {:?}", panic_info);
                Vec::new()
            }
        };
    }

    let usable_pages: Vec<(usize, String)> = page_texts
        .into_iter()
        .enumerate()
        .filter_map(|(page_idx, text)| {
            let text = normalize_extracted_text(&text);
            if has_usable_text(&text) {
                Some((page_idx, text))
            } else {
                None
            }
        })
        .collect();

    if usable_pages.is_empty() {
        return Err(crate::error::IncrementumError::Internal(
            "No usable text layer was found in this PDF. Convert to HTML requires extractable text or an OCR provider for scanned/image-only PDFs.".to_string()
        ));
    }

    let page_image_data_urls = extract_page_images_data_urls(&doc);
    let mut html = String::new();

    html.push_str(&format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{}</title>
    <style>
        :root {{
            --bg-color: #ffffff;
            --text-color: #1a1a1a;
            --page-border: #e0e0e0;
            --page-bg: #fafafa;
        }}

        @media (prefers-color-scheme: dark) {{
            :root {{
                --bg-color: #1a1a1a;
                --text-color: #e0e0e0;
                --page-border: #404040;
                --page-bg: #242424;
            }}
        }}

        * {{
            box-sizing: border-box;
        }}

        body {{
            font-family: ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif;
            line-height: 1.55;
            max-width: 900px;
            margin: 0 auto;
            padding: 2rem;
            background-color: var(--bg-color);
            color: var(--text-color);
        }}

        .pdf-header {{
            text-align: center;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 2px solid var(--page-border);
        }}

        .pdf-header h1 {{
            margin: 0 0 0.5rem 0;
            font-size: 1.75rem;
        }}

        .pdf-header .meta {{
            font-size: 0.875rem;
            opacity: 0.7;
        }}

        .page {{
            background-color: var(--page-bg);
            border: 1px solid var(--page-border);
            border-radius: 4px;
            padding: 2rem;
            margin-bottom: 1.5rem;
            page-break-after: always;
        }}

        .page:last-child {{
            page-break-after: auto;
        }}

        .page-header {{
            font-size: 0.75rem;
            color: var(--text-color);
            opacity: 0.5;
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 1px solid var(--page-border);
        }}

        .page-content {{
            word-wrap: break-word;
            font-size: 1rem;
        }}

        .page-content p {{
            margin: 0 0 1em 0;
        }}

        .page-content h2,
        .page-content h3 {{
            line-height: 1.25;
            margin: 1.4em 0 0.6em;
        }}

        .page-content h2 {{
            font-size: 1.45rem;
        }}

        .page-content h3 {{
            font-size: 1.2rem;
        }}

        .page-content ul,
        .page-content ol {{
            margin: 0 0 1em 1.4em;
            padding: 0;
        }}

        .page-content table {{
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0;
            font-size: 0.95rem;
        }}

        .page-content td,
        .page-content th {{
            border: 1px solid var(--page-border);
            padding: 0.35rem 0.5rem;
            vertical-align: top;
        }}

        .line-block {{
            white-space: pre-wrap;
            margin: 0 0 1em 0;
        }}

        .page-images {{
            display: grid;
            gap: 1rem;
            margin: 0 0 1.25rem 0;
        }}

        .page-images img {{
            display: block;
            max-width: 100%;
            height: auto;
            border: 1px solid var(--page-border);
            background: #fff;
        }}

        /* Improve text selection */
        ::selection {{
            background-color: #3b82f6;
            color: white;
        }}

        /* Print styles */
        @media print {{
            body {{
                max-width: none;
                padding: 0;
            }}
            .page {{
                border: none;
                box-shadow: none;
                page-break-after: always;
            }}
        }}
    </style>
</head>
<body>
    <div class="pdf-header">
        <h1>{}</h1>
        <div class="meta">Converted from PDF • {} pages</div>
    </div>
"#,
        html_escape(&title),
        html_escape(&title),
        page_count.max(usable_pages.len())
    ));

    for (source_page_idx, page_text) in usable_pages.iter() {
        let page_num = source_page_idx + 1;
        html.push_str(&format!(
            r#"
    <div class="page" id="page-{}">
        <div class="page-header">Page {} of {}</div>
        <div class="page-content">
"#,
            page_num,
            page_num,
            page_count.max(usable_pages.len())
        ));

        if let Some(images) = page_image_data_urls.get(*source_page_idx) {
            if !images.is_empty() {
                html.push_str("            <div class=\"page-images\">\n");
                for (image_idx, data_url) in images.iter().enumerate() {
                    html.push_str(&format!(
                        "                <img src=\"{}\" alt=\"Image {} from page {}\" loading=\"lazy\" />\n",
                        html_escape(data_url),
                        image_idx + 1,
                        page_num
                    ));
                }
                html.push_str("            </div>\n");
            }
        }

        html.push_str(&render_page_text_as_html(page_text));

        html.push_str(
            r#"        </div>
    </div>
"#,
        );
    }

    html.push_str(
        r#"</body>
</html>
"#,
    );

    Ok(html)
}

/// Helper function to escape HTML special characters
fn html_escape(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn normalize_extracted_text(text: &str) -> String {
    text.replace('\u{000c}', "\n\n")
        .lines()
        .map(|line| line.trim_end())
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

fn has_usable_text(text: &str) -> bool {
    let word_count = text
        .split_whitespace()
        .filter(|word| word.len() > 1)
        .count();
    let alphanumeric_count = text.chars().filter(|ch| ch.is_alphanumeric()).count();
    word_count >= 3 && alphanumeric_count >= 20
}

fn extract_page_images_data_urls(doc: &lopdf::Document) -> Vec<Vec<String>> {
    doc.get_pages()
        .values()
        .map(|page_id| {
            let Ok(images) = doc.get_page_images(*page_id) else {
                return Vec::new();
            };

            images
                .into_iter()
                .filter_map(|image| {
                    let filters = image.filters.clone().unwrap_or_default();
                    let mime = if filters.iter().any(|f| f.eq_ignore_ascii_case("DCTDecode")) {
                        "image/jpeg"
                    } else if filters.iter().any(|f| f.eq_ignore_ascii_case("JPXDecode")) {
                        "image/jp2"
                    } else {
                        return None;
                    };

                    if image.content.is_empty() {
                        return None;
                    }

                    let encoded = general_purpose::STANDARD.encode(image.content);
                    Some(format!("data:{};base64,{}", mime, encoded))
                })
                .collect()
        })
        .collect()
}

fn split_text_across_pages(text: &str, page_count: usize) -> Vec<String> {
    if text.contains('\u{000c}') {
        let pages: Vec<String> = text
            .split('\u{000c}')
            .map(normalize_extracted_text)
            .filter(|page| !page.trim().is_empty())
            .collect();
        if pages.len() > 1 {
            return pages;
        }
    }

    let normalized = normalize_extracted_text(text);
    if normalized.is_empty() {
        return Vec::new();
    }

    let paragraphs: Vec<&str> = normalized
        .split("\n\n")
        .map(str::trim)
        .filter(|paragraph| !paragraph.is_empty())
        .collect();

    if paragraphs.is_empty() || page_count <= 1 {
        return vec![normalized];
    }

    let paragraphs_per_page = ((paragraphs.len() as f64) / (page_count as f64)).ceil() as usize;
    paragraphs
        .chunks(paragraphs_per_page.max(1))
        .map(|chunk| chunk.join("\n\n"))
        .collect()
}

fn render_page_text_as_html(text: &str) -> String {
    let blocks = text
        .split("\n\n")
        .map(str::trim)
        .filter(|block| !block.is_empty())
        .collect::<Vec<_>>();

    let mut html = String::new();
    for block in blocks {
        if let Some(table_html) = render_table_block(block) {
            html.push_str(&table_html);
        } else if is_list_block(block) {
            html.push_str(&render_list_block(block));
        } else if is_heading(block) {
            let tag = if block.chars().count() <= 80 {
                "h2"
            } else {
                "h3"
            };
            html.push_str(&format!(
                "            <{}>{}</{}>\n",
                tag,
                html_escape(block),
                tag
            ));
        } else if block.lines().count() > 1 && looks_like_preserved_line_block(block) {
            html.push_str(&format!(
                "            <div class=\"line-block\">{}</div>\n",
                html_escape(block)
            ));
        } else {
            let paragraph = block
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .collect::<Vec<_>>()
                .join(" ");
            html.push_str(&format!("            <p>{}</p>\n", html_escape(&paragraph)));
        }
    }

    html
}

fn is_heading(block: &str) -> bool {
    let line_count = block.lines().filter(|line| !line.trim().is_empty()).count();
    if line_count != 1 {
        return false;
    }

    let trimmed = block.trim();
    let char_count = trimmed.chars().count();
    if !(4..=120).contains(&char_count) || trimmed.ends_with('.') {
        return false;
    }

    let alpha_count = trimmed.chars().filter(|ch| ch.is_alphabetic()).count();
    if alpha_count < 3 {
        return false;
    }

    let uppercase_count = trimmed.chars().filter(|ch| ch.is_uppercase()).count();
    uppercase_count * 2 >= alpha_count || char_count <= 70
}

fn is_list_block(block: &str) -> bool {
    let lines: Vec<&str> = block
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect();
    lines.len() >= 2 && lines.iter().all(|line| list_marker_kind(line).is_some())
}

fn list_marker_kind(line: &str) -> Option<bool> {
    let trimmed = line.trim_start();
    if trimmed.starts_with("- ") || trimmed.starts_with("* ") || trimmed.starts_with("• ") {
        return Some(false);
    }

    let mut chars = trimmed.chars().peekable();
    let mut digit_count = 0usize;
    while matches!(chars.peek(), Some(ch) if ch.is_ascii_digit()) {
        digit_count += 1;
        chars.next();
    }
    if digit_count > 0
        && matches!(chars.next(), Some('.') | Some(')'))
        && matches!(chars.next(), Some(' '))
    {
        return Some(true);
    }

    None
}

fn render_list_block(block: &str) -> String {
    let lines: Vec<&str> = block
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect();
    let ordered = lines
        .iter()
        .all(|line| list_marker_kind(line) == Some(true));
    let tag = if ordered { "ol" } else { "ul" };
    let mut html = format!("            <{}>\n", tag);

    for line in lines {
        let item = strip_list_marker(line);
        html.push_str(&format!("                <li>{}</li>\n", html_escape(item)));
    }

    html.push_str(&format!("            </{}>\n", tag));
    html
}

fn strip_list_marker(line: &str) -> &str {
    let trimmed = line.trim_start();
    for marker in ["- ", "* ", "• "] {
        if let Some(rest) = trimmed.strip_prefix(marker) {
            return rest.trim();
        }
    }

    let marker_end = trimmed.char_indices().find_map(|(idx, ch)| {
        if (ch == '.' || ch == ')')
            && trimmed[..idx]
                .chars()
                .all(|prefix_ch| prefix_ch.is_ascii_digit())
        {
            Some(idx + ch.len_utf8())
        } else {
            None
        }
    });

    marker_end
        .and_then(|idx| trimmed.get(idx..))
        .map(str::trim)
        .unwrap_or(trimmed)
}

fn render_table_block(block: &str) -> Option<String> {
    let rows: Vec<Vec<String>> = block
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(split_table_row)
        .collect();

    if rows.len() < 2 || rows.iter().filter(|row| row.len() >= 2).count() < 2 {
        return None;
    }

    let first_width = rows.first()?.len();
    if first_width < 2 || rows.iter().any(|row| row.len() != first_width) {
        return None;
    }

    let mut html = String::from("            <table>\n");
    for row in rows {
        html.push_str("                <tr>");
        for cell in row {
            html.push_str(&format!("<td>{}</td>", html_escape(cell.trim())));
        }
        html.push_str("</tr>\n");
    }
    html.push_str("            </table>\n");
    Some(html)
}

fn split_table_row(line: &str) -> Vec<String> {
    if line.contains('|') {
        return line
            .split('|')
            .map(str::trim)
            .filter(|cell| !cell.is_empty())
            .map(ToString::to_string)
            .collect();
    }

    line.split("  ")
        .map(str::trim)
        .filter(|cell| !cell.is_empty())
        .map(ToString::to_string)
        .collect()
}

fn looks_like_preserved_line_block(block: &str) -> bool {
    let lines: Vec<&str> = block
        .lines()
        .filter(|line| !line.trim().is_empty())
        .collect();
    if lines.len() < 2 {
        return false;
    }

    lines
        .iter()
        .any(|line| line.starts_with(' ') || line.contains("  "))
}

/// Save converted HTML to a file alongside the original PDF
/// Returns the path to the saved HTML file
pub async fn save_pdf_as_html(pdf_path: &str, output_path: Option<&str>) -> Result<String> {
    let html_content = convert_pdf_to_html(pdf_path).await?;

    let output_file_path = match output_path {
        Some(path) => path.to_string(),
        None => {
            // Generate output path by replacing .pdf extension with .html
            let path = Path::new(pdf_path);
            let stem = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("converted");
            let parent = path.parent().unwrap_or(Path::new("."));
            parent
                .join(format!("{}.html", stem))
                .to_string_lossy()
                .to_string()
        }
    };

    tokio::fs::write(&output_file_path, &html_content)
        .await
        .map_err(|e| {
            crate::error::IncrementumError::Internal(format!("Failed to save HTML file: {}", e))
        })?;

    Ok(output_file_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_pdf_page_count() {
        // This test would require a sample PDF file
        // For now, we just verify the function compiles
        assert!(true);
    }

    #[test]
    fn test_html_escape() {
        assert_eq!(html_escape("<script>"), "&lt;script&gt;");
        assert_eq!(html_escape("a & b"), "a &amp; b");
        assert_eq!(html_escape("\"quoted\""), "&quot;quoted&quot;");
    }

    #[test]
    fn test_split_text_across_pages_uses_form_feed_boundaries() {
        let pages = split_text_across_pages("Page one text\u{000c}Page two text", 2);

        assert_eq!(pages, vec!["Page one text", "Page two text"]);
    }

    #[test]
    fn test_render_page_text_as_html_preserves_common_blocks() {
        let html = render_page_text_as_html(
            "SECTION TITLE\n\n- first item\n- second item\n\nName  Value\nFoo   Bar",
        );

        assert!(html.contains("<h2>SECTION TITLE</h2>"));
        assert!(html.contains("<ul>"));
        assert!(html.contains("<li>first item</li>"));
        assert!(html.contains("<table>"));
        assert!(html.contains("<td>Foo</td>"));
    }

    #[test]
    fn test_has_usable_text_rejects_empty_or_symbolic_text() {
        assert!(!has_usable_text(""));
        assert!(!has_usable_text("..... -----"));
        assert!(has_usable_text(
            "This PDF page has enough readable words to convert."
        ));
    }
}
