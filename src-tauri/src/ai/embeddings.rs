//! Embedding provider implementations for semantic search
//!
//! Supports multiple embedding providers:
//! - OpenAI (text-embedding-3-small, text-embedding-3-large)
//! - Cohere (embed-english-v3.0, embed-multilingual-v3.0)
//! - OpenRouter (multi-provider embeddings)
//! - Ollama (local embedding models)

use serde::{Deserialize, Serialize};
use serde_json::json;

/// Truncate a string for inclusion in error messages.
fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        let head: String = s.chars().take(max).collect();
        format!("{head}…")
    }
}

/// Embedding provider type
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum EmbeddingProviderType {
    OpenAI,
    Cohere,
    OpenRouter,
    Ollama,
}

/// Embedding response
#[derive(Debug, Clone)]
pub struct EmbeddingResponse {
    /// Vector embedding (list of float values)
    pub embedding: Vec<f32>,
    /// Number of dimensions in the embedding
    pub dimension: usize,
    /// Number of tokens in the input
    pub tokens: u32,
}

/// Embedding model configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingModel {
    /// Model identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// Provider
    pub provider: EmbeddingProviderType,
    /// Embedding dimensions
    pub dimension: usize,
    /// Optional pricing per million tokens
    pub price_per_million: Option<f64>,
}

/// OpenRouter embedding model info
#[derive(Debug, Clone, Deserialize)]
pub struct OpenRouterModel {
    pub id: String,
    pub name: String,
    pub context_length: Option<usize>,
    pub pricing: Option<OpenRouterPricing>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OpenRouterPricing {
    pub prompt: Option<String>,
    pub completion: Option<String>,
}

/// Trait for embedding providers
#[async_trait::async_trait]
pub trait EmbeddingProvider: Send + Sync + std::fmt::Debug {
    /// Get provider type
    fn provider_type(&self) -> EmbeddingProviderType;

    /// Generate embedding for a single text
    async fn generate_embedding(&self, text: &str) -> Result<EmbeddingResponse, String>;

    /// Generate embeddings for multiple texts (batch)
    async fn generate_embeddings_batch(&self, texts: &[String]) -> Result<Vec<EmbeddingResponse>, String>;

    /// Check if provider is available
    fn is_available(&self) -> bool;

    /// Get embedding dimension for the current model
    fn dimension(&self) -> usize;
}

/// OpenAI embedding provider
pub struct OpenAIEmbeddingProvider {
    api_key: String,
    model: String,
    dimension: usize,
    client: reqwest::Client,
}

impl OpenAIEmbeddingProvider {
    /// Create a new OpenAI embedding provider
    pub fn new(api_key: String, model: Option<String>) -> Self {
        let model = model.unwrap_or_else(|| "text-embedding-3-small".to_string());
        let dimension = match model.as_str() {
            "text-embedding-3-small" => 1536,
            "text-embedding-3-large" => 3072,
            "text-embedding-ada-002" => 1536,
            _ => 1536, // default
        };

        Self {
            api_key,
            model,
            dimension,
            client: reqwest::Client::new(),
        }
    }

    /// Get available OpenAI embedding models
    pub fn available_models() -> Vec<EmbeddingModel> {
        vec![
            EmbeddingModel {
                id: "text-embedding-3-small".to_string(),
                name: "text-embedding-3-small (1536d)".to_string(),
                provider: EmbeddingProviderType::OpenAI,
                dimension: 1536,
                price_per_million: Some(0.02),
            },
            EmbeddingModel {
                id: "text-embedding-3-large".to_string(),
                name: "text-embedding-3-large (3072d)".to_string(),
                provider: EmbeddingProviderType::OpenAI,
                dimension: 3072,
                price_per_million: Some(0.13),
            },
            EmbeddingModel {
                id: "text-embedding-ada-002".to_string(),
                name: "text-embedding-ada-002 (1536d)".to_string(),
                provider: EmbeddingProviderType::OpenAI,
                dimension: 1536,
                price_per_million: Some(0.10),
            },
        ]
    }

    pub fn model_name(&self) -> &str {
        &self.model
    }
}

impl std::fmt::Debug for OpenAIEmbeddingProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("OpenAIEmbeddingProvider")
            .field("model", &self.model)
            .finish()
    }
}

#[async_trait::async_trait]
impl EmbeddingProvider for OpenAIEmbeddingProvider {
    fn provider_type(&self) -> EmbeddingProviderType {
        EmbeddingProviderType::OpenAI
    }

