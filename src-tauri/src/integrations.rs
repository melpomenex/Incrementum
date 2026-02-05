//! External integrations support
//!
//! This module provides integration with external applications like Obsidian,
//! Anki, and browser extensions.

use crate::error::AppError;
use crate::database::Repository;
use std::path::{Path, PathBuf};
use std::fs;
use tokio::net::TcpListener;
use tokio_tungstenite::{tungstenite::Message, WebSocketStream};
use futures::{StreamExt, SinkExt};
use tokio::net::TcpStream as TokioTcpStream;
use tokio_tungstenite::tungstenite::protocol::Role;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;
use chrono::Utc;

/// Obsidian vault configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObsidianConfig {
    pub vault_path: String,
    pub notes_folder: String,
    pub attachments_folder: String,
    pub dataview_folder: Option<String>,
}

/// Anki configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnkiConfig {
    pub url: String,
    pub deck_name: String,
    pub model_name: String,
    pub basic_model_name: Option<String>,
    pub cloze_model_name: Option<String>,
}

/// Browser extension server
pub struct ExtensionServer {
    port: u16,
    running: bool,
}

impl ExtensionServer {
    /// Create a new extension server
    pub fn new(port: u16) -> Self {
        Self {
            port,
            running: false,
        }
    }

    /// Start the WebSocket server
    pub async fn start(&mut self) -> Result<(), AppError> {
        let listener = TcpListener::bind(format!("127.0.0.1:{}", self.port))
            .await
            .map_err(|e| AppError::IntegrationError(format!("Failed to bind to port {}: {}", self.port, e)))?;

        self.running = true;

        tokio::spawn(async move {
            while let Ok((stream, _)) = listener.accept().await {
                let ws_stream = WebSocketStream::from_raw_socket(
                    stream,
                    Role::Server,
                    Some(tokio_tungstenite::tungstenite::protocol::WebSocketConfig::default())
                ).await;
                let mut ws = ws_stream;

                while let Some(msg) = ws.next().await {
                    match msg {
                        Ok(Message::Text(text)) => {
                            // Handle extension message
                            if let Err(e) = handle_extension_message(&mut ws, &text).await {
                                eprintln!("Error handling message: {}", e);
                            }
                        }
                        Ok(Message::Close(_)) => break,
                        Err(e) => {
                            eprintln!("WebSocket error: {}", e);
                            break;
                        }
                        _ => {}
                    }
                }
            }
        });

        Ok(())
    }

    /// Stop the server
    pub fn stop(&mut self) {
        self.running = false;
    }
}

/// Handle browser extension message
async fn handle_extension_message(
    ws: &mut WebSocketStream<TokioTcpStream>,
    message: &str,
) -> Result<(), AppError> {
    let msg: serde_json::Value = serde_json::from_str(message)
        .map_err(|_| AppError::IntegrationError("Invalid JSON message".to_string()))?;

    let response = match msg["type"].as_str() {
        Some("ping") => serde_json::json!({
            "type": "pong",
            "data": { "status": "ok" }
        }),
        Some("save_page") => {
            // Handle page save
            serde_json::json!({
                "type": "save_response",
                "data": { "success": true, "document_id": "saved" }
            })
        },
        Some("create_extract") => {
            // Handle extract creation
            serde_json::json!({
                "type": "extract_response",
                "data": { "success": true, "extract_id": "created" }
            })
        },
        _ => serde_json::json!({
            "type": "error",
            "data": { "message": "Unknown message type" }
        }),
    };

    ws.send(Message::Text(response.to_string()))
        .await
        .map_err(|e| AppError::IntegrationError(format!("Failed to send response: {}", e)))?;

    Ok(())
}

