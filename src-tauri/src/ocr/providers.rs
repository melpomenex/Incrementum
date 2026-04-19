//! OCR provider implementations

use crate::error::{IncrementumError, Result};
use base64::Engine;
use image::ImageFormat;
use lopdf::Document;
use serde::{Deserialize, Serialize};

/// OCR provider type
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum OCRProviderType {
    #[serde(rename = "tesseract")]
    Tesseract,
    #[serde(rename = "google")]
    GoogleDocumentAI,
    #[serde(rename = "aws")]
    AWSTextract,
    #[serde(rename = "azure")]
    AzureVision,
    #[serde(rename = "marker")]
    Marker,
    #[serde(rename = "nougat")]
    Nougat,
    #[serde(rename = "glm")]
    GLMOCR,
}

/// OCR result with text and metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OCRResult {
    /// Extracted text
    pub text: String,
    /// Confidence score (0-100)
    pub confidence: f64,
    /// Number of lines detected
    pub line_count: usize,
    /// Number of words detected
    pub word_count: usize,
    /// Processing time in milliseconds
    pub processing_time_ms: u64,
    /// Provider used
    pub provider: OCRProviderType,
    /// Additional metadata
    pub metadata: serde_json::Value,
}

/// Bounding box for detected text regions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundingBox {
    pub x0: f64,
    pub y0: f64,
    pub x1: f64,
    pub x2: f64,
    pub y1: f64,
    pub y2: f64,
}

/// Detected text line
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextLine {
    pub text: String,
    pub confidence: f64,
    pub bbox: BoundingBox,
}

/// OCR error types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OCRError {
    ProviderUnavailable(String),
    InvalidInput(String),
    ProcessingFailed(String),
    ConfigurationError(String),
    RateLimitExceeded,
    InsufficientCredits,
}

impl std::fmt::Display for OCRError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OCRError::ProviderUnavailable(msg) => write!(f, "OCR provider unavailable: {}", msg),
            OCRError::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
            OCRError::ProcessingFailed(msg) => write!(f, "OCR processing failed: {}", msg),
            OCRError::ConfigurationError(msg) => write!(f, "OCR configuration error: {}", msg),
            OCRError::RateLimitExceeded => write!(f, "OCR rate limit exceeded"),
            OCRError::InsufficientCredits => write!(f, "Insufficient OCR credits"),
        }
    }
}

impl std::error::Error for OCRError {}

/// Trait for OCR providers
#[async_trait::async_trait]
pub trait OCRProvider: Send + Sync {
    /// Get provider type
    fn provider_type(&self) -> OCRProviderType;

    /// Perform OCR on an image file
    async fn process_image(&self, image_path: &std::path::Path) -> Result<OCRResult>;

    /// Perform OCR on image bytes
    async fn process_image_bytes(&self, image_data: &[u8]) -> Result<OCRResult>;

    /// Check if provider is available
    fn is_available(&self) -> bool;

    /// Get provider name for display
    fn provider_name(&self) -> &str;
}

/// Tesseract OCR provider (local)
pub struct TesseractProvider {
    tesseract_path: Option<String>,
    client: reqwest::Client,
}

impl TesseractProvider {
    pub fn new(tesseract_path: Option<String>) -> Self {
        Self {
            tesseract_path,
            client: reqwest::Client::new(),
        }
    }

    /// Check if Tesseract is installed
    pub fn check_installation(&self) -> Result<()> {
        let cmd = self
            .tesseract_path
            .clone()
            .unwrap_or_else(|| "tesseract".to_string());

        let output = std::process::Command::new(&cmd)
            .arg("--version")
            .output();

        match output {
            Ok(output) if output.status.success() => Ok(()),
            _ => Err(IncrementumError::Internal("Tesseract is not installed. Install it with your package manager:\n  • Arch: sudo pacman -S tesseract\n  • Ubuntu/Debian: sudo apt install tesseract-ocr\n  • macOS: brew install tesseract\n  • Windows: download from https://github.com/UB-Mannheim/tesseract/wiki\n\nOr set the tesseract path in Settings > Documents > OCR.".to_string())),
        }
    }
}

