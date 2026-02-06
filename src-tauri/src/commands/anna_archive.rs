//! Anna's Archive / LibGen integration for book search and download
//!
//! This module provides functionality to search for books on Library Genesis (LibGen)
//! and download them directly into the user's library.
//!
//! Uses multiple search strategies:
//! 1. Primary: libgen.li index.php search (modern interface, comprehensive results)
//! 2. Fallback: libgen.rs search.php (simpler interface, more reliable)

use crate::error::Result;
use serde::{Deserialize, Serialize};
use regex::Regex;
use std::collections::HashSet;
use std::time::Duration;
use futures_util::StreamExt;

/// LibGen mirror domains (in order of preference)
/// Updated to working mirrors as of 2025
const LIBGEN_MIRRORS: &[&str] = &[
    "https://libgen.li",
    "https://libgen.is",
    "https://libgen.rs",
    "https://libgen.gs",
];

/// Book format types supported for download
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum BookFormat {
    Pdf,
    Epub,
    Mobi,
    Azw3,
    Djvu,
    Cbz,
    Cbr,
    Zip,
    Rtf,
}

impl std::fmt::Display for BookFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BookFormat::Pdf => write!(f, "pdf"),
            BookFormat::Epub => write!(f, "epub"),
            BookFormat::Mobi => write!(f, "mobi"),
            BookFormat::Azw3 => write!(f, "azw3"),
            BookFormat::Djvu => write!(f, "djvu"),
            BookFormat::Cbz => write!(f, "cbz"),
            BookFormat::Cbr => write!(f, "cbr"),
            BookFormat::Zip => write!(f, "zip"),
            BookFormat::Rtf => write!(f, "rtf"),
        }
    }
}

impl BookFormat {
    /// Parse from file extension string
    pub fn from_extension(ext: &str) -> Option<Self> {
        match ext.to_lowercase().as_str() {
            "pdf" => Some(BookFormat::Pdf),
            "epub" => Some(BookFormat::Epub),
            "mobi" => Some(BookFormat::Mobi),
            "azw" | "azw3" => Some(BookFormat::Azw3),
            "djvu" => Some(BookFormat::Djvu),
            "cbz" => Some(BookFormat::Cbz),
            "cbr" => Some(BookFormat::Cbr),
            "zip" => Some(BookFormat::Zip),
            "rtf" => Some(BookFormat::Rtf),
            _ => None,
        }
    }
}

/// Book search result from LibGen
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookSearchResult {
    pub id: String,
    pub title: String,
    pub author: Option<String>,
    pub year: Option<i32>,
    pub publisher: Option<String>,
    pub language: Option<String>,
    pub formats: Vec<BookFormat>,
    pub cover_url: Option<String>,
    pub description: Option<String>,
    pub isbn: Option<String>,
    pub md5: Option<String>,
    pub file_size: Option<String>,
}

/// Download progress update
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub book_id: String,
    pub progress: f32, // 0.0 to 1.0
    pub bytes_downloaded: u64,
    pub total_bytes: Option<u64>,
    pub status: DownloadStatus,
}

/// Download status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DownloadStatus {
    Connecting,
    Downloading,
    Completed,
    Failed(String),
    Cancelled,
}

/// Internal state for LibGen client
#[derive(Clone)]
pub struct AnnaArchiveClient {
    current_mirror_index: usize,
    http_client: reqwest::Client,
}

impl AnnaArchiveClient {
    /// Create a new LibGen client
    pub fn new() -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            .build()
            .unwrap_or_default();