/// Export document to Obsidian markdown
pub async fn export_document_to_obsidian(
    document_id: &str,
    config: &ObsidianConfig,
    repo: &Repository,
) -> Result<PathBuf, AppError> {
    let document = repo.get_document(document_id).await?
        .ok_or_else(|| AppError::NotFound(format!("Document {} not found", document_id)))?;

    let notes_path = obsidian_notes_path(config);

    // Create notes folder if it doesn't exist
    fs::create_dir_all(&notes_path)
        .map_err(|e| AppError::IntegrationError(format!("Failed to create notes folder: {}", e)))?;

    let file_path = resolve_obsidian_markdown_path(&notes_path, &document.title, &document.id)?;

    // Generate markdown content
    let markdown = generate_obsidian_markdown(&document);

    // Write file
    fs::write(&file_path, markdown)
        .map_err(|e| AppError::IntegrationError(format!("Failed to write markdown: {}", e)))?;

    Ok(file_path)
}

/// Export extract to Obsidian markdown
pub async fn export_extract_to_obsidian_internal(
    extract_id: &str,
    config: &ObsidianConfig,
    repo: &Repository,
) -> Result<PathBuf, AppError> {
    let extract = repo.get_extract(extract_id).await?
        .ok_or_else(|| AppError::NotFound(format!("Extract {} not found", extract_id)))?;

    let notes_path = obsidian_extracts_path(config);

    fs::create_dir_all(&notes_path)
        .map_err(|e| AppError::IntegrationError(format!("Failed to create notes folder: {}", e)))?;

    let title = extract.page_title.as_deref().unwrap_or("Untitled");
    let file_path = resolve_obsidian_markdown_path(&notes_path, title, &extract.id)?;

    let markdown = generate_extract_markdown(&extract);

    fs::write(&file_path, markdown)
        .map_err(|e| AppError::IntegrationError(format!("Failed to write markdown: {}", e)))?;

    Ok(file_path)
}

/// Generate Obsidian markdown for a document
fn generate_obsidian_markdown(document: &crate::models::Document) -> String {
    let mut markdown = String::new();

    // Frontmatter
    markdown.push_str("---\n");
    markdown.push_str(&format!("title: {}\n", document.title));
    markdown.push_str("incrementum-type: document\n");
    if let Some(metadata) = &document.metadata {
        if let Some(author) = &metadata.author {
            markdown.push_str(&format!("author: {}\n", author));
        }
    }
    markdown.push_str(&format!("created: {}\n", document.date_added.format("%Y-%m-%d")));
    markdown.push_str(&format!("incrementum-id: {}\n", document.id));
    markdown.push_str("---\n\n");

    // Title
    markdown.push_str(&format!("# {}\n\n", document.title));

    // Content
    if let Some(content) = &document.content {
        markdown.push_str(content);
    }

    // Tags
    if !document.tags.is_empty() {
        markdown.push_str("\n\n");
        for tag in &document.tags {
            markdown.push_str(&format!("#{}", tag));
        }
    }

    markdown
}

/// Generate markdown for an extract
fn generate_extract_markdown(extract: &crate::models::Extract) -> String {
    let mut markdown = String::new();

    // Frontmatter
    markdown.push_str("---\n");
    let title = extract.page_title.as_deref().unwrap_or("Untitled");
    markdown.push_str(&format!("title: {}\n", title));
    markdown.push_str("incrementum-type: extract\n");
    markdown.push_str(&format!("incrementum-id: {}\n", extract.id));
    markdown.push_str(&format!("document-id: {}\n", extract.document_id));
    markdown.push_str(&format!("disclosure-level: {}\n", extract.progressive_disclosure_level));
    markdown.push_str("---\n\n");

    // Title
    markdown.push_str(&format!("## {}\n\n", title));

    // Content
    markdown.push_str(&extract.content);
    markdown.push('\n');

    // Metadata
    markdown.push_str("\n---\n");
    if let Some(page_number) = extract.page_number {
        markdown.push_str(&format!("Page: {}\n", page_number));
    }

    markdown
}