impl std::fmt::Debug for TesseractProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TesseractProvider")
            .field("tesseract_path", &self.tesseract_path)
            .finish()
    }
}

#[async_trait::async_trait]
impl OCRProvider for TesseractProvider {
    fn provider_type(&self) -> OCRProviderType {
        OCRProviderType::Tesseract
    }

    async fn process_image(&self, image_path: &std::path::Path) -> Result<OCRResult> {
        let start = std::time::Instant::now();

        // Check if Tesseract is available
        self.check_installation()?;

        let cmd = self
            .tesseract_path
            .clone()
            .unwrap_or_else(|| "tesseract".to_string());

        // Run Tesseract with output to stdout
        let output = std::process::Command::new(&cmd)
            .arg(image_path)
            .arg("stdout")
            .arg("-l")
            .arg("eng")
            .output()
            .map_err(|e| {
                IncrementumError::Internal(format!("Failed to run Tesseract: {}", e))
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(IncrementumError::Internal(format!(
                "Tesseract processing failed: {}",
                stderr
            )));
        }

        let text = String::from_utf8_lossy(&output.stdout).to_string();
        let processing_time_ms = start.elapsed().as_millis() as u64;

        // Count lines and words
        let line_count = text.lines().count();
        let word_count = text.split_whitespace().count();

        // Tesseract doesn't provide confidence in simple mode
        // In production, you'd use the HOCR output format
        let confidence = 75.0; // Default confidence

        Ok(OCRResult {
            text,
            confidence,
            line_count,
            word_count,
            processing_time_ms,
            provider: OCRProviderType::Tesseract,
            metadata: serde_json::json!({
                "engine": "Tesseract",
                "version": "4.x"
            }),
        })
    }

    async fn process_image_bytes(&self, image_data: &[u8]) -> Result<OCRResult> {
        // Write bytes to temporary file
        let temp_dir = std::env::temp_dir();
        let temp_file = temp_dir.join(format!("ocr_{}.png", uuid::Uuid::new_v4()));

        tokio::fs::write(&temp_file, image_data)
            .await
            .map_err(|e| IncrementumError::Internal(format!("Failed to write temp file: {}", e)))?;

        let result = self.process_image(&temp_file).await;

        // Clean up temp file
        let _ = tokio::fs::remove_file(&temp_file).await;

        result
    }

    fn is_available(&self) -> bool {
        self.check_installation().is_ok()
    }

    fn provider_name(&self) -> &str {
        "Tesseract"
    }
}

/// Google Document AI provider (cloud)
pub struct GoogleDocumentAIProvider {
    project_id: String,
    location: String,
    processor_id: String,
    credentials: String,
    client: reqwest::Client,
}

impl GoogleDocumentAIProvider {
    pub fn new(config: super::GoogleDocumentAIConfig) -> Self {
        Self {
            project_id: config.project_id,
            location: config.location,
            processor_id: config.processor_id,
            credentials: config.credentials_path,
            client: reqwest::Client::new(),
        }
    }
}

impl std::fmt::Debug for GoogleDocumentAIProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("GoogleDocumentAIProvider")
            .field("project_id", &self.project_id)
            .field("location", &self.location)
            .field("processor_id", &self.processor_id)
            .finish()
    }
}

#[async_trait::async_trait]
impl OCRProvider for GoogleDocumentAIProvider {
    fn provider_type(&self) -> OCRProviderType {
        OCRProviderType::GoogleDocumentAI
    }

    async fn process_image(&self, image_path: &std::path::Path) -> Result<OCRResult> {
        let _start = std::time::Instant::now();

        // Read image file
        let image_data = tokio::fs::read(image_path)
            .await
            .map_err(|e| IncrementumError::Internal(format!("Failed to read image: {}", e)))?;

        let mut result = self.process_image_bytes(&image_data).await?;
        result.metadata["image_path"] = serde_json::json!(image_path.to_string_lossy());

        Ok(result)
    }

