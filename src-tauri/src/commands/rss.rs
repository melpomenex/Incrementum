//! RSS feed commands

use tauri::State;
use crate::database::Repository;
use crate::error::Result;
use serde::{Deserialize, Serialize};
use chrono::Utc;
use sqlx::{sqlite::SqliteRow, Row};

/// RSS feed model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RssFeed {
    pub id: String,
    pub url: String,
    pub title: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub update_interval: i32, // seconds
    pub last_fetched: Option<String>,
    pub is_active: bool,
    pub date_added: String,
    pub auto_queue: bool,
    pub auto_fetch_full_content: Option<String>, // 'always', 'favorites', 'manual'
}

/// RSS article model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RssArticle {
    pub id: String,
    pub feed_id: String,
    pub url: String,
    pub guid: Option<String>,
    pub title: String,
    pub author: Option<String>,
    pub published_date: Option<String>,
    pub content: Option<String>,
    pub summary: Option<String>,
    pub image_url: Option<String>,
    pub is_queued: bool,
    pub is_read: bool,
    pub date_added: String,
    pub full_content: Option<String>,
    pub full_content_fetched_at: Option<String>,
    pub intelligence_score: Option<f64>,
}

/// RSS user preferences model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RssUserPreference {
    pub id: String,
    pub user_id: Option<String>,
    pub feed_id: Option<String>,
    // Filter preferences
    pub keyword_include: Option<String>,
    pub keyword_exclude: Option<String>,
    pub author_whitelist: Option<String>,
    pub author_blacklist: Option<String>,
    pub category_filter: Option<String>,
    // Display preferences
    pub view_mode: Option<String>,  // 'card', 'list', 'compact'
    pub theme_mode: Option<String>, // 'system', 'light', 'dark'
    pub density: Option<String>,    // 'compact', 'normal', 'comfortable'
    pub column_count: Option<i32>,
    pub show_thumbnails: Option<bool>,
    pub excerpt_length: Option<i32>,
    pub show_author: Option<bool>,
    pub show_date: Option<bool>,
    pub show_feed_icon: Option<bool>,
    // Sorting preferences
    pub sort_by: Option<String>,   // 'date', 'title', 'read_status', 'reading_time'
    pub sort_order: Option<String>, // 'asc', 'desc'
    pub date_created: String,
    pub date_modified: String,
}

/// Update request for RSS user preferences
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RssUserPreferenceUpdate {
    pub keyword_include: Option<String>,
    pub keyword_exclude: Option<String>,
    pub author_whitelist: Option<String>,
    pub author_blacklist: Option<String>,
    pub category_filter: Option<String>,
    pub view_mode: Option<String>,
    pub theme_mode: Option<String>,
    pub density: Option<String>,
    pub column_count: Option<i32>,
    pub show_thumbnails: Option<bool>,
    pub excerpt_length: Option<i32>,
    pub show_author: Option<bool>,
    pub show_date: Option<bool>,
    pub show_feed_icon: Option<bool>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
}

fn decode_optional_text(row: &SqliteRow, column: &str) -> Option<String> {
    match row.try_get::<Option<String>, _>(column) {
        Ok(value) => value,
        Err(_) => match row.try_get::<Option<Vec<u8>>, _>(column) {
            Ok(Some(bytes)) => Some(String::from_utf8_lossy(&bytes).into_owned()),
            Ok(None) => None,
            Err(_) => None,
        },
    }
}

/// Create a new RSS feed subscription
#[tauri::command]
pub async fn create_rss_feed(
    url: String,
    title: String,
    description: Option<String>,
    category: Option<String>,
    update_interval: Option<i32>,
    auto_queue: Option<bool>,
    repo: State<'_, Repository>,
) -> Result<RssFeed> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let feed = RssFeed {
        id: id.clone(),
        url,
        title,
        description,
        category,
        update_interval: update_interval.unwrap_or(3600), // Default 1 hour
        last_fetched: None,
        is_active: true,
        date_added: now,
        auto_queue: auto_queue.unwrap_or(false),
        auto_fetch_full_content: Some("manual".to_string()),
    };

    // Insert feed into database
    sqlx::query(
        r#"
        INSERT INTO rss_feeds (id, url, title, description, category, update_interval, last_fetched, is_active, date_added, auto_queue, auto_fetch_full_content)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        "#,
    )
    .bind(&feed.id)
    .bind(&feed.url)
    .bind(&feed.title)
    .bind(&feed.description)
    .bind(&feed.category)
    .bind(feed.update_interval)
    .bind(&feed.last_fetched)
    .bind(feed.is_active)
    .bind(&feed.date_added)
    .bind(feed.auto_queue)
    .bind(&feed.auto_fetch_full_content)
    .execute(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to create RSS feed: {}", e)))?;

    Ok(feed)
}