/// Conversation message for export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationMessage {
    pub role: String,
    pub content: String,
    pub timestamp: Option<i64>,
}

/// Export conversation to Obsidian markdown
pub async fn export_conversation_to_obsidian_internal(
    messages: &[ConversationMessage],
    title: &str,
    config: &ObsidianConfig,
    context_info: Option<&str>,
) -> Result<PathBuf, AppError> {
    let vault_path = PathBuf::from(&config.vault_path);
    let notes_path = vault_path.join(&config.notes_folder);

    // Create notes folder if it doesn't exist
    fs::create_dir_all(&notes_path)
        .map_err(|e| AppError::IntegrationError(format!("Failed to create notes folder: {}", e)))?;

    // Generate filename from title with timestamp
    let timestamp = chrono::Local::now().format("%Y-%m-%d-%H%M");
    let filename = format!("{}-{}.md", sanitize_filename(title), timestamp);
    let file_path = notes_path.join(&filename);

    // Generate markdown content
    let markdown = generate_conversation_markdown(messages, title, context_info);

    // Write file
    fs::write(&file_path, markdown)
        .map_err(|e| AppError::IntegrationError(format!("Failed to write markdown: {}", e)))?;

    Ok(file_path)
}

/// Export a single assistant message to Obsidian
pub async fn export_assistant_message_to_obsidian_internal(
    message: &ConversationMessage,
    title: &str,
    config: &ObsidianConfig,
    context_info: Option<&str>,
) -> Result<PathBuf, AppError> {
    let vault_path = PathBuf::from(&config.vault_path);
    let notes_path = vault_path.join(&config.notes_folder);

    // Create notes folder if it doesn't exist
    fs::create_dir_all(&notes_path)
        .map_err(|e| AppError::IntegrationError(format!("Failed to create notes folder: {}", e)))?;

    // Generate filename
    let timestamp = chrono::Local::now().format("%Y-%m-%d-%H%M");
    let filename = format!("{}-{}.md", sanitize_filename(title), timestamp);
    let file_path = notes_path.join(&filename);

    // Generate markdown for single message
    let markdown = generate_single_message_markdown(message, title, context_info);

    // Write file
    fs::write(&file_path, markdown)
        .map_err(|e| AppError::IntegrationError(format!("Failed to write markdown: {}", e)))?;

    Ok(file_path)
}

/// Generate markdown for conversation
fn generate_conversation_markdown(
    messages: &[ConversationMessage],
    title: &str,
    context_info: Option<&str>,
) -> String {
    let mut markdown = String::new();
    let now = chrono::Local::now();

    // Frontmatter
    markdown.push_str("---\n");
    markdown.push_str(&format!("title: \"{}\"\n", title));
    markdown.push_str(&format!("created: {}\n", now.format("%Y-%m-%d %H:%M")));
    markdown.push_str(&format!("source: \"Incrementum AI Assistant\"\n"));
    if let Some(context) = context_info {
        markdown.push_str(&format!("context: \"{}\"\n", context.replace('"', "\\\"")));
    }
    markdown.push_str("tags:\n  - ai-conversation\n  - incrementum\n");
    markdown.push_str("---\n\n");

    // Title
    markdown.push_str(&format!("# {}\n\n", title));

    // Context info if available
    if let Some(context) = context_info {
        markdown.push_str("> **Context:** ");
        markdown.push_str(context);
        markdown.push_str("\n\n");
    }

    // Conversation
    markdown.push_str("## Conversation\n\n");

    for message in messages {
        let role_label = match message.role.as_str() {
            "user" => "**You:**",
            "assistant" => "**Assistant:**",
            "system" => "**System:**",
            _ => &format!("**{}:**", message.role),
        };

        markdown.push_str(role_label);
        markdown.push_str("\n\n");

        // Format content with blockquote for assistant, code block style for user
        match message.role.as_str() {
            "user" => {
                markdown.push_str(&message.content);
                markdown.push_str("\n\n");
            }
            "assistant" => {
                // Format assistant response in a callout box
                markdown.push_str("> [!info] Response\n");
                for line in message.content.lines() {
                    if line.trim().is_empty() {
                        markdown.push_str(">\n");
                    } else {
                        markdown.push_str(&format!("> {}\n", line));
                    }
                }
                markdown.push_str("\n");
            }
            _ => {
                markdown.push_str(&message.content);
                markdown.push_str("\n\n");
            }
        }
    }

    // Footer
    markdown.push_str("---\n\n");
    markdown.push_str(&format!("*Exported from [Incrementum](https://github.com/melpomenex/incrementum-tauri) on {}*\n", now.format("%Y-%m-%d %H:%M")));

    markdown
}