    async fn process_image_bytes(&self, _image_data: &[u8]) -> Result<OCRResult> {
        // In production, this would use the Google Document AI client library
        // For now, return a placeholder error
        Err(IncrementumError::Internal(
            "Google Document AI integration requires additional dependencies. Please use Tesseract for now.".to_string()
        ))
    }

    fn is_available(&self) -> bool {
        // Check if credentials file exists
        std::path::Path::new(&self.credentials).exists()
    }

    fn provider_name(&self) -> &str {
        "Google Document AI"
    }
}

/// AWS Textract provider (cloud)
pub struct AWSTextractProvider {
    region: String,
    access_key: String,
    secret_key: String,
    client: reqwest::Client,
}

impl AWSTextractProvider {
    pub fn new(config: super::AWSTextractConfig) -> Self {
        Self {
            region: config.region,
            access_key: config.access_key,
            secret_key: config.secret_key,
            client: reqwest::Client::new(),
        }
    }
}

impl std::fmt::Debug for AWSTextractProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AWSTextractProvider")
            .field("region", &self.region)
            .finish()
    }
}

#[async_trait::async_trait]
impl OCRProvider for AWSTextractProvider {
    fn provider_type(&self) -> OCRProviderType {
        OCRProviderType::AWSTextract
    }

    async fn process_image(&self, image_path: &std::path::Path) -> Result<OCRResult> {
        // Read image file
        let image_data = tokio::fs::read(image_path)
            .await
            .map_err(|e| IncrementumError::Internal(format!("Failed to read image: {}", e)))?;

        self.process_image_bytes(&image_data).await
    }

    async fn process_image_bytes(&self, _image_data: &[u8]) -> Result<OCRResult> {
        // In production, this would use the AWS SDK for Rust
        // For now, return a placeholder error
        Err(IncrementumError::Internal(
            "AWS Textract integration requires additional dependencies. Please use Tesseract for now.".to_string()
        ))
    }

    fn is_available(&self) -> bool {
        !self.access_key.is_empty() && !self.secret_key.is_empty()
    }

    fn provider_name(&self) -> &str {
        "AWS Textract"
    }
}

/// Azure Computer Vision provider (cloud)
pub struct AzureVisionProvider {
    endpoint: String,
    api_key: String,
    client: reqwest::Client,
}

impl AzureVisionProvider {
    pub fn new(config: super::AzureVisionConfig) -> Self {
        Self {
            endpoint: config.endpoint,
            api_key: config.api_key,
            client: reqwest::Client::new(),
        }
    }
}

impl std::fmt::Debug for AzureVisionProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AzureVisionProvider")
            .field("endpoint", &self.endpoint)
            .finish()
    }
}

#[async_trait::async_trait]
impl OCRProvider for AzureVisionProvider {
    fn provider_type(&self) -> OCRProviderType {
        OCRProviderType::AzureVision
    }

    async fn process_image(&self, image_path: &std::path::Path) -> Result<OCRResult> {
        // Read image file
        let image_data = tokio::fs::read(image_path)
            .await
            .map_err(|e| IncrementumError::Internal(format!("Failed to read image: {}", e)))?;

        self.process_image_bytes(&image_data).await
    }

    async fn process_image_bytes(&self, _image_data: &[u8]) -> Result<OCRResult> {
        // In production, this would use the Azure SDK for Rust
        // For now, return a placeholder error
        Err(IncrementumError::Internal(
            "Azure Computer Vision integration requires additional dependencies. Please use Tesseract for now.".to_string()
        ))
    }

    fn is_available(&self) -> bool {
        !self.api_key.is_empty() && !self.endpoint.is_empty()
    }

    fn provider_name(&self) -> &str {
        "Azure Computer Vision"
    }
}

/// Marker OCR provider (local PDF to markdown converter)
pub struct MarkerProvider {
    marker_path: Option<String>,
}

impl MarkerProvider {
    pub fn new(marker_path: Option<String>) -> Self {
        Self { marker_path }
    }

