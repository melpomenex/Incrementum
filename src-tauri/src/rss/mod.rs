//! RSS Feature Module
//!
//! A proper layered architecture for RSS features including:
//! - Intelligence training
//! - Reading state management
//! - Search and clustering
//! - Tags and annotations
//! - Feed discovery
//! - Folder management

pub mod models;
pub mod repository;
pub mod service;
pub mod commands;

// Re-export all models
pub use models::*;

// Re-export all command functions
pub use commands::*;

use sqlx::Row;

/// HTTP API variant: Search articles
pub async fn search_rss_articles_http(
    query: &str,
    feed_id: Option<&str>,
    folder_id: Option<&str>,
    scope: Option<&str>,
    limit: Option<i32>,
    repo: &crate::database::Repository,
) -> crate::error::Result<Vec<RssSearchResult>> {
    repository::search_articles(repo, query, feed_id, folder_id, scope, limit.unwrap_or(50)).await
}

/// HTTP API variant: Get classifiers
pub async fn get_rss_classifiers_http(
    feed_id: Option<&str>,
    repo: &crate::database::Repository,
) -> crate::error::Result<Vec<RssClassifier>> {
    repository::get_classifiers(repo, feed_id, None, None, None).await
}

/// HTTP API variant: Add classifier
pub async fn add_rss_classifier_http(
    feed_id: &str,
    classifier_type: &str,
    value: &str,
    sentiment: &str,
    repo: &crate::database::Repository,
) -> crate::error::Result<RssClassifier> {
    service::add_classifier(repo, feed_id, classifier_type, value, sentiment, None).await
}

/// HTTP API variant: Remove classifier
pub async fn remove_rss_classifier_http(
    id: &str,
    repo: &crate::database::Repository,
) -> crate::error::Result<()> {
    service::remove_classifier(repo, id).await
}

/// HTTP API variant: Update classifiers batch
pub async fn update_rss_classifiers_batch_http(
    updates: Vec<ClassifierUpdate>,
    repo: &crate::database::Repository,
) -> crate::error::Result<()> {
    repository::update_classifier_sentiment(repo, &updates[0].id, updates[0].sentiment.as_deref().unwrap_or("neutral")).await
}

/// HTTP API variant: Mark article unread
pub async fn mark_rss_article_unread_http(
    id: &str,
    repo: &crate::database::Repository,
) -> crate::error::Result<()> {
    repository::mark_article_unread(repo, id).await
}

/// HTTP API variant: Mark articles before date read
pub async fn mark_rss_articles_before_date_read_http(
    feed_id: Option<&str>,
    before_date: &str,
    repo: &crate::database::Repository,
) -> crate::error::Result<i32> {
    let count = repository::mark_articles_before_date_read(repo, feed_id, before_date).await?;
    Ok(count as i32)
}

/// HTTP API variant: Mark articles after date read
pub async fn mark_rss_articles_after_date_read_http(
    feed_id: Option<&str>,
    after_date: &str,
    repo: &crate::database::Repository,
) -> crate::error::Result<i32> {
    let count = repository::mark_articles_after_date_read(repo, feed_id, after_date).await?;
    Ok(count as i32)
}

/// HTTP API variant: Get read articles
pub async fn get_read_rss_articles_http(
    limit: Option<i32>,
    offset: Option<i32>,
    repo: &crate::database::Repository,
) -> crate::error::Result<Vec<serde_json::Value>> {
    repository::get_read_articles(repo, limit.unwrap_or(50), offset.unwrap_or(0)).await
}

/// HTTP API variant: Get river of news
pub async fn get_river_of_news_http(
    folder_id: &str,
    limit: Option<i32>,
    repo: &crate::database::Repository,
) -> crate::error::Result<Vec<serde_json::Value>> {
    repository::get_river_of_news(repo, folder_id, limit.unwrap_or(100), None).await
}

/// HTTP API variant: Get articles with intelligence
pub async fn get_rss_articles_with_intelligence_http(
    feed_id: Option<&str>,
    limit: Option<i32>,
    include_hidden: bool,
    repo: &crate::database::Repository,
) -> crate::error::Result<Vec<serde_json::Value>> {
    repository::get_articles_with_intelligence(
        repo,
        feed_id,
        limit.unwrap_or(100),
        None,
        include_hidden,
    ).await
}

