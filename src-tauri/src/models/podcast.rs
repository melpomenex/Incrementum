//! Podcast data models

use serde::{Deserialize, Serialize};

/// A subscribed podcast feed
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PodcastFeed {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub author: Option<String>,
    pub language: Option<String>,
    pub link: Option<String>,
    pub feed_url: String,
    pub last_fetched: Option<String>,
    pub subscribed_at: String,
    pub sort_order: i32,
    pub auto_transcribe: bool,
    pub transcribe_language: Option<String>,
}

/// Response type for podcast feed with episode count
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PodcastFeedResponse {
    #[serde(flatten)]
    pub feed: PodcastFeed,
    pub episode_count: i64,
    pub unplayed_count: i64,
}

/// A podcast episode
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PodcastEpisode {
    pub id: String,
    pub feed_id: String,
    pub guid: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub published_date: Option<String>,
    pub duration: Option<i64>,
    pub audio_url: String,
    pub audio_type: Option<String>,
    pub file_size: Option<i64>,
    pub image_url: Option<String>,
    pub link: Option<String>,
    pub played: bool,
    pub playback_position: f64,
    pub date_added: String,
    pub transcript_text: Option<String>,
    pub transcript_status: String,
    pub transcript_error: Option<String>,
    pub transcribed_at: Option<String>,
}

/// Parsed podcast feed from RSS XML (intermediate struct before DB insert)
#[derive(Debug, Clone)]
pub struct ParsedPodcastFeed {
    pub title: String,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub author: Option<String>,
    pub language: Option<String>,
    pub link: Option<String>,
    pub episodes: Vec<ParsedPodcastEpisode>,
}

/// Parsed podcast episode from RSS XML (intermediate struct before DB insert)
#[derive(Debug, Clone)]
pub struct ParsedPodcastEpisode {
    pub guid: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub published_date: Option<String>,
    pub duration: Option<i64>,
    pub audio_url: String,
    pub audio_type: Option<String>,
    pub file_size: Option<i64>,
    pub image_url: Option<String>,
    pub link: Option<String>,
}