    /// Check if Marker is installed
    pub fn check_installation(&self) -> Result<()> {
        let cmd = self
            .marker_path
            .clone()
            .unwrap_or_else(|| "marker".to_string());

        let output = std::process::Command::new(&cmd)
            .arg("--version")
            .output();

        match output {
            Ok(output) if output.status.success() => Ok(()),
            _ => Err(IncrementumError::Internal("Marker not found. Please install it or provide the correct path.".to_string())),
        }
    }
}

impl std::fmt::Debug for MarkerProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("MarkerProvider")
            .field("marker_path", &self.marker_path)
            .finish()
    }
}

#[async_trait::async_trait]
impl OCRProvider for MarkerProvider {
    fn provider_type(&self) -> OCRProviderType {
        OCRProviderType::Marker
    }

    async fn process_image(&self, image_path: &std::path::Path) -> Result<OCRResult> {
        let start = std::time::Instant::now();

        // Marker expects PDFs, for images we can convert first or use Tesseract
        // For now, we'll try running marker and it will handle the conversion
        let cmd = self
            .marker_path
            .clone()
            .unwrap_or_else(|| "marker".to_string());

        let output = std::process::Command::new(&cmd)
            .arg(image_path)
            .arg("--output_format")
            .arg("markdown")
            .output()
            .map_err(|e| {
                IncrementumError::Internal(format!("Failed to run Marker: {}", e))
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(IncrementumError::Internal(format!(
                "Marker processing failed: {}",
                stderr
            )));
        }

        let text = String::from_utf8_lossy(&output.stdout).to_string();
        let processing_time_ms = start.elapsed().as_millis() as u64;

        let line_count = text.lines().count();
        let word_count = text.split_whitespace().count();

        Ok(OCRResult {
            text,
            confidence: 85.0, // Marker typically has good accuracy
            line_count,
            word_count,
            processing_time_ms,
            provider: OCRProviderType::Marker,
            metadata: serde_json::json!({
                "engine": "Marker",
                "format": "markdown"
            }),
        })
    }

    async fn process_image_bytes(&self, image_data: &[u8]) -> Result<OCRResult> {
        // Write bytes to temporary file
        let temp_dir = std::env::temp_dir();
        let temp_file = temp_dir.join(format!("ocr_{}.png", uuid::Uuid::new_v4()));

        tokio::fs::write(&temp_file, image_data)
            .await
            .map_err(|e| IncrementumError::Internal(format!("Failed to write temp file: {}", e)))?;

        let result = self.process_image(&temp_file).await;

        // Clean up temp file
        let _ = tokio::fs::remove_file(&temp_file).await;

        result
    }

    fn is_available(&self) -> bool {
        self.check_installation().is_ok()
    }

    fn provider_name(&self) -> &str {
        "Marker"
    }
}

/// Nougat OCR provider (scientific documents with math)
pub struct NougatProvider {
    nougat_path: Option<String>,
}

impl NougatProvider {
    pub fn new(nougat_path: Option<String>) -> Self {
        Self { nougat_path }
    }

    /// Check if Nougat is installed
    pub fn check_installation(&self) -> Result<()> {
        let cmd = self
            .nougat_path
            .clone()
            .unwrap_or_else(|| "nougat".to_string());

        let output = std::process::Command::new(&cmd)
            .arg("--version")
            .output();

        match output {
            Ok(output) if output.status.success() => Ok(()),
            _ => Err(IncrementumError::Internal("Nougat not found. Please install it or provide the correct path.".to_string())),
        }
    }
}

impl std::fmt::Debug for NougatProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("NougatProvider")
            .field("nougat_path", &self.nougat_path)
            .finish()
    }
}

#[async_trait::async_trait]
impl OCRProvider for NougatProvider {
    fn provider_type(&self) -> OCRProviderType {
        OCRProviderType::Nougat
    }

