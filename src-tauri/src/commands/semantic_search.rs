//! Semantic search commands using vector embeddings
//!
//! Provides functionality for:
//! - Generating embeddings for transcript chunks
//! - Storing/retrieving embeddings from database
//! - Vector similarity search
//! - Managing embedding providers (OpenAI, Cohere, OpenRouter, Ollama)

use crate::commands::Result;
use crate::error::IncrementumError;
use crate::ai::embeddings::{
    EmbeddingProviderType, OpenAIEmbeddingProvider, CohereEmbeddingProvider,
    OpenRouterEmbeddingProvider, OllamaEmbeddingProvider, EmbeddingModel,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use byteorder::{LittleEndian, ReadBytesExt, WriteBytesExt};
use std::io::{Cursor, Read};
use std::cmp::Ordering;

/// Semantic search result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SemanticSearchResult {
    pub chunk_id: String,
    pub document_id: String,
    pub text: String,
    pub start_time: Option<f64>,
    pub end_time: Option<f64>,
    pub speaker: Option<String>,
    pub score: f64,
    pub highlights: Vec<String>,
}

/// Transcript chunk for embedding
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptChunk {
    pub id: String,
    pub document_id: String,
    pub chunk_index: i32,
    pub text: String,
    pub start_time: Option<f64>,
    pub end_time: Option<f64>,
    pub speaker: Option<String>,
}

/// Embedding configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddingConfig {
    pub provider: EmbeddingProviderType,
    pub openai_api_key: Option<String>,
    pub openai_model: Option<String>,
    pub cohere_api_key: Option<String>,
    pub cohere_model: Option<String>,
    pub openrouter_api_key: Option<String>,
    pub openrouter_model: Option<String>,
    pub ollama_base_url: Option<String>,
    pub ollama_model: Option<String>,
}

impl Default for EmbeddingConfig {
    fn default() -> Self {
        Self {
            provider: EmbeddingProviderType::OpenAI,
            openai_api_key: None,
            openai_model: Some("text-embedding-3-small".to_string()),
            cohere_api_key: None,
            cohere_model: Some("embed-english-v3.0".to_string()),
            openrouter_api_key: None,
            openrouter_model: Some("openai/text-embedding-3-small".to_string()),
            ollama_base_url: Some("http://localhost:11434".to_string()),
            ollama_model: Some("nomic-embed-text".to_string()),
        }
    }
}

/// In-memory embedding store for fast search
#[derive(Clone)]
struct EmbeddingStore {
    chunks: HashMap<String, TranscriptChunk>,
    embeddings: HashMap<String, Vec<f32>>,
}

impl EmbeddingStore {
    fn new() -> Self {
        Self {
            chunks: HashMap::new(),
            embeddings: HashMap::new(),
        }
    }

    fn insert(&mut self, chunk: TranscriptChunk, embedding: Vec<f32>) {
        let id = chunk.id.clone();
        self.chunks.insert(id.clone(), chunk);
        self.embeddings.insert(id, embedding);
    }

    fn get_chunk(&self, id: &str) -> Option<&TranscriptChunk> {
        self.chunks.get(id)
    }

    fn get_embedding(&self, id: &str) -> Option<&Vec<f32>> {
        self.embeddings.get(id)
    }

    fn cosine_similarity(a: &[f32], b: &[f32]) -> f64 {
        if a.len() != b.len() {
            return 0.0;
        }

        let dot_product: f64 = a.iter()
            .zip(b.iter())
            .map(|(x, y)| (*x as f64) * (*y as f64))
            .sum();

        let norm_a: f64 = a.iter()
            .map(|x| (*x as f64) * (*x as f64))
            .sum::<f64>()
            .sqrt();

        let norm_b: f64 = b.iter()
            .map(|x| (*x as f64) * (*x as f64))
            .sum::<f64>()
            .sqrt();

        if norm_a == 0.0 || norm_b == 0.0 {
            return 0.0;
        }

        dot_product / (norm_a * norm_b)
    }

