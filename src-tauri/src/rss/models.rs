//! RSS Feature Models
//!
//! Data structures for RSS features including:
//! - Intelligence classifiers
//! - Folders and tags
//! - Annotations and story clusters
//! - Search results and statistics

use serde::{Deserialize, Serialize};

/// Intelligence classifier
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RssClassifier {
    pub id: String,
    pub feed_id: String,
    pub classifier_type: String, // 'author', 'title', 'tag', 'feed'
    pub value: String,
    pub sentiment: String, // 'like', 'dislike', 'neutral'
    pub scope: String,     // 'feed', 'folder', 'global'
    pub created_at: String,
    pub updated_at: String,
}

/// Classifier update request for batch operations
#[derive(Debug, Deserialize)]
pub struct ClassifierUpdate {
    pub id: String,
    pub sentiment: Option<String>,
    pub value: Option<String>,
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
