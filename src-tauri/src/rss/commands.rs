//! RSS Feature Commands
//!
//! Thin Tauri command wrappers for RSS features.
//! All business logic is delegated to the service layer.

use crate::database::Repository;
use crate::error::Result;
use crate::rss::models::*;
use crate::rss::repository as repo;
use crate::rss::service;
use sqlx::Row;
use tauri::State;

#[tauri::command]
pub async fn add_rss_classifier(
    feed_id: String,
    classifier_type: String,
    value: String,
    sentiment: String,
    scope: Option<String>,
    repo: State<'_, Repository>,
) -> Result<RssClassifier> {
    service::add_classifier(&repo, &feed_id, &classifier_type, &value, &sentiment, scope.as_deref()).await
}

#[tauri::command]
pub async fn remove_rss_classifier(id: String, repo: State<'_, Repository>) -> Result<()> {
    service::remove_classifier(&repo, &id).await
}

#[tauri::command]
pub async fn get_rss_classifiers(
    feed_id: Option<String>,
    classifier_type: Option<String>,
    sentiment: Option<String>,
    scope: Option<String>,
    repo: State<'_, Repository>,
) -> Result<Vec<RssClassifier>> {
    repo::get_classifiers(&repo, feed_id.as_deref(), classifier_type.as_deref(), sentiment.as_deref(), scope.as_deref()).await
}

#[tauri::command]
pub async fn update_rss_classifiers_batch(
    updates: Vec<ClassifierUpdate>,
    repo: State<'_, Repository>,
) -> Result<()> {
    service::update_classifiers_batch(&repo, &updates).await
}

#[tauri::command]
pub async fn compute_intelligence_score(
    article_id: String,
    repo: State<'_, Repository>,
) -> Result<f64> {
    service::compute_intelligence_score(&repo, &article_id).await
}

#[tauri::command]
pub async fn recompute_all_intelligence_scores(repo: State<'_, Repository>) -> Result<i32> {
    service::recompute_all_intelligence_scores(&repo).await
}

#[tauri::command]
pub async fn mark_rss_article_unread(id: String, repo: State<'_, Repository>) -> Result<()> {
    repo::mark_article_unread(&repo, &id).await
}

#[tauri::command]
pub async fn mark_rss_articles_before_date_read(
    feed_id: Option<String>,
    before_date: String,
    repo: State<'_, Repository>,
) -> Result<i32> {
    let count = repo::mark_articles_before_date_read(&repo, feed_id.as_deref(), &before_date).await?;
    Ok(count as i32)
}

#[tauri::command]
pub async fn mark_rss_articles_after_date_read(
    feed_id: Option<String>,
    after_date: String,
    repo: State<'_, Repository>,
) -> Result<i32> {
    let count = repo::mark_articles_after_date_read(&repo, feed_id.as_deref(), &after_date).await?;
    Ok(count as i32)
}

#[tauri::command]
pub async fn auto_mark_articles_as_read(repo: State<'_, Repository>) -> Result<i32> {
    let count = repo::auto_mark_articles_as_read(&repo).await?;
    Ok(count as i32)
}

#[tauri::command]
pub async fn get_read_rss_articles(
    limit: Option<i32>,
    offset: Option<i32>,
    repo: State<'_, Repository>,
) -> Result<Vec<serde_json::Value>> {
    repo::get_read_articles(&repo, limit.unwrap_or(50), offset.unwrap_or(0)).await
}

#[tauri::command]
pub async fn get_river_of_news(
    folder_id: String,
    limit: Option<i32>,
    intelligence_filter: Option<String>,
    repo: State<'_, Repository>,
) -> Result<Vec<serde_json::Value>> {
    repo::get_river_of_news(&repo, &folder_id, limit.unwrap_or(100), intelligence_filter.as_deref()).await
}

#[tauri::command]
pub async fn search_rss_articles(
    query: String,
    feed_id: Option<String>,
    folder_id: Option<String>,
    scope: Option<String>,
    limit: Option<i32>,
    repo: State<'_, Repository>,
) -> Result<Vec<RssSearchResult>> {
    repo::search_articles(&repo, &query, feed_id.as_deref(), folder_id.as_deref(), scope.as_deref(), limit.unwrap_or(50)).await
}