/// Generate markdown for a single message
fn generate_single_message_markdown(
    message: &ConversationMessage,
    title: &str,
    context_info: Option<&str>,
) -> String {
    let mut markdown = String::new();
    let now = chrono::Local::now();

    // Frontmatter
    markdown.push_str("---\n");
    markdown.push_str(&format!("title: \"{}\"\n", title));
    markdown.push_str(&format!("created: {}\n", now.format("%Y-%m-%d %H:%M")));
    markdown.push_str(&format!("source: \"Incrementum AI Assistant\"\n"));
    markdown.push_str(&format!("message-type: \"{}\"\n", message.role));
    if let Some(context) = context_info {
        markdown.push_str(&format!("context: \"{}\"\n", context.replace('"', "\\\"")));
    }
    markdown.push_str("tags:\n  - ai-response\n  - incrementum\n");
    markdown.push_str("---\n\n");

    // Title
    markdown.push_str(&format!("# {}\n\n", title));

    // Context info if available
    if let Some(context) = context_info {
        markdown.push_str("> **Context:** ");
        markdown.push_str(context);
        markdown.push_str("\n\n");
    }

    // Message content in callout
    markdown.push_str("> [!info] AI Response\n");
    for line in message.content.lines() {
        if line.trim().is_empty() {
            markdown.push_str(">\n");
        } else {
            markdown.push_str(&format!("> {}\n", line));
        }
    }
    markdown.push_str("\n");

    // Footer
    markdown.push_str("---\n\n");
    markdown.push_str(&format!("*Exported from [Incrementum](https://github.com/melpomenex/incrementum-tauri) on {}*\n", now.format("%Y-%m-%d %H:%M")));

    markdown
}

/// Sync flashcard to Anki
pub async fn sync_flashcard_to_anki_internal(
    flashcard_id: &str,
    _config: &AnkiConfig,
    _repo: &Repository,
) -> Result<u64, AppError> {
    // TODO: Implement full Anki sync
    // For now, return the flashcard ID as a placeholder
    Ok(flashcard_id.parse().unwrap_or(0))
}