/// HTTP API variant: Compute story clusters
pub async fn compute_story_clusters_http(
    feed_id: Option<&str>,
    repo: &crate::database::Repository,
) -> crate::error::Result<Vec<RssStoryCluster>> {
    service::compute_story_clusters(repo, feed_id).await
}

/// HTTP API variant: Get story clusters
pub async fn get_rss_article_clusters_http(
    feed_id: Option<&str>,
    repo: &crate::database::Repository,
) -> crate::error::Result<Vec<RssStoryCluster>> {
    repository::get_story_clusters(repo, feed_id).await
}

/// HTTP API variant: Invalidate clusters for feed
pub async fn invalidate_clusters_for_feed_http(
    feed_id: &str,
    repo: &crate::database::Repository,
) -> crate::error::Result<()> {
    repository::invalidate_clusters_for_feed(repo, feed_id).await
}

/// HTTP API variant: Add tag
pub async fn add_tag_http(
    name: &str,
    repo: &crate::database::Repository,
) -> crate::error::Result<RssTag> {
    service::add_tag(repo, name).await
}

/// HTTP API variant: Remove tag
pub async fn remove_tag_http(
    tag_id: &str,
    repo: &crate::database::Repository,
) -> crate::error::Result<()> {
    repository::remove_tag(repo, tag_id).await
}

/// HTTP API variant: Get all tags
pub async fn get_all_tags_http(
    repo: &crate::database::Repository,
) -> crate::error::Result<Vec<RssTag>> {
    repository::get_all_tags(repo).await
}

/// HTTP API variant: Get article tags
pub async fn get_article_tags_http(
    article_id: &str,
    repo: &crate::database::Repository,
) -> crate::error::Result<Vec<RssTag>> {
    repository::get_article_tags(repo, article_id).await
}

/// HTTP API variant: Tag article
pub async fn tag_article_http(
    article_id: &str,
    tag_id: &str,
    repo: &crate::database::Repository,
) -> crate::error::Result<()> {
    repository::tag_article(repo, article_id, tag_id).await
}

/// HTTP API variant: Untag article
pub async fn untag_article_http(
    article_id: &str,
    tag_id: &str,
    repo: &crate::database::Repository,
) -> crate::error::Result<()> {
    repository::untag_article(repo, article_id, tag_id).await
}

/// HTTP API variant: Get articles by tag
pub async fn get_articles_by_tag_http(
    tag_id: &str,
    limit: Option<i32>,
    repo: &crate::database::Repository,
) -> crate::error::Result<Vec<serde_json::Value>> {
    repository::get_articles_by_tag(repo, tag_id, limit.unwrap_or(50)).await
}

/// HTTP API variant: Rename tag
pub async fn rename_tag_http(
    tag_id: &str,
    new_name: &str,
    repo: &crate::database::Repository,
) -> crate::error::Result<()> {
    repository::rename_tag(repo, tag_id, new_name).await
}

/// HTTP API variant: Merge tags
pub async fn merge_tags_http(
    source_tag_id: &str,
    target_tag_id: &str,
    repo: &crate::database::Repository,
) -> crate::error::Result<()> {
    service::merge_tags(repo, source_tag_id, target_tag_id).await
}

/// HTTP API variant: Create annotation
pub async fn create_annotation_http(
    article_id: &str,
    annotation_type: &str,
    content: &str,
    start_offset: Option<i32>,
    end_offset: Option<i32>,
    color: Option<&str>,
    repo: &crate::database::Repository,
) -> crate::error::Result<RssAnnotation> {
    repository::create_annotation(repo, article_id, annotation_type, content, start_offset, end_offset, color).await
}

/// HTTP API variant: Get article annotations
pub async fn get_article_annotations_http(
    article_id: &str,
    repo: &crate::database::Repository,
) -> crate::error::Result<Vec<RssAnnotation>> {
    repository::get_article_annotations(repo, article_id).await
}

/// HTTP API variant: Update annotation
pub async fn update_annotation_http(
    id: &str,
    content: Option<&str>,
    color: Option<&str>,
    repo: &crate::database::Repository,
) -> crate::error::Result<RssAnnotation> {
    repository::update_annotation(repo, id, content, color).await?;
    let row = repository::get_annotation_by_id(repo, id).await?;
    match row {
        Some(row) => Ok(RssAnnotation {
            id: row.get("id"),
            article_id: row.get("article_id"),
            annotation_type: row.get("annotation_type"),
            content: row.get("content"),
            start_offset: row.try_get("start_offset").ok(),
            end_offset: row.try_get("end_offset").ok(),
            color: row.try_get("color").ok(),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        }),
        None => Err(crate::error::IncrementumError::NotFound("Annotation not found".to_string())),
    }
}

