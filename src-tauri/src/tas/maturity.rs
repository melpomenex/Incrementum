//! Tag-Aware Scheduling (TAS) — maturity computation

use crate::models::{Tag, TagStabilityStats};

/// Determine if an item is mature for a given tag.
/// An item is mature when its SM-20/FSRS stability meets or exceeds the tag's `maturity_threshold`.
pub fn is_item_mature(stability: f64, tag: &Tag) -> bool {
    stability >= tag.maturity_threshold
}

/// Recompute stability statistics for a set of items belonging to a single tag.
///
/// `members` is an iterator of (stability: Option<f64>) for each item assigned to the tag.
/// Returns updated TagStabilityStats.
pub fn recompute_tag_stability_stats(members: &[Option<f64>], tag: &Tag) -> TagStabilityStats {
    let item_count = members.len() as i32;
    if item_count == 0 {
        return TagStabilityStats::new(0, None, 0);
    }

    let stabilities: Vec<f64> = members.iter().filter_map(|s| *s).collect();
    let mature_threshold = tag.maturity_threshold;

    let mature_count = stabilities
        .iter()
        .filter(|&&s| s >= mature_threshold)
        .count() as i32;

    let avg_stability = if stabilities.is_empty() {
        None
    } else {
        let sum: f64 = stabilities.iter().sum();
        Some(sum / stabilities.len() as f64)
    };

    TagStabilityStats::new(item_count, avg_stability, mature_count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Tag;

    fn make_tag(threshold: f64) -> Tag {
        Tag {
            id: "t1".into(),
            name: "test".into(),
            prerequisites: vec![],
            maturity_threshold: threshold,
            centroid: None,
            coherence: None,
            item_count: 0,
            avg_stability: None,
            mature_count: 0,
            date_created: String::new(),
            date_modified: String::new(),
        }
    }

    #[test]
    fn test_is_item_mature() {
        let tag = make_tag(0.8);
        assert!(is_item_mature(0.85, &tag));
        assert!(is_item_mature(0.8, &tag));
        assert!(!is_item_mature(0.79, &tag));
        assert!(!is_item_mature(0.3, &tag));
    }

    #[test]
    fn test_recompute_empty() {
        let tag = make_tag(0.8);
        let stats = recompute_tag_stability_stats(&[], &tag);
        assert_eq!(stats.item_count, 0);
        assert_eq!(stats.mature_count, 0);
        assert_eq!(stats.maturity_ratio, 0.0);
        assert!(stats.avg_stability.is_none());
    }

    #[test]
    fn test_recompute_mixed() {
        let tag = make_tag(0.8);
        let stabilities = [
            Some(0.9), // mature
            Some(0.85), // mature
            Some(0.7),  // not mature
            Some(0.6),  // not mature
            None,        // no stability data
        ];
        let stats = recompute_tag_stability_stats(&stabilities, &tag);
        assert_eq!(stats.item_count, 5);
        assert_eq!(stats.mature_count, 2);
        assert!((stats.maturity_ratio - 0.4).abs() < 0.001);
        // avg of [0.9, 0.85, 0.7, 0.6] = 3.05 / 4 = 0.7625
        assert!(stats.avg_stability.is_some());
        assert!((stats.avg_stability.unwrap() - 0.7625).abs() < 0.001);
    }
}