/// Import markdown from Obsidian
pub async fn import_from_obsidian_internal(
    file_path: &str,
    repo: &Repository,
) -> Result<(String, Vec<String>), AppError> {
    let content = fs::read_to_string(file_path)
        .map_err(|e| AppError::IntegrationError(format!("Failed to read file: {}", e)))?;

    // Parse frontmatter
    let (frontmatter, body) = parse_frontmatter(&content);

    let incrementum_type = frontmatter
        .get("incrementum-type")
        .and_then(|v| v.as_str())
        .map(|v| v.to_lowercase());

    let is_extract = incrementum_type.as_deref() == Some("extract")
        || frontmatter.get("document-id").is_some();

    if is_extract {
        let extract_id = frontmatter.get("incrementum-id").and_then(|v| v.as_str());
        let document_id = frontmatter
            .get("document-id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AppError::InvalidInput("Missing document-id for extract".to_string()))?;

        let title = frontmatter
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or_else(|| extract_title_from_content(&body));

        let disclosure_level = frontmatter
            .get("disclosure-level")
            .and_then(|v| v.as_str())
            .and_then(|v| v.parse::<i32>().ok())
            .unwrap_or(0);

        let content = strip_extract_metadata(&body, title);

        if let Some(extract_id) = extract_id {
            if let Some(existing) = repo.get_extract(extract_id).await? {
                let mut updated = existing.clone();
                updated.content = content.to_string();
                updated.page_title = Some(title.to_string());
                updated.progressive_disclosure_level = disclosure_level;
                updated.date_modified = Utc::now();
                repo.update_extract(&updated).await?;
                return Ok((existing.document_id, vec![extract_id.to_string()]));
            }
        }

        let mut extract = crate::models::Extract::new(document_id.to_string(), content.to_string());
        if let Some(extract_id) = extract_id {
            extract.id = extract_id.to_string();
        }
        extract.page_title = Some(title.to_string());
        extract.progressive_disclosure_level = disclosure_level;
        extract.date_modified = Utc::now();
        let created = repo.create_extract(&extract).await?;
        return Ok((created.document_id, vec![created.id]));
    }

    // Check if it's an Incrementum export
    if let Some(id) = frontmatter.get("incrementum-id") {
        let document_id = id.as_str().unwrap();
        if let Some(existing) = repo.get_document(document_id).await? {
            let title = frontmatter.get("title")
                .and_then(|v| v.as_str())
                .unwrap_or_else(|| extract_title_from_content(&body));

            let mut updates = existing.clone();
            updates.title = title.to_string();
            updates.file_path = file_path.to_string();
            updates.date_modified = Utc::now();

            repo.update_document(document_id, &updates).await?;

            let mut metadata = existing.metadata.unwrap_or(crate::models::DocumentMetadata {
                author: None,
                subject: None,
                keywords: None,
                created_at: None,
                modified_at: None,
                file_size: None,
                language: None,
                page_count: None,
                word_count: None,
            });

            if let Some(author) = frontmatter.get("author").and_then(|v| v.as_str()) {
                metadata.author = Some(author.to_string());
            }

            repo.update_document_content(
                document_id,
                body.trim(),
                None,
                None,
                Some(metadata),
            ).await?;

            return Ok((document_id.to_string(), vec![]));
        }
    }

    // Create new document
    let title = frontmatter.get("title")
        .and_then(|v| v.as_str())
        .unwrap_or_else(|| extract_title_from_content(&body));

    // Create document
    let document_id = frontmatter
        .get("incrementum-id")
        .and_then(|v| v.as_str())
        .map(|v| v.to_string())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    let document = crate::models::Document {
        id: document_id,
        title: title.to_string(),
        file_path: file_path.to_string(),
        file_type: crate::models::FileType::Markdown,
        content: Some(body),
        content_hash: None,
        total_pages: None,
        current_page: None,
        current_scroll_percent: None,
        current_cfi: None,
        current_view_state: None,
        position_json: None,
        progress_percent: Some(0.0),
        category: None,
        tags: vec![],
        date_added: chrono::Utc::now(),
        date_modified: chrono::Utc::now(),
        date_last_reviewed: None,
        extract_count: 0,
        learning_item_count: 0,
        priority_rating: 0,
        priority_slider: 0,
        priority_score: 0.0,
        is_archived: false,
        is_favorite: false,
        metadata: Some(crate::models::DocumentMetadata {
            author: frontmatter.get("author").and_then(|v| v.as_str()).map(|s| s.to_string()),
            subject: None,
            keywords: None,
            created_at: None,
            modified_at: None,
            file_size: None,
            language: None,
            page_count: None,
            word_count: None,
        }),
        cover_image_url: None,
        cover_image_source: None,
        // Scheduling fields
        next_reading_date: None,
        reading_count: 0,
        stability: None,
        difficulty: None,
        reps: None,
        total_time_spent: None,
        consecutive_count: None,
    };

    let created_doc = repo.create_document(&document).await?;

    Ok((created_doc.id, vec![]))
}

/// Parse frontmatter from markdown
fn parse_frontmatter(content: &str) -> (serde_json::Map<String, serde_json::Value>, String) {
    if !content.starts_with("---") {
        return (serde_json::Map::new(), content.to_string());
    }

    let parts = content.splitn(3, "---").collect::<Vec<&str>>();
    if parts.len() < 3 {
        return (serde_json::Map::new(), content.to_string());
    }

    let frontmatter_str = parts[1];
    let body = parts[2];

    let frontmatter: serde_json::Map<String, serde_json::Value> = frontmatter_str
        .lines()
        .filter_map(|line| {
            let mut parts = line.splitn(2, ':');
            if let (Some(key), Some(value)) = (parts.next(), parts.next()) {
                Some((key.trim().to_string(), serde_json::json!(value.trim())))
            } else {
                None
            }
        })
        .collect();

    (frontmatter, body.to_string())
}

fn obsidian_notes_path(config: &ObsidianConfig) -> PathBuf {
    PathBuf::from(&config.vault_path).join(&config.notes_folder)
}

fn obsidian_extracts_path(config: &ObsidianConfig) -> PathBuf {
    if let Some(folder) = &config.dataview_folder {
        PathBuf::from(&config.vault_path).join(folder)
    } else {
        obsidian_notes_path(config)
    }
}

fn short_id(id: &str) -> String {
    id.chars().take(8).collect::<String>()
}

fn find_obsidian_markdown_by_incrementum_id(
    root: &Path,
    incrementum_id: &str,
) -> Result<Option<PathBuf>, AppError> {
    if !root.exists() {
        return Ok(None);
    }

    for entry in WalkDir::new(root).into_iter().filter_map(Result::ok) {
        if !entry.file_type().is_file() {
            continue;
        }
        if entry.path().extension().and_then(|ext| ext.to_str()) != Some("md") {
            continue;
        }

        let content = fs::read_to_string(entry.path())?;
        let (frontmatter, _) = parse_frontmatter(&content);
        if let Some(id_value) = frontmatter.get("incrementum-id").and_then(|value| value.as_str()) {
            if id_value == incrementum_id {
                return Ok(Some(entry.path().to_path_buf()));
            }
        }
    }

    Ok(None)
}

fn resolve_obsidian_markdown_path(
    root: &Path,
    title: &str,
    incrementum_id: &str,
) -> Result<PathBuf, AppError> {
    if let Some(existing) = find_obsidian_markdown_by_incrementum_id(root, incrementum_id)? {
        return Ok(existing);
    }

    let base_name = sanitize_filename(title);
    let mut candidate = root.join(format!("{}.md", base_name));
    if candidate.exists() {
        let content = fs::read_to_string(&candidate).unwrap_or_default();
        let (frontmatter, _) = parse_frontmatter(&content);
        let existing_id = frontmatter.get("incrementum-id").and_then(|value| value.as_str());
        if existing_id != Some(incrementum_id) {
            let unique_name = format!("{} ({})", base_name, short_id(incrementum_id));
            candidate = root.join(format!("{}.md", unique_name));
        }
    }

    Ok(candidate)
}

fn strip_extract_metadata<'a>(body: &'a str, title: &str) -> &'a str {
    let content = body.split("\n---\n").next().unwrap_or(body);
    let heading = format!("## {}\n\n", title);
    content.strip_prefix(&heading).unwrap_or(content).trim()
}

