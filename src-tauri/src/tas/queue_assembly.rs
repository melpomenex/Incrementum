//! Tag-Aware Scheduling — queue assembly

use chrono::{DateTime, Utc};
use crate::models::TASScheduledItem;
use crate::tas::gating::{evaluate_prerequisite_gating, GatingResult};
use crate::tas::jitter::{apply_interference_jitter, JitterInput};
use crate::models::{Tag, TagStabilityStats, TASConfig};

/// Input to the TAS queue builder: a due item from the existing scheduler
#[derive(Debug, Clone)]
pub struct TASQueueInput {
    pub item_id: String,
    pub document_id: String,
    pub document_title: String,
    pub item_type: String,
    pub tags: Vec<String>,
    pub priority: f64,
    pub due_date: Option<String>,
    pub stability: Option<f64>,
    pub due_time: Option<DateTime<Utc>>,
}

/// Build the TAS-annotated queue by applying prerequisite gating, then interference jitter,
/// then sorting eligible items.
pub fn assemble_tas_queue(
    items: Vec<TASQueueInput>,
    all_tags: &std::collections::HashMap<String, Tag>,
    tag_stats: &std::collections::HashMap<String, TagStabilityStats>,
    tag_coherence: &std::collections::HashMap<String, f64>,
    config: &TASConfig,
) -> Vec<TASScheduledItem> {
    // Phase 1: Prerequisite gating
    let step1: Vec<(TASQueueInput, GatingResult)> = if config.prerequisites.enabled {
        // Build a lookup: tag name → &Tag for gating
        let tag_by_name: std::collections::HashMap<String, &Tag> = all_tags
            .values()
            .map(|t| (t.name.clone(), t))
            .collect();

        items
            .into_iter()
            .map(|item| {
                let gating = evaluate_prerequisite_gating(
                    &item.tags,
                    &tag_by_name,
                    tag_stats,
                    config.prerequisites.maturity_ratio,
                );
                (item, gating)
            })
            .collect()
    } else {
        items
            .into_iter()
            .map(|item| {
                (
                    item,
                    GatingResult {
                        blocked: false,
                        block_reason: None,
                    },
                )
            })
            .collect()
    };

    // Phase 2: Separate blocked from unblocked
    let mut blocked_items: Vec<TASScheduledItem> = Vec::new();
    let unblocked: Vec<(TASQueueInput, GatingResult)> = step1
        .into_iter()
        .filter(|(item, gating)| {
            if gating.blocked {
                blocked_items.push(TASScheduledItem {
                    item_id: item.item_id.clone(),
                    document_id: item.document_id.clone(),
                    document_title: item.document_title.clone(),
                    item_type: item.item_type.clone(),
                    tags: item.tags.clone(),
                    priority: item.priority,
                    due_date: item.due_date.clone(),
                    stability: item.stability,
                    prerequisite_blocked: true,
                    interference_delay_until: None,
                    block_reason: gating.block_reason.clone(),
                });
                false
            } else {
                true
            }
        })
        .collect();

    // Phase 3: Interference jitter on unblocked items
    let jitter_results: Vec<crate::tas::jitter::JitterResult> = if config.interference.enabled {
        let now = Utc::now();
        let jitter_inputs: Vec<JitterInput> = unblocked
            .iter()
            .map(|(item, _gating)| {
                let due_time = item
                    .due_time
                    .unwrap_or(now);
                JitterInput {
                    item_id: item.item_id.clone(),
                    tags: item.tags.clone(),
                    due_time,
                    scheduled_time: Some(due_time),
                }
            })
            .collect();

        apply_interference_jitter(
            &jitter_inputs,
            tag_coherence,
            config.interference.coherence_threshold,
            config.interference.min_separation_hours,
            10, // window size
        )
    } else {
        std::iter::repeat(crate::tas::jitter::JitterResult {
            delay_until: None,
            reason: None,
        })
        .take(unblocked.len())
        .collect()
    };

    // Phase 4: Combine unblocked items with jitter results
    let now = Utc::now();
    let mut eligible: Vec<TASScheduledItem> = Vec::new();
    let mut jitter_delayed: Vec<TASScheduledItem> = Vec::new();

    for (i, ((item, _gating), jitter)) in unblocked.iter().zip(jitter_results.iter()).enumerate() {
        let delay_until_str = jitter.delay_until.map(|dt| dt.to_rfc3339());

        let scheduled = TASScheduledItem {
            item_id: item.item_id.clone(),
            document_id: item.document_id.clone(),
            document_title: item.document_title.clone(),
            item_type: item.item_type.clone(),
            tags: item.tags.clone(),
            priority: item.priority,
            due_date: item.due_date.clone(),
            stability: item.stability,
            prerequisite_blocked: false,
            interference_delay_until: delay_until_str.clone(),
            block_reason: jitter.reason.clone(),
        };

        // Check if delay has elapsed
        let is_delayed = jitter
            .delay_until
            .map(|dt| dt > now)
            .unwrap_or(false);

        if is_delayed {
            jitter_delayed.push(scheduled);
        } else {
            eligible.push(scheduled);
        }
    }

    // Phase 5: Sort eligible items
    // Sort by: (1) priority descending, (2) due_date ascending, (3) stability ascending
    eligible.sort_by(|a, b| {
        b.priority
            .partial_cmp(&a.priority)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| {
                a.due_date
                    .as_deref()
                    .unwrap_or("")
                    .cmp(b.due_date.as_deref().unwrap_or(""))
            })
            .then_with(|| {
                a.stability
                    .unwrap_or(f64::MAX)
                    .partial_cmp(&b.stability.unwrap_or(f64::MAX))
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
    });

    // Combine: blocked → jitter_delayed → eligible (frontend can choose display order)
    let mut result = blocked_items;
    result.append(&mut jitter_delayed);
    result.append(&mut eligible);

    result
}
