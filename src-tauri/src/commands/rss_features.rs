//! NewsBlur-inspired RSS feature commands
//!
//! Intelligence training, reading state, search, clustering,
//! tags, annotations, discovery, and folder management.

use tauri::State;
use crate::database::Repository;
use crate::error::Result;
use serde::{Deserialize, Serialize};
use chrono::Utc;
use sqlx::{sqlite::SqliteRow, Row};

/// Intelligence classifier
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RssClassifier {
    pub id: String,
    pub feed_id: String,
    pub classifier_type: String, // 'author', 'title', 'tag', 'feed'
    pub value: String,
    pub sentiment: String,      // 'like', 'dislike', 'neutral'
    pub scope: String,          // 'feed', 'folder', 'global'
    pub created_at: String,
    pub updated_at: String,
}

/// RSS folder (replaces localStorage)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RssFolder {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub icon: Option<String>,
    pub sort_order: i32,
    pub auto_mark_after_days: Option<i32>,
    pub created_at: String,
    pub feed_ids: Vec<String>,
}

/// Tag
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RssTag {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub article_count: Option<i64>,
}

/// Annotation (highlight or note)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RssAnnotation {
    pub id: String,
    pub article_id: String,
    pub annotation_type: String, // 'highlight', 'note', 'share'
    pub content: String,
    pub start_offset: Option<i32>,
    pub end_offset: Option<i32>,
    pub color: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Story cluster (duplicate/related)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RssStoryCluster {
    pub id: String,
    pub canonical_article_id: String,
    pub article_id: String,
    pub similarity_score: f64,
    pub cluster_type: String, // 'duplicate', 'related'
    pub created_at: String,
}

/// Discovered site
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RssDiscoveredSite {
    pub id: String,
    pub url: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub feed_url: Option<String>,
    pub similarity_source: Option<String>,
    pub discovered_at: String,
}

/// Search result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RssSearchResult {
    pub article_id: String,
    pub title: String,
    pub snippet: Option<String>,
    pub feed_id: String,
    pub published_date: Option<String>,
    pub rank: f64,
}

/// Feed statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RssFeedStatistics {
    pub feed_id: String,
    pub total_articles: i64,
    pub unread_count: i64,
    pub articles_per_week: f64,
    pub estimated_frequency: String,
    pub last_fetched: Option<String>,
    pub date_added: String,
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

