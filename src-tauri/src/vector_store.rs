//! Persistent Vector Store for Embeddings
//!
//! This module provides persistent storage for embeddings using SQLite with:
//! - Disk-based storage (no memory limits)
//! - LRU cache for hot embeddings (memory efficiency)
//! - Efficient similarity search using cosine similarity
//! - Support for 100k+ document collections
//!
//! Architecture:
//! - Cold embeddings: Stored in SQLite (embedding BLOB column)
//! - Hot embeddings: Cached in LRU cache (configurable, default 1000 items)
//! - Search: Fetch candidates from DB, compute similarity in Rust, rank and return top-k

use byteorder::{ByteOrder, LittleEndian};
use lru::LruCache;
use sqlx::Row;
use std::collections::HashMap;
use std::num::NonZeroUsize;
use std::sync::Arc;
use std::sync::RwLock;
use tracing::{debug, info, trace, warn};

use crate::database::Repository;
use crate::error::{IncrementumError, Result};

/// Default cache size for hot embeddings (1000 embeddings)
/// Each embedding is ~6KB (1536 dims × 4 bytes), so cache uses ~6MB RAM
const DEFAULT_CACHE_SIZE: usize = 1000;

/// Global LRU cache for hot embeddings
static EMBEDDING_CACHE: RwLock<Option<LruCache<String, Vec<f32>>>> = RwLock::new(None);

/// Embedding record stored in the database
#[derive(Debug, Clone)]
pub struct EmbeddingRecord {
    pub id: String,
    pub document_id: String,
    pub chunk_index: i32,
    pub chunk_text: Option<String>,
    pub embedding: Vec<f32>,
    pub dimension: i32,
    pub model: String,
    pub provider: String,
    pub created_at: String,
    pub updated_at: String,
    pub access_count: i32,
    pub last_accessed_at: Option<String>,
}

/// Similarity search result
#[derive(Debug, Clone)]
pub struct SimilarityResult {
    pub document_id: String,
    pub embedding_id: String,
    pub chunk_index: i32,
    pub chunk_text: Option<String>,
    pub similarity: f32,
    pub model: String,
}

/// Embedding storage statistics
#[derive(Debug, Clone, serde::Serialize)]
pub struct EmbeddingStats {
    pub total_count: i64,
    pub total_bytes: i64,
    pub cache_size: usize,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub model_counts: HashMap<String, i64>,
}

/// Persistent Vector Store for managing embeddings
pub struct VectorStore {
    repository: Arc<Repository>,
    cache_enabled: bool,
}

impl VectorStore {
    /// Create a new VectorStore with the given repository
    pub fn new(repository: Arc<Repository>) -> Self {
        Self::init_cache();
        Self {
            repository,
            cache_enabled: true,
        }
    }

    /// Create a new VectorStore with cache disabled (always fetch from DB)
    pub fn new_without_cache(repository: Arc<Repository>) -> Self {
        Self {
            repository,
            cache_enabled: false,
        }
    }

    /// Initialize the global LRU cache (called once)
    fn init_cache() {
        let mut cache = EMBEDDING_CACHE.write().unwrap();
        if cache.is_none() {
            *cache = Some(LruCache::new(NonZeroUsize::new(DEFAULT_CACHE_SIZE).unwrap()));
            info!("Initialized embedding LRU cache with capacity {}", DEFAULT_CACHE_SIZE);
        }
    }

    /// Get cache statistics
    pub fn cache_stats() -> (usize, Option<usize>) {
        let cache = EMBEDDING_CACHE.read().unwrap();
        match cache.as_ref() {
            Some(c) => (c.len(), Some(c.cap().get())),
            None => (0, None),
        }
    }

    /// Clear the embedding cache
    pub fn clear_cache() {
        let mut cache = EMBEDDING_CACHE.write().unwrap();
        if let Some(ref mut c) = *cache {
            c.clear();
            info!("Cleared embedding cache");
        }
    }