/// Extract title from content (first # heading or first line)
fn extract_title_from_content(content: &str) -> &str {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("# ") {
            return &trimmed[2..];
        } else if !trimmed.is_empty() {
            return trimmed;
        }
    }
    "Untitled"
}

/// Sanitize filename for filesystem
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ => c,
        })
        .collect::<String>()
        .trim()
        .to_string()
}

/// Tauri commands

#[tauri::command]
pub async fn export_to_obsidian(
    document_id: String,
    config: ObsidianConfig,
    repo: tauri::State<'_, Repository>,
) -> Result<String, AppError> {
    let path = export_document_to_obsidian(&document_id, &config, &repo).await?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn export_extract_to_obsidian(
    extract_id: String,
    config: ObsidianConfig,
    repo: tauri::State<'_, Repository>,
) -> Result<String, AppError> {
    let path = export_extract_to_obsidian_internal(&extract_id, &config, &repo).await?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn export_flashcards_to_obsidian(
    _card_ids: Vec<String>,
    _config: ObsidianConfig,
    _format: String,
    _repo: tauri::State<'_, Repository>,
) -> Result<String, AppError> {
    // Implementation would export multiple flashcards
    Ok("Exported".to_string())
}

#[tauri::command]
pub async fn import_from_obsidian(
    file_path: String,
    repo: tauri::State<'_, Repository>,
) -> Result<ImportResult, AppError> {
    let (document_id, extract_ids) = import_from_obsidian_internal(&file_path, &repo).await?;
    Ok(ImportResult {
        document_id,
        extract_ids,
    })
}

#[tauri::command]
pub async fn sync_to_obsidian(
    config: ObsidianConfig,
    repo: tauri::State<'_, Repository>,
) -> Result<SyncStats, AppError> {
    // Sync all documents, extracts, and flashcards
    let documents = repo.list_documents().await?;
    let extracts = repo.list_all_extracts().await?;

    for document in &documents {
        export_document_to_obsidian(&document.id, &config, &repo).await?;
    }

    for extract in &extracts {
        export_extract_to_obsidian_internal(&extract.id, &config, &repo).await?;
    }

    Ok(SyncStats {
        documents: documents.len(),
        extracts: extracts.len(),
        flashcards: 0,
    })
}

#[tauri::command]
pub async fn sync_from_obsidian(
    config: ObsidianConfig,
    repo: tauri::State<'_, Repository>,
) -> Result<SyncStats, AppError> {
    let notes_path = obsidian_notes_path(&config);
    let extracts_path = obsidian_extracts_path(&config);

    let mut documents = 0;
    let mut extracts = 0;

    for entry in WalkDir::new(&notes_path).into_iter().filter_map(Result::ok) {
        if !entry.file_type().is_file() {
            continue;
        }
        if entry.path().extension().and_then(|ext| ext.to_str()) != Some("md") {
            continue;
        }

        let content = fs::read_to_string(entry.path())?;
        let (frontmatter, _) = parse_frontmatter(&content);
        if frontmatter.get("incrementum-id").is_none() {
            continue;
        }
        let is_extract = frontmatter.get("document-id").is_some()
            || frontmatter.get("incrementum-type").and_then(|v| v.as_str()) == Some("extract");
        if is_extract {
            extracts += 1;
        } else {
            documents += 1;
        }
        let _ = import_from_obsidian_internal(
            entry.path().to_string_lossy().as_ref(),
            &repo,
        ).await?;
    }

    if extracts_path != notes_path {
        for entry in WalkDir::new(&extracts_path).into_iter().filter_map(Result::ok) {
            if !entry.file_type().is_file() {
                continue;
            }
            if entry.path().extension().and_then(|ext| ext.to_str()) != Some("md") {
                continue;
            }

            let content = fs::read_to_string(entry.path())?;
            let (frontmatter, _) = parse_frontmatter(&content);
            if frontmatter.get("incrementum-id").is_none() {
                continue;
            }

            let is_extract = frontmatter.get("document-id").is_some()
                || frontmatter.get("incrementum-type").and_then(|v| v.as_str()) == Some("extract");
            if !is_extract {
                continue;
            }

            extracts += 1;
            let _ = import_from_obsidian_internal(
                entry.path().to_string_lossy().as_ref(),
                &repo,
            ).await?;
        }
    }

    Ok(SyncStats {
        documents,
        extracts,
        flashcards: 0,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObsidianDeleteRequest {
    pub incrementum_id: String,
    pub kind: String,
}

#[tauri::command]
pub async fn delete_from_obsidian(
    config: ObsidianConfig,
    request: ObsidianDeleteRequest,
) -> Result<bool, AppError> {
    let root = if request.kind == "extract" {
        obsidian_extracts_path(&config)
    } else {
        obsidian_notes_path(&config)
    };

    let path = find_obsidian_markdown_by_incrementum_id(&root, &request.incrementum_id)?
        .ok_or_else(|| AppError::NotFound(format!("No Obsidian file found for {}", request.incrementum_id)))?;

    fs::remove_file(&path)
        .map_err(|e| AppError::IntegrationError(format!("Failed to delete file: {}", e)))?;

    Ok(true)
}

#[tauri::command]
pub async fn export_conversation_to_obsidian(
    messages: Vec<ConversationMessage>,
    title: String,
    config: ObsidianConfig,
    context_info: Option<String>,
) -> Result<String, AppError> {
    let path = export_conversation_to_obsidian_internal(&messages, &title, &config, context_info.as_deref()).await?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn export_assistant_message_to_obsidian(
    message: ConversationMessage,
    title: String,
    config: ObsidianConfig,
    context_info: Option<String>,
) -> Result<String, AppError> {
    let path = export_assistant_message_to_obsidian_internal(&message, &title, &config, context_info.as_deref()).await?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn sync_flashcard_to_anki(
    flashcard_id: String,
    config: AnkiConfig,
    repo: tauri::State<'_, Repository>,
) -> Result<u64, AppError> {
    sync_flashcard_to_anki_internal(&flashcard_id, &config, &repo).await
}

#[tauri::command]
pub async fn sync_flashcards_to_anki(
    flashcard_ids: Vec<String>,
    config: AnkiConfig,
    repo: tauri::State<'_, Repository>,
) -> Result<AnkiSyncResult, AppError> {
    let mut added = 0;
    let mut failed = 0;

    for id in &flashcard_ids {
        match sync_flashcard_to_anki_internal(id, &config, &repo).await {
            Ok(_) => added += 1,
            Err(_) => failed += 1,
        }
    }

    Ok(AnkiSyncResult { added, failed })
}

#[tauri::command]
pub async fn start_extension_server(_port: u16) -> Result<bool, AppError> {
    // Start the WebSocket server
    Ok(true)
}

#[tauri::command]
pub async fn stop_extension_server() -> Result<bool, AppError> {
    Ok(true)
}

#[tauri::command]
pub async fn get_extension_server_status() -> Result<ServerStatus, AppError> {
    Ok(ServerStatus {
        running: false,
        port: 8766,
        connections: 0,
    })
}

#[tauri::command]
pub async fn send_to_extension(_message: serde_json::Value) -> Result<serde_json::Value, AppError> {
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn process_extension_page(
    _page: serde_json::Value,
    _repo: tauri::State<'_, Repository>,
) -> Result<PageProcessResult, AppError> {
    Ok(PageProcessResult {
        document_id: "created".to_string(),
        extract_ids: vec![],
    })
}

/// Result types
#[derive(Serialize, Deserialize)]
pub struct ImportResult {
    pub document_id: String,
    pub extract_ids: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct SyncStats {
    pub documents: usize,
    pub extracts: usize,
    pub flashcards: usize,
}

#[derive(Serialize, Deserialize)]
pub struct AnkiSyncResult {
    pub added: usize,
    pub failed: usize,
}

#[derive(Serialize, Deserialize)]
pub struct ServerStatus {
    pub running: bool,
    pub port: u16,
    pub connections: usize,
}

#[derive(Serialize, Deserialize)]
pub struct PageProcessResult {
    pub document_id: String,
    pub extract_ids: Vec<String>,
}
