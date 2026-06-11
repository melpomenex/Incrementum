//! Tag-Aware Scheduling — prerequisite gating

use crate::models::{Tag, TagStabilityStats};

/// Result of prerequisite gating for a single item
#[derive(Debug, Clone)]
pub struct GatingResult {
    pub blocked: bool,
    /// If blocked, which tag is the reason (tag name that has an immature prerequisite)
    pub block_reason: Option<String>,
}

/// Check if an item should be blocked based on its tags' prerequisites.
///
/// `item_tags` — names of tags assigned to this item.
/// `all_tags` — all known tags keyed by name, with their stability stats.
/// `maturity_ratio` — the ratio of mature items required for a prerequisite to be "satisfied".
///
/// An item is blocked if ANY of its tags has ANY prerequisite where
/// the prerequisite's maturity_ratio < maturity_ratio.
pub fn evaluate_prerequisite_gating(
    item_tags: &[String],
    all_tags: &std::collections::HashMap<String, &Tag>,
    tag_stats: &std::collections::HashMap<String, TagStabilityStats>,
    maturity_ratio: f64,
) -> GatingResult {
    for tag_name in item_tags {
        if let Some(tag) = all_tags.get(tag_name) {
            for prereq_id in &tag.prerequisites {
                // Find the prerequisite tag by id
                let prereq_name = all_tags
                    .values()
                    .find(|t| t.id == *prereq_id)
                    .map(|t| t.name.clone())
                    .unwrap_or_else(|| prereq_id.clone());

                let stats = tag_stats.get(&prereq_name);
                let ratio = stats.map(|s| s.maturity_ratio).unwrap_or(0.0);

                if ratio < maturity_ratio {
                    return GatingResult {
                        blocked: true,
                        block_reason: Some(format!(
                            "Waiting on `{}` maturity ({:.0}%)",
                            prereq_name,
                            ratio * 100.0
                        )),
                    };
                }
            }
        }
    }

    GatingResult {
        blocked: false,
        block_reason: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Tag;

    fn make_tag(id: &str, name: &str, prereqs: Vec<String>) -> Tag {
        Tag {
            id: id.into(),
            name: name.into(),
            prerequisites: prereqs,
            maturity_threshold: 0.8,
            centroid: None,
            coherence: None,
            item_count: 10,
            avg_stability: None,
            mature_count: 0,
            date_created: String::new(),
            date_modified: String::new(),
        }
    }

    fn stats(ratio: f64) -> TagStabilityStats {
        TagStabilityStats::new(10, Some(0.5), (ratio * 10.0) as i32)
    }

    #[test]
    fn test_item_blocked_by_immature_prerequisite() {
        let tag = make_tag("t2", "derivatives", vec!["t1".into()]);
        let prereq = make_tag("t1", "limits", vec![]);
        let all_tags = {
            let mut m = std::collections::HashMap::new();
            m.insert("derivatives".to_string(), &tag);
            m.insert("limits".to_string(), &prereq);
            // Fix: need to store tags so we can find by name
            m
        };
        let tag_stats = {
            let mut m = std::collections::HashMap::new();
            m.insert("limits".to_string(), stats(0.3));
            m
        };

        let result = evaluate_prerequisite_gating(
            &["derivatives".to_string()],
            &all_tags,
            &tag_stats,
            0.7,
        );
        assert!(result.blocked);
        assert!(result.block_reason.unwrap().contains("limits"));
    }

    #[test]
    fn test_item_passes_with_mature_prerequisite() {
        let tag = make_tag("t2", "derivatives", vec!["t1".into()]);
        let prereq = make_tag("t1", "limits", vec![]);
        let all_tags = {
            let mut m = std::collections::HashMap::new();
            m.insert("derivatives".to_string(), &tag);
            m.insert("limits".to_string(), &prereq);
            m
        };
        let tag_stats = {
            let mut m = std::collections::HashMap::new();
            m.insert("limits".to_string(), stats(0.9));
            m
        };

        let result = evaluate_prerequisite_gating(
            &["derivatives".to_string()],
            &all_tags,
            &tag_stats,
            0.7,
        );
        assert!(!result.blocked);
    }

    #[test]
    fn test_untagged_item_unblocked() {
        let all_tags = std::collections::HashMap::new();
        let tag_stats = std::collections::HashMap::new();

        let result =
            evaluate_prerequisite_gating(&[], &all_tags, &tag_stats, 0.7);
        assert!(!result.blocked);

        let result =
            evaluate_prerequisite_gating(&["nonexistent".to_string()], &all_tags, &tag_stats, 0.7);
        assert!(!result.blocked);
    }
}