#[tauri::command]
pub async fn add_rss_classifier(
    feed_id: String,
    classifier_type: String,
    value: String,
    sentiment: String,
    scope: Option<String>,
    repo: State<'_, Repository>,
) -> Result<RssClassifier> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let scope = scope.unwrap_or_else(|| "feed".to_string());

    sqlx::query(
        r#"INSERT INTO rss_classifiers (id, feed_id, classifier_type, value, sentiment, scope, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"#,
    )
    .bind(&id)
    .bind(&feed_id)
    .bind(&classifier_type)
    .bind(&value)
    .bind(&sentiment)
    .bind(&scope)
    .bind(&now)
    .bind(&now)
    .execute(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to add classifier: {}", e)))?;

    // Invalidate intelligence scores for articles in this feed
    sqlx::query("UPDATE rss_articles SET intelligence_score_computed_at = NULL WHERE feed_id = ?")
        .bind(&feed_id)
        .execute(repo.pool())
        .await
        .ok();

    Ok(RssClassifier {
        id,
        feed_id,
        classifier_type,
        value,
        sentiment,
        scope,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub async fn remove_rss_classifier(id: String, repo: State<'_, Repository>) -> Result<()> {
    let feed_id: Option<String> = sqlx::query_scalar("SELECT feed_id FROM rss_classifiers WHERE id = ?")
        .bind(&id)
        .fetch_optional(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to get classifier: {}", e)))?
        .flatten();

    sqlx::query("DELETE FROM rss_classifiers WHERE id = ?")
        .bind(&id)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to remove classifier: {}", e)))?;

    if let Some(feed_id) = feed_id {
        sqlx::query("UPDATE rss_articles SET intelligence_score_computed_at = NULL WHERE feed_id = ?")
            .bind(&feed_id)
            .execute(repo.pool())
            .await
            .ok();
    }

    Ok(())
}

#[tauri::command]
pub async fn get_rss_classifiers(
    feed_id: Option<String>,
    classifier_type: Option<String>,
    sentiment: Option<String>,
    scope: Option<String>,
    repo: State<'_, Repository>,
) -> Result<Vec<RssClassifier>> {
    let mut conditions = Vec::new();
    if feed_id.is_some() {
        conditions.push("feed_id = ?".to_string());
    }
    if classifier_type.is_some() {
        conditions.push("classifier_type = ?".to_string());
    }
    if sentiment.is_some() {
        conditions.push("sentiment = ?".to_string());
    }
    if scope.is_some() {
        conditions.push("scope = ?".to_string());
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let query_str = format!("SELECT * FROM rss_classifiers {} ORDER BY classifier_type, value", where_clause);

    let mut query = sqlx::query(&query_str);
    if let Some(ref fid) = feed_id {
        query = query.bind(fid);
    }
    if let Some(ref ct) = classifier_type {
        query = query.bind(ct);
    }
    if let Some(ref s) = sentiment {
        query = query.bind(s);
    }
    if let Some(ref sc) = scope {
        query = query.bind(sc);
    }

    let rows = query
        .fetch_all(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to fetch classifiers: {}", e)))?;

    let classifiers = rows.iter().map(|row| RssClassifier {
        id: row.get("id"),
        feed_id: row.get("feed_id"),
        classifier_type: row.get("classifier_type"),
        value: row.get("value"),
        sentiment: row.get("sentiment"),
        scope: row.get("scope"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }).collect();

    Ok(classifiers)
}

#[derive(Debug, Deserialize)]
pub struct ClassifierUpdate {
    pub id: String,
    pub sentiment: Option<String>,
    pub value: Option<String>,
}

#[tauri::command]
pub async fn update_rss_classifiers_batch(
    updates: Vec<ClassifierUpdate>,
    repo: State<'_, Repository>,
) -> Result<()> {
    let mut feed_ids = std::collections::HashSet::new();

    for update in &updates {
        if let Some(ref sentiment) = update.sentiment {
            let fid: String = sqlx::query_scalar("SELECT feed_id FROM rss_classifiers WHERE id = ?")
                .bind(&update.id)
                .fetch_one(repo.pool())
                .await
                .map_err(|e| crate::error::IncrementumError::Internal(format!("Classifier not found: {}", e)))?;
            feed_ids.insert(fid);

            let now = Utc::now().to_rfc3339();
            sqlx::query("UPDATE rss_classifiers SET sentiment = ?, updated_at = ? WHERE id = ?")
                .bind(sentiment)
                .bind(&now)
                .bind(&update.id)
                .execute(repo.pool())
                .await
                .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to update classifier: {}", e)))?;
        }
        if let Some(ref value) = update.value {
            let now = Utc::now().to_rfc3339();
            sqlx::query("UPDATE rss_classifiers SET value = ?, updated_at = ? WHERE id = ?")
                .bind(value)
                .bind(&now)
                .bind(&update.id)
                .execute(repo.pool())
                .await
                .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to update classifier: {}", e)))?;
        }
    }

    // Invalidate scores for affected feeds
    for feed_id in feed_ids {
        sqlx::query("UPDATE rss_articles SET intelligence_score_computed_at = NULL WHERE feed_id = ?")
            .bind(&feed_id)
            .execute(repo.pool())
            .await
            .ok();
    }

    Ok(())
}

/// Compute intelligence score for a single article
#[tauri::command]
pub async fn compute_intelligence_score(
    article_id: String,
    repo: State<'_, Repository>,
) -> Result<f64> {
    let article: Option<(String, String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT feed_id, title, author, content FROM rss_articles WHERE id = ?"
    )
    .bind(&article_id)
    .fetch_optional(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to get article: {}", e)))?
    .map(|row: (String, String, Option<String>, Option<String>)| row);

    let (feed_id, title, author, _content) = match article {
        Some(a) => a,
        None => return Ok(0.0),
    };

    let title_lower = title.to_lowercase();
    let author_lower = author.as_ref().map(|a| a.to_lowercase());

    // Fetch all applicable classifiers (feed, folder, global)
    let classifiers: Vec<(String, String, String)> = sqlx::query_as(
        r#"SELECT classifier_type, value, sentiment FROM rss_classifiers
           WHERE feed_id = ? OR scope IN ('folder', 'global')"#
    )
    .bind(&feed_id)
    .fetch_all(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to fetch classifiers: {}", e)))?;

    let mut score: f64 = 0.0;

    for (classifier_type, value, sentiment) in &classifiers {
        let value_lower = value.to_lowercase();
        let matches = match classifier_type.as_str() {
            "author" => {
                author_lower.as_ref().is_some_and(|a| a.contains(&value_lower))
            }
            "title" => {
                title_lower.contains(&value_lower)
            }
            "feed" => {
                // Feed-level classifiers: always match if they exist for this feed
                true
            }
            "tag" => {
                // Tag matching requires content analysis - simplified to title match for now
                title_lower.contains(&value_lower)
            }
            _ => false,
        };

        if matches {
            match sentiment.as_str() {
                "like" => score += 1.0,
                "dislike" => score -= 1.0,
                _ => {}
            }
        }
    }

    // Green always wins: if score > 0, clamp to positive
    let score = if score > 0.0 { score } else { 0.0 };

    let now = Utc::now().to_rfc3339();
    sqlx::query("UPDATE rss_articles SET intelligence_score = ?, intelligence_score_computed_at = ? WHERE id = ?")
        .bind(score)
        .bind(&now)
        .bind(&article_id)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to cache score: {}", e)))?;

    Ok(score)
}

/// Batch compute intelligence scores for all articles needing recomputation
#[tauri::command]
pub async fn recompute_all_intelligence_scores(repo: State<'_, Repository>) -> Result<i32> {
    let article_ids: Vec<String> = sqlx::query_scalar(
        "SELECT id FROM rss_articles WHERE intelligence_score_computed_at IS NULL LIMIT 1000"
    )
    .fetch_all(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to get articles: {}", e)))?;

    let mut count = 0;
    for article_id in article_ids {
        match compute_intelligence_score(article_id, repo.clone()).await {
            Ok(_) => count += 1,
            Err(_) => continue,
        }
    }

    Ok(count)
}

/// Get articles with intelligence filtering
#[tauri::command]
pub async fn get_rss_articles_with_intelligence(
    feed_id: Option<String>,
    limit: Option<i32>,
    intelligence_filter: Option<String>, // 'focus', 'all', 'neutral'
    include_hidden: Option<bool>,
    repo: State<'_, Repository>,
) -> Result<Vec<serde_json::Value>> {
    let include_hidden = include_hidden.unwrap_or(false);
    let limit = limit.unwrap_or(100);

    let mut conditions = Vec::new();
    if let Some(ref fid) = feed_id {
        conditions.push(format!("feed_id = '{}'", fid));
    }
    if intelligence_filter.as_deref() == Some("focus") {
        conditions.push("intelligence_score > 0".to_string());
    }
    if !include_hidden {
        conditions.push("(intelligence_score >= 0 OR intelligence_score IS NULL)".to_string());
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let query = format!(
        "SELECT * FROM rss_articles {} ORDER BY published_date DESC LIMIT {}",
        where_clause, limit
    );

    let rows = sqlx::query(&query)
        .fetch_all(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to fetch articles: {}", e)))?;

    let articles: Vec<serde_json::Value> = rows.iter().map(|row| {
        serde_json::json!({
            "id": row.get::<String, _>("id"),
            "feed_id": row.get::<String, _>("feed_id"),
            "url": row.get::<String, _>("url"),
            "guid": row.get::<Option<String>, _>("guid"),
            "title": row.get::<String, _>("title"),
            "author": row.get::<Option<String>, _>("author"),
            "published_date": row.get::<Option<String>, _>("published_date"),
            "content": row.get::<Option<String>, _>("content"),
            "summary": row.get::<Option<String>, _>("summary"),
            "image_url": row.get::<Option<String>, _>("image_url"),
            "is_queued": row.get::<bool, _>("is_queued"),
            "is_read": row.get::<bool, _>("is_read"),
            "date_added": row.get::<String, _>("date_added"),
            "full_content_fetched_at": row.try_get::<Option<String>, _>("full_content_fetched_at").ok().flatten(),
            "intelligence_score": row.try_get::<Option<f64>, _>("intelligence_score").ok().flatten(),
        })
    }).collect();

    Ok(articles)
}

#[tauri::command]
pub async fn mark_rss_article_unread(id: String, repo: State<'_, Repository>) -> Result<()> {
    sqlx::query("UPDATE rss_articles SET is_read = 0 WHERE id = ?")
        .bind(&id)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to mark unread: {}", e)))?;
    Ok(())
}

#[tauri::command]
pub async fn mark_rss_articles_before_date_read(
    feed_id: Option<String>,
    before_date: String,
    repo: State<'_, Repository>,
) -> Result<i32> {
    let result = if let Some(ref fid) = feed_id {
        sqlx::query("UPDATE rss_articles SET is_read = 1 WHERE feed_id = ? AND published_date < ? AND is_read = 0")
            .bind(fid).bind(&before_date)
            .execute(repo.pool()).await
    } else {
        sqlx::query("UPDATE rss_articles SET is_read = 1 WHERE published_date < ? AND is_read = 0")
            .bind(&before_date)
            .execute(repo.pool()).await
    }.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to mark articles: {}", e)))?;

    Ok(result.rows_affected() as i32)
}

#[tauri::command]
pub async fn mark_rss_articles_after_date_read(
    feed_id: Option<String>,
    after_date: String,
    repo: State<'_, Repository>,
) -> Result<i32> {
    let result = if let Some(ref fid) = feed_id {
        sqlx::query("UPDATE rss_articles SET is_read = 1 WHERE feed_id = ? AND published_date > ? AND is_read = 0")
            .bind(fid).bind(&after_date)
            .execute(repo.pool()).await
    } else {
        sqlx::query("UPDATE rss_articles SET is_read = 1 WHERE published_date > ? AND is_read = 0")
            .bind(&after_date)
            .execute(repo.pool()).await
    }.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to mark articles: {}", e)))?;

    Ok(result.rows_affected() as i32)
}

#[tauri::command]
pub async fn auto_mark_articles_as_read(repo: State<'_, Repository>) -> Result<i32> {
    // Apply auto-mark for feeds with auto_mark_after_days set
    let feeds: Vec<(String, i32)> = sqlx::query_as(
        "SELECT id, auto_mark_after_days FROM rss_feeds WHERE auto_mark_after_days IS NOT NULL AND is_active = 1"
    )
    .fetch_all(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to get feeds: {}", e)))?;

    let mut total = 0;
    let now = Utc::now();

    for (feed_id, days) in feeds {
        let cutoff = now - chrono::Duration::days(days as i64);
        let cutoff_str = cutoff.to_rfc3339();

        let result = sqlx::query(
            "UPDATE rss_articles SET is_read = 1 WHERE feed_id = ? AND published_date < ? AND is_read = 0 AND is_queued = 0"
        )
        .bind(&feed_id)
        .bind(&cutoff_str)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to auto-mark: {}", e)))?;

        total += result.rows_affected() as i32;
    }

    Ok(total)
}

#[tauri::command]
pub async fn get_read_rss_articles(
    limit: Option<i32>,
    offset: Option<i32>,
    repo: State<'_, Repository>,
) -> Result<Vec<serde_json::Value>> {
    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);

    let rows = sqlx::query(
        "SELECT * FROM rss_articles WHERE is_read = 1 ORDER BY date_added DESC LIMIT ? OFFSET ?"
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to fetch read articles: {}", e)))?;

    let articles: Vec<serde_json::Value> = rows.iter().map(|row| {
        serde_json::json!({
            "id": row.get::<String, _>("id"),
            "feed_id": row.get::<String, _>("feed_id"),
            "url": row.get::<String, _>("url"),
            "title": row.get::<String, _>("title"),
            "author": row.get::<Option<String>, _>("author"),
            "published_date": row.get::<Option<String>, _>("published_date"),
            "summary": row.get::<Option<String>, _>("summary"),
            "image_url": row.get::<Option<String>, _>("image_url"),
            "date_added": row.get::<String, _>("date_added"),
            "intelligence_score": row.try_get::<Option<f64>, _>("intelligence_score").ok().flatten(),
        })
    }).collect();

    Ok(articles)
}

#[tauri::command]
pub async fn get_river_of_news(
    folder_id: String,
    limit: Option<i32>,
    intelligence_filter: Option<String>,
    repo: State<'_, Repository>,
) -> Result<Vec<serde_json::Value>> {
    let limit = limit.unwrap_or(100);
    let mut conditions = vec![
        "f.folder_id = ?".to_string(),
        "a.is_read = 0".to_string(),
    ];

    if intelligence_filter.as_deref() == Some("focus") {
        conditions.push("a.intelligence_score > 0".to_string());
    }

    let where_clause = conditions.join(" AND ");
    let query = format!(
        "SELECT a.*, f.title as feed_title FROM rss_articles a \
         INNER JOIN rss_feeds f ON a.feed_id = f.id \
         INNER JOIN rss_feed_folders ff ON ff.feed_id = f.id \
         WHERE {} ORDER BY a.published_date DESC LIMIT {}",
        where_clause, limit
    );

    let rows = sqlx::query(&query)
        .bind(&folder_id)
        .fetch_all(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to fetch river: {}", e)))?;

    let articles: Vec<serde_json::Value> = rows.iter().map(|row| {
        serde_json::json!({
            "id": row.get::<String, _>("id"),
            "feed_id": row.get::<String, _>("feed_id"),
            "url": row.get::<String, _>("url"),
            "title": row.get::<String, _>("title"),
            "author": row.get::<Option<String>, _>("author"),
            "published_date": row.get::<Option<String>, _>("published_date"),
            "summary": row.get::<Option<String>, _>("summary"),
            "image_url": row.get::<Option<String>, _>("image_url"),
            "feed_title": row.try_get::<Option<String>, _>("feed_title").ok().flatten(),
            "intelligence_score": row.try_get::<Option<f64>, _>("intelligence_score").ok().flatten(),
        })
    }).collect();

    Ok(articles)
}

#[tauri::command]
pub async fn search_rss_articles(
    query: String,
    feed_id: Option<String>,
    folder_id: Option<String>,
    scope: Option<String>, // 'all', 'saved'
    limit: Option<i32>,
    repo: State<'_, Repository>,
) -> Result<Vec<RssSearchResult>> {
    let limit = limit.unwrap_or(50);
    let fts_query = format!("{}*", query); // prefix match

    let (select_sql, from_and_where) = if scope.as_deref() == Some("saved") {
        ("SELECT a.id as article_id, a.title, snippet(rss_articles_fts, 2, '<mark>', '</mark>', '...', 32) as snippet, a.feed_id, a.published_date, rank",
         "FROM rss_articles_fts f INNER JOIN rss_articles a ON f.rowid = a.rowid WHERE f MATCH ? AND a.is_queued = 1")
    } else if folder_id.is_some() {
        ("SELECT a.id as article_id, a.title, snippet(rss_articles_fts, 2, '<mark>', '</mark>', '...', 32) as snippet, a.feed_id, a.published_date, rank",
         "FROM rss_articles_fts f INNER JOIN rss_articles a ON f.rowid = a.rowid INNER JOIN rss_feed_folders ff ON ff.feed_id = a.feed_id WHERE f MATCH ? AND ff.folder_id = ?")
    } else if feed_id.is_some() {
        ("SELECT a.id as article_id, a.title, snippet(rss_articles_fts, 2, '<mark>', '</mark>', '...', 32) as snippet, a.feed_id, a.published_date, rank",
         "FROM rss_articles_fts f INNER JOIN rss_articles a ON f.rowid = a.rowid WHERE f MATCH ? AND a.feed_id = ?")
    } else {
        ("SELECT a.id as article_id, a.title, snippet(rss_articles_fts, 2, '<mark>', '</mark>', '...', 32) as snippet, a.feed_id, a.published_date, rank",
         "FROM rss_articles_fts f INNER JOIN rss_articles a ON f.rowid = a.rowid WHERE f MATCH ?")
    };

    let order = "ORDER BY rank LIMIT ?";
    let full_query = format!("{} {} {}", select_sql, from_and_where, order);

    let mut sql_query = sqlx::query_as::<_, (String, String, Option<String>, String, Option<String>, f64)>(&full_query);
    // First ? is always f MATCH
    sql_query = sql_query.bind(&fts_query);
    // Second ? is scope-specific condition
    if let Some(ref folid) = folder_id {
        sql_query = sql_query.bind(folid);
    } else if let Some(ref fid) = feed_id {
        sql_query = sql_query.bind(fid);
    }
    sql_query = sql_query.bind(limit);

    let rows = sql_query
        .fetch_all(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Search failed: {}", e)))?;

    let results = rows.iter().map(|(id, title, snippet, feed_id, pub_date, rank)| {
        RssSearchResult {
            article_id: id.clone(),
            title: title.clone(),
            snippet: snippet.clone(),
            feed_id: feed_id.clone(),
            published_date: pub_date.clone(),
            rank: *rank,
        }
    }).collect();

    Ok(results)
}

/// Trigram similarity between two strings (simplified Levenshtein ratio)
fn trigram_similarity(a: &str, b: &str) -> f64 {
    if a.is_empty() || b.is_empty() {
        return 0.0;
    }

    let a_lower = a.to_lowercase();
    let b_lower = b.to_lowercase();

    // Fast path: identical
    if a_lower == b_lower {
        return 1.0;
    }

    let trigrams_a: std::collections::HashSet<String> = (0..a_lower.len().saturating_sub(1))
        .map(|i| a_lower[i..i + 3.min(a_lower.len() - i)].to_string())
        .filter(|s| s.len() == 3)
        .collect();

    let trigrams_b: std::collections::HashSet<String> = (0..b_lower.len().saturating_sub(1))
        .map(|i| b_lower[i..i + 3.min(b_lower.len() - i)].to_string())
        .filter(|s| s.len() == 3)
        .collect();

    if trigrams_a.is_empty() || trigrams_b.is_empty() {
        return 0.0;
    }

    let intersection = trigrams_a.intersection(&trigrams_b).count();
    let union = trigrams_a.union(&trigrams_b).count();

    (2.0 * intersection as f64) / (union as f64)
}

#[tauri::command]
pub async fn compute_story_clusters(
    feed_id: Option<String>,
    repo: State<'_, Repository>,
) -> Result<Vec<RssStoryCluster>> {
    // Get recent articles (last 5 days)
    let cutoff = (Utc::now() - chrono::Duration::days(5)).to_rfc3339();

    let rows = if let Some(ref fid) = feed_id {
        sqlx::query(
            "SELECT id, title, published_date FROM rss_articles WHERE feed_id = ? AND published_date > ? ORDER BY published_date DESC LIMIT 500"
        )
        .bind(fid)
        .bind(&cutoff)
    } else {
        sqlx::query(
            "SELECT id, title, published_date FROM rss_articles WHERE published_date > ? ORDER BY published_date DESC LIMIT 500"
        )
        .bind(&cutoff)
    }
    .fetch_all(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to get articles: {}", e)))?;

    let articles: Vec<(String, String, Option<String>)> = rows.iter()
        .map(|r| (r.get::<String, _>("id"), r.get::<String, _>("title"), r.get::<Option<String>, _>("published_date")))
        .collect();

    let mut clusters = Vec::new();
    let mut clustered: std::collections::HashSet<String> = std::collections::HashSet::new();

    for i in 0..articles.len() {
        if clustered.contains(&articles[i].0) {
            continue;
        }

        for j in (i + 1)..articles.len() {
            if clustered.contains(&articles[j].0) {
                continue;
            }

            let sim = trigram_similarity(&articles[i].1, &articles[j].1);

            if sim > 0.85 {
                // Duplicate
                let id = uuid::Uuid::new_v4().to_string();
                let now = Utc::now().to_rfc3339();

                sqlx::query(
                    "INSERT INTO rss_story_clusters (id, canonical_article_id, article_id, similarity_score, cluster_type, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
                )
                .bind(&id)
                .bind(&articles[i].0)
                .bind(&articles[j].0)
                .bind(sim)
                .bind("duplicate")
                .bind(&now)
                .execute(repo.pool())
                .await
                .ok();

                clusters.push(RssStoryCluster {
                    id,
                    canonical_article_id: articles[i].0.clone(),
                    article_id: articles[j].0.clone(),
                    similarity_score: sim,
                    cluster_type: "duplicate".to_string(),
                    created_at: now,
                });
                clustered.insert(articles[j].0.clone());
            } else if sim > 0.6 {
                // Related
                let id = uuid::Uuid::new_v4().to_string();
                let now = Utc::now().to_rfc3339();

                sqlx::query(
                    "INSERT INTO rss_story_clusters (id, canonical_article_id, article_id, similarity_score, cluster_type, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
                )
                .bind(&id)
                .bind(&articles[i].0)
                .bind(&articles[j].0)
                .bind(sim)
                .bind("related")
                .bind(&now)
                .execute(repo.pool())
                .await
                .ok();

                clusters.push(RssStoryCluster {
                    id,
                    canonical_article_id: articles[i].0.clone(),
                    article_id: articles[j].0.clone(),
                    similarity_score: sim,
                    cluster_type: "related".to_string(),
                    created_at: now,
                });
            }
        }
    }

    Ok(clusters)
}

#[tauri::command]
pub async fn get_rss_article_clusters(
    feed_id: Option<String>,
    repo: State<'_, Repository>,
) -> Result<Vec<RssStoryCluster>> {
    let rows = if let Some(ref fid) = feed_id {
        sqlx::query(
            "SELECT c.* FROM rss_story_clusters c \
             INNER JOIN rss_articles a ON c.canonical_article_id = a.id \
             WHERE a.feed_id = ? ORDER BY c.similarity_score DESC LIMIT 200"
        )
        .bind(fid)
    } else {
        sqlx::query(
            "SELECT * FROM rss_story_clusters ORDER BY similarity_score DESC LIMIT 500"
        )
    }
    .fetch_all(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to get clusters: {}", e)))?;

    let clusters = rows.iter().map(|row| RssStoryCluster {
        id: row.get("id"),
        canonical_article_id: row.get("canonical_article_id"),
        article_id: row.get("article_id"),
        similarity_score: row.get("similarity_score"),
        cluster_type: row.get("cluster_type"),
        created_at: row.get("created_at"),
    }).collect();

    Ok(clusters)
}

#[tauri::command]
pub async fn invalidate_clusters_for_feed(feed_id: String, repo: State<'_, Repository>) -> Result<()> {
    sqlx::query(
        "DELETE FROM rss_story_clusters WHERE canonical_article_id IN \
         (SELECT id FROM rss_articles WHERE feed_id = ?) \
         OR article_id IN (SELECT id FROM rss_articles WHERE feed_id = ?)"
    )
    .bind(&feed_id)
    .bind(&feed_id)
    .execute(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to invalidate clusters: {}", e)))?;

    Ok(())
}

#[tauri::command]
pub async fn add_tag(name: String, repo: State<'_, Repository>) -> Result<RssTag> {
    let existing: Option<(String, String, String)> = sqlx::query_as(
        "SELECT id, name, created_at FROM rss_tags WHERE name = ?"
    )
    .bind(&name)
    .fetch_optional(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to check tag: {}", e)))?;

    if let Some((id, tag_name, created_at)) = existing {
        return Ok(RssTag { id, name: tag_name, created_at, article_count: None });
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query("INSERT INTO rss_tags (id, name, created_at) VALUES (?1, ?2, ?3)")
        .bind(&id)
        .bind(&name)
        .bind(&now)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to create tag: {}", e)))?;

    Ok(RssTag { id, name, created_at: now, article_count: None })
}

#[tauri::command]
pub async fn remove_tag(tag_id: String, repo: State<'_, Repository>) -> Result<()> {
    sqlx::query("DELETE FROM rss_article_tags WHERE tag_id = ?")
        .bind(&tag_id)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to remove tag associations: {}", e)))?;

    sqlx::query("DELETE FROM rss_tags WHERE id = ?")
        .bind(&tag_id)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to remove tag: {}", e)))?;

    Ok(())
}

#[tauri::command]
pub async fn get_article_tags(article_id: String, repo: State<'_, Repository>) -> Result<Vec<RssTag>> {
    let rows = sqlx::query(
        "SELECT t.id, t.name, t.created_at FROM rss_tags t \
         INNER JOIN rss_article_tags at ON t.id = at.tag_id \
         WHERE at.article_id = ? ORDER BY t.name"
    )
    .bind(&article_id)
    .fetch_all(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to get article tags: {}", e)))?;

    let tags = rows.iter().map(|row| RssTag {
        id: row.get("id"),
        name: row.get("name"),
        created_at: row.get("created_at"),
        article_count: None,
    }).collect();

    Ok(tags)
}

#[tauri::command]
pub async fn get_all_tags(repo: State<'_, Repository>) -> Result<Vec<RssTag>> {
    let rows = sqlx::query(
        "SELECT t.id, t.name, t.created_at, COUNT(at.article_id) as article_count \
         FROM rss_tags t LEFT JOIN rss_article_tags at ON t.id = at.tag_id \
         GROUP BY t.id ORDER BY t.name"
    )
    .fetch_all(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to get tags: {}", e)))?;

    let tags = rows.iter().map(|row| RssTag {
        id: row.get("id"),
        name: row.get("name"),
        created_at: row.get("created_at"),
        article_count: row.try_get("article_count").ok(),
    }).collect();

    Ok(tags)
}

#[tauri::command]
pub async fn tag_article(article_id: String, tag_id: String, repo: State<'_, Repository>) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    sqlx::query("INSERT OR IGNORE INTO rss_article_tags (article_id, tag_id, created_at) VALUES (?1, ?2, ?3)")
        .bind(&article_id)
        .bind(&tag_id)
        .bind(&now)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to tag article: {}", e)))?;

    Ok(())
}

#[tauri::command]
pub async fn untag_article(article_id: String, tag_id: String, repo: State<'_, Repository>) -> Result<()> {
    sqlx::query("DELETE FROM rss_article_tags WHERE article_id = ? AND tag_id = ?")
        .bind(&article_id)
        .bind(&tag_id)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to untag article: {}", e)))?;

    Ok(())
}

#[tauri::command]
pub async fn get_articles_by_tag(
    tag_id: String,
    limit: Option<i32>,
    repo: State<'_, Repository>,
) -> Result<Vec<serde_json::Value>> {
    let limit = limit.unwrap_or(50);
    let rows = sqlx::query(
        "SELECT a.* FROM rss_articles a \
         INNER JOIN rss_article_tags at ON a.id = at.article_id \
         WHERE at.tag_id = ? AND a.is_queued = 1 \
         ORDER BY a.date_added DESC LIMIT ?"
    )
    .bind(&tag_id)
    .bind(limit)
    .fetch_all(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to get articles by tag: {}", e)))?;

    let articles: Vec<serde_json::Value> = rows.iter().map(|row| {
        serde_json::json!({
            "id": row.get::<String, _>("id"),
            "feed_id": row.get::<String, _>("feed_id"),
            "url": row.get::<String, _>("url"),
            "title": row.get::<String, _>("title"),
            "author": row.get::<Option<String>, _>("author"),
            "published_date": row.get::<Option<String>, _>("published_date"),
            "summary": row.get::<Option<String>, _>("summary"),
            "image_url": row.get::<Option<String>, _>("image_url"),
        })
    }).collect();

    Ok(articles)
}

#[tauri::command]
pub async fn rename_tag(tag_id: String, new_name: String, repo: State<'_, Repository>) -> Result<()> {
    sqlx::query("UPDATE rss_tags SET name = ? WHERE id = ?")
        .bind(&new_name)
        .bind(&tag_id)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to rename tag: {}", e)))?;
    Ok(())
}

#[tauri::command]
pub async fn merge_tags(source_tag_id: String, target_tag_id: String, repo: State<'_, Repository>) -> Result<()> {
    // Move all article associations from source to target
    sqlx::query(
        "INSERT OR IGNORE INTO rss_article_tags (article_id, tag_id, created_at) \
         SELECT article_id, ?, created_at FROM rss_article_tags WHERE tag_id = ?"
    )
    .bind(&target_tag_id)
    .bind(&source_tag_id)
    .execute(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to merge tag associations: {}", e)))?;

    remove_tag(source_tag_id, repo).await
}

#[tauri::command]
pub async fn create_annotation(
    article_id: String,
    annotation_type: String,
    content: String,
    start_offset: Option<i32>,
    end_offset: Option<i32>,
    color: Option<String>,
    repo: State<'_, Repository>,
) -> Result<RssAnnotation> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO rss_annotations (id, article_id, annotation_type, content, start_offset, end_offset, color, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"
    )
    .bind(&id)
    .bind(&article_id)
    .bind(&annotation_type)
    .bind(&content)
    .bind(start_offset)
    .bind(end_offset)
    .bind(color.as_deref().unwrap_or("#FFFF00"))
    .bind(&now)
    .bind(&now)
    .execute(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to create annotation: {}", e)))?;

    Ok(RssAnnotation {
        id,
        article_id,
        annotation_type,
        content,
        start_offset,
        end_offset,
        color,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub async fn get_article_annotations(
    article_id: String,
    repo: State<'_, Repository>,
) -> Result<Vec<RssAnnotation>> {
    let rows = sqlx::query(
        "SELECT * FROM rss_annotations WHERE article_id = ? ORDER BY created_at"
    )
    .bind(&article_id)
    .fetch_all(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to get annotations: {}", e)))?;

    let annotations = rows.iter().map(|row| RssAnnotation {
        id: row.get("id"),
        article_id: row.get("article_id"),
        annotation_type: row.get("annotation_type"),
        content: row.get("content"),
        start_offset: row.try_get("start_offset").ok(),
        end_offset: row.try_get("end_offset").ok(),
        color: row.try_get("color").ok(),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }).collect();

    Ok(annotations)
}

#[tauri::command]
pub async fn update_annotation(
    id: String,
    content: Option<String>,
    color: Option<String>,
    repo: State<'_, Repository>,
) -> Result<RssAnnotation> {
    let now = Utc::now().to_rfc3339();
    let mut sets = vec!["updated_at = ?".to_string()];

    if content.is_some() { sets.push("content = ?".to_string()); }
    if color.is_some() { sets.push("color = ?".to_string()); }

    let query_str = format!("UPDATE rss_annotations SET {} WHERE id = ?", sets.join(", "));

    let mut query = sqlx::query(&query_str).bind(&now);
    if let Some(ref c) = content { query = query.bind(c); }
    if let Some(ref c) = color { query = query.bind(c); }
    query = query.bind(&id);
    query.execute(repo.pool()).await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to update annotation: {}", e)))?;

    let row = sqlx::query("SELECT * FROM rss_annotations WHERE id = ?")
        .bind(&id)
        .fetch_one(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to get annotation: {}", e)))?;

    Ok(RssAnnotation {
        id: row.get("id"),
        article_id: row.get("article_id"),
        annotation_type: row.get("annotation_type"),
        content: row.get("content"),
        start_offset: row.try_get("start_offset").ok(),
        end_offset: row.try_get("end_offset").ok(),
        color: row.try_get("color").ok(),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    })
}

#[tauri::command]
pub async fn delete_annotation(id: String, repo: State<'_, Repository>) -> Result<()> {
    sqlx::query("DELETE FROM rss_annotations WHERE id = ?")
        .bind(&id)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to delete annotation: {}", e)))?;
    Ok(())
}

#[tauri::command]
pub async fn get_discovered_sites(
    limit: Option<i32>,
    offset: Option<i32>,
    repo: State<'_, Repository>,
) -> Result<Vec<RssDiscoveredSite>> {
    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);

    let rows = sqlx::query(
        "SELECT * FROM rss_discovered_sites ORDER BY discovered_at DESC LIMIT ? OFFSET ?"
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to get discovered sites: {}", e)))?;

    let sites = rows.iter().map(|row| RssDiscoveredSite {
        id: row.get("id"),
        url: row.get("url"),
        title: row.get("title"),
        description: row.get("description"),
        feed_url: row.get("feed_url"),
        similarity_source: row.get("similarity_source"),
        discovered_at: row.get("discovered_at"),
    }).collect();

    Ok(sites)
}

#[tauri::command]
pub async fn delete_discovered_site(id: String, repo: State<'_, Repository>) -> Result<()> {
    sqlx::query("DELETE FROM rss_discovered_sites WHERE id = ?")
        .bind(&id)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to delete discovered site: {}", e)))?;
    Ok(())
}

#[tauri::command]
pub async fn refresh_discoveries(repo: State<'_, Repository>) -> Result<i32> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT url, feed_id FROM rss_articles WHERE date_added > datetime('now', '-7 days') LIMIT 500"
    )
    .fetch_all(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to get recent articles: {}", e)))?;

    let mut domains: std::collections::HashSet<String> = std::collections::HashSet::new();
    for (url, _) in &rows {
        if let Ok(parsed) = url::Url::parse(url) {
            domains.insert(parsed.host_str().unwrap_or("").to_string());
        }
    }

    let subscribed: Vec<String> = sqlx::query_scalar("SELECT url FROM rss_feeds")
        .fetch_all(repo.pool())
        .await
        .unwrap_or_default();

    let mut count = 0;

    for domain in domains {
        // Skip if already subscribed
        if subscribed.iter().any(|s| s.contains(&domain)) {
            continue;
        }

        let exists: bool = sqlx::query_scalar(
            "SELECT COUNT(*) > 0 FROM rss_discovered_sites WHERE url LIKE ?"
        )
        .bind(format!("%{}%", domain))
        .fetch_one(repo.pool())
        .await
        .unwrap_or(false);

        if exists {
            continue;
        }

        // Attempt RSS auto-discovery
        let site_url = format!("https://{}", domain);
        let discovered = discover_feed_from_site(&site_url).await;

        if let Some((feed_url, title, desc)) = discovered {
            let id = uuid::Uuid::new_v4().to_string();
            let now = Utc::now().to_rfc3339();

            sqlx::query(
                "INSERT INTO rss_discovered_sites (id, url, title, description, feed_url, discovered_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
            )
            .bind(&id)
            .bind(&site_url)
            .bind(&title)
            .bind(&desc)
            .bind(&feed_url)
            .bind(&now)
            .execute(repo.pool())
            .await
            .ok();

            count += 1;
        }
    }

    Ok(count)
}

/// Attempt to discover RSS feed from a website
async fn discover_feed_from_site(site_url: &str) -> Option<(String, String, Option<String>)> {
    use reqwest::Client;

    let client = match Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .timeout(std::time::Duration::from_secs(10))
        .build() {
        Ok(c) => c,
        Err(_) => return None,
    };

    let resp = match client.get(site_url).send().await {
        Ok(r) if r.status().is_success() => r,
        _ => return None,
    };

    let html = match resp.text().await {
        Ok(t) => t,
        Err(_) => return None,
    };

    // Look for RSS/Atom feed links
    let mut feed_url = None;
    let mut title = None;
    let mut description = None;

    // Simple regex-based extraction of <link> tags with RSS/Atom types
    for line in html.lines() {
        let lower = line.to_lowercase();
        if (lower.contains("rel=\"alternate\"") || lower.contains("rel='alternate'"))
            && (lower.contains("application/rss+xml") || lower.contains("application/atom+xml") || lower.contains("text/xml"))
        {
            if let Some(href_start) = lower.find("href=\"").or_else(|| lower.find("href='")) {
                let href_start = href_start + 6;
                if let Some(href_end) = lower[href_start..].find('"').or_else(|| lower[href_start..].find('\'')) {
                    let href = &line[href_start..href_start + href_end];
                    let resolved = if href.starts_with("http") {
                        href.to_string()
                    } else if href.starts_with("//") {
                        format!("https:{}", href)
                    } else if href.starts_with('/') {
                        format!("https://{}{}", site_url.strip_prefix("https://").unwrap_or(site_url).strip_prefix("http://").unwrap_or(site_url), href)
                    } else {
                        format!("{}/{}", site_url.trim_end_matches('/'), href)
                    };
                    feed_url = Some(resolved);
                    break;
                }
            }
        }
    }

    // Extract title from <title> tag
    if let Some(title_start) = html.to_lowercase().find("<title>") {
        let title_start = title_start + 7;
        if let Some(title_end) = html[title_start..].find("</title>") {
            title = Some(html[title_start..title_start + title_end].trim().to_string());
        }
    }

    // Extract description from <meta name="description">
    if let Some(desc_start) = html.to_lowercase().find("name=\"description\"") {
        let content_start = html[desc_start..].find("content=\"").or_else(|| html[desc_start..].find("content='"));
        if let Some(cs) = content_start {
            let cs = desc_start + cs + 9;
            if let Some(ce) = html[cs..].find('"').or_else(|| html[cs..].find('\'')) {
                description = Some(html[cs..cs + ce].to_string());
            }
        }
    }

    feed_url.map(|f| (f, title.unwrap_or_else(|| site_url.to_string()), description))
}

#[tauri::command]
pub async fn create_rss_folder(
    name: String,
    parent_id: Option<String>,
    icon: Option<String>,
    auto_mark_after_days: Option<i32>,
    repo: State<'_, Repository>,
) -> Result<RssFolder> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO rss_folders (id, name, parent_id, icon, sort_order, auto_mark_after_days, created_at) VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6)"
    )
    .bind(&id)
    .bind(&name)
    .bind(&parent_id)
    .bind(&icon)
    .bind(auto_mark_after_days)
    .bind(&now)
    .execute(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to create folder: {}", e)))?;

    Ok(RssFolder {
        id,
        name,
        parent_id,
        icon,
        sort_order: 0,
        auto_mark_after_days,
        created_at: now,
        feed_ids: Vec::new(),
    })
}

#[tauri::command]
pub async fn update_rss_folder(
    id: String,
    name: Option<String>,
    parent_id: Option<Option<String>>,
    icon: Option<Option<String>>,
    sort_order: Option<i32>,
    auto_mark_after_days: Option<Option<i32>>,
    repo: State<'_, Repository>,
) -> Result<RssFolder> {
    let mut sets = Vec::new();

    if name.is_some() { sets.push("name = ?".to_string()); }
    if parent_id.is_some() { sets.push("parent_id = ?".to_string()); }
    if icon.is_some() { sets.push("icon = ?".to_string()); }
    if sort_order.is_some() { sets.push("sort_order = ?".to_string()); }
    if auto_mark_after_days.is_some() { sets.push("auto_mark_after_days = ?".to_string()); }

    if sets.is_empty() {
        // Re-borrow repo for the inner call
        return get_rss_folder_by_id(id, repo.clone()).await;
    }

    let query_str = format!("UPDATE rss_folders SET {} WHERE id = ?", sets.join(", "));
    let mut query = sqlx::query(&query_str);

    if let Some(ref n) = name { query = query.bind(n); }
    if let Some(ref p) = parent_id { query = query.bind(p); }
    if let Some(ref i) = icon { query = query.bind(i); }
    if let Some(s) = sort_order { query = query.bind(s); }
    if let Some(ref a) = auto_mark_after_days { query = query.bind(a); }
    query = query.bind(&id);

    query.execute(repo.pool()).await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to update folder: {}", e)))?;

    get_rss_folder_by_id(id, repo.clone()).await
}

async fn get_rss_folder_by_id(id: String, repo: State<'_, Repository>) -> Result<RssFolder> {
    let row = sqlx::query("SELECT * FROM rss_folders WHERE id = ?")
        .bind(&id)
        .fetch_optional(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to get folder: {}", e)))?;

    match row {
        Some(row) => {
            let folder_id: String = row.get("id");
            let feed_ids: Vec<String> = sqlx::query_scalar(
                "SELECT feed_id FROM rss_feed_folders WHERE folder_id = ? ORDER BY sort_order"
            )
            .bind(&folder_id)
            .fetch_all(repo.pool())
            .await
            .unwrap_or_default();

            Ok(RssFolder {
                id: row.get("id"),
                name: row.get("name"),
                parent_id: row.get("parent_id"),
                icon: row.get("icon"),
                sort_order: row.get("sort_order"),
                auto_mark_after_days: row.get("auto_mark_after_days"),
                created_at: row.get("created_at"),
                feed_ids,
            })
        }
        None => Err(crate::error::IncrementumError::NotFound("Folder not found".to_string())),
    }
}

#[tauri::command]
pub async fn delete_rss_folder(
    id: String,
    move_feeds_to_parent: Option<String>,
    repo: State<'_, Repository>,
) -> Result<()> {
    // Move feeds to parent or remove associations
    if let Some(ref target_folder) = move_feeds_to_parent {
        sqlx::query("UPDATE rss_feed_folders SET folder_id = ? WHERE folder_id = ?")
            .bind(target_folder)
            .bind(&id)
            .execute(repo.pool())
            .await
            .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to move feeds: {}", e)))?;
    } else {
        sqlx::query("DELETE FROM rss_feed_folders WHERE folder_id = ?")
            .bind(&id)
            .execute(repo.pool())
            .await
            .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to remove feed associations: {}", e)))?;
    }

    // Move subfolders to parent
    sqlx::query("UPDATE rss_folders SET parent_id = NULL WHERE parent_id = ?")
        .bind(&id)
        .execute(repo.pool())
        .await
        .ok();

    sqlx::query("DELETE FROM rss_folders WHERE id = ?")
        .bind(&id)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to delete folder: {}", e)))?;

    Ok(())
}

#[tauri::command]
pub async fn get_rss_folders(repo: State<'_, Repository>) -> Result<Vec<RssFolder>> {
    let rows = sqlx::query("SELECT * FROM rss_folders ORDER BY sort_order, name")
        .fetch_all(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to get folders: {}", e)))?;

    let mut folders = Vec::new();
    for row in rows {
        let folder_id: String = row.get("id");
        let feed_ids: Vec<String> = sqlx::query_scalar(
            "SELECT feed_id FROM rss_feed_folders WHERE folder_id = ? ORDER BY sort_order"
        )
        .bind(&folder_id)
        .fetch_all(repo.pool())
        .await
        .unwrap_or_default();

        folders.push(RssFolder {
            id: row.get("id"),
            name: row.get("name"),
            parent_id: row.get("parent_id"),
            icon: row.get("icon"),
            sort_order: row.get("sort_order"),
            auto_mark_after_days: row.get("auto_mark_after_days"),
            created_at: row.get("created_at"),
            feed_ids,
        });
    }

    Ok(folders)
}

#[tauri::command]
pub async fn move_feed_to_folder(
    feed_id: String,
    folder_id: Option<String>,
    sort_order: Option<i32>,
    repo: State<'_, Repository>,
) -> Result<()> {
    sqlx::query("DELETE FROM rss_feed_folders WHERE feed_id = ?")
        .bind(&feed_id)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to remove feed from folders: {}", e)))?;

    if let Some(ref folid) = folder_id {
        let sort = sort_order.unwrap_or(0);
        sqlx::query("INSERT INTO rss_feed_folders (feed_id, folder_id, sort_order) VALUES (?1, ?2, ?3)")
            .bind(&feed_id)
            .bind(folid)
            .bind(sort)
            .execute(repo.pool())
            .await
            .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to add feed to folder: {}", e)))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn reorder_feeds(
    reorder: Vec<(String, i32)>, // (feed_id, new_sort_order)
    folder_id: String,
    repo: State<'_, Repository>,
) -> Result<()> {
    for (feed_id, sort_order) in reorder {
        sqlx::query("UPDATE rss_feed_folders SET sort_order = ? WHERE feed_id = ? AND folder_id = ?")
            .bind(sort_order)
            .bind(&feed_id)
            .bind(&folder_id)
            .execute(repo.pool())
            .await
            .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to reorder feed: {}", e)))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn reorder_folders(reorder: Vec<(String, i32)>, repo: State<'_, Repository>) -> Result<()> {
    for (folder_id, sort_order) in reorder {
        sqlx::query("UPDATE rss_folders SET sort_order = ? WHERE id = ?")
            .bind(sort_order)
            .bind(&folder_id)
            .execute(repo.pool())
            .await
            .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to reorder folder: {}", e)))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn toggle_feed_active(feed_id: String, repo: State<'_, Repository>) -> Result<bool> {
    let current: bool = sqlx::query_scalar("SELECT is_active FROM rss_feeds WHERE id = ?")
        .bind(&feed_id)
        .fetch_one(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Feed not found: {}", e)))?;

    let new_active = !current;
    sqlx::query("UPDATE rss_feeds SET is_active = ? WHERE id = ?")
        .bind(new_active)
        .bind(&feed_id)
        .execute(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to toggle feed: {}", e)))?;

    Ok(new_active)
}

#[tauri::command]
pub async fn get_feed_statistics(feed_id: String, repo: State<'_, Repository>) -> Result<RssFeedStatistics> {
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM rss_articles WHERE feed_id = ?")
        .bind(&feed_id)
        .fetch_one(repo.pool())
        .await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to get total: {}", e)))?;

    let unread: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM rss_articles WHERE feed_id = ? AND is_read = 0"
    )
    .bind(&feed_id)
    .fetch_one(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to get unread: {}", e)))?;

    // Articles per week calculation
    let weeks_ago = (Utc::now() - chrono::Duration::weeks(4)).to_rfc3339();
    let recent_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM rss_articles WHERE feed_id = ? AND date_added > ?"
    )
    .bind(&feed_id)
    .bind(&weeks_ago)
    .fetch_one(repo.pool())
    .await
    .unwrap_or(0);

    let articles_per_week = recent_count as f64 / 4.0;

    let estimated_frequency = match articles_per_week {
        x if x >= 7.0 => "multiple daily".to_string(),
        x if x >= 1.0 => "daily".to_string(),
        x if x >= 0.5 => "a few per week".to_string(),
        x if x >= 0.1 => "weekly".to_string(),
        _ => "infrequent".to_string(),
    };

    let last_fetched: Option<String> = sqlx::query_scalar(
        "SELECT last_fetched FROM rss_feeds WHERE id = ?"
    )
    .bind(&feed_id)
    .fetch_optional(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to get last_fetched: {}", e)))?
    .flatten();

    let date_added: String = sqlx::query_scalar(
        "SELECT date_added FROM rss_feeds WHERE id = ?"
    )
    .bind(&feed_id)
    .fetch_one(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to get date_added: {}", e)))?;

    Ok(RssFeedStatistics {
        feed_id,
        total_articles: total,
        unread_count: unread,
        articles_per_week,
        estimated_frequency,
        last_fetched,
        date_added,
    })
}

/// Set per-feed view mode and layout preferences
#[tauri::command]
pub async fn set_feed_view_preferences(
    feed_id: String,
    view_mode: Option<String>,
    layout: Option<String>,
    auto_mark_after_days: Option<Option<i32>>,
    repo: State<'_, Repository>,
) -> Result<()> {
    let mut sets = Vec::new();
    if view_mode.is_some() { sets.push("view_mode = ?".to_string()); }
    if layout.is_some() { sets.push("layout = ?".to_string()); }
    if auto_mark_after_days.is_some() { sets.push("auto_mark_after_days = ?".to_string()); }

    if sets.is_empty() { return Ok(()); }

    let query_str = format!("UPDATE rss_feeds SET {} WHERE id = ?", sets.join(", "));
    let mut query = sqlx::query(&query_str);
    if let Some(ref vm) = view_mode { query = query.bind(vm); }
    if let Some(ref l) = layout { query = query.bind(l); }
    if let Some(ref a) = auto_mark_after_days { query = query.bind(a); }
    query = query.bind(&feed_id);

    query.execute(repo.pool()).await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to update feed preferences: {}", e)))?;

    Ok(())
}

/// Search articles (HTTP API version)
pub async fn search_rss_articles_http(
    query: String,
    feed_id: Option<&str>,
    folder_id: Option<&str>,
    scope: Option<&str>,
    limit: Option<i32>,
    repo: &Repository,
) -> Result<Vec<RssSearchResult>> {
    let limit = limit.unwrap_or(50);
    let fts_query = format!("{}*", query);

    let (select_sql, from_and_where) = if scope == Some("saved") {
        ("SELECT a.id as article_id, a.title, snippet(rss_articles_fts, 2, '<mark>', '</mark>', '...', 32) as snippet, a.feed_id, a.published_date, rank",
         "FROM rss_articles_fts f INNER JOIN rss_articles a ON f.rowid = a.rowid WHERE f MATCH ? AND a.is_queued = 1")
    } else if folder_id.is_some() {
        ("SELECT a.id as article_id, a.title, snippet(rss_articles_fts, 2, '<mark>', '</mark>', '...', 32) as snippet, a.feed_id, a.published_date, rank",
         "FROM rss_articles_fts f INNER JOIN rss_articles a ON f.rowid = a.rowid INNER JOIN rss_feed_folders ff ON ff.feed_id = a.feed_id WHERE f MATCH ? AND ff.folder_id = ?")
    } else if feed_id.is_some() {
        ("SELECT a.id as article_id, a.title, snippet(rss_articles_fts, 2, '<mark>', '</mark>', '...', 32) as snippet, a.feed_id, a.published_date, rank",
         "FROM rss_articles_fts f INNER JOIN rss_articles a ON f.rowid = a.rowid WHERE f MATCH ? AND a.feed_id = ?")
    } else {
        ("SELECT a.id as article_id, a.title, snippet(rss_articles_fts, 2, '<mark>', '</mark>', '...', 32) as snippet, a.feed_id, a.published_date, rank",
         "FROM rss_articles_fts f INNER JOIN rss_articles a ON f.rowid = a.rowid WHERE f MATCH ?")
    };

    let order = "ORDER BY rank LIMIT ?";
    let full_query = format!("{} {} {}", select_sql, from_and_where, order);

    let mut sql_query = sqlx::query_as::<_, (String, String, Option<String>, String, Option<String>, f64)>(&full_query);
    sql_query = sql_query.bind(&fts_query);
    if let Some(folid) = folder_id {
        sql_query = sql_query.bind(folid);
    } else if let Some(fid) = feed_id {
        sql_query = sql_query.bind(fid);
    }
    sql_query = sql_query.bind(limit);

    let rows = sql_query.fetch_all(repo.pool()).await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Search failed: {}", e)))?;

    Ok(rows.iter().map(|(id, title, snippet, feed_id, pub_date, rank)| {
        RssSearchResult { article_id: id.clone(), title: title.clone(), snippet: snippet.clone(), feed_id: feed_id.clone(), published_date: pub_date.clone(), rank: *rank }
    }).collect())
}

/// Get all classifiers (HTTP API version)
pub async fn get_rss_classifiers_http(
    feed_id: Option<&str>,
    repo: &Repository,
) -> Result<Vec<RssClassifier>> {
    let rows = if let Some(fid) = feed_id {
        sqlx::query("SELECT * FROM rss_classifiers WHERE feed_id = ? ORDER BY classifier_type, value")
            .bind(fid)
            .fetch_all(repo.pool()).await
    } else {
        sqlx::query("SELECT * FROM rss_classifiers ORDER BY classifier_type, value")
            .fetch_all(repo.pool()).await
    }.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to fetch classifiers: {}", e)))?;

    Ok(rows.iter().map(|row| RssClassifier {
        id: row.get("id"), feed_id: row.get("feed_id"), classifier_type: row.get("classifier_type"),
        value: row.get("value"), sentiment: row.get("sentiment"), scope: row.get("scope"),
        created_at: row.get("created_at"), updated_at: row.get("updated_at"),
    }).collect())
}

/// Add classifier (HTTP API version)
pub async fn add_rss_classifier_http(
    feed_id: &str,
    classifier_type: &str,
    value: &str,
    sentiment: &str,
    repo: &Repository,
) -> Result<RssClassifier> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        r#"INSERT INTO rss_classifiers (id, feed_id, classifier_type, value, sentiment, scope, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, 'feed', ?6, ?7)"#,
    )
    .bind(&id).bind(feed_id).bind(classifier_type).bind(value).bind(sentiment).bind(&now).bind(&now)
    .execute(repo.pool())
    .await
    .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to add classifier: {}", e)))?;

    Ok(RssClassifier { id, feed_id: feed_id.to_string(), classifier_type: classifier_type.to_string(), value: value.to_string(), sentiment: sentiment.to_string(), scope: "feed".to_string(), created_at: now.clone(), updated_at: now })
}

pub async fn remove_rss_classifier_http(id: &str, repo: &Repository) -> Result<()> {
    let feed_id: Option<String> = sqlx::query_scalar("SELECT feed_id FROM rss_classifiers WHERE id = ?")
        .bind(id).fetch_optional(repo.pool()).await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to get classifier: {}", e)))?.flatten();
    sqlx::query("DELETE FROM rss_classifiers WHERE id = ?").bind(id)
        .execute(repo.pool()).await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to remove classifier: {}", e)))?;
    if let Some(fid) = feed_id {
        sqlx::query("UPDATE rss_articles SET intelligence_score_computed_at = NULL WHERE feed_id = ?").bind(&fid).execute(repo.pool()).await.ok();
    }
    Ok(())
}

pub async fn update_rss_classifiers_batch_http(updates: Vec<ClassifierUpdate>, repo: &Repository) -> Result<()> {
    for update in &updates {
        if let Some(ref sentiment) = update.sentiment {
            let now = Utc::now().to_rfc3339();
            sqlx::query("UPDATE rss_classifiers SET sentiment = ?, updated_at = ? WHERE id = ?").bind(sentiment).bind(&now).bind(&update.id).execute(repo.pool()).await.ok();
        }
    }
    Ok(())
}

pub async fn mark_rss_article_unread_http(id: &str, repo: &Repository) -> Result<()> {
    sqlx::query("UPDATE rss_articles SET is_read = 0 WHERE id = ?").bind(id).execute(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to mark unread: {}", e)))?;
    Ok(())
}

pub async fn get_rss_folders_http(repo: &Repository) -> Result<Vec<RssFolder>> {
    let rows = sqlx::query("SELECT * FROM rss_folders ORDER BY sort_order, name").fetch_all(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to get folders: {}", e)))?;
    let mut folders = Vec::new();
    for row in rows {
        let folder_id: String = row.get("id");
        let feed_ids: Vec<String> = sqlx::query_scalar("SELECT feed_id FROM rss_feed_folders WHERE folder_id = ? ORDER BY sort_order").bind(&folder_id).fetch_all(repo.pool()).await.unwrap_or_default();
        folders.push(RssFolder { id: row.get("id"), name: row.get("name"), parent_id: row.get("parent_id"), icon: row.get("icon"), sort_order: row.get("sort_order"), auto_mark_after_days: row.get("auto_mark_after_days"), created_at: row.get("created_at"), feed_ids });
    }
    Ok(folders)
}

pub async fn create_rss_folder_http(name: &str, parent_id: Option<&str>, icon: Option<&str>, auto_mark_after_days: Option<i32>, repo: &Repository) -> Result<RssFolder> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    sqlx::query("INSERT INTO rss_folders (id, name, parent_id, icon, sort_order, auto_mark_after_days, created_at) VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6)")
        .bind(&id).bind(name).bind(parent_id).bind(icon).bind(auto_mark_after_days).bind(&now)
        .execute(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to create folder: {}", e)))?;
    Ok(RssFolder { id, name: name.to_string(), parent_id: parent_id.map(|s| s.to_string()), icon: icon.map(|s| s.to_string()), sort_order: 0, auto_mark_after_days, created_at: now, feed_ids: Vec::new() })
}

pub async fn delete_rss_folder_http(id: &str, move_to: Option<&str>, repo: &Repository) -> Result<()> {
    if let Some(target) = move_to {
        sqlx::query("UPDATE rss_feed_folders SET folder_id = ? WHERE folder_id = ?").bind(target).bind(id).execute(repo.pool()).await.ok();
    } else {
        sqlx::query("DELETE FROM rss_feed_folders WHERE folder_id = ?").bind(id).execute(repo.pool()).await.ok();
    }
    sqlx::query("UPDATE rss_folders SET parent_id = NULL WHERE parent_id = ?").bind(id).execute(repo.pool()).await.ok();
    sqlx::query("DELETE FROM rss_folders WHERE id = ?").bind(id).execute(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to delete folder: {}", e)))?;
    Ok(())
}

pub async fn move_feed_to_folder_http(feed_id: &str, folder_id: Option<&str>, sort_order: Option<i32>, repo: &Repository) -> Result<()> {
    sqlx::query("DELETE FROM rss_feed_folders WHERE feed_id = ?").bind(feed_id).execute(repo.pool()).await.ok();
    if let Some(folid) = folder_id {
        sqlx::query("INSERT INTO rss_feed_folders (feed_id, folder_id, sort_order) VALUES (?1, ?2, ?3)").bind(feed_id).bind(folid).bind(sort_order.unwrap_or(0)).execute(repo.pool()).await.ok();
    }
    Ok(())
}

pub async fn toggle_feed_active_http(feed_id: &str, repo: &Repository) -> Result<bool> {
    let current: bool = sqlx::query_scalar("SELECT is_active FROM rss_feeds WHERE id = ?").bind(feed_id).fetch_one(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Feed not found: {}", e)))?;
    let new_active = !current;
    sqlx::query("UPDATE rss_feeds SET is_active = ? WHERE id = ?").bind(new_active).bind(feed_id).execute(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to toggle feed: {}", e)))?;
    Ok(new_active)
}

pub async fn get_feed_statistics_http(feed_id: &str, repo: &Repository) -> Result<RssFeedStatistics> {
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM rss_articles WHERE feed_id = ?").bind(feed_id).fetch_one(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    let unread: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM rss_articles WHERE feed_id = ? AND is_read = 0").bind(feed_id).fetch_one(repo.pool()).await.unwrap_or(0);
    let weeks_ago = (Utc::now() - chrono::Duration::weeks(4)).to_rfc3339();
    let recent: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM rss_articles WHERE feed_id = ? AND date_added > ?").bind(feed_id).bind(&weeks_ago).fetch_one(repo.pool()).await.unwrap_or(0);
    let apw = recent as f64 / 4.0;
    let freq = match apw { x if x >= 7.0 => "multiple daily", x if x >= 1.0 => "daily", x if x >= 0.5 => "a few per week", x if x >= 0.1 => "weekly", _ => "infrequent" };
    let last_fetched: Option<String> = sqlx::query_scalar("SELECT last_fetched FROM rss_feeds WHERE id = ?").bind(feed_id).fetch_optional(repo.pool()).await.unwrap_or(None).flatten();
    let date_added: String = sqlx::query_scalar("SELECT date_added FROM rss_feeds WHERE id = ?").bind(feed_id).fetch_one(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    Ok(RssFeedStatistics { feed_id: feed_id.to_string(), total_articles: total, unread_count: unread, articles_per_week: apw, estimated_frequency: freq.to_string(), last_fetched, date_added })
}

macro_rules! http_variant {
    ($name:ident, |$repo:ident, $($arg:ident: $ty:ty),*| $body:expr) => {
        pub async fn $name($($arg: $ty,)* $repo: &Repository) -> Result<serde_json::Value> {
            let pool = $repo.pool();
            $body
        }
    };
}

pub async fn mark_rss_articles_before_date_read_http(feed_id: Option<&str>, before_date: &str, repo: &Repository) -> Result<i32> {
    let result = if let Some(fid) = feed_id {
        sqlx::query("UPDATE rss_articles SET is_read = 1 WHERE feed_id = ? AND published_date < ? AND is_read = 0")
            .bind(fid).bind(before_date)
            .execute(repo.pool()).await
    } else {
        sqlx::query("UPDATE rss_articles SET is_read = 1 WHERE published_date < ? AND is_read = 0")
            .bind(before_date)
            .execute(repo.pool()).await
    }.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    Ok(result.rows_affected() as i32)
}

pub async fn mark_rss_articles_after_date_read_http(feed_id: Option<&str>, after_date: &str, repo: &Repository) -> Result<i32> {
    let result = if let Some(fid) = feed_id {
        sqlx::query("UPDATE rss_articles SET is_read = 1 WHERE feed_id = ? AND published_date > ? AND is_read = 0")
            .bind(fid).bind(after_date)
            .execute(repo.pool()).await
    } else {
        sqlx::query("UPDATE rss_articles SET is_read = 1 WHERE published_date > ? AND is_read = 0")
            .bind(after_date)
            .execute(repo.pool()).await
    }.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    Ok(result.rows_affected() as i32)
}

pub async fn get_read_rss_articles_http(limit: Option<i32>, offset: Option<i32>, repo: &Repository) -> Result<Vec<serde_json::Value>> {
    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);
    let rows = sqlx::query("SELECT * FROM rss_articles WHERE is_read = 1 ORDER BY date_added DESC LIMIT ? OFFSET ?")
        .bind(limit).bind(offset).fetch_all(repo.pool()).await
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    Ok(rows.iter().map(|row| serde_json::json!({
        "id": row.get::<String, _>("id"), "feed_id": row.get::<String, _>("feed_id"), "url": row.get::<String, _>("url"),
        "title": row.get::<String, _>("title"), "author": row.get::<Option<String>, _>("author"),
        "published_date": row.get::<Option<String>, _>("published_date"), "summary": row.get::<Option<String>, _>("summary"),
    })).collect())
}

pub async fn get_river_of_news_http(folder_id: &str, limit: Option<i32>, repo: &Repository) -> Result<Vec<serde_json::Value>> {
    let limit = limit.unwrap_or(100);
    let rows = sqlx::query(
        "SELECT a.*, f.title as feed_title FROM rss_articles a INNER JOIN rss_feeds f ON a.feed_id = f.id \
         INNER JOIN rss_feed_folders ff ON ff.feed_id = f.id WHERE ff.folder_id = ? AND a.is_read = 0 \
         ORDER BY a.published_date DESC LIMIT ?"
    ).bind(folder_id).bind(limit)
    .fetch_all(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    Ok(rows.iter().map(|row| serde_json::json!({
        "id": row.get::<String, _>("id"), "feed_id": row.get::<String, _>("feed_id"), "title": row.get::<String, _>("title"),
        "feed_title": row.try_get::<Option<String>, _>("feed_title").ok().flatten(),
        "published_date": row.get::<Option<String>, _>("published_date"),
    })).collect())
}

pub async fn get_rss_articles_with_intelligence_http(feed_id: Option<&str>, limit: Option<i32>, include_hidden: bool, repo: &Repository) -> Result<Vec<serde_json::Value>> {
    let limit = limit.unwrap_or(100);
    let rows = match (feed_id, include_hidden) {
        (Some(fid), true) => sqlx::query("SELECT * FROM rss_articles WHERE feed_id = ? ORDER BY published_date DESC LIMIT ?")
            .bind(fid).bind(limit).fetch_all(repo.pool()).await,
        (Some(fid), false) => sqlx::query("SELECT * FROM rss_articles WHERE feed_id = ? AND (intelligence_score >= 0 OR intelligence_score IS NULL) ORDER BY published_date DESC LIMIT ?")
            .bind(fid).bind(limit).fetch_all(repo.pool()).await,
        (None, true) => sqlx::query("SELECT * FROM rss_articles ORDER BY published_date DESC LIMIT ?")
            .bind(limit).fetch_all(repo.pool()).await,
        (None, false) => sqlx::query("SELECT * FROM rss_articles WHERE (intelligence_score >= 0 OR intelligence_score IS NULL) ORDER BY published_date DESC LIMIT ?")
            .bind(limit).fetch_all(repo.pool()).await,
    }.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    Ok(rows.iter().map(|row| serde_json::json!({
        "id": row.get::<String, _>("id"), "feed_id": row.get::<String, _>("feed_id"), "title": row.get::<String, _>("title"),
        "intelligence_score": row.try_get::<Option<f64>, _>("intelligence_score").ok().flatten(),
    })).collect())
}

pub async fn compute_story_clusters_http(feed_id: Option<&str>, repo: &Repository) -> Result<Vec<RssStoryCluster>> {
    let cutoff = (Utc::now() - chrono::Duration::days(5)).to_rfc3339();
    let rows = if let Some(fid) = feed_id {
        sqlx::query("SELECT id, title FROM rss_articles WHERE feed_id = ? AND published_date > ? ORDER BY published_date DESC LIMIT 500")
            .bind(fid).bind(&cutoff).fetch_all(repo.pool()).await
    } else {
        sqlx::query("SELECT id, title FROM rss_articles WHERE published_date > ? ORDER BY published_date DESC LIMIT 500")
            .bind(&cutoff).fetch_all(repo.pool()).await
    }.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    let articles: Vec<(String, String)> = rows.iter().map(|r| (r.get("id"), r.get("title"))).collect();
    let mut clusters = Vec::new();
    let mut clustered: std::collections::HashSet<String> = std::collections::HashSet::new();
    for i in 0..articles.len() {
        if clustered.contains(&articles[i].0) { continue; }
        for j in (i + 1)..articles.len() {
            if clustered.contains(&articles[j].0) { continue; }
            let sim = trigram_similarity(&articles[i].1, &articles[j].1);
            if sim > 0.6 {
                let id = uuid::Uuid::new_v4().to_string();
                let now = Utc::now().to_rfc3339();
                let ct = if sim > 0.85 { "duplicate" } else { "related" };
                sqlx::query("INSERT INTO rss_story_clusters (id, canonical_article_id, article_id, similarity_score, cluster_type, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
                    .bind(&id).bind(&articles[i].0).bind(&articles[j].0).bind(sim).bind(ct).bind(&now)
                    .execute(repo.pool()).await.ok();
                clusters.push(RssStoryCluster { id, canonical_article_id: articles[i].0.clone(), article_id: articles[j].0.clone(), similarity_score: sim, cluster_type: ct.to_string(), created_at: now });
                clustered.insert(articles[j].0.clone());
            }
        }
    }
    Ok(clusters)
}

pub async fn get_rss_article_clusters_http(feed_id: Option<&str>, repo: &Repository) -> Result<Vec<RssStoryCluster>> {
    let rows = if let Some(fid) = feed_id {
        sqlx::query("SELECT c.* FROM rss_story_clusters c INNER JOIN rss_articles a ON c.canonical_article_id = a.id WHERE a.feed_id = ? ORDER BY c.similarity_score DESC LIMIT 200").bind(fid)
    } else {
        sqlx::query("SELECT * FROM rss_story_clusters ORDER BY similarity_score DESC LIMIT 500")
    }.fetch_all(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    Ok(rows.iter().map(|row| RssStoryCluster { id: row.get("id"), canonical_article_id: row.get("canonical_article_id"), article_id: row.get("article_id"), similarity_score: row.get("similarity_score"), cluster_type: row.get("cluster_type"), created_at: row.get("created_at") }).collect())
}

pub async fn invalidate_clusters_for_feed_http(feed_id: &str, repo: &Repository) -> Result<()> {
    sqlx::query("DELETE FROM rss_story_clusters WHERE canonical_article_id IN (SELECT id FROM rss_articles WHERE feed_id = ?) OR article_id IN (SELECT id FROM rss_articles WHERE feed_id = ?)")
        .bind(feed_id).bind(feed_id).execute(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    Ok(())
}

pub async fn add_tag_http(name: &str, repo: &Repository) -> Result<RssTag> {
    let existing: Option<(String, String, String)> = sqlx::query_as("SELECT id, name, created_at FROM rss_tags WHERE name = ?").bind(name).fetch_optional(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    if let Some((id, n, c)) = existing { return Ok(RssTag { id, name: n, created_at: c, article_count: None }); }
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    sqlx::query("INSERT INTO rss_tags (id, name, created_at) VALUES (?1, ?2, ?3)").bind(&id).bind(name).bind(&now).execute(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    Ok(RssTag { id, name: name.to_string(), created_at: now, article_count: None })
}

pub async fn remove_tag_http(tag_id: &str, repo: &Repository) -> Result<()> {
    sqlx::query("DELETE FROM rss_article_tags WHERE tag_id = ?").bind(tag_id).execute(repo.pool()).await.ok();
    sqlx::query("DELETE FROM rss_tags WHERE id = ?").bind(tag_id).execute(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    Ok(())
}

pub async fn get_all_tags_http(repo: &Repository) -> Result<Vec<RssTag>> {
    let rows = sqlx::query("SELECT t.id, t.name, t.created_at, COUNT(at.article_id) as cnt FROM rss_tags t LEFT JOIN rss_article_tags at ON t.id = at.tag_id GROUP BY t.id ORDER BY t.name").fetch_all(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    Ok(rows.iter().map(|row| RssTag { id: row.get("id"), name: row.get("name"), created_at: row.get("created_at"), article_count: row.try_get("cnt").ok() }).collect())
}

pub async fn get_article_tags_http(article_id: &str, repo: &Repository) -> Result<Vec<RssTag>> {
    let rows = sqlx::query("SELECT t.id, t.name, t.created_at FROM rss_tags t INNER JOIN rss_article_tags at ON t.id = at.tag_id WHERE at.article_id = ?").bind(article_id).fetch_all(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    Ok(rows.iter().map(|row| RssTag { id: row.get("id"), name: row.get("name"), created_at: row.get("created_at"), article_count: None }).collect())
}

pub async fn tag_article_http(article_id: &str, tag_id: &str, repo: &Repository) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    sqlx::query("INSERT OR IGNORE INTO rss_article_tags (article_id, tag_id, created_at) VALUES (?1, ?2, ?3)").bind(article_id).bind(tag_id).bind(&now).execute(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    Ok(())
}

pub async fn untag_article_http(article_id: &str, tag_id: &str, repo: &Repository) -> Result<()> {
    sqlx::query("DELETE FROM rss_article_tags WHERE article_id = ? AND tag_id = ?").bind(article_id).bind(tag_id).execute(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    Ok(())
}

pub async fn get_articles_by_tag_http(tag_id: &str, limit: Option<i32>, repo: &Repository) -> Result<Vec<serde_json::Value>> {
    let limit = limit.unwrap_or(50);
    let rows = sqlx::query("SELECT a.* FROM rss_articles a INNER JOIN rss_article_tags at ON a.id = at.article_id WHERE at.tag_id = ? AND a.is_queued = 1 ORDER BY a.date_added DESC LIMIT ?").bind(tag_id).bind(limit).fetch_all(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    Ok(rows.iter().map(|row| serde_json::json!({ "id": row.get::<String, _>("id"), "feed_id": row.get::<String, _>("feed_id"), "title": row.get::<String, _>("title") })).collect())
}

pub async fn rename_tag_http(tag_id: &str, new_name: &str, repo: &Repository) -> Result<()> {
    sqlx::query("UPDATE rss_tags SET name = ? WHERE id = ?").bind(new_name).bind(tag_id).execute(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    Ok(())
}

pub async fn merge_tags_http(source_tag_id: &str, target_tag_id: &str, repo: &Repository) -> Result<()> {
    sqlx::query("INSERT OR IGNORE INTO rss_article_tags (article_id, tag_id, created_at) SELECT article_id, ?, created_at FROM rss_article_tags WHERE tag_id = ?").bind(target_tag_id).bind(source_tag_id).execute(repo.pool()).await.ok();
    remove_tag_http(source_tag_id, repo).await
}

pub async fn create_annotation_http(article_id: &str, annotation_type: &str, content: &str, start_offset: Option<i32>, end_offset: Option<i32>, color: Option<&str>, repo: &Repository) -> Result<RssAnnotation> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    sqlx::query("INSERT INTO rss_annotations (id, article_id, annotation_type, content, start_offset, end_offset, color, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)")
        .bind(&id).bind(article_id).bind(annotation_type).bind(content).bind(start_offset).bind(end_offset).bind(color.unwrap_or("#FFFF00")).bind(&now).bind(&now)
        .execute(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    Ok(RssAnnotation { id, article_id: article_id.to_string(), annotation_type: annotation_type.to_string(), content: content.to_string(), start_offset, end_offset, color: color.map(|s| s.to_string()), created_at: now.clone(), updated_at: now })
}

pub async fn get_article_annotations_http(article_id: &str, repo: &Repository) -> Result<Vec<RssAnnotation>> {
    let rows = sqlx::query("SELECT * FROM rss_annotations WHERE article_id = ? ORDER BY created_at").bind(article_id).fetch_all(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    Ok(rows.iter().map(|row| RssAnnotation { id: row.get("id"), article_id: row.get("article_id"), annotation_type: row.get("annotation_type"), content: row.get("content"), start_offset: row.try_get("start_offset").ok(), end_offset: row.try_get("end_offset").ok(), color: row.try_get("color").ok(), created_at: row.get("created_at"), updated_at: row.get("updated_at") }).collect())
}

pub async fn update_annotation_http(id: &str, content: Option<&str>, color: Option<&str>, repo: &Repository) -> Result<RssAnnotation> {
    let now = Utc::now().to_rfc3339();
    let mut sets = vec!["updated_at = ?".to_string()];
    if content.is_some() { sets.push("content = ?".to_string()); }
    if color.is_some() { sets.push("color = ?".to_string()); }
    let qs = format!("UPDATE rss_annotations SET {} WHERE id = ?", sets.join(", "));
    let mut q = sqlx::query(&qs).bind(&now);
    if let Some(c) = content { q = q.bind(c); }
    if let Some(c) = color { q = q.bind(c); }
    q = q.bind(id);
    q.execute(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    let row = sqlx::query("SELECT * FROM rss_annotations WHERE id = ?").bind(id).fetch_one(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    Ok(RssAnnotation { id: row.get("id"), article_id: row.get("article_id"), annotation_type: row.get("annotation_type"), content: row.get("content"), start_offset: row.try_get("start_offset").ok(), end_offset: row.try_get("end_offset").ok(), color: row.try_get("color").ok(), created_at: row.get("created_at"), updated_at: row.get("updated_at") })
}

pub async fn delete_annotation_http(id: &str, repo: &Repository) -> Result<()> {
    sqlx::query("DELETE FROM rss_annotations WHERE id = ?").bind(id).execute(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    Ok(())
}

pub async fn get_discovered_sites_http(limit: Option<i32>, offset: Option<i32>, repo: &Repository) -> Result<Vec<RssDiscoveredSite>> {
    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);
    let rows = sqlx::query("SELECT * FROM rss_discovered_sites ORDER BY discovered_at DESC LIMIT ? OFFSET ?").bind(limit).bind(offset).fetch_all(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    Ok(rows.iter().map(|row| RssDiscoveredSite { id: row.get("id"), url: row.get("url"), title: row.get("title"), description: row.get("description"), feed_url: row.get("feed_url"), similarity_source: row.get("similarity_source"), discovered_at: row.get("discovered_at") }).collect())
}

pub async fn delete_discovered_site_http(id: &str, repo: &Repository) -> Result<()> {
    sqlx::query("DELETE FROM rss_discovered_sites WHERE id = ?").bind(id).execute(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    Ok(())
}

pub async fn reorder_folders_http(reorder: Vec<(String, i32)>, repo: &Repository) -> Result<()> {
    for (folder_id, sort_order) in reorder {
        sqlx::query("UPDATE rss_folders SET sort_order = ? WHERE id = ?").bind(sort_order).bind(&folder_id).execute(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    }
    Ok(())
}

pub async fn set_feed_view_preferences_http(feed_id: &str, view_mode: Option<&str>, layout: Option<&str>, repo: &Repository) -> Result<()> {
    match (view_mode, layout) {
        (Some(vm), Some(l)) => {
            sqlx::query("UPDATE rss_feeds SET view_mode = ?, layout = ? WHERE id = ?")
                .bind(vm).bind(l).bind(feed_id)
                .execute(repo.pool()).await
        }
        (Some(vm), None) => {
            sqlx::query("UPDATE rss_feeds SET view_mode = ? WHERE id = ?")
                .bind(vm).bind(feed_id)
                .execute(repo.pool()).await
        }
        (None, Some(l)) => {
            sqlx::query("UPDATE rss_feeds SET layout = ? WHERE id = ?")
                .bind(l).bind(feed_id)
                .execute(repo.pool()).await
        }
        (None, None) => return Ok(()),
    }.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    Ok(())
}

pub async fn recompute_all_intelligence_scores_http(repo: &Repository) -> Result<i32> {
    let article_ids: Vec<String> = sqlx::query_scalar("SELECT id FROM rss_articles WHERE intelligence_score_computed_at IS NULL LIMIT 1000").fetch_all(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
    let mut count = 0;
    for article_id in article_ids {
        let article: Option<(String, String, Option<String>, Option<String>)> = sqlx::query_as("SELECT feed_id, title, author, content FROM rss_articles WHERE id = ?").bind(&article_id).fetch_optional(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
        if let Some((feed_id, title, author, _content)) = article {
            let title_lower = title.to_lowercase();
            let author_lower = author.as_ref().map(|a| a.to_lowercase());
            let classifiers: Vec<(String, String, String)> = sqlx::query_as(r#"SELECT classifier_type, value, sentiment FROM rss_classifiers WHERE feed_id = ? OR scope IN ('folder', 'global')"#).bind(&feed_id).fetch_all(repo.pool()).await.unwrap_or_default();
            let mut score: f64 = 0.0;
            for (ct, val, sent) in &classifiers {
                let val_l = val.to_lowercase();
                let matches = match ct.as_str() { "author" => author_lower.as_ref().is_some_and(|a| a.contains(&val_l)), "title" => title_lower.contains(&val_l), "feed" => true, "tag" => title_lower.contains(&val_l), _ => false };
                if matches { match sent.as_str() { "like" => score += 1.0, "dislike" => score -= 1.0, _ => {} } }
            }
            let now = Utc::now().to_rfc3339();
            sqlx::query("UPDATE rss_articles SET intelligence_score = ?, intelligence_score_computed_at = ? WHERE id = ?").bind(score).bind(&now).bind(&article_id).execute(repo.pool()).await.ok();
            count += 1;
        }
    }
    Ok(count)
}

/// Migrate localStorage folders to SQLite (one-time)
/// Called from frontend with the current localStorage folder data
#[tauri::command]
pub async fn migrate_folders_from_localstorage(
    folders_json: String, // JSON array of {id, name, feeds: string[]}
    repo: State<'_, Repository>,
) -> Result<i32> {
    let folders: Vec<serde_json::Value> = serde_json::from_str(&folders_json)
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Invalid JSON: {}", e)))?;

    let mut migrated = 0i32;
    for (idx, folder) in folders.iter().enumerate() {
        let id = folder.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let name = folder.get("name").and_then(|v| v.as_str()).unwrap_or("Unnamed").to_string();

        if id.is_empty() {
            continue;
        }

        let exists: Option<String> = sqlx::query_scalar("SELECT id FROM rss_folders WHERE id = ?")
            .bind(&id)
            .fetch_optional(repo.pool())
            .await
            .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;

        if exists.is_some() {
            continue;
        }

        let now = Utc::now().to_rfc3339();
        sqlx::query("INSERT INTO rss_folders (id, name, parent_id, icon, sort_order, created_at) VALUES (?, ?, NULL, NULL, ?, ?)")
            .bind(&id)
            .bind(&name)
            .bind(idx as i32)
            .bind(&now)
            .execute(repo.pool())
            .await
            .map_err(|e| crate::error::IncrementumError::Internal(format!("Failed to create folder: {}", e)))?;

        if let Some(feeds) = folder.get("feeds").and_then(|v| v.as_array()) {
            for (feed_idx, feed_id_val) in feeds.iter().enumerate() {
                if let Some(feed_id) = feed_id_val.as_str() {
                    sqlx::query("INSERT OR IGNORE INTO rss_feed_folders (feed_id, folder_id, sort_order) VALUES (?, ?, ?)")
                        .bind(feed_id)
                        .bind(&id)
                        .bind(feed_idx as i32)
                        .execute(repo.pool())
                        .await
                        .ok();
                }
            }
        }

        migrated += 1;
    }

    Ok(migrated)
}

pub async fn migrate_folders_from_localstorage_http(folders_json: &str, repo: &Repository) -> Result<i32> {
    let folders: Vec<serde_json::Value> = serde_json::from_str(folders_json)
        .map_err(|e| crate::error::IncrementumError::Internal(format!("Invalid JSON: {}", e)))?;

    let mut migrated = 0i32;
    for (idx, folder) in folders.iter().enumerate() {
        let id = folder.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let name = folder.get("name").and_then(|v| v.as_str()).unwrap_or("Unnamed").to_string();
        if id.is_empty() { continue; }
        let exists: Option<String> = sqlx::query_scalar("SELECT id FROM rss_folders WHERE id = ?").bind(&id).fetch_optional(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
        if exists.is_some() { continue; }
        let now = Utc::now().to_rfc3339();
        sqlx::query("INSERT INTO rss_folders (id, name, parent_id, icon, sort_order, created_at) VALUES (?, ?, NULL, NULL, ?, ?)").bind(&id).bind(&name).bind(idx as i32).bind(&now).execute(repo.pool()).await.map_err(|e| crate::error::IncrementumError::Internal(format!("Failed: {}", e)))?;
        if let Some(feeds) = folder.get("feeds").and_then(|v| v.as_array()) {
            for (feed_idx, feed_id_val) in feeds.iter().enumerate() {
                if let Some(feed_id) = feed_id_val.as_str() {
                    sqlx::query("INSERT OR IGNORE INTO rss_feed_folders (feed_id, folder_id, sort_order) VALUES (?, ?, ?)").bind(feed_id).bind(&id).bind(feed_idx as i32).execute(repo.pool()).await.ok();
                }
            }
        }
        migrated += 1;
    }
    Ok(migrated)
}

/// Seed curated feeds into rss_discovered_sites from the awesome-rss-feeds list.
/// Uses INSERT OR IGNORE to avoid duplicates if called multiple times.
#[tauri::command]
pub async fn seed_curated_feeds(repo: State<'_, Repository>) -> Result<i32> {
    let feeds = crate::commands::curated_feeds::get_curated_feeds();
    let now = chrono::Utc::now().to_rfc3339();
    let mut inserted = 0i32;

    for feed in &feeds {
        let exists: bool = sqlx::query_scalar(
            "SELECT COUNT(*) > 0 FROM rss_discovered_sites WHERE feed_url = ? OR url = ?"
        )
        .bind(&feed.feed_url)
        .bind(&feed.site_url)
        .fetch_one(repo.pool())
        .await
        .unwrap_or(false);

        if exists {
            continue;
        }

        let id = uuid::Uuid::new_v4().to_string();
        let result = sqlx::query(
            "INSERT OR IGNORE INTO rss_discovered_sites (id, url, title, description, feed_url, similarity_source, discovered_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(&feed.site_url)
        .bind(&feed.title)
        .bind(&feed.category)
        .bind(&feed.feed_url)
        .bind(&feed.category)
        .bind(&now)
        .execute(repo.pool())
        .await;

        if result.is_ok() {
            inserted += 1;
        }
    }

    Ok(inserted)
}