    async fn generate_embedding(&self, text: &str) -> Result<EmbeddingResponse, String> {
        let url = "https://api.openai.com/v1/embeddings";

        let body = json!({
            "model": self.model,
            "input": text,
        });

        let response = self
            .client
            .post(url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("OpenAI API error {}: {}", status, error_text));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        let embedding: Vec<f32> = json["data"][0]["embedding"]
            .as_array()
            .ok_or("Missing embedding in response")?
            .iter()
            .map(|v| v.as_f64().ok_or("Invalid embedding value").map(|value| value as f32))
            .collect::<Result<_, _>>()
            .map_err(|e| e.to_string())?;

        let tokens = json["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32;

        Ok(EmbeddingResponse {
            embedding,
            dimension: self.dimension,
            tokens,
        })
    }

    async fn generate_embeddings_batch(&self, texts: &[String]) -> Result<Vec<EmbeddingResponse>, String> {
        let url = "https://api.openai.com/v1/embeddings";

        let body = json!({
            "model": self.model,
            "input": texts,
        });

        let response = self
            .client
            .post(url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("OpenAI API error {}: {}", status, error_text));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        let tokens = json["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32;

        let data = json["data"]
            .as_array()
            .ok_or("Missing data in response")?;

        let mut responses = Vec::new();
        for item in data {
            let embedding: Vec<f32> = item["embedding"]
                .as_array()
                .ok_or("Missing embedding in response")?
                .iter()
                .map(|v| v.as_f64().ok_or("Invalid embedding value").map(|value| value as f32))
                .collect::<Result<_, _>>()
                .map_err(|e| e.to_string())?;

            responses.push(EmbeddingResponse {
                embedding,
                dimension: self.dimension,
                tokens: tokens / texts.len() as u32, // Approximate tokens per item
            });
        }

        Ok(responses)
    }

    fn is_available(&self) -> bool {
        !self.api_key.is_empty()
    }

    fn dimension(&self) -> usize {
        self.dimension
    }
}

/// Cohere embedding provider
pub struct CohereEmbeddingProvider {
    api_key: String,
    model: String,
    dimension: usize,
    client: reqwest::Client,
}

impl CohereEmbeddingProvider {
    /// Create a new Cohere embedding provider
    pub fn new(api_key: String, model: Option<String>) -> Self {
        let model = model.unwrap_or_else(|| "embed-english-v3.0".to_string());
        let dimension = match model.as_str() {
            "embed-english-v3.0" => 1024,
            "embed-english-light-v3.0" => 384,
            "embed-multilingual-v3.0" => 1024,
            "embed-multilingual-light-v3.0" => 384,
            _ => 1024, // default
        };

        Self {
            api_key,
            model,
            dimension,
            client: reqwest::Client::new(),
        }
    }

    /// Get available Cohere embedding models
    pub fn available_models() -> Vec<EmbeddingModel> {
        vec![
            EmbeddingModel {
                id: "embed-english-v3.0".to_string(),
                name: "embed-english-v3.0 (1024d)".to_string(),
                provider: EmbeddingProviderType::Cohere,
                dimension: 1024,
                price_per_million: Some(0.10),
            },
            EmbeddingModel {
                id: "embed-english-light-v3.0".to_string(),
                name: "embed-english-light-v3.0 (384d)".to_string(),
                provider: EmbeddingProviderType::Cohere,
                dimension: 384,
                price_per_million: Some(0.02),
            },
            EmbeddingModel {
                id: "embed-multilingual-v3.0".to_string(),
                name: "embed-multilingual-v3.0 (1024d)".to_string(),
                provider: EmbeddingProviderType::Cohere,
                dimension: 1024,
                price_per_million: Some(0.10),
            },
            EmbeddingModel {
                id: "embed-multilingual-light-v3.0".to_string(),
                name: "embed-multilingual-light-v3.0 (384d)".to_string(),
                provider: EmbeddingProviderType::Cohere,
                dimension: 384,
                price_per_million: Some(0.02),
            },
        ]
    }

    pub fn model_name(&self) -> &str {
        &self.model
    }
}

impl std::fmt::Debug for CohereEmbeddingProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CohereEmbeddingProvider")
            .field("model", &self.model)
            .finish()
    }
}

#[async_trait::async_trait]
impl EmbeddingProvider for CohereEmbeddingProvider {
    fn provider_type(&self) -> EmbeddingProviderType {
        EmbeddingProviderType::Cohere
    }