    async fn process_image(&self, image_path: &std::path::Path) -> Result<OCRResult> {
        let start = std::time::Instant::now();

        let cmd = self
            .nougat_path
            .clone()
            .unwrap_or_else(|| "nougat".to_string());

        let output = std::process::Command::new(&cmd)
            .arg(image_path)
            .output()
            .map_err(|e| {
                IncrementumError::Internal(format!("Failed to run Nougat: {}", e))
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(IncrementumError::Internal(format!(
                "Nougat processing failed: {}",
                stderr
            )));
        }

        let text = String::from_utf8_lossy(&output.stdout).to_string();
        let processing_time_ms = start.elapsed().as_millis() as u64;

        let line_count = text.lines().count();
        let word_count = text.split_whitespace().count();

        Ok(OCRResult {
            text,
            confidence: 80.0, // Nougat is good but can struggle with complex layouts
            line_count,
            word_count,
            processing_time_ms,
            provider: OCRProviderType::Nougat,
            metadata: serde_json::json!({
                "engine": "Nougat",
                "math_support": true
            }),
        })
    }

    async fn process_image_bytes(&self, image_data: &[u8]) -> Result<OCRResult> {
        // Write bytes to temporary file
        let temp_dir = std::env::temp_dir();
        let temp_file = temp_dir.join(format!("ocr_{}.png", uuid::Uuid::new_v4()));

        tokio::fs::write(&temp_file, image_data)
            .await
            .map_err(|e| IncrementumError::Internal(format!("Failed to write temp file: {}", e)))?;

        let result = self.process_image(&temp_file).await;

        // Clean up temp file
        let _ = tokio::fs::remove_file(&temp_file).await;

        result
    }

    fn is_available(&self) -> bool {
        self.check_installation().is_ok()
    }

    fn provider_name(&self) -> &str {
        "Nougat"
    }
}

/// GLM-OCR provider (vLLM OpenAI-compatible endpoint)
pub struct GLMOCRProvider {
    endpoint: String,
    model: String,
    api_key: Option<String>,
    client: reqwest::Client,
}

impl GLMOCRProvider {
    pub fn new(config: super::GLMOCRConfig) -> Self {
        Self {
            endpoint: config.endpoint,
            model: config.model,
            api_key: config.api_key,
            client: reqwest::Client::new(),
        }
    }

    fn build_chat_url(&self) -> String {
        let trimmed = self.endpoint.trim_end_matches('/');
        if trimmed.ends_with("/chat/completions") {
            trimmed.to_string()
        } else if trimmed.ends_with("/v1") {
            format!("{}/chat/completions", trimmed)
        } else {
            format!("{}/v1/chat/completions", trimmed)
        }
    }

    fn guess_mime(bytes: &[u8]) -> &'static str {
        if let Ok(format) = image::guess_format(bytes) {
            match format {
                ImageFormat::Png => "image/png",
                ImageFormat::Jpeg => "image/jpeg",
                ImageFormat::Gif => "image/gif",
                ImageFormat::Bmp => "image/bmp",
                ImageFormat::Tiff => "image/tiff",
                ImageFormat::WebP => "image/webp",
                _ => "image/png",
            }
        } else {
            "image/png"
        }
    }

    fn extract_message_text(content: &ChatContent) -> String {
        match content {
            ChatContent::Text(text) => text.clone(),
            ChatContent::Parts(parts) => parts
                .iter()
                .filter_map(|part| part.text.as_ref())
                .cloned()
                .collect::<Vec<String>>()
                .join(""),
        }
    }

    fn is_pdf(bytes: &[u8]) -> bool {
        bytes.starts_with(b"%PDF-")
    }

    fn extract_pdf_page_images(bytes: &[u8]) -> Result<Vec<(Vec<u8>, String)>> {
        let doc = Document::load_mem(bytes)
            .map_err(|e| IncrementumError::Internal(format!("Failed to load PDF: {}", e)))?;

        let pages = doc.get_pages();
        let mut images = Vec::new();

        for (_, page_id) in pages.iter() {
            let page_images = match doc.get_page_images(*page_id) {
                Ok(images) => images,
                Err(_) => continue,
            };

            let mut best_image: Option<(Vec<u8>, String, i64)> = None;
            for image in page_images {
                let filters = image.filters.clone().unwrap_or_default();
                let mime = if filters.iter().any(|f| f.eq_ignore_ascii_case("DCTDecode")) {
                    "image/jpeg"
                } else if filters.iter().any(|f| f.eq_ignore_ascii_case("JPXDecode")) {
                    "image/jp2"
                } else {
                    continue;
                };

                let area = image.width.saturating_mul(image.height);
                if image.content.is_empty() {
                    continue;
                }

                let should_replace = best_image
                    .as_ref()
                    .map(|(_, _, best_area)| area > *best_area)
                    .unwrap_or(true);

                if should_replace {
                    best_image = Some((image.content.to_vec(), mime.to_string(), area));
                }
            }

            if let Some((bytes, mime, _)) = best_image {
                images.push((bytes, mime));
            }
        }

        Ok(images)
    }