    fn search(&self, query_embedding: &[f32], limit: usize) -> Vec<(String, f64)> {
        let mut results: Vec<(String, f64)> = self.embeddings
            .iter()
            .map(|(id, emb)| {
                let similarity = Self::cosine_similarity(query_embedding, emb);
                (id.clone(), similarity)
            })
            .filter(|(_, score)| *score > 0.0)
            .collect();

        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(Ordering::Equal));

        results.into_iter().take(limit).collect()
    }
}

/// Global embedding store (in-memory for now, could be persisted)
lazy_static::lazy_static! {
    static ref EMBEDDING_STORE: Arc<RwLock<EmbeddingStore>> = Arc::new(RwLock::new(EmbeddingStore::new()));
}

/// Convert f32 vector to bytes for storage
fn embedding_to_bytes(embedding: &[f32]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(embedding.len() * 4);
    for &val in embedding {
        bytes.write_f32::<LittleEndian>(val).expect("write to Vec<u8> buffer");
    }
    bytes
}

/// Convert bytes to f32 vector
fn bytes_to_embedding(bytes: &[u8], dimension: usize) -> Vec<f32> {
    let mut cursor = Cursor::new(bytes);
    let mut embedding = Vec::with_capacity(dimension);
    for _ in 0..dimension {
        embedding.push(cursor.read_f32::<LittleEndian>().expect("read from embedding bytes"));
    }
    embedding
}

/// Get embedding provider from config
fn get_provider(config: &EmbeddingConfig) -> Result<Box<dyn crate::ai::embeddings::EmbeddingProvider>> {
    match config.provider {
        EmbeddingProviderType::OpenAI => {
            let api_key = config.openai_api_key.as_ref()
                .ok_or_else(|| IncrementumError::InvalidInput("OpenAI API key not configured".to_string()))?;
            let model = config.openai_model.clone();
            Ok(Box::new(OpenAIEmbeddingProvider::new(api_key.clone(), model)))
        }
        EmbeddingProviderType::Cohere => {
            let api_key = config.cohere_api_key.as_ref()
                .ok_or_else(|| IncrementumError::InvalidInput("Cohere API key not configured".to_string()))?;
            let model = config.cohere_model.clone();
            Ok(Box::new(CohereEmbeddingProvider::new(api_key.clone(), model)))
        }
        EmbeddingProviderType::OpenRouter => {
            let api_key = config.openrouter_api_key.as_ref()
                .ok_or_else(|| IncrementumError::InvalidInput("OpenRouter API key not configured".to_string()))?;
            let model = config.openrouter_model.as_ref()
                .ok_or_else(|| IncrementumError::InvalidInput("OpenRouter model not specified".to_string()))?;
            Ok(Box::new(OpenRouterEmbeddingProvider::new(api_key.clone(), model.clone())))
        }
        EmbeddingProviderType::Ollama => {
            let base_url = config.ollama_base_url.as_ref()
                .ok_or_else(|| IncrementumError::InvalidInput("Ollama base URL not configured".to_string()))?;
            let model = config.ollama_model.as_ref()
                .ok_or_else(|| IncrementumError::InvalidInput("Ollama model not specified".to_string()))?;
            Ok(Box::new(OllamaEmbeddingProvider::new(base_url.clone(), model.clone())))
        }
    }
}

#[tauri::command]
pub async fn generate_embedding(
    text: String,
    config: EmbeddingConfig,
) -> Result<Vec<f32>> {
    let provider = get_provider(&config)?;
    let response = provider.generate_embedding(&text).await
        .map_err(IncrementumError::Internal)?;
    Ok(response.embedding)
}

#[tauri::command]
pub async fn generate_embeddings_batch(
    texts: Vec<String>,
    config: EmbeddingConfig,
) -> Result<Vec<Vec<f32>>> {
    let provider = get_provider(&config)?;
    let responses = provider.generate_embeddings_batch(&texts).await
        .map_err(IncrementumError::Internal)?;
    Ok(responses.into_iter().map(|r| r.embedding).collect())
}

