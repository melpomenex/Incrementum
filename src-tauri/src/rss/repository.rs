//! RSS Feature Repository
//!
//! Database operations for RSS features.
//! All database queries are centralized here.

use crate::database::Repository;
use crate::error::{IncrementumError, Result};
use crate::rss::models::*;
use chrono::Utc;
use sqlx::Row;
use sqlx::sqlite::SqliteRow;

/// Helper function to decode optional text from a row, handling potential encoding issues
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

/// Add a new classifier
pub async fn add_classifier(
    repo: &Repository,
    feed_id: &str,
    classifier_type: &str,
    value: &str,
    sentiment: &str,
    scope: &str,
) -> Result<RssClassifier> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        r#"INSERT INTO rss_classifiers (id, feed_id, classifier_type, value, sentiment, scope, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"#,
    )
    .bind(&id)
    .bind(feed_id)
    .bind(classifier_type)
    .bind(value)
    .bind(sentiment)
    .bind(scope)
    .bind(&now)
    .bind(&now)
    .execute(repo.pool())
    .await
    .map_err(|e| IncrementumError::Internal(format!("Failed to add classifier: {}", e)))?;

    Ok(RssClassifier {
        id,
        feed_id: feed_id.to_string(),
        classifier_type: classifier_type.to_string(),
        value: value.to_string(),
        sentiment: sentiment.to_string(),
        scope: scope.to_string(),
        created_at: now.clone(),
        updated_at: now,
    })
}