    /// Store an embedding in the database (and optionally cache it)
    #[allow(clippy::too_many_arguments)]
    pub async fn store_embedding(
        &self,
        id: &str,
        document_id: &str,
        embedding: &[f32],
        model: &str,
        provider: &str,
        chunk_index: Option<i32>,
        chunk_text: Option<&str>,
    ) -> Result<()> {
        let dimension = embedding.len() as i32;
        let bytes = embedding_to_bytes(embedding);
        let now = chrono::Utc::now().to_rfc3339();
        let chunk_idx = chunk_index.unwrap_or(0);

        sqlx::query(
            r#"
            INSERT INTO embeddings (
                id, document_id, chunk_index, chunk_text, embedding,
                dimension, model, provider, created_at, updated_at,
                access_count, last_accessed_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0, NULL)
            ON CONFLICT(id) DO UPDATE SET
                embedding = excluded.embedding,
                dimension = excluded.dimension,
                model = excluded.model,
                provider = excluded.provider,
                updated_at = excluded.updated_at,
                chunk_text = COALESCE(excluded.chunk_text, chunk_text)
            "#,
        )
        .bind(id)
        .bind(document_id)
        .bind(chunk_idx)
        .bind(chunk_text)
        .bind(&bytes)
        .bind(dimension)
        .bind(model)
        .bind(provider)
        .bind(&now)
        .bind(&now)
        .execute(self.repository.pool())
        .await
        .map_err(IncrementumError::from)?;

        // Update stats
        self.update_stats_after_insert(model, bytes.len() as i64).await?;

        // Cache the embedding if caching is enabled
        if self.cache_enabled {
            let mut cache = EMBEDDING_CACHE.write().unwrap();
            if let Some(ref mut c) = *cache {
                c.put(id.to_string(), embedding.to_vec());
                trace!("Cached embedding {} for document {}", id, document_id);
            }
        }

        debug!(
            "Stored embedding {} for document {} ({} bytes, {} dims)",
            id,
            document_id,
            bytes.len(),
            dimension
        );

        Ok(())
    }

    /// Get an embedding by ID (from cache or DB)
    #[allow(clippy::await_holding_lock)]
    pub async fn get_embedding(&self, id: &str) -> Result<Option<EmbeddingRecord>> {
        // Try cache first
        if self.cache_enabled {
            let cache = EMBEDDING_CACHE.read().unwrap();
            let embedding_vec = cache.as_ref().and_then(|c| c.peek(id).cloned());
            drop(cache);
            if let Some(embedding) = embedding_vec {
                trace!("Cache hit for embedding {}", id);
                // We still need the metadata, so fetch from DB
                return self.get_embedding_metadata_with_data(id, embedding).await;
            }
        }

        // Fetch from database
        trace!("Cache miss for embedding {}, fetching from DB", id);
        let record = self.get_embedding_from_db(id).await?;

        // Add to cache if found
        if let Some(ref rec) = record {
            if self.cache_enabled {
                let mut cache = EMBEDDING_CACHE.write().unwrap();
                if let Some(ref mut c) = *cache {
                    c.put(id.to_string(), rec.embedding.clone());
                }
            }
        }

        Ok(record)
    }

    /// Get embeddings for a specific document
    pub async fn get_embeddings_by_document(&self, document_id: &str) -> Result<Vec<EmbeddingRecord>> {
        let rows = sqlx::query(
            r#"
            SELECT id, document_id, chunk_index, chunk_text, embedding,
                   dimension, model, provider, created_at, updated_at,
                   access_count, last_accessed_at
            FROM embeddings
            WHERE document_id = ?1
            ORDER BY chunk_index
            "#,
        )
        .bind(document_id)
        .fetch_all(self.repository.pool())
        .await
        .map_err(IncrementumError::from)?;

        let mut records = Vec::new();
        for row in rows {
            let embedding_bytes: Vec<u8> = row.try_get("embedding")?;
            let embedding = bytes_to_embedding(&embedding_bytes);

            let id: String = row.try_get("id")?;

            // Update cache
            if self.cache_enabled {
                let mut cache = EMBEDDING_CACHE.write().unwrap();
                if let Some(ref mut c) = *cache {
                    c.put(id.clone(), embedding.clone());
                }
            }

            records.push(EmbeddingRecord {
                id,
                document_id: row.try_get("document_id")?,
                chunk_index: row.try_get("chunk_index")?,
                chunk_text: row.try_get("chunk_text").ok(),
                embedding,
                dimension: row.try_get("dimension")?,
                model: row.try_get("model")?,
                provider: row.try_get("provider")?,
                created_at: row.try_get("created_at")?,
                updated_at: row.try_get("updated_at")?,
                access_count: row.try_get("access_count")?,
                last_accessed_at: row.try_get("last_accessed_at").ok(),
            });
        }

        // Update access counts
        self.update_access_counts(&records).await?;

        Ok(records)
    }

