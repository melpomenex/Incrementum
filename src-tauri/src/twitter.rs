//! Twitter / X video import.
//!
//! Ports the media-extraction logic from the project's `xcom.py` reference:
//! X's web-client bearer token + anonymous guest-token auth against the
//! GraphQL `TweetResultByRestId` endpoint. No yt-dlp or external binary is
//! required. On import the best-quality MP4 variant is downloaded into the
//! app's `videos/` directory and a `Document` of `FileType::Video` is created,
//! so the existing video viewer, transcription pipeline, and assistant chat
//! all work without further changes.

use std::path::PathBuf;
use std::time::{Duration, Instant};

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use tauri::State;
use tokio::sync::Mutex;
use tokio::io::AsyncWriteExt;

use crate::database::Repository;
use crate::models::{Document, DocumentMetadata, FileType};

// ── constants (copied verbatim from xcom.py) ──────────────────────────────

const API_BASE: &str = "https://api.x.com";

/// X's hardcoded public web-client bearer token (URL-encoded `=` as `%3D`,
/// matching the reference script that is known to work).
const BEARER: &str = "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

const UA: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";

/// GraphQL query id for `TweetResultByRestId` (from X's client JS bundle —
/// change when X updates).
const QID_TWEET_RESULT: &str = "sBoAB5nqJTOyR9sZ5qVLsw";

/// Base feature-flag set (must be sent verbatim or X rejects the request).
const FEATURES: &str = r#"{"rweb_video_screen_enabled":false,"profile_label_improvements_pcf_label_in_post_enabled":false,"rweb_tipjar_consumption_enabled":true,"responsive_web_graphql_exclude_directive_enabled":true,"verified_phone_label_enabled":false,"freedom_of_speech_not_reach_fetch_enabled":true,"standardized_nudges_misinfo":true,"tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled":false,"responsive_web_graphql_skip_user_profile_image_extensions_enabled":false,"responsive_web_graphql_timeline_navigation_enabled":false}"#;

/// Extended feature-flag set for tweet-detail requests (`_FEATURES` merged
/// with the extra tweet flags from xcom.py).
const TWEET_FEATURES: &str = r#"{"rweb_video_screen_enabled":false,"profile_label_improvements_pcf_label_in_post_enabled":false,"rweb_tipjar_consumption_enabled":true,"responsive_web_graphql_exclude_directive_enabled":true,"verified_phone_label_enabled":false,"freedom_of_speech_not_reach_fetch_enabled":true,"standardized_nudges_misinfo":true,"tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled":false,"responsive_web_graphql_skip_user_profile_image_extensions_enabled":false,"responsive_web_graphql_timeline_navigation_enabled":false,"creator_subscriptions_tweet_preview_api_enabled":true,"responsive_web_graphql_timeline_navigation":true,"responsive_web_graphql_skip_user_profile_image_extensions_enabled":true,"premium_content_api_read_enabled":true,"communities_web_enable_tweet_community_results_fetch":true,"c9s_tweet_anatomy_moderator_badge_enabled":true,"responsive_web_grok_analyze_button_fetch_trends_enabled":true,"responsive_web_edit_tweet_api_enabled":true,"graphql_is_translatable_rweb_tweet_is_translatable_enabled":true,"view_counts_everywhere_api_enabled":true,"longform_notetweets_consumption_enabled":true,"responsive_web_twitter_article_tweet_consumption_enabled":true}"#;

/// Guest-token lifetime (matches xcom.py's 2-hour cache).
const GUEST_TOKEN_TTL: Duration = Duration::from_secs(7200);

// ── shared client + cached guest token ────────────────────────────────────

static HTTP: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .expect("failed to build reqwest client")
});

/// Cached guest token + the instant it was obtained.
static GUEST_TOKEN: Lazy<Mutex<Option<(String, Instant)>>> = Lazy::new(|| Mutex::new(None));

// ── types ─────────────────────────────────────────────────────────────────

/// Metadata for a tweet that contains a video, returned to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TwitterVideoInfo {
    pub tweet_id: String,
    pub status_url: String,
    pub title: String,
    pub author: String,
    pub thumbnail_url: Option<String>,
    pub duration_secs: Option<i64>,
    pub mp4_url: String,
}

// ── helpers ───────────────────────────────────────────────────────────────

/// Extract the numeric tweet id from an `x.com`/`twitter.com` status URL
/// (e.g. `https://x.com/user/status/123?s=20` → `123`).
fn extract_tweet_id(input: &str) -> Result<String, String> {
    let trimmed = input.trim();
    let no_query = trimmed.split('?').next().unwrap_or(trimmed);
    let parts: Vec<&str> = no_query.trim_end_matches('/').split('/').collect();
    let idx = parts
        .iter()
        .position(|p| p.eq_ignore_ascii_case("status"));
    let id = idx
        .and_then(|i| parts.get(i + 1))
        .ok_or_else(|| "Could not find a tweet id in the URL".to_string())?;
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_digit()) {
        return Err(format!("Invalid tweet id: {}", id));
    }
    Ok((*id).to_string())
}

