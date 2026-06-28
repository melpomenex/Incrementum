//! Lightweight local HTTP server for streaming large media files on Android.
//!
//! On Android, the Tauri asset protocol (`asset://localhost/…`) buffers the
//! entire file into a `WebResourceResponse` body, which causes an
//! `OutOfMemoryError` for files larger than ~200 MB (e.g. audiobooks).
//!
//! This module spins up a tiny axum HTTP server on `127.0.0.1:<port>` that
//! serves files with proper `Range` request support so the WebView's `<audio>`
//! element only fetches the bytes it actually needs.

use axum::{
    extract::Query,
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    routing::get,
    Router,
};
use std::io::SeekFrom;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU16, Ordering};
use tokio::io::{AsyncReadExt, AsyncSeekExt};

/// The port the media server is listening on. 0 = not started.
static MEDIA_SERVER_PORT: AtomicU16 = AtomicU16::new(0);

/// Maximum chunk size served per range request (4 MB).
const MAX_CHUNK: u64 = 4 * 1024 * 1024;

/// Start the media streaming server (idempotent – second call is a no-op).
/// Returns the port it is listening on.
pub async fn start() -> u16 {
    let existing = MEDIA_SERVER_PORT.load(Ordering::SeqCst);
    if existing != 0 {
        return existing;
    }

    // Bind to any free port on loopback.
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("media_server: failed to bind loopback");
    let port = listener.local_addr().unwrap().port();
    MEDIA_SERVER_PORT.store(port, Ordering::SeqCst);

    let app = Router::new().route("/stream", get(stream_handler));

    tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            eprintln!("media_server: axum error: {e}");
        }
    });

    eprintln!("media_server: listening on 127.0.0.1:{port}");
    port
}

/// Return the port the media server is on (0 if not started).
pub fn port() -> u16 {
    MEDIA_SERVER_PORT.load(Ordering::SeqCst)
}

#[derive(serde::Deserialize)]
struct StreamParams {
    path: String,
}

/// The actual handler. Supports:
/// - Full responses (no Range header)  → 200 with capped body
/// - Single range requests             → 206 Partial Content
async fn stream_handler(
    Query(params): Query<StreamParams>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let file_path = PathBuf::from(&params.path);

    // ── open file ──────────────────────────────────────────────────────
    let file = match tokio::fs::File::open(&file_path).await {
        Ok(f) => f,
        Err(_) => {
            return (StatusCode::NOT_FOUND, "file not found").into_response();
        }
    };

    let metadata = match file.metadata().await {
        Ok(m) => m,
        Err(_) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, "cannot stat file").into_response();
        }
    };

    let total = metadata.len();
    let ext = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let content_type = match ext.as_str() {
        "mp3" => "audio/mpeg",
        "m4a" | "m4b" => "audio/mp4",
        "ogg" | "oga" => "audio/ogg",
        "opus" => "audio/opus",
        "flac" => "audio/flac",
        "wav" => "audio/wav",
        "aac" => "audio/aac",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        _ => "application/octet-stream",
    };

    // ── parse Range header ─────────────────────────────────────────────
    if let Some(range_hdr) = headers.get(header::RANGE).and_then(|v| v.to_str().ok()) {
        if let Some(range) = parse_range(range_hdr, total) {
            let (start, mut end) = range;
            // Cap the chunk size to avoid large allocations.
            if end - start + 1 > MAX_CHUNK {
                end = start + MAX_CHUNK - 1;
            }
            let length = end - start + 1;

            let mut file = file;
            if let Err(_) = file.seek(SeekFrom::Start(start)).await {
                return (StatusCode::INTERNAL_SERVER_ERROR, "seek failed").into_response();
            }

            let mut buf = vec![0u8; length as usize];
            if let Err(_) = file.read_exact(&mut buf).await {
                return (StatusCode::INTERNAL_SERVER_ERROR, "read failed").into_response();
            }

            return (
                StatusCode::PARTIAL_CONTENT,
                [
                    (header::CONTENT_TYPE, content_type.to_string()),
                    (header::ACCEPT_RANGES, "bytes".to_string()),
                    (
                        header::CONTENT_RANGE,
                        format!("bytes {start}-{end}/{total}"),
                    ),
                    (header::CONTENT_LENGTH, length.to_string()),
                    (header::ACCESS_CONTROL_ALLOW_ORIGIN, "*".to_string()),
                ],
                buf,
            )
                .into_response();
        }
    }

    // ── no Range → return up to MAX_CHUNK from the start ───────────────
    let serve_len = total.min(MAX_CHUNK);
    let mut buf = vec![0u8; serve_len as usize];
    let mut file = file;
    let _ = file.read_exact(&mut buf).await;

    (
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, content_type.to_string()),
            (header::ACCEPT_RANGES, "bytes".to_string()),
            (header::CONTENT_LENGTH, total.to_string()),
            (header::ACCESS_CONTROL_ALLOW_ORIGIN, "*".to_string()),
        ],
        buf,
    )
        .into_response()
}

/// Parse a simple `bytes=START-END` range header.
fn parse_range(header: &str, total: u64) -> Option<(u64, u64)> {
    let header = header.trim();
    if !header.starts_with("bytes=") {
        return None;
    }
    let range_spec = &header[6..];
    // Only handle a single range (not multi-range).
    let parts: Vec<&str> = range_spec.splitn(2, '-').collect();
    if parts.len() != 2 {
        return None;
    }

    let start: u64;
    let end: u64;

    if parts[0].is_empty() {
        // Suffix range: bytes=-500  →  last 500 bytes
        let suffix: u64 = parts[1].parse().ok()?;
        start = total.saturating_sub(suffix);
        end = total - 1;
    } else {
        start = parts[0].parse().ok()?;
        if parts[1].is_empty() {
            // Open-ended: bytes=1000-
            end = total - 1;
        } else {
            end = parts[1].parse().ok()?;
        }
    }

    if start > end || start >= total {
        return None;
    }

    Some((start, end.min(total - 1)))
}

// ── Tauri command ──────────────────────────────────────────────────────

/// Return an `http://127.0.0.1:<port>/stream?path=<encoded>` URL for the
/// given file path. Starts the media server on first call.
#[tauri::command]
pub async fn get_media_stream_url(file_path: String) -> Result<String, String> {
    let port = start().await;
    let encoded = urlencoding::encode(&file_path);
    Ok(format!("http://127.0.0.1:{port}/stream?path={encoded}"))
}
