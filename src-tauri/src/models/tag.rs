//! Tag model for Tag-Aware Scheduling (TAS)

use serde::{Deserialize, Serialize};

/// A tag entity with metadata for TAS
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
    /// Tag IDs that must be mature before this tag's items can be reviewed
    pub prerequisites: Vec<String>,
    /// Stability threshold for maturity (0.0–1.0)
    pub maturity_threshold: f64,
    /// Embedding centroid (serialized f32 vector)
    pub centroid: Option<Vec<f32>>,
    /// Average pairwise cosine similarity of member items
    pub coherence: Option<f64>,
    /// Total number of items with this tag
    pub item_count: i32,
    /// Average SM-20/FSRS stability across items
    pub avg_stability: Option<f64>,
    /// Count of items whose stability >= maturity_threshold
    pub mature_count: i32,
    pub date_created: String,
    pub date_modified: String,
}

/// Computed stability statistics for a tag
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagStabilityStats {
    pub item_count: i32,
    pub avg_stability: Option<f64>,
    pub mature_count: i32,
    /// Maturity ratio = mature_count / item_count (0.0 if item_count is 0)
    pub maturity_ratio: f64,
}

impl TagStabilityStats {
    /// Create stats from raw counts
    pub fn new(item_count: i32, avg_stability: Option<f64>, mature_count: i32) -> Self {
        let maturity_ratio = if item_count > 0 {
            mature_count as f64 / item_count as f64
        } else {
            0.0
        };
        Self {
            item_count,
            avg_stability,
            mature_count,
            maturity_ratio,
        }
    }
}

/// Global Tag-Aware Scheduling configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TASConfig {
    /// Master enable/disable
    pub enabled: bool,
    /// Interference jitter subsystem config
    pub interference: TASInterferenceConfig,
    /// Prerequisite gating subsystem config
    pub prerequisites: TASPrerequisiteConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TASInterferenceConfig {
    pub enabled: bool,
    /// Minimum hours between items sharing a high-coherence tag
    pub min_separation_hours: i32,
    /// Coherence above which items are considered for separation
    pub coherence_threshold: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TASPrerequisiteConfig {
    pub enabled: bool,
    /// Ratio of mature items required for a prerequisite tag to be considered "satisfied"
    pub maturity_ratio: f64,
}

impl Default for TASConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            interference: TASInterferenceConfig {
                enabled: true,
                min_separation_hours: 4,
                coherence_threshold: 0.75,
            },
            prerequisites: TASPrerequisiteConfig {
                enabled: true,
                maturity_ratio: 0.7,
            },
        }
    }
}

/// An item as processed by TAS, with scheduling annotations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TASScheduledItem {
    pub item_id: String,
    pub document_id: String,
    pub document_title: String,
    pub item_type: String,
    pub tags: Vec<String>,
    pub priority: f64,
    pub due_date: Option<String>,
    pub stability: Option<f64>,
    /// Whether this item is blocked by prerequisites
    pub prerequisite_blocked: bool,
    /// ISO datetime until which this item is delayed by interference
    pub interference_delay_until: Option<String>,
    /// Human-readable reason for blocking/delay
    pub block_reason: Option<String>,
}
