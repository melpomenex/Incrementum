//! Podcast subscription commands

use tauri::State;
use crate::database::Repository;
use crate::error::{IncrementumError, Result};
use crate::models::podcast::{PodcastFeed, PodcastFeedResponse, PodcastEpisode, ParsedPodcastFeed};
use crate::podcast::parser::parse_podcast_feed;
use chrono::Utc;

/// Subscribe to a podcast feed
#[tauri::command]
pub async fn subscribe_podcast(feed_url: String, repo: State<'_, Repository>) -> Result<PodcastFeedResponse> {
    // Check if already subscribed
    if let Some(existing) = repo.get_podcast_feed_by_url(&feed_url).await? {
        let episodes = repo.get_podcast_episodes(&existing.id, Some(true)).await?;
        let episode_count = episodes.len() as i64;
        let unplayed_count = episodes.iter().filter(|e| !e.played).count() as i64;
        return Ok(PodcastFeedResponse {
            feed: existing,
            episode_count,
            unplayed_count,
        });
    }

    // Fetch the feed
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent("Incrementum/1.31.0")
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| IncrementumError::Internal(format!("Failed to build HTTP client: {}", e)))?;

    let response = client
        .get(&feed_url)
        .send()
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to fetch podcast feed: {}", e)))?;

    if !response.status().is_success() {
        return Err(IncrementumError::Internal(format!(
            "Failed to fetch podcast feed: HTTP {}",
            response.status()
        )));
    }

    let xml = response
        .text()
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to read feed response: {}", e)))?;

    // Parse the RSS feed
    let parsed = parse_podcast_feed(&xml)
        .map_err(|e| IncrementumError::Internal(format!("Failed to parse podcast feed: {}", e)))?;

    let feed_id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let feed = PodcastFeed {
        id: feed_id.clone(),
        title: parsed.title,
        description: parsed.description,
        image_url: parsed.image_url,
        author: parsed.author,
        language: parsed.language,
        link: parsed.link,
        feed_url: feed_url.clone(),
        last_fetched: Some(now.clone()),
        subscribed_at: now,
        sort_order: 0,
    };

    // Insert feed into DB
    repo.insert_podcast_feed(&feed).await?;

    // Bulk insert episodes
    repo.insert_podcast_episodes_bulk(&feed_id, &parsed.episodes).await?;

    let episode_count = parsed.episodes.len() as i64;

    Ok(PodcastFeedResponse {
        feed,
        episode_count,
        unplayed_count: episode_count, // All new, so all unplayed
    })
}

/// Unsubscribe from a podcast feed (CASCADE deletes episodes)
#[tauri::command]
pub async fn unsubscribe_podcast(feed_id: String, repo: State<'_, Repository>) -> Result<()> {
    repo.delete_podcast_feed(&feed_id).await
}

/// Get all subscribed podcast feeds
#[tauri::command]
pub async fn get_podcast_feeds(repo: State<'_, Repository>) -> Result<Vec<PodcastFeedResponse>> {
    let feeds = repo.get_podcast_feeds().await?;
    let mut results = Vec::new();

    for feed in feeds {
        let episode_count = repo.count_podcast_episodes(&feed.id).await?;
        let unplayed_count = repo.count_unplayed_podcast_episodes(&feed.id).await?;
        results.push(PodcastFeedResponse {
            feed,
            episode_count,
            unplayed_count,
        });
    }

    Ok(results)
}

/// Refresh a podcast feed (refetch RSS, upsert new episodes)
#[tauri::command]
pub async fn refresh_podcast_feed(feed_id: String, repo: State<'_, Repository>) -> Result<PodcastFeedResponse> {
    let feed = repo
        .get_podcast_feed(&feed_id)
        .await?
        .ok_or_else(|| IncrementumError::NotFound(format!("Podcast feed {}", feed_id)))?;

    let feed_url = feed.feed_url.clone();

    // Fetch the feed
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent("Incrementum/1.31.0")
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| IncrementumError::Internal(format!("Failed to build HTTP client: {}", e)))?;

    let response = client
        .get(&feed_url)
        .send()
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to fetch podcast feed: {}", e)))?;

    if !response.status().is_success() {
        return Err(IncrementumError::Internal(format!(
            "Failed to fetch podcast feed: HTTP {}",
            response.status()
        )));
    }

    let xml = response
        .text()
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to read feed response: {}", e)))?;

    // Parse the RSS feed
    let parsed = parse_podcast_feed(&xml)
        .map_err(|e| IncrementumError::Internal(format!("Failed to parse podcast feed: {}", e)))?;

    // Update feed metadata
    let mut updated_feed = feed.clone();
    updated_feed.title = parsed.title;
    updated_feed.description = parsed.description;
    if parsed.image_url.is_some() {
        updated_feed.image_url = parsed.image_url;
    }
    if parsed.author.is_some() {
        updated_feed.author = parsed.author;
    }
    let now = Utc::now().to_rfc3339();
    updated_feed.last_fetched = Some(now.clone());

    repo.update_podcast_feed_metadata(&updated_feed).await?;
    repo.update_podcast_feed_last_fetched(&feed_id, &now).await?;

    // Upsert episodes (INSERT OR IGNORE preserves existing played/position)
    repo.insert_podcast_episodes_bulk(&feed_id, &parsed.episodes).await?;

    let episode_count = repo.count_podcast_episodes(&feed_id).await?;
    let unplayed_count = repo.count_unplayed_podcast_episodes(&feed_id).await?;

    Ok(PodcastFeedResponse {
        feed: updated_feed,
        episode_count,
        unplayed_count,
    })
}

/// Get episodes for a podcast feed
#[tauri::command]
pub async fn get_podcast_episodes(
    feed_id: String,
    include_played: Option<bool>,
    repo: State<'_, Repository>,
) -> Result<Vec<PodcastEpisode>> {
    repo.get_podcast_episodes(&feed_id, include_played).await
}

/// Mark an episode as played or unplayed
#[tauri::command]
pub async fn mark_episode_played(
    episode_id: String,
    played: bool,
    repo: State<'_, Repository>,
) -> Result<()> {
    repo.update_episode_played(&episode_id, played).await
}

/// Update the playback position of an episode
#[tauri::command]
pub async fn update_episode_position(
    episode_id: String,
    position: f64,
    repo: State<'_, Repository>,
) -> Result<()> {
    repo.update_episode_position(&episode_id, position).await
}

/// Get the playback position of an episode
#[tauri::command]
pub async fn get_episode_position(
    episode_id: String,
    repo: State<'_, Repository>,
) -> Result<f64> {
    repo.get_episode_position(&episode_id).await
}