    async fn generate_embedding(&self, text: &str) -> Result<EmbeddingResponse, String> {
        let url = "https://api.cohere.ai/v1/embed";

        let body = json!({
            "model": self.model,
            "texts": [text],
            "input_type": "search_document",
        });

        let response = self
            .client
            .post(url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Cohere API error {}: {}", status, error_text));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        let embedding: Vec<f32> = json["embeddings"][0]
            .as_array()
            .ok_or("Missing embedding in response")?
            .iter()
            .map(|v| v.as_f64().ok_or("Invalid embedding value").map(|value| value as f32))
            .collect::<Result<_, _>>()
            .map_err(|e| e.to_string())?;

        let meta = json["meta"].as_object().ok_or("Missing meta in response")?;
        let tokens = meta["billed_units"]
            .as_object()
            .and_then(|b| b["input_tokens"].as_u64())
            .unwrap_or(0) as u32;

        Ok(EmbeddingResponse {
            embedding,
            dimension: self.dimension,
            tokens,
        })
    }

    async fn generate_embeddings_batch(&self, texts: &[String]) -> Result<Vec<EmbeddingResponse>, String> {
        let url = "https://api.cohere.ai/v1/embed";

        let body = json!({
            "model": self.model,
            "texts": texts,
            "input_type": "search_document",
        });

        let response = self
            .client
            .post(url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Cohere API error {}: {}", status, error_text));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        let meta = json["meta"].as_object().ok_or("Missing meta in response")?;
        let total_tokens = meta["billed_units"]
            .as_object()
            .and_then(|b| b["input_tokens"].as_u64())
            .unwrap_or(0) as u32;

        let embeddings = json["embeddings"]
            .as_array()
            .ok_or("Missing embeddings in response")?;

        let tokens_per_item = total_tokens / texts.len() as u32;

        let mut responses = Vec::new();
        for embedding_data in embeddings {
            let embedding: Vec<f32> = embedding_data
                .as_array()
                .ok_or("Invalid embedding data")?
                .iter()
                .map(|v| v.as_f64().ok_or("Invalid embedding value").map(|value| value as f32))
                .collect::<Result<_, _>>()
                .map_err(|e| e.to_string())?;

            responses.push(EmbeddingResponse {
                embedding,
                dimension: self.dimension,
                tokens: tokens_per_item,
            });
        }

        Ok(responses)
    }

    fn is_available(&self) -> bool {
        !self.api_key.is_empty()
    }

    fn dimension(&self) -> usize {
        self.dimension
    }
}

/// OpenRouter embedding provider
pub struct OpenRouterEmbeddingProvider {
    api_key: String,
    model: String,
    dimension: usize,
    client: reqwest::Client,
}

impl OpenRouterEmbeddingProvider {
    /// Create a new OpenRouter embedding provider
    pub fn new(api_key: String, model: String) -> Self {
        // Try to parse dimension from model name or use default
        let dimension = Self::infer_dimension(&model);

        Self {
            api_key,
            model,
            dimension,
            client: reqwest::Client::new(),
        }
    }

    /// Infer embedding dimension from model name
    fn infer_dimension(model: &str) -> usize {
        if model.contains("1536") || model.contains("small") || model.contains("ada") {
            1536
        } else if model.contains("3072") || model.contains("large") {
            3072
        } else if model.contains("768") {
            768
        } else if model.contains("1024") || model.contains("cohere") {
            1024
        } else if model.contains("384") || model.contains("light") {
            384
        } else {
            1536 // default to OpenAI small
        }
    }

    /// Get available embedding models from OpenRouter
    pub async fn fetch_available_models(api_key: &str) -> Result<Vec<EmbeddingModel>, String> {
        let client = reqwest::Client::new();
        let url = "https://openrouter.ai/api/v1/models";

        let response = client
            .get(url)
            .header("Authorization", format!("Bearer {}", api_key))
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("OpenRouter API error {}: {}", status, error_text));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        let models_data = json["data"]
            .as_array()
            .ok_or("Missing data in response")?;

        let mut models = Vec::new();
        for model_data in models_data {
            let id = model_data["id"]
                .as_str()
                .ok_or("Missing model id")?
                .to_string();

            // Only include embedding models
            if !id.contains("embedding") && !id.contains("embed") {
                continue;
            }

            let name = model_data["name"]
                .as_str()
                .unwrap_or(&id)
                .to_string();

            // Try to get pricing
            let price_per_million = model_data["pricing"]
                .as_object()
                .and_then(|p| p.get("prompt"))
                .and_then(|p| p.as_str())
                .and_then(|p| p.parse::<f64>().ok());

            let dimension = Self::infer_dimension(&id);

            models.push(EmbeddingModel {
                id: id.clone(),
                name,
                provider: EmbeddingProviderType::OpenRouter,
                dimension,
                price_per_million,
            });
        }

        Ok(models)
    }

    /// Get static list of common OpenRouter embedding models
    pub fn common_models() -> Vec<EmbeddingModel> {
        vec![
            EmbeddingModel {
                id: "openai/text-embedding-3-small".to_string(),
                name: "OpenAI: text-embedding-3-small (1536d)".to_string(),
                provider: EmbeddingProviderType::OpenRouter,
                dimension: 1536,
                price_per_million: Some(0.02),
            },
            EmbeddingModel {
                id: "openai/text-embedding-3-large".to_string(),
                name: "OpenAI: text-embedding-3-large (3072d)".to_string(),
                provider: EmbeddingProviderType::OpenRouter,
                dimension: 3072,
                price_per_million: Some(0.13),
            },
            EmbeddingModel {
                id: "cohere/embed-english-v3.0".to_string(),
                name: "Cohere: embed-english-v3.0 (1024d)".to_string(),
                provider: EmbeddingProviderType::OpenRouter,
                dimension: 1024,
                price_per_million: Some(0.10),
            },
            EmbeddingModel {
                id: "cohere/embed-multilingual-v3.0".to_string(),
                name: "Cohere: embed-multilingual-v3.0 (1024d)".to_string(),
                provider: EmbeddingProviderType::OpenRouter,
                dimension: 1024,
                price_per_million: Some(0.10),
            },
            EmbeddingModel {
                id: "google/text-embedding-004".to_string(),
                name: "Google: text-embedding-004 (768d)".to_string(),
                provider: EmbeddingProviderType::OpenRouter,
                dimension: 768,
                price_per_million: Some(0.025),
            },
        ]
    }

    pub fn model_name(&self) -> &str {
        &self.model
    }
}

impl std::fmt::Debug for OpenRouterEmbeddingProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("OpenRouterEmbeddingProvider")
            .field("model", &self.model)
            .finish()
    }
}

