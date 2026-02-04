/**
 * OCR Commands API
 * Frontend API for OCR Tauri commands
 */

import { invokeCommand } from "../lib/tauri";

/**
 * OCR configuration
 */
export interface OCRConfig {
  default_provider: string;
  tesseract_path?: string;
  google_document_ai?: GoogleDocumentAIConfig;
  aws_textract?: AWSTextractConfig;
  azure_vision?: AzureVisionConfig;
  marker_path?: string;
  nougat_path?: string;
  glm_ocr?: GLMOCRConfig;
}

export interface GoogleDocumentAIConfig {
  project_id: string;
  location: string;
  processor_id: string;
  credentials_path: string;
}

export interface AWSTextractConfig {
  region: string;
  access_key: string;
  secret_key: string;
}

export interface AzureVisionConfig {
  endpoint: string;
  api_key: string;
}

export interface GLMOCRConfig {
  endpoint: string;
  model: string;
  api_key?: string;
}

export interface GLMRuntimeStatus {
  backend: string;
  installed: boolean;
  running: boolean;
  endpoint: string;
  models_dir: string;
  last_error?: string;
}

/**
 * OCR image file request
 */
export interface OCRImageRequest {
  image_path: string[];
  provider?: string;
  language?: string;
}

/**
 * OCR image bytes request
 */
export interface OCRBytesRequest {
  image_data: string;
  provider?: string;
  language?: string;
}

/**
 * OCR response
 */
export interface OCRResponse {
  text: string;
  confidence: number;
  line_count: number;
  word_count: number;
  processing_time_ms: number;
  provider: string;
  format?: string;
  success: boolean;
  error?: string;
}

/**
 * OCR PDF file request
 */
export interface OCRPdfRequest {
  pdf_path: string;
  provider?: string;
  language?: string;
}

/**
 * OCR PDF page
 */
export interface OCRPdfPage {
  page_number: number;
  text: string;
}

/**
 * OCR PDF response
 */
export interface OCRPdfResponse {
  pages: OCRPdfPage[];
  combined_text: string;
  confidence: number;
  line_count: number;
  word_count: number;
  processing_time_ms: number;
  provider: string;
  format: string;
  page_count: number;
  success: boolean;
  error?: string;
}

/**
 * Key phrase request
 */
export interface KeyPhraseRequest {
  text: string;
  max_phrases?: number;
}

/**
 * Key phrase
 */
export interface KeyPhrase {
  text: string;
  score: number;
}

/**
 * Key phrase response
 */
export interface KeyPhraseResponse {
  phrases: KeyPhrase[];
}

/**
 * Initialize OCR with configuration
 */
export async function initOCR(config: OCRConfig): Promise<void> {
  return invokeCommand("init_ocr", { config });
}

/**
 * Perform OCR on an image file
 */
export async function ocrImageFile(request: OCRImageRequest): Promise<OCRResponse> {
  return invokeCommand("ocr_image_file", { request });
}

/**
 * Perform OCR on image bytes (base64)
 */
export async function ocrImageBytes(request: OCRBytesRequest): Promise<OCRResponse> {
  return invokeCommand("ocr_image_bytes", { request });
}

/**
 * Perform OCR on a PDF file (multi-page)
 */
export async function ocrPdfFile(request: OCRPdfRequest): Promise<OCRPdfResponse> {
  return invokeCommand("ocr_pdf_file", { request });
}

/**
 * Extract key phrases from text
 */
export async function extractKeyPhrases(request: KeyPhraseRequest): Promise<KeyPhraseResponse> {
  return invokeCommand("extract_key_phrases", { request });
}

/**
 * Get available OCR providers
 */
export async function getAvailableOCRProviders(): Promise<string[]> {
  return invokeCommand("get_available_ocr_providers");
}

/**
 * Check if a provider is available
 */
export async function isProviderAvailable(provider: string): Promise<boolean> {
  return invokeCommand("is_provider_available", { provider });
}

/**
 * Get current OCR configuration
 */
export async function getOCRConfig(): Promise<OCRConfig> {
  return invokeCommand("get_ocr_config");
}

/**
 * Update OCR configuration
 */
export async function updateOCRConfig(config: OCRConfig): Promise<void> {
  return invokeCommand("update_ocr_config", { config });
}

/**
 * Get GLM-OCR runtime status
 */
export async function getGLMRuntimeStatus(params: {
  backend: string;
  endpoint: string;
  ollama_path?: string;
}): Promise<GLMRuntimeStatus> {
  return invokeCommand("glm_runtime_status", params);
}

/**
 * Download Ollama installer (platform-specific)
 */
export async function downloadOllamaInstaller(): Promise<string> {
  return invokeCommand("glm_download_ollama_installer");
}

/**
 * Open installer in OS shell
 */
export async function openInstaller(path: string): Promise<void> {
  return invokeCommand("glm_open_installer", { path });
}

/**
 * Start Ollama runtime
 */
export async function startOllamaRuntime(params: {
  endpoint: string;
  ollama_path?: string;
}): Promise<void> {
  return invokeCommand("glm_start_ollama_runtime", params);
}

/**
 * Stop Ollama runtime
 */
export async function stopOllamaRuntime(): Promise<void> {
  return invokeCommand("glm_stop_ollama_runtime");
}

/**
 * Pull Ollama model
 */
export async function pullOllamaModel(params: {
  model: string;
  ollama_path?: string;
}): Promise<string> {
  return invokeCommand("glm_pull_ollama_model", params);
}