    /// Find similar embeddings using cosine similarity
    /// This fetches candidates from DB and computes similarity in Rust
    pub async fn find_similar(
        &self,
        query_embedding: &[f32],
        limit: usize,
        model_filter: Option<&str>,
        min_similarity: Option<f32>,
    ) -> Result<Vec<SimilarityResult>> {
        let start_time = std::time::Instant::now();

        // Build query with optional model filter
        let (rows, total_candidates) = if let Some(model) = model_filter {
            let rows = sqlx::query(
                r#"
                SELECT id, document_id, chunk_index, chunk_text, embedding, model
                FROM embeddings
                WHERE model = ?1
                "#,
            )
            .bind(model)
            .fetch_all(self.repository.pool())
            .await
            .map_err(IncrementumError::from)?;
            let len = rows.len();
            (rows, len)
        } else {
            let rows = sqlx::query(
                r#"
                SELECT id, document_id, chunk_index, chunk_text, embedding, model
                FROM embeddings
                "#,
            )
            .fetch_all(self.repository.pool())
            .await
            .map_err(IncrementumError::from)?;
            let len = rows.len();
            (rows, len)
        };

        // Compute similarities
        let min_sim = min_similarity.unwrap_or(0.0);
        let mut results: Vec<SimilarityResult> = rows
            .iter()
            .filter_map(|row| {
                let embedding_bytes: Vec<u8> = row.try_get("embedding").ok()?;
                let candidate_embedding = bytes_to_embedding(&embedding_bytes);

                if candidate_embedding.len() != query_embedding.len() {
                    // Dimension mismatch - skip
                    return None;
                }

                let similarity = cosine_similarity(query_embedding, &candidate_embedding);

                if similarity >= min_sim {
                    Some(SimilarityResult {
                        document_id: row.try_get("document_id").ok()?,
                        embedding_id: row.try_get("id").ok()?,
                        chunk_index: row.try_get("chunk_index").unwrap_or(0),
                        chunk_text: row.try_get("chunk_text").ok(),
                        similarity,
                        model: row.try_get("model").ok()?,
                    })
                } else {
                    None
                }
            })
            .collect();

        // Sort by similarity (descending) and take top-k
        results.sort_by(|a, b| b.similarity.partial_cmp(&a.similarity).unwrap());
        results.truncate(limit);

        let elapsed = start_time.elapsed();
        info!(
            "Similarity search completed: {} candidates scanned, {} results in {:?}",
            total_candidates,
            results.len(),
            elapsed
        );

        Ok(results)
    }

    /// Delete embeddings for a document
    pub async fn delete_document_embeddings(&self, document_id: &str) -> Result<u64> {
        // Get the embeddings first to calculate size for stats
        let rows = sqlx::query(
            r#"SELECT id, model, LENGTH(embedding) as bytes FROM embeddings WHERE document_id = ?1"#,
        )
        .bind(document_id)
        .fetch_all(self.repository.pool())
        .await
        .map_err(IncrementumError::from)?;

        let mut total_bytes = 0i64;
        let mut model_counts: HashMap<String, i64> = HashMap::new();

        for row in &rows {
            let id: String = row.try_get("id")?;
            let model: String = row.try_get("model")?;
            let bytes: i64 = row.try_get("bytes")?;

            total_bytes += bytes;
            *model_counts.entry(model).or_insert(0) += 1;

            // Remove from cache
            if self.cache_enabled {
                let mut cache = EMBEDDING_CACHE.write().unwrap();
                if let Some(ref mut c) = *cache {
                    c.pop(&id);
                }
            }
        }

        // Delete from database
        let result = sqlx::query("DELETE FROM embeddings WHERE document_id = ?1")
            .bind(document_id)
            .execute(self.repository.pool())
            .await
            .map_err(IncrementumError::from)?;

        // Update stats
        for (model, count) in model_counts {
            self.update_stats_after_delete(&model, count, total_bytes / rows.len() as i64 * count)
                .await?;
        }

        info!(
            "Deleted {} embeddings for document {}",
            result.rows_affected(),
            document_id
        );

        Ok(result.rows_affected())
    }

