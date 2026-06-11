//! Tag-Aware Scheduling (TAS) Tauri commands

use std::collections::HashMap;
use tauri::State;
use chrono::Utc;
use crate::database::Repository;
use crate::error::{IncrementumError, Result};
use crate::models::{
    Tag, TagStabilityStats, TASConfig, TASScheduledItem,
};
use crate::tas::circular::detect_circular;
use crate::tas::maturity::recompute_tag_stability_stats;
use crate::tas::queue_assembly::{assemble_tas_queue, TASQueueInput};

/// Build the TAS-annotated queue for a given date.
/// Reads TAS config from the settings table; if disabled, returns empty.
#[tauri::command]
pub async fn build_tas_queue(
    repo: State<'_, Repository>,
    _date: String,
) -> Result<Vec<TASScheduledItem>> {
    // Load TAS config from settings
    let config = match repo.get_setting("tas_config").await? {
        Some(json) => serde_json::from_str::<TASConfig>(&json)
            .unwrap_or_default(),
        None => TASConfig::default(),
    };

    // If TAS is disabled, return empty (frontend should use normal queue)
    if !config.enabled {
        return Ok(vec![]);
    }

    // Load all tags
    let tags = repo.get_all_tags().await?;
    let tags_by_name: HashMap<String, Tag> = tags
        .into_iter()
        .map(|t| (t.name.clone(), t))
        .collect();

    // Compute tag stability stats
    let mut tag_stats: HashMap<String, TagStabilityStats> = HashMap::new();
    for tag in tags_by_name.values() {
        let items = repo.get_learning_items_for_tag(&tag.name).await?;
        let stabilities: Vec<Option<f64>> = items
            .iter()
            .map(|item| item.memory_state.as_ref().map(|ms| ms.stability))
            .collect();
        tag_stats.insert(tag.name.clone(), recompute_tag_stability_stats(&stabilities, tag));
    }

    // Build coherence map from tag data
    let tag_coherence: HashMap<String, f64> = tags_by_name
        .iter()
        .filter_map(|(name, tag)| tag.coherence.map(|c| (name.clone(), c)))
        .collect();

    // Get all due (non-suspended) learning items
    let now = Utc::now();
    let due_items = repo.get_all_learning_items().await?
        .into_iter()
        .filter(|item| {
            if item.is_suspended {
                return false;
            }
            item.due_date <= now
        })
        .collect::<Vec<_>>();

    // Convert to TAS input
    let inputs: Vec<TASQueueInput> = due_items
        .into_iter()
        .map(|item| {
            TASQueueInput {
                item_id: item.id.clone(),
                document_id: item.document_id.clone().unwrap_or_default(),
                document_title: item.question.clone(),
                item_type: format!("{:?}", item.item_type).to_lowercase(),
                tags: item.tags.clone(),
                priority: 50.0,
                due_date: Some(item.due_date.to_rfc3339()),
                stability: item.memory_state.as_ref().map(|ms| ms.stability),
                due_time: Some(item.due_date),
            }
        })
        .collect();

    // Assemble the TAS queue
    let result = assemble_tas_queue(inputs, &tags_by_name, &tag_stats, &tag_coherence, &config);

    Ok(result)
}

/// Set prerequisites for a tag. Validates no circular dependency.
#[tauri::command]
pub async fn set_tag_prerequisites(
    repo: State<'_, Repository>,
    tag_id: String,
    prerequisite_ids: Vec<String>,
) -> Result<Tag> {
    let all_tags = repo.get_all_tags().await?;
    let prereqs_map: HashMap<String, Vec<String>> = all_tags
        .iter()
        .map(|t| (t.id.clone(), t.prerequisites.clone()))
        .collect();

    if detect_circular(&tag_id, &prerequisite_ids, &prereqs_map) {
        return Err(IncrementumError::InvalidInput(
            "Circular prerequisite dependency detected".into(),
        ));
    }

    repo.set_tag_prerequisites(&tag_id, &prerequisite_ids).await
}

/// Get maturity statistics for a tag
#[tauri::command]
pub async fn get_tag_maturity_stats(
    repo: State<'_, Repository>,
    tag_id: String,
) -> Result<TagStabilityStats> {
    let tag = repo.get_tag(&tag_id).await?;
    let items = repo.get_learning_items_for_tag(&tag.name).await?;
    let stabilities: Vec<Option<f64>> = items
        .iter()
        .map(|item| item.memory_state.as_ref().map(|ms| ms.stability))
        .collect();
    Ok(recompute_tag_stability_stats(&stabilities, &tag))
}

/// Get all tags
#[tauri::command]
pub async fn get_tags(
    repo: State<'_, Repository>,
) -> Result<Vec<Tag>> {
    repo.get_all_tags().await
}

/// Create or update a tag
#[tauri::command]
pub async fn upsert_tag(
    repo: State<'_, Repository>,
    tag: TagInput,
) -> Result<Tag> {
    repo.upsert_tag(
        &tag.name,
        tag.prerequisites.as_deref().unwrap_or(&[]),
        tag.maturity_threshold.unwrap_or(0.8),
    ).await
}

/// Delete a tag and remove it from other tags' prerequisites
#[tauri::command]
pub async fn delete_tag(
    repo: State<'_, Repository>,
    tag_id: String,
) -> Result<()> {
    repo.remove_tag_from_prerequisites(&tag_id).await?;
    repo.delete_tag(&tag_id).await
}

/// Sync tags: scan all items for tag names and insert missing ones into the tags table
#[tauri::command]
pub async fn sync_tags(
    repo: State<'_, Repository>,
) -> Result<usize> {
    repo.sync_tags_from_items().await
}

/// Compute tag centroids and coherence from existing item embeddings.
/// Must be called after embed_queue_items has generated embeddings.
/// Returns the number of tags updated.
#[tauri::command]
pub async fn compute_tag_centroids(
    repo: State<'_, Repository>,
) -> Result<usize> {
    repo.compute_tag_centroids().await
}

/// Get the current TAS configuration from persistent settings
#[tauri::command]
pub async fn get_tas_config(
    repo: State<'_, Repository>,
) -> Result<TASConfig> {
    match repo.get_setting("tas_config").await? {
        Some(json) => serde_json::from_str::<TASConfig>(&json)
            .map_err(|e| IncrementumError::Internal(format!("Failed to deserialize TAS config: {e}"))),
        None => Ok(TASConfig::default()),
    }
}

/// Update the TAS configuration (persisted to settings table)
#[tauri::command]
pub async fn update_tas_config(
    repo: State<'_, Repository>,
    config: TASConfig,
) -> Result<()> {
    let json = serde_json::to_string(&config)
        .map_err(|e| IncrementumError::Internal(format!("Failed to serialize TAS config: {e}")))?;
    repo.set_setting("tas_config", &json).await
}

/// Input for upserting a tag
#[derive(Debug, Clone, serde::Deserialize)]
pub struct TagInput {
    pub name: String,
    pub prerequisites: Option<Vec<String>>,
    pub maturity_threshold: Option<f64>,
}
