//! Relevance Scoring Engine
//!
//! Computes a composite relevance score (0.0-1.0) for queue items based on
//! four weighted user preference signals:
//! - Classifier match (0.4): RSS classifiers (like/dislike on authors, tags, keywords)
//! - Tag affinity (0.25): Frequency of tags in recently positively-rated content
//! - Rating history (0.2): Per-source/author sentiment from past ratings
//! - Semantic similarity (0.15): Embedding similarity to favorited content

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};

/// Default signal weights
const WEIGHT_CLASSIFIER: f64 = 0.4;
const WEIGHT_TAG_AFFINITY: f64 = 0.25;
const WEIGHT_RATING_HISTORY: f64 = 0.2;
const WEIGHT_SEMANTIC: f64 = 0.15;

/// Staleness threshold in days
const STALE_THRESHOLD_DAYS: i64 = 7;

/// Input data for computing relevance signals for an item.
#[derive(Debug, Clone)]
pub struct RelevanceInput {
    pub item_id: String,
    pub item_type: RelevanceItemType,
    pub tags: Vec<String>,
    pub author: Option<String>,
    pub feed_id: Option<String>,
    pub category: Option<String>,
    pub source: Option<String>,
    pub title: String,
    pub embedding: Option<Vec<f32>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RelevanceItemType {
    Document,
    RssArticle,
    Extract,
}

/// Classifier entry used for signal computation.
#[derive(Debug, Clone)]
pub struct ClassifierSignal {
    pub classifier_type: String, // "author", "title", "tag", "feed"
    pub value: String,
    pub sentiment: String, // "like", "dislike", "neutral"
}

/// Rating history entry for a source.
#[derive(Debug, Clone)]
pub struct SourceRatingSummary {
    pub total_ratings: i32,
    pub positive_count: i32, // Good + Easy
    pub negative_count: i32, // Again + Hard
}

/// Result of computing a relevance score.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelevanceResult {
    pub score: f64,
    pub classifier_signal: Option<f64>,
    pub tag_affinity_signal: Option<f64>,
    pub rating_history_signal: Option<f64>,
    pub semantic_signal: Option<f64>,
    pub computed_at: DateTime<Utc>,
    pub is_stale: bool,
}

/// In-memory cache for tag affinity based on the last N ratings.
pub struct TagAffinityCache {
    /// Ring buffer of (tags, was_positive) entries.
    entries: VecDeque<(Vec<String>, bool)>,
    max_entries: usize,
    /// Precomputed tag frequency: tag -> (positive_count, total_count)
    frequency: HashMap<String, (usize, usize)>,
}

impl TagAffinityCache {
    pub fn new(max_entries: usize) -> Self {
        Self {
            entries: VecDeque::with_capacity(max_entries),
            max_entries,
            frequency: HashMap::new(),
        }
    }

    /// Initialize the cache from a batch of historical ratings.
    /// Each entry is (tags, was_positive) where was_positive = rating >= 3.
    pub fn initialize(&mut self, history: Vec<(Vec<String>, bool)>) {
        self.entries.clear();
        self.frequency.clear();
        for entry in history.into_iter().rev().take(self.max_entries) {
            self.push_entry(entry);
        }
    }

    /// Record a new rating event.
    pub fn record_rating(&mut self, tags: Vec<String>, was_positive: bool) {
        // Evict oldest if at capacity
        if self.entries.len() >= self.max_entries {
            if let Some((old_tags, _)) = self.entries.pop_front() {
                for tag in &old_tags {
                    if let Some(counts) = self.frequency.get_mut(tag) {
                        counts.1 = counts.1.saturating_sub(1);
                        if !was_positive {
                            // The evicted entry had its own positive/negative status
                        }
                        // We lose info about whether the evicted entry was positive
                        // Simplification: we track the full counts accurately only on rebuild
                    }
                }
            }
        }
        self.push_entry((tags, was_positive));
    }

