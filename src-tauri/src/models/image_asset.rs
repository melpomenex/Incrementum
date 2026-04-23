//! Image asset model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageAsset {
    pub id: String,
    pub mime_type: String,
    pub file_name: Option<String>,
    pub content: Vec<u8>,
    pub byte_size: i64,
    pub sha256: String,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageAssetWithUsage {
    pub asset: ImageAsset,
    pub reference_count: i64,
}
