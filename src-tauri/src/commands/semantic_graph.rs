//! Semantic graph commands using vector embeddings
//!
//! Provides:
//! - `embed_queue_items`: Generate and persist embeddings for queue items
//! - `compute_semantic_graph`: Build graph from stored embeddings via cosine similarity

use crate::commands::Result;
use crate::commands::ai_key_store::AIKeyStore;
use crate::database::Repository;
use crate::error::IncrementumError;
use tauri::Emitter;
use crate::ai::embeddings::{EmbeddingProviderType, EmbeddingProvider, OpenAIEmbeddingProvider, CohereEmbeddingProvider, OpenRouterEmbeddingProvider, OllamaEmbeddingProvider};
use crate::database::QueueItemEmbedding;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};

/// Summary of a queue item for embedding purposes
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueItemSummary {
    pub id: String,
    pub title: String,
    pub text_content: String,
    pub tags: Vec<String>,
}

/// Embedding configuration passed from frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddingConfigInput {
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

/// Progress event for embedding generation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddingProgress {
    pub batch_number: u32,
    pub total_batches: u32,
    pub items_embedded: u32,
}

/// Graph node output for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphNodeOutput {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub label: String,
    pub description: Option<String>,
    pub x: f64,
    pub y: f64,
    pub radius: Option<f64>,
    pub color: Option<String>,
    pub category: Option<String>,
    pub tags: Option<Vec<String>>,
    pub metadata: Option<serde_json::Value>,
}

/// Graph edge output for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphEdgeOutput {
    pub id: String,
    pub source: String,
    pub target: String,
    #[serde(rename = "type")]
    pub edge_type: String,
    pub weight: f64,
    pub label: String,
}

/// Result of semantic graph computation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SemanticGraphResult {
    pub nodes: Vec<GraphNodeOutput>,
    pub edges: Vec<GraphEdgeOutput>,
    pub used_embeddings: bool,
}

/// Compute a content hash for an item (title + text + tags)
fn content_hash(title: &str, text: &str, tags: &[String]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(title.as_bytes());
    hasher.update(b"\0");
    hasher.update(text.as_bytes());
    hasher.update(b"\0");
    hasher.update(tags.join(",").as_bytes());
    let result = hasher.finalize();
    hex::encode(result)
}

/// Build text suitable for embedding from a queue item summary
fn item_to_embedding_text(item: &QueueItemSummary) -> String {
    let mut parts = vec![item.title.clone()];
    if !item.text_content.is_empty() {
        parts.push(item.text_content.clone());
    }
    if !item.tags.is_empty() {
        parts.push(item.tags.join(" "));
    }
    parts.join(". ")
}