#[tauri::command]
pub async fn get_rss_articles_with_intelligence(
    feed_id: Option<String>,
    limit: Option<i32>,
    intelligence_filter: Option<String>,
    include_hidden: Option<bool>,
    repo: State<'_, Repository>,
) -> Result<Vec<serde_json::Value>> {
    repo::get_articles_with_intelligence(
        &repo,
        feed_id.as_deref(),
        limit.unwrap_or(100),
        intelligence_filter.as_deref(),
        include_hidden.unwrap_or(false),
    ).await
}

#[tauri::command]
pub async fn compute_story_clusters(
    feed_id: Option<String>,
    repo: State<'_, Repository>,
) -> Result<Vec<RssStoryCluster>> {
    service::compute_story_clusters(&repo, feed_id.as_deref()).await
}

#[tauri::command]
pub async fn get_rss_article_clusters(
    feed_id: Option<String>,
    repo: State<'_, Repository>,
) -> Result<Vec<RssStoryCluster>> {
    repo::get_story_clusters(&repo, feed_id.as_deref()).await
}

#[tauri::command]
pub async fn invalidate_clusters_for_feed(
    feed_id: String,
    repo: State<'_, Repository>,
) -> Result<()> {
    repo::invalidate_clusters_for_feed(&repo, &feed_id).await
}

#[tauri::command]
pub async fn add_tag(name: String, repo: State<'_, Repository>) -> Result<RssTag> {
    service::add_tag(&repo, &name).await
}

#[tauri::command]
pub async fn remove_tag(tag_id: String, repo: State<'_, Repository>) -> Result<()> {
    service::remove_tag(&repo, &tag_id).await
}

#[tauri::command]
pub async fn get_article_tags(
    article_id: String,
    repo: State<'_, Repository>,
) -> Result<Vec<RssTag>> {
    repo::get_article_tags(&repo, &article_id).await
}

#[tauri::command]
pub async fn get_all_tags(repo: State<'_, Repository>) -> Result<Vec<RssTag>> {
    repo::get_all_tags(&repo).await
}

#[tauri::command]
pub async fn tag_article(
    article_id: String,
    tag_id: String,
    repo: State<'_, Repository>,
) -> Result<()> {
    repo::tag_article(&repo, &article_id, &tag_id).await
}

#[tauri::command]
pub async fn untag_article(
    article_id: String,
    tag_id: String,
    repo: State<'_, Repository>,
) -> Result<()> {
    repo::untag_article(&repo, &article_id, &tag_id).await
}

#[tauri::command]
pub async fn get_articles_by_tag(
    tag_id: String,
    limit: Option<i32>,
    repo: State<'_, Repository>,
) -> Result<Vec<serde_json::Value>> {
    repo::get_articles_by_tag(&repo, &tag_id, limit.unwrap_or(50)).await
}

#[tauri::command]
pub async fn rename_tag(
    tag_id: String,
    new_name: String,
    repo: State<'_, Repository>,
) -> Result<()> {
    repo::rename_tag(&repo, &tag_id, &new_name).await
}

#[tauri::command]
pub async fn merge_tags(
    source_tag_id: String,
    target_tag_id: String,
    repo: State<'_, Repository>,
) -> Result<()> {
    service::merge_tags(&repo, &source_tag_id, &target_tag_id).await
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
    repo::create_annotation(&repo, &article_id, &annotation_type, &content, start_offset, end_offset, color.as_deref()).await
}

#[tauri::command]
pub async fn get_article_annotations(
    article_id: String,
    repo: State<'_, Repository>,
) -> Result<Vec<RssAnnotation>> {
    repo::get_article_annotations(&repo, &article_id).await
}

