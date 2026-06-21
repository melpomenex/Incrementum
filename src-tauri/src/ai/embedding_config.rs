//! Shared embedding-provider construction.
//!
//! Lifts the `get_provider` / `provider_name` / `model_name` helpers out of
//! `commands/semantic_graph.rs` so both the semantic graph and whole-library
//! RAG can build an `EmbeddingProvider` from an `EmbeddingConfigInput` without
//! duplicating the provider-construction logic.

use crate::ai::embeddings::{
    CohereEmbeddingProvider, EmbeddingProvider, EmbeddingProviderType, OllamaEmbeddingProvider,
    OpenAIEmbeddingProvider, OpenRouterEmbeddingProvider,
};
use crate::commands::semantic_graph::EmbeddingConfigInput;
use crate::error::{IncrementumError, Result};

/// Build a concrete `EmbeddingProvider` from an `EmbeddingConfigInput`.
pub fn build_provider(config: &EmbeddingConfigInput) -> Result<Box<dyn EmbeddingProvider>> {
    match config.provider {
        EmbeddingProviderType::OpenAI => {
            let api_key = config.openai_api_key.as_ref().ok_or_else(|| {
                IncrementumError::InvalidInput("OpenAI API key not configured".to_string())
            })?;
            Ok(Box::new(OpenAIEmbeddingProvider::new(
                api_key.clone(),
                config.openai_model.clone(),
            )))
        }
        EmbeddingProviderType::Cohere => {
            let api_key = config.cohere_api_key.as_ref().ok_or_else(|| {
                IncrementumError::InvalidInput("Cohere API key not configured".to_string())
            })?;
            Ok(Box::new(CohereEmbeddingProvider::new(
                api_key.clone(),
                config.cohere_model.clone(),
            )))
        }
        EmbeddingProviderType::OpenRouter => {
            let api_key = config.openrouter_api_key.as_ref().ok_or_else(|| {
                IncrementumError::InvalidInput("OpenRouter API key not configured".to_string())
            })?;
            let model = config.openrouter_model.as_ref().ok_or_else(|| {
                IncrementumError::InvalidInput("OpenRouter model not specified".to_string())
            })?;
            Ok(Box::new(OpenRouterEmbeddingProvider::new(
                api_key.clone(),
                model.clone(),
            )))
        }
        EmbeddingProviderType::Ollama => {
            let base_url = config.ollama_base_url.as_ref().ok_or_else(|| {
                IncrementumError::InvalidInput("Ollama base URL not configured".to_string())
            })?;
            let model = config.ollama_model.as_ref().ok_or_else(|| {
                IncrementumError::InvalidInput("Ollama model not specified".to_string())
            })?;
            Ok(Box::new(OllamaEmbeddingProvider::new(
                base_url.clone(),
                model.clone(),
            )))
        }
    }
}

/// Provider name for persistence, matching the existing `{:?}` Debug format
/// used by `queue_item_embeddings` (e.g. `"OpenAI"`, `"Ollama"`).
pub fn provider_name(config: &EmbeddingConfigInput) -> String {
    format!("{:?}", config.provider)
}

/// Resolved model id for the configured provider, with sensible defaults.
pub fn model_name(config: &EmbeddingConfigInput) -> String {
    match config.provider {
        EmbeddingProviderType::OpenAI => config
            .openai_model
            .clone()
            .unwrap_or_else(|| "text-embedding-3-small".to_string()),
        EmbeddingProviderType::Cohere => config
            .cohere_model
            .clone()
            .unwrap_or_else(|| "embed-english-v3.0".to_string()),
        EmbeddingProviderType::OpenRouter => config
            .openrouter_model
            .clone()
            .unwrap_or_else(|| "openai/text-embedding-3-small".to_string()),
        EmbeddingProviderType::Ollama => config
            .ollama_model
            .clone()
            .unwrap_or_else(|| "nomic-embed-text".to_string()),
    }
}

/// Cosine similarity between two equal-length vectors. Returns 0.0 for
/// zero-norm vectors to avoid divide-by-zero.
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    let n = a.len().min(b.len());
    let mut dot = 0.0f32;
    let mut norm_a = 0.0f32;
    let mut norm_b = 0.0f32;
    for i in 0..n {
        dot += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }
    let denom = norm_a.sqrt() * norm_b.sqrt();
    if denom == 0.0 {
        0.0
    } else {
        dot / denom
    }
}
