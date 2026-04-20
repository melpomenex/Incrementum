//! RSS Feature Service
//!
//! Business logic for RSS features including:
//! - Intelligence scoring
//! - Story clustering
//! - Feed discovery
//! - Batch operations

use crate::database::Repository;
use crate::error::{IncrementumError, Result};
use crate::rss::models::*;
use crate::rss::repository as repo;
use chrono::Utc;
use std::collections::HashSet;

/// Trigram similarity between two strings (simplified Levenshtein ratio)
pub fn trigram_similarity(a: &str, b: &str) -> f64 {
    if a.is_empty() || b.is_empty() {
        return 0.0;
    }

    let a_lower = a.to_lowercase();
    let b_lower = b.to_lowercase();

    // Fast path: identical
    if a_lower == b_lower {
        return 1.0;
    }

    // Build trigram sets
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

// ============================================================================
// Intelligence Score Service
// ============================================================================

/// Compute intelligence score for a single article
pub async fn compute_intelligence_score(
    repo: &Repository,
    article_id: &str,
) -> Result<f64> {
    let article = repo::get_article_for_scoring(repo, article_id).await?;

    let (feed_id, title, author, _content) = match article {
        Some(a) => a,
        None => return Ok(0.0),
    };

    let title_lower = title.to_lowercase();
    let author_lower = author.as_ref().map(|a| a.to_lowercase());

    // Fetch all applicable classifiers (feed, folder, global)
    let classifiers = repo::get_classifiers_for_feed(repo, &feed_id).await?;

    let mut score: f64 = 0.0;

    for (classifier_type, value, sentiment) in &classifiers {
        let value_lower = value.to_lowercase();
        let matches = match classifier_type.as_str() {
            "author" => author_lower
                .as_ref()
                .is_some_and(|a| a.contains(&value_lower)),
            "title" => title_lower.contains(&value_lower),
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

    // Save the computed score
    repo::save_intelligence_score(repo, article_id, score).await?;

    Ok(score)
}

/// Batch compute intelligence scores for all articles needing recomputation
pub async fn recompute_all_intelligence_scores(repo: &Repository) -> Result<i32> {
    // Get articles that need recomputation
    let article_ids = repo::get_articles_needing_score(repo, 1000).await?;

    let mut count = 0;
    for article_id in article_ids {
        match compute_intelligence_score(repo, &article_id).await {
            Ok(_) => count += 1,
            Err(_) => continue,
        }
    }

    Ok(count)
}

// ============================================================================
// Classifier Service
// ============================================================================

/// Add a classifier and invalidate related scores
pub async fn add_classifier(
    repo: &Repository,
    feed_id: &str,
    classifier_type: &str,
    value: &str,
    sentiment: &str,
    scope: Option<&str>,
) -> Result<RssClassifier> {
    let scope = scope.unwrap_or("feed");

    let classifier = repo::add_classifier(
        repo,
        feed_id,
        classifier_type,
        value,
        sentiment,
        scope,
    )
    .await?;

    // Invalidate intelligence scores for articles in this feed
    repo::invalidate_intelligence_scores(repo, feed_id).await?;

    Ok(classifier)
}

/// Remove a classifier and invalidate related scores
pub async fn remove_classifier(repo: &Repository, id: &str) -> Result<()> {
    let feed_id = repo::remove_classifier(repo, id).await?;

    if let Some(fid) = feed_id {
        repo::invalidate_intelligence_scores(repo, &fid).await?;
    }

    Ok(())
}

/// Update classifiers in batch
pub async fn update_classifiers_batch(
    repo: &Repository,
    updates: &[ClassifierUpdate],
) -> Result<()> {
    let mut feed_ids: std::collections::HashSet<String> = std::collections::HashSet::new();

    for update in updates {
        if let Some(ref sentiment) = update.sentiment {
            if let Ok(Some(feed_id)) = repo::get_classifier_feed_id(repo, &update.id).await {
                feed_ids.insert(feed_id);
                repo::update_classifier_sentiment(repo, &update.id, sentiment).await?;
            }
        }
        if let Some(ref value) = update.value {
            repo::update_classifier_value(repo, &update.id, value).await?;
        }
    }

    // Invalidate scores for affected feeds
    for feed_id in feed_ids {
        repo::invalidate_intelligence_scores(repo, &feed_id).await?;
    }

    Ok(())
}

// ============================================================================
// Story Clustering Service
// ============================================================================

/// Compute story clusters for recent articles
pub async fn compute_story_clusters(
    repo: &Repository,
    feed_id: Option<&str>,
) -> Result<Vec<RssStoryCluster>> {
    // Get recent articles (last 5 days)
    let cutoff = (Utc::now() - chrono::Duration::days(5)).to_rfc3339();

    let articles = repo::get_recent_articles_for_clustering(repo, feed_id, &cutoff).await?;

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
                let cluster = repo::create_cluster(
                    repo,
                    &articles[i].0,
                    &articles[j].0,
                    sim,
                    "duplicate",
                )
                .await?;
                clusters.push(cluster);
                clustered.insert(articles[j].0.clone());
            } else if sim > 0.6 {
                // Related
                let cluster = repo::create_cluster(
                    repo,
                    &articles[i].0,
                    &articles[j].0,
                    sim,
                    "related",
                )
                .await?;
                clusters.push(cluster);
                clustered.insert(articles[j].0.clone());
            }
        }
    }

    Ok(clusters)
}