/// Get the embedding provider from config
fn get_provider(config: &EmbeddingConfigInput) -> Result<Box<dyn EmbeddingProvider>> {
    match config.provider {
        EmbeddingProviderType::OpenAI => {
            let api_key = config.openai_api_key.as_ref()
                .ok_or_else(|| IncrementumError::InvalidInput("OpenAI API key not configured".to_string()))?;
            Ok(Box::new(OpenAIEmbeddingProvider::new(api_key.clone(), config.openai_model.clone())))
        }
        EmbeddingProviderType::Cohere => {
            let api_key = config.cohere_api_key.as_ref()
                .ok_or_else(|| IncrementumError::InvalidInput("Cohere API key not configured".to_string()))?;
            Ok(Box::new(CohereEmbeddingProvider::new(api_key.clone(), config.cohere_model.clone())))
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

fn provider_name(config: &EmbeddingConfigInput) -> String {
    format!("{:?}", config.provider)
}

fn model_name(config: &EmbeddingConfigInput) -> String {
    match config.provider {
        EmbeddingProviderType::OpenAI => config.openai_model.clone().unwrap_or_else(|| "text-embedding-3-small".to_string()),
        EmbeddingProviderType::Cohere => config.cohere_model.clone().unwrap_or_else(|| "embed-english-v3.0".to_string()),
        EmbeddingProviderType::OpenRouter => config.openrouter_model.clone().unwrap_or_else(|| "openai/text-embedding-3-small".to_string()),
        EmbeddingProviderType::Ollama => config.ollama_model.clone().unwrap_or_else(|| "nomic-embed-text".to_string()),
    }
}

#[tauri::command]
pub async fn embed_queue_items(
    repo: tauri::State<'_, Repository>,
    app: tauri::AppHandle,
    items: Vec<QueueItemSummary>,
    config: EmbeddingConfigInput,
) -> Result<u32> {
    if items.is_empty() {
        return Ok(0);
    }

    let provider = get_provider(&config)?;
    let provider_str = provider_name(&config);
    let model_str = model_name(&config);
    let dimension = provider.dimension();

    // Compute content hashes and find stale items
    let items_with_hashes: Vec<(String, String)> = items.iter()
        .map(|item| {
            let hash = content_hash(&item.title, &item.text_content, &item.tags);
            (item.id.clone(), hash)
        })
        .collect();

    let stale_ids = repo.get_stale_embedding_item_ids(
        &items_with_hashes,
        &provider_str,
        &model_str,
    ).await?;

    let stale_set: std::collections::HashSet<&str> = stale_ids.iter().map(|s| s.as_str()).collect();
    let items_to_embed: Vec<&QueueItemSummary> = items.iter()
        .filter(|item| stale_set.contains(item.id.as_str()))
        .collect();

    if items_to_embed.is_empty() {
        return Ok(0);
    }

    let batch_size = 25;
    let total_batches = ((items_to_embed.len() + batch_size - 1) / batch_size) as u32;
    let mut total_embedded: u32 = 0;

    for (batch_idx, chunk) in items_to_embed.chunks(batch_size).enumerate() {
        let texts: Vec<String> = chunk.iter().map(|item| item_to_embedding_text(item)).collect();
        let responses = provider.generate_embeddings_batch(&texts).await
            .map_err(IncrementumError::Internal)?;

        let now = chrono::Utc::now().timestamp_millis();
        for (item, response) in chunk.iter().zip(responses.iter()) {
            let hash = content_hash(&item.title, &item.text_content, &item.tags);
            let emb = QueueItemEmbedding {
                item_id: item.id.clone(),
                embedding: response.embedding.clone(),
                content_hash: hash,
                provider: provider_str.clone(),
                model: model_str.clone(),
                dimension: dimension as i32,
                created_at: now,
            };
            repo.upsert_embedding(&emb).await?;
            total_embedded += 1;
        }

        let _ = app.emit("embedding-progress", EmbeddingProgress {
            batch_number: (batch_idx + 1) as u32,
            total_batches,
            items_embedded: total_embedded,
        });
    }

    Ok(total_embedded)
}

#[tauri::command]
pub async fn compute_semantic_graph(
    repo: tauri::State<'_, Repository>,
    items: Vec<QueueItemSummary>,
    threshold_percent: f64,
    config: Option<EmbeddingConfigInput>,
) -> Result<SemanticGraphResult> {
    if items.is_empty() {
        return Ok(SemanticGraphResult {
            nodes: Vec::new(),
            edges: Vec::new(),
            used_embeddings: false,
        });
    }

    let item_ids: Vec<String> = items.iter().map(|i| i.id.clone()).collect();

    // Try embedding-based graph if provider is configured
    if let Some(ref cfg) = config {
        // First ensure all items have embeddings
        let provider_str = provider_name(cfg);
        let model_str = model_name(cfg);

        let items_with_hashes: Vec<(String, String)> = items.iter()
            .map(|item| {
                let hash = content_hash(&item.title, &item.text_content, &item.tags);
                (item.id.clone(), hash)
            })
            .collect();

        let stale_ids = repo.get_stale_embedding_item_ids(
            &items_with_hashes,
            &provider_str,
            &model_str,
        ).await?;

        if stale_ids.is_empty() {
            // All embeddings are fresh — compute graph from them
            let embeddings = repo.get_embeddings_for_items(&item_ids).await?;
            let emb_map: std::collections::HashMap<String, Vec<f32>> = embeddings.into_iter()
                .map(|e| (e.item_id, e.embedding))
                .collect();

            return Ok(build_graph_from_embeddings(&items, &emb_map, threshold_percent));
        }
        // If some items are stale, return a signal so frontend can trigger embedding first
        // Fall through to lexical fallback
    }

    // No embeddings or stale — return empty result signalling lexical fallback needed
    Ok(SemanticGraphResult {
        nodes: Vec::new(),
        edges: Vec::new(),
        used_embeddings: false,
    })
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f64 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let dot: f64 = a.iter().zip(b.iter()).map(|(x, y)| (*x as f64) * (*y as f64)).sum();
    let norm_a: f64 = a.iter().map(|x| (*x as f64).powi(2)).sum::<f64>().sqrt();
    let norm_b: f64 = b.iter().map(|x| (*x as f64).powi(2)).sum::<f64>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 { 0.0 } else { dot / (norm_a * norm_b) }
}

fn build_graph_from_embeddings(
    items: &[QueueItemSummary],
    emb_map: &std::collections::HashMap<String, Vec<f32>>,
    threshold_percent: f64,
) -> SemanticGraphResult {
    let threshold = threshold_percent / 100.0;

    let nodes: Vec<GraphNodeOutput> = items.iter().enumerate().map(|(idx, item)| {
        let angle = (idx as f64 / items.len() as f64) * std::f64::consts::PI * 2.0;
        let distance = 150.0 + (idx as f64 * 7.0 % 200.0);
        let x = 400.0 + angle.cos() * distance;
        let y = 300.0 + angle.sin() * distance;

        GraphNodeOutput {
            id: item.id.clone(),
            node_type: "Document".to_string(),
            label: if item.title.len() > 35 { format!("{}...", &item.title[..32]) } else { item.title.clone() },
            description: Some(item.text_content.clone()),
            x,
            y,
            radius: Some(16.0),
            color: Some("#3b82f6".to_string()),
            category: None,
            tags: if item.tags.is_empty() { None } else { Some(item.tags.clone()) },
            metadata: None,
        }
    }).collect();

    let mut edges: Vec<GraphEdgeOutput> = Vec::new();
    let mut edge_id = 1u32;

    for i in 0..items.len() {
        let emb_a = match emb_map.get(&items[i].id) {
            Some(e) => e,
            None => continue,
        };
        for j in (i + 1)..items.len() {
            let emb_b = match emb_map.get(&items[j].id) {
                Some(e) => e,
                None => continue,
            };
            let sim = cosine_similarity(emb_a, emb_b);
            if sim >= threshold && sim > 0.05 {
                edges.push(GraphEdgeOutput {
                    id: format!("emb-edge-{}", edge_id),
                    source: items[i].id.clone(),
                    target: items[j].id.clone(),
                    edge_type: "related".to_string(),
                    weight: sim,
                    label: format!("{}%", (sim * 100.0).round() as u32),
                });
                edge_id += 1;
            }
        }
    }

    SemanticGraphResult {
        nodes,
        edges,
        used_embeddings: true,
    }
}

/// Resolves the user's stored AI config + API keys into an EmbeddingConfigInput
/// ready for use with embed_queue_items / compute_semantic_graph.
/// Returns None if no provider with a key is configured.
#[tauri::command]
pub async fn get_embedding_config(
    key_store: tauri::State<'_, AIKeyStore>,
) -> Result<Option<EmbeddingConfigInput>> {
    // Try providers in order of preference: OpenAI -> OpenRouter -> Cohere -> Ollama
    if let Ok(Some(key)) = key_store.get_key("openai").await {
        return Ok(Some(EmbeddingConfigInput {
            provider: EmbeddingProviderType::OpenAI,
            openai_api_key: Some(key),
            openai_model: Some("text-embedding-3-small".to_string()),
            cohere_api_key: None,
            cohere_model: None,
            openrouter_api_key: None,
            openrouter_model: None,
            ollama_base_url: None,
            ollama_model: None,
        }));
    }

    if let Ok(Some(key)) = key_store.get_key("openrouter").await {
        return Ok(Some(EmbeddingConfigInput {
            provider: EmbeddingProviderType::OpenRouter,
            openai_api_key: None,
            openai_model: None,
            cohere_api_key: None,
            cohere_model: None,
            openrouter_api_key: Some(key),
            openrouter_model: Some("openai/text-embedding-3-small".to_string()),
            ollama_base_url: None,
            ollama_model: None,
        }));
    }

    // Check if Ollama is running (no key needed, just local)
    // Always offer Ollama as fallback if the user has configured it
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_content_hash_deterministic() {
        let h1 = content_hash("title", "text", &["tag1".to_string()]);
        let h2 = content_hash("title", "text", &["tag1".to_string()]);
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_content_hash_changes_on_content_change() {
        let h1 = content_hash("title", "text", &["tag1".to_string()]);
        let h2 = content_hash("title", "different text", &["tag1".to_string()]);
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_cosine_similarity_identical() {
        let v = vec![1.0, 0.0, 0.0];
        assert!((cosine_similarity(&v, &v) - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_cosine_similarity_orthogonal() {
        let a = vec![1.0, 0.0];
        let b = vec![0.0, 1.0];
        assert!((cosine_similarity(&a, &b)).abs() < 0.001);
    }

    #[test]
    fn test_cosine_similarity_similar() {
        let a = vec![1.0, 1.0, 1.0];
        let b = vec![1.0, 1.0, 0.5];
        let sim = cosine_similarity(&a, &b);
        assert!(sim > 0.9 && sim < 1.0);
    }

    #[test]
    fn test_build_graph_from_embeddings_threshold() {
        let items = vec![
            QueueItemSummary { id: "a".into(), title: "Item A".into(), text_content: "about neural networks".into(), tags: vec![] },
            QueueItemSummary { id: "b".into(), title: "Item B".into(), text_content: "about deep learning".into(), tags: vec![] },
            QueueItemSummary { id: "c".into(), title: "Item C".into(), text_content: "about renaissance art".into(), tags: vec![] },
        ];
        let mut emb_map = std::collections::HashMap::new();
        // A and B are very similar, C is different
        emb_map.insert("a".into(), vec![1.0, 0.9, 0.1]);
        emb_map.insert("b".into(), vec![0.95, 0.85, 0.15]);
        emb_map.insert("c".into(), vec![0.1, 0.1, 0.95]);

        let result = build_graph_from_embeddings(&items, &emb_map, 50.0);
        assert!(result.used_embeddings);
        assert_eq!(result.nodes.len(), 3);
        // A-B should be connected (high similarity), A-C and B-C should not
        assert!(result.edges.iter().any(|e| e.source == "a" && e.target == "b"));
        assert!(!result.edges.iter().any(|e| (e.source == "a" && e.target == "c") || (e.source == "b" && e.target == "c")));
    }

    #[test]
    fn test_item_to_embedding_text() {
        let item = QueueItemSummary {
            id: "1".into(),
            title: "Neural Networks".into(),
            text_content: "Introduction to deep learning".into(),
            tags: vec!["ai".into(), "ml".into()],
        };
        let text = item_to_embedding_text(&item);
        assert!(text.contains("Neural Networks"));
        assert!(text.contains("Introduction to deep learning"));
        assert!(text.contains("ai"));
    }
}
