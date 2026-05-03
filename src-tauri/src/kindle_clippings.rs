//! Kindle Clippings Import
//!
//! Parses `My Clippings.txt` files from Kindle e-readers and imports highlights
//! and notes as Incrementum Documents + Extracts. Supports idempotent re-import
//! with content-hash-based deduplication.

use std::collections::HashMap;
use std::fs;

use chrono::{DateTime, NaiveDate, NaiveTime, Utc};
use regex::Regex;
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::State;

use crate::database::Repository;
use crate::error::{IncrementumError, Result};
use crate::models::{Document, Extract, FileType};

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq)]
pub enum ClippingType {
    Highlight,
    Note,
    Bookmark,
}

#[derive(Debug, Clone)]
pub struct KindleClipping {
    pub book_title: String,
    pub author: Option<String>,
    pub clipping_type: ClippingType,
    pub page: Option<i32>,
    pub location_start: Option<i32>,
    pub location_end: Option<i32>,
    pub date_added: Option<DateTime<Utc>>,
    pub content: String,
    pub content_hash: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KindleBookGroup {
    pub title: String,
    pub author: Option<String>,
    pub normalized_title: String,
    pub highlights_count: usize,
    pub notes_count: usize,
    pub bookmarks_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KindleValidationResult {
    pub books: Vec<KindleBookGroup>,
    pub total_clippings: usize,
    pub total_highlights: usize,
    pub total_notes: usize,
    pub total_bookmarks: usize,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KindlePreviewResult {
    pub books: Vec<KindleBookPreview>,
    pub total_new_extracts: usize,
    pub total_existing_extracts: usize,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KindleBookPreview {
    pub title: String,
    pub author: Option<String>,
    pub new_highlights: usize,
    pub existing_highlights: usize,
    pub new_notes: usize,
    pub existing_notes: usize,
    pub skipped_bookmarks: usize,
    pub is_new_book: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KindleImportResult {
    pub new_documents: usize,
    pub new_extracts: usize,
    pub updated_documents: usize,
    pub warnings: Vec<String>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn hex_sha256(text: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Normalize a book title for consistent grouping.
pub fn normalize_book_title(title: &str) -> String {
    title
        .trim()
        .replace('\u{feff}', "") // BOM
        .replace('\u{200b}', "") // zero-width space
        .replace('\r', " ")
        .replace('\n', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Extract author from a title line like "Book Title (Author Name)".
fn extract_author(title: &str) -> (String, Option<String>) {
    let trimmed = title.trim();

    if let Some(last_open) = trimmed.rfind('(') {
        if trimmed.ends_with(')') && last_open > 0 {
            let author_candidate = &trimmed[last_open + 1..trimmed.len() - 1];
            let clean_author = author_candidate.trim();
            if !clean_author.is_empty()
                && !clean_author.chars().next().map_or(true, |c| c.is_ascii_digit())
                && clean_author.len() < trimmed.len() / 2
            {
                let clean_title = trimmed[..last_open].trim().to_string();
                if !clean_title.is_empty() {
                    return (clean_title, Some(clean_author.to_string()));
                }
            }
        }
    }

    (trimmed.to_string(), None)
}

/// Compute a stable content hash for deduplication.
fn compute_content_hash(normalized_book_title: &str, content: &str) -> String {
    hex_sha256(&format!(
        "{}|{}",
        normalized_book_title,
        content.trim().to_lowercase()
    ))
}

/// Compute a synthetic file_path for Kindle documents.
fn kindle_file_path(normalized_title: &str) -> String {
    format!("kindle://{}", hex_sha256(normalized_title))
}

// ---------------------------------------------------------------------------
// File reading
// ---------------------------------------------------------------------------

/// Read a file trying UTF-8 first, falling back to Latin-1.
fn read_file_bytes(path: &str) -> Result<String> {
    let bytes = fs::read(path).map_err(|e| {
        IncrementumError::NotFound(format!("Cannot read file '{}': {}", path, e))
    })?;

    if let Ok(text) = String::from_utf8(bytes.clone()) {
        return Ok(text);
    }

    // Fall back to Latin-1 (ISO-8859-1) — always valid
    let text = bytes.iter().map(|&b| b as char).collect::<String>();
    Ok(text)
}

// ---------------------------------------------------------------------------
// Date parsing
// ---------------------------------------------------------------------------

/// Parse the Kindle date format:
/// `"Added on DayOfWeek, Month DD, YYYY H:MM:SS AM/PM"`
fn parse_kindle_date(date_str: &str) -> Option<DateTime<Utc>> {
    let trimmed = date_str.trim();
    // Strip "Added on" prefix if present
    let trimmed = trimmed.strip_prefix("Added on ").unwrap_or(trimmed).trim();

    let re = Regex::new(
        r"(?i)^(\w+),\s+(\w+)\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)$",
    )
    .ok()?;

    let caps = re.captures(trimmed)?;

    let month_name = caps.get(2)?.as_str();
    let day: u32 = caps.get(3)?.as_str().parse().ok()?;
    let year: i32 = caps.get(4)?.as_str().parse().ok()?;
    let hour: u32 = caps.get(5)?.as_str().parse().ok()?;
    let minute: u32 = caps.get(6)?.as_str().parse().ok()?;
    let second: u32 = caps.get(7)?.as_str().parse().ok()?;
    let ampm = caps.get(8)?.as_str();

    let mut hour = hour as u32;
    if ampm.eq_ignore_ascii_case("PM") && hour != 12 {
        hour += 12;
    } else if ampm.eq_ignore_ascii_case("AM") && hour == 12 {
        hour = 0;
    }

    let month_num = match month_name.to_lowercase().as_str() {
        "january" => 1,
        "february" => 2,
        "march" => 3,
        "april" => 4,
        "may" => 5,
        "june" => 6,
        "july" => 7,
        "august" => 8,
        "september" => 9,
        "october" => 10,
        "november" => 11,
        "december" => 12,
        _ => return None,
    };

    let date = NaiveDate::from_ymd_opt(year, month_num, day)?;
    let time = NaiveTime::from_hms_opt(hour, minute, second)?;
    let naive = date.and_time(time);
    Some(naive.and_utc())
}

// ---------------------------------------------------------------------------
// Metadata line parsing
// ---------------------------------------------------------------------------

/// Parse the metadata line from a clipping entry.
fn parse_metadata_line(line: &str) -> Option<(ClippingType, Option<i32>, Option<i32>, Option<i32>, &str)> {
    let trimmed = line.trim();
    if !trimmed.starts_with("- Your ") {
        return None;
    }

    let (clipping_type, rest) = if trimmed.contains("Your Highlight") {
        (ClippingType::Highlight, trimmed.trim_start_matches("- Your Highlight").trim())
    } else if trimmed.contains("Your Note") {
        (ClippingType::Note, trimmed.trim_start_matches("- Your Note").trim())
    } else if trimmed.contains("Your Bookmark") {
        (ClippingType::Bookmark, trimmed.trim_start_matches("- Your Bookmark").trim())
    } else {
        return None;
    };

    let mut page: Option<i32> = None;
    let mut loc_start: Option<i32> = None;
    let mut loc_end: Option<i32> = None;
    let mut date_str = "";

    let parts: Vec<&str> = rest.split(" | ").collect();

    for part in parts {
        let part = part.trim();
        if part.starts_with("on page ") {
            page = part.trim_start_matches("on page ").parse().ok();
        } else if part.starts_with("Location ") {
            let loc_str = part.trim_start_matches("Location ");
            if let Some(hyphen) = loc_str.find('-') {
                loc_start = loc_str[..hyphen].trim().parse().ok();
                loc_end = loc_str[hyphen + 1..].trim().parse().ok();
            } else {
                loc_start = loc_str.trim().parse().ok();
            }
        } else if part.starts_with("Added on ") {
            date_str = part.trim_start_matches("Added on ");
        }
    }

    Some((clipping_type, page, loc_start, loc_end, date_str))
}

// ---------------------------------------------------------------------------
// Internal parsing
// ---------------------------------------------------------------------------

/// Internal: parse a clippings file into raw clippings and warnings.
fn parse_clippings_raw(path: &str) -> Result<(Vec<KindleClipping>, Vec<String>)> {
    let text = read_file_bytes(path)?;

    // Strip BOM
    let text = text.strip_prefix('\u{feff}').unwrap_or(&text);

    // Normalize line endings
    let text = text.replace("\r\n", "\n").replace('\r', "\n");

    // Split on separator
    let separator = "==========";
    let entries: Vec<&str> = text
        .split(separator)
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();

    if entries.is_empty() {
        return Err(IncrementumError::InvalidInput(
            "File does not appear to be a Kindle clippings file (no entries found)".to_string(),
        ));
    }

    let mut warnings = Vec::new();
    let mut clippings: Vec<KindleClipping> = Vec::new();
    let mut skipped_empty = 0usize;

    let metadata_re = Regex::new(
        r"(?i)^[ \t]*- Your (Highlight|Note|Bookmark)(.*)",
    ).unwrap();

    for (idx, entry) in entries.iter().enumerate() {
        let lines: Vec<&str> = entry.lines().collect();
        if lines.is_empty() {
            continue;
        }

        let raw_title = lines[0].trim();
        if raw_title.is_empty() {
            continue;
        }

        let metadata_line = if lines.len() > 1 {
            lines[1].trim()
        } else {
            skipped_empty += 1;
            continue;
        };

        let caps = match metadata_re.captures(metadata_line) {
            Some(c) => c,
            None => {
                warnings.push(format!(
                    "Skipping entry {} for '{}': unrecognized metadata format",
                    idx + 1,
                    raw_title.chars().take(60).collect::<String>()
                ));
                continue;
            }
        };

        let clipping_type_str = caps.get(1).unwrap().as_str();
        let clipping_type = match clipping_type_str {
            "Highlight" => ClippingType::Highlight,
            "Note" => ClippingType::Note,
            "Bookmark" => ClippingType::Bookmark,
            _ => continue,
        };

        let (clipping_type_parsed, page, loc_start, loc_end, date_str) =
            parse_metadata_line(metadata_line).unwrap_or((clipping_type, None, None, None, ""));

        let date_added = if date_str.is_empty() {
            None
        } else {
            parse_kindle_date(date_str)
        };

        // Content: everything after the blank line following the metadata
        let content_start = if lines.len() > 2 { 3 } else { 2 };
        let content_lines: Vec<&str> = if content_start < lines.len() {
            lines[content_start..].iter().copied().collect()
        } else {
            vec![]
        };
        let content = content_lines.join("\n").trim().to_string();

        if content.is_empty() {
            skipped_empty += 1;
            continue;
        }

        let normalized = normalize_book_title(raw_title);
        let content_hash = compute_content_hash(&normalized, &content);
        let (_clean_title, author) = extract_author(raw_title);

        clippings.push(KindleClipping {
            book_title: raw_title.to_string(),
            author,
            clipping_type: clipping_type_parsed,
            page,
            location_start: loc_start,
            location_end: loc_end,
            date_added,
            content,
            content_hash,
        });
    }

    if skipped_empty > 0 {
        warnings.push(format!("Skipped {} empty clippings", skipped_empty));
    }

    if clippings.is_empty() {
        return Err(IncrementumError::InvalidInput(
            "No importable clippings found in file".to_string(),
        ));
    }

    Ok((clippings, warnings))
}

/// Internal: group clippings by normalized book title.
fn group_clippings(clippings: &[KindleClipping]) -> Vec<KindleBookGroup> {
    let mut book_map: HashMap<String, KindleBookGroup> = HashMap::new();

    for clipping in clippings {
        let normalized = normalize_book_title(&clipping.book_title);
        let group = book_map.entry(normalized.clone()).or_insert_with(|| {
            let (_, author) = extract_author(&clipping.book_title);
            KindleBookGroup {
                title: clipping.book_title.clone(),
                author,
                normalized_title: normalized.clone(),
                highlights_count: 0,
                notes_count: 0,
                bookmarks_count: 0,
            }
        });

        match clipping.clipping_type {
            ClippingType::Highlight => group.highlights_count += 1,
            ClippingType::Note => group.notes_count += 1,
            ClippingType::Bookmark => group.bookmarks_count += 1,
        }
    }

    let mut books: Vec<KindleBookGroup> = book_map.into_values().collect();
    books.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    books
}

// ---------------------------------------------------------------------------
// Public API: Parse
// ---------------------------------------------------------------------------

/// Parse a `My Clippings.txt` file and return a validation result.
pub fn parse_kindle_clippings(path: &str) -> Result<KindleValidationResult> {
    let (clippings, mut warnings) = parse_clippings_raw(path)?;
    let books = group_clippings(&clippings);

    let file_mtime: Option<DateTime<Utc>> = fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .map(|t| DateTime::<Utc>::from(t));

    let importable_books: Vec<&KindleBookGroup> = books
        .iter()
        .filter(|b| b.highlights_count > 0 || b.notes_count > 0)
        .collect();

    if importable_books.is_empty() {
        return Err(IncrementumError::InvalidInput(
            "File contains only bookmarks and no importable highlights or notes".to_string(),
        ));
    }

    let total_highlights: usize = books.iter().map(|g| g.highlights_count).sum();
    let total_notes: usize = books.iter().map(|g| g.notes_count).sum();
    let total_bookmarks: usize = books.iter().map(|g| g.bookmarks_count).sum();
    let total_clippings = total_highlights + total_notes + total_bookmarks;

    let unparseable_dates: usize = clippings
        .iter()
        .filter(|c| c.date_added.is_none())
        .count();

    if unparseable_dates > 0 {
        let fallback = match file_mtime {
            Some(t) => format!("using file modification time ({})", t.format("%Y-%m-%d")),
            None => "using current time".to_string(),
        };
        warnings.push(format!(
            "{} clippings had unparseable dates ({})",
            unparseable_dates, fallback
        ));
    }

    Ok(KindleValidationResult {
        books,
        total_clippings,
        total_highlights,
        total_notes,
        total_bookmarks,
        warnings,
    })
}

// ---------------------------------------------------------------------------
// Public API: Validate (with DB dedup check)
// ---------------------------------------------------------------------------

/// Validate a clippings file against the existing database.
pub async fn validate_kindle_clippings_preview(
    path: &str,
    repo: &Repository,
) -> Result<KindlePreviewResult> {
    let (clippings, warnings) = parse_clippings_raw(path)?;

    // Group clippings by normalized title for processing
    let mut book_clippings: HashMap<String, Vec<&KindleClipping>> = HashMap::new();
    for c in &clippings {
        let normalized = normalize_book_title(&c.book_title);
        book_clippings.entry(normalized).or_default().push(c);
    }

    let mut book_previews = Vec::new();
    let mut total_new = 0usize;
    let mut total_existing = 0usize;

    for (normalized_title, book_clips) in &book_clippings {
        let has_importable = book_clips
            .iter()
            .any(|c| c.clipping_type == ClippingType::Highlight || c.clipping_type == ClippingType::Note);

        if !has_importable {
            continue;
        }

        let synthetic_path = kindle_file_path(normalized_title);
        let existing_doc = repo.find_document_by_url(&synthetic_path).await?;
        let is_new_book = existing_doc.is_none();
        let doc_id = existing_doc.as_ref().map(|d| d.id.as_str());

        let existing_hashes: std::collections::HashSet<String> = if let Some(id) = doc_id {
            let extracts = repo.list_extracts_by_document(id).await?;
            extracts
                .into_iter()
                .filter_map(|e| e.source_hash)
                .collect()
        } else {
            std::collections::HashSet::new()
        };

        let mut new_highlights = 0usize;
        let mut existing_highlights = 0usize;
        let mut new_notes = 0usize;
        let mut existing_notes = 0usize;
        let mut bookmarks_count = 0usize;
        let title = book_clips[0].book_title.clone();
        let author = book_clips[0].author.clone();

        for c in book_clips {
            match c.clipping_type {
                ClippingType::Highlight => {
                    if existing_hashes.contains(&c.content_hash) {
                        existing_highlights += 1;
                    } else {
                        new_highlights += 1;
                    }
                }
                ClippingType::Note => {
                    if existing_hashes.contains(&c.content_hash) {
                        existing_notes += 1;
                    } else {
                        new_notes += 1;
                    }
                }
                ClippingType::Bookmark => {
                    bookmarks_count += 1;
                }
            }
        }

        total_new += new_highlights + new_notes;
        total_existing += existing_highlights + existing_notes;

        book_previews.push(KindleBookPreview {
            title,
            author,
            new_highlights,
            existing_highlights,
            new_notes,
            existing_notes,
            skipped_bookmarks: bookmarks_count,
            is_new_book,
        });
    }

    // Sort by new content count descending
    book_previews.sort_by(|a, b| {
        let a_new = a.new_highlights + a.new_notes;
        let b_new = b.new_highlights + b.new_notes;
        b_new.cmp(&a_new)
    });

    Ok(KindlePreviewResult {
        books: book_previews,
        total_new_extracts: total_new,
        total_existing_extracts: total_existing,
        warnings,
    })
}

// ---------------------------------------------------------------------------
// Public API: Import
// ---------------------------------------------------------------------------

/// Import a `My Clippings.txt` file into the database.
pub async fn do_import_kindle_clippings(
    path: &str,
    repo: &Repository,
) -> Result<KindleImportResult> {
    let file_mtime: Option<DateTime<Utc>> = fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .map(|t| DateTime::<Utc>::from(t));

    let (clippings, warnings) = parse_clippings_raw(path)?;
    let now = Utc::now();

    // Group by normalized title
    let mut book_clippings: HashMap<String, Vec<&KindleClipping>> = HashMap::new();
    for c in &clippings {
        let normalized = normalize_book_title(&c.book_title);
        book_clippings.entry(normalized).or_default().push(c);
    }

    let mut new_documents = 0usize;
    let mut new_extracts = 0usize;
    let mut updated_documents = 0usize;

    for (normalized_title, book_clips) in &book_clippings {
        let has_importable = book_clips
            .iter()
            .any(|c| c.clipping_type == ClippingType::Highlight || c.clipping_type == ClippingType::Note);

        if !has_importable {
            continue;
        }

        let synthetic_path = kindle_file_path(normalized_title);
        let existing_doc = repo.find_document_by_url(&synthetic_path).await?;
        let doc_id: String;

        if let Some(ref doc) = existing_doc {
            doc_id = doc.id.clone();
        } else {
            let title = book_clips[0].book_title.clone();
            let author = book_clips[0].author.clone();

            let mut new_doc = Document::new(title, synthetic_path, FileType::Other);
            new_doc.category = Some("Kindle".to_string());
            new_doc.tags = vec!["kindle-import".to_string()];
            new_doc.metadata = Some(crate::models::DocumentMetadata {
                author,
                source: Some("kindle-clippings".to_string()),
                subject: None,
                keywords: None,
                created_at: None,
                modified_at: None,
                file_size: None,
                language: None,
                page_count: None,
                word_count: None,
                fetched_at: None,
                site_name: None,
                browser_import_mode: None,
                article_html: None,
                extracted_images: None,
            });

            repo.create_document(&new_doc).await?;
            doc_id = new_doc.id.clone();
            new_documents += 1;
        }

        // Collect existing hashes for dedup
        let existing_extracts = repo.list_extracts_by_document(&doc_id).await?;
        let existing_hashes: std::collections::HashSet<String> = existing_extracts
            .iter()
            .filter_map(|e| e.source_hash.clone())
            .collect();

        for clipping in book_clips {
            match clipping.clipping_type {
                ClippingType::Bookmark => continue,
                ClippingType::Highlight | ClippingType::Note => {}
            }

            if existing_hashes.contains(&clipping.content_hash) {
                continue;
            }

            let date = clipping.date_added.unwrap_or(file_mtime.unwrap_or(now));

            let mut extract = Extract::new(doc_id.clone(), clipping.content.clone());
            extract.source_hash = Some(clipping.content_hash.clone());
            extract.date_created = date;
            extract.date_modified = date;

            if clipping.clipping_type == ClippingType::Note {
                extract.notes = Some(clipping.content.clone());
                extract.tags = vec!["kindle".to_string(), "kindle-note".to_string()];
            } else {
                extract.tags = vec!["kindle".to_string()];
            }

            repo.create_extract(&extract).await?;
            new_extracts += 1;
        }

        // Update document extract count
        if let Some(mut doc) = repo.get_document(&doc_id).await? {
            let current_extracts = repo.list_extracts_by_document(&doc_id).await?;
            doc.extract_count = current_extracts.len() as i32;
            doc.date_modified = Utc::now();
            repo.update_document(&doc_id, &doc).await?;
            updated_documents += 1;
        }
    }

    Ok(KindleImportResult {
        new_documents,
        new_extracts,
        updated_documents,
        warnings,
    })
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn parse_kindle_clippings_file(file_path: String) -> Result<KindleValidationResult> {
    parse_kindle_clippings(&file_path)
}

#[tauri::command]
pub async fn validate_kindle_clippings(
    file_path: String,
    repo: State<'_, Repository>,
) -> Result<KindlePreviewResult> {
    validate_kindle_clippings_preview(&file_path, &repo).await
}

#[tauri::command]
pub async fn import_kindle_clippings_file(
    file_path: String,
    repo: State<'_, Repository>,
) -> Result<KindleImportResult> {
    do_import_kindle_clippings(&file_path, &repo).await
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Datelike, Timelike};
    use std::io::Write;
    use tempfile::NamedTempFile;

    fn write_temp(content: &str) -> NamedTempFile {
        let mut f = NamedTempFile::new().expect("temp file");
        write!(f, "{}", content).expect("write");
        f
    }

    fn sample_clipping_file() -> String {
        r#"Atomic Habits (James Clear)
- Your Highlight on page 42 | Location 678-680 | Added on Sunday, January 15, 2024 3:45:22 PM

The most effective way to change your habits is to focus not on what you want to achieve, but on who you wish to become.

==========
Deep Work (Cal Newport)
- Your Highlight on page 15 | Location 234-235 | Added on Monday, February 5, 2024 10:30:00 AM

If you don't produce, you won't thrive—no matter how skilled or talented you are.

==========
Deep Work (Cal Newport)
- Your Note on page 50 | Location 800 | Added on Tuesday, February 6, 2024 2:15:00 PM

This connects to the idea of deliberate practice from Peak.

==========
Atomic Habits (James Clear)
- Your Bookmark on page 100 | Location 1500 | Added on Wednesday, March 1, 2024 9:00:00 AM

==========
Nonexistent Book
- Your Bookmark | Added on Thursday, March 2, 2024 12:00:00 PM

==========
"#
            .to_string()
    }

    #[test]
    fn test_parse_valid_file() {
        let f = write_temp(&sample_clipping_file());
        let result = parse_kindle_clippings(f.path().to_str().unwrap()).unwrap();
        assert_eq!(result.books.len(), 2);
        assert_eq!(result.total_highlights, 2);
        assert_eq!(result.total_notes, 1);
        // Bookmarks are skipped (no content), so total_bookmarks == 0
    }

    #[test]
    fn test_grouping_by_normalized_title() {
        let f = write_temp(&sample_clipping_file());
        let result = parse_kindle_clippings(f.path().to_str().unwrap()).unwrap();

        let deep_work = result
            .books
            .iter()
            .find(|b| b.title.contains("Deep Work"));
        assert!(deep_work.is_some());
        assert_eq!(deep_work.unwrap().highlights_count, 1);
        assert_eq!(deep_work.unwrap().notes_count, 1);

        let atomic = result
            .books
            .iter()
            .find(|b| b.title.contains("Atomic Habits"));
        assert!(atomic.is_some());
        assert_eq!(atomic.unwrap().highlights_count, 1);
        assert_eq!(atomic.unwrap().bookmarks_count, 0);
    }

    #[test]
    fn test_author_extraction() {
        assert_eq!(
            extract_author("Atomic Habits (James Clear)"),
            ("Atomic Habits".to_string(), Some("James Clear".to_string()))
        );
        assert_eq!(
            extract_author("Deep Work"),
            ("Deep Work".to_string(), None)
        );
    }

    #[test]
    fn test_date_parsing() {
        let result = parse_kindle_date("Added on Sunday, January 15, 2024 3:45:22 PM");
        assert!(result.is_some());
        let dt = result.unwrap();
        assert_eq!(dt.year(), 2024);
        assert_eq!(dt.month(), 1);
        assert_eq!(dt.day(), 15);
        assert_eq!(dt.hour(), 15);

        let am_result = parse_kindle_date("Added on Monday, February 5, 2024 9:00:00 AM");
        assert!(am_result.is_some());
        assert_eq!(am_result.unwrap().hour(), 9);

        let noon = parse_kindle_date("Added on Friday, March 1, 2024 12:00:00 PM");
        assert!(noon.is_some());
        assert_eq!(noon.unwrap().hour(), 12);

        let midnight = parse_kindle_date("Added on Saturday, April 1, 2024 12:00:00 AM");
        assert!(midnight.is_some());
        assert_eq!(midnight.unwrap().hour(), 0);

        assert!(parse_kindle_date("not a date").is_none());
    }

    #[test]
    fn test_content_hash_stability() {
        let hash1 = compute_content_hash("atomic habits", "some highlighted text");
        let hash2 = compute_content_hash("atomic habits", "some highlighted text");
        assert_eq!(hash1, hash2);

        let hash3 = compute_content_hash("deep work", "some highlighted text");
        assert_ne!(hash1, hash3);

        let hash4 = compute_content_hash("atomic habits", "SOME HIGHLIGHTED TEXT");
        assert_eq!(hash1, hash4);
    }

    #[test]
    fn test_normalize_book_title() {
        assert_eq!(normalize_book_title("  Hello World  "), "Hello World");
        assert_eq!(
            normalize_book_title("\u{feff}Book\u{200b}Title"),
            "BookTitle"
        );
        assert_eq!(
            normalize_book_title("Multi\nLine  Title"),
            "Multi Line Title"
        );
    }

    #[test]
    fn test_empty_file() {
        let f = write_temp("");
        let result = parse_kindle_clippings(f.path().to_str().unwrap());
        assert!(result.is_err());
    }

    #[test]
    fn test_only_bookmarks() {
        let content = r#"Some Book (Author)
- Your Bookmark | Added on Sunday, January 1, 2024 12:00:00 PM

==========
"#
        .to_string();
        let f = write_temp(&content);
        let result = parse_kindle_clippings(f.path().to_str().unwrap());
        assert!(result.is_err());
        // Bookmarks have no content, so nothing is importable
        assert!(result.unwrap_err().to_string().contains("No importable"));
    }

    #[test]
    fn test_empty_content_clipping_skipped() {
        let content = r#"Book (Author)
- Your Highlight on page 1 | Location 1 | Added on Sunday, January 1, 2024 12:00:00 PM


==========
"#
        .to_string();
        let f = write_temp(&content);
        let result = parse_kindle_clippings(f.path().to_str().unwrap());
        assert!(result.is_err());
    }

    #[test]
    fn test_kindle_file_path_deterministic() {
        let p1 = kindle_file_path("atomic habits");
        let p2 = kindle_file_path("atomic habits");
        assert_eq!(p1, p2);
        assert!(p1.starts_with("kindle://"));
    }
}