// ============================================================================
// Tag Service
// ============================================================================

/// Add a tag or return existing
pub async fn add_tag(repo: &Repository, name: &str) -> Result<RssTag> {
    // Check if tag exists
    if let Some(existing) = repo::get_tag_by_name(repo, name).await? {
        return Ok(existing);
    }

    repo::create_tag(repo, name).await
}

/// Remove a tag
pub async fn remove_tag(repo: &Repository, tag_id: &str) -> Result<()> {
    repo::remove_tag(repo, tag_id).await
}

/// Merge two tags
pub async fn merge_tags(
    repo: &Repository,
    source_tag_id: &str,
    target_tag_id: &str,
) -> Result<()> {
    repo::merge_tags(repo, source_tag_id, target_tag_id).await?;
    repo::remove_tag(repo, source_tag_id).await
}

// ============================================================================
// Discovery Service
// ============================================================================

/// Attempt to discover RSS feed from a website
pub async fn discover_feed_from_site(
    site_url: &str,
) -> Option<(String, String, Option<String>)> {
    use reqwest::Client;

    let client = match Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .timeout(std::time::Duration::from_secs(10))
        .build()
    {
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
            && (lower.contains("application/rss+xml")
                || lower.contains("application/atom+xml")
                || lower.contains("text/xml"))
        {
                // Extract href
                if let Some(href_start) = lower.find("href=\"").or_else(|| lower.find("href='")) {
                    let href_start = href_start + 6;
                    if let Some(href_end) = lower[href_start..]
                        .find('"')
                        .or_else(|| lower[href_start..].find('\''))
                    {
                        let href = &line[href_start..href_start + href_end];
                        let resolved = if href.starts_with("http") {
                            href.to_string()
                        } else if href.starts_with("//") {
                            format!("https:{}", href)
                        } else if href.starts_with('/') {
                            format!(
                                "https://{}{}",
                                site_url
                                    .strip_prefix("https://")
                                    .unwrap_or(site_url)
                                    .strip_prefix("http://")
                                    .unwrap_or(site_url),
                                href
                            )
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
            title = Some(
                html[title_start..title_start + title_end]
                    .trim()
                    .to_string(),
            );
        }
    }

    // Extract description from <meta name="description">
    if let Some(desc_start) = html.to_lowercase().find("name=\"description\"") {
        let content_start = html[desc_start..]
            .find("content=\"")
            .or_else(|| html[desc_start..].find("content='"));
        if let Some(cs) = content_start {
            let cs = desc_start + cs + 9;
            if let Some(ce) = html[cs..].find('"').or_else(|| html[cs..].find('\'')) {
                description = Some(html[cs..cs + ce].to_string());
            }
        }
    }

    feed_url.map(|f| {
        (
            f,
            title.unwrap_or_else(|| site_url.to_string()),
            description,
        )
    })
}

/// Refresh discoveries from recent articles
pub async fn refresh_discoveries(repo: &Repository) -> Result<i32> {
    // Extract unique domains from recent article URLs
    let rows = repo::get_recent_articles_for_discovery(repo).await?;

    let mut domains: std::collections::HashSet<String> = std::collections::HashSet::new();
    for (url, _) in &rows {
        if let Ok(parsed) = url::Url::parse(url) {
            domains.insert(parsed.host_str().unwrap_or("").to_string());
        }
    }

    // Remove domains we're already subscribed to
    let subscribed = repo::get_subscribed_feed_urls(repo).await?;

    let mut count = 0;

    for domain in domains {
        // Skip if already subscribed
        if subscribed.iter().any(|s| s.contains(&domain)) {
            continue;
        }

        // Check if already discovered
        let exists = repo::discovered_site_exists(repo, &format!("%{}%", domain)).await?;

        if exists {
            continue;
        }

        // Attempt RSS auto-discovery
        let site_url = format!("https://{}", domain);
        let discovered = discover_feed_from_site(&site_url).await;

        if let Some((feed_url, title, desc)) = discovered {
            repo::create_discovered_site(repo, &site_url, Some(&title), desc.as_deref(), Some(&feed_url)).await?;
            count += 1;
        }
    }

    Ok(count)
}

// ============================================================================
// Migration Service
// ============================================================================

/// Migrate folders from localStorage JSON
pub async fn migrate_folders_from_localstorage(
    repo: &Repository,
    folders_json: &str,
) -> Result<i32> {
    let folders: Vec<serde_json::Value> = serde_json::from_str(folders_json)
        .map_err(|e| IncrementumError::Internal(format!("Invalid JSON: {}", e)))?;

    let mut migrated = 0i32;
    for (idx, folder) in folders.iter().enumerate() {
        let id = folder
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let name = folder
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("Unnamed")
            .to_string();

        if id.is_empty() {
            continue;
        }

        // Check if already migrated
        if repo::folder_exists(repo, &id).await? {
            continue;
        }

        repo::create_folder_migration(repo, &id, &name, idx as i32).await?;

        // Migrate feed associations
        if let Some(feeds) = folder.get("feeds").and_then(|v| v.as_array()) {
            for (feed_idx, feed_id_val) in feeds.iter().enumerate() {
                if let Some(feed_id) = feed_id_val.as_str() {
                    repo::create_feed_folder_association(
                        repo,
                        feed_id,
                        &id,
                        feed_idx as i32,
                    )
                    .await?;
                }
            }
        }

        migrated += 1;
    }

    Ok(migrated)
}

// ============================================================================
// Curated Feeds Service
// ============================================================================

/// Seed curated feeds into rss_discovered_sites
pub async fn seed_curated_feeds(repo: &Repository) -> Result<i32> {
    let feeds = crate::commands::curated_feeds::get_curated_feeds();
    let now = chrono::Utc::now().to_rfc3339();
    let mut inserted = 0i32;

    for feed in &feeds {
        if repo::discovered_feed_exists(repo, &feed.feed_url, &feed.site_url).await? {
            continue;
        }

        let id = uuid::Uuid::new_v4().to_string();
        repo::create_curated_discovered_site(
            repo,
            &id,
            &feed.site_url,
            &feed.title,
            &feed.category,
            &feed.feed_url,
            &feed.category,
            &now,
        )
        .await?;
        inserted += 1;
    }

    Ok(inserted)
}
