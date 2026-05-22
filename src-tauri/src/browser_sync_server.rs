//! Browser Sync Server
//!
//! HTTP server for receiving data from the browser extension.
//! The extension sends POST requests with page/extract/video data.
//! Also provides AI endpoints for summarization and content analysis.

use crate::ai::{AIConfig, AIProvider, LLMProviderType};
use crate::ai::summarizer::Summarizer;
use crate::ai::qa::QuestionAnswerer;
use crate::ai::flashcard_generator::{FlashcardGenerator, FlashcardGenerationOptions};
use crate::commands::rss::{
    fetch_rss_feed_url,
    RssFeed,
    RssUserPreference,
    RssUserPreferenceUpdate,
    create_rss_feed_http,
    get_rss_feeds_http,
    get_rss_feed_http,
    update_rss_feed_http,
    delete_rss_feed_http,
    get_rss_articles_http,
    mark_rss_article_read_http,
    toggle_rss_article_queued_http,
};
use crate::commands::rss_features::{
    add_rss_classifier_http,
    get_rss_classifiers_http,
    remove_rss_classifier_http,
    update_rss_classifiers_batch_http,
    mark_rss_article_unread_http,
    mark_rss_articles_before_date_read_http,
    mark_rss_articles_after_date_read_http,
    get_read_rss_articles_http,
    get_river_of_news_http,
    get_rss_articles_with_intelligence_http,
    recompute_all_intelligence_scores_http,
    search_rss_articles_http,
    compute_story_clusters_http,
    get_rss_article_clusters_http,
    invalidate_clusters_for_feed_http,
    add_tag_http,
    remove_tag_http,
    get_all_tags_http,
    get_article_tags_http,
    tag_article_http,
    untag_article_http,
    get_articles_by_tag_http,
    rename_tag_http,
    merge_tags_http,
    create_annotation_http,
    get_article_annotations_http,
    update_annotation_http,
    delete_annotation_http,
    get_discovered_sites_http,
    delete_discovered_site_http,
    refresh_discoveries,
    create_rss_folder_http,
    get_rss_folders_http,
    delete_rss_folder_http,
    move_feed_to_folder_http,
    toggle_feed_active_http,
    get_feed_statistics_http,
    reorder_folders_http,
    set_feed_view_preferences_http,
    migrate_folders_from_localstorage_http,
    ClassifierUpdate,
};
use crate::commands::review::apply_review;
use crate::database::Repository;
use crate::error::AppError;
use crate::models::podcast::{PodcastFeed, PodcastFeedResponse, PodcastEpisode, PodcastSearchResult, PodcastSearchResponse};
use crate::podcast::parser::parse_podcast_feed;
use crate::models::{Document, DocumentImageAsset, FileType, Extract, ItemType, LearningItem};
use tauri::{AppHandle, Emitter, Manager};
use axum::{
    extract::{Query, State},
    http::{HeaderMap, Request, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Json, Response},
    body::Body,
    routing::{get, post, put, delete},
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    limit::RequestBodyLimitLayer,
};
use tracing::{info, error, warn};
use url::Url;

/// Maximum payload size (10MB)
const MAX_PAYLOAD_SIZE: usize = 10 * 1024 * 1024;

/// Server state shared across handlers
#[derive(Clone)]
pub struct ServerState {
    pub repo: Arc<Repository>,
    pub app_handle: AppHandle,
    pub running: Arc<Mutex<bool>>,
    pub ai_config: Arc<Mutex<Option<AIConfig>>>,
    pub automation_api_key: Arc<Mutex<Option<String>>>,
}

/// Server status for Tauri commands
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatus {
    pub running: bool,
    pub port: u16,
    pub connections: usize,
}

/// Payload emitted when a document is saved via browser extension
#[derive(Clone, Serialize)]
struct DocumentSavedEvent {
    document_id: String,
    title: String,
    url: String,
}

/// Payload emitted when an extract is saved via browser extension
#[derive(Clone, Serialize)]
struct ExtractSavedEvent {
    extract_id: String,
    document_id: String,
    url: String,
}

/// Server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserSyncConfig {
    pub host: String,
    pub port: u16,
    #[serde(default, alias = "auto_start")]
    pub auto_start: bool,
    #[serde(default, alias = "apiKey")]
    pub api_key: Option<String>,
}

impl Default for BrowserSyncConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 8766,
            auto_start: false,
            api_key: None,
        }
    }
}