#[async_trait::async_trait]
impl EmbeddingProvider for OpenRouterEmbeddingProvider {
    fn provider_type(&self) -> EmbeddingProviderType {
        EmbeddingProviderType::OpenRouter
    }

    async fn generate_embedding(&self, text: &str) -> Result<EmbeddingResponse, String> {
        let url = "https://openrouter.ai/api/v1/embeddings";

        let body = json!({
            "model": self.model,
            "input": text,
        });

        let response = self
            .client
            .post(url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("HTTP-Referer", "https://incrementum.app")
            .header("X-Title", "Incrementum")
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("OpenRouter API error {}: {}", status, error_text));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        let embedding: Vec<f32> = json["data"][0]["embedding"]
            .as_array()
            .ok_or("Missing embedding in response")?
            .iter()
            .map(|v| v.as_f64().ok_or("Invalid embedding value").map(|value| value as f32))
            .collect::<Result<_, _>>()
            .map_err(|e| e.to_string())?;

        let tokens = json["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32;

        Ok(EmbeddingResponse {
            embedding,
            dimension: self.dimension,
            tokens,
        })
    }

    async fn generate_embeddings_batch(&self, texts: &[String]) -> Result<Vec<EmbeddingResponse>, String> {
        let url = "https://openrouter.ai/api/v1/embeddings";

        let body = json!({
            "model": self.model,
            "input": texts,
        });

        let response = self
            .client
            .post(url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("HTTP-Referer", "https://incrementum.app")
            .header("X-Title", "Incrementum")
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let status = response.status();
        let raw_body = response.text().await.unwrap_or_default();

        if !status.is_success() {
            return Err(format!("OpenRouter API error {}: {}", status, raw_body));
        }

        let json: serde_json::Value = serde_json::from_str(&raw_body)
            .map_err(|e| format!("Failed to parse response: {} — body: {}", e, truncate(&raw_body, 500)))?;

        let tokens = json["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32;

        let data = json["data"]
            .as_array()
            .ok_or_else(|| {
                format!(
                    "Missing 'data' array in OpenRouter response (model {}). \
                    The model may not support the embeddings endpoint. Response: {}",
                    self.model,
                    truncate(&raw_body, 500)
                )
            })?;

        let mut responses = Vec::new();
        for item in data {
            let embedding: Vec<f32> = item["embedding"]
                .as_array()
                .ok_or("Missing embedding in response")?
                .iter()
                .map(|v| v.as_f64().ok_or("Invalid embedding value").map(|value| value as f32))
                .collect::<Result<_, _>>()
                .map_err(|e| e.to_string())?;

            responses.push(EmbeddingResponse {
                embedding,
                dimension: self.dimension,
                tokens: tokens / texts.len() as u32,
            });
        }

        Ok(responses)
    }

    fn is_available(&self) -> bool {
        !self.api_key.is_empty()
    }

    fn dimension(&self) -> usize {
        self.dimension
    }
}

/// Ollama embedding provider (local)
pub struct OllamaEmbeddingProvider {
    base_url: String,
    model: String,
    dimension: usize,
    client: reqwest::Client,
}

impl OllamaEmbeddingProvider {
    /// Create a new Ollama embedding provider
    pub fn new(base_url: String, model: String) -> Self {
        // Default dimension for common Ollama embedding models
        let dimension = Self::infer_dimension(&model);

        Self {
            base_url,
            model,
            dimension,
            client: reqwest::Client::new(),
        }
    }

    /// Infer dimension from Ollama model name
    fn infer_dimension(model: &str) -> usize {
        if model.contains("nomic-embed-text") || model.contains("nomic") {
            768
        } else if model.contains("mxbai-embed") {
            1024
        } else if model.contains("all-minilm") {
            384
        } else {
            768 // default for nomic-embed-text
        }
    }

    /// Get common Ollama embedding models
    pub fn common_models() -> Vec<EmbeddingModel> {
        vec![
            EmbeddingModel {
                id: "nomic-embed-text".to_string(),
                name: "nomic-embed-text (768d)".to_string(),
                provider: EmbeddingProviderType::Ollama,
                dimension: 768,
                price_per_million: None, // free, local
            },
            EmbeddingModel {
                id: "mxbai-embed-large".to_string(),
                name: "mxbai-embed-large (1024d)".to_string(),
                provider: EmbeddingProviderType::Ollama,
                dimension: 1024,
                price_per_million: None,
            },
            EmbeddingModel {
                id: "all-minilm".to_string(),
                name: "all-MiniLM-L6-v2 (384d)".to_string(),
                provider: EmbeddingProviderType::Ollama,
                dimension: 384,
                price_per_million: None,
            },
        ]
    }

    pub fn model_name(&self) -> &str {
        &self.model
    }
}

impl std::fmt::Debug for OllamaEmbeddingProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("OllamaEmbeddingProvider")
            .field("base_url", &self.base_url)
            .field("model", &self.model)
            .finish()
    }
}

#[async_trait::async_trait]
impl EmbeddingProvider for OllamaEmbeddingProvider {
    fn provider_type(&self) -> EmbeddingProviderType {
        EmbeddingProviderType::Ollama
    }

