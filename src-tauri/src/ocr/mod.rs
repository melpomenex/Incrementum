//! OCR (Optical Character Recognition) service module
//!
//! Provides integration with multiple OCR providers:
//! - Tesseract (local)
//! - Google Document AI (cloud)
//! - AWS Textract (cloud)
//! - Azure Computer Vision (cloud)
//! - GLM-OCR (local via vLLM)

pub mod providers;
pub mod processor;
pub mod runtime;

pub use providers::OCRProviderType;

use serde::{Deserialize, Serialize};

/// OCR configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OCRConfig {
    /// Default provider to use
    pub default_provider: OCRProviderType,
    /// Tesseract installation path (for local OCR)
    pub tesseract_path: Option<String>,
    /// Google Document AI credentials
    pub google_document_ai: Option<GoogleDocumentAIConfig>,
    /// AWS Textract configuration
    pub aws_textract: Option<AWSTextractConfig>,
    /// Azure Computer Vision configuration
    pub azure_vision: Option<AzureVisionConfig>,
    /// Marker installation path (for local PDF to markdown)
    pub marker_path: Option<String>,
    /// Nougat installation path (for math OCR)
    pub nougat_path: Option<String>,
    /// GLM-OCR configuration (local via vLLM)
    pub glm_ocr: Option<GLMOCRConfig>,
}

/// Google Document AI configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleDocumentAIConfig {
    pub project_id: String,
    pub location: String,
    pub processor_id: String,
    pub credentials_path: String,
}

/// AWS Textract configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AWSTextractConfig {
    pub region: String,
    pub access_key: String,
    pub secret_key: String,
}

/// Azure Computer Vision configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AzureVisionConfig {
    pub endpoint: String,
    pub api_key: String,
}

/// GLM-OCR configuration (vLLM OpenAI-compatible endpoint)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GLMOCRConfig {
    pub endpoint: String,
    pub model: String,
    pub api_key: Option<String>,
}

impl Default for OCRConfig {
    fn default() -> Self {
        Self {
            default_provider: OCRProviderType::Tesseract,
            tesseract_path: None,
            google_document_ai: None,
            aws_textract: None,
            azure_vision: None,
            marker_path: None,
            nougat_path: None,
            glm_ocr: None,
        }
    }
}