    /// Delete a single embedding
    pub async fn delete_embedding(&self, id: &str) -> Result<bool> {
        // Get info for stats update
        let row = sqlx::query(
            r#"SELECT model, LENGTH(embedding) as bytes FROM embeddings WHERE id = ?1"#,
        )
        .bind(id)
        .fetch_optional(self.repository.pool())
        .await
        .map_err(IncrementumError::from)?;

        if let Some(row) = row {
            let model: String = row.try_get("model")?;
            let bytes: i64 = row.try_get("bytes")?;

            // Remove from cache
            if self.cache_enabled {
                let mut cache = EMBEDDING_CACHE.write().unwrap();
                if let Some(ref mut c) = *cache {
                    c.pop(id);
                }
            }

            // Delete from database
            let result = sqlx::query("DELETE FROM embeddings WHERE id = ?1")
                .bind(id)
                .execute(self.repository.pool())
                .await
                .map_err(IncrementumError::from)?;

            // Update stats
            self.update_stats_after_delete(&model, 1, bytes).await?;

            return Ok(result.rows_affected() > 0);
        }

        Ok(false)
    }

    /// Get storage statistics
    pub async fn get_stats(&self) -> Result<EmbeddingStats> {
        let stats_row = sqlx::query(
            r#"SELECT total_count, total_bytes, model_counts FROM embedding_stats WHERE id = 'global'"#,
        )
        .fetch_optional(self.repository.pool())
        .await
        .map_err(IncrementumError::from)?;

        let model_counts = if let Some(ref row) = stats_row {
            let model_counts_json: String = row.try_get("model_counts").unwrap_or_else(|_| "{}".to_string());
            serde_json::from_str(&model_counts_json).unwrap_or_default()
        } else {
            HashMap::new()
        };

        let (cache_len, cache_capacity) = Self::cache_stats();

        // Calculate cache hits/misses (simplified - would need proper instrumentation)
        let (cache_hits, cache_misses) = (0, 0);

        Ok(EmbeddingStats {
            total_count: stats_row.as_ref().and_then(|r| r.try_get("total_count").ok()).unwrap_or(0),
            total_bytes: stats_row.as_ref().and_then(|r| r.try_get("total_bytes").ok()).unwrap_or(0),
            cache_size: cache_len,
            cache_hits,
            cache_misses,
            model_counts,
        })
    }

    /// Count embeddings for a document
    pub async fn count_document_embeddings(&self, document_id: &str) -> Result<i64> {
        let count: i64 = sqlx::query_scalar(
            r#"SELECT COUNT(*) FROM embeddings WHERE document_id = ?1"#,
        )
        .bind(document_id)
        .fetch_one(self.repository.pool())
        .await
        .map_err(IncrementumError::from)?;

        Ok(count)
    }

    /// List all unique models in use
    pub async fn list_models(&self) -> Result<Vec<(String, i64)>> {
        let rows = sqlx::query(
            r#"
            SELECT model, COUNT(*) as count
            FROM embeddings
            GROUP BY model
            ORDER BY count DESC
            "#,
        )
        .fetch_all(self.repository.pool())
        .await
        .map_err(IncrementumError::from)?;

        let mut models = Vec::new();
        for row in rows {
            models.push((
                row.try_get("model")?,
                row.try_get::<i64, _>("count")?,
            ));
        }

        Ok(models)
    }

    // Private helper methods