#[tauri::command]
pub async fn index_transcript(
    document_id: String,
    chunks: Vec<TranscriptChunk>,
    config: EmbeddingConfig,
) -> Result<usize> {
    let provider = get_provider(&config)?;

    let texts: Vec<String> = chunks.iter().map(|c| c.text.clone()).collect();

    // Generate embeddings in batch
    let responses = provider.generate_embeddings_batch(&texts).await
        .map_err(IncrementumError::Internal)?;

    // Store embeddings in memory store
    let mut store = EMBEDDING_STORE.write().await;
    for (chunk, response) in chunks.iter().zip(responses.iter()) {
        store.insert(chunk.clone(), response.embedding.clone());
    }

    // TODO: Also persist to database

    Ok(chunks.len())
}

#[tauri::command]
pub async fn semantic_search(
    query: String,
    document_ids: Option<Vec<String>>,
    speaker: Option<String>,
    limit: Option<usize>,
    config: EmbeddingConfig,
) -> Result<Vec<SemanticSearchResult>> {
    let provider = get_provider(&config)?;
    let query_response = provider.generate_embedding(&query).await
        .map_err(IncrementumError::Internal)?;

    let store = EMBEDDING_STORE.read().await;
    let limit = limit.unwrap_or(20);

    // Perform vector search
    let raw_results = store.search(&query_response.embedding, limit);

    let mut results = Vec::new();
    for (chunk_id, score) in raw_results {
        // Filter by document_ids if specified
        if let Some(ref doc_ids) = document_ids {
            let chunk = store.get_chunk(&chunk_id);
            if let Some(chunk) = chunk {
                if !doc_ids.contains(&chunk.document_id) {
                    continue;
                }
            }
        }

        // Filter by speaker if specified
        if let Some(ref speaker_filter) = speaker {
            let chunk = store.get_chunk(&chunk_id);
            if let Some(chunk) = chunk {
                if chunk.speaker.as_ref() != Some(speaker_filter) {
                    continue;
                }
            }
        }

        if let Some(chunk) = store.get_chunk(&chunk_id) {
            results.push(SemanticSearchResult {
                chunk_id: chunk.id.clone(),
                document_id: chunk.document_id.clone(),
                text: chunk.text.clone(),
                start_time: chunk.start_time,
                end_time: chunk.end_time,
                speaker: chunk.speaker.clone(),
                score,
                highlights: vec![chunk.text.clone()], // TODO: proper highlighting
            });
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn get_embedding_models(
    provider: EmbeddingProviderType,
    api_key: Option<String>,
) -> Result<Vec<EmbeddingModel>> {
    match provider {
        EmbeddingProviderType::OpenAI => {
            Ok(OpenAIEmbeddingProvider::available_models())
        }
        EmbeddingProviderType::Cohere => {
            Ok(CohereEmbeddingProvider::available_models())
        }
        EmbeddingProviderType::OpenRouter => {
            if let Some(key) = api_key {
                OpenRouterEmbeddingProvider::fetch_available_models(&key).await
                    .map_err(IncrementumError::Internal)
            } else {
                Ok(OpenRouterEmbeddingProvider::common_models())
            }
        }
        EmbeddingProviderType::Ollama => {
            Ok(OllamaEmbeddingProvider::common_models())
        }
    }
}

#[tauri::command]
pub async fn clear_all_embeddings() -> Result<()> {
    let mut store = EMBEDDING_STORE.write().await;
    *store = EmbeddingStore::new();
    // TODO: Also clear from database
    Ok(())
}

#[tauri::command]
pub async fn get_embedding_stats() -> Result<EmbeddingStats> {
    let store = EMBEDDING_STORE.read().await;
    Ok(EmbeddingStats {
        total_chunks: store.chunks.len() as u32,
        total_embeddings: store.embeddings.len() as u32,
        // TODO: Add storage size calculation
        storage_bytes: 0,
    })
}

/// Embedding statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddingStats {
    pub total_chunks: u32,
    pub total_embeddings: u32,
    pub storage_bytes: u64,
}

#[tauri::command]
pub async fn is_indexed(document_id: String) -> Result<bool> {
    let store = EMBEDDING_STORE.read().await;
    let indexed = store.chunks.values().any(|c| c.document_id == document_id);
    Ok(indexed)
}