/// HTTP API variant: Delete annotation
pub async fn delete_annotation_http(
    id: &str,
    repo: &crate::database::Repository,
) -> crate::error::Result<()> {
    repository::delete_annotation(repo, id).await
}

/// HTTP API variant: Get discovered sites
pub async fn get_discovered_sites_http(
    limit: Option<i32>,
    offset: Option<i32>,
    repo: &crate::database::Repository,
) -> crate::error::Result<Vec<RssDiscoveredSite>> {
    repository::get_discovered_sites(repo, limit.unwrap_or(50), offset.unwrap_or(0)).await
}

/// HTTP API variant: Delete discovered site
pub async fn delete_discovered_site_http(
    id: &str,
    repo: &crate::database::Repository,
) -> crate::error::Result<()> {
    repository::delete_discovered_site(repo, id).await
}

/// HTTP API variant: Get folders
pub async fn get_rss_folders_http(
    repo: &crate::database::Repository,
) -> crate::error::Result<Vec<RssFolder>> {
    repository::get_all_folders(repo).await
}

/// HTTP API variant: Create folder
pub async fn create_rss_folder_http(
    name: &str,
    parent_id: Option<&str>,
    icon: Option<&str>,
    auto_mark_after_days: Option<i32>,
    repo: &crate::database::Repository,
) -> crate::error::Result<RssFolder> {
    repository::create_folder(repo, name, parent_id, icon, auto_mark_after_days).await
}

/// HTTP API variant: Delete folder
pub async fn delete_rss_folder_http(
    id: &str,
    move_to: Option<&str>,
    repo: &crate::database::Repository,
) -> crate::error::Result<()> {
    repository::delete_folder(repo, id, move_to).await
}

/// HTTP API variant: Move feed to folder
pub async fn move_feed_to_folder_http(
    feed_id: &str,
    folder_id: Option<&str>,
    sort_order: Option<i32>,
    repo: &crate::database::Repository,
) -> crate::error::Result<()> {
    repository::move_feed_to_folder(repo, feed_id, folder_id, sort_order.unwrap_or(0)).await
}

/// HTTP API variant: Toggle feed active
pub async fn toggle_feed_active_http(
    feed_id: &str,
    repo: &crate::database::Repository,
) -> crate::error::Result<bool> {
    repository::toggle_feed_active(repo, feed_id).await
}

/// HTTP API variant: Get feed statistics
pub async fn get_feed_statistics_http(
    feed_id: &str,
    repo: &crate::database::Repository,
) -> crate::error::Result<RssFeedStatistics> {
    repository::get_feed_statistics(repo, feed_id).await
}

/// HTTP API variant: Reorder folders
pub async fn reorder_folders_http(
    reorder: Vec<(String, i32)>,
    repo: &crate::database::Repository,
) -> crate::error::Result<()> {
    repository::reorder_folders(repo, &reorder).await
}

/// HTTP API variant: Set feed view preferences
pub async fn set_feed_view_preferences_http(
    feed_id: &str,
    view_mode: Option<&str>,
    layout: Option<&str>,
    repo: &crate::database::Repository,
) -> crate::error::Result<()> {
    repository::set_feed_view_preferences(repo, feed_id, view_mode, layout, None).await
}

/// HTTP API variant: Recompute all intelligence scores
pub async fn recompute_all_intelligence_scores_http(
    repo: &crate::database::Repository,
) -> crate::error::Result<i32> {
    service::recompute_all_intelligence_scores(repo).await
}

/// HTTP API variant: Migrate folders from localStorage
pub async fn migrate_folders_from_localstorage_http(
    folders_json: &str,
    repo: &crate::database::Repository,
) -> crate::error::Result<i32> {
    service::migrate_folders_from_localstorage(repo, folders_json).await
}

/// HTTP API variant: Refresh discoveries
pub async fn refresh_discoveries_http(
    repo: &crate::database::Repository,
) -> crate::error::Result<i32> {
    service::refresh_discoveries(repo).await
}