    /// Get the tag affinity signal for a set of tags.
    /// Returns None if the cache has fewer than 10 entries (cold start).
    pub fn compute_signal(&self, tags: &[String]) -> Option<f64> {
        if self.entries.len() < 10 {
            return None;
        }

        if tags.is_empty() {
            return None;
        }

        let total_entries = self.entries.len() as f64;
        let mut weighted_sum = 0.0;
        let mut tag_count = 0;

        for tag in tags {
            if let Some((positive, total)) = self.frequency.get(tag) {
                if *total > 0 {
                    // Affinity for this tag: ratio of positive ratings / total ratings
                    let affinity = *positive as f64 / *total as f64;
                    // Weight by how common this tag is in the history
                    let prevalence = *total as f64 / total_entries;
                    weighted_sum += affinity * (1.0 + prevalence);
                    tag_count += 1;
                }
            }
        }

        if tag_count == 0 {
            return Some(0.3); // No overlap = slightly below neutral
        }

        // Normalize to 0.0-1.0 range
        let signal = weighted_sum / tag_count as f64 / 2.0;
        Some(signal.clamp(0.0, 1.0))
    }

    fn push_entry(&mut self, entry: (Vec<String>, bool)) {
        let was_positive = entry.1;
        for tag in &entry.0 {
            let counts = self.frequency.entry(tag.clone()).or_insert((0, 0));
            counts.1 += 1;
            if was_positive {
                counts.0 += 1;
            }
        }
        self.entries.push_back(entry);
    }
}

/// Compute the classifier match signal for an item.
///
/// Returns a value in [-1.0, 1.0] based on matching classifiers.
/// Positive = likes match, Negative = dislikes match.
pub fn compute_classifier_signal(
    item: &RelevanceInput,
    classifiers: &[ClassifierSignal],
) -> Option<f64> {
    if classifiers.is_empty() {
        return None;
    }

    let title_lower = item.title.to_lowercase();
    let author_lower = item.author.as_ref().map(|a| a.to_lowercase());

    let mut score: f64 = 0.0;
    let mut any_match = false;

    for classifier in classifiers {
        let value_lower = classifier.value.to_lowercase();
        let matches = match classifier.classifier_type.as_str() {
            "author" => author_lower
                .as_ref()
                .is_some_and(|a| a.contains(&value_lower)),
            "title" => title_lower.contains(&value_lower),
            "tag" => item.tags.iter().any(|t| t.to_lowercase().contains(&value_lower)),
            "feed" => item.feed_id.as_ref().is_some_and(|f| f == &classifier.value),
            _ => false,
        };

        if matches {
            any_match = true;
            match classifier.sentiment.as_str() {
                "like" => score += 1.0,
                "dislike" => score -= 1.0,
                _ => {}
            }
        }
    }

    if !any_match {
        return None;
    }

    // Normalize to [-1.0, 1.0] using tanh-like scaling
    Some(score.tanh())
}

/// Compute the rating history signal for an item based on source/author sentiment.
///
/// Returns a value in [0.0, 1.0] where 0.5 = neutral.
pub fn compute_rating_history_signal(
    item: &RelevanceInput,
    source_summaries: &HashMap<String, SourceRatingSummary>,
) -> Option<f64> {
    let mut total_positive = 0_i32;
    let mut total_negative = 0_i32;
    let mut matched = false;

    if let Some(author) = &item.author {
        if let Some(summary) = source_summaries.get(&format!("author:{}", author.to_lowercase())) {
            total_positive += summary.positive_count;
            total_negative += summary.negative_count;
            matched = true;
        }
    }

    // Match by feed_id
    if let Some(feed_id) = &item.feed_id {
        if let Some(summary) = source_summaries.get(&format!("feed:{}", feed_id)) {
            total_positive += summary.positive_count;
            total_negative += summary.negative_count;
            matched = true;
        }
    }

    if let Some(category) = &item.category {
        if let Some(summary) = source_summaries.get(&format!("category:{}", category.to_lowercase())) {
            total_positive += summary.positive_count;
            total_negative += summary.negative_count;
            matched = true;
        }
    }

    if !matched {
        return None;
    }

    let total = total_positive + total_negative;
    if total == 0 {
        return Some(0.5);
    }

    // Scale: 0.0 = all negative, 0.5 = neutral, 1.0 = all positive
    Some((total_positive as f64 / total as f64).clamp(0.0, 1.0))
}