/// Remove a classifier by ID
pub async fn remove_classifier(repo: &Repository, id: &str) -> Result<Option<String>> {
    let feed_id: Option<String> =
        sqlx::query_scalar("SELECT feed_id FROM rss_classifiers WHERE id = ?")
            .bind(id)
            .fetch_optional(repo.pool())
            .await
            .map_err(|e| IncrementumError::Internal(format!("Failed to get classifier: {}", e)))?
            .flatten();

    sqlx::query("DELETE FROM rss_classifiers WHERE id = ?")
        .bind(id)
        .execute(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to remove classifier: {}", e)))?;

    Ok(feed_id)
}

/// Invalidate intelligence scores for articles in a feed
pub async fn invalidate_intelligence_scores(repo: &Repository, feed_id: &str) -> Result<()> {
    sqlx::query("UPDATE rss_articles SET intelligence_score_computed_at = NULL WHERE feed_id = ?")
        .bind(feed_id)
        .execute(repo.pool())
        .await
        .ok();
    Ok(())
}

/// Get classifiers with optional filters
pub async fn get_classifiers(
    repo: &Repository,
    feed_id: Option<&str>,
    classifier_type: Option<&str>,
    sentiment: Option<&str>,
    scope: Option<&str>,
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

    let query_str = format!(
        "SELECT * FROM rss_classifiers {} ORDER BY classifier_type, value",
        where_clause
    );

    let mut query = sqlx::query(&query_str);
    if let Some(fid) = feed_id {
        query = query.bind(fid);
    }
    if let Some(ct) = classifier_type {
        query = query.bind(ct);
    }
    if let Some(s) = sentiment {
        query = query.bind(s);
    }
    if let Some(sc) = scope {
        query = query.bind(sc);
    }

    let rows = query.fetch_all(repo.pool()).await.map_err(|e| {
        IncrementumError::Internal(format!("Failed to fetch classifiers: {}", e))
    })?;

    let classifiers = rows
        .iter()
        .map(|row| RssClassifier {
            id: row.get("id"),
            feed_id: row.get("feed_id"),
            classifier_type: row.get("classifier_type"),
            value: row.get("value"),
            sentiment: row.get("sentiment"),
            scope: row.get("scope"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
        .collect();

    Ok(classifiers)
}

/// Update classifier sentiment
pub async fn update_classifier_sentiment(
    repo: &Repository,
    id: &str,
    sentiment: &str,
) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    sqlx::query("UPDATE rss_classifiers SET sentiment = ?, updated_at = ? WHERE id = ?")
        .bind(sentiment)
        .bind(&now)
        .bind(id)
        .execute(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to update classifier: {}", e)))?;
    Ok(())
}

/// Update classifier value
pub async fn update_classifier_value(
    repo: &Repository,
    id: &str,
    value: &str,
) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    sqlx::query("UPDATE rss_classifiers SET value = ?, updated_at = ? WHERE id = ?")
        .bind(value)
        .bind(&now)
        .bind(id)
        .execute(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to update classifier: {}", e)))?;
    Ok(())
}

/// Get feed_id for a classifier
pub async fn get_classifier_feed_id(repo: &Repository, id: &str) -> Result<Option<String>> {
    let feed_id: Option<String> =
        sqlx::query_scalar("SELECT feed_id FROM rss_classifiers WHERE id = ?")
            .bind(id)
            .fetch_optional(repo.pool())
            .await
            .map_err(|e| IncrementumError::Internal(format!("Failed to get classifier: {}", e)))?
            .flatten();
    Ok(feed_id)
}

/// Mark an article as unread
pub async fn mark_article_unread(repo: &Repository, id: &str) -> Result<()> {
    sqlx::query("UPDATE rss_articles SET is_read = 0 WHERE id = ?")
        .bind(id)
        .execute(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to mark unread: {}", e)))?;
    Ok(())
}

/// Mark articles before a date as read
pub async fn mark_articles_before_date_read(
    repo: &Repository,
    feed_id: Option<&str>,
    before_date: &str,
) -> Result<u64> {
    let query = if let Some(fid) = feed_id {
        format!(
            "UPDATE rss_articles SET is_read = 1 WHERE feed_id = '{}' AND published_date < '{}' AND is_read = 0",
            fid, before_date
        )
    } else {
        format!(
            "UPDATE rss_articles SET is_read = 1 WHERE published_date < '{}' AND is_read = 0",
            before_date
        )
    };

    let result = sqlx::query(&query)
        .execute(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to mark articles: {}", e)))?;

    Ok(result.rows_affected())
}

/// Mark articles after a date as read
pub async fn mark_articles_after_date_read(
    repo: &Repository,
    feed_id: Option<&str>,
    after_date: &str,
) -> Result<u64> {
    let query = if let Some(fid) = feed_id {
        format!(
            "UPDATE rss_articles SET is_read = 1 WHERE feed_id = '{}' AND published_date > '{}' AND is_read = 0",
            fid, after_date
        )
    } else {
        format!(
            "UPDATE rss_articles SET is_read = 1 WHERE published_date > '{}' AND is_read = 0",
            after_date
        )
    };

    let result = sqlx::query(&query)
        .execute(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to mark articles: {}", e)))?;

    Ok(result.rows_affected())
}

/// Auto-mark articles as read based on feed settings
pub async fn auto_mark_articles_as_read(repo: &Repository) -> Result<u64> {
    // Apply auto-mark for feeds with auto_mark_after_days set
    let feeds: Vec<(String, i32)> = sqlx::query_as(
        "SELECT id, auto_mark_after_days FROM rss_feeds WHERE auto_mark_after_days IS NOT NULL AND is_active = 1"
    )
    .fetch_all(repo.pool())
    .await
    .map_err(|e| IncrementumError::Internal(format!("Failed to get feeds: {}", e)))?;

    let mut total = 0u64;
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
        .map_err(|e| IncrementumError::Internal(format!("Failed to auto-mark: {}", e)))?;

        total += result.rows_affected();
    }

    Ok(total)
}

/// Get read articles
pub async fn get_read_articles(
    repo: &Repository,
    limit: i32,
    offset: i32,
) -> Result<Vec<serde_json::Value>> {
    let rows = sqlx::query(
        "SELECT * FROM rss_articles WHERE is_read = 1 ORDER BY date_added DESC LIMIT ? OFFSET ?",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(repo.pool())
    .await
    .map_err(|e| IncrementumError::Internal(format!("Failed to fetch read articles: {}", e)))?;

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

/// Get river of news for a folder
pub async fn get_river_of_news(
    repo: &Repository,
    folder_id: &str,
    limit: i32,
    intelligence_filter: Option<&str>,
) -> Result<Vec<serde_json::Value>> {
    let mut conditions = vec!["ff.folder_id = ?".to_string(), "a.is_read = 0".to_string()];

    if intelligence_filter == Some("focus") {
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
        .bind(folder_id)
        .fetch_all(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to fetch river: {}", e)))?;

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

/// Search articles using FTS
pub async fn search_articles(
    repo: &Repository,
    query: &str,
    feed_id: Option<&str>,
    folder_id: Option<&str>,
    scope: Option<&str>,
    limit: i32,
) -> Result<Vec<RssSearchResult>> {
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

    let mut sql_query = sqlx::query_as::<
        _,
        (String, String, Option<String>, String, Option<String>, f64),
    >(&full_query);
    sql_query = sql_query.bind(&fts_query);
    if let Some(folid) = folder_id {
        sql_query = sql_query.bind(folid);
    } else if let Some(fid) = feed_id {
        sql_query = sql_query.bind(fid);
    }
    sql_query = sql_query.bind(limit);

    let rows = sql_query
        .fetch_all(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Search failed: {}", e)))?;

    let results = rows
        .iter()
        .map(|(id, title, snippet, feed_id, pub_date, rank)| RssSearchResult {
            article_id: id.clone(),
            title: title.clone(),
            snippet: snippet.clone(),
            feed_id: feed_id.clone(),
            published_date: pub_date.clone(),
            rank: *rank,
        })
        .collect();

    Ok(results)
}

/// Get recent articles for clustering
pub async fn get_recent_articles_for_clustering(
    repo: &Repository,
    feed_id: Option<&str>,
    cutoff: &str,
) -> Result<Vec<(String, String)>> {
    let rows = if let Some(fid) = feed_id {
        sqlx::query(
            "SELECT id, title FROM rss_articles WHERE feed_id = ? AND published_date > ? ORDER BY published_date DESC LIMIT 500"
        )
        .bind(fid)
        .bind(cutoff)
    } else {
        sqlx::query(
            "SELECT id, title FROM rss_articles WHERE published_date > ? ORDER BY published_date DESC LIMIT 500"
        )
        .bind(cutoff)
    }
    .fetch_all(repo.pool())
    .await
    .map_err(|e| IncrementumError::Internal(format!("Failed to get articles: {}", e)))?;

    let articles: Vec<(String, String)> = rows
        .iter()
        .map(|r| (r.get("id"), r.get("title")))
        .collect();

    Ok(articles)
}

/// Create a story cluster
pub async fn create_cluster(
    repo: &Repository,
    canonical_article_id: &str,
    article_id: &str,
    similarity_score: f64,
    cluster_type: &str,
) -> Result<RssStoryCluster> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO rss_story_clusters (id, canonical_article_id, article_id, similarity_score, cluster_type, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
    )
    .bind(&id)
    .bind(canonical_article_id)
    .bind(article_id)
    .bind(similarity_score)
    .bind(cluster_type)
    .bind(&now)
    .execute(repo.pool())
    .await
    .ok();

    Ok(RssStoryCluster {
        id,
        canonical_article_id: canonical_article_id.to_string(),
        article_id: article_id.to_string(),
        similarity_score,
        cluster_type: cluster_type.to_string(),
        created_at: now,
    })
}

/// Get story clusters
pub async fn get_story_clusters(
    repo: &Repository,
    feed_id: Option<&str>,
) -> Result<Vec<RssStoryCluster>> {
    let rows = if let Some(fid) = feed_id {
        sqlx::query(
            "SELECT c.* FROM rss_story_clusters c \
             INNER JOIN rss_articles a ON c.canonical_article_id = a.id \
             WHERE a.feed_id = ? ORDER BY c.similarity_score DESC LIMIT 200",
        )
        .bind(fid)
    } else {
        sqlx::query("SELECT * FROM rss_story_clusters ORDER BY similarity_score DESC LIMIT 500")
    }
    .fetch_all(repo.pool())
    .await
    .map_err(|e| IncrementumError::Internal(format!("Failed to get clusters: {}", e)))?;

    let clusters = rows
        .iter()
        .map(|row| RssStoryCluster {
            id: row.get("id"),
            canonical_article_id: row.get("canonical_article_id"),
            article_id: row.get("article_id"),
            similarity_score: row.get("similarity_score"),
            cluster_type: row.get("cluster_type"),
            created_at: row.get("created_at"),
        })
        .collect();

    Ok(clusters)
}

/// Invalidate clusters for a feed
pub async fn invalidate_clusters_for_feed(repo: &Repository, feed_id: &str) -> Result<()> {
    sqlx::query(
        "DELETE FROM rss_story_clusters WHERE canonical_article_id IN \
         (SELECT id FROM rss_articles WHERE feed_id = ?) \
         OR article_id IN (SELECT id FROM rss_articles WHERE feed_id = ?)",
    )
    .bind(feed_id)
    .bind(feed_id)
    .execute(repo.pool())
    .await
    .map_err(|e| IncrementumError::Internal(format!("Failed to invalidate clusters: {}", e)))?;

    Ok(())
}

/// Get tag by name
pub async fn get_tag_by_name(repo: &Repository, name: &str) -> Result<Option<RssTag>> {
    let existing: Option<(String, String, String)> =
        sqlx::query_as("SELECT id, name, created_at FROM rss_tags WHERE name = ?")
            .bind(name)
            .fetch_optional(repo.pool())
            .await
            .map_err(|e| IncrementumError::Internal(format!("Failed to check tag: {}", e)))?;

    Ok(existing.map(|(id, name, created_at)| RssTag {
        id,
        name,
        created_at,
        article_count: None,
    }))
}

/// Create a new tag
pub async fn create_tag(repo: &Repository, name: &str) -> Result<RssTag> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query("INSERT INTO rss_tags (id, name, created_at) VALUES (?1, ?2, ?3)")
        .bind(&id)
        .bind(name)
        .bind(&now)
        .execute(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to create tag: {}", e)))?;

    Ok(RssTag {
        id,
        name: name.to_string(),
        created_at: now,
        article_count: None,
    })
}

/// Remove a tag and all its associations
pub async fn remove_tag(repo: &Repository, tag_id: &str) -> Result<()> {
    sqlx::query("DELETE FROM rss_article_tags WHERE tag_id = ?")
        .bind(tag_id)
        .execute(repo.pool())
        .await
        .ok();

    sqlx::query("DELETE FROM rss_tags WHERE id = ?")
        .bind(tag_id)
        .execute(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to remove tag: {}", e)))?;

    Ok(())
}

/// Get tags for an article
pub async fn get_article_tags(repo: &Repository, article_id: &str) -> Result<Vec<RssTag>> {
    let rows = sqlx::query(
        "SELECT t.id, t.name, t.created_at FROM rss_tags t \
         INNER JOIN rss_article_tags at ON t.id = at.tag_id \
         WHERE at.article_id = ? ORDER BY t.name",
    )
    .bind(article_id)
    .fetch_all(repo.pool())
    .await
    .map_err(|e| IncrementumError::Internal(format!("Failed to get article tags: {}", e)))?;

    let tags = rows
        .iter()
        .map(|row| RssTag {
            id: row.get("id"),
            name: row.get("name"),
            created_at: row.get("created_at"),
            article_count: None,
        })
        .collect();

    Ok(tags)
}

/// Get all tags with article counts
pub async fn get_all_tags(repo: &Repository) -> Result<Vec<RssTag>> {
    let rows = sqlx::query(
        "SELECT t.id, t.name, t.created_at, COUNT(at.article_id) as article_count \
         FROM rss_tags t LEFT JOIN rss_article_tags at ON t.id = at.tag_id \
         GROUP BY t.id ORDER BY t.name",
    )
    .fetch_all(repo.pool())
    .await
    .map_err(|e| IncrementumError::Internal(format!("Failed to get tags: {}", e)))?;

    let tags = rows
        .iter()
        .map(|row| RssTag {
            id: row.get("id"),
            name: row.get("name"),
            created_at: row.get("created_at"),
            article_count: row.try_get("article_count").ok(),
        })
        .collect();

    Ok(tags)
}

/// Tag an article
pub async fn tag_article(repo: &Repository, article_id: &str, tag_id: &str) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    sqlx::query("INSERT OR IGNORE INTO rss_article_tags (article_id, tag_id, created_at) VALUES (?1, ?2, ?3)")
        .bind(article_id)
        .bind(tag_id)
        .bind(&now)
        .execute(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to tag article: {}", e)))?;

    Ok(())
}

/// Untag an article
pub async fn untag_article(repo: &Repository, article_id: &str, tag_id: &str) -> Result<()> {
    sqlx::query("DELETE FROM rss_article_tags WHERE article_id = ? AND tag_id = ?")
        .bind(article_id)
        .bind(tag_id)
        .execute(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to untag article: {}", e)))?;

    Ok(())
}

/// Get articles by tag
pub async fn get_articles_by_tag(
    repo: &Repository,
    tag_id: &str,
    limit: i32,
) -> Result<Vec<serde_json::Value>> {
    let rows = sqlx::query(
        "SELECT a.* FROM rss_articles a \
         INNER JOIN rss_article_tags at ON a.id = at.article_id \
         WHERE at.tag_id = ? AND a.is_queued = 1 \
         ORDER BY a.date_added DESC LIMIT ?",
    )
    .bind(tag_id)
    .bind(limit)
    .fetch_all(repo.pool())
    .await
    .map_err(|e| IncrementumError::Internal(format!("Failed to get articles by tag: {}", e)))?;

    let articles: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
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
        })
        .collect();

    Ok(articles)
}

/// Rename a tag
pub async fn rename_tag(repo: &Repository, tag_id: &str, new_name: &str) -> Result<()> {
    sqlx::query("UPDATE rss_tags SET name = ? WHERE id = ?")
        .bind(new_name)
        .bind(tag_id)
        .execute(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to rename tag: {}", e)))?;
    Ok(())
}

/// Merge source tag into target tag
pub async fn merge_tags(repo: &Repository, source_tag_id: &str, target_tag_id: &str) -> Result<()> {
    sqlx::query(
        "INSERT OR IGNORE INTO rss_article_tags (article_id, tag_id, created_at) \
         SELECT article_id, ?, created_at FROM rss_article_tags WHERE tag_id = ?",
    )
    .bind(target_tag_id)
    .bind(source_tag_id)
    .execute(repo.pool())
    .await
    .map_err(|e| IncrementumError::Internal(format!("Failed to merge tag associations: {}", e)))?;

    Ok(())
}

/// Create an annotation
pub async fn create_annotation(
    repo: &Repository,
    article_id: &str,
    annotation_type: &str,
    content: &str,
    start_offset: Option<i32>,
    end_offset: Option<i32>,
    color: Option<&str>,
) -> Result<RssAnnotation> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO rss_annotations (id, article_id, annotation_type, content, start_offset, end_offset, color, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"
    )
    .bind(&id)
    .bind(article_id)
    .bind(annotation_type)
    .bind(content)
    .bind(start_offset)
    .bind(end_offset)
    .bind(color.unwrap_or("#FFFF00"))
    .bind(&now)
    .bind(&now)
    .execute(repo.pool())
    .await
    .map_err(|e| IncrementumError::Internal(format!("Failed to create annotation: {}", e)))?;

    Ok(RssAnnotation {
        id,
        article_id: article_id.to_string(),
        annotation_type: annotation_type.to_string(),
        content: content.to_string(),
        start_offset,
        end_offset,
        color: color.map(|s| s.to_string()),
        created_at: now.clone(),
        updated_at: now,
    })
}

/// Get annotations for an article
pub async fn get_article_annotations(
    repo: &Repository,
    article_id: &str,
) -> Result<Vec<RssAnnotation>> {
    let rows =
        sqlx::query("SELECT * FROM rss_annotations WHERE article_id = ? ORDER BY created_at")
            .bind(article_id)
            .fetch_all(repo.pool())
            .await
            .map_err(|e| IncrementumError::Internal(format!("Failed to get annotations: {}", e)))?;

    let annotations = rows
        .iter()
        .map(|row| RssAnnotation {
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
        .collect();

    Ok(annotations)
}

/// Get annotation by ID
pub async fn get_annotation_by_id(
    repo: &Repository,
    id: &str,
) -> Result<Option<SqliteRow>> {
    let row = sqlx::query("SELECT * FROM rss_annotations WHERE id = ?")
        .bind(id)
        .fetch_optional(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to get annotation: {}", e)))?;

    Ok(row)
}

/// Update annotation content and color
pub async fn update_annotation(
    repo: &Repository,
    id: &str,
    content: Option<&str>,
    color: Option<&str>,
) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    let mut sets = vec!["updated_at = ?".to_string()];

    if content.is_some() {
        sets.push("content = ?".to_string());
    }
    if color.is_some() {
        sets.push("color = ?".to_string());
    }

    let query_str = format!(
        "UPDATE rss_annotations SET {} WHERE id = ?",
        sets.join(", ")
    );

    let mut query = sqlx::query(&query_str).bind(&now);
    if let Some(c) = content {
        query = query.bind(c);
    }
    if let Some(c) = color {
        query = query.bind(c);
    }
    query = query.bind(id);
    query.execute(repo.pool()).await.map_err(|e| {
        IncrementumError::Internal(format!("Failed to update annotation: {}", e))
    })?;

    Ok(())
}

/// Delete an annotation
pub async fn delete_annotation(repo: &Repository, id: &str) -> Result<()> {
    sqlx::query("DELETE FROM rss_annotations WHERE id = ?")
        .bind(id)
        .execute(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to delete annotation: {}", e)))?;
    Ok(())
}

/// Get discovered sites
pub async fn get_discovered_sites(
    repo: &Repository,
    limit: i32,
    offset: i32,
) -> Result<Vec<RssDiscoveredSite>> {
    let rows = sqlx::query(
        "SELECT * FROM rss_discovered_sites ORDER BY discovered_at DESC LIMIT ? OFFSET ?",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(repo.pool())
    .await
    .map_err(|e| IncrementumError::Internal(format!("Failed to get discovered sites: {}", e)))?;

    let sites = rows
        .iter()
        .map(|row| RssDiscoveredSite {
            id: row.get("id"),
            url: row.get("url"),
            title: row.get("title"),
            description: row.get("description"),
            feed_url: row.get("feed_url"),
            similarity_source: row.get("similarity_source"),
            discovered_at: row.get("discovered_at"),
        })
        .collect();

    Ok(sites)
}

/// Delete a discovered site
pub async fn delete_discovered_site(repo: &Repository, id: &str) -> Result<()> {
    sqlx::query("DELETE FROM rss_discovered_sites WHERE id = ?")
        .bind(id)
        .execute(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to delete discovered site: {}", e)))?;
    Ok(())
}

/// Check if a discovered site exists by URL pattern
pub async fn discovered_site_exists(repo: &Repository, url_pattern: &str) -> Result<bool> {
    let exists: bool =
        sqlx::query_scalar("SELECT COUNT(*) > 0 FROM rss_discovered_sites WHERE url LIKE ?")
            .bind(url_pattern)
            .fetch_one(repo.pool())
            .await
            .unwrap_or(false);

    Ok(exists)
}

/// Create a discovered site
pub async fn create_discovered_site(
    repo: &Repository,
    url: &str,
    title: Option<&str>,
    description: Option<&str>,
    feed_url: Option<&str>,
) -> Result<()> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO rss_discovered_sites (id, url, title, description, feed_url, discovered_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
    )
    .bind(&id)
    .bind(url)
    .bind(title)
    .bind(description)
    .bind(feed_url)
    .bind(&now)
    .execute(repo.pool())
    .await
    .ok();

    Ok(())
}

/// Get recent articles for discovery
pub async fn get_recent_articles_for_discovery(
    repo: &Repository,
) -> Result<Vec<(String, String)>> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT url, feed_id FROM rss_articles WHERE date_added > datetime('now', '-7 days') LIMIT 500"
    )
    .fetch_all(repo.pool())
    .await
    .map_err(|e| IncrementumError::Internal(format!("Failed to get recent articles: {}", e)))?;

    Ok(rows)
}

/// Get subscribed feed URLs
pub async fn get_subscribed_feed_urls(repo: &Repository) -> Result<Vec<String>> {
    let subscribed: Vec<String> = sqlx::query_scalar("SELECT url FROM rss_feeds")
        .fetch_all(repo.pool())
        .await
        .unwrap_or_default();

    Ok(subscribed)
}

/// Check if feed URL already exists in discovered sites
pub async fn discovered_site_by_feed_url_exists(
    repo: &Repository,
    feed_url: &str,
) -> Result<bool> {
    let exists: bool = sqlx::query_scalar(
        "SELECT COUNT(*) > 0 FROM rss_discovered_sites WHERE feed_url = ? OR url = ?",
    )
    .bind(feed_url)
    .bind(feed_url)
    .fetch_one(repo.pool())
    .await
    .unwrap_or(false);

    Ok(exists)
}

/// Create a folder
pub async fn create_folder(
    repo: &Repository,
    name: &str,
    parent_id: Option<&str>,
    icon: Option<&str>,
    auto_mark_after_days: Option<i32>,
) -> Result<RssFolder> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO rss_folders (id, name, parent_id, icon, sort_order, auto_mark_after_days, created_at) VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6)"
    )
    .bind(&id)
    .bind(name)
    .bind(parent_id)
    .bind(icon)
    .bind(auto_mark_after_days)
    .bind(&now)
    .execute(repo.pool())
    .await
    .map_err(|e| IncrementumError::Internal(format!("Failed to create folder: {}", e)))?;

    Ok(RssFolder {
        id,
        name: name.to_string(),
        parent_id: parent_id.map(|s| s.to_string()),
        icon: icon.map(|s| s.to_string()),
        sort_order: 0,
        auto_mark_after_days,
        created_at: now,
        feed_ids: Vec::new(),
    })
}

/// Get folder by ID
pub async fn get_folder_by_id(repo: &Repository, id: &str) -> Result<Option<RssFolder>> {
    let row = sqlx::query("SELECT * FROM rss_folders WHERE id = ?")
        .bind(id)
        .fetch_optional(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to get folder: {}", e)))?;

    match row {
        Some(row) => {
            let folder_id: String = row.get("id");
            let feed_ids: Vec<String> = sqlx::query_scalar(
                "SELECT feed_id FROM rss_feed_folders WHERE folder_id = ? ORDER BY sort_order",
            )
            .bind(&folder_id)
            .fetch_all(repo.pool())
            .await
            .unwrap_or_default();

            Ok(Some(RssFolder {
                id: row.get("id"),
                name: row.get("name"),
                parent_id: row.get("parent_id"),
                icon: row.get("icon"),
                sort_order: row.get("sort_order"),
                auto_mark_after_days: row.get("auto_mark_after_days"),
                created_at: row.get("created_at"),
                feed_ids,
            }))
        }
        None => Ok(None),
    }
}

/// Update folder
pub async fn update_folder(
    repo: &Repository,
    id: &str,
    name: Option<&str>,
    parent_id: Option<Option<&str>>,
    icon: Option<Option<&str>>,
    sort_order: Option<i32>,
    auto_mark_after_days: Option<Option<i32>>,
) -> Result<()> {
    let mut sets = Vec::new();

    if name.is_some() {
        sets.push("name = ?".to_string());
    }
    if parent_id.is_some() {
        sets.push("parent_id = ?".to_string());
    }
    if icon.is_some() {
        sets.push("icon = ?".to_string());
    }
    if sort_order.is_some() {
        sets.push("sort_order = ?".to_string());
    }
    if auto_mark_after_days.is_some() {
        sets.push("auto_mark_after_days = ?".to_string());
    }

    if sets.is_empty() {
        return Ok(());
    }

    let query_str = format!("UPDATE rss_folders SET {} WHERE id = ?", sets.join(", "));
    let mut query = sqlx::query(&query_str);

    if let Some(n) = name {
        query = query.bind(n);
    }
    if let Some(p) = parent_id {
        query = query.bind(p);
    }
    if let Some(i) = icon {
        query = query.bind(i);
    }
    if let Some(s) = sort_order {
        query = query.bind(s);
    }
    if let Some(a) = auto_mark_after_days {
        query = query.bind(a);
    }
    query = query.bind(id);

    query.execute(repo.pool()).await.map_err(|e| {
        IncrementumError::Internal(format!("Failed to update folder: {}", e))
    })?;

    Ok(())
}

/// Delete a folder
pub async fn delete_folder(
    repo: &Repository,
    id: &str,
    move_feeds_to_parent: Option<&str>,
) -> Result<()> {
    // Move feeds to parent or remove associations
    if let Some(target_folder) = move_feeds_to_parent {
        sqlx::query("UPDATE rss_feed_folders SET folder_id = ? WHERE folder_id = ?")
            .bind(target_folder)
            .bind(id)
            .execute(repo.pool())
            .await
            .map_err(|e| IncrementumError::Internal(format!("Failed to move feeds: {}", e)))?;
    } else {
        sqlx::query("DELETE FROM rss_feed_folders WHERE folder_id = ?")
            .bind(id)
            .execute(repo.pool())
            .await
            .map_err(|e| IncrementumError::Internal(format!("Failed to remove feed associations: {}", e)))?;
    }

    // Move subfolders to parent
    sqlx::query("UPDATE rss_folders SET parent_id = NULL WHERE parent_id = ?")
        .bind(id)
        .execute(repo.pool())
        .await
        .ok();

    sqlx::query("DELETE FROM rss_folders WHERE id = ?")
        .bind(id)
        .execute(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to delete folder: {}", e)))?;

    Ok(())
}

/// Get all folders
pub async fn get_all_folders(repo: &Repository) -> Result<Vec<RssFolder>> {
    let rows = sqlx::query("SELECT * FROM rss_folders ORDER BY sort_order, name")
        .fetch_all(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to get folders: {}", e)))?;

    let mut folders = Vec::new();
    for row in rows {
        let folder_id: String = row.get("id");
        let feed_ids: Vec<String> = sqlx::query_scalar(
            "SELECT feed_id FROM rss_feed_folders WHERE folder_id = ? ORDER BY sort_order",
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

/// Move feed to folder
pub async fn move_feed_to_folder(
    repo: &Repository,
    feed_id: &str,
    folder_id: Option<&str>,
    sort_order: i32,
) -> Result<()> {
    sqlx::query("DELETE FROM rss_feed_folders WHERE feed_id = ?")
        .bind(feed_id)
        .execute(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to remove feed from folders: {}", e)))?;

    if let Some(folid) = folder_id {
        sqlx::query(
            "INSERT INTO rss_feed_folders (feed_id, folder_id, sort_order) VALUES (?1, ?2, ?3)",
        )
        .bind(feed_id)
        .bind(folid)
        .bind(sort_order)
        .execute(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to add feed to folder: {}", e)))?;
    }

    Ok(())
}

/// Reorder feeds in a folder
pub async fn reorder_feeds(
    repo: &Repository,
    folder_id: &str,
    reorder: &[(String, i32)],
) -> Result<()> {
    for (feed_id, sort_order) in reorder {
        sqlx::query(
            "UPDATE rss_feed_folders SET sort_order = ? WHERE feed_id = ? AND folder_id = ?",
        )
        .bind(sort_order)
        .bind(feed_id)
        .bind(folder_id)
        .execute(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to reorder feed: {}", e)))?;
    }
    Ok(())
}

/// Reorder folders
pub async fn reorder_folders(repo: &Repository, reorder: &[(String, i32)]) -> Result<()> {
    for (folder_id, sort_order) in reorder {
        sqlx::query("UPDATE rss_folders SET sort_order = ? WHERE id = ?")
            .bind(sort_order)
            .bind(folder_id)
            .execute(repo.pool())
            .await
            .map_err(|e| IncrementumError::Internal(format!("Failed to reorder folder: {}", e)))?;
    }
    Ok(())
}

/// Toggle feed active status
pub async fn toggle_feed_active(repo: &Repository, feed_id: &str) -> Result<bool> {
    let current: bool = sqlx::query_scalar("SELECT is_active FROM rss_feeds WHERE id = ?")
        .bind(feed_id)
        .fetch_one(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Feed not found: {}", e)))?;

    let new_active = !current;
    sqlx::query("UPDATE rss_feeds SET is_active = ? WHERE id = ?")
        .bind(new_active)
        .bind(feed_id)
        .execute(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to toggle feed: {}", e)))?;

    Ok(new_active)
}

/// Get feed statistics
pub async fn get_feed_statistics(
    repo: &Repository,
    feed_id: &str,
) -> Result<RssFeedStatistics> {
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM rss_articles WHERE feed_id = ?")
        .bind(feed_id)
        .fetch_one(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to get total: {}", e)))?;

    let unread: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM rss_articles WHERE feed_id = ? AND is_read = 0")
            .bind(feed_id)
            .fetch_one(repo.pool())
            .await
            .map_err(|e| IncrementumError::Internal(format!("Failed to get unread: {}", e)))?;

    let weeks_ago = (Utc::now() - chrono::Duration::weeks(4)).to_rfc3339();
    let recent_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM rss_articles WHERE feed_id = ? AND date_added > ?",
    )
    .bind(feed_id)
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

    let last_fetched: Option<String> =
        sqlx::query_scalar("SELECT last_fetched FROM rss_feeds WHERE id = ?")
            .bind(feed_id)
            .fetch_optional(repo.pool())
            .await
            .map_err(|e| IncrementumError::Internal(format!("Failed to get last_fetched: {}", e)))?
            .flatten();

    let date_added: String = sqlx::query_scalar("SELECT date_added FROM rss_feeds WHERE id = ?")
        .bind(feed_id)
        .fetch_one(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to get date_added: {}", e)))?;

    Ok(RssFeedStatistics {
        feed_id: feed_id.to_string(),
        total_articles: total,
        unread_count: unread,
        articles_per_week,
        estimated_frequency,
        last_fetched,
        date_added,
    })
}

/// Set feed view preferences
pub async fn set_feed_view_preferences(
    repo: &Repository,
    feed_id: &str,
    view_mode: Option<&str>,
    layout: Option<&str>,
    auto_mark_after_days: Option<Option<i32>>,
) -> Result<()> {
    let mut sets = Vec::new();
    if view_mode.is_some() {
        sets.push("view_mode = ?".to_string());
    }
    if layout.is_some() {
        sets.push("layout = ?".to_string());
    }
    if auto_mark_after_days.is_some() {
        sets.push("auto_mark_after_days = ?".to_string());
    }

    if sets.is_empty() {
        return Ok(());
    }

    let query_str = format!("UPDATE rss_feeds SET {} WHERE id = ?", sets.join(", "));
    let mut query = sqlx::query(&query_str);
    if let Some(vm) = view_mode {
        query = query.bind(vm);
    }
    if let Some(l) = layout {
        query = query.bind(l);
    }
    if let Some(a) = auto_mark_after_days {
        query = query.bind(a);
    }
    query = query.bind(feed_id);

    query.execute(repo.pool()).await.map_err(|e| {
        IncrementumError::Internal(format!("Failed to update feed preferences: {}", e))
    })?;

    Ok(())
}

/// Get articles needing intelligence score recomputation
pub async fn get_articles_needing_score(
    repo: &Repository,
    limit: i32,
) -> Result<Vec<String>> {
    let article_ids: Vec<String> = sqlx::query_scalar(
        "SELECT id FROM rss_articles WHERE intelligence_score_computed_at IS NULL LIMIT ?",
    )
    .bind(limit)
    .fetch_all(repo.pool())
    .await
    .map_err(|e| IncrementumError::Internal(format!("Failed to get articles: {}", e)))?;

    Ok(article_ids)
}

/// Get article data for scoring
pub async fn get_article_for_scoring(
    repo: &Repository,
    article_id: &str,
) -> Result<Option<(String, String, Option<String>, Option<String>)>> {
    let article: Option<(String, String, Option<String>, Option<String>)> =
        sqlx::query_as("SELECT feed_id, title, author, content FROM rss_articles WHERE id = ?")
            .bind(article_id)
            .fetch_optional(repo.pool())
            .await
            .map_err(|e| IncrementumError::Internal(format!("Failed to get article: {}", e)))?;

    Ok(article)
}

/// Get classifiers for a feed (including folder and global scope)
pub async fn get_classifiers_for_feed(
    repo: &Repository,
    feed_id: &str,
) -> Result<Vec<(String, String, String)>> {
    let classifiers: Vec<(String, String, String)> = sqlx::query_as(
        r#"SELECT classifier_type, value, sentiment FROM rss_classifiers
           WHERE feed_id = ? OR scope IN ('folder', 'global')"#,
    )
    .bind(feed_id)
    .fetch_all(repo.pool())
    .await
    .map_err(|e| IncrementumError::Internal(format!("Failed to fetch classifiers: {}", e)))?;

    Ok(classifiers)
}

/// Save intelligence score
pub async fn save_intelligence_score(
    repo: &Repository,
    article_id: &str,
    score: f64,
) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    sqlx::query("UPDATE rss_articles SET intelligence_score = ?, intelligence_score_computed_at = ? WHERE id = ?")
        .bind(score)
        .bind(&now)
        .bind(article_id)
        .execute(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to cache score: {}", e)))?;
    Ok(())
}

/// Get articles with intelligence filtering
pub async fn get_articles_with_intelligence(
    repo: &Repository,
    feed_id: Option<&str>,
    limit: i32,
    intelligence_filter: Option<&str>,
    include_hidden: bool,
) -> Result<Vec<serde_json::Value>> {
    let rows = match (feed_id, intelligence_filter, include_hidden) {
        (Some(fid), Some("focus"), true) =>
            sqlx::query("SELECT * FROM rss_articles WHERE feed_id = ? AND intelligence_score > 0 ORDER BY published_date DESC LIMIT ?")
                .bind(fid).bind(limit).fetch_all(repo.pool()).await,
        (Some(fid), Some("focus"), false) =>
            sqlx::query("SELECT * FROM rss_articles WHERE feed_id = ? AND intelligence_score > 0 AND (intelligence_score >= 0 OR intelligence_score IS NULL) ORDER BY published_date DESC LIMIT ?")
                .bind(fid).bind(limit).fetch_all(repo.pool()).await,
        (Some(fid), _, true) =>
            sqlx::query("SELECT * FROM rss_articles WHERE feed_id = ? ORDER BY published_date DESC LIMIT ?")
                .bind(fid).bind(limit).fetch_all(repo.pool()).await,
        (Some(fid), _, false) =>
            sqlx::query("SELECT * FROM rss_articles WHERE feed_id = ? AND (intelligence_score >= 0 OR intelligence_score IS NULL) ORDER BY published_date DESC LIMIT ?")
                .bind(fid).bind(limit).fetch_all(repo.pool()).await,
        (None, Some("focus"), true) =>
            sqlx::query("SELECT * FROM rss_articles WHERE intelligence_score > 0 ORDER BY published_date DESC LIMIT ?")
                .bind(limit).fetch_all(repo.pool()).await,
        (None, Some("focus"), false) =>
            sqlx::query("SELECT * FROM rss_articles WHERE intelligence_score > 0 AND (intelligence_score >= 0 OR intelligence_score IS NULL) ORDER BY published_date DESC LIMIT ?")
                .bind(limit).fetch_all(repo.pool()).await,
        (None, _, true) =>
            sqlx::query("SELECT * FROM rss_articles ORDER BY published_date DESC LIMIT ?")
                .bind(limit).fetch_all(repo.pool()).await,
        (None, _, false) =>
            sqlx::query("SELECT * FROM rss_articles WHERE (intelligence_score >= 0 OR intelligence_score IS NULL) ORDER BY published_date DESC LIMIT ?")
                .bind(limit).fetch_all(repo.pool()).await,
    }.map_err(|e| IncrementumError::Internal(format!("Failed to fetch articles: {}", e)))?;
        .map_err(|e| IncrementumError::Internal(format!("Failed to fetch articles: {}", e)))?;

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

/// Check if a folder exists
pub async fn folder_exists(repo: &Repository, id: &str) -> Result<bool> {
    let exists: Option<String> = sqlx::query_scalar("SELECT id FROM rss_folders WHERE id = ?")
        .bind(id)
        .fetch_optional(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to check folder: {}", e)))?;

    Ok(exists.is_some())
}

/// Create a folder during migration
pub async fn create_folder_migration(
    repo: &Repository,
    id: &str,
    name: &str,
    sort_order: i32,
) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    sqlx::query("INSERT INTO rss_folders (id, name, parent_id, icon, sort_order, created_at) VALUES (?, ?, NULL, NULL, ?, ?)")
        .bind(id)
        .bind(name)
        .bind(sort_order)
        .bind(&now)
        .execute(repo.pool())
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to create folder: {}", e)))?;
    Ok(())
}

/// Create feed folder association during migration
pub async fn create_feed_folder_association(
    repo: &Repository,
    feed_id: &str,
    folder_id: &str,
    sort_order: i32,
) -> Result<()> {
    sqlx::query("INSERT OR IGNORE INTO rss_feed_folders (feed_id, folder_id, sort_order) VALUES (?, ?, ?)")
        .bind(feed_id)
        .bind(folder_id)
        .bind(sort_order)
        .execute(repo.pool())
        .await
        .ok();
    Ok(())
}

/// Check if a discovered site exists by feed URL
pub async fn discovered_feed_exists(repo: &Repository, feed_url: &str, site_url: &str) -> Result<bool> {
    let exists: bool = sqlx::query_scalar(
        "SELECT COUNT(*) > 0 FROM rss_discovered_sites WHERE feed_url = ? OR url = ?",
    )
    .bind(feed_url)
    .bind(site_url)
    .fetch_one(repo.pool())
    .await
    .unwrap_or(false);

    Ok(exists)
}

/// Create a discovered site for curated feed
#[allow(clippy::too_many_arguments)]
pub async fn create_curated_discovered_site(
    repo: &Repository,
    id: &str,
    site_url: &str,
    title: &str,
    description: &str,
    feed_url: &str,
    category: &str,
    discovered_at: &str,
) -> Result<()> {
    sqlx::query(
        "INSERT OR IGNORE INTO rss_discovered_sites (id, url, title, description, feed_url, similarity_source, discovered_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(id)
    .bind(site_url)
    .bind(title)
    .bind(description)
    .bind(feed_url)
    .bind(category)
    .bind(discovered_at)
    .execute(repo.pool())
    .await
    .map_err(|e| IncrementumError::Internal(format!("Failed to insert curated feed: {}", e)))?;

    Ok(())
}