    async fn get_embedding_from_db(&self, id: &str) -> Result<Option<EmbeddingRecord>> {
        let row = sqlx::query(
            r#"
            SELECT id, document_id, chunk_index, chunk_text, embedding,
                   dimension, model, provider, created_at, updated_at,
                   access_count, last_accessed_at
            FROM embeddings
            WHERE id = ?1
            "#,
        )
        .bind(id)
        .fetch_optional(self.repository.pool())
        .await
        .map_err(IncrementumError::from)?;

        match row {
            Some(row) => {
                let embedding_bytes: Vec<u8> = row.try_get("embedding")?;
                let embedding = bytes_to_embedding(&embedding_bytes);

                Ok(Some(EmbeddingRecord {
                    id: row.try_get("id")?,
                    document_id: row.try_get("document_id")?,
                    chunk_index: row.try_get("chunk_index")?,
                    chunk_text: row.try_get("chunk_text").ok(),
                    embedding,
                    dimension: row.try_get("dimension")?,
                    model: row.try_get("model")?,
                    provider: row.try_get("provider")?,
                    created_at: row.try_get("created_at")?,
                    updated_at: row.try_get("updated_at")?,
                    access_count: row.try_get("access_count")?,
                    last_accessed_at: row.try_get("last_accessed_at").ok(),
                }))
            }
            None => Ok(None),
        }
    }

    async fn get_embedding_metadata_with_data(
        &self,
        id: &str,
        embedding: Vec<f32>,
    ) -> Result<Option<EmbeddingRecord>> {
        let row = sqlx::query(
            r#"
            SELECT id, document_id, chunk_index, chunk_text,
                   dimension, model, provider, created_at, updated_at,
                   access_count, last_accessed_at
            FROM embeddings
            WHERE id = ?1
            "#,
        )
        .bind(id)
        .fetch_optional(self.repository.pool())
        .await
        .map_err(IncrementumError::from)?;

        match row {
            Some(row) => Ok(Some(EmbeddingRecord {
                id: row.try_get("id")?,
                document_id: row.try_get("document_id")?,
                chunk_index: row.try_get("chunk_index")?,
                chunk_text: row.try_get("chunk_text").ok(),
                embedding,
                dimension: row.try_get("dimension")?,
                model: row.try_get("model")?,
                provider: row.try_get("provider")?,
                created_at: row.try_get("created_at")?,
                updated_at: row.try_get("updated_at")?,
                access_count: row.try_get("access_count")?,
                last_accessed_at: row.try_get("last_accessed_at").ok(),
            })),
            None => Ok(None),
        }
    }

    async fn update_access_counts(&self, records: &[EmbeddingRecord]) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();

        for record in records {
            sqlx::query(
                r#"
                UPDATE embeddings SET
                    access_count = access_count + 1,
                    last_accessed_at = ?1
                WHERE id = ?2
                "#,
            )
            .bind(&now)
            .bind(&record.id)
            .execute(self.repository.pool())
            .await
            .map_err(|e| warn!("Failed to update access count for {}: {}", record.id, e))
            .ok();
        }

        Ok(())
    }

    async fn update_stats_after_insert(&self, model: &str, bytes: i64) -> Result<()> {
        let row = sqlx::query(
            r#"SELECT model_counts FROM embedding_stats WHERE id = 'global'"#,
        )
        .fetch_optional(self.repository.pool())
        .await?;

        let mut model_counts: HashMap<String, i64> = row
            .and_then(|r| r.try_get::<String, _>("model_counts").ok())
            .and_then(|json| serde_json::from_str(&json).ok())
            .unwrap_or_default();

        *model_counts.entry(model.to_string()).or_insert(0) += 1;
        let model_counts_json = serde_json::to_string(&model_counts)?;

        sqlx::query(
            r#"
            UPDATE embedding_stats SET
                total_count = total_count + 1,
                total_bytes = total_bytes + ?1,
                model_counts = ?2,
                last_calculated_at = ?3
            WHERE id = 'global'
            "#,
        )
        .bind(bytes)
        .bind(&model_counts_json)
        .bind(chrono::Utc::now().to_rfc3339())
        .execute(self.repository.pool())
        .await
        .map_err(|e| warn!("Failed to update stats: {}", e))
        .ok();

        Ok(())
    }

    async fn update_stats_after_delete(&self, model: &str, count: i64, bytes: i64) -> Result<()> {
        let row = sqlx::query(
            r#"SELECT model_counts FROM embedding_stats WHERE id = 'global'"#,
        )
        .fetch_optional(self.repository.pool())
        .await?;

        let mut model_counts: HashMap<String, i64> = row
            .and_then(|r| r.try_get::<String, _>("model_counts").ok())
            .and_then(|json| serde_json::from_str(&json).ok())
            .unwrap_or_default();

        if let Some(entry) = model_counts.get_mut(model) {
            *entry -= count;
            if *entry <= 0 {
                model_counts.remove(model);
            }
        }

        let model_counts_json = serde_json::to_string(&model_counts)?;

        sqlx::query(
            r#"
            UPDATE embedding_stats SET
                total_count = MAX(0, total_count - ?1),
                total_bytes = MAX(0, total_bytes - ?2),
                model_counts = ?3,
                last_calculated_at = ?4
            WHERE id = 'global'
            "#,
        )
        .bind(count)
        .bind(bytes)
        .bind(&model_counts_json)
        .bind(chrono::Utc::now().to_rfc3339())
        .execute(self.repository.pool())
        .await
        .map_err(|e| warn!("Failed to update stats: {}", e))
        .ok();

        Ok(())
    }
}