    async fn process_image_bytes_with_mime(&self, image_data: &[u8], mime: &str) -> Result<OCRResult> {
        let start = std::time::Instant::now();
        let encoded = base64::engine::general_purpose::STANDARD.encode(image_data);
        let data_url = format!("data:{};base64,{}", mime, encoded);

        let request_body = serde_json::json!({
            "model": self.model.as_str(),
            "messages": [
                {
                    "role": "system",
                    "content": "You are an OCR engine. Return only the extracted content as Markdown."
                },
                {
                    "role": "user",
                    "content": [
                        { "type": "text", "text": "Extract all text from this image. Preserve structure using Markdown where helpful." },
                        { "type": "image_url", "image_url": { "url": data_url } }
                    ]
                }
            ],
            "temperature": 0,
            "max_tokens": 4096
        });

        let url = self.build_chat_url();
        let mut request = self.client.post(url).json(&request_body);
        if let Some(api_key) = &self.api_key {
            if !api_key.is_empty() {
                request = request.bearer_auth(api_key);
            }
        }

        let response = request.send().await.map_err(|e| {
            IncrementumError::Internal(format!("Failed to call GLM-OCR endpoint: {}", e))
        })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(IncrementumError::Internal(format!(
                "GLM-OCR request failed ({}): {}",
                status, body
            )));
        }

        let parsed: ChatCompletionResponse = response.json().await.map_err(|e| {
            IncrementumError::Internal(format!("Failed to parse GLM-OCR response: {}", e))
        })?;

        let content = parsed.choices.get(0)
            .ok_or_else(|| IncrementumError::Internal("GLM-OCR returned no choices".to_string()))?;

        let text = Self::extract_message_text(&content.message.content);

        if text.trim().is_empty() {
            return Err(IncrementumError::Internal("GLM-OCR returned empty content".to_string()));
        }

        let processing_time_ms = start.elapsed().as_millis() as u64;
        let line_count = text.lines().count();
        let word_count = text.split_whitespace().count();

        Ok(OCRResult {
            text,
            confidence: 85.0,
            line_count,
            word_count,
            processing_time_ms,
            provider: OCRProviderType::GLMOCR,
            metadata: serde_json::json!({
                "engine": "GLM-OCR",
                "format": "markdown",
                "model": self.model.clone()
            }),
        })
    }
}

impl std::fmt::Debug for GLMOCRProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("GLMOCRProvider")
            .field("endpoint", &self.endpoint)
            .field("model", &self.model)
            .finish()
    }
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

#[derive(Debug, Deserialize)]
struct ChatMessage {
    content: ChatContent,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum ChatContent {
    Text(String),
    Parts(Vec<ChatContentPart>),
}

#[derive(Debug, Deserialize)]
struct ChatContentPart {
    #[serde(rename = "type")]
    part_type: String,
    text: Option<String>,
}

#[async_trait::async_trait]
impl OCRProvider for GLMOCRProvider {
    fn provider_type(&self) -> OCRProviderType {
        OCRProviderType::GLMOCR
    }

