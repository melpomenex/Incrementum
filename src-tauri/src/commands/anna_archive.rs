//! Anna's Archive integration for book search and download
//!
//! Search uses HTTP scraping. Downloads use a Playwright-based Python helper
//! script to handle Cloudflare challenges and JavaScript-based download flows.

use crate::error::Result;
use serde::{Deserialize, Serialize};
use regex::Regex;
use std::collections::HashSet;
use std::time::Duration;

/// Anna's Archive mirror domains (in order of preference)
/// Updated to working mirrors as of May 2026
const ANNAS_ARCHIVE_MIRRORS: &[&str] = &[
    "https://annas-archive.gl",
    "https://annas-archive.pk",
    "https://annas-archive.gd",
    "https://annas-archive.pm",
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

/// Book search result from Anna's Archive
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


/// Internal state for Anna's Archive client
#[derive(Clone)]
pub struct AnnaArchiveClient {
    current_mirror_index: usize,
    http_client: reqwest::Client,
}

impl AnnaArchiveClient {
    /// Create a new Anna's Archive client
    pub fn new() -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .build()
            .unwrap_or_default();

        Self {
            current_mirror_index: 0,
            http_client,
        }
    }

    /// Get the current mirror URL
    fn get_current_mirror(&self) -> &'static str {
        ANNAS_ARCHIVE_MIRRORS.get(self.current_mirror_index)
            .copied()
            .unwrap_or(ANNAS_ARCHIVE_MIRRORS[0])
    }

    /// Try the next mirror
    fn try_next_mirror(&mut self) -> Option<&'static str> {
        if self.current_mirror_index + 1 < ANNAS_ARCHIVE_MIRRORS.len() {
            self.current_mirror_index += 1;
            Some(self.get_current_mirror())
        } else {
            None
        }
    }

    /// Search for books on Anna's Archive
    /// Tries multiple mirrors for best results
    pub async fn search_books(&self, query: &str, limit: usize) -> Result<Vec<BookSearchResult>> {
        let encoded_query = urlencoding::encode(query);
        let mut last_error = None;
        let mut client = self.clone();

        loop {
            let mirror = client.get_current_mirror();
            let search_url = format!("{}/search?q={}", mirror, encoded_query);

            match client.fetch_search_results(&search_url).await {
                Ok(results) if !results.is_empty() => {
                    return Ok(client.filter_and_deduplicate(results, limit));
                }
                Ok(_) => {} // Empty results, try next mirror
                Err(e) => last_error = Some(e),
            }

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

        self.parse_annas_archive_results(&html)
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
            let key = format!("{}-{}-{}", 
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

    /// Parse Anna's Archive search results
    fn parse_annas_archive_results(&self, html: &str) -> Result<Vec<BookSearchResult>> {
        let mut results = Vec::new();
        
        // Anna's Archive uses <a> tags with class "js-vim-focus" for results
        // Use a more robust item matching that handles varying attribute order and multiple items
        let item_re = Regex::new(r#"(?s)<a\s+[^>]*?class="[^"]*js-vim-focus[^"]*"[^>]*?>(.*?)</a>"#).expect("valid regex");
        let href_re = Regex::new(r#"href="([^"]+?)""#).expect("valid regex");
        let title_re = Regex::new(r#"(?s)<h3[^>]*?>(.*?)</h3>"#).expect("valid regex");
        // Look for metadata div first (has more distinct structure)
        let meta_div_re = Regex::new(r#"(?s)<div\s+[^>]*?class="[^"]*?text-gray-500[^"]*?"[^>]*?>(.*?)</div>"#).expect("valid regex");
        // Author is typically an italic div or a div right after title
        let italic_div_re = Regex::new(r#"(?s)<div\s+[^>]*?class="[^"]*?italic[^"]*?"[^>]*?>(.*?)</div>"#).expect("valid regex");
        
        for caps in item_re.captures_iter(html) {
            let full_match = caps.get(0).map(|m| m.as_str()).unwrap_or("");
            let content = caps.get(1).map(|m| m.as_str()).unwrap_or("");
            
            let href = href_re.captures(full_match)
                .and_then(|c| c.get(1))
                .map(|m| m.as_str())
                .unwrap_or("");
                
            if href.is_empty() {
                continue;
            }

            let md5 = if href.starts_with("/md5/") {
                Some(href.trim_start_matches("/md5/").to_string())
            } else {
                None
            };

            let title_raw = title_re.captures(content)
                .and_then(|c| c.get(1))
                .map(|m| strip_html_tags(m.as_str()))
                .unwrap_or_else(|| "Unknown Title".to_string());
            let title = title_raw.split_whitespace().collect::<Vec<_>>().join(" ");
                
            let mut result = BookSearchResult {
                id: md5.clone().unwrap_or_else(|| href.to_string()),
                title: title.clone(),
                author: None,
                year: None,
                publisher: None,
                language: None,
                formats: Vec::new(),
                cover_url: None,
                description: None,
                isbn: None,
                md5,
                file_size: None,
            };

            // 1. Try to find metadata div (contains formats, lang, size, etc.)
            for meta_caps in meta_div_re.captures_iter(content) {
                let meta_text = strip_html_tags(meta_caps.get(1).map(|m| m.as_str()).unwrap_or(""));
                let cleaned = meta_text.split_whitespace().collect::<Vec<_>>().join(" ");
                if cleaned.contains('·') || cleaned.contains('|') || cleaned.matches(',').count() > 1 || cleaned.contains('•') {
                    self.parse_metadata_string(&cleaned, &mut result);
                }
            }

            // 2. Try to find author (italic div)
            if let Some(author_caps) = italic_div_re.captures(content) {
                let author_text = strip_html_tags(author_caps.get(1).map(|m| m.as_str()).unwrap_or(""));
                let cleaned = author_text.split_whitespace().collect::<Vec<_>>().join(" ");
                if !cleaned.is_empty() && cleaned != title && cleaned.len() < 100 {
                    result.author = Some(cleaned);
                }
            }

            // 3. Fallback format extraction
            if result.formats.is_empty() {
                let stripped_content = strip_html_tags(content);
                self.parse_metadata_string(&stripped_content, &mut result);
            }

            if result.cover_url.is_none() {
                if let Some(ref md5_val) = result.md5 {
                    result.cover_url = Some(format!("{}/covers/{}.jpg", self.get_current_mirror(), md5_val));
                }
            }

            results.push(result);
        }

        Ok(results)
    }

    /// Parse metadata string from Anna's Archive
    fn parse_metadata_string(&self, meta: &str, result: &mut BookSearchResult) {
        // Formats can be "English [en] · EPUB · 2.0MB · 2003"
        // We handle multiple possible separators
        let separators = ['·', ',', '|', '·', '•'];
        let mut parts: Vec<String> = Vec::new();
        
        let mut current = String::new();
        for c in meta.chars() {
            if separators.contains(&c) {
                if !current.trim().is_empty() {
                    parts.push(current.trim().to_string());
                }
                current = String::new();
            } else {
                current.push(c);
            }
        }
        if !current.trim().is_empty() {
            parts.push(current.trim().to_string());
        }
        
        for part in parts {
            let part_lower = part.to_lowercase();
            
            // Language: "English [en]"
            if part.contains('[') && part.contains(']') {
                result.language = Some(part);
                continue;
            }
            
            // Format: "EPUB", "PDF"
            if let Some(format) = BookFormat::from_extension(&part) {
                if !result.formats.contains(&format) {
                    result.formats.push(format);
                }
                continue;
            }
            
            // Size: "2.0MB"
            if part_lower.contains("kb") || part_lower.contains("mb") || part_lower.contains("gb") {
                result.file_size = Some(part);
                continue;
            }
            
            // Year: "2003"
            if let Ok(year) = part.parse::<i32>() {
                if year > 1800 && year < 2100 {
                    result.year = Some(year);
                    continue;
                }
            }
        }
        
        // Final format fallback: if we still have no formats, try scanning the raw string for known extensions
        if result.formats.is_empty() {
            for ext in ["epub", "pdf", "mobi", "azw3", "djvu", "cbz", "cbr"] {
                if meta.to_lowercase().contains(ext) {
                    if let Some(format) = BookFormat::from_extension(ext) {
                        result.formats.push(format);
                        break;
                    }
                }
            }
        }
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

/// Search for books on Anna's Archive
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

/// Resolve the path to the Python download helper script
fn get_download_script_path() -> Result<std::path::PathBuf> {
    let script_name = "anna_download.py";

    // Dev mode: relative to CARGO_MANIFEST_DIR
    let dev_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("scripts")
        .join(script_name);
    if dev_path.exists() {
        return Ok(dev_path);
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let candidate = exe_dir.join("scripts").join(script_name);
            if candidate.exists() {
                return Ok(candidate);
            }
            // macOS .app bundle pattern
            if let Some(parent) = exe_dir.parent() {
                let candidate = parent.join("scripts").join(script_name);
                if candidate.exists() {
                    return Ok(candidate);
                }
            }
        }
    }

    Err(crate::error::IncrementumError::Internal(
        "Anna's Archive download script not found".to_string(),
    ))
}

/// Find the system Python 3 binary
fn find_python3() -> Result<std::path::PathBuf> {
    for name in &["python3", "python"] {
        if let Ok(output) = std::process::Command::new(name)
            .arg("--version")
            .output()
        {
            if output.status.success() {
                return Ok(std::path::PathBuf::from(name));
            }
        }
    }

    let candidates = [
        "/usr/bin/python3",
        "/usr/local/bin/python3",
        "/bin/python3",
    ];
    for path in &candidates {
        if std::path::Path::new(path).exists() {
            return Ok(std::path::PathBuf::from(path));
        }
    }

    Err(crate::error::IncrementumError::Internal(
        "Python 3 not found. Install Python 3 to use Anna's Archive downloads.".to_string(),
    ))
}

/// Download a book from Anna's Archive via Playwright helper script
#[tauri::command]
pub async fn download_book(
    book_id: String,
    format: BookFormat,
    download_path: Option<String>,
) -> Result<DownloadResult> {
    let python = find_python3()?;
    let script = get_download_script_path()?;

    let download_dir = if let Some(path) = download_path {
        if path.is_empty() || path == "temp" {
            std::env::temp_dir().join("incrementum-downloads")
        } else {
            let path_buf = std::path::PathBuf::from(&path);
            if path_buf.extension().is_some() {
                let parent = path_buf.parent().unwrap_or_else(|| {
                    std::path::Path::new(".")
                });
                // Canonicalize to prevent path traversal
                std::fs::canonicalize(parent).unwrap_or_else(|_| {
                    std::env::temp_dir().join("incrementum-downloads")
                })
            } else {
                // Canonicalize to prevent path traversal
                std::fs::canonicalize(&path_buf).unwrap_or_else(|_| {
                    std::env::temp_dir().join("incrementum-downloads")
                })
            }
        }
    } else {
        std::env::temp_dir().join("incrementum-downloads")
    };

    tokio::fs::create_dir_all(&download_dir).await.map_err(|e| {
        crate::error::IncrementumError::Internal(format!("Failed to create download directory: {}", e))
    })?;

    let args = [
        script.to_string_lossy().to_string(),
        "--md5".to_string(),
        book_id.clone(),
        "--output-dir".to_string(),
        download_dir.to_string_lossy().to_string(),
        "--format".to_string(),
        format.to_string(),
        "--timeout".to_string(),
        "180".to_string(),
    ];

    let output = tokio::time::timeout(
        Duration::from_secs(300),
        tokio::process::Command::new(&python)
            .args(&args)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .env_remove("PYTHONHOME")
            .env_remove("PYTHONPATH")
            .env_remove("PYTHONUSERBASE")
            .env_remove("PYTHONNOUSERSITE")
            .env("PLAYWRIGHT_BROWSERS_PATH", "0")
            .output(),
    )
    .await
    .map_err(|_| crate::error::IncrementumError::Internal("Download timed out after 5 minutes".to_string()))?
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to run download script: {}", e)))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if !output.status.success() || stdout.is_empty() {
        let error_msg = if stderr.contains("ModuleNotFoundError") && stderr.contains("playwright") {
            "Playwright is not installed. Install with: pip install playwright && playwright install chromium".to_string()
        } else if !stderr.is_empty() {
            format!("Download error: {}", stderr.chars().take(500).collect::<String>())
        } else {
            "Download failed with no output".to_string()
        };
        return Err(crate::error::IncrementumError::Internal(error_msg));
    }

    let result: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| crate::error::IncrementumError::Internal(format!(
            "Failed to parse download result: {}. Output: {}",
            e,
            stdout.chars().take(200).collect::<String>()
        )))?;

    if result["success"].as_bool().unwrap_or(false) {
        Ok(DownloadResult {
            file_path: result["file_path"].as_str().unwrap_or_default().to_string(),
            file_name: result["file_name"].as_str().unwrap_or_default().to_string(),
            file_size: result["file_size"].as_u64().unwrap_or(0),
        })
    } else {
        let error_type = result["error_type"].as_str().unwrap_or("unknown");
        let error_msg = result["error"].as_str().unwrap_or("Unknown download error");

        let message = match error_type {
            "playwright_missing" => format!(
                "{}. Install with: pip install playwright && playwright install chromium",
                error_msg
            ),
            "cloudflare_blocked" => format!(
                "{}. Try again later or use a VPN.",
                error_msg
            ),
            _ => error_msg.to_string(),
        };

        Err(crate::error::IncrementumError::Internal(message))
    }
}

/// Get available Anna's Archive mirrors
#[tauri::command]
pub fn get_available_mirrors() -> Vec<String> {
    ANNAS_ARCHIVE_MIRRORS.iter().map(|s| s.to_string()).collect()
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

    #[test]
    fn test_parse_annas_archive_results() {
        let client = AnnaArchiveClient::new();
        let html = r#"
            <a href="/md5/abc123def456" class="js-vim-focus custom-a flex items-center">
                <div class="flex-grow">
                    <h3 class="text-lg font-bold">Test Book Title</h3>
                    <div class="text-sm italic">Author Name</div>
                    <div class="text-sm text-gray-500 mt-1">
                        English [en] · EPUB · 2.0MB · 2021 · Book
                    </div>
                </div>
            </a>
        "#;
        
        let results = client.parse_annas_archive_results(html).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "Test Book Title");
        assert_eq!(results[0].md5, Some("abc123def456".to_string()));
        assert_eq!(results[0].author, Some("Author Name".to_string()));
        assert_eq!(results[0].year, Some(2021));
        assert_eq!(results[0].formats, vec![BookFormat::Epub]);
        assert_eq!(results[0].language, Some("English [en]".to_string()));
        assert_eq!(results[0].file_size, Some("2.0MB".to_string()));
    }
}