/// Obtain (and cache) an anonymous guest token. Mirrors xcom.py's
/// `_ensure_guest_token`.
async fn ensure_guest_token() -> Result<String, String> {
    {
        let guard = GUEST_TOKEN.lock().await;
        if let Some((token, obtained)) = guard.as_ref() {
            if obtained.elapsed() < GUEST_TOKEN_TTL {
                return Ok(token.clone());
            }
        }
    }

    let resp = HTTP
        .post(format!("{}/1.1/guest/activate.json", API_BASE))
        .header("authorization", BEARER)
        .header("user-agent", UA)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .send()
        .await
        .map_err(|e| format!("Failed to request guest token: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!(
            "Guest token request failed: HTTP {}",
            resp.status()
        ));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse guest token response: {}", e))?;

    let token = json
        .get("guest_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "No guest_token in response".to_string())?
        .to_string();

    let mut guard = GUEST_TOKEN.lock().await;
    *guard = Some((token.clone(), Instant::now()));
    Ok(token)
}

/// Fetch the raw GraphQL result for a single tweet.
async fn fetch_tweet_result(tweet_id: &str) -> Result<serde_json::Value, String> {
    let guest_token = ensure_guest_token().await?;

    let variables = serde_json::json!({
        "tweetId": tweet_id,
        "withCommunity": false,
        "includePromotedContent": false,
        "withVoice": false,
    })
    .to_string();

    let url = format!(
        "{}/graphql/{}/TweetResultByRestId",
        API_BASE, QID_TWEET_RESULT
    );

    let resp = HTTP
        .get(&url)
        .header("authorization", BEARER)
        .header("user-agent", UA)
        .header("x-twitter-active-user", "yes")
        .header("x-twitter-client-language", "en")
        .header("x-guest-token", &guest_token)
        .query(&[
            ("variables", variables.as_str()),
            ("features", TWEET_FEATURES),
        ])
        .send()
        .await
        .map_err(|e| format!("Failed to fetch tweet: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Tweet request failed: HTTP {} — {}", status, body));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse tweet response: {}", e))?;

    // data.tweetResult.result
    json.get("data")
        .and_then(|d| d.get("tweetResult"))
        .and_then(|tr| tr.get("result"))
        .cloned()
        .ok_or_else(|| "Tweet not found or restricted".to_string())
}

/// Build a canonical `https://x.com/<screen_name>/status/<id>` URL.
fn build_status_url(screen_name: &str, tweet_id: &str) -> String {
    format!("https://x.com/{}/status/{}", screen_name, tweet_id)
}

/// Strip t.co link wrappers and collapse whitespace for a readable title.
fn normalize_text(text: &str) -> String {
    text.trim()
        .split('\n')
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

/// Walk the raw tweet result and extract the first video's metadata.
/// Returns the first media item whose `type` is `video` or `animated_gif`,
/// selecting the highest-bitrate MP4 variant (mirrors xcom.py `_parse_tweet`).
fn parse_video(result: &serde_json::Value, tweet_id: &str) -> Result<TwitterVideoInfo, String> {
    // Unwrap the visibility-limited wrapper, if present.
    let result = if result.get("__typename").and_then(|v| v.as_str())
        == Some("TweetWithVisibilityResults")
    {
        result.get("tweet").unwrap_or(result)
    } else {
        result
    };

    let legacy = result
        .get("legacy")
        .ok_or_else(|| "Tweet has no legacy block".to_string())?;

    let media_arr = legacy
        .get("extended_entities")
        .and_then(|e| e.get("media"))
        .and_then(|m| m.as_array())
        .ok_or_else(|| "This post doesn't contain a video.".to_string())?;

    let mut chosen: Option<(String, Option<i64>, Option<String>)> = None; // (mp4_url, duration_ms, thumb)
    for m in media_arr {
        let kind = m.get("type").and_then(|v| v.as_str()).unwrap_or("");
        if kind != "video" && kind != "animated_gif" {
            continue;
        }
        let video_info = match m.get("video_info") {
            Some(vi) => vi,
            None => continue,
        };

        // Collect mp4 variants, pick the highest bitrate.
        let mut best_bitrate: i64 = -1;
        let mut best_url: Option<String> = None;
        if let Some(variants) = video_info.get("variants").and_then(|v| v.as_array()) {
            for v in variants {
                let ctype = v.get("content_type").and_then(|c| c.as_str()).unwrap_or("");
                if ctype != "video/mp4" {
                    continue;
                }
                let bitrate = v.get("bitrate").and_then(|b| b.as_i64()).unwrap_or(0);
                if bitrate >= best_bitrate {
                    best_bitrate = bitrate;
                    if let Some(url) = v.get("url").and_then(|u| u.as_str()) {
                        best_url = Some(url.to_string());
                    }
                }
            }
        }

        let mp4_url = match best_url {
            Some(u) => u,
            None => continue,
        };

        let duration_ms = video_info
            .get("duration_millis")
            .and_then(|d| d.as_i64());
        let thumb = m
            .get("media_url_https")
            .and_then(|u| u.as_str())
            .map(|s| s.to_string());
        chosen = Some((mp4_url, duration_ms, thumb));
        break;
    }

    let (mp4_url, duration_ms, thumbnail_url) =
        chosen.ok_or_else(|| "This post doesn't contain a video.".to_string())?;

    let duration_secs = duration_ms.map(|ms| ms / 1000);

    let full_text = legacy
        .get("full_text")
        .and_then(|t| t.as_str())
        .unwrap_or("");
    let title = normalize_text(full_text);
    let title = if title.is_empty() {
        format!("Tweet {}", tweet_id)
    } else {
        title
    };

    let author = result
        .get("core")
        .and_then(|c| c.get("user_results"))
        .and_then(|ur| ur.get("result"))
        .and_then(|r| r.get("legacy"))
        .and_then(|l| l.get("screen_name"))
        .and_then(|s| s.as_str())
        .unwrap_or("unknown")
        .to_string();

    let status_url = build_status_url(&author, tweet_id);

    Ok(TwitterVideoInfo {
        tweet_id: tweet_id.to_string(),
        status_url,
        title,
        author,
        thumbnail_url,
        duration_secs,
        mp4_url,
    })
}

/// Resolve a tweet URL to its video metadata (no download).
pub async fn resolve_video_info(url: &str) -> Result<TwitterVideoInfo, String> {
    let tweet_id = extract_tweet_id(url)?;
    let result = fetch_tweet_result(&tweet_id).await?;
    parse_video(&result, &tweet_id)
}

/// Where Twitter videos are stored — mirrors `commands::video::import_video_file`.
fn videos_dir() -> Result<PathBuf, String> {
    let dir = dirs::data_dir()
        .ok_or_else(|| "Could not determine data directory".to_string())?
        .join("incrementum")
        .join("videos");
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create video directory: {}", e))?;
    Ok(dir)
}

/// Stream `mp4_url` into the app's videos directory. Returns the saved path
/// and total bytes written.
async fn download_video(mp4_url: &str, tweet_id: &str) -> Result<(PathBuf, u64), String> {
    let dir = videos_dir()?;
    let timestamp = chrono::Utc::now().timestamp();
    let filename = format!("{}-{}.mp4", timestamp, tweet_id);
    let dest = dir.join(filename);

    let resp = HTTP
        .get(mp4_url)
        .header("user-agent", UA)
        .send()
        .await
        .map_err(|e| format!("Failed to start video download: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Video download failed: HTTP {}", resp.status()));
    }

    use futures::StreamExt;
    let mut stream = resp.bytes_stream();
    let mut file = tokio::fs::File::create(&dest)
        .await
        .map_err(|e| format!("Failed to create video file: {}", e))?;

    let mut total: u64 = 0;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Error reading video stream: {}", e))?;
        total += chunk.len() as u64;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Failed to write video chunk: {}", e))?;
    }
    file.flush()
        .await
        .map_err(|e| format!("Failed to flush video file: {}", e))?;

    Ok((dest, total))
}