#[tauri::command]
pub async fn update_annotation(
    id: String,
    content: Option<String>,
    color: Option<String>,
    repo: State<'_, Repository>,
) -> Result<RssAnnotation> {
    repo::update_annotation(&repo, &id, content.as_deref(), color.as_deref()).await?;
    
    let row = repo::get_annotation_by_id(&repo, &id).await?;
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

#[tauri::command]
pub async fn delete_annotation(id: String, repo: State<'_, Repository>) -> Result<()> {
    repo::delete_annotation(&repo, &id).await
}

#[tauri::command]
pub async fn get_discovered_sites(
    limit: Option<i32>,
    offset: Option<i32>,
    repo: State<'_, Repository>,
) -> Result<Vec<RssDiscoveredSite>> {
    repo::get_discovered_sites(&repo, limit.unwrap_or(50), offset.unwrap_or(0)).await
}

#[tauri::command]
pub async fn delete_discovered_site(id: String, repo: State<'_, Repository>) -> Result<()> {
    repo::delete_discovered_site(&repo, &id).await
}

#[tauri::command]
pub async fn refresh_discoveries(repo: State<'_, Repository>) -> Result<i32> {
    service::refresh_discoveries(&repo).await
}

#[tauri::command]
pub async fn seed_curated_feeds(repo: State<'_, Repository>) -> Result<i32> {
    service::seed_curated_feeds(&repo).await
}

#[tauri::command]
pub async fn create_rss_folder(
    name: String,
    parent_id: Option<String>,
    icon: Option<String>,
    auto_mark_after_days: Option<i32>,
    repo: State<'_, Repository>,
) -> Result<RssFolder> {
    repo::create_folder(&repo, &name, parent_id.as_deref(), icon.as_deref(), auto_mark_after_days).await
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
    repo::update_folder(
        &repo,
        &id,
        name.as_deref(),
        parent_id.as_ref().map(|o| o.as_deref()),
        icon.as_ref().map(|o| o.as_deref()),
        sort_order,
        auto_mark_after_days,
    ).await?;

    match repo::get_folder_by_id(&repo, &id).await? {
        Some(folder) => Ok(folder),
        None => Err(crate::error::IncrementumError::NotFound("Folder not found".to_string())),
    }
}

#[tauri::command]
pub async fn delete_rss_folder(
    id: String,
    move_feeds_to_parent: Option<String>,
    repo: State<'_, Repository>,
) -> Result<()> {
    repo::delete_folder(&repo, &id, move_feeds_to_parent.as_deref()).await
}

#[tauri::command]
pub async fn get_rss_folders(repo: State<'_, Repository>) -> Result<Vec<RssFolder>> {
    repo::get_all_folders(&repo).await
}

#[tauri::command]
pub async fn move_feed_to_folder(
    feed_id: String,
    folder_id: Option<String>,
    sort_order: Option<i32>,
    repo: State<'_, Repository>,
) -> Result<()> {
    repo::move_feed_to_folder(&repo, &feed_id, folder_id.as_deref(), sort_order.unwrap_or(0)).await
}

#[tauri::command]
pub async fn reorder_feeds(
    reorder: Vec<(String, i32)>,
    folder_id: String,
    repo: State<'_, Repository>,
) -> Result<()> {
    repo::reorder_feeds(&repo, &folder_id, &reorder).await
}

#[tauri::command]
pub async fn reorder_folders(
    reorder: Vec<(String, i32)>,
    repo: State<'_, Repository>,
) -> Result<()> {
    repo::reorder_folders(&repo, &reorder).await
}

#[tauri::command]
pub async fn toggle_feed_active(feed_id: String, repo: State<'_, Repository>) -> Result<bool> {
    repo::toggle_feed_active(&repo, &feed_id).await
}

#[tauri::command]
pub async fn get_feed_statistics(
    feed_id: String,
    repo: State<'_, Repository>,
) -> Result<RssFeedStatistics> {
    repo::get_feed_statistics(&repo, &feed_id).await
}

#[tauri::command]
pub async fn set_feed_view_preferences(
    feed_id: String,
    view_mode: Option<String>,
    layout: Option<String>,
    auto_mark_after_days: Option<Option<i32>>,
    repo: State<'_, Repository>,
) -> Result<()> {
    repo::set_feed_view_preferences(&repo, &feed_id, view_mode.as_deref(), layout.as_deref(), auto_mark_after_days).await
}

#[tauri::command]
pub async fn migrate_folders_from_localstorage(
    folders_json: String,
    repo: State<'_, Repository>,
) -> Result<i32> {
    service::migrate_folders_from_localstorage(&repo, &folders_json).await
}