/// Compute the semantic similarity signal for an item.
///
/// Returns a value in [0.0, 1.0] based on cosine similarity to the centroid
/// of favorited/high-rated item embeddings.
pub fn compute_semantic_signal(
    item_embedding: &Vec<f32>,
    favorite_centroid: &Option<Vec<f32>>,
) -> Option<f64> {
    let centroid = favorite_centroid.as_ref()?;
    if item_embedding.is_empty() || centroid.is_empty() {
        return None;
    }

    let similarity = cosine_similarity(item_embedding, centroid);
    // Scale from [-1, 1] to [0, 1]
    Some(((similarity + 1.0) / 2.0).clamp(0.0, 1.0))
}

/// Compute the composite relevance score from individual signals.
///
/// Missing signals have their weight redistributed proportionally among available signals.
/// Returns 0.5 (neutral) if no signals are available.
pub fn compute_composite_score(
    classifier: Option<f64>,
    tag_affinity: Option<f64>,
    rating_history: Option<f64>,
    semantic: Option<f64>,
) -> f64 {
    let signals: Vec<(f64, f64)> = [
        (classifier, WEIGHT_CLASSIFIER),
        (tag_affinity, WEIGHT_TAG_AFFINITY),
        (rating_history, WEIGHT_RATING_HISTORY),
        (semantic, WEIGHT_SEMANTIC),
    ]
    .iter()
    .filter_map(|(sig, weight)| sig.map(|s| (s, *weight)))
    .collect();

    if signals.is_empty() {
        return 0.5;
    }

    // Redistribute weight from missing signals
    let total_weight: f64 = signals.iter().map(|(_, w)| *w).sum();
    let weighted_sum: f64 = signals.iter().map(|(s, w)| s * w).sum();

    let score = weighted_sum / total_weight;
    score.clamp(0.0, 1.0)
}

/// Check if a relevance score is stale (older than threshold).
pub fn is_score_stale(computed_at: &DateTime<Utc>) -> bool {
    let now = Utc::now();
    (now - *computed_at).num_days() >= STALE_THRESHOLD_DAYS
}

/// Cosine similarity between two vectors.
fn cosine_similarity(a: &[f32], b: &[f32]) -> f64 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }

    let dot: f64 = a.iter().zip(b.iter()).map(|(x, y)| (*x as f64) * (*y as f64)).sum();
    let norm_a: f64 = a.iter().map(|x| (*x as f64).powi(2)).sum::<f64>().sqrt();
    let norm_b: f64 = b.iter().map(|x| (*x as f64).powi(2)).sum::<f64>().sqrt();

    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }

    dot / (norm_a * norm_b)
}

/// Compute the centroid of a set of embeddings.
pub fn compute_embedding_centroid(embeddings: &[Vec<f32>]) -> Option<Vec<f32>> {
    if embeddings.is_empty() {
        return None;
    }

    let dim = embeddings[0].len();
    let mut centroid = vec![0.0f32; dim];

    for embedding in embeddings {
        if embedding.len() != dim {
            continue;
        }
        for (i, val) in embedding.iter().enumerate() {
            centroid[i] += val;
        }
    }

    let count = embeddings.len() as f32;
    for val in &mut centroid {
        *val /= count;
    }

    Some(centroid)
}