    async fn generate_embedding(&self, text: &str) -> Result<EmbeddingResponse, String> {
        let url = format!("{}/api/embeddings", self.base_url);

        let body = json!({
            "model": self.model,
            "input": text,
        });

        let response = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Ollama error {}: {}", status, error_text));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        let embedding: Vec<f32> = json["embedding"]
            .as_array()
            .ok_or("Missing embedding in response")?
            .iter()
            .map(|v| v.as_f64().ok_or("Invalid embedding value").map(|value| value as f32))
            .collect::<Result<_, _>>()
            .map_err(|e| e.to_string())?;

        // Ollama doesn't provide token counts
        let tokens = (text.len() / 4) as u32; // Rough estimate

        Ok(EmbeddingResponse {
            embedding,
            dimension: self.dimension,
            tokens,
        })
    }

    async fn generate_embeddings_batch(&self, texts: &[String]) -> Result<Vec<EmbeddingResponse>, String> {
        // Ollama doesn't support batch embeddings in the same way
        let mut responses = Vec::new();
        for text in texts {
            let response = self.generate_embedding(text).await?;
            responses.push(response);
        }
        Ok(responses)
    }

    fn is_available(&self) -> bool {
        // Could add a health check here
        true
    }

    fn dimension(&self) -> usize {
        self.dimension
    }
}
