//! Substack public API proxy commands
//!
//! Proxies requests to Substack's public JSON API endpoints from the Rust
//! backend to avoid CORS issues in the Tauri webview.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;
use crate::error::Result;

/// Shared HTTP client for Substack API requests (reuses the app's reqwest config).
fn substack_client() -> reqwest::blocking::Client {
    reqwest::blocking::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .expect("Failed to build Substack HTTP client")
}

/// Proxy: search Substack publications, posts, and profiles.
#[tauri::command]
pub fn substack_search(
    query: String,
    cursor: Option<String>,
) -> Result<Value> {
    let mut url = format!(
        "https://substack.com/api/v1/top/search?query={}",
        urlencoding::encode(&query)
    );
    if let Some(c) = &cursor {
        url.push_str(&format!("&cursor={}", urlencoding::encode(c)));
    }

    let resp = substack_client()
        .get(&url)
        .send()
        .map_err(|e| crate::error::IncrementumError::IntegrationError(
            format!("Substack search request failed: {e}")
        ))?;

    let status = resp.status();
    if !status.is_success() {
        return Err(crate::error::IncrementumError::IntegrationError(
            format!("Substack search returned {status}")
        ));
    }

    let json: Value = resp.json().map_err(|e| {
        crate::error::IncrementumError::IntegrationError(
            format!("Failed to parse Substack search response: {e}")
        )
    })?;

    Ok(json)
}

/// Proxy: fetch all Substack content categories.
#[tauri::command]
pub fn substack_categories() -> Result<Value> {
    let url = "https://substack.com/api/v1/categories";

    let resp = substack_client()
        .get(url)
        .send()
        .map_err(|e| crate::error::IncrementumError::IntegrationError(
            format!("Substack categories request failed: {e}")
        ))?;

    let status = resp.status();
    if !status.is_success() {
        return Err(crate::error::IncrementumError::IntegrationError(
            format!("Substack categories returned {status}")
        ));
    }

    let json: Value = resp.json().map_err(|e| {
        crate::error::IncrementumError::IntegrationError(
            format!("Failed to parse Substack categories response: {e}")
        )
    })?;

    Ok(json)
}

/// Proxy: fetch publication homepage data (top posts, new posts, etc.).
#[tauri::command]
pub fn substack_pub_homepage(subdomain: String) -> Result<Value> {
    let url = format!(
        "https://{subdomain}.substack.com/api/v1/homepage_data"
    );

    let resp = substack_client()
        .get(&url)
        .send()
        .map_err(|e| crate::error::IncrementumError::IntegrationError(
            format!("Substack pub homepage request failed: {e}")
        ))?;

    let status = resp.status();
    if !status.is_success() {
        return Err(crate::error::IncrementumError::IntegrationError(
            format!("Substack pub homepage returned {status}")
        ));
    }

    let json: Value = resp.json().map_err(|e| {
        crate::error::IncrementumError::IntegrationError(
            format!("Failed to parse Substack pub homepage response: {e}")
        )
    })?;

    Ok(json)
}

/// Proxy: fetch reader feed for a specific category.
#[tauri::command]
pub fn substack_category_feed(
    category_id: String,
    limit: Option<i64>,
    cursor: Option<String>,
) -> Result<Value> {
    let mut url = format!(
        "https://substack.com/api/v1/reader/feed?tab={category_id}&type=category"
    );
    if let Some(lim) = limit {
        url.push_str(&format!("&limit={lim}"));
    }
    if let Some(c) = &cursor {
        url.push_str(&format!("&cursor={}", urlencoding::encode(c)));
    }

    let resp = substack_client()
        .get(&url)
        .send()
        .map_err(|e| crate::error::IncrementumError::IntegrationError(
            format!("Substack category feed request failed: {e}")
        ))?;

    let status = resp.status();
    if !status.is_success() {
        return Err(crate::error::IncrementumError::IntegrationError(
            format!("Substack category feed returned {status}")
        ));
    }

    let json: Value = resp.json().map_err(|e| {
        crate::error::IncrementumError::IntegrationError(
            format!("Failed to parse Substack category feed response: {e}")
        )
    })?;

    Ok(json)
}
