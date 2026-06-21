//! Database layer for Incrementum

pub mod connection;
pub mod migrations;
pub mod repository;

pub use connection::Database;
pub use repository::Repository;
pub use repository::DocumentQueueInfo;

/// Stored embedding vector for a queue item
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct QueueItemEmbedding {
    pub item_id: String,
    /// Raw embedding vector bytes (f32 little-endian)
    pub embedding: Vec<f32>,
    pub content_hash: String,
    pub provider: String,
    pub model: String,
    pub dimension: i32,
    pub created_at: i64,
}

/// Stored embedding for a document chunk (whole-library RAG).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DocumentChunkEmbedding {
    pub id: String,
    pub document_id: String,
    pub chunk_index: i32,
    pub chunk_text: String,
    pub embedding: Vec<f32>,
    pub content_hash: String,
    pub provider: String,
    pub model: String,
    pub dimension: i32,
    pub created_at: i64,
}