/// Convert a float32 embedding vector to bytes (little-endian)
fn embedding_to_bytes(embedding: &[f32]) -> Vec<u8> {
    let mut bytes = vec![0u8; embedding.len() * 4];
    LittleEndian::write_f32_into(embedding, &mut bytes);
    bytes
}

/// Convert bytes back to a float32 embedding vector
fn bytes_to_embedding(bytes: &[u8]) -> Vec<f32> {
    let num_floats = bytes.len() / 4;
    let mut embedding = vec![0.0f32; num_floats];
    LittleEndian::read_f32_into(bytes, &mut embedding);
    embedding
}

/// Calculate cosine similarity between two vectors
/// Returns a value between -1 and 1, where 1 means identical direction
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() {
        warn!("Dimension mismatch: {} vs {}", a.len(), b.len());
        return 0.0;
    }

    if a.is_empty() {
        return 0.0;
    }

    let mut dot_product = 0.0f32;
    let mut norm_a = 0.0f32;
    let mut norm_b = 0.0f32;

    for i in 0..a.len() {
        dot_product += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }

    norm_a = norm_a.sqrt();
    norm_b = norm_b.sqrt();

    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }

    dot_product / (norm_a * norm_b)
}

/// Calculate Euclidean distance between two vectors
pub fn euclidean_distance(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() {
        return f32::INFINITY;
    }

    a.iter()
        .zip(b.iter())
        .map(|(x, y)| (x - y).powi(2))
        .sum::<f32>()
        .sqrt()
}

/// Normalize a vector to unit length (L2 normalization)
pub fn normalize_vector(v: &mut [f32]) {
    let norm = v.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        for x in v.iter_mut() {
            *x /= norm;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_embedding_bytes_roundtrip() {
        let original = vec![1.0f32, 2.0, 3.0, 4.0, 5.0];
        let bytes = embedding_to_bytes(&original);
        let recovered = bytes_to_embedding(&bytes);
        assert_eq!(original, recovered);
    }

    #[test]
    fn test_cosine_similarity_identical() {
        let a = vec![1.0f32, 0.0, 0.0];
        let b = vec![1.0f32, 0.0, 0.0];
        let similarity = cosine_similarity(&a, &b);
        assert!((similarity - 1.0).abs() < 0.0001);
    }

    #[test]
    fn test_cosine_similarity_orthogonal() {
        let a = vec![1.0f32, 0.0];
        let b = vec![0.0f32, 1.0];
        let similarity = cosine_similarity(&a, &b);
        assert!(similarity.abs() < 0.0001);
    }

    #[test]
    fn test_cosine_similarity_opposite() {
        let a = vec![1.0f32, 0.0];
        let b = vec![-1.0f32, 0.0];
        let similarity = cosine_similarity(&a, &b);
        assert!((similarity - (-1.0)).abs() < 0.0001);
    }

    #[test]
    fn test_normalize() {
        let mut v = vec![3.0f32, 4.0]; // Length should be 5
        normalize_vector(&mut v);
        let length = v.iter().map(|x| x * x).sum::<f32>().sqrt();
        assert!((length - 1.0).abs() < 0.0001);
    }
}