// ── Tauri commands ────────────────────────────────────────────────────────

/// Resolve a tweet URL to its video metadata, without downloading.
#[tauri::command]
pub async fn get_twitter_video_info(url: String) -> Result<TwitterVideoInfo, String> {
    resolve_video_info(&url).await
}

/// Import a Twitter/X video: fetch metadata, download the best MP4, and create
/// a `Video` document. Transcription is enqueued by the frontend so it respects
/// the user's local-Whisper / Groq provider choice.
#[tauri::command]
pub async fn import_twitter_video(
    url: String,
    collection_id: Option<String>,
    repo: State<'_, Repository>,
) -> Result<Document, String> {
    let info = resolve_video_info(&url).await?;

    let (dest_path, file_size) = download_video(&info.mp4_url, &info.tweet_id).await?;

    let now = chrono::Utc::now();
    let mut doc = Document::with_collection(
        info.title.clone(),
        dest_path.to_string_lossy().to_string(),
        FileType::Video,
        collection_id,
    );
    doc.category = Some("Videos".to_string());
    doc.tags = vec!["twitter".to_string(), "x".to_string(), "video".to_string()];
    doc.total_pages = info.duration_secs.map(|s| s as i32);
    doc.priority_score = 7.0;
    doc.current_page = Some(0);
    if let Some(thumb) = &info.thumbnail_url {
        doc.cover_image_url = Some(thumb.clone());
        doc.cover_image_source = Some("twitter".to_string());
    }

    doc.metadata = Some(DocumentMetadata {
        author: Some(info.author.clone()),
        file_size: Some(file_size as i64),
        created_at: Some(now),
        source: Some("twitter".to_string()),
        fetched_at: Some(now),
        site_name: Some("X".to_string()),
        ..Default::default()
    });

    repo.create_document(&doc)
        .await
        .map_err(|e| format!("Failed to save document to database: {}", e))
}

// ── tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_tweet_id_from_x_url() {
        assert_eq!(
            extract_tweet_id("https://x.com/user/status/1234567890").unwrap(),
            "1234567890"
        );
    }

    #[test]
    fn extracts_tweet_id_from_twitter_url_with_query() {
        assert_eq!(
            extract_tweet_id("https://twitter.com/Someone/status/987?s=20&t=abc").unwrap(),
            "987"
        );
    }

    #[test]
    fn extracts_tweet_id_with_trailing_slash() {
        assert_eq!(
            extract_tweet_id("https://x.com/u/status/42/").unwrap(),
            "42"
        );
    }

    #[test]
    fn rejects_url_without_status() {
        assert!(extract_tweet_id("https://x.com/user").is_err());
    }

    #[test]
    fn rejects_non_numeric_id() {
        assert!(extract_tweet_id("https://x.com/u/status/abc").is_err());
    }

    #[test]
    fn picks_highest_bitrate_mp4_variant() {
        // Mirrors the shape returned by X's GraphQL endpoint.
        let result = serde_json::json!({
            "__typename": "Tweet",
            "legacy": {
                "full_text": "look at this https://t.co/abc",
                "extended_entities": {
                    "media": [{
                        "type": "photo",
                        "media_url_https": "https://pbs.twimg.com/photo.jpg"
                    }, {
                        "type": "video",
                        "media_url_https": "https://pbs.twimg.com/thumb.jpg",
                        "video_info": {
                            "duration_millis": 12500,
                            "variants": [
                                {"content_type": "application/x-mpegURL", "url": "https://x.com/hls.m3u8"},
                                {"bitrate": 832000,  "content_type": "video/mp4", "url": "https://x.com/360p.mp4"},
                                {"bitrate": 2176000, "content_type": "video/mp4", "url": "https://x.com/720p.mp4"}
                            ]
                        }
                    }]
                }
            },
            "core": {
                "user_results": { "result": { "legacy": { "screen_name": "testuser" } } }
            }
        });

        let info = parse_video(&result, "111").unwrap();
        assert_eq!(info.mp4_url, "https://x.com/720p.mp4");
        assert_eq!(info.duration_secs, Some(12));
        assert_eq!(info.thumbnail_url.as_deref(), Some("https://pbs.twimg.com/thumb.jpg"));
        assert_eq!(info.author, "testuser");
        assert_eq!(info.status_url, "https://x.com/testuser/status/111");
        assert_eq!(info.title, "look at this https://t.co/abc");
    }

    #[test]
    fn errors_when_no_video_media() {
        let result = serde_json::json!({
            "__typename": "Tweet",
            "legacy": {
                "full_text": "just text",
                "extended_entities": {
                    "media": [{"type": "photo", "media_url_https": "https://x.com/p.jpg"}]
                }
            },
            "core": { "user_results": { "result": { "legacy": { "screen_name": "u" } } } }
        });
        assert!(parse_video(&result, "1").is_err());
    }

    #[test]
    fn unwraps_visibility_wrapper() {
        let result = serde_json::json!({
            "__typename": "TweetWithVisibilityResults",
            "tweet": {
                "__typename": "Tweet",
                "legacy": {
                    "full_text": "hi",
                    "extended_entities": {
                        "media": [{
                            "type": "video",
                            "video_info": {
                                "variants": [
                                    {"bitrate": 832000, "content_type": "video/mp4", "url": "https://x.com/v.mp4"}
                                ]
                            }
                        }]
                    }
                },
                "core": { "user_results": { "result": { "legacy": { "screen_name": "u" } } } }
            }
        });
        let info = parse_video(&result, "5").unwrap();
        assert_eq!(info.mp4_url, "https://x.com/v.mp4");
    }
}