    async fn process_image(&self, image_path: &std::path::Path) -> Result<OCRResult> {
        let image_data = tokio::fs::read(image_path)
            .await
            .map_err(|e| IncrementumError::Internal(format!("Failed to read image: {}", e)))?;

        if Self::is_pdf(&image_data) {
            let page_images = Self::extract_pdf_page_images(&image_data)?;
            if page_images.is_empty() {
                return Err(IncrementumError::Internal(
                    "GLM-OCR could not find images in this PDF. Try a different OCR provider.".to_string()
                ));
            }

            let start = std::time::Instant::now();
            let mut combined_text = String::new();
            let mut confidence_sum = 0.0;
            let mut page_count = 0;

            for (index, (bytes, mime)) in page_images.iter().enumerate() {
                let result = self.process_image_bytes_with_mime(bytes, mime).await?;
                if index > 0 && !combined_text.is_empty() {
                    combined_text.push_str("\n\n");
                }
                combined_text.push_str(&result.text);
                confidence_sum += result.confidence;
                page_count += 1;
            }

            let processing_time_ms = start.elapsed().as_millis() as u64;
            let line_count = combined_text.lines().count();
            let word_count = combined_text.split_whitespace().count();
            let confidence = if page_count > 0 {
                confidence_sum / page_count as f64
            } else {
                0.0
            };

            return Ok(OCRResult {
                text: combined_text,
                confidence,
                line_count,
                word_count,
                processing_time_ms,
                provider: OCRProviderType::GLMOCR,
                metadata: serde_json::json!({
                    "engine": "GLM-OCR",
                    "format": "markdown",
                    "model": self.model.clone(),
                    "pages": page_count
                }),
            });
        }

        let mut result = self.process_image_bytes(&image_data).await?;
        result.metadata["image_path"] = serde_json::json!(image_path.to_string_lossy());
        Ok(result)
    }

    async fn process_image_bytes(&self, image_data: &[u8]) -> Result<OCRResult> {
        let mime = Self::guess_mime(image_data);
        self.process_image_bytes_with_mime(image_data, mime).await
    }

    fn is_available(&self) -> bool {
        !self.endpoint.trim().is_empty() && !self.model.trim().is_empty()
    }

    fn provider_name(&self) -> &str {
        "GLM-OCR"
    }
}

/// Create OCR provider from type and config
pub fn create_provider(
    provider_type: OCRProviderType,
    config: &super::OCRConfig,
) -> Result<Box<dyn OCRProvider>> {
    match provider_type {
        OCRProviderType::Tesseract => {
            Ok(Box::new(TesseractProvider::new(config.tesseract_path.clone())))
        }
        OCRProviderType::GoogleDocumentAI => {
            let google_config = config.google_document_ai.as_ref()
                .ok_or_else(|| IncrementumError::Internal("Google Document AI config not set".to_string()))?;
            Ok(Box::new(GoogleDocumentAIProvider::new(google_config.clone())))
        }
        OCRProviderType::AWSTextract => {
            let aws_config = config.aws_textract.as_ref()
                .ok_or_else(|| IncrementumError::Internal("AWS Textract config not set".to_string()))?;
            Ok(Box::new(AWSTextractProvider::new(aws_config.clone())))
        }
        OCRProviderType::AzureVision => {
            let azure_config = config.azure_vision.as_ref()
                .ok_or_else(|| IncrementumError::Internal("Azure Vision config not set".to_string()))?;
            Ok(Box::new(AzureVisionProvider::new(azure_config.clone())))
        }
        OCRProviderType::Marker => {
            Ok(Box::new(MarkerProvider::new(config.marker_path.clone())))
        }
        OCRProviderType::Nougat => {
            Ok(Box::new(NougatProvider::new(config.nougat_path.clone())))
        }
        OCRProviderType::GLMOCR => {
            let glm_config = config.glm_ocr.as_ref()
                .ok_or_else(|| IncrementumError::Internal("GLM-OCR config not set".to_string()))?;
            Ok(Box::new(GLMOCRProvider::new(glm_config.clone())))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ocr_result_serialization() {
        let result = OCRResult {
            text: "Test text".to_string(),
            confidence: 95.0,
            line_count: 1,
            word_count: 2,
            processing_time_ms: 100,
            provider: OCRProviderType::Tesseract,
            metadata: serde_json::json!({}),
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("Test text"));
    }
}