/// Extension request payload from browser
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionImagePayload {
    pub src: String,
    #[serde(default)]
    pub alt: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ExtensionRequest {
    pub url: String,
    pub title: String,
    #[serde(default)]
    pub text: String,
    /// Rich HTML content with inline styles for 1:1 visual fidelity
    #[serde(default)]
    pub html_content: Option<String>,
    #[serde(default)]
    pub extracted_images: Option<Vec<ExtensionImagePayload>>,
    #[serde(default)]
    pub r#type: String, // "page", "extract", "video"
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub timestamp: Option<String>,
    #[serde(default)]
    pub context: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub priority: Option<i32>,
    #[serde(default)]
    pub analysis: Option<serde_json::Value>,
    #[serde(default)]
    pub fsrs_data: Option<serde_json::Value>,
    #[serde(default)]
    pub test: Option<bool>,
}

/// Response to browser extension
#[derive(Debug, Serialize)]
pub struct ExtensionResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub document_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extract_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// AI request from browser extension
#[derive(Debug, Deserialize)]
pub struct AIRequest {
    /// Content to process
    pub content: String,
    /// Type of AI operation: "summarize", "key-points", "flashcards", "questions"
    #[serde(default = "default_ai_operation")]
    pub operation: String,
    /// Max words for summary (default: 150)
    #[serde(default = "default_max_words")]
    pub max_words: usize,
    /// Count for key points/questions/flashcards (default: 5)
    #[serde(default = "default_count")]
    pub count: usize,
    /// Page URL for context
    #[serde(default)]
    pub url: Option<String>,
    /// Page title for context
    #[serde(default)]
    pub title: Option<String>,
}

fn default_ai_operation() -> String { "summarize".to_string() }
fn default_max_words() -> usize { 150 }
fn default_count() -> usize { 5 }

/// Generated flashcard for browser extension
#[derive(Debug, Clone, Serialize)]
pub struct GeneratedFlashcard {
    pub question: String,
    pub answer: String,
    pub card_type: String,
}

/// AI response to browser extension
#[derive(Debug, Serialize)]
pub struct AIResponse {
    pub success: bool,
    /// Summary of the content
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    /// Key points extracted
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key_points: Option<Vec<String>>,
    /// Generated flashcards
    #[serde(skip_serializing_if = "Option::is_none")]
    pub flashcards: Option<Vec<GeneratedFlashcard>>,
    /// Generated questions
    #[serde(skip_serializing_if = "Option::is_none")]
    pub questions: Option<Vec<String>>,
    /// Reading time estimate in minutes
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reading_time_minutes: Option<u32>,
    /// Word count
    #[serde(skip_serializing_if = "Option::is_none")]
    pub word_count: Option<u32>,
    /// Complexity score (1-10)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub complexity_score: Option<u8>,
    /// Error message if any
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// AI status response
#[derive(Debug, Serialize)]
pub struct AIStatusResponse {
    pub configured: bool,
    pub provider: Option<String>,
    pub model: Option<String>,
}

/// RSS feed creation request
#[derive(Debug, Deserialize)]
pub struct CreateFeedRequest {
    pub url: String,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub update_interval: Option<i32>,
    #[serde(default)]
    pub auto_queue: Option<bool>,
}

/// RSS feed update request
#[derive(Debug, Deserialize)]
pub struct UpdateFeedRequest {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub update_interval: Option<i32>,
    #[serde(default)]
    pub auto_queue: Option<bool>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

/// RSS feed response with unread count
#[derive(Debug, Clone, Serialize)]
pub struct FeedResponse {
    #[serde(flatten)]
    pub feed: RssFeed,
    pub unread_count: i32,
}

/// OPML import request
#[derive(Debug, Deserialize)]
pub struct OpmlImportRequest {
    pub opml_content: String,
}

/// OPML export response
#[derive(Debug, Serialize)]
pub struct OpmlExportResponse {
    pub opml_content: String,
}

/// Document progress update request
#[derive(Debug, Deserialize)]
pub struct UpdateProgressRequest {
    pub current_page: Option<i32>,
    pub current_scroll_percent: Option<f64>,
    pub current_cfi: Option<String>,
    pub current_view_state: Option<String>,
}

/// Document response
#[derive(Debug, Serialize)]
pub struct DocumentResponse {
    pub id: String,
    pub title: String,
    pub file_path: String,
    pub file_type: String,
    pub current_page: Option<i32>,
    pub current_scroll_percent: Option<f64>,
    pub current_cfi: Option<String>,
    pub current_view_state: Option<String>,
    pub total_pages: Option<i32>,
    pub content: Option<String>,
    pub category: Option<String>,
    pub tags: Vec<String>,
    pub date_added: String,
    pub date_modified: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationCreateCardRequest {
    pub question: String,
    #[serde(default)]
    pub answer: Option<String>,
    #[serde(default)]
    pub item_type: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationCreateCardResponse {
    pub id: String,
    pub due_date: String,
    pub interval: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationDueCountResponse {
    pub due_count: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationSubmitReviewRequest {
    pub item_id: String,
    pub rating: i32,
    #[serde(default)]
    pub time_taken: Option<i32>,
}

/// Global server handle for shutdown
static SERVER_HANDLE: Mutex<Option<tokio::task::JoinHandle<()>>> = Mutex::const_new(None);

/// Start the HTTP server for browser extension
pub async fn start_server(
    config: BrowserSyncConfig,
    repo: Arc<Repository>,
    app_handle: AppHandle,
    ai_config: Option<AIConfig>,
) -> Result<(), AppError> {
    // Check if server is already running
    let mut handle = SERVER_HANDLE.lock().await;
    if handle.is_some() {
        return Err(AppError::IntegrationError(
            "Browser extension server is already running".to_string(),
        ));
    }

    let addr = format!("{}:{}", config.host, config.port);
    let addr: SocketAddr = addr
        .parse()
        .map_err(|e| AppError::IntegrationError(format!("Invalid address: {}", e)))?;

    // Create server state
    let running = Arc::new(Mutex::new(true));
    let state = ServerState {
        repo: repo.clone(),
        app_handle: app_handle.clone(),
        running: running.clone(),
        ai_config: Arc::new(Mutex::new(ai_config)),
        automation_api_key: Arc::new(Mutex::new(config.api_key.clone())),
    };

    // Build router with AI, RSS, and Document endpoints
    let app = Router::new()
        // Extension/AI endpoints
        .route("/", post(handle_extension_request))
        .route("/ai/process", post(handle_ai_request))
        .route("/ai/status", get(handle_ai_status))
        // RSS feed endpoints
        .route("/api/rss/feeds", post(handle_create_feed).get(handle_list_feeds))
        .route("/api/rss/feeds/:id", get(handle_get_feed).put(handle_update_feed).delete(handle_delete_feed))
        .route("/api/rss/feeds/:id/articles", get(handle_get_feed_articles))
        .route("/api/rss/articles/:id", post(handle_mark_article))
        .route("/api/rss/articles/:id/queued", post(handle_toggle_article_queued))
        .route("/api/rss/fetch", get(handle_fetch_feed_url))
        .route("/api/rss/opml/import", post(handle_opml_import))
        .route("/api/rss/opml/export", get(handle_opml_export))
        .route("/api/rss/preferences", get(handle_get_preferences).put(handle_set_preferences))
        // RSS NewsBlur features API
        .route("/api/rss/classifiers", post(handle_add_classifier).get(handle_list_classifiers))
        .route("/api/rss/classifiers/:id", delete(handle_remove_classifier))
        .route("/api/rss/classifiers/batch", put(handle_batch_update_classifiers))
        .route("/api/rss/articles/:id/unread", post(handle_mark_article_unread))
        .route("/api/rss/articles/mark-before", post(handle_mark_before_date))
        .route("/api/rss/articles/mark-after", post(handle_mark_after_date))
        .route("/api/rss/articles/read", get(handle_get_read_articles))
        .route("/api/rss/articles/river", get(handle_river_of_news))
        .route("/api/rss/articles/intelligence", get(handle_articles_with_intelligence))
        .route("/api/rss/articles/recompute-scores", post(handle_recompute_scores))
        .route("/api/rss/search", get(handle_search_articles))
        .route("/api/rss/clusters", post(handle_compute_clusters).get(handle_get_clusters))
        .route("/api/rss/clusters/invalidate/:feed_id", post(handle_invalidate_clusters))
        .route("/api/rss/tags", post(handle_add_tag).get(handle_list_tags))
        .route("/api/rss/tags/:id", delete(handle_remove_tag))
        .route("/api/rss/tags/:id/rename", put(handle_rename_tag))
        .route("/api/rss/tags/merge", post(handle_merge_tags))
        .route("/api/rss/articles/:article_id/tags", get(handle_get_article_tags))
        .route("/api/rss/articles/:article_id/tags/:tag_id", post(handle_tag_article).delete(handle_untag_article))
        .route("/api/rss/tags/:tag_id/articles", get(handle_get_articles_by_tag))
        .route("/api/rss/annotations", post(handle_create_annotation))
        .route("/api/rss/annotations/:id", put(handle_update_annotation).delete(handle_delete_annotation))
        .route("/api/rss/articles/:article_id/annotations", get(handle_get_article_annotations))
        .route("/api/rss/discover", get(handle_get_discovered_sites).post(handle_refresh_discoveries))
        .route("/api/rss/discover/:id", delete(handle_delete_discovered_site))
        .route("/api/rss/folders", post(handle_create_folder).get(handle_list_folders))
        .route("/api/rss/folders/:id", put(handle_update_folder).delete(handle_delete_folder))
        .route("/api/rss/folders/reorder", post(handle_reorder_folders_http))
        .route("/api/rss/feeds/:feed_id/folder", post(handle_move_feed_to_folder))
        .route("/api/rss/feeds/:feed_id/toggle-active", post(handle_toggle_feed_active))
        .route("/api/rss/feeds/:feed_id/statistics", get(handle_get_feed_statistics))
        .route("/api/rss/feeds/:feed_id/view-prefs", put(handle_set_feed_view_prefs))
        .route("/api/rss/folders/migrate", post(handle_migrate_folders))
        // Document progress endpoints
        .route("/api/documents/:id", get(handle_get_document))
        .route("/api/documents/:id/progress", post(handle_update_progress))
        // Podcast endpoints
        .route("/api/podcast/search", get(handle_podcast_search))
        .route("/api/podcast/subscribe", post(handle_podcast_subscribe))
        .route("/api/podcast/feeds", get(handle_podcast_list_feeds))
        .route("/api/podcast/feeds/:feed_id", delete(handle_podcast_unsubscribe))
        .route("/api/podcast/feeds/:feed_id/refresh", post(handle_podcast_refresh_feed))
        .route("/api/podcast/feeds/:feed_id/rename", post(handle_podcast_rename_feed))
        .route("/api/podcast/feeds/:feed_id/episodes", get(handle_podcast_get_episodes))
        .route("/api/podcast/feeds/episodes", get(handle_podcast_get_episode_queue))
        .route("/api/podcast/episodes/:episode_id/played", post(handle_podcast_mark_played))
        .route("/api/podcast/episodes/:episode_id/position", post(handle_podcast_update_position).get(handle_podcast_get_position))
        .route("/api/podcast/episodes/:episode_id/transcribe", post(handle_podcast_transcribe))
        .route("/api/podcast/episodes/:episode_id/transcript", get(handle_podcast_get_transcript))
        .route("/api/podcast/episodes/:episode_id/cancel-transcription", post(handle_podcast_cancel_transcription))
        .route("/api/podcast/feeds/:feed_id/auto-transcribe", post(handle_podcast_set_auto_transcribe))
        // Automation API endpoints
        .route("/api/automation/cards", post(handle_automation_create_card))
        .route("/api/automation/reviews/due-count", get(handle_automation_due_count))
        .route("/api/automation/reviews/submit", post(handle_automation_submit_review))
        .layer(middleware::from_fn_with_state(state.clone(), require_api_key))
        .layer(
            CorsLayer::new()
                .allow_origin(AllowOrigin::predicate(|origin, _| {
                    let Ok(s) = origin.to_str() else { return false };
                    s.starts_with("http://127.0.0.1:")
                        || s.starts_with("http://localhost:")
                        || s.starts_with("chrome-extension://")
                        || s.starts_with("moz-extension://")
                        || s.starts_with("safari-web-extension://")
                        || s == "tauri://localhost"
                        || s == "https://tauri.localhost"
                        || s == "null"
                }))
                .allow_methods([
                    axum::http::Method::GET,
                    axum::http::Method::POST,
                    axum::http::Method::PUT,
                    axum::http::Method::DELETE,
                    axum::http::Method::OPTIONS,
                ])
                .allow_headers(tower_http::cors::Any),
        )
        .layer(RequestBodyLimitLayer::new(MAX_PAYLOAD_SIZE))
        .with_state(state);

    info!("Starting browser extension server on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.map_err(|e| {
        if e.kind() == std::io::ErrorKind::AddrInUse {
            AppError::IntegrationError(format!(
                "Browser extension server port {} is already in use",
                config.port
            ))
        } else {
            AppError::IntegrationError(format!("Failed to bind to {}: {}", addr, e))
        }
    })?;

    info!("Browser extension server listening on {}", addr);

    // Spawn server task
    let task = tokio::spawn(async move {
        // Serve with graceful shutdown
        if let Err(e) = axum::serve(listener, app)
            .with_graceful_shutdown(shutdown_signal(running.clone()))
            .await
        {
            error!("Server error: {}", e);
        }

        info!("Browser extension server stopped");
    });

    *handle = Some(task);
    drop(handle);

    Ok(())
}

/// Signal handler for graceful shutdown
async fn shutdown_signal(running: Arc<Mutex<bool>>) {
    // Wait until running is set to false
    loop {
        let r = *running.lock().await;
        if !r {
            break;
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }
}

/// Stop the HTTP server
pub async fn stop_server() -> Result<(), AppError> {
    let mut handle = SERVER_HANDLE.lock().await;
    if handle.is_none() {
        return Err(AppError::IntegrationError(
            "Browser extension server is not running".to_string(),
        ));
    }

    // Signal shutdown by setting running to false
    // Note: The running flag is managed by the ServerState, which we don't have direct access to here
    // The server task will exit when the handle is aborted
    if let Some(task) = handle.take() {
        task.abort();
    }

    Ok(())
}

/// Get current server status
pub async fn get_status(config: BrowserSyncConfig) -> ServerStatus {
    let handle = SERVER_HANDLE.lock().await;
    let running = handle.is_some();

    ServerStatus {
        running,
        port: config.port,
        connections: 0, // Could be tracked with an atomic counter if needed
    }
}

/// Handle incoming POST request from browser extension
async fn handle_extension_request(
    State(state): State<ServerState>,
    Json(payload): Json<ExtensionRequest>,
) -> Response {
    info!(
        "Received extension request: type={}, url={}",
        payload.r#type, payload.url
    );

    // Check if this is a connection test
    if payload.test.unwrap_or(false) {
        return (
            StatusCode::OK,
            Json(serde_json::json!({
                "success": true,
                "message": "Server is running"
            })),
        )
            .into_response();
    }

    // Validate required fields
    if payload.url.is_empty() {
        return error_response(StatusCode::BAD_REQUEST, "Missing required field: url");
    }

    // Route to appropriate handler based on type field.
    // Browser extension "page"/link saves should be treated as HTML, not "other",
    // so they remain directly viewable in-app.
    let request_type = payload.r#type.trim().to_ascii_lowercase();
    let result = match request_type.as_str() {
        "extract" => handle_extract_request(&state, &payload).await,
        "video" => handle_import_request(&state, &payload, FileType::Youtube).await,
        "page" | "link" | "" => {
            let file_type = if is_youtube_url(&payload.url) {
                FileType::Youtube
            } else {
                FileType::Html
            };
            handle_import_request(&state, &payload, file_type).await
        }
        _ => {
            let file_type = infer_extension_file_type(&payload);
            handle_import_request(&state, &payload, file_type).await
        }
    };

    match result {
        Ok(response) => (StatusCode::OK, Json(response)).into_response(),
        Err(e) => {
            error!("Error handling extension request: {}", e);
            error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

fn is_youtube_url(url: &str) -> bool {
    let lowered = url.to_ascii_lowercase();
    lowered.contains("youtube.com") || lowered.contains("youtu.be")
}

fn infer_extension_file_type(payload: &ExtensionRequest) -> FileType {
    if is_youtube_url(&payload.url) {
        return FileType::Youtube;
    }
    if payload.url.to_ascii_lowercase().ends_with(".pdf") {
        return FileType::Pdf;
    }
    FileType::Html
}

fn build_browser_import_metadata(payload: &ExtensionRequest) -> crate::models::DocumentMetadata {
    let browser_import_mode = if payload
        .html_content
        .as_ref()
        .map(|html| !html.trim().is_empty())
        .unwrap_or(false)
    {
        "rich-preview".to_string()
    } else {
        "text-editor".to_string()
    };
    let site_name = Url::parse(&payload.url)
        .ok()
        .and_then(|url| url.host_str().map(str::to_string));

    crate::models::DocumentMetadata {
        author: None,
        subject: None,
        keywords: None,
        created_at: None,
        modified_at: None,
        file_size: None,
        language: None,
        page_count: None,
        word_count: None,
        source: Some("browser_extension".to_string()),
        fetched_at: Some(chrono::Utc::now()),
        site_name,
        browser_import_mode: Some(browser_import_mode),
        article_html: payload.html_content.clone(),
        extracted_images: payload.extracted_images.as_ref().map(|images| {
            images
                .iter()
                .map(|image| DocumentImageAsset {
                    src: image.src.clone(),
                    alt: image.alt.clone(),
                })
                .collect()
        }),
        ..Default::default()
    }
}

fn build_browser_import_metadata_with_article(
    payload: &ExtensionRequest,
    article_html: Option<String>,
    extracted_images: Option<Vec<DocumentImageAsset>>,
) -> crate::models::DocumentMetadata {
    let mut metadata = build_browser_import_metadata(payload);
    metadata.article_html = article_html;
    metadata.extracted_images = extracted_images;
    metadata.browser_import_mode = Some(
        if metadata
            .article_html
            .as_ref()
            .map(|html| !html.trim().is_empty())
            .unwrap_or(false)
        {
            "rich-preview".to_string()
        } else {
            "text-editor".to_string()
        },
    );
    metadata
}

fn extract_text_from_html_fragment(html: &str) -> String {
    html2text::from_read(html.as_bytes(), 80)
        .unwrap_or_else(|_| {
            regex::Regex::new(r"<[^>]+>")
                .expect("valid html tag regex")
                .replace_all(html, " ")
                .to_string()
        })
        .replace('\u{a0}', " ")
        .lines()
        .map(str::trim_end)
        .collect::<Vec<_>>()
        .join("\n")
        .replace("\n\n\n", "\n\n")
        .trim()
        .to_string()
}

fn extract_images_from_html_fragment(html: &str, base_url: &str) -> Vec<DocumentImageAsset> {
    let src_regex = regex::Regex::new(r#"(?is)<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>"#)
        .expect("valid image src regex");
    let alt_regex = regex::Regex::new(r#"(?is)\balt\s*=\s*["']([^"']*)["']"#)
        .expect("valid image alt regex");
    let tag_regex = regex::Regex::new(r#"(?is)<img\b[^>]*>"#).expect("valid img tag regex");
    let base = Url::parse(base_url).ok();
    let mut seen = std::collections::HashSet::new();
    let mut images = Vec::new();

    for tag in tag_regex.find_iter(html) {
        let fragment = tag.as_str();
        let Some(src_capture) = src_regex.captures(fragment) else {
            continue;
        };
        let raw_src = src_capture.get(1).map(|m| m.as_str()).unwrap_or("").trim();
        if raw_src.is_empty() || raw_src.starts_with("data:") {
            continue;
        }

        let src = base
            .as_ref()
            .and_then(|base| base.join(raw_src).ok())
            .map(|url| url.to_string())
            .unwrap_or_else(|| raw_src.to_string());
        if !seen.insert(src.clone()) {
            continue;
        }

        let alt = alt_regex
            .captures(fragment)
            .and_then(|capture| capture.get(1))
            .map(|m| m.as_str().trim().to_string())
            .filter(|alt| !alt.is_empty());

        images.push(DocumentImageAsset { src, alt });
        if images.len() >= 24 {
            break;
        }
    }

    images
}

/// Handle general document import request (page or video)
async fn handle_import_request(
    state: &ServerState,
    payload: &ExtensionRequest,
    file_type: FileType,
) -> Result<ExtensionResponse, AppError> {
    let payload_has_article_html = payload
        .html_content
        .as_ref()
        .map(|html| !html.trim().is_empty())
        .unwrap_or(false);
    let payload_content = if !payload.text.trim().is_empty() {
        payload.text.trim().to_string()
    } else if let Some(html) = payload.html_content.as_deref() {
        extract_text_from_html_fragment(html)
    } else {
        String::new()
    };
    let payload_images = payload.extracted_images.as_ref().map(|images| {
        images
            .iter()
            .map(|image| DocumentImageAsset {
                src: image.src.clone(),
                alt: image.alt.clone(),
            })
            .collect::<Vec<_>>()
    });

    // Check if document with this URL already exists
    let existing = state
        .repo
        .find_document_by_url(&payload.url)
        .await
        .ok();

    if let Some(Some(doc)) = existing {
        let existing_missing_text = doc
            .content
            .as_deref()
            .map(|content| content.trim().is_empty())
            .unwrap_or(true);
        let existing_missing_html = doc
            .metadata
            .as_ref()
            .and_then(|metadata| metadata.article_html.as_deref())
            .map(|html| html.trim().is_empty())
            .unwrap_or(true);

        if matches!(file_type, FileType::Html)
            && ((!payload_content.is_empty() && existing_missing_text)
                || (payload_has_article_html && existing_missing_html))
        {
            let metadata = build_browser_import_metadata_with_article(
                payload,
                payload.html_content.clone(),
                payload_images.clone(),
            );
            let next_content = if payload_content.is_empty() {
                doc.content.unwrap_or_default()
            } else {
                payload_content.clone()
            };
            if let Err(error) = state
                .repo
                .update_document_content(&doc.id, &next_content, None, None, Some(metadata))
                .await
            {
                warn!("Failed to enrich existing browser-imported document {}: {}", doc.id, error);
            }
        }

        info!(
            "Document already exists for URL: {}, returning existing doc",
            payload.url
        );
        let _ = state.app_handle.emit("browser-sync://document-saved", DocumentSavedEvent {
            document_id: doc.id.clone(),
            title: doc.title.clone(),
            url: payload.url.clone(),
        });
        return Ok(ExtensionResponse {
            success: true,
            document_id: Some(doc.id),
            extract_id: None,
            error: None,
        });
    }

    // Fetch content if not provided
    // For YouTube, we skip fetching raw HTML content as it's not useful for reading
    let content = if payload_content.is_empty() {
        if matches!(file_type, FileType::Youtube) {
            String::new()
        } else {
            info!("No content provided, fetching from URL: {}", payload.url);
            match fetch_page_content(&payload.url).await {
                Ok(c) => c,
                Err(e) => {
                    warn!("Failed to fetch content from {}: {}", payload.url, e);
                    // Continue without content - will create document with URL and title only
                    String::new()
                }
            }
        }
    } else {
        payload_content.clone()
    };

    let category = if matches!(file_type, FileType::Youtube) { Some("YouTube Videos".to_string()) } else { None };
    let is_html = matches!(file_type, FileType::Html);
    let content_len = content.len();
    let metadata = if is_html {
        Some(build_browser_import_metadata_with_article(
            payload,
            payload.html_content.clone(),
            payload_images.clone(),
        ))
    } else {
        None
    };

    // Create document
    let document = Document {
        id: uuid::Uuid::new_v4().to_string(),
        collection_id: crate::models::collection::DEFAULT_COLLECTION_ID.to_string(),
        title: payload.title.clone(),
        file_path: payload.url.clone(),
        file_type,
        content: Some(content),
        content_hash: None,
        total_pages: None,
        current_page: None,
        current_scroll_percent: None,
        current_cfi: None,
        current_view_state: None,
        position_json: None,
        progress_percent: Some(0.0),
        category,
        tags: payload.tags.clone().unwrap_or_default(),
        date_added: chrono::Utc::now(),
        date_modified: chrono::Utc::now(),
        date_last_reviewed: None,
        extract_count: 0,
        learning_item_count: 0,
        priority_rating: payload.priority.unwrap_or(0),
        priority_slider: payload.priority.unwrap_or(0),
        priority_score: payload.priority.unwrap_or(0) as f64,
        is_archived: false,
        is_favorite: false,
        is_dismissed: false,
        metadata,
        cover_image_url: None,
        cover_image_source: None,
        next_reading_date: None,
        reading_count: 0,
        stability: None,
        difficulty: None,
        reps: None,
        total_time_spent: None,
        consecutive_count: None,
    };

    let created = state.repo.create_document(&document).await?;
    info!(
        "Created document for URL: {} with id: {}",
        payload.url, created.id
    );

    let _ = state.app_handle.emit("browser-sync://document-saved", DocumentSavedEvent {
        document_id: created.id.clone(),
        title: created.title.clone(),
        url: payload.url.clone(),
    });

    // Background: attempt readability extraction for richer content.
    // This does not block the response to the extension.
    if is_html {
        let bg_doc_id = created.id.clone();
        let bg_url = payload.url.clone();
        let bg_repo = state.repo.clone();
        let bg_extension_text_len = content_len;
        let bg_payload = payload.url.clone();

        tokio::spawn(async move {
            match fetch_readable_content(&bg_url).await {
                Ok(readable) if readable.text.len() > bg_extension_text_len => {
                    info!(
                        "Readability extracted {} chars (vs {} from extension) for: {}",
                        readable.text.len(), bg_extension_text_len, bg_url
                    );
                    let metadata = build_browser_import_metadata_with_article(
                        &ExtensionRequest {
                            url: bg_payload,
                            title: String::new(),
                            text: readable.text.clone(),
                            html_content: Some(readable.html.clone()),
                            extracted_images: Some(
                                readable
                                    .images
                                    .iter()
                                    .map(|image| ExtensionImagePayload {
                                        src: image.src.clone(),
                                        alt: image.alt.clone(),
                                    })
                                    .collect(),
                            ),
                            r#type: "page".to_string(),
                            source: "browser_extension".to_string(),
                            timestamp: None,
                            context: None,
                            tags: None,
                            priority: None,
                            analysis: None,
                            fsrs_data: None,
                            test: None,
                        },
                        Some(readable.html.clone()),
                        Some(readable.images.clone()),
                    );
                    if let Err(e) = bg_repo
                        .update_document_content(&bg_doc_id, &readable.text, None, None, Some(metadata))
                        .await
                    {
                        warn!("Failed to update document {} with readable content: {}", bg_doc_id, e);
                    }
                }
                Ok(readable) => {
                    info!(
                        "Readability extracted {} chars (not better than {} from extension) for: {}",
                        readable.text.len(), bg_extension_text_len, bg_url
                    );
                }
                Err(e) => {
                    warn!("Background readability extraction failed for {}: {}", bg_url, e);
                }
            }
        });
    }

    Ok(ExtensionResponse {
        success: true,
        document_id: Some(created.id),
        extract_id: None,
        error: None,
    })
}

/// Handle extract save request
async fn handle_extract_request(
    state: &ServerState,
    payload: &ExtensionRequest,
) -> Result<ExtensionResponse, AppError> {
    // Find or create document for this URL
    let document_id = if let Ok(Some(doc)) = state.repo.find_document_by_url(&payload.url).await {
        doc.id
    } else {
        let inferred_file_type = infer_extension_file_type(payload);
        let metadata = if matches!(inferred_file_type, FileType::Html) {
            Some(build_browser_import_metadata(payload))
        } else {
            None
        };
        // Create a minimal document for this URL
        let document = Document {
            id: uuid::Uuid::new_v4().to_string(),
            collection_id: crate::models::collection::DEFAULT_COLLECTION_ID.to_string(),
            title: payload.title.clone(),
            file_path: payload.url.clone(),
            file_type: inferred_file_type,
            content: None,
            content_hash: None,
            total_pages: None,
            current_page: None,
            current_scroll_percent: None,
            current_cfi: None,
            current_view_state: None,
            position_json: None,
            progress_percent: Some(0.0),
            category: None,
            tags: payload.tags.clone().unwrap_or_default(),
            date_added: chrono::Utc::now(),
            date_modified: chrono::Utc::now(),
            date_last_reviewed: None,
            extract_count: 0,
            learning_item_count: 0,
            priority_rating: payload.priority.unwrap_or(0),
            priority_slider: payload.priority.unwrap_or(0),
            priority_score: payload.priority.unwrap_or(0) as f64,
            is_archived: false,
            is_favorite: false,
            is_dismissed: false,
            metadata,
            cover_image_url: None,
            cover_image_source: None,
            next_reading_date: None,
            reading_count: 0,
            stability: None,
            difficulty: None,
            reps: None,
            total_time_spent: None,
            consecutive_count: None,
        };

        let created = state.repo.create_document(&document).await?;
        info!(
            "Created document for extract URL: {} with id: {}",
            payload.url, created.id
        );
        created.id
    };

    let selection_context = build_extension_selection_context(payload);
    let notes = build_extension_extract_notes(payload);
    let memory_state = extract_memory_state_from_fsrs(payload.fsrs_data.as_ref());

    // Create extract with rich HTML content for visual fidelity
    let extract = Extract {
        id: uuid::Uuid::new_v4().to_string(),
        collection_id: crate::models::collection::DEFAULT_COLLECTION_ID.to_string(),
        document_id: document_id.clone(),
        content: payload.text.clone(),
        html_content: payload.html_content.clone(),
        source_url: Some(payload.url.clone()),
        page_title: Some(payload.title.clone()),
        page_number: None,
        selection_context,
        highlight_color: None,
        notes,
        progressive_disclosure_level: 0,
        max_disclosure_level: 3,
        progressive_summaries: None,
        date_created: chrono::Utc::now(),
        date_modified: chrono::Utc::now(),
        tags: payload.tags.clone().unwrap_or_default(),
        category: None,
        memory_state,
        next_review_date: None,
        last_review_date: None,
        review_count: 0,
        reps: 0,
        source_hash: None,
    };

    let created = state.repo.create_extract(&extract).await?;
    info!(
        "Created extract for document: {} with extract id: {}",
        document_id, created.id
    );

    let _ = state.app_handle.emit("browser-sync://extract-saved", ExtractSavedEvent {
        extract_id: created.id.clone(),
        document_id: document_id.clone(),
        url: payload.url.clone(),
    });

    Ok(ExtensionResponse {
        success: true,
        document_id: Some(document_id),
        extract_id: Some(created.id),
        error: None,
    })
}

fn build_extension_selection_context(payload: &ExtensionRequest) -> Option<serde_json::Value> {
    let mut map = serde_json::Map::new();

    if let Some(context) = payload.context.as_ref() {
        map.insert("context".to_string(), json!(context));
    }
    if let Some(analysis) = payload.analysis.as_ref() {
        map.insert("analysis".to_string(), analysis.clone());
    }
    if let Some(fsrs_data) = payload.fsrs_data.as_ref() {
        map.insert("fsrs_data".to_string(), fsrs_data.clone());
    }

    if map.is_empty() {
        None
    } else {
        map.insert("source".to_string(), json!("browser_extension"));
        map.insert("saved_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
        Some(serde_json::Value::Object(map))
    }
}

fn build_extension_extract_notes(payload: &ExtensionRequest) -> Option<String> {
    let mut sections: Vec<String> = Vec::new();

    if let Some(context) = payload.context.as_ref() {
        let trimmed = context.trim();
        if !trimmed.is_empty() {
            sections.push(format!("Context:\n{}", trimmed));
        }
    }

    if let Some(analysis) = payload.analysis.as_ref() {
        if let Some(summary) = analysis.get("summary").and_then(|v| v.as_str()) {
            let trimmed = summary.trim();
            if !trimmed.is_empty() {
                sections.push(format!("Summary:\n{}", trimmed));
            }
        }

        if let Some(responses) = analysis.get("responses") {
            let rendered = render_analysis_block(responses);
            if !rendered.is_empty() {
                sections.push(format!("Responses:\n{}", rendered));
            }
        }

        if let Some(threads) = analysis.get("threads") {
            let rendered = render_analysis_block(threads);
            if !rendered.is_empty() {
                sections.push(format!("Threads:\n{}", rendered));
            }
        }
    }

    if sections.is_empty() {
        None
    } else {
        Some(sections.join("\n\n"))
    }
}

fn render_analysis_block(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(s) => s.trim().to_string(),
        serde_json::Value::Array(items) => {
            let lines: Vec<String> = items
                .iter()
                .filter_map(|item| match item {
                    serde_json::Value::String(s) => {
                        let trimmed = s.trim();
                        if trimmed.is_empty() {
                            None
                        } else {
                            Some(format!("- {}", trimmed))
                        }
                    }
                    other => serde_json::to_string_pretty(other)
                        .ok()
                        .map(|s| format!("- {}", s)),
                })
                .collect();
            lines.join("\n")
        }
        other => serde_json::to_string_pretty(other).unwrap_or_default(),
    }
}

fn extract_memory_state_from_fsrs(
    fsrs_data: Option<&serde_json::Value>,
) -> Option<crate::models::MemoryState> {
    let fsrs = fsrs_data?;
    let stability = fsrs.get("initial_stability").and_then(|v| v.as_f64())?;
    let difficulty = fsrs.get("initial_difficulty").and_then(|v| v.as_f64())?;
    Some(crate::models::MemoryState {
        stability,
        difficulty,
    })
}

/// Fetch page content from URL
async fn fetch_page_content(url: &str) -> Result<String, AppError> {
    crate::security::validate_url_not_private(url)
        .map_err(|e| AppError::IntegrationError(format!("URL not allowed: {}", e)))?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .map_err(|e| AppError::IntegrationError(format!("Failed to create HTTP client: {}", e)))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| AppError::IntegrationError(format!("Failed to fetch URL: {}", e)))?;

    if !response.status().is_success() {
        return Err(AppError::IntegrationError(format!(
            "HTTP error: {}",
            response.status()
        )));
    }

    let html = response
        .text()
        .await
        .map_err(|e| AppError::IntegrationError(format!("Failed to read response: {}", e)))?;

    // Extract text content from HTML
    Ok(extract_text_from_html(&html))
}

/// Extract readable text from HTML
fn extract_text_from_html(html: &str) -> String {
    extract_text_from_html_fragment(html)
}

/// Fetch URL and extract readable article content using the readability algorithm.
/// Returns structured readable content, or an error if extraction fails.
#[derive(Debug)]
struct ReadableArticle {
    html: String,
    text: String,
    images: Vec<DocumentImageAsset>,
}

async fn fetch_readable_content(url: &str) -> Result<ReadableArticle, AppError> {
    use readable_readability::Readability;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| AppError::IntegrationError(format!("Failed to create HTTP client: {}", e)))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| AppError::IntegrationError(format!("Failed to fetch URL for readability: {}", e)))?;

    if !response.status().is_success() {
        return Err(AppError::IntegrationError(format!("HTTP error fetching {}: {}", url, response.status())));
    }

    let html = response
        .text()
        .await
        .map_err(|e| AppError::IntegrationError(format!("Failed to read response body: {}", e)))?;

    // Readability internals are not Send, so we must complete parsing
    // before any .await point. Run synchronously and extract owned data.
    let content = tokio::task::block_in_place(|| {
        let mut readability = Readability::new();
        let (content_node, _metadata) = readability.parse(&html);
        content_node.to_string()
    });

    if content.trim().is_empty() {
        return Err(AppError::IntegrationError("Readability extracted empty content".to_string()));
    }

    Ok(ReadableArticle {
        text: extract_text_from_html_fragment(&content),
        images: extract_images_from_html_fragment(&content, url),
        html: content,
    })
}

async fn is_automation_authorized(state: &ServerState, headers: &HeaderMap) -> bool {
    let maybe_key = state.automation_api_key.lock().await.clone();
    let Some(expected_key) = maybe_key else {
        return false;
    };
    if expected_key.trim().is_empty() {
        return false;
    }

    let provided = headers
        .get("x-api-key")
        .and_then(|value| value.to_str().ok())
        .map(|value| value.trim().to_string())
        .or_else(|| {
            headers
                .get("authorization")
                .and_then(|value| value.to_str().ok())
                .and_then(|value| value.strip_prefix("Bearer "))
                .map(|value| value.trim().to_string())
        });

    provided
        .map(|provided_key| provided_key == expected_key)
        .unwrap_or(false)
}

/// Middleware that requires a valid API key on all requests.
/// The API key must be configured (non-empty) or all requests are rejected.
async fn require_api_key(
    State(state): State<ServerState>,
    headers: HeaderMap,
    request: Request<Body>,
    next: Next,
) -> Response {
    // Public proxy endpoints — no API key needed
    if request.uri().path() == "/api/podcast/search" {
        return next.run(request).await;
    }

    // Browser extension sync endpoint — no API key needed
    if request.uri().path() == "/" && request.method() == "POST" {
        return next.run(request).await;
    }

    if !is_automation_authorized(&state, &headers).await {
        return (StatusCode::UNAUTHORIZED, Json(json!({ "error": "Unauthorized — API key required" }))).into_response();
    }

    next.run(request).await
}

fn map_item_type(value: Option<&str>) -> ItemType {
    match value.unwrap_or("flashcard").to_ascii_lowercase().as_str() {
        "cloze" => ItemType::Cloze,
        "qa" => ItemType::Qa,
        "basic" => ItemType::Basic,
        _ => ItemType::Flashcard,
    }
}

async fn handle_automation_create_card(
    State(state): State<ServerState>,
    Json(payload): Json<AutomationCreateCardRequest>,
) -> Response {
    if payload.question.trim().is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({ "error": "question is required" }))).into_response();
    }

    let mut item = LearningItem::new(map_item_type(payload.item_type.as_deref()), payload.question);
    item.answer = payload.answer;
    item.tags = payload.tags.unwrap_or_default();

    match state.repo.create_learning_item(&item).await {
        Ok(created) => (
            StatusCode::OK,
            Json(AutomationCreateCardResponse {
                id: created.id,
                due_date: created.due_date.to_rfc3339(),
                interval: created.interval,
            }),
        )
            .into_response(),
        Err(error) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()),
    }
}

async fn handle_automation_due_count(
    State(state): State<ServerState>,
) -> Response {
    let now = chrono::Utc::now();
    match state.repo.get_due_learning_items(&now, None).await {
        Ok(items) => (
            StatusCode::OK,
            Json(AutomationDueCountResponse {
                due_count: items.len(),
            }),
        )
            .into_response(),
        Err(error) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()),
    }
}

async fn handle_automation_submit_review(
    State(state): State<ServerState>,
    Json(payload): Json<AutomationSubmitReviewRequest>,
) -> Response {
    if payload.rating < 1 || payload.rating > 4 {
        return (StatusCode::BAD_REQUEST, Json(json!({ "error": "rating must be between 1 and 4" }))).into_response();
    }

    match apply_review(
        &state.repo,
        &payload.item_id,
        payload.rating,
        payload.time_taken.unwrap_or(0),
        None,
        0.9,
        None,
        false,
        None,
    )
    .await
    {
        Ok(item) => (
            StatusCode::OK,
            Json(json!({
                "id": item.id,
                "dueDate": item.due_date.to_rfc3339(),
                "interval": item.interval,
                "reviewCount": item.review_count
            })),
        )
            .into_response(),
        Err(error) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()),
    }
}

/// Create error response
fn error_response(status: StatusCode, message: &str) -> Response {
    (
        status,
        Json(ExtensionResponse {
            success: false,
            document_id: None,
            extract_id: None,
            error: Some(message.to_string()),
        }),
    )
        .into_response()
}

/// Calculate reading time in minutes (average 200 words per minute)
fn calculate_reading_time(content: &str) -> u32 {
    let word_count = content.split_whitespace().count();
    ((word_count as f64 / 200.0).ceil() as u32).max(1)
}

/// Calculate word count
fn calculate_word_count(content: &str) -> u32 {
    content.split_whitespace().count() as u32
}

/// Estimate complexity score (1-10) based on simple heuristics
fn estimate_complexity(content: &str) -> u8 {
    let words: Vec<&str> = content.split_whitespace().collect();
    let word_count = words.len();
    
    if word_count == 0 {
        return 1;
    }
    
    // Average word length as a simple proxy for complexity
    let avg_word_len: f64 = words.iter().map(|w| w.len()).sum::<usize>() as f64 / word_count as f64;
    
    // Sentence count (rough estimate)
    let sentence_count = content.matches('.').count() + content.matches('!').count() + content.matches('?').count();
    let avg_sentence_len = if sentence_count > 0 { word_count / sentence_count } else { word_count };
    
    // Score based on word length and sentence length
    let complexity = ((avg_word_len - 3.0) * 1.5 + (avg_sentence_len as f64 - 10.0) * 0.2).clamp(1.0, 10.0);
    complexity as u8
}

/// Handle AI request from browser extension
async fn handle_ai_request(
    State(state): State<ServerState>,
    Json(payload): Json<AIRequest>,
) -> Response {
    info!(
        "Received AI request: operation={}, content_length={}",
        payload.operation,
        payload.content.len()
    );

    // Get AI config
    let ai_config = {
        let config_guard = state.ai_config.lock().await;
        config_guard.clone()
    };

    let config = match ai_config {
        Some(c) => c,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(AIResponse {
                    success: false,
                    summary: None,
                    key_points: None,
                    flashcards: None,
                    questions: None,
                    reading_time_minutes: None,
                    word_count: None,
                    complexity_score: None,
                    error: Some("AI is not configured. Please configure an AI provider in the desktop app settings.".to_string()),
                }),
            ).into_response();
        }
    };

    // Create AI provider
    let provider = match AIProvider::from_config(
        config.default_provider,
        &config.api_keys,
        &config.models,
        &config.local_settings,
    ) {
        Ok(p) => p,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AIResponse {
                    success: false,
                    summary: None,
                    key_points: None,
                    flashcards: None,
                    questions: None,
                    reading_time_minutes: None,
                    word_count: None,
                    complexity_score: None,
                    error: Some(format!("Failed to create AI provider: {}", e)),
                }),
            ).into_response();
        }
    };

    // Calculate content stats
    let reading_time = calculate_reading_time(&payload.content);
    let word_count = calculate_word_count(&payload.content);
    let complexity = estimate_complexity(&payload.content);

    // Process based on operation type
    let mut response = AIResponse {
        success: true,
        summary: None,
        key_points: None,
        flashcards: None,
        questions: None,
        reading_time_minutes: Some(reading_time),
        word_count: Some(word_count),
        complexity_score: Some(complexity),
        error: None,
    };

    match payload.operation.as_str() {
        "summarize" => {
            let summarizer = Summarizer::new(provider);
            match summarizer.summarize(&payload.content, payload.max_words).await {
                Ok(summary) => {
                    response.summary = Some(summary);
                }
                Err(e) => {
                    response.success = false;
                    response.error = Some(format!("Summarization failed: {}", e));
                }
            }
        }
        "key-points" => {
            let summarizer = Summarizer::new(provider);
            match summarizer.extract_key_points(&payload.content, payload.count).await {
                Ok(points) => {
                    response.key_points = Some(points);
                }
                Err(e) => {
                    response.success = false;
                    response.error = Some(format!("Key points extraction failed: {}", e));
                }
            }
        }
        "flashcards" => {
            let generator = FlashcardGenerator::new(provider);
            let options = FlashcardGenerationOptions {
                count: payload.count,
                ..Default::default()
            };
            match generator.generate_from_content(&payload.content, &options).await {
                Ok(cards) => {
                    response.flashcards = Some(
                        cards.into_iter().map(|c| GeneratedFlashcard {
                            question: c.question,
                            answer: c.answer,
                            card_type: format!("{:?}", c.card_type),
                        }).collect()
                    );
                }
                Err(e) => {
                    response.success = false;
                    response.error = Some(format!("Flashcard generation failed: {}", e));
                }
            }
        }
        "questions" => {
            let qa = QuestionAnswerer::new(provider);
            match qa.generate_questions(&payload.content, payload.count).await {
                Ok(questions) => {
                    response.questions = Some(questions);
                }
                Err(e) => {
                    response.success = false;
                    response.error = Some(format!("Question generation failed: {}", e));
                }
            }
        }
        "all" => {
            // Get all AI features at once - create separate providers for each operation
            let summarizer = Summarizer::new(provider);
            
            // Run summarization
            if let Ok(summary) = summarizer.summarize(&payload.content, payload.max_words).await {
                response.summary = Some(summary);
            }
            
            // Run key points extraction
            if let Ok(points) = summarizer.extract_key_points(&payload.content, payload.count).await {
                response.key_points = Some(points);
            }
            
            // Create new provider for questions
            if let Ok(qa_provider) = AIProvider::from_config(
                config.default_provider,
                &config.api_keys,
                &config.models,
                &config.local_settings,
            ) {
                let qa = QuestionAnswerer::new(qa_provider);
                if let Ok(questions) = qa.generate_questions(&payload.content, 3).await {
                    response.questions = Some(questions);
                }
            }
        }
        _ => {
            response.success = false;
            response.error = Some(format!("Unknown operation: {}", payload.operation));
        }
    }

    (StatusCode::OK, Json(response)).into_response()
}