/// Get all RSS feeds
#[tauri::command]
pub async fn get_rss_feeds(repo: State<'_, Repository>) -> Result<Vec<RssFeed>> {
    let rows = sqlx::query("SELECT * FROM rss_feeds ORDER BY title")
        .fetch_all(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to fetch RSS feeds: {}", e)))?;

    let mut feeds = Vec::new();
    for row in rows {
        feeds.push(RssFeed {
            id: row.get("id"),
            url: row.get("url"),
            title: row.get("title"),
            description: row.get("description"),
            category: row.get("category"),
            update_interval: row.get("update_interval"),
            last_fetched: row.get("last_fetched"),
            is_active: row.get("is_active"),
            date_added: row.get("date_added"),
            auto_queue: row.get("auto_queue"),
            auto_fetch_full_content: row.try_get("auto_fetch_full_content").ok(),
        });
    }

    Ok(feeds)
}

/// Get RSS feed by ID
#[tauri::command]
pub async fn get_rss_feed(id: String, repo: State<'_, Repository>) -> Result<Option<RssFeed>> {
    let row = sqlx::query("SELECT * FROM rss_feeds WHERE id = ?")
        .bind(&id)
        .fetch_optional(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to fetch RSS feed: {}", e)))?;

    match row {
        Some(row) => Ok(Some(RssFeed {
            id: row.get("id"),
            url: row.get("url"),
            title: row.get("title"),
            description: row.get("description"),
            category: row.get("category"),
            update_interval: row.get("update_interval"),
            last_fetched: row.get("last_fetched"),
            is_active: row.get("is_active"),
            date_added: row.get("date_added"),
            auto_queue: row.get("auto_queue"),
            auto_fetch_full_content: row.try_get("auto_fetch_full_content").ok(),
        })),
        None => Ok(None),
    }
}

/// Update RSS feed
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn update_rss_feed(
    id: String,
    title: Option<String>,
    description: Option<String>,
    category: Option<String>,
    update_interval: Option<i32>,
    auto_queue: Option<bool>,
    is_active: Option<bool>,
    auto_fetch_full_content: Option<String>,
    repo: State<'_, Repository>,
) -> Result<RssFeed> {
    if title.is_none()
        && description.is_none()
        && category.is_none()
        && update_interval.is_none()
        && auto_queue.is_none()
        && is_active.is_none()
        && auto_fetch_full_content.is_none()
    {
        return get_rss_feed(id, repo).await?.ok_or_else(|| {
            crate::error::IncrementumError::NotFound("Feed not found".to_string())
        });
    }

    let mut sets: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(v) = title {
        sets.push("title = ?".to_string());
        bind_values.push(v);
    }
    if let Some(v) = description {
        sets.push("description = ?".to_string());
        bind_values.push(v);
    }
    if let Some(v) = category {
        sets.push("category = ?".to_string());
        bind_values.push(v);
    }
    if let Some(v) = update_interval {
        sets.push("update_interval = ?".to_string());
        bind_values.push(v.to_string());
    }
    if let Some(v) = auto_queue {
        sets.push("auto_queue = ?".to_string());
        bind_values.push(if v { "1".to_string() } else { "0".to_string() });
    }
    if let Some(v) = is_active {
        sets.push("is_active = ?".to_string());
        bind_values.push(if v { "1".to_string() } else { "0".to_string() });
    }
    if let Some(v) = auto_fetch_full_content {
        sets.push("auto_fetch_full_content = ?".to_string());
        bind_values.push(v);
    }

    let sql = format!("UPDATE rss_feeds SET {} WHERE id = ?", sets.join(", "));
    let mut query = sqlx::query(&sql);
    for v in bind_values {
        query = query.bind(v);
    }
    query = query.bind(&id);
    query.execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to update RSS feed: {}", e)))?;

    get_rss_feed(id, repo).await?.ok_or_else(|| {
        crate::error::IncrementumError::NotFound("Feed not found".to_string())
    })
}

/// Delete RSS feed
#[tauri::command]
pub async fn delete_rss_feed(id: String, repo: State<'_, Repository>) -> Result<()> {
    sqlx::query("DELETE FROM rss_feeds WHERE id = ?")
        .bind(&id)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to delete RSS feed: {}", e)))?;

    Ok(())
}

/// Add article to database
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn create_rss_article(
    feed_id: String,
    url: String,
    guid: Option<String>,
    title: String,
    author: Option<String>,
    published_date: Option<String>,
    content: Option<String>,
    summary: Option<String>,
    image_url: Option<String>,
    repo: State<'_, Repository>,
) -> Result<RssArticle> {
    let now = Utc::now().to_rfc3339();

    let existing_by_guid = if let Some(ref guid_value) = guid {
        sqlx::query("SELECT * FROM rss_articles WHERE guid = ?")
            .bind(guid_value)
            .fetch_optional(repo.pool())
            .await
            .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to find RSS article: {}", e)))?
    } else {
        None
    };

    let existing_by_url = if existing_by_guid.is_none() {
        sqlx::query("SELECT * FROM rss_articles WHERE url = ?")
            .bind(&url)
            .fetch_optional(repo.pool())
            .await
            .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to find RSS article: {}", e)))?
    } else {
        None
    };

    if let Some(row) = existing_by_guid {
        let id = row.get::<String, _>("id");
        sqlx::query(
            r#"
            UPDATE rss_articles
            SET feed_id = ?,
                title = ?,
                author = ?,
                published_date = ?,
                content = ?,
                summary = ?,
                image_url = ?,
                guid = COALESCE(?, guid)
            WHERE id = ?
            "#,
        )
        .bind(&feed_id)
        .bind(&title)
        .bind(&author)
        .bind(&published_date)
        .bind(&content)
        .bind(&summary)
        .bind(&image_url)
        .bind(&guid)
        .bind(&id)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to update RSS article: {}", e)))?;
    } else if let Some(row) = existing_by_url {
        let id = row.get::<String, _>("id");
        sqlx::query(
            r#"
            UPDATE rss_articles
            SET feed_id = ?,
                title = ?,
                author = ?,
                published_date = ?,
                content = ?,
                summary = ?,
                image_url = ?,
                guid = COALESCE(?, guid)
            WHERE id = ?
            "#,
        )
        .bind(&feed_id)
        .bind(&title)
        .bind(&author)
        .bind(&published_date)
        .bind(&content)
        .bind(&summary)
        .bind(&image_url)
        .bind(&guid)
        .bind(&id)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to update RSS article: {}", e)))?;
    } else {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            r#"
            INSERT INTO rss_articles (id, feed_id, url, guid, title, author, published_date, content, summary, image_url, is_queued, is_read, date_added)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
            "#,
        )
        .bind(&id)
        .bind(&feed_id)
        .bind(&url)
        .bind(&guid)
        .bind(&title)
        .bind(&author)
        .bind(&published_date)
        .bind(&content)
        .bind(&summary)
        .bind(&image_url)
        .bind(false)
        .bind(false)
        .bind(&now)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to create RSS article: {}", e)))?;
    }

    let row = if let Some(ref guid_value) = guid {
        if let Some(row) = sqlx::query("SELECT * FROM rss_articles WHERE guid = ?")
            .bind(guid_value)
            .fetch_optional(repo.pool())
            .await
            .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to load RSS article: {}", e)))?
        {
            row
        } else {
            sqlx::query("SELECT * FROM rss_articles WHERE url = ?")
                .bind(&url)
                .fetch_one(repo.pool())
                .await
                .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to load RSS article: {}", e)))?
        }
    } else {
        sqlx::query("SELECT * FROM rss_articles WHERE url = ?")
            .bind(&url)
            .fetch_one(repo.pool())
            .await
            .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to load RSS article: {}", e)))?
    };

    Ok(RssArticle {
        id: row.get("id"),
        feed_id: row.get("feed_id"),
        url: row.get("url"),
        guid: row.get("guid"),
        title: row.get("title"),
        author: row.get("author"),
        published_date: row.get("published_date"),
        content: decode_optional_text(&row, "content"),
        summary: row.get("summary"),
        image_url: row.get("image_url"),
        is_queued: row.get("is_queued"),
        is_read: row.get("is_read"),
        date_added: row.get("date_added"),
        full_content: decode_optional_text(&row, "full_content"),
        full_content_fetched_at: row.try_get("full_content_fetched_at").ok(),
        intelligence_score: row.try_get("intelligence_score").ok().flatten(),
    })
}

/// Get articles for a feed
#[tauri::command]
pub async fn get_rss_articles(
    feed_id: Option<String>,
    limit: Option<i32>,
    repo: State<'_, Repository>,
) -> Result<Vec<RssArticle>> {
    let rows = if let Some(ref fid) = feed_id {
        sqlx::query("SELECT * FROM rss_articles WHERE feed_id = ? ORDER BY published_date DESC LIMIT ?")
            .bind(fid).bind(limit.unwrap_or(50))
            .fetch_all(repo.pool()).await
    } else {
        sqlx::query("SELECT * FROM rss_articles ORDER BY published_date DESC LIMIT ?")
            .bind(limit.unwrap_or(100))
            .fetch_all(repo.pool()).await
    }.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to fetch RSS articles: {}", e)))?;

    let mut articles = Vec::new();
    for row in rows {
        articles.push(RssArticle {
            id: row.get("id"),
            feed_id: row.get("feed_id"),
            url: row.get("url"),
            guid: row.get("guid"),
            title: row.get("title"),
            author: row.get("author"),
            published_date: row.get("published_date"),
            content: decode_optional_text(&row, "content"),
            summary: row.get("summary"),
            image_url: row.get("image_url"),
            is_queued: row.get("is_queued"),
            is_read: row.get("is_read"),
            date_added: row.get("date_added"),
            full_content: decode_optional_text(&row, "full_content"),
            full_content_fetched_at: row.try_get("full_content_fetched_at").ok(),
            intelligence_score: row.try_get("intelligence_score").ok().flatten(),
        });
    }

    Ok(articles)
}

/// Mark article as read/unread
#[tauri::command]
pub async fn mark_rss_article_read(id: String, is_read: bool, repo: State<'_, Repository>) -> Result<()> {
    sqlx::query("UPDATE rss_articles SET is_read = ? WHERE id = ?")
        .bind(is_read)
        .bind(&id)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to mark article: {}", e)))?;

    Ok(())
}

/// Toggle article queued status
#[tauri::command]
pub async fn toggle_rss_article_queued(id: String, repo: State<'_, Repository>) -> Result<bool> {
    // Get current status
    let row = sqlx::query("SELECT is_queued FROM rss_articles WHERE id = ?")
        .bind(&id)
        .fetch_optional(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to get article: {}", e)))?;

    match row {
        Some(row) => {
            let current: bool = row.get("is_queued");
            let new_status = !current;

            sqlx::query("UPDATE rss_articles SET is_queued = ? WHERE id = ?")
                .bind(new_status)
                .bind(&id)
                .execute(repo.pool())
                .await
                .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to update article: {}", e)))?;

            Ok(new_status)
        }
        None => Err(crate::error::IncrementumError::NotFound("Article not found".to_string())),
    }
}

/// Update feed last fetched timestamp
#[tauri::command]
pub async fn update_rss_feed_fetched(id: String, repo: State<'_, Repository>) -> Result<()> {
    let now = Utc::now().to_rfc3339();

    sqlx::query("UPDATE rss_feeds SET last_fetched = ? WHERE id = ?")
        .bind(&now)
        .bind(&id)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to update feed: {}", e)))?;

    Ok(())
}

/// Get unread article count for a feed
#[tauri::command]
pub async fn get_rss_feed_unread_count(feed_id: String, repo: State<'_, Repository>) -> Result<i32> {
    let row = sqlx::query("SELECT COUNT(*) as count FROM rss_articles WHERE feed_id = ? AND is_read = 0")
        .bind(&feed_id)
        .fetch_one(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to get unread count: {}", e)))?;

    Ok(row.get("count"))
}

/// Delete old articles
#[tauri::command]
pub async fn cleanup_old_rss_articles(days: i32, repo: State<'_, Repository>) -> Result<i32> {
    let cutoff = Utc::now() - chrono::Duration::days(days as i64);
    let cutoff_str = cutoff.to_rfc3339();

    let result = sqlx::query("DELETE FROM rss_articles WHERE date_added < ? AND is_queued = 0")
        .bind(&cutoff_str)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to cleanup articles: {}", e)))?;

    Ok(result.rows_affected() as i32)
}

/// Parsed feed item for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedFeedItem {
    pub id: String,
    pub title: String,
    pub description: String,
    pub content: String,
    pub link: String,
    pub pub_date: String,
    pub author: Option<String>,
    pub categories: Vec<String>,
    pub guid: Option<String>,
    pub image_url: Option<String>,
}

/// Parsed feed for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedFeed {
    pub id: String,
    pub title: String,
    pub description: String,
    pub link: String,
    pub feed_url: String,
    pub image_url: Option<String>,
    pub language: Option<String>,
    pub category: Option<String>,
    pub items: Vec<ParsedFeedItem>,
}

fn normalize_known_feed_url(feed_url: &str) -> String {
    match feed_url.trim() {
        "https://feeds.nbcnews.com/nbcnews/topstories" => {
            "https://feeds.nbcnews.com/nbcnews/public/news".to_string()
        }
        other => other.to_string(),
    }
}

/// Fetch and parse RSS/Atom feed from URL
#[tauri::command]
pub async fn fetch_rss_feed_url(feed_url: String) -> Result<ParsedFeed> {
    use reqwest::Client;
    use roxmltree::Document;

    let normalized_feed_url = normalize_known_feed_url(&feed_url);

    let client = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to create HTTP client: {}", e)))?;

    let response = client
        .get(&normalized_feed_url)
        .send()
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to fetch feed: {}", e)))?;

    if !response.status().is_success() {
        return Err(crate::error::IncrementumError::Internal(format!(
            "Failed to fetch feed: HTTP {}", response.status()
        )));
    }

    let xml_bytes = response
        .bytes()
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to read response: {}", e)))?;

    let xml_content = String::from_utf8_lossy(&xml_bytes).to_string();

    let doc = Document::parse(&xml_content)
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to parse XML: {}", e)))?;

    // Generate feed ID from URL
    let digest = md5::compute(&normalized_feed_url);
    let id = format!("feed-{:02x}", digest.0[0]);
    let _now = Utc::now().to_rfc3339();

    // Try to parse as RSS first
    if let Some(channel) = doc.descendants().find(|n| n.tag_name().name() == "channel") {
        let title = channel
            .children()
            .find(|n| n.tag_name().name() == "title")
            .and_then(|n| n.text())
            .unwrap_or("Unknown Feed")
            .to_string();

        let description = channel
            .children()
            .find(|n| n.tag_name().name() == "description")
            .and_then(|n| n.text())
            .unwrap_or_default()
            .to_string();

        let link = channel
            .children()
            .find(|n| n.tag_name().name() == "link")
            .and_then(|n| n.text())
            .unwrap_or(&normalized_feed_url)
            .to_string();

        let image_url = channel
            .descendants()
            .find(|n| n.tag_name().name() == "url")
            .and_then(|n| n.text())
            .map(|s| s.to_string());

        let language = channel
            .children()
            .find(|n| n.tag_name().name() == "language")
            .and_then(|n| n.text())
            .map(|s| s.to_string());

        let category = channel
            .children()
            .find(|n| n.tag_name().name() == "category")
            .and_then(|n| n.text())
            .map(|s| s.to_string());

        let mut items = Vec::new();
        for item in doc.descendants().filter(|n| n.tag_name().name() == "item") {
            if let Some(parsed) = parse_rss_item_node(&item) {
                items.push(parsed);
            }
        }

        return Ok(ParsedFeed {
            id,
            title,
            description,
            link,
            feed_url: normalized_feed_url.clone(),
            image_url,
            language,
            category,
            items,
        });
    }

    // Try to parse as Atom
    if let Some(feed) = doc.descendants().find(|n| n.tag_name().name() == "feed") {
        let title = feed
            .children()
            .find(|n| n.tag_name().name() == "title")
            .and_then(|n| n.text())
            .unwrap_or("Unknown Feed")
            .to_string();

        let description = feed
            .children()
            .find(|n| n.tag_name().name() == "subtitle")
            .and_then(|n| n.text())
            .unwrap_or_default()
            .to_string();

        let link = feed
            .descendants()
            .find(|n| {
                n.tag_name().name() == "link"
                    && (n.attribute("rel") != Some("self") || n.attribute("rel").is_none())
            })
            .and_then(|n| n.attribute("href"))
            .unwrap_or(&normalized_feed_url)
            .to_string();

        let image_url = feed
            .children()
            .find(|n| n.tag_name().name() == "logo")
            .and_then(|n| n.text())
            .or_else(|| {
                feed.children()
                    .find(|n| n.tag_name().name() == "icon")
                    .and_then(|n| n.text())
            })
            .map(|s| s.to_string());

        let language = feed.attribute("xml:lang").map(|s| s.to_string());

        let mut items = Vec::new();
        for entry in doc.descendants().filter(|n| n.tag_name().name() == "entry") {
            if let Some(parsed) = parse_atom_entry_node(&entry) {
                items.push(parsed);
            }
        }

        return Ok(ParsedFeed {
            id,
            title,
            description,
            link,
            feed_url: normalized_feed_url.clone(),
            image_url,
            language,
            category: None,
            items,
        });
    }

    Err(crate::error::IncrementumError::Internal(
        "Could not parse feed: not a valid RSS or Atom feed".to_string(),
    ))
}

fn parse_rss_item_node(item: &roxmltree::Node) -> Option<ParsedFeedItem> {
    let title = item
        .children()
        .find(|n| n.tag_name().name() == "title")
        .and_then(|n| n.text())
        .unwrap_or("Untitled")
        .to_string();

    let link = item
        .children()
        .find(|n| n.tag_name().name() == "link")
        .and_then(|n| n.text())
        .unwrap_or_default()
        .to_string();

    let description = item
        .children()
        .find(|n| n.tag_name().name() == "description")
        .or_else(|| item.children().find(|n| n.tag_name().name() == "summary"))
        .and_then(|n| n.text())
        .unwrap_or_default()
        .to_string();

    // Try content:encoded first, then description
    let content = item
        .descendants()
        .find(|n| n.tag_name().name() == "encoded")
        .and_then(|n| n.text())
        .unwrap_or(&description)
        .to_string();

    let pub_date = item
        .children()
        .find(|n| n.tag_name().name() == "pubDate")
        .and_then(|n| n.text())
        .unwrap_or_default()
        .to_string();

    let author = item
        .children()
        .find(|n| n.tag_name().name() == "author")
        .or_else(|| item.children().find(|n| n.tag_name().name() == "dc:creator"))
        .and_then(|n| n.text())
        .map(|s| s.to_string());

    let guid = item
        .children()
        .find(|n| n.tag_name().name() == "guid")
        .and_then(|n| n.text())
        .map(|s| s.to_string());

    let id = guid.clone().unwrap_or_else(|| {
        let digest = md5::compute(format!("{}{}", link, pub_date).as_str());
        format!("item-{:02x}", digest.0[0])
    });

    let categories: Vec<String> = item
        .descendants()
        .filter(|n| n.tag_name().name() == "category")
        .filter_map(|n| n.text().map(|s| s.to_string()))
        .collect();

    let enclosure_image = item
        .children()
        .find(|n| {
            n.tag_name().name() == "enclosure"
                && n.attribute("type")
                    .map(|value| value.starts_with("image/"))
                    .unwrap_or(false)
        })
        .and_then(|n| n.attribute("url"))
        .map(|s| s.to_string());

    let image_url = item
        .descendants()
        .find(|n| n.tag_name().name() == "thumbnail" && n.attribute("url").is_some())
        .and_then(|n| n.attribute("url"))
        .map(|s| s.to_string())
        .or_else(|| {
            item.descendants()
                .find(|n| n.tag_name().name() == "content" && n.attribute("url").is_some())
                .and_then(|n| n.attribute("url"))
                .map(|s| s.to_string())
        })
        .or(enclosure_image)
        .or_else(|| extract_first_image_url(&content))
        .or_else(|| extract_first_image_url(&description));

    Some(ParsedFeedItem {
        id,
        title,
        description,
        content,
        link,
        pub_date,
        author,
        categories,
        guid,
        image_url,
    })
}

fn parse_atom_entry_node(entry: &roxmltree::Node) -> Option<ParsedFeedItem> {
    let title = entry
        .children()
        .find(|n| n.tag_name().name() == "title")
        .and_then(|n| n.text())
        .unwrap_or("Untitled")
        .to_string();

    let link = entry
        .descendants()
        .find(|n| n.tag_name().name() == "link" && n.attribute("href").is_some())
        .and_then(|n| n.attribute("href"))
        .unwrap_or_default()
        .to_string();

    let content = entry
        .children()
        .find(|n| n.tag_name().name() == "content")
        .and_then(|n| n.text())
        .or_else(|| {
            entry.children()
                .find(|n| n.tag_name().name() == "summary")
                .and_then(|n| n.text())
        })
        .unwrap_or_default()
        .to_string();

    let pub_date = entry
        .children()
        .find(|n| n.tag_name().name() == "published")
        .or_else(|| entry.children().find(|n| n.tag_name().name() == "updated"))
        .and_then(|n| n.text())
        .unwrap_or_default()
        .to_string();

    let author = entry
        .descendants()
        .find(|n| n.tag_name().name() == "name")
        .and_then(|n| n.text())
        .map(|s| s.to_string());

    let id = if let Some(text) = entry
        .children()
        .find(|n| n.tag_name().name() == "id")
        .and_then(|n| n.text())
    {
        text.to_string()
    } else {
        let digest = md5::compute(format!("{}{}", link, pub_date).as_str());
        format!("item-{:02x}", digest.0[0])
    };

    let categories: Vec<String> = entry
        .descendants()
        .filter(|n| n.tag_name().name() == "category")
        .filter_map(|n| n.attribute("label").or(n.attribute("term")).map(|s| s.to_string()))
        .collect();

    let enclosure_image = entry
        .descendants()
        .find(|n| {
            n.tag_name().name() == "link"
                && n.attribute("rel") == Some("enclosure")
                && n.attribute("type")
                    .map(|value| value.starts_with("image/"))
                    .unwrap_or(false)
        })
        .and_then(|n| n.attribute("href"))
        .map(|s| s.to_string());

    let image_url = entry
        .descendants()
        .find(|n| n.tag_name().name() == "thumbnail" && n.attribute("url").is_some())
        .and_then(|n| n.attribute("url"))
        .map(|s| s.to_string())
        .or_else(|| {
            entry.descendants()
                .find(|n| n.tag_name().name() == "content" && n.attribute("url").is_some())
                .and_then(|n| n.attribute("url"))
                .map(|s| s.to_string())
        })
        .or(enclosure_image)
        .or_else(|| extract_first_image_url(&content));

    Some(ParsedFeedItem {
        id: id.clone(),
        title,
        description: content.clone(),
        content,
        link,
        pub_date,
        author,
        categories,
        guid: Some(id),
        image_url,
    })
}

fn extract_first_image_url(html: &str) -> Option<String> {
    let lower = html.to_ascii_lowercase();
    let img_index = lower.find("<img")?;
    let src_segment = &html[img_index..];
    let src_attr_index = src_segment.to_ascii_lowercase().find("src=")?;
    let attr_start = img_index + src_attr_index + 4;
    let quote = html[attr_start..].chars().next()?;

    if quote != '"' && quote != '\'' {
        return None;
    }

    let value_start = attr_start + quote.len_utf8();
    let rest = &html[value_start..];
    let value_end = rest.find(quote)?;
    Some(rest[..value_end].to_string())
}

// ============================================================================
// HTTP API Helper Functions (for browser_sync_server)
// These functions take &Repository instead of tauri::State
// ============================================================================

/// Create RSS feed (HTTP API version)
pub async fn create_rss_feed_http(
    url: String,
    title: String,
    description: Option<String>,
    category: Option<String>,
    update_interval: Option<i32>,
    auto_queue: Option<bool>,
    repo: &Repository,
) -> Result<RssFeed> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let feed = RssFeed {
        id: id.clone(),
        url,
        title,
        description,
        category,
        update_interval: update_interval.unwrap_or(3600),
        last_fetched: None,
        is_active: true,
        date_added: now,
        auto_queue: auto_queue.unwrap_or(false),
        auto_fetch_full_content: Some("manual".to_string()),
    };

    sqlx::query(
        r#"
        INSERT INTO rss_feeds (id, url, title, description, category, update_interval, last_fetched, is_active, date_added, auto_queue, auto_fetch_full_content)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        "#,
    )
    .bind(&feed.id)
    .bind(&feed.url)
    .bind(&feed.title)
    .bind(&feed.description)
    .bind(&feed.category)
    .bind(feed.update_interval)
    .bind(&feed.last_fetched)
    .bind(feed.is_active)
    .bind(&feed.date_added)
    .bind(feed.auto_queue)
    .bind(&feed.auto_fetch_full_content)
    .execute(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to create RSS feed: {}", e)))?;

    Ok(feed)
}

/// Get all RSS feeds (HTTP API version)
pub async fn get_rss_feeds_http(repo: &Repository) -> Result<Vec<RssFeed>> {
    let rows = sqlx::query("SELECT * FROM rss_feeds ORDER BY title")
        .fetch_all(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to fetch RSS feeds: {}", e)))?;

    let mut feeds = Vec::new();
    for row in rows {
        feeds.push(RssFeed {
            id: row.get("id"),
            url: row.get("url"),
            title: row.get("title"),
            description: row.get("description"),
            category: row.get("category"),
            update_interval: row.get("update_interval"),
            last_fetched: row.get("last_fetched"),
            is_active: row.get("is_active"),
            date_added: row.get("date_added"),
            auto_queue: row.get("auto_queue"),
            auto_fetch_full_content: row.try_get("auto_fetch_full_content").ok(),
        });
    }

    Ok(feeds)
}

/// Get RSS feed by ID (HTTP API version)
pub async fn get_rss_feed_http(id: &str, repo: &Repository) -> Result<Option<RssFeed>> {
    let row = sqlx::query("SELECT * FROM rss_feeds WHERE id = ?")
        .bind(id)
        .fetch_optional(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to fetch RSS feed: {}", e)))?;

    match row {
        Some(row) => Ok(Some(RssFeed {
            id: row.get("id"),
            url: row.get("url"),
            title: row.get("title"),
            description: row.get("description"),
            category: row.get("category"),
            update_interval: row.get("update_interval"),
            last_fetched: row.get("last_fetched"),
            is_active: row.get("is_active"),
            date_added: row.get("date_added"),
            auto_queue: row.get("auto_queue"),
            auto_fetch_full_content: row.try_get("auto_fetch_full_content").ok(),
        })),
        None => Ok(None),
    }
}

/// Update RSS feed (HTTP API version)
#[allow(clippy::too_many_arguments)]
pub async fn update_rss_feed_http(
    id: &str,
    title: Option<String>,
    description: Option<String>,
    category: Option<String>,
    update_interval: Option<i32>,
    auto_queue: Option<bool>,
    is_active: Option<bool>,
    repo: &Repository,
) -> Result<RssFeed> {
    if title.is_none()
        && description.is_none()
        && category.is_none()
        && update_interval.is_none()
        && auto_queue.is_none()
        && is_active.is_none()
    {
        return get_rss_feed_http(id, repo).await?.ok_or_else(|| {
            crate::error::IncrementumError::NotFound("Feed not found".to_string())
        });
    }

    let mut sets: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(v) = title {
        sets.push("title = ?".to_string());
        bind_values.push(v);
    }
    if let Some(v) = description {
        sets.push("description = ?".to_string());
        bind_values.push(v);
    }
    if let Some(v) = category {
        sets.push("category = ?".to_string());
        bind_values.push(v);
    }
    if let Some(v) = update_interval {
        sets.push("update_interval = ?".to_string());
        bind_values.push(v.to_string());
    }
    if let Some(v) = auto_queue {
        sets.push("auto_queue = ?".to_string());
        bind_values.push(if v { "1".to_string() } else { "0".to_string() });
    }
    if let Some(v) = is_active {
        sets.push("is_active = ?".to_string());
        bind_values.push(if v { "1".to_string() } else { "0".to_string() });
    }

    let sql = format!("UPDATE rss_feeds SET {} WHERE id = ?", sets.join(", "));
    let mut query = sqlx::query(&sql);
    for v in bind_values {
        query = query.bind(v);
    }
    query = query.bind(id);
    query.execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to update RSS feed: {}", e)))?;

    get_rss_feed_http(id, repo).await?.ok_or_else(|| {
        crate::error::IncrementumError::NotFound("Feed not found".to_string())
    })
}

/// Delete RSS feed (HTTP API version)
pub async fn delete_rss_feed_http(id: &str, repo: &Repository) -> Result<()> {
    sqlx::query("DELETE FROM rss_feeds WHERE id = ?")
        .bind(id)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to delete RSS feed: {}", e)))?;

    Ok(())
}

/// Get articles for a feed (HTTP API version)
pub async fn get_rss_articles_http(
    feed_id: Option<&str>,
    limit: Option<i32>,
    repo: &Repository,
) -> Result<Vec<RssArticle>> {
    let rows = if let Some(fid) = feed_id {
        sqlx::query("SELECT * FROM rss_articles WHERE feed_id = ? ORDER BY published_date DESC LIMIT ?")
            .bind(fid).bind(limit.unwrap_or(50))
            .fetch_all(repo.pool()).await
    } else {
        sqlx::query("SELECT * FROM rss_articles ORDER BY published_date DESC LIMIT ?")
            .bind(limit.unwrap_or(100))
            .fetch_all(repo.pool()).await
    }.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to fetch RSS articles: {}", e)))?;

    let mut articles = Vec::new();
    for row in rows {
        articles.push(RssArticle {
            id: row.get("id"),
            feed_id: row.get("feed_id"),
            url: row.get("url"),
            guid: row.get("guid"),
            title: row.get("title"),
            author: row.get("author"),
            published_date: row.get("published_date"),
            content: decode_optional_text(&row, "content"),
            summary: row.get("summary"),
            image_url: row.get("image_url"),
            is_queued: row.get("is_queued"),
            is_read: row.get("is_read"),
            date_added: row.get("date_added"),
            full_content: decode_optional_text(&row, "full_content"),
            full_content_fetched_at: row.try_get("full_content_fetched_at").ok(),
            intelligence_score: row.try_get("intelligence_score").ok().flatten(),
        });
    }

    Ok(articles)
}

/// Mark article as read/unread (HTTP API version)
pub async fn mark_rss_article_read_http(id: &str, is_read: bool, repo: &Repository) -> Result<()> {
    sqlx::query("UPDATE rss_articles SET is_read = ? WHERE id = ?")
        .bind(is_read)
        .bind(id)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to mark article: {}", e)))?;

    Ok(())
}

/// Toggle article queued status (HTTP API version)
pub async fn toggle_rss_article_queued_http(id: &str, repo: &Repository) -> Result<bool> {
    let row = sqlx::query("SELECT is_queued FROM rss_articles WHERE id = ?")
        .bind(id)
        .fetch_optional(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to get article: {}", e)))?;

    match row {
        Some(row) => {
            let current: bool = row.get("is_queued");
            let new_status = !current;

            sqlx::query("UPDATE rss_articles SET is_queued = ? WHERE id = ?")
                .bind(new_status)
                .bind(id)
                .execute(repo.pool())
                .await
                .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to update article: {}", e)))?;

            Ok(new_status)
        }
        None => Err(crate::error::IncrementumError::NotFound("Article not found".to_string())),
    }
}

/// Response for full content fetch
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FullContentResponse {
    pub article_id: String,
    pub full_content: Option<String>,
    pub excerpt: Option<String>,
    pub fetched_at: String,
    pub success: bool,
    pub error: Option<String>,
}

/// Fetch and extract full article content from source URL
#[tauri::command]
pub async fn fetch_article_full_content(
    article_id: String,
    article_url: String,
    repo: State<'_, Repository>,
) -> Result<FullContentResponse> {
    use reqwest::Client;
    use readable_readability::Readability;

    let client = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to create HTTP client: {}", e)))?;

    // Fetch the article HTML
    let response = match client.get(&article_url).send().await {
        Ok(resp) => resp,
        Err(e) => {
            return Ok(FullContentResponse {
                article_id,
                full_content: None,
                excerpt: None,
                fetched_at: Utc::now().to_rfc3339(),
                success: false,
                error: Some(format!("Failed to fetch article: {}", e)),
            });
        }
    };

    if !response.status().is_success() {
        return Ok(FullContentResponse {
            article_id,
            full_content: None,
            excerpt: None,
            fetched_at: Utc::now().to_rfc3339(),
            success: false,
            error: Some(format!("HTTP error: {}", response.status())),
        });
    }

    let html = match response.text().await {
        Ok(text) => text,
        Err(e) => {
            return Ok(FullContentResponse {
                article_id,
                full_content: None,
                excerpt: None,
                fetched_at: Utc::now().to_rfc3339(),
                success: false,
                error: Some(format!("Failed to read response: {}", e)),
            });
        }
    };

    // Extract readable content using Readability and convert it to owned data
    // before awaiting on the database write, since Readability internals are not Send.
    let (content, excerpt) = {
        let mut readability = Readability::new();
        let (content_node, _metadata) = readability.parse(&html);
        let content = content_node.to_string();

        let plain_text = html2text::from_read(content.as_bytes(), 80)
            .unwrap_or_else(|_| content_node.text_contents());
        let excerpt = if plain_text.len() > 200 {
            Some(format!("{}...", &plain_text[..200]))
        } else {
            Some(plain_text)
        };

        (content, excerpt)
    };

    if content.is_empty() {
        return Ok(FullContentResponse {
            article_id,
            full_content: None,
            excerpt: None,
            fetched_at: Utc::now().to_rfc3339(),
            success: false,
            error: Some("Could not extract readable content from page".to_string()),
        });
    }

    let fetched_at = Utc::now().to_rfc3339();

    // Store in database
    sqlx::query(
        r#"
        UPDATE rss_articles
        SET full_content = ?,
            full_content_fetched_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&content)
    .bind(&fetched_at)
    .bind(&article_id)
    .execute(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to store full content: {}", e)))?;

    Ok(FullContentResponse {
        article_id,
        full_content: Some(content),
        excerpt,
        fetched_at,
        success: true,
        error: None,
    })
}

/// Update auto-fetch preference for a feed
#[tauri::command]
pub async fn update_feed_auto_fetch(
    feed_id: String,
    auto_fetch_mode: String, // 'always', 'favorites', 'manual'
    repo: State<'_, Repository>,
) -> Result<()> {
    sqlx::query(
        r#"
        UPDATE rss_feeds
        SET auto_fetch_full_content = ?
        WHERE id = ?
        "#,
    )
    .bind(&auto_fetch_mode)
    .bind(&feed_id)
    .execute(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to update feed auto-fetch: {}", e)))?;

    Ok(())
}

/// Get cached full content for an article
#[tauri::command]
pub async fn get_article_full_content(
    article_id: String,
    repo: State<'_, Repository>,
) -> Result<Option<(String, String)>> {
    let row = sqlx::query(
        "SELECT full_content, full_content_fetched_at FROM rss_articles WHERE id = ?"
    )
    .bind(&article_id)
    .fetch_optional(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to get full content: {}", e)))?;

    Ok(row.map(|row| {
        let content: Option<String> = row.get("full_content");
        let fetched_at: Option<String> = row.get("full_content_fetched_at");
        (content.unwrap_or_default(), fetched_at.unwrap_or_default())
    }))
}
