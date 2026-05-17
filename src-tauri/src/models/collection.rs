//! Collection model for data partitioning

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Default "Personal" collection ID — must match the migration seed value
pub const DEFAULT_COLLECTION_ID: &str = "00000000-0000-0000-0000-000000000001";

/// Collection for partitioning user data
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub is_default: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Collection {
    pub fn new(name: String) -> Self {
        let now = Utc::now();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            icon: None,
            color: None,
            is_default: false,
            created_at: now,
            updated_at: now,
        }
    }
}