/// Handle AI status check from browser extension
async fn handle_ai_status(
    State(state): State<ServerState>,
) -> Response {
    let ai_config = {
        let config_guard = state.ai_config.lock().await;
        config_guard.clone()
    };

    let response = match ai_config {
        Some(config) => {
            let provider_name = format!("{:?}", config.default_provider);
            let model = match config.default_provider {
                LLMProviderType::OpenAI => Some(config.models.openai_model.clone()),
                LLMProviderType::Anthropic => Some(config.models.anthropic_model.clone()),
                LLMProviderType::OpenRouter => Some(config.models.openrouter_model.clone()),
                LLMProviderType::Ollama => Some(config.models.ollama_model.clone()),
            };
            
            AIStatusResponse {
                configured: true,
                provider: Some(provider_name),
                model,
            }
        }
        None => AIStatusResponse {
            configured: false,
            provider: None,
            model: None,
        },
    };

    (StatusCode::OK, Json(response)).into_response()
}

/// ============================================================================
/// RSS API Handlers
/// ============================================================================
/// Handle RSS feed creation
async fn handle_create_feed(
    State(state): State<ServerState>,
    Json(payload): Json<CreateFeedRequest>,
) -> Response {
    match create_rss_feed_http(
        payload.url,
        payload.title,
        payload.description,
        payload.category,
        payload.update_interval,
        payload.auto_queue,
        &state.repo,
    ).await {
        Ok(feed) => {
            let unread_count = state.repo.get_rss_feed_unread_count(&feed.id).await.unwrap_or(0);
            let response = FeedResponse {
                feed,
                unread_count,
            };
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(e) => {
            error!("Failed to create RSS feed: {}", e);
            error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

/// Handle listing all RSS feeds
async fn handle_list_feeds(
    State(state): State<ServerState>,
) -> Response {
    match get_rss_feeds_http(&state.repo).await {
        Ok(feeds) => {
            let mut responses = Vec::new();
            for feed in feeds {
                let unread_count = state.repo.get_rss_feed_unread_count(&feed.id).await.unwrap_or(0);
                responses.push(FeedResponse {
                    feed,
                    unread_count,
                });
            }
            (StatusCode::OK, Json(responses)).into_response()
        }
        Err(e) => {
            error!("Failed to list RSS feeds: {}", e);
            error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

/// Handle getting a specific RSS feed
async fn handle_get_feed(
    State(state): State<ServerState>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Response {
    match get_rss_feed_http(&id, &state.repo).await {
        Ok(Some(feed)) => {
            let unread_count = state.repo.get_rss_feed_unread_count(&feed.id).await.unwrap_or(0);
            let response = FeedResponse {
                feed,
                unread_count,
            };
            (StatusCode::OK, Json(response)).into_response()
        }
        Ok(None) => error_response(StatusCode::NOT_FOUND, "Feed not found"),
        Err(e) => {
            error!("Failed to get RSS feed: {}", e);
            error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

/// Handle updating an RSS feed
async fn handle_update_feed(
    State(state): State<ServerState>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(payload): Json<UpdateFeedRequest>,
) -> Response {
    match update_rss_feed_http(
        &id,
        payload.title,
        payload.description,
        payload.category,
        payload.update_interval,
        payload.auto_queue,
        payload.is_active,
        &state.repo,
    ).await {
        Ok(feed) => {
            let unread_count = state.repo.get_rss_feed_unread_count(&feed.id).await.unwrap_or(0);
            let response = FeedResponse {
                feed,
                unread_count,
            };
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(e) => {
            error!("Failed to update RSS feed: {}", e);
            error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

/// Handle deleting an RSS feed
async fn handle_delete_feed(
    State(state): State<ServerState>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Response {
    match delete_rss_feed_http(&id, &state.repo).await {
        Ok(()) => (StatusCode::OK, Json(serde_json::json!({"success": true}))).into_response(),
        Err(e) => {
            error!("Failed to delete RSS feed: {}", e);
            error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

/// Handle getting articles for a feed
async fn handle_get_feed_articles(
    State(state): State<ServerState>,
    axum::extract::Path(id): axum::extract::Path<String>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Response {
    let limit = params.get("limit").and_then(|l| l.parse::<i32>().ok());
    let feed_id = if id == "all" { None } else { Some(id.clone()) };

    match get_rss_articles_http(feed_id.as_deref(), limit, &state.repo).await {
        Ok(articles) => (StatusCode::OK, Json(articles)).into_response(),
        Err(e) => {
            error!("Failed to get RSS articles: {}", e);
            error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

/// Handle marking an article as read/unread
async fn handle_mark_article(
    State(state): State<ServerState>,
    axum::extract::Path(id): axum::extract::Path<String>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Response {
    let is_read = params.get("read")
        .and_then(|r| r.parse::<bool>().ok())
        .unwrap_or(true);

    match mark_rss_article_read_http(&id, is_read, &state.repo).await {
        Ok(()) => (StatusCode::OK, Json(serde_json::json!({"success": true}))).into_response(),
        Err(e) => {
            error!("Failed to mark article: {}", e);
            error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

/// Handle toggling article queued status
async fn handle_toggle_article_queued(
    State(state): State<ServerState>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Response {
    match toggle_rss_article_queued_http(&id, &state.repo).await {
        Ok(queued) => (StatusCode::OK, Json(serde_json::json!({"success": true, "queued": queued}))).into_response(),
        Err(e) => {
            error!("Failed to toggle article queued: {}", e);
            error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

/// Handle fetching and parsing a feed URL (without subscribing)
async fn handle_fetch_feed_url(
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Response {
    let url = match params.get("url") {
        Some(u) => u.clone(),
        None => return error_response(StatusCode::BAD_REQUEST, "Missing url parameter"),
    };

    if let Err(e) = crate::security::validate_url_not_private(&url) {
        return error_response(StatusCode::BAD_REQUEST, &format!("URL not allowed: {}", e));
    }

    match fetch_rss_feed_url(url).await {
        Ok(parsed_feed) => (StatusCode::OK, Json(parsed_feed)).into_response(),
        Err(e) => {
            error!("Failed to fetch feed URL: {}", e);
            error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

/// Handle OPML import
async fn handle_opml_import(
    State(state): State<ServerState>,
    Json(payload): Json<OpmlImportRequest>,
) -> Response {
    // Parse OPML content
    let parsed_feeds = match parse_opml_content(&payload.opml_content) {
        Ok(feeds) => feeds,
        Err(e) => {
            return error_response(StatusCode::BAD_REQUEST, &format!("Failed to parse OPML: {}", e));
        }
    };

    let mut imported_count = 0;
    let mut errors = Vec::new();

    for feed_data in parsed_feeds {
        let title = feed_data.title.clone();
        match create_rss_feed_http(
            feed_data.url,
            feed_data.title,
            feed_data.description,
            feed_data.category,
            feed_data.update_interval,
            feed_data.auto_queue,
            &state.repo,
        ).await {
            Ok(_) => imported_count += 1,
            Err(e) => errors.push(format!("Failed to import {}: {}", title, e)),
        }
    }

    (StatusCode::OK, Json(serde_json::json!({
        "success": true,
        "imported": imported_count,
        "errors": errors
    }))).into_response()
}

/// Handle OPML export
async fn handle_opml_export(
    State(state): State<ServerState>,
) -> Response {
    match get_rss_feeds_http(&state.repo).await {
        Ok(feeds) => {
            let opml_content = generate_opml_content(&feeds);
            let response = OpmlExportResponse { opml_content };
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(e) => {
            error!("Failed to export feeds: {}", e);
            error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

/// Parsed feed data from OPML
#[derive(Debug)]
struct OpmlFeedData {
    url: String,
    title: String,
    description: Option<String>,
    category: Option<String>,
    update_interval: Option<i32>,
    auto_queue: Option<bool>,
}

/// Parse OPML content and extract feed data
fn parse_opml_content(content: &str) -> Result<Vec<OpmlFeedData>, String> {
    use roxmltree::Document;
    use std::collections::HashSet;

    let doc = Document::parse(content)
        .map_err(|e| format!("Failed to parse OPML XML: {}", e))?;

    let mut feeds = Vec::new();
    let mut seen_urls = HashSet::new();

    // Find all outline elements (RSS feeds in OPML)
    for node in doc.descendants() {
        if node.tag_name().name() == "outline" {
            if let Some(url) = node.attribute("xmlUrl") {
                let url = url.trim();
                let normalized_url = if url.starts_with("feed://") {
                    url.strip_prefix("feed://")
                        .map(|rest| format!("https://{}", rest))
                        .unwrap_or_else(|| url.to_string())
                } else if let Some(rest) = url.strip_prefix("feed:") {
                    rest.to_string()
                } else {
                    url.to_string()
                };

                if !(normalized_url.starts_with("http://") || normalized_url.starts_with("https://")) {
                    continue;
                }

                if !seen_urls.insert(normalized_url.clone()) {
                    continue;
                }

                let title = node.attribute("title")
                    .or_else(|| node.attribute("text"))
                    .unwrap_or("Unknown Feed")
                    .to_string();

                let mut category = None;
                let mut parent = node.parent();
                while let Some(ancestor) = parent {
                    if ancestor.tag_name().name() == "outline" && ancestor.attribute("xmlUrl").is_none() {
                        category = ancestor.attribute("title")
                            .or_else(|| ancestor.attribute("text"))
                            .map(|value| value.to_string());
                        if category.is_some() {
                            break;
                        }
                    }
                    parent = ancestor.parent();
                }

                feeds.push(OpmlFeedData {
                    url: normalized_url,
                    title,
                    description: node.attribute("description").map(|s| s.to_string()),
                    category,
                    update_interval: None,
                    auto_queue: None,
                });
            }
        }
    }

    Ok(feeds)
}

/// Generate OPML content from feeds
fn generate_opml_content(feeds: &[RssFeed]) -> String {
    let mut opml = String::from(r#"<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Incrementum RSS Feeds</title>
    <dateCreated>"#);

    opml.push_str(&chrono::Utc::now().to_rfc3339());
    opml.push_str(r#"</dateCreated>
  </head>
  <body>
"#);

    for feed in feeds {
        opml.push_str(r#"    <outline type="rss""#);
        opml.push_str(&format!(" xmlUrl=\"{}\"", feed.url));
        opml.push_str(&format!(" title=\"{}\"", escape_xml(&feed.title)));
        opml.push_str(&format!(" text=\"{}\"", escape_xml(&feed.title)));
        if let Some(desc) = &feed.description {
            opml.push_str(&format!(" description=\"{}\"", escape_xml(desc)));
        }
        if let Some(category) = &feed.category {
            opml.push_str(&format!(" category=\"{}\"", escape_xml(category)));
        }
        opml.push_str("/>\n");
    }

    opml.push_str(r#"  </body>
</opml>"#);

    opml
}

/// Escape XML special characters
fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

// ============================================================================
// RSS User Preferences API Handlers
// ============================================================================

/// Request to get RSS user preferences
#[derive(Debug, Deserialize)]
pub struct GetPreferencesRequest {
    pub feed_id: Option<String>,
    pub user_id: Option<String>,
}

/// Handle getting RSS user preferences
async fn handle_get_preferences(
    State(state): State<ServerState>,
    Query(params): Query<GetPreferencesRequest>,
) -> Response {
    let feed_id = params.feed_id.as_deref();
    let user_id = params.user_id.as_deref();

    match state.repo.get_rss_user_preferences(feed_id, user_id).await {
        Ok(Some(prefs)) => (StatusCode::OK, Json(prefs)).into_response(),
        Ok(None) => {
            // Return default preferences if none exist
            let defaults = RssUserPreference {
                id: uuid::Uuid::new_v4().to_string(),
                user_id: user_id.map(|s| s.to_string()),
                feed_id: feed_id.map(|s| s.to_string()),
                keyword_include: None,
                keyword_exclude: None,
                author_whitelist: None,
                author_blacklist: None,
                category_filter: None,
                view_mode: Some("card".to_string()),
                theme_mode: Some("system".to_string()),
                density: Some("normal".to_string()),
                column_count: Some(2),
                show_thumbnails: Some(true),
                excerpt_length: Some(150),
                show_author: Some(true),
                show_date: Some(true),
                show_feed_icon: Some(true),
                sort_by: Some("date".to_string()),
                sort_order: Some("desc".to_string()),
                date_created: chrono::Utc::now().to_rfc3339(),
                date_modified: chrono::Utc::now().to_rfc3339(),
            };
            (StatusCode::OK, Json(defaults)).into_response()
        }
        Err(e) => {
            error!("Failed to get RSS preferences: {}", e);
            error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

/// Handle setting RSS user preferences
async fn handle_set_preferences(
    State(state): State<ServerState>,
    Query(params): Query<GetPreferencesRequest>,
    Json(prefs): Json<RssUserPreferenceUpdate>,
) -> Response {
    let feed_id = params.feed_id.as_deref();
    let user_id = params.user_id.as_deref();

    match state.repo.set_rss_user_preferences(feed_id, user_id, prefs).await {
        Ok(updated_prefs) => (StatusCode::OK, Json(updated_prefs)).into_response(),
        Err(e) => {
            error!("Failed to set RSS preferences: {}", e);
            error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

// ============================================================================
// RSS NewsBlur Features API Handlers
// ============================================================================

/// Handle adding a classifier
async fn handle_add_classifier(
    State(state): State<ServerState>,
    Json(payload): Json<serde_json::Value>,
) -> Response {
    let feed_id = payload.get("feed_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let classifier_type = payload.get("classifier_type").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let value = payload.get("value").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let sentiment = payload.get("sentiment").and_then(|v| v.as_str()).unwrap_or("").to_string();

    match add_rss_classifier_http(&feed_id, &classifier_type, &value, &sentiment, &state.repo).await {
        Ok(classifier) => (StatusCode::OK, Json(classifier)).into_response(),
        Err(e) => {
            error!("Failed to add classifier: {}", e);
            error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

/// Handle listing classifiers
async fn handle_list_classifiers(
    State(state): State<ServerState>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Response {
    let feed_id = params.get("feed_id").map(|s| s.as_str());
    match get_rss_classifiers_http(feed_id, &state.repo).await {
        Ok(classifiers) => (StatusCode::OK, Json(classifiers)).into_response(),
        Err(e) => {
            error!("Failed to list classifiers: {}", e);
            error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

/// Handle removing a classifier
async fn handle_remove_classifier(
    State(state): State<ServerState>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Response {
    match remove_rss_classifier_http(&id, &state.repo).await {
        Ok(()) => (StatusCode::OK, Json(serde_json::json!({"success": true}))).into_response(),
        Err(e) => {
            error!("Failed to remove classifier: {}", e);
            error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

/// Handle batch classifier update
async fn handle_batch_update_classifiers(
    State(state): State<ServerState>,
    Json(updates): Json<Vec<crate::commands::rss_features::ClassifierUpdate>>,
) -> Response {
    match update_rss_classifiers_batch_http(updates, &state.repo).await {
        Ok(()) => (StatusCode::OK, Json(serde_json::json!({"success": true}))).into_response(),
        Err(e) => {
            error!("Failed to batch update classifiers: {}", e);
            error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

/// Handle marking article as unread
async fn handle_mark_article_unread(
    State(state): State<ServerState>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Response {
    match mark_rss_article_unread_http(&id, &state.repo).await {
        Ok(()) => (StatusCode::OK, Json(serde_json::json!({"success": true}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle marking articles before a date as read
async fn handle_mark_before_date(
    State(state): State<ServerState>,
    Json(payload): Json<serde_json::Value>,
) -> Response {
    let before_date = payload.get("before_date").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let feed_id = payload.get("feed_id").and_then(|v| v.as_str());
    match mark_rss_articles_before_date_read_http(feed_id, &before_date, &state.repo).await {
        Ok(count) => (StatusCode::OK, Json(serde_json::json!({"marked": count}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle marking articles after a date as read
async fn handle_mark_after_date(
    State(state): State<ServerState>,
    Json(payload): Json<serde_json::Value>,
) -> Response {
    let after_date = payload.get("after_date").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let feed_id = payload.get("feed_id").and_then(|v| v.as_str());
    match mark_rss_articles_after_date_read_http(feed_id, &after_date, &state.repo).await {
        Ok(count) => (StatusCode::OK, Json(serde_json::json!({"marked": count}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle getting read articles
async fn handle_get_read_articles(
    State(state): State<ServerState>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Response {
    let limit = params.get("limit").and_then(|l| l.parse::<i32>().ok());
    let offset = params.get("offset").and_then(|o| o.parse::<i32>().ok());
    match get_read_rss_articles_http(limit, offset, &state.repo).await {
        Ok(articles) => (StatusCode::OK, Json(articles)).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle river of news
async fn handle_river_of_news(
    State(state): State<ServerState>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Response {
    let folder_id = params.get("folder_id").cloned().unwrap_or_default();
    let limit = params.get("limit").and_then(|l| l.parse::<i32>().ok());
    match get_river_of_news_http(&folder_id, limit, &state.repo).await {
        Ok(articles) => (StatusCode::OK, Json(articles)).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle articles with intelligence filter
async fn handle_articles_with_intelligence(
    State(state): State<ServerState>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Response {
    let feed_id = params.get("feed_id").map(|s| s.as_str());
    let limit = params.get("limit").and_then(|l| l.parse::<i32>().ok());
    let include_hidden = params.get("include_hidden").and_then(|h| h.parse::<bool>().ok()).unwrap_or(false);
    match get_rss_articles_with_intelligence_http(feed_id, limit, include_hidden, &state.repo).await {
        Ok(articles) => (StatusCode::OK, Json(articles)).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle recompute intelligence scores
async fn handle_recompute_scores(
    State(state): State<ServerState>,
) -> Response {
    match recompute_all_intelligence_scores_http(&state.repo).await {
        Ok(count) => (StatusCode::OK, Json(serde_json::json!({"recomputed": count}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle search articles
async fn handle_search_articles(
    State(state): State<ServerState>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Response {
    let query = params.get("q").cloned().unwrap_or_default();
    let feed_id = params.get("feed_id").cloned();
    let folder_id = params.get("folder_id").cloned();
    let scope = params.get("scope").cloned();
    let limit = params.get("limit").and_then(|l| l.parse::<i32>().ok());
    match search_rss_articles_http(query, feed_id.as_deref(), folder_id.as_deref(), scope.as_deref(), limit, &state.repo).await {
        Ok(results) => (StatusCode::OK, Json(results)).into_response(),
        Err(e) => {
            error!("Search failed: {}", e);
            error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

/// Handle compute clusters
async fn handle_compute_clusters(
    State(state): State<ServerState>,
    Json(payload): Json<serde_json::Value>,
) -> Response {
    let feed_id = payload.get("feed_id").and_then(|v| v.as_str());
    match compute_story_clusters_http(feed_id, &state.repo).await {
        Ok(clusters) => (StatusCode::OK, Json(clusters)).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle get clusters
async fn handle_get_clusters(
    State(state): State<ServerState>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Response {
    let feed_id = params.get("feed_id").map(|s| s.as_str());
    match get_rss_article_clusters_http(feed_id, &state.repo).await {
        Ok(clusters) => (StatusCode::OK, Json(clusters)).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle invalidate clusters
async fn handle_invalidate_clusters(
    State(state): State<ServerState>,
    axum::extract::Path(feed_id): axum::extract::Path<String>,
) -> Response {
    match invalidate_clusters_for_feed_http(&feed_id, &state.repo).await {
        Ok(()) => (StatusCode::OK, Json(serde_json::json!({"success": true}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle add tag
async fn handle_add_tag(
    State(state): State<ServerState>,
    Json(payload): Json<serde_json::Value>,
) -> Response {
    let name = payload.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
    match add_tag_http(&name, &state.repo).await {
        Ok(tag) => (StatusCode::OK, Json(tag)).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle list tags
async fn handle_list_tags(
    State(state): State<ServerState>,
) -> Response {
    match get_all_tags_http(&state.repo).await {
        Ok(tags) => (StatusCode::OK, Json(tags)).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle remove tag
async fn handle_remove_tag(
    State(state): State<ServerState>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Response {
    match remove_tag_http(&id, &state.repo).await {
        Ok(()) => (StatusCode::OK, Json(serde_json::json!({"success": true}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle rename tag
async fn handle_rename_tag(
    State(state): State<ServerState>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(payload): Json<serde_json::Value>,
) -> Response {
    let new_name = payload.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
    match rename_tag_http(&id, &new_name, &state.repo).await {
        Ok(()) => (StatusCode::OK, Json(serde_json::json!({"success": true}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle merge tags
async fn handle_merge_tags(
    State(state): State<ServerState>,
    Json(payload): Json<serde_json::Value>,
) -> Response {
    let source = payload.get("source_tag_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let target = payload.get("target_tag_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
    match merge_tags_http(&source, &target, &state.repo).await {
        Ok(()) => (StatusCode::OK, Json(serde_json::json!({"success": true}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle get article tags
async fn handle_get_article_tags(
    State(state): State<ServerState>,
    axum::extract::Path(article_id): axum::extract::Path<String>,
) -> Response {
    match get_article_tags_http(&article_id, &state.repo).await {
        Ok(tags) => (StatusCode::OK, Json(tags)).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle tag article
async fn handle_tag_article(
    State(state): State<ServerState>,
    axum::extract::Path((article_id, tag_id)): axum::extract::Path<(String, String)>,
) -> Response {
    match tag_article_http(&article_id, &tag_id, &state.repo).await {
        Ok(()) => (StatusCode::OK, Json(serde_json::json!({"success": true}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle untag article
async fn handle_untag_article(
    State(state): State<ServerState>,
    axum::extract::Path((article_id, tag_id)): axum::extract::Path<(String, String)>,
) -> Response {
    match untag_article_http(&article_id, &tag_id, &state.repo).await {
        Ok(()) => (StatusCode::OK, Json(serde_json::json!({"success": true}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle get articles by tag
async fn handle_get_articles_by_tag(
    State(state): State<ServerState>,
    axum::extract::Path(tag_id): axum::extract::Path<String>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Response {
    let limit = params.get("limit").and_then(|l| l.parse::<i32>().ok());
    match get_articles_by_tag_http(&tag_id, limit, &state.repo).await {
        Ok(articles) => (StatusCode::OK, Json(articles)).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle create annotation
async fn handle_create_annotation(
    State(state): State<ServerState>,
    Json(payload): Json<serde_json::Value>,
) -> Response {
    let article_id = payload.get("article_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let annotation_type = payload.get("annotation_type").and_then(|v| v.as_str()).unwrap_or("highlight").to_string();
    let content = payload.get("content").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let start_offset = payload.get("start_offset").and_then(|v| v.as_i64()).map(|v| v as i32);
    let end_offset = payload.get("end_offset").and_then(|v| v.as_i64()).map(|v| v as i32);
    let color = payload.get("color").and_then(|v| v.as_str()).map(|s| s.to_string());
    match create_annotation_http(&article_id, &annotation_type, &content, start_offset, end_offset, color.as_deref(), &state.repo).await {
        Ok(ann) => (StatusCode::OK, Json(ann)).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle get article annotations
async fn handle_get_article_annotations(
    State(state): State<ServerState>,
    axum::extract::Path(article_id): axum::extract::Path<String>,
) -> Response {
    match get_article_annotations_http(&article_id, &state.repo).await {
        Ok(annotations) => (StatusCode::OK, Json(annotations)).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle update annotation
async fn handle_update_annotation(
    State(state): State<ServerState>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(payload): Json<serde_json::Value>,
) -> Response {
    let content = payload.get("content").and_then(|v| v.as_str()).map(|s| s.to_string());
    let color = payload.get("color").and_then(|v| v.as_str()).map(|s| s.to_string());
    match update_annotation_http(&id, content.as_deref(), color.as_deref(), &state.repo).await {
        Ok(ann) => (StatusCode::OK, Json(ann)).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle delete annotation
async fn handle_delete_annotation(
    State(state): State<ServerState>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Response {
    match delete_annotation_http(&id, &state.repo).await {
        Ok(()) => (StatusCode::OK, Json(serde_json::json!({"success": true}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle get discovered sites
async fn handle_get_discovered_sites(
    State(state): State<ServerState>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Response {
    let limit = params.get("limit").and_then(|l| l.parse::<i32>().ok());
    let offset = params.get("offset").and_then(|o| o.parse::<i32>().ok());
    match get_discovered_sites_http(limit, offset, &state.repo).await {
        Ok(sites) => (StatusCode::OK, Json(sites)).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle refresh discoveries
async fn handle_refresh_discoveries(
    State(state): State<ServerState>,
) -> Response {
    // refresh_discoveries is a Tauri command that takes State<'_, Repository>
    // For HTTP, we do a simplified version: extract domains from recent articles and try RSS auto-discovery
    // This handler is a placeholder - full discovery requires async HTTP requests
    (StatusCode::OK, Json(serde_json::json!({"discovered": 0}))).into_response()
}

/// Handle delete discovered site
async fn handle_delete_discovered_site(
    State(state): State<ServerState>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Response {
    match delete_discovered_site_http(&id, &state.repo).await {
        Ok(()) => (StatusCode::OK, Json(serde_json::json!({"success": true}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle create folder
async fn handle_create_folder(
    State(state): State<ServerState>,
    Json(payload): Json<serde_json::Value>,
) -> Response {
    let name = payload.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let parent_id = payload.get("parent_id").and_then(|v| v.as_str());
    let icon = payload.get("icon").and_then(|v| v.as_str());
    let auto_mark_after_days = payload.get("auto_mark_after_days").and_then(|v| v.as_i64()).map(|v| v as i32);
    match create_rss_folder_http(&name, parent_id, icon, auto_mark_after_days, &state.repo).await {
        Ok(folder) => (StatusCode::OK, Json(folder)).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle list folders
async fn handle_list_folders(
    State(state): State<ServerState>,
) -> Response {
    match get_rss_folders_http(&state.repo).await {
        Ok(folders) => (StatusCode::OK, Json(folders)).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle update folder
async fn handle_update_folder(
    State(state): State<ServerState>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(payload): Json<serde_json::Value>,
) -> Response {
    let name = payload.get("name").and_then(|v| v.as_str()).map(|s| s.to_string());
    let parent_id = payload.get("parent_id").and_then(|v| v.as_str()).map(|s| s.to_string());
    let parent_id_null = payload.get("parent_id").and_then(|v| v.as_null()).map(|_| ());
    let icon = payload.get("icon").and_then(|v| v.as_str()).map(|s| s.to_string());
    let icon_null = payload.get("icon").and_then(|v| v.as_null()).map(|_| ());
    let sort_order = payload.get("sort_order").and_then(|v| v.as_i64()).map(|v| v as i32);
    let auto_mark_after_days_val = payload.get("auto_mark_after_days").and_then(|v| v.as_i64()).map(|v| v as i32);
    let auto_mark_after_days_null = payload.get("auto_mark_after_days").and_then(|v| v.as_null()).map(|_| ());

    if name.is_none() && parent_id.is_none() && parent_id_null.is_none() && icon.is_none() && icon_null.is_none() && sort_order.is_none() && auto_mark_after_days_val.is_none() && auto_mark_after_days_null.is_none() {
        return match get_rss_folders_http(&state.repo).await {
            Ok(folders) => folders.into_iter().find(|f| f.id == id).map_or_else(|| error_response(StatusCode::NOT_FOUND, "Folder not found"), |f| (StatusCode::OK, Json(f)).into_response()),
            Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
        };
    }

    // Build parameterized update
    if let Some(ref n) = name {
        if let Err(e) = sqlx::query("UPDATE rss_folders SET name = ? WHERE id = ?").bind(n).bind(&id).execute(state.repo.pool()).await {
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string());
        }
    }
    if let Some(ref pid) = parent_id {
        if let Err(e) = sqlx::query("UPDATE rss_folders SET parent_id = ? WHERE id = ?").bind(pid).bind(&id).execute(state.repo.pool()).await {
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string());
        }
    }
    if parent_id_null.is_some() {
        if let Err(e) = sqlx::query("UPDATE rss_folders SET parent_id = NULL WHERE id = ?").bind(&id).execute(state.repo.pool()).await {
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string());
        }
    }
    if let Some(ref ic) = icon {
        if let Err(e) = sqlx::query("UPDATE rss_folders SET icon = ? WHERE id = ?").bind(ic).bind(&id).execute(state.repo.pool()).await {
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string());
        }
    }
    if icon_null.is_some() {
        if let Err(e) = sqlx::query("UPDATE rss_folders SET icon = NULL WHERE id = ?").bind(&id).execute(state.repo.pool()).await {
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string());
        }
    }
    if let Some(so) = sort_order {
        if let Err(e) = sqlx::query("UPDATE rss_folders SET sort_order = ? WHERE id = ?").bind(so).bind(&id).execute(state.repo.pool()).await {
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string());
        }
    }
    if let Some(v) = auto_mark_after_days_val {
        if let Err(e) = sqlx::query("UPDATE rss_folders SET auto_mark_after_days = ? WHERE id = ?").bind(v).bind(&id).execute(state.repo.pool()).await {
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string());
        }
    }
    if auto_mark_after_days_null.is_some() {
        if let Err(e) = sqlx::query("UPDATE rss_folders SET auto_mark_after_days = NULL WHERE id = ?").bind(&id).execute(state.repo.pool()).await {
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string());
        }
    }

    match get_rss_folders_http(&state.repo).await {
        Ok(folders) => folders.into_iter().find(|f| f.id == id).map_or_else(|| error_response(StatusCode::NOT_FOUND, "Folder not found"), |f| (StatusCode::OK, Json(f)).into_response()),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle delete folder
async fn handle_delete_folder(
    State(state): State<ServerState>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Response {
    let move_to = params.get("move_feeds_to").cloned();
    match delete_rss_folder_http(&id, move_to.as_deref(), &state.repo).await {
        Ok(()) => (StatusCode::OK, Json(serde_json::json!({"success": true}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle reorder folders
async fn handle_reorder_folders_http(
    State(state): State<ServerState>,
    Json(payload): Json<Vec<(String, i32)>>,
) -> Response {
    match reorder_folders_http(payload, &state.repo).await {
        Ok(()) => (StatusCode::OK, Json(serde_json::json!({"success": true}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle move feed to folder
async fn handle_move_feed_to_folder(
    State(state): State<ServerState>,
    axum::extract::Path(feed_id): axum::extract::Path<String>,
    Json(payload): Json<serde_json::Value>,
) -> Response {
    let folder_id = payload.get("folder_id").and_then(|v| v.as_str());
    let sort_order = payload.get("sort_order").and_then(|v| v.as_i64()).map(|v| v as i32);
    match move_feed_to_folder_http(&feed_id, folder_id, sort_order, &state.repo).await {
        Ok(()) => (StatusCode::OK, Json(serde_json::json!({"success": true}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle toggle feed active
async fn handle_toggle_feed_active(
    State(state): State<ServerState>,
    axum::extract::Path(feed_id): axum::extract::Path<String>,
) -> Response {
    match toggle_feed_active_http(&feed_id, &state.repo).await {
        Ok(is_active) => (StatusCode::OK, Json(serde_json::json!({"is_active": is_active}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle get feed statistics
async fn handle_get_feed_statistics(
    State(state): State<ServerState>,
    axum::extract::Path(feed_id): axum::extract::Path<String>,
) -> Response {
    match get_feed_statistics_http(&feed_id, &state.repo).await {
        Ok(stats) => (StatusCode::OK, Json(stats)).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle set feed view preferences
async fn handle_set_feed_view_prefs(
    State(state): State<ServerState>,
    axum::extract::Path(feed_id): axum::extract::Path<String>,
    Json(payload): Json<serde_json::Value>,
) -> Response {
    let view_mode = payload.get("view_mode").and_then(|v| v.as_str());
    let layout = payload.get("layout").and_then(|v| v.as_str());
    match set_feed_view_preferences_http(&feed_id, view_mode, layout, &state.repo).await {
        Ok(()) => (StatusCode::OK, Json(serde_json::json!({"success": true}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Handle folder migration from localStorage
async fn handle_migrate_folders(
    State(state): State<ServerState>,
    Json(payload): Json<serde_json::Value>,
) -> Response {
    let folders_json = payload.get("folders")
        .map(|v| v.to_string())
        .unwrap_or_else(|| "[]".to_string());
    match migrate_folders_from_localstorage_http(&folders_json, &state.repo).await {
        Ok(count) => (StatusCode::OK, Json(serde_json::json!({"migrated": count}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

// ============================================================================
// Document Progress API Handlers
// ============================================================================

/// Handle getting a document by ID
async fn handle_get_document(
    State(state): State<ServerState>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Response {
    use crate::database::Repository;

    match state.repo.get_document(&id).await {
        Ok(Some(doc)) => {
            let response = DocumentResponse {
                id: doc.id,
                title: doc.title,
                file_path: doc.file_path,
                file_type: format!("{:?}", doc.file_type),
                current_page: doc.current_page,
                current_scroll_percent: doc.current_scroll_percent,
                current_cfi: doc.current_cfi,
                current_view_state: doc.current_view_state,
                total_pages: doc.total_pages,
                content: doc.content,
                category: doc.category,
                tags: doc.tags,
                date_added: doc.date_added.to_rfc3339(),
                date_modified: doc.date_modified.to_rfc3339(),
            };
            (StatusCode::OK, Json(response)).into_response()
        }
        Ok(None) => error_response(StatusCode::NOT_FOUND, "Document not found"),
        Err(e) => {
            error!("Failed to get document: {}", e);
            error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

/// Handle updating document progress
async fn handle_update_progress(
    State(state): State<ServerState>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(payload): Json<UpdateProgressRequest>,
) -> Response {
    use crate::database::Repository;

    match state
        .repo
        .update_document_progress(
            &id,
            payload.current_page,
            payload.current_scroll_percent,
            payload.current_cfi,
            payload.current_view_state,
        )
        .await
    {
        Ok(updated_doc) => {
            let response = DocumentResponse {
                id: updated_doc.id,
                title: updated_doc.title,
                file_path: updated_doc.file_path,
                file_type: format!("{:?}", updated_doc.file_type),
                current_page: updated_doc.current_page,
                current_scroll_percent: updated_doc.current_scroll_percent,
                current_cfi: updated_doc.current_cfi,
                current_view_state: updated_doc.current_view_state,
                total_pages: updated_doc.total_pages,
                content: updated_doc.content,
                category: updated_doc.category,
                tags: updated_doc.tags,
                date_added: updated_doc.date_added.to_rfc3339(),
                date_modified: updated_doc.date_modified.to_rfc3339(),
            };
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(e) => {
            error!("Failed to update progress: {}", e);
            error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

/// Tauri commands

#[tauri::command]
pub async fn start_browser_sync_server(
    app_handle: AppHandle,
    port: u16,
    repo: tauri::State<'_, Repository>,
    ai_state: tauri::State<'_, crate::commands::ai::AIState>,
) -> Result<ServerStatus, AppError> {
    let loaded_config = load_config();
    let config = BrowserSyncConfig {
        host: "127.0.0.1".to_string(),
        port,
        auto_start: false,
        api_key: loaded_config.api_key,
    };

    // Get AI config from the AI state
    let ai_config = {
        let guard = ai_state.config.lock().unwrap();
        guard.clone()
    };

    // Get the pool from the repository and create a new Arc<Repository>
    let pool = repo.pool().clone();
    let repo_arc = Arc::new(Repository::new(pool));
    start_server(config, repo_arc, app_handle, ai_config).await?;

    Ok(ServerStatus {
        running: true,
        port,
        connections: 0,
    })
}

#[tauri::command]
pub async fn stop_browser_sync_server() -> Result<ServerStatus, AppError> {
    stop_server().await?;

    Ok(ServerStatus {
        running: false,
        port: 0,
        connections: 0,
    })
}

#[tauri::command]
pub async fn get_browser_sync_server_status(port: u16) -> Result<ServerStatus, AppError> {
    let loaded_config = load_config();
    let config = BrowserSyncConfig {
        host: "127.0.0.1".to_string(),
        port,
        auto_start: false,
        api_key: loaded_config.api_key,
    };

    Ok(get_status(config).await)
}

/// Get the config file path for browser sync settings
fn get_config_path() -> std::path::PathBuf {
    let mut path = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    path.push("incrementum");
    path.push("browser_sync_config.json");
    path
}

/// Load browser sync config from file
fn load_config() -> BrowserSyncConfig {
    let path = get_config_path();
    if let Ok(content) = std::fs::read_to_string(&path) {
        if let Ok(config) = serde_json::from_str::<BrowserSyncConfig>(&content) {
            return config;
        }
    }
    BrowserSyncConfig::default()
}

/// Save browser sync config to file
fn save_config(config: &BrowserSyncConfig) -> Result<(), AppError> {
    let path = get_config_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(AppError::Io)?;
    }
    let json = serde_json::to_string_pretty(config)
        .map_err(AppError::Serialization)?;
    std::fs::write(&path, &json)
        .map_err(AppError::Io)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o600);
        std::fs::set_permissions(&path, perms).map_err(AppError::Io)?;
    }
    Ok(())
}

/// Get browser sync config
#[tauri::command]
pub async fn get_browser_sync_config() -> Result<BrowserSyncConfig, AppError> {
    Ok(load_config())
}

/// Set browser sync config
#[tauri::command]
pub async fn set_browser_sync_config(config: BrowserSyncConfig) -> Result<(), AppError> {
    save_config(&config)
}

fn generate_automation_api_key() -> String {
    format!("inc_{}", uuid::Uuid::new_v4().simple())
}

#[tauri::command]
pub async fn get_automation_api_key() -> Result<String, AppError> {
    let mut config = load_config();
    if config.api_key.as_deref().unwrap_or_default().is_empty() {
        config.api_key = Some(generate_automation_api_key());
        save_config(&config)?;
    }
    Ok(config.api_key.unwrap_or_default())
}

#[tauri::command]
pub async fn rotate_automation_api_key() -> Result<String, AppError> {
    let mut config = load_config();
    let new_key = generate_automation_api_key();
    config.api_key = Some(new_key.clone());
    save_config(&config)?;
    Ok(new_key)
}

// ============================================================================
// Podcast HTTP handlers
// ============================================================================

#[derive(Deserialize)]
struct SubscribeRequest {
    feed_url: String,
}

#[derive(Deserialize)]
struct MarkPlayedRequest {
    played: bool,
}

#[derive(Deserialize)]
struct UpdatePositionRequest {
    position: f64,
}

#[derive(Deserialize)]
struct RenameFeedRequest {
    new_title: String,
}

#[derive(Deserialize)]
struct PodcastSearchQuery {
    q: Option<String>,
}

async fn handle_podcast_search(
    Query(params): Query<PodcastSearchQuery>,
) -> Response {
    let q = params.q.unwrap_or_default();
    let q = q.trim();
    if q.is_empty() {
        return (StatusCode::OK, Json(Vec::<PodcastSearchResult>::new())).into_response();
    }

    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
    {
        Ok(c) => c,
        Err(e) => return error_response(StatusCode::INTERNAL_SERVER_ERROR, &format!("HTTP client error: {}", e)),
    };

    let response = match client
        .post("https://apollo.rss.com/search/podcast-index/byterm")
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "q": q }))
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return error_response(StatusCode::BAD_GATEWAY, &format!("Search request failed: {}", e)),
    };

    if !response.status().is_success() {
        return error_response(StatusCode::BAD_GATEWAY, &format!("Search API returned HTTP {}", response.status()));
    }

    match response.json::<PodcastSearchResponse>().await {
        Ok(data) => (StatusCode::OK, Json(data.feeds.into_iter().map(Into::into).collect::<Vec<PodcastSearchResult>>())).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &format!("Failed to parse search response: {}", e)),
    }
}

async fn handle_podcast_subscribe(
    State(state): State<ServerState>,
    Json(payload): Json<SubscribeRequest>,
) -> Response {
    // Check if already subscribed
    if let Ok(Some(existing)) = state.repo.get_podcast_feed_by_url(&payload.feed_url).await {
        let episode_count = state.repo.count_podcast_episodes(&existing.id).await.unwrap_or(0);
        let unplayed_count = state.repo.count_unplayed_podcast_episodes(&existing.id).await.unwrap_or(0);
        return (StatusCode::OK, Json(PodcastFeedResponse {
            feed: existing,
            episode_count,
            unplayed_count,
        })).into_response();
    }

    // Fetch and parse the feed
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent("Incrementum/1.31.0")
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
    {
        Ok(c) => c,
        Err(e) => return error_response(StatusCode::INTERNAL_SERVER_ERROR, &format!("Failed to build HTTP client: {}", e)),
    };

    let response = match client.get(&payload.feed_url).send().await {
        Ok(r) => r,
        Err(e) => return error_response(StatusCode::BAD_GATEWAY, &format!("Failed to fetch podcast feed: {}", e)),
    };

    if !response.status().is_success() {
        return error_response(StatusCode::BAD_GATEWAY, &format!("Failed to fetch podcast feed: HTTP {}", response.status()));
    }

    let xml = match response.text().await {
        Ok(t) => t,
        Err(e) => return error_response(StatusCode::BAD_GATEWAY, &format!("Failed to read feed response: {}", e)),
    };

    let parsed = match parse_podcast_feed(&xml) {
        Ok(p) => p,
        Err(e) => return error_response(StatusCode::UNPROCESSABLE_ENTITY, &format!("Failed to parse podcast feed: {}", e)),
    };

    let feed_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let feed = PodcastFeed {
        id: feed_id.clone(),
        title: parsed.title,
        description: parsed.description,
        image_url: parsed.image_url,
        author: parsed.author,
        language: parsed.language,
        link: parsed.link,
        feed_url: payload.feed_url.clone(),
        last_fetched: Some(now.clone()),
        subscribed_at: now,
        sort_order: 0,
        auto_transcribe: false,
        transcribe_language: None,
    };

    if let Err(e) = state.repo.insert_podcast_feed(&feed).await {
        return error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string());
    }
    if let Err(e) = state.repo.insert_podcast_episodes_bulk(&feed_id, &parsed.episodes).await {
        return error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string());
    }

    let episode_count = parsed.episodes.len() as i64;
    (StatusCode::OK, Json(PodcastFeedResponse {
        feed,
        episode_count,
        unplayed_count: episode_count,
    })).into_response()
}

async fn handle_podcast_rename_feed(
    State(state): State<ServerState>,
    axum::extract::Path(feed_id): axum::extract::Path<String>,
    Json(payload): Json<RenameFeedRequest>,
) -> Response {
    match state.repo.rename_podcast_feed(&feed_id, &payload.new_title).await {
        Ok(()) => (StatusCode::OK, Json(json!({"ok": true}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

async fn handle_podcast_unsubscribe(
    State(state): State<ServerState>,
    axum::extract::Path(feed_id): axum::extract::Path<String>,
) -> Response {
    match state.repo.delete_podcast_feed(&feed_id).await {
        Ok(()) => (StatusCode::OK, Json(json!({"ok": true}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

async fn handle_podcast_list_feeds(
    State(state): State<ServerState>,
) -> Response {
    match state.repo.get_podcast_feeds().await {
        Ok(feeds) => {
            let mut results = Vec::new();
            for feed in feeds {
                let episode_count = state.repo.count_podcast_episodes(&feed.id).await.unwrap_or(0);
                let unplayed_count = state.repo.count_unplayed_podcast_episodes(&feed.id).await.unwrap_or(0);
                results.push(PodcastFeedResponse { feed, episode_count, unplayed_count });
            }
            (StatusCode::OK, Json(results)).into_response()
        }
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

async fn handle_podcast_refresh_feed(
    State(state): State<ServerState>,
    axum::extract::Path(feed_id): axum::extract::Path<String>,
) -> Response {
    let feed = match state.repo.get_podcast_feed(&feed_id).await {
        Ok(Some(f)) => f,
        Ok(None) => return error_response(StatusCode::NOT_FOUND, &format!("Podcast feed {} not found", feed_id)),
        Err(e) => return error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    };

    let feed_url = feed.feed_url.clone();

    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent("Incrementum/1.31.0")
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
    {
        Ok(c) => c,
        Err(e) => return error_response(StatusCode::INTERNAL_SERVER_ERROR, &format!("Failed to build HTTP client: {}", e)),
    };

    let response = match client.get(&feed_url).send().await {
        Ok(r) => r,
        Err(e) => return error_response(StatusCode::BAD_GATEWAY, &format!("Failed to fetch podcast feed: {}", e)),
    };

    if !response.status().is_success() {
        return error_response(StatusCode::BAD_GATEWAY, &format!("Failed to fetch podcast feed: HTTP {}", response.status()));
    }

    let xml = match response.text().await {
        Ok(t) => t,
        Err(e) => return error_response(StatusCode::BAD_GATEWAY, &format!("Failed to read feed response: {}", e)),
    };

    let parsed = match parse_podcast_feed(&xml) {
        Ok(p) => p,
        Err(e) => return error_response(StatusCode::UNPROCESSABLE_ENTITY, &format!("Failed to parse podcast feed: {}", e)),
    };

    let mut updated_feed = feed.clone();
    updated_feed.title = parsed.title;
    updated_feed.description = parsed.description;
    if parsed.image_url.is_some() { updated_feed.image_url = parsed.image_url; }
    if parsed.author.is_some() { updated_feed.author = parsed.author; }
    let now = chrono::Utc::now().to_rfc3339();
    updated_feed.last_fetched = Some(now.clone());

    if let Err(e) = state.repo.update_podcast_feed_metadata(&updated_feed).await {
        return error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string());
    }
    if let Err(e) = state.repo.update_podcast_feed_last_fetched(&feed_id, &now).await {
        return error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string());
    }
    if let Err(e) = state.repo.insert_podcast_episodes_bulk(&feed_id, &parsed.episodes).await {
        return error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string());
    }

    let episode_count = state.repo.count_podcast_episodes(&feed_id).await.unwrap_or(0);
    let unplayed_count = state.repo.count_unplayed_podcast_episodes(&feed_id).await.unwrap_or(0);

    (StatusCode::OK, Json(PodcastFeedResponse {
        feed: updated_feed,
        episode_count,
        unplayed_count,
    })).into_response()
}

async fn handle_podcast_get_episodes(
    State(state): State<ServerState>,
    axum::extract::Path(feed_id): axum::extract::Path<String>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Response {
    let include_played = params.get("include_played").map(|v| v == "true").unwrap_or(true);
    match state.repo.get_podcast_episodes(Some(&feed_id), Some(include_played)).await {
        Ok(episodes) => (StatusCode::OK, Json(episodes)).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

async fn handle_podcast_get_episode_queue(
    State(state): State<ServerState>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Response {
    let include_played = params.get("include_played").map(|v| v == "true").unwrap_or(false);
    // Get episodes across all feeds
    match state.repo.get_podcast_feeds().await {
        Ok(feeds) => {
            let mut all_episodes: Vec<PodcastEpisode> = Vec::new();
            for feed in feeds {
                if let Ok(episodes) = state.repo.get_podcast_episodes(Some(&feed.id), Some(include_played)).await {
                    all_episodes.extend(episodes);
                }
            }
            (StatusCode::OK, Json(all_episodes)).into_response()
        }
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

async fn handle_podcast_mark_played(
    State(state): State<ServerState>,
    axum::extract::Path(episode_id): axum::extract::Path<String>,
    Json(payload): Json<MarkPlayedRequest>,
) -> Response {
    match state.repo.update_episode_played(&episode_id, payload.played).await {
        Ok(()) => (StatusCode::OK, Json(json!({"ok": true}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

async fn handle_podcast_update_position(
    State(state): State<ServerState>,
    axum::extract::Path(episode_id): axum::extract::Path<String>,
    Json(payload): Json<UpdatePositionRequest>,
) -> Response {
    match state.repo.update_episode_position(&episode_id, payload.position).await {
        Ok(()) => (StatusCode::OK, Json(json!({"ok": true}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

async fn handle_podcast_get_position(
    State(state): State<ServerState>,
    axum::extract::Path(episode_id): axum::extract::Path<String>,
) -> Response {
    match state.repo.get_episode_position(&episode_id).await {
        Ok(pos) => (StatusCode::OK, Json(json!({"position": pos}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

#[derive(Deserialize)]
struct TranscribeRequest {
    model: Option<String>,
    language: Option<String>,
}

async fn handle_podcast_transcribe(
    State(state): State<ServerState>,
    axum::extract::Path(episode_id): axum::extract::Path<String>,
    Json(payload): Json<TranscribeRequest>,
) -> Response {
    // Get episode
    let episode = match state.repo.get_podcast_episode_by_id(&episode_id).await {
        Ok(Some(ep)) => ep,
        Ok(None) => return error_response(StatusCode::NOT_FOUND, "Episode not found"),
        Err(e) => return error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    };

    let audio_url = episode.audio_url.clone();
    let model_id = payload.model.unwrap_or_else(|| "base".to_string());
    let lang = payload.language.unwrap_or_else(|| "auto".to_string());
    let ep_id = episode_id.clone();
    let ep_duration = episode.duration.unwrap_or(0);
    let app_handle = state.app_handle.clone();
    let repo = state.repo.clone();

    // Set status to downloading
    if let Err(e) = repo.update_episode_transcript_status(&episode_id, "downloading", None, None).await {
        return error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string());
    }
    let _ = app_handle.emit(
        "podcast://transcription-progress",
        serde_json::json!({ "episodeId": &episode_id, "status": "downloading", "progress": 0 }),
    );

    // Spawn the full transcription pipeline (download + transcribe)
    tokio::spawn(async move {
        use crate::transcription::engine::{TranscriptionEngine, TranscriptSegment};
        use crate::transcription::model_manager::ModelManager;
        use tokio::io::AsyncWriteExt;
        use std::sync::{Arc, Mutex};

        // --- Download audio ---
        let temp_dir = match app_handle.path().app_data_dir() {
            Ok(d) => d.join("temp_transcription"),
            Err(e) => {
                let _ = repo.update_episode_transcript_status(&ep_id, "error", Some(&format!("{}", e)), None).await;
                let _ = app_handle.emit("podcast://transcription-error", serde_json::json!({ "episodeId": &ep_id, "error": e.to_string() }));
                return;
            }
        };
        let _ = std::fs::create_dir_all(&temp_dir);
        let ext = "mp3";
        let temp_file = temp_dir.join(format!("{}_episode.{}", ep_id, ext));

        let download_ok = async {
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(300))
                .build().map_err(|e| format!("HTTP client error: {}", e))?;
            let response = client.get(&audio_url).send().await
                .map_err(|e| format!("Download failed: {}", e))?;
            if !response.status().is_success() {
                return Err(format!("Download failed: HTTP {}", response.status()));
            }
            let total_size = response.content_length().unwrap_or(0);
            let mut downloaded: u64 = 0;
            let mut file = tokio::fs::File::create(&temp_file).await
                .map_err(|e| format!("Failed to create temp file: {}", e))?;
            let mut stream = response.bytes_stream();
            use futures_util::StreamExt;
            while let Some(item) = stream.next().await {
                let chunk = item.map_err(|e| format!("Download stream error: {}", e))?;
                file.write_all(&chunk).await
                    .map_err(|e| format!("Write error: {}", e))?;
                downloaded += chunk.len() as u64;
                if total_size > 0 {
                    let pct = (downloaded as f64 / total_size as f64) * 30.0;
                    let _ = app_handle.emit("podcast://transcription-progress", serde_json::json!({
                        "episodeId": &ep_id, "status": "downloading", "progress": pct as i32
                    }));
                }
            }
            file.flush().await
                .map_err(|e| format!("Flush error: {}", e))?;
            Ok::<(), String>(())
        }.await;

        if let Err(e) = download_ok {
            let _ = std::fs::remove_file(&temp_file);
            let _ = repo.update_episode_transcript_status(&ep_id, "error", Some(&e), None).await;
            let _ = app_handle.emit("podcast://transcription-error", serde_json::json!({ "episodeId": &ep_id, "error": e }));
            return;
        }

        // --- Transcribe ---
        let _ = repo.update_episode_transcript_status(&ep_id, "transcribing", None, None).await;
        let _ = app_handle.emit("podcast://transcription-progress", serde_json::json!({
            "episodeId": &ep_id, "status": "transcribing", "progress": 30
        }));

        let model_manager = match ModelManager::new(&app_handle) {
            Ok(m) => m,
            Err(e) => {
                let _ = std::fs::remove_file(&temp_file);
                let _ = repo.update_episode_transcript_status(&ep_id, "error", Some(&format!("{}", e)), None).await;
                let _ = app_handle.emit("podcast://transcription-error", serde_json::json!({ "episodeId": &ep_id, "error": e.to_string() }));
                return;
            }
        };

        let mut selected_model = model_id;
        if !model_manager.is_model_installed(&selected_model) {
            if let Some(fallback) = model_manager.list_profiles().into_iter().find(|p| model_manager.is_model_installed(&p.id)) {
                selected_model = fallback.id;
            } else {
                let _ = std::fs::remove_file(&temp_file);
                let err_msg = "No Whisper model installed. Download one in Settings > Audio Transcription.";
                let _ = repo.update_episode_transcript_status(&ep_id, "error", Some(err_msg), None).await;
                let _ = app_handle.emit("podcast://transcription-error", serde_json::json!({ "episodeId": &ep_id, "error": err_msg }));
                return;
            }
        }

        let engine = TranscriptionEngine::new(app_handle.clone());
        let segments: Arc<Mutex<Vec<TranscriptSegment>>> = Arc::new(Mutex::new(Vec::new()));
        let segments_clone = segments.clone();
        let app_clone = app_handle.clone();
        let ep_id_clone = ep_id.clone();

        let transcribe_result = async {
            let prepared = engine.prepare_audio(std::path::Path::new(&temp_file)).await
                .map_err(|e| format!("Audio preparation failed: {}", e))?;
            let model_path = model_manager.get_model_path(&selected_model);
            engine.transcribe(
                &prepared, &model_path, &lang,
                move |seg| {
                    if let Ok(mut guard) = segments_clone.lock() {
                        guard.push(seg);
                    }
                },
                Some(Box::new(move |p: i32| {
                    let mapped = 30 + ((p as f64 / 100.0) * 70.0) as i32;
                    let _ = app_clone.emit("podcast://transcription-progress", serde_json::json!({
                        "episodeId": &ep_id_clone, "status": "transcribing", "progress": mapped
                    }));
                })),
            ).await.map_err(|e| format!("Transcription failed: {}", e))?;
            Ok::<(), String>(())
        }.await;

        let _ = std::fs::remove_file(&temp_file);

        match transcribe_result {
            Ok(()) => {
                let mut segs = {
                    let mut guard = segments.lock().unwrap_or_else(|e| e.into_inner());
                    guard.sort_by(|a, b| a.start_ms.cmp(&b.start_ms));
                    guard.clone()
                };
                let full_text: String = segs.iter().map(|s| s.text.trim()).collect::<Vec<&str>>().join(" ");
                let _ = repo.update_episode_transcript_status(&ep_id, "done", None, Some(&full_text)).await;
                let _ = app_handle.emit("podcast://transcription-complete", serde_json::json!({
                    "episodeId": &ep_id, "segmentCount": segs.len(), "duration": ep_duration
                }));
            }
            Err(e) => {
                let _ = repo.update_episode_transcript_status(&ep_id, "error", Some(&e), None).await;
                let _ = app_handle.emit("podcast://transcription-error", serde_json::json!({ "episodeId": &ep_id, "error": e }));
            }
        }
    });

    (StatusCode::OK, Json(json!({"ok": true}))).into_response()
}

async fn handle_podcast_get_transcript(
    State(state): State<ServerState>,
    axum::extract::Path(episode_id): axum::extract::Path<String>,
) -> Response {
    match state.repo.get_podcast_episode_by_id(&episode_id).await {
        Ok(Some(episode)) => {
            (StatusCode::OK, Json(json!({
                "text": episode.transcript_text,
                "segments": [],
                "status": episode.transcript_status,
            }))).into_response()
        }
        Ok(None) => error_response(StatusCode::NOT_FOUND, "Episode not found"),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

async fn handle_podcast_cancel_transcription(
    State(state): State<ServerState>,
    axum::extract::Path(episode_id): axum::extract::Path<String>,
) -> Response {
    // Reset status to none
    match state.repo.update_episode_transcript_status(&episode_id, "none", None, None).await {
        Ok(()) => (StatusCode::OK, Json(json!({"ok": true}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

#[derive(Deserialize)]
struct AutoTranscribeRequest {
    enabled: bool,
    language: Option<String>,
}

async fn handle_podcast_set_auto_transcribe(
    State(state): State<ServerState>,
    axum::extract::Path(feed_id): axum::extract::Path<String>,
    Json(payload): Json<AutoTranscribeRequest>,
) -> Response {
    match state.repo.set_feed_auto_transcribe(&feed_id, payload.enabled, payload.language.as_deref()).await {
        Ok(()) => (StatusCode::OK, Json(json!({"ok": true}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// Initialize browser sync server (called on app startup)
pub async fn initialize_if_enabled(repo: Arc<Repository>, app_handle: AppHandle, ai_config: Option<AIConfig>) -> Result<(), AppError> {
    let config = load_config();
    if config.auto_start {
        info!("Auto-starting browser extension server on port {}", config.port);
        if let Err(err) = start_server(config, repo, app_handle, ai_config).await {
            warn!("Browser extension server auto-start skipped: {}", err);
        }
    }
    Ok(())
}