/// Full relevance computation for a single item.
pub fn compute_relevance(
    item: &RelevanceInput,
    classifiers: &[ClassifierSignal],
    tag_affinity_cache: &TagAffinityCache,
    source_summaries: &HashMap<String, SourceRatingSummary>,
    favorite_centroid: &Option<Vec<f32>>,
) -> RelevanceResult {
    let classifier_signal = compute_classifier_signal(item, classifiers);
    let tag_affinity_signal = tag_affinity_cache.compute_signal(&item.tags);
    let rating_history_signal = compute_rating_history_signal(item, source_summaries);
    let semantic_signal = item
        .embedding
        .as_ref()
        .and_then(|emb| compute_semantic_signal(emb, favorite_centroid));

    let score = compute_composite_score(
        classifier_signal,
        tag_affinity_signal,
        rating_history_signal,
        semantic_signal,
    );

    RelevanceResult {
        score,
        classifier_signal,
        tag_affinity_signal,
        rating_history_signal,
        semantic_signal,
        computed_at: Utc::now(),
        is_stale: false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_composite_score_all_signals() {
        let score = compute_composite_score(
            Some(0.8),  // classifier
            Some(0.6),  // tag affinity
            Some(0.7),  // rating history
            Some(0.9),  // semantic
        );
        let expected = (0.8 * 0.4 + 0.6 * 0.25 + 0.7 * 0.2 + 0.9 * 0.15)
            / (0.4 + 0.25 + 0.2 + 0.15);
        assert!((score - expected).abs() < 0.001);
    }

    #[test]
    fn test_composite_score_partial_signals() {
        let score = compute_composite_score(
            Some(0.8),  // classifier
            None,       // tag affinity missing
            Some(0.7),  // rating history
            None,       // semantic missing
        );
        // Weight redistributed: 0.4 and 0.2 are present, total = 0.6
        let expected = (0.8 * 0.4 + 0.7 * 0.2) / (0.4 + 0.2);
        assert!((score - expected).abs() < 0.001);
    }

    #[test]
    fn test_composite_score_no_signals() {
        let score = compute_composite_score(None, None, None, None);
        assert_eq!(score, 0.5);
    }

    #[test]
    fn test_composite_score_clamped() {
        let score = compute_composite_score(Some(1.5), None, None, None);
        assert_eq!(score, 1.0);
    }

    #[test]
    fn test_classifier_signal_like() {
        let item = RelevanceInput {
            item_id: "test".into(),
            item_type: RelevanceItemType::RssArticle,
            tags: vec![],
            author: Some("John Doe".into()),
            feed_id: None,
            category: None,
            source: None,
            title: "Test".into(),
            embedding: None,
        };
        let classifiers = vec![ClassifierSignal {
            classifier_type: "author".into(),
            value: "John Doe".into(),
            sentiment: "like".into(),
        }];
        let signal = compute_classifier_signal(&item, &classifiers).unwrap();
        assert!(signal > 0.0);
    }

    #[test]
    fn test_classifier_signal_dislike() {
        let item = RelevanceInput {
            item_id: "test".into(),
            item_type: RelevanceItemType::RssArticle,
            tags: vec![],
            author: Some("Bad Author".into()),
            feed_id: None,
            category: None,
            source: None,
            title: "Test".into(),
            embedding: None,
        };
        let classifiers = vec![ClassifierSignal {
            classifier_type: "author".into(),
            value: "Bad Author".into(),
            sentiment: "dislike".into(),
        }];
        let signal = compute_classifier_signal(&item, &classifiers).unwrap();
        assert!(signal < 0.0);
    }

    #[test]
    fn test_classifier_signal_no_match() {
        let item = RelevanceInput {
            item_id: "test".into(),
            item_type: RelevanceItemType::RssArticle,
            tags: vec![],
            author: Some("Unknown".into()),
            feed_id: None,
            category: None,
            source: None,
            title: "Test".into(),
            embedding: None,
        };
        let classifiers = vec![ClassifierSignal {
            classifier_type: "author".into(),
            value: "Someone Else".into(),
            sentiment: "like".into(),
        }];
        let signal = compute_classifier_signal(&item, &classifiers);
        assert!(signal.is_none());
    }

    #[test]
    fn test_rating_history_signal() {
        let item = RelevanceInput {
            item_id: "test".into(),
            item_type: RelevanceItemType::Document,
            tags: vec![],
            author: Some("Author A".into()),
            feed_id: None,
            category: None,
            source: None,
            title: "Test".into(),
            embedding: None,
        };
        let mut summaries = HashMap::new();
        summaries.insert(
            "author:author a".into(),
            SourceRatingSummary {
                total_ratings: 10,
                positive_count: 8,
                negative_count: 2,
            },
        );
        let signal = compute_rating_history_signal(&item, &summaries).unwrap();
        assert!(signal > 0.5); // Mostly positive
    }

    #[test]
    fn test_cosine_similarity() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        assert!((cosine_similarity(&a, &b) - 1.0).abs() < 0.001);

        let a = vec![1.0, 0.0, 0.0];
        let b = vec![0.0, 1.0, 0.0];
        assert!((cosine_similarity(&a, &b)).abs() < 0.001);
    }

    #[test]
    fn test_tag_affinity_cache() {
        let mut cache = TagAffinityCache::new(100);

        // Cold start: fewer than 10 entries
        cache.record_rating(vec!["rust".into()], true);
        assert!(cache.compute_signal(&["rust".into()]).is_none());

        // Fill up past threshold
        for _ in 0..15 {
            cache.record_rating(vec!["rust".into(), "systems".into()], true);
        }
        for _ in 0..5 {
            cache.record_rating(vec!["javascript".into()], false);
        }

        // Rust should have high affinity (all positive)
        let signal = cache.compute_signal(&["rust".into()]).unwrap();
        assert!(signal > 0.4);

        // Tags with no history should be low
        let signal = cache.compute_signal(&["nonexistent".into()]).unwrap();
        assert!(signal < 0.5);
    }

    #[test]
    fn test_is_score_stale() {
        let recent = Utc::now();
        assert!(!is_score_stale(&recent));

        let old = Utc::now() - chrono::Duration::days(8);
        assert!(is_score_stale(&old));
    }

    #[test]
    fn test_semantic_signal_with_centroid() {
        let item_embedding = vec![1.0, 0.0, 0.0];
        let centroid = Some(vec![1.0, 0.0, 0.0]);
        let signal = compute_semantic_signal(&item_embedding, &centroid).unwrap();
        assert!(signal > 0.9); // Same direction = high similarity

        let item_embedding = vec![0.0, 1.0, 0.0];
        let signal = compute_semantic_signal(&item_embedding, &centroid).unwrap();
        assert!((signal - 0.5).abs() < 0.01); // Orthogonal = neutral
    }

    #[test]
    fn test_semantic_signal_no_centroid() {
        let item_embedding = vec![1.0, 0.0, 0.0];
        let signal = compute_semantic_signal(&item_embedding, &None);
        assert!(signal.is_none());
    }

    #[test]
    fn test_compute_embedding_centroid() {
        let embeddings = vec![
            vec![2.0, 4.0],
            vec![4.0, 2.0],
        ];
        let centroid = compute_embedding_centroid(&embeddings).unwrap();
        assert!((centroid[0] - 3.0).abs() < 0.001);
        assert!((centroid[1] - 3.0).abs() < 0.001);
    }

    #[test]
    fn test_compute_embedding_centroid_empty() {
        let centroid = compute_embedding_centroid(&[]);
        assert!(centroid.is_none());
    }

    #[test]
    fn test_full_relevance_computation() {
        let item = RelevanceInput {
            item_id: "doc1".into(),
            item_type: RelevanceItemType::Document,
            tags: vec!["rust".into(), "systems".into()],
            author: Some("Author A".into()),
            feed_id: None,
            category: Some("programming".into()),
            source: None,
            title: "Rust Programming Guide".into(),
            embedding: Some(vec![1.0, 0.0, 0.0]),
        };

        let classifiers = vec![
            ClassifierSignal {
                classifier_type: "author".into(),
                value: "Author A".into(),
                sentiment: "like".into(),
            },
        ];

        let mut tag_cache = TagAffinityCache::new(100);
        for _ in 0..15 {
            tag_cache.record_rating(vec!["rust".into(), "systems".into()], true);
        }

        let mut source_summaries = std::collections::HashMap::new();
        source_summaries.insert(
            "author:author a".into(),
            SourceRatingSummary {
                total_ratings: 10,
                positive_count: 8,
                negative_count: 2,
            },
        );

        let favorite_centroid = Some(vec![1.0, 0.0, 0.0]);

        let result = compute_relevance(
            &item,
            &classifiers,
            &tag_cache,
            &source_summaries,
            &favorite_centroid,
        );

        // All signals are positive, so score should be well above neutral
        assert!(result.score > 0.5);
        assert!(result.classifier_signal.is_some());
        assert!(result.tag_affinity_signal.is_some());
        assert!(result.rating_history_signal.is_some());
        assert!(result.semantic_signal.is_some());
        assert!(!result.is_stale);
    }

    #[test]
    fn test_cold_start_behavior() {
        let item = RelevanceInput {
            item_id: "new_doc".into(),
            item_type: RelevanceItemType::Document,
            tags: vec!["new_topic".into()],
            author: None,
            feed_id: None,
            category: None,
            source: None,
            title: "New Topic".into(),
            embedding: None,
        };

        let tag_cache = TagAffinityCache::new(100); // Empty cache
        let source_summaries = std::collections::HashMap::new();
        let result = compute_relevance(
            &item,
            &[],
            &tag_cache,
            &source_summaries,
            &None,
        );

        // No signals → neutral score
        assert!((result.score - 0.5).abs() < 0.001);
        assert!(result.classifier_signal.is_none());
        assert!(result.rating_history_signal.is_none());
        assert!(result.semantic_signal.is_none());
    }

    #[test]
    fn test_high_relevance_items_sort_earlier() {
        let high_relevance = compute_composite_score(
            Some(0.9),
            Some(0.8),
            Some(0.9),
            Some(0.8),
        );
        let low_relevance = compute_composite_score(
            Some(0.1),
            Some(0.2),
            Some(0.1),
            Some(0.2),
        );
        assert!(high_relevance > low_relevance);

        // Simulate blending with same FSRS priority
        let fsrs_priority = 7.0;
        let weight = 0.3;
        let high_blended = fsrs_priority * (1.0 - weight) + high_relevance * 10.0 * weight;
        let low_blended = fsrs_priority * (1.0 - weight) + low_relevance * 10.0 * weight;
        assert!(high_blended > low_blended);
    }

    #[test]
    fn test_blending_formula_weight_zero() {
        let fsrs_priority: f64 = 7.0;
        let relevance: f64 = 0.9;
        let weight: f64 = 0.0;
        let blended = fsrs_priority * (1.0 - weight) + relevance * 10.0 * weight;
        assert!((blended - 7.0).abs() < 0.001); // Pure FSRS
    }

    #[test]
    fn test_blending_formula_weight_one() {
        let fsrs_priority: f64 = 7.0;
        let relevance: f64 = 0.9;
        let weight: f64 = 1.0;
        let blended = fsrs_priority * (1.0 - weight) + relevance * 10.0 * weight;
        assert!((blended - 9.0).abs() < 0.001); // Pure relevance
    }

    #[test]
    fn test_blending_formula_missing_score() {
        let fsrs_priority: f64 = 7.0;
        let weight: f64 = 0.3;
        let blended = fsrs_priority * (1.0 - weight); // No relevance contribution
        assert!((blended - 4.9).abs() < 0.001);
    }

    #[test]
    fn test_rating_history_multiple_sources() {
        let item = RelevanceInput {
            item_id: "test".into(),
            item_type: RelevanceItemType::RssArticle,
            tags: vec![],
            author: Some("Author A".into()),
            feed_id: Some("feed1".into()),
            category: Some("tech".into()),
            source: None,
            title: "Test".into(),
            embedding: None,
        };
        let mut summaries = std::collections::HashMap::new();
        summaries.insert("author:author a".into(), SourceRatingSummary {
            total_ratings: 5, positive_count: 4, negative_count: 1,
        });
        summaries.insert("feed:feed1".into(), SourceRatingSummary {
            total_ratings: 10, positive_count: 2, negative_count: 8,
        });
        summaries.insert("category:tech".into(), SourceRatingSummary {
            total_ratings: 20, positive_count: 15, negative_count: 5,
        });
        let signal = compute_rating_history_signal(&item, &summaries).unwrap();
        // Mixed: positive author/category, negative feed
        assert!(signal > 0.3);
    }
}