        Self {
            current_mirror_index: 0,
            http_client,
        }
    }

    /// Get the current mirror URL
    fn get_current_mirror(&self) -> &'static str {
        LIBGEN_MIRRORS.get(self.current_mirror_index)
            .copied()
            .unwrap_or(LIBGEN_MIRRORS[0])
    }

    /// Try the next mirror
    fn try_next_mirror(&mut self) -> Option<&'static str> {
        if self.current_mirror_index + 1 < LIBGEN_MIRRORS.len() {
            self.current_mirror_index += 1;
            Some(self.get_current_mirror())
        } else {
            None
        }
    }

    /// Search for books on LibGen
    /// Tries multiple search strategies and mirrors for best results
    pub async fn search_books(&self, query: &str, limit: usize) -> Result<Vec<BookSearchResult>> {
        let encoded_query = urlencoding::encode(query);
        let mut last_error = None;
        let mut client = self.clone();

        // Try each mirror with both search methods
        loop {
            let mirror = client.get_current_mirror();

            // Strategy 1: Try index.php search (libgen.li style)
            if mirror.contains("libgen.li") {
                let search_url = format!(
                    "{}/index.php?req={}&columns%5B%5D=t&columns%5B%5D=a&columns%5B%5D=s&columns%5B%5D=y&columns%5B%5D=p&columns%5B%5D=i&objects%5B%5D=f&objects%5B%5D=e&objects%5B%5D=s&objects%5B%5D=a&objects%5B%5D=p&objects%5B%5D=w&topics%5B%5D=l&topics%5B%5D=c&topics%5B%5D=f&topics%5B%5D=a&topics%5B%5D=m&topics%5B%5D=r&topics%5B%5D=s&res={}&filesuns=all&curtab=f",
                    mirror,
                    encoded_query,
                    limit.min(100)
                );

                match client.fetch_search_results(&search_url).await {
                    Ok(results) if !results.is_empty() => {
                        return Ok(client.filter_and_deduplicate(results, limit));
                    }
                    Ok(_) => {} // Empty results, try next strategy
                    Err(e) => last_error = Some(e),
                }
            }

            // Strategy 2: Try search.php (libgen.rs/is style)
            let search_url = format!(
                "{}/search.php?req={}&open=0&res={}&view=simple&phrase=1&column=def",
                mirror,
                encoded_query,
                limit.min(100)
            );

            match client.fetch_search_results(&search_url).await {
                Ok(results) if !results.is_empty() => {
                    return Ok(client.filter_and_deduplicate(results, limit));
                }
                Ok(_) => {} // Empty results, try next mirror
                Err(e) => last_error = Some(e),
            }

            // Try next mirror
            if client.try_next_mirror().is_none() {
                break;
            }
        }

        // If we have no results but also no error, return empty
        if last_error.is_none() {
            return Ok(vec![]);
        }

        Err(crate::error::IncrementumError::Internal(format!(
            "Failed to search books after trying all mirrors. Last error: {}",
            last_error.as_ref().map(|e| e.to_string()).unwrap_or_else(|| "Unknown error".to_string())
        )))
    }

    /// Fetch search results from a URL
    async fn fetch_search_results(&self, url: &str) -> Result<Vec<BookSearchResult>> {
        let response = self.http_client
            .get(url)
            .send()
            .await
            .map_err(|e| crate::error::IncrementumError::Internal(format!("Network error: {}", e)))?;

        if !response.status().is_success() {
            return Err(crate::error::IncrementumError::Internal(
                format!("HTTP error: {}", response.status())
            ));
        }

        let html = response.text().await.map_err(|e| {
            crate::error::IncrementumError::Internal(format!("Failed to read response: {}", e))
        })?;

        // Try parsing as index.php format first
        if let Ok(results) = self.parse_indexphp_results(&html) {
            if !results.is_empty() {
                return Ok(results);
            }
        }

        // Fall back to search.php format
        self.parse_searchphp_results(&html)
    }

    /// Filter out non-books and deduplicate results
    fn filter_and_deduplicate(&self, results: Vec<BookSearchResult>, limit: usize) -> Vec<BookSearchResult> {
        let mut seen = HashSet::new();
        let mut filtered = Vec::new();

        for book in results {
            // Skip journal articles and non-books
            let title_lower = book.title.to_lowercase();
            if title_lower.contains("journal") 
                || title_lower.contains("issue")
                || title_lower.contains("volume")
                || title_lower.contains("vol.")
                || title_lower.contains("proceedings")
            {
                continue;
            }

            // Deduplicate by title + author + year
            let key = (
                book.title.to_lowercase(),
                book.author.as_ref().map(|a| a.to_lowercase()).unwrap_or_default(),
                book.year.unwrap_or(0)
            );

            if seen.insert(key) && filtered.len() < limit {
                filtered.push(book);
            }
        }

        filtered
    }

    /// Parse index.php search results (libgen.li format)
    fn parse_indexphp_results(&self, html: &str) -> Result<Vec<BookSearchResult>> {
        let mut results = Vec::new();
        let mut seen_ids = HashSet::new();

        // Find the table body containing results
        let table_body_start = html.find("<tbody>").unwrap_or(0);
        let table_body_end = html[table_body_start..].find("</tbody>").map_or(html.len(), |p| table_body_start + p);
        let table_content = &html[table_body_start..table_body_end + 8];

        // Find all table rows
        let row_regex = Regex::new(r#"<tr[^>]*>(.*?)</tr>"#).unwrap();
        
        for caps in row_regex.captures_iter(table_content) {
            let row = caps.get(1).map(|m| m.as_str()).unwrap_or("");
            
            // Skip header rows
            if row.contains("<th") || row.len() < 100 {
                continue;
            }

            // Extract MD5 from the mirrors column
            let md5_re = Regex::new(r#"md5=([a-fA-F0-9]{32})"#).unwrap();
            let md5 = md5_re.captures(row)
                .and_then(|c| c.get(1))
                .map(|m| m.as_str().to_string())
                .unwrap_or_default();

            // Skip if no MD5 found or already processed
            if md5.is_empty() || !seen_ids.insert(md5.clone()) {
                continue;
            }

            // Parse the row
            if let Some(result) = self.parse_indexphp_row(row, &md5) {
                results.push(result);
            }
        }

        Ok(results)
    }

    /// Parse search.php results (libgen.rs/is format)
    fn parse_searchphp_results(&self, html: &str) -> Result<Vec<BookSearchResult>> {
        let mut results = Vec::new();
        let mut seen_ids = HashSet::new();

        // Find table with class "c" (the main results table)
        let table_start = html.find(r#"class="c""#).unwrap_or(0);
        let table_content = &html[table_start..];

        // Find all table rows
        let row_regex = Regex::new(r#"<tr[^>]*>(.*?)</tr>"#).unwrap();
        
        for caps in row_regex.captures_iter(table_content) {
            let row = caps.get(1).map(|m| m.as_str()).unwrap_or("");
            
            // Skip header rows
            if row.contains("<th") || row.len() < 50 {
                continue;
            }

            // Extract cells
            let cell_regex = Regex::new(r#"<td[^>]*>(.*?)</td>"#).unwrap();
            let cells: Vec<&str> = cell_regex.captures_iter(row)
                .filter_map(|c| c.get(1))
                .map(|m| m.as_str())
                .collect();

            if cells.len() < 9 {
                continue;
            }

            // Extract MD5 from the last column (mirrors/get link)
            let md5_re = Regex::new(r#"md5=([a-fA-F0-9]{32})"#).unwrap();
            let md5 = md5_re.captures(&cells[cells.len()-1])
                .and_then(|c| c.get(1))
                .map(|m| m.as_str().to_string())
                .unwrap_or_default();

            if md5.is_empty() || !seen_ids.insert(md5.clone()) {
                continue;
            }

            // Parse cells (search.php format):
            // [0] = ID, [1] = Author, [2] = Title, [3] = Publisher, [4] = Year
            // [5] = Pages, [6] = Language, [7] = Size, [8] = Extension, [9] = Mirrors
            let author = strip_html_tags(cells.get(1).unwrap_or(&"")).trim().to_string();
            let title = strip_html_tags(cells.get(2).unwrap_or(&"")).trim().to_string();
            let year = cells.get(4)
                .and_then(|c| strip_html_tags(c).trim().parse::<i32>().ok());
            let file_size = cells.get(7).map(|c| strip_html_tags(c).trim().to_string());
            let extension = strip_html_tags(cells.get(8).unwrap_or(&"")).trim().to_lowercase();

            if title.is_empty() || title.len() < 2 {
                continue;
            }

            let formats = BookFormat::from_extension(&extension)
                .map(|f| vec![f])
                .unwrap_or_else(|| vec![BookFormat::Pdf]);

            results.push(BookSearchResult {
                id: md5.clone(),
                title,
                author: if author.is_empty() { None } else { Some(author) },
                year,
                publisher: None,
                language: None,
                formats,
                cover_url: None, // search.php doesn't provide cover URLs easily
                description: None,
                isbn: None,
                md5: Some(md5),
                file_size,
            });
        }

        Ok(results)
    }

    /// Parse a single index.php table row
    fn parse_indexphp_row(&self, row: &str, md5: &str) -> Option<BookSearchResult> {
        let cell_regex = Regex::new(r#"<td[^>]*>(.*?)</td>"#).unwrap();
        let cells: Vec<&str> = cell_regex.captures_iter(row)
            .filter_map(|c| c.get(1))
            .map(|m| m.as_str())
            .collect();

        if cells.len() < 8 {
            return None;
        }

        let title = self.extract_title_from_cell(cells.get(0).unwrap_or(&""))
            .unwrap_or_else(|| "Unknown Title".to_string());

        let author = self.extract_author_from_cell(cells.get(1).unwrap_or(&""));
        let publisher = self.extract_publisher_from_cell(cells.get(2).unwrap_or(&""));
        let year = self.extract_year_from_cell(cells.get(3).unwrap_or(&""));
        let language = self.extract_language_from_cell(cells.get(4).unwrap_or(&""));
        let file_size = self.extract_file_size_from_cell(cells.get(6).unwrap_or(&""));
        let formats = self.extract_formats_from_cell(cells.get(7).unwrap_or(&""));

        let file_id = self.extract_file_id_from_cell(cells.get(6).unwrap_or(&""));
        let cover_url = file_id.map(|id| format!("{}/covers/{}/{}-g.jpg", 
            self.get_current_mirror(),
            &id[..(id.len().min(3))].to_string(),
            id
        ));

        Some(BookSearchResult {
            id: md5.to_string(),
            title,
            author,
            year,
            publisher,
            language,
            formats,
            cover_url,
            description: None,
            isbn: None,
            md5: Some(md5.to_string()),
            file_size,
        })
    }

    /// Extract title from the first table cell
    fn extract_title_from_cell(&self, cell: &str) -> Option<String> {
        let title_re = Regex::new(r#"<a[^>]*href="edition\.php[^"]*"[^>]*>([^<]+)</a>"#).unwrap();
        
        if let Some(caps) = title_re.captures(cell) {
            let title = caps.get(1).map(|m| m.as_str()).unwrap_or("");
            let cleaned = strip_html_tags(title).trim().to_string();
            if !cleaned.is_empty() && cleaned.len() > 2 {
                return Some(cleaned);
            }
        }

        let link_re = Regex::new(r#"<a[^>]*>([^<]{10,200})</a>"#).unwrap();
        if let Some(caps) = link_re.captures(cell) {
            let title = caps.get(1).map(|m| m.as_str()).unwrap_or("");
            let cleaned = strip_html_tags(title).trim().to_string();
            if !cleaned.is_empty() && cleaned.len() > 3 {
                return Some(cleaned);
            }
        }

        let bold_re = Regex::new(r#"<b>([^<]+)</b>"#).unwrap();
        if let Some(caps) = bold_re.captures(cell) {
            let title = caps.get(1).map(|m| m.as_str()).unwrap_or("");
            let cleaned = strip_html_tags(title).trim().to_string();
            if !cleaned.is_empty() && cleaned.len() > 3 {
                return Some(cleaned);
            }
        }

        None
    }

    /// Extract author from the second table cell
    fn extract_author_from_cell(&self, cell: &str) -> Option<String> {
        let cleaned = strip_html_tags(cell).trim().to_string();
        if !cleaned.is_empty() && cleaned.len() > 1 && cleaned.len() < 200 {
            let author = cleaned
                .trim_start_matches("Review by:")
                .trim_start_matches("by ")
                .trim()
                .to_string();
            if !author.is_empty() {
                return Some(author);
            }
        }
        None
    }

    /// Extract publisher from the third table cell
    fn extract_publisher_from_cell(&self, cell: &str) -> Option<String> {
        let cleaned = strip_html_tags(cell).trim().to_string();
        if !cleaned.is_empty() && cleaned.len() > 1 && cleaned.len() < 100 {
            return Some(cleaned);
        }
        None
    }

    /// Extract year from the fourth table cell
    fn extract_year_from_cell(&self, cell: &str) -> Option<i32> {
        let year_re = Regex::new(r#"\b(19|20)\d{2}\b"#).unwrap();
        year_re.captures(cell)
            .and_then(|c| c.get(0))
            .and_then(|m| m.as_str().parse::<i32>().ok())
    }

    /// Extract language from the fifth table cell
    fn extract_language_from_cell(&self, cell: &str) -> Option<String> {
        let cleaned = strip_html_tags(cell).trim().to_string();
        if !cleaned.is_empty() && cleaned.len() > 1 && cleaned.len() < 50 {
            return Some(cleaned);
        }
        None
    }

    /// Extract file size from the seventh table cell
    fn extract_file_size_from_cell(&self, cell: &str) -> Option<String> {
        let size_re = Regex::new(r#"(\d+(?:\.\d+)?)\s*(KB|MB|GB|kb|mb|gb)"#).unwrap();
        size_re.captures(cell)
            .and_then(|c| c.get(0))
            .map(|m| m.as_str().to_string())
    }

    /// Extract file ID from the size cell (used for cover URL)
    fn extract_file_id_from_cell(&self, cell: &str) -> Option<String> {
        let id_re = Regex::new(r#"file\.php\?id=(\d+)"#).unwrap();
        id_re.captures(cell)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().to_string())
    }

    /// Extract format from the eighth table cell
    fn extract_formats_from_cell(&self, cell: &str) -> Vec<BookFormat> {
        let mut formats: Vec<BookFormat> = Vec::new();
        
        let ext = strip_html_tags(cell).trim().to_lowercase();
        
        if let Some(format) = BookFormat::from_extension(&ext) {
            formats.push(format);
        }

        if formats.is_empty() {
            let cell_upper = cell.to_uppercase();
            if cell_upper.contains("PDF") {
                formats.push(BookFormat::Pdf);
            } else if cell_upper.contains("EPUB") {
                formats.push(BookFormat::Epub);
            } else if cell_upper.contains("MOBI") {
                formats.push(BookFormat::Mobi);
            } else if cell_upper.contains("AZW") {
                formats.push(BookFormat::Azw3);
            } else if cell_upper.contains("DJVU") {
                formats.push(BookFormat::Djvu);
            } else if cell_upper.contains("CBZ") {
                formats.push(BookFormat::Cbz);
            } else if cell_upper.contains("CBR") {
                formats.push(BookFormat::Cbr);
            } else if cell_upper.contains("RTF") {
                formats.push(BookFormat::Rtf);
            }
        }

        if formats.is_empty() {
            formats.push(BookFormat::Pdf);
        }

        formats
    }

    /// Download a book from LibGen
    pub async fn download_book(
        &self,
        md5: &str,
        _format: BookFormat,
        download_path: &std::path::Path,
        progress_callback: impl Fn(DownloadProgress),
    ) -> Result<std::path::PathBuf> {
        // Try multiple download URL formats
        let download_urls = vec![
            format!("{}/ads.php?md5={}&download=1", self.get_current_mirror(), md5),
            format!("{}/get.php?md5={}", self.get_current_mirror(), md5),
            format!("{}/download.php?md5={}", self.get_current_mirror(), md5),
        ];

        progress_callback(DownloadProgress {
            book_id: md5.to_string(),
            progress: 0.0,
            bytes_downloaded: 0,
            total_bytes: None,
            status: DownloadStatus::Connecting,
        });

        let mut last_error = None;

        for download_url in download_urls {
            match self.try_download(&download_url, download_path, md5, &progress_callback).await {
                Ok(path) => return Ok(path),
                Err(e) => {
                    last_error = Some(e);
                    continue;
                }
            }
        }

        Err(last_error.unwrap_or_else(|| {
            crate::error::IncrementumError::Internal("All download methods failed".to_string())
        }))
    }

    /// Try to download from a specific URL
    async fn try_download(
        &self,
        url: &str,
        download_path: &std::path::Path,
        book_id: &str,
        progress_callback: &impl Fn(DownloadProgress),
    ) -> Result<std::path::PathBuf> {
        let response = self.http_client
            .get(url)
            .send()
            .await
            .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to connect: {}", e)))?;

        if !response.status().is_success() {
            return Err(crate::error::IncrementumError::Internal(
                format!("Download failed with status: {}", response.status())
            ));
        }

        let total_bytes = response.content_length();
        let final_path = download_path.to_path_buf();

        progress_callback(DownloadProgress {
            book_id: book_id.to_string(),
            progress: 0.0,
            bytes_downloaded: 0,
            total_bytes,
            status: DownloadStatus::Downloading,
        });

        let mut file = tokio::fs::File::create(&final_path).await.map_err(|e| {
            crate::error::IncrementumError::Internal(format!("Failed to create file: {}", e))
        })?;

        let mut stream = response.bytes_stream();
        let mut bytes_downloaded: u64 = 0;

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| {
                crate::error::IncrementumError::Internal(format!("Failed to download chunk: {}", e))
            })?;

            tokio::io::AsyncWriteExt::write_all(&mut file, &chunk).await.map_err(|e| {
                crate::error::IncrementumError::Internal(format!("Failed to write to file: {}", e))
            })?;

            bytes_downloaded += chunk.len() as u64;

            let progress = if let Some(total) = total_bytes {
                bytes_downloaded as f32 / total as f32
            } else {
                0.0
            };

            progress_callback(DownloadProgress {
                book_id: book_id.to_string(),
                progress,
                bytes_downloaded,
                total_bytes,
                status: DownloadStatus::Downloading,
            });
        }

        tokio::io::AsyncWriteExt::flush(&mut file).await.map_err(|e| {
            crate::error::IncrementumError::Internal(format!("Failed to flush file: {}", e))
        })?;

        progress_callback(DownloadProgress {
            book_id: book_id.to_string(),
            progress: 1.0,
            bytes_downloaded,
            total_bytes,
            status: DownloadStatus::Completed,
        });

        Ok(final_path)
    }
}

/// Strip HTML tags from text
fn strip_html_tags(html: &str) -> String {
    let re = Regex::new(r"<[^>]+>").unwrap();
    let text = re.replace_all(html, "");
    text.trim().to_string()
}

impl Default for AnnaArchiveClient {
    fn default() -> Self {
        Self::new()
    }
}

/// Search for books on LibGen (via "Anna's Archive" UI)
#[tauri::command]
pub async fn search_books(query: String, limit: Option<usize>) -> Result<Vec<BookSearchResult>> {
    let client = AnnaArchiveClient::new();
    let limit = limit.unwrap_or(25).min(100);

    // Implement rate limiting with exponential backoff
    let mut attempts = 0;
    let max_attempts = 3;

    loop {
        match client.search_books(&query, limit).await {
            Ok(results) => return Ok(results),
            Err(e) => {
                attempts += 1;
                if attempts >= max_attempts {
                    return Err(e);
                }
                let backoff_ms = 1000 * (2_u64.pow(attempts as u32 - 1));
                tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
            }
        }
    }
}

/// Download result containing the file path and metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadResult {
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
}

/// Download a book from LibGen (via "Anna's Archive" UI)
#[tauri::command]
pub async fn download_book(
    book_id: String,
    format: BookFormat,
    download_path: Option<String>,
) -> Result<DownloadResult> {
    let client = AnnaArchiveClient::new();

    let download_dir = if let Some(path) = download_path {
        if path.is_empty() || path == "temp" {
            let temp_dir = std::env::temp_dir();
            temp_dir.join("incrementum-downloads")
        } else {
            let path_buf = std::path::PathBuf::from(&path);
            if path_buf.extension().is_some() {
                path_buf.parent().map(|p| p.to_path_buf()).unwrap_or_else(|| {
                    let temp_dir = std::env::temp_dir();
                    temp_dir.join("incrementum-downloads")
                })
            } else {
                path_buf
            }
        }
    } else {
        let temp_dir = std::env::temp_dir();
        temp_dir.join("incrementum-downloads")
    };

    tokio::fs::create_dir_all(&download_dir).await.map_err(|e| {
        crate::error::IncrementumError::Internal(format!("Failed to create download directory: {}", e))
    })?;

    let file_name = format!("{}.{}", book_id, format);
    let file_path = download_dir.join(&file_name);

    let final_path = client.download_book(&book_id, format.clone(), &file_path, |progress| {
        eprintln!("Download progress: {:?}", progress);
    }).await?;

    let file_size = tokio::fs::metadata(&final_path).await
        .map(|m| m.len())
        .unwrap_or(0);

    Ok(DownloadResult {
        file_path: final_path.to_string_lossy().to_string(),
        file_name,
        file_size,
    })
}

/// Get available LibGen mirrors
#[tauri::command]
pub fn get_available_mirrors() -> Vec<String> {
    LIBGEN_MIRRORS.iter().map(|s| s.to_string()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_book_format_display() {
        assert_eq!(BookFormat::Pdf.to_string(), "pdf");
        assert_eq!(BookFormat::Epub.to_string(), "epub");
        assert_eq!(BookFormat::Mobi.to_string(), "mobi");
    }

    #[test]
    fn test_book_format_from_extension() {
        assert_eq!(BookFormat::from_extension("pdf"), Some(BookFormat::Pdf));
        assert_eq!(BookFormat::from_extension("PDF"), Some(BookFormat::Pdf));
        assert_eq!(BookFormat::from_extension("epub"), Some(BookFormat::Epub));
        assert_eq!(BookFormat::from_extension("mobi"), Some(BookFormat::Mobi));
        assert_eq!(BookFormat::from_extension("azw3"), Some(BookFormat::Azw3));
        assert_eq!(BookFormat::from_extension("azw"), Some(BookFormat::Azw3));
        assert_eq!(BookFormat::from_extension("djvu"), Some(BookFormat::Djvu));
        assert_eq!(BookFormat::from_extension("rtf"), Some(BookFormat::Rtf));
        assert_eq!(BookFormat::from_extension("unknown"), None);
    }

    #[test]
    fn test_strip_html_tags() {
        assert_eq!(strip_html_tags("<p>Hello World</p>"), "Hello World");
        assert_eq!(strip_html_tags("<a href='#'>Link</a>"), "Link");
        assert_eq!(strip_html_tags("   Text   "), "Text");
    }

    #[test]
    fn test_filter_and_deduplicate() {
        let client = AnnaArchiveClient::new();
        let results = vec![
            BookSearchResult {
                id: "1".to_string(),
                title: "Test Book".to_string(),
                author: Some("Author".to_string()),
                year: Some(2020),
                publisher: None,
                language: None,
                formats: vec![BookFormat::Pdf],
                cover_url: None,
                description: None,
                isbn: None,
                md5: Some("abc".to_string()),
                file_size: None,
            },
            BookSearchResult {
                id: "2".to_string(),
                title: "Test Book".to_string(), // Duplicate
                author: Some("Author".to_string()),
                year: Some(2020),
                publisher: None,
                language: None,
                formats: vec![BookFormat::Epub],
                cover_url: None,
                description: None,
                isbn: None,
                md5: Some("def".to_string()),
                file_size: None,
            },
            BookSearchResult {
                id: "3".to_string(),
                title: "Journal of Something".to_string(), // Should be filtered
                author: Some("Author".to_string()),
                year: Some(2020),
                publisher: None,
                language: None,
                formats: vec![BookFormat::Pdf],
                cover_url: None,
                description: None,
                isbn: None,
                md5: Some("ghi".to_string()),
                file_size: None,
            },
        ];

        let filtered = client.filter_and_deduplicate(results, 10);
        assert_eq!(filtered.len(), 1); // One unique non-journal book
    }
}
