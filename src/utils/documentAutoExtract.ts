/**
 * Document Auto-Extract Utility
 * Automatically extracts text and key phrases from documents on load
 */

import { invokeCommand as invoke } from "../lib/tauri";
import {
  ocrImageFile,
  getGLMRuntimeStatus,
  startOllamaRuntime,
  updateOCRConfig,
  type OCRConfig,
} from "../api/ocrCommands";
import { isTauri } from "../lib/tauri";
import { useSettingsStore } from "../stores/settingsStore";
import { detectMathContent, extractMathFromText } from "./mathOcr";
import {
  extractKeyPhrases,
  extractKeyPhrasesFrontend,
  getTextStatistics,
  extractSummary,
} from "./keyPhraseExtraction";

/**
 * Document extraction result
 */
export interface DocumentExtractResult {
  text: string;
  keyPhrases: Array<{ text: string; score: number }>;
  mathExpressions: string[];
  statistics: {
    characterCount: number;
    wordCount: number;
    sentenceCount: number;
    paragraphCount: number;
    averageWordLength: number;
    averageSentenceLength: number;
    readabilityScore: number;
  };
  summary?: string[];
  ocrUsed?: boolean;
}

let lastOcrConfigHash: string | null = null;

const DEFAULT_OLLAMA_ENDPOINT = "http://localhost:11434/v1";
const DEFAULT_VLLM_ENDPOINT = "http://localhost:8080/v1";

function resolveGlmEndpoint(settings: ReturnType<typeof useSettingsStore.getState>["settings"]["documents"]["ocr"]) {
  const backend = settings.glmBackend || "ollama";
  if (settings.glmEndpoint && settings.glmEndpoint.trim()) {
    return settings.glmEndpoint;
  }
  return backend === "ollama" ? DEFAULT_OLLAMA_ENDPOINT : DEFAULT_VLLM_ENDPOINT;
}

function buildOCRConfigFromSettings(settings: ReturnType<typeof useSettingsStore.getState>["settings"]["documents"]["ocr"]): OCRConfig {
  const googleConfigured =
    !!settings.googleProjectId &&
    !!settings.googleProcessorId &&
    !!settings.googleCredentialsPath;

  const awsConfigured = !!settings.awsRegion && !!settings.awsAccessKey && !!settings.awsSecretKey;
  const azureConfigured = !!settings.azureEndpoint && !!settings.azureApiKey;
  const glmEndpoint = resolveGlmEndpoint(settings);
  const glmConfigured = !!glmEndpoint && !!settings.glmModel;

  return {
    default_provider: settings.provider,
    tesseract_path: settings.tesseract_path,
    google_document_ai: googleConfigured
      ? {
          project_id: settings.googleProjectId as string,
          location: settings.googleLocation || "us",
          processor_id: settings.googleProcessorId as string,
          credentials_path: settings.googleCredentialsPath as string,
        }
      : undefined,
    aws_textract: awsConfigured
      ? {
          region: settings.awsRegion as string,
          access_key: settings.awsAccessKey as string,
          secret_key: settings.awsSecretKey as string,
        }
      : undefined,
    azure_vision: azureConfigured
      ? {
          endpoint: settings.azureEndpoint as string,
          api_key: settings.azureApiKey as string,
        }
      : undefined,
    marker_path: settings.marker_path,
    nougat_path: settings.nougat_path,
    glm_ocr: glmConfigured
      ? {
          endpoint: glmEndpoint,
          model: settings.glmModel as string,
          api_key: settings.glmApiKey || undefined,
        }
      : undefined,
  };
}

export async function ensureGLMOllamaRuntime(
  settings: ReturnType<typeof useSettingsStore.getState>["settings"]["documents"]["ocr"]
) {
  if (!isTauri()) return;
  if (settings.provider !== "glm") return;
  if ((settings.glmBackend || "ollama") !== "ollama") return;

  const endpoint = resolveGlmEndpoint(settings);
  const status = await getGLMRuntimeStatus({
    backend: "ollama",
    endpoint,
    ollama_path: settings.glmOllamaPath,
  });

  if (!status.running) {
    await startOllamaRuntime({
      endpoint,
      ollama_path: settings.glmOllamaPath,
    });
  }
}

export async function ensureOCRConfig(settings: ReturnType<typeof useSettingsStore.getState>["settings"]["documents"]["ocr"]) {
  const config = buildOCRConfigFromSettings(settings);
  if (settings.provider === "glm" && !config.glm_ocr) {
    throw new Error("GLM-OCR is selected but no model is configured. Set a GLM model in Settings > Documents > OCR.");
  }
  const hash = JSON.stringify(config);
  if (hash === lastOcrConfigHash) {
    return;
  }
  try {
    await updateOCRConfig(config);
    lastOcrConfigHash = hash;
  } catch (error) {
    console.error("Failed to update OCR configuration:", error);
  }
}

/**
 * Check if auto-extract is enabled
 */
export function isAutoExtractEnabled(): boolean {
  const settings = useSettingsStore.getState().settings;
  return settings.documents.ocr.autoExtractOnLoad;
}

/**
 * Extract content from a document on load
 */
export async function extractDocumentOnLoad(
  documentId: string,
  filePath: string,
  fileType: string
): Promise<DocumentExtractResult> {
  const settings = useSettingsStore.getState().settings;
  const { ocr } = settings.documents;

  const result: DocumentExtractResult = {
    text: "",
    keyPhrases: [],
    mathExpressions: [],
    statistics: {
      characterCount: 0,
      wordCount: 0,
      sentenceCount: 0,
      paragraphCount: 0,
      averageWordLength: 0,
      averageSentenceLength: 0,
      readabilityScore: 0,
    },
  };

  // Check if we should perform OCR
  const shouldOCR = ocr.autoOCR || ocr.autoExtractOnLoad;
  const isPDF = fileType === "pdf";
  const isImage = ["png", "jpg", "jpeg", "tiff", "bmp", "gif"].includes(fileType);

  if (shouldOCR && (isPDF || isImage)) {
    try {
      await ensureOCRConfig(ocr);
      await ensureGLMOllamaRuntime(ocr);
      // Determine if we should use math OCR
      const useMathOCR = ocr.mathOcrEnabled;

      if (useMathOCR && isPDF) {
        // Use Nougat for scientific documents
        try {
          const mathResult = await invoke<{ latex: string }>("run_nougat_ocr", {
            imagePath: filePath,
            modelDir: ocr.mathOcrModelDir,
          });

          result.text = mathResult.latex;
          result.ocrUsed = true;
          result.mathExpressions = extractMathFromText(mathResult.latex);
        } catch {
          // Fall back to regular OCR
          const ocrResult = await ocrImageFile({
            image_path: [filePath],
            provider: ocr.provider,
            language: ocr.language,
          });

          if (ocrResult.success) {
            result.text = ocrResult.text;
            result.ocrUsed = true;
          }
        }
      } else {
        // Regular OCR
        const ocrResult = await ocrImageFile({
          image_path: [filePath],
          provider: ocr.provider,
          language: ocr.language,
        });

        if (ocrResult.success) {
          result.text = ocrResult.text;
          result.ocrUsed = true;
        }
      }
    } catch (error) {
      console.error("OCR failed:", error);
    }
  }

  // If we have text, process it
  if (result.text) {
    // Extract key phrases
    if (ocr.keyPhraseExtraction) {
      result.keyPhrases = await extractKeyPhrases(result.text, {
        maxPhrases: 15,
        minScore: 0.1,
      });
    } else {
      result.keyPhrases = extractKeyPhrasesFrontend(result.text, {
        maxPhrases: 15,
        minScore: 0.1,
      });
    }

    // Extract math expressions
    if (ocr.mathOcrEnabled) {
      const mathDetection = detectMathContent(result.text);
      if (mathDetection.hasMath) {
        result.mathExpressions = extractMathFromText(result.text);
      }
    }

    // Calculate statistics
    result.statistics = getTextStatistics(result.text);

    // Generate summary
    result.summary = extractSummary(result.text, {
      maxSentences: 3,
      keyPhrases: result.keyPhrases,
    });
  }

  return result;
}

/**
 * Extract from a PDF document
 */
export async function extractFromPDF(
  filePath: string,
  options: {
    pageRange?: [number, number];
    withOCR?: boolean;
    extractMath?: boolean;
  } = {}
): Promise<DocumentExtractResult> {
  const settings = useSettingsStore.getState().settings;
  const { ocr } = settings.documents;

  const result: DocumentExtractResult = {
    text: "",
    keyPhrases: [],
    mathExpressions: [],
    statistics: {
      characterCount: 0,
      wordCount: 0,
      sentenceCount: 0,
      paragraphCount: 0,
      averageWordLength: 0,
      averageSentenceLength: 0,
      readabilityScore: 0,
    },
  };

  try {
    // Try to extract text from PDF
    const text = await invoke<string>("extract_text_from_pdf", {
      filePath,
      pageRange: options.pageRange,
    });

    if (text && text.length > 100) {
      result.text = text;
    } else if (options.withOCR !== false && ocr.autoOCR) {
      await ensureOCRConfig(ocr);
      await ensureGLMOllamaRuntime(ocr);
      // Fall back to OCR if text extraction didn't work well
      const ocrResult = await ocrImageFile({
        image_path: [filePath],
        provider: ocr.provider,
        language: ocr.language,
      });

      if (ocrResult.success) {
        result.text = ocrResult.text;
        result.ocrUsed = true;
      }
    }

    if (result.text) {
      // Extract key phrases
      if (ocr.keyPhraseExtraction) {
        result.keyPhrases = await extractKeyPhrases(result.text);
      } else {
        result.keyPhrases = extractKeyPhrasesFrontend(result.text);
      }

      // Extract math if enabled
      if (options.extractMath || ocr.mathOcrEnabled) {
        result.mathExpressions = extractMathFromText(result.text);
      }

      // Calculate statistics
      result.statistics = getTextStatistics(result.text);
    }
  } catch (error) {
    console.error("PDF extraction failed:", error);
  }

  return result;
}

/**
 * Extract from an image file
 */
export async function extractFromImage(
  filePath: string,
  options: {
    useMathOCR?: boolean;
  } = {}
): Promise<DocumentExtractResult> {
  const settings = useSettingsStore.getState().settings;
  const { ocr } = settings.documents;

  const result: DocumentExtractResult = {
    text: "",
    keyPhrases: [],
    mathExpressions: [],
    statistics: {
      characterCount: 0,
      wordCount: 0,
      sentenceCount: 0,
      paragraphCount: 0,
      averageWordLength: 0,
      averageSentenceLength: 0,
      readabilityScore: 0,
    },
  };

  try {
    // Use math OCR if enabled and requested
    if ((options.useMathOCR || ocr.mathOcrEnabled) && ocr.mathOcrEnabled) {
      try {
        const mathResult = await invoke<{ latex: string }>("run_nougat_ocr", {
          imagePath: filePath,
          modelDir: ocr.mathOcrModelDir,
        });

        result.text = mathResult.latex;
        result.ocrUsed = true;
        result.mathExpressions = [mathResult.latex];
      } catch {
        await ensureOCRConfig(ocr);
        await ensureGLMOllamaRuntime(ocr);
        // Fall back to regular OCR
        const ocrResult = await ocrImageFile({
          image_path: [filePath],
          provider: ocr.provider,
          language: ocr.language,
        });

        if (ocrResult.success) {
          result.text = ocrResult.text;
          result.ocrUsed = true;
        }
      }
    } else {
      await ensureOCRConfig(ocr);
      await ensureGLMOllamaRuntime(ocr);
      // Regular OCR
      const ocrResult = await ocrImageFile({
        image_path: [filePath],
        provider: ocr.provider,
        language: ocr.language,
      });

      if (ocrResult.success) {
        result.text = ocrResult.text;
        result.ocrUsed = true;
      }
    }

    if (result.text) {
      // Extract key phrases
      if (ocr.keyPhraseExtraction) {
        result.keyPhrases = await extractKeyPhrases(result.text);
      } else {
        result.keyPhrases = extractKeyPhrasesFrontend(result.text);
      }

      // Calculate statistics
      result.statistics = getTextStatistics(result.text);

      // Detect and extract math
      const mathDetection = detectMathContent(result.text);
      if (mathDetection.hasMath) {
        result.mathExpressions = extractMathFromText(result.text);
      }
    }
  } catch (error) {
    console.error("Image extraction failed:", error);
  }

  return result;
}

/**
 * Cache extraction result for a document
 */
export function cacheExtractionResult(
  documentId: string,
  result: DocumentExtractResult
): void {
  try {
    const cacheKey = `extraction_${documentId}`;
    const cacheData = {
      ...result,
      timestamp: Date.now(),
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    console.error("Failed to cache extraction result:", error);
  }
}

/**
 * Load cached extraction result for a document
 */
export function loadCachedExtractionResult(
  documentId: string
): DocumentExtractResult | null {
  try {
    const cacheKey = `extraction_${documentId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      // Check if cache is still valid (24 hours)
      const age = Date.now() - data.timestamp;
      if (age < 24 * 60 * 60 * 1000) {
        return data;
      }
    }
  } catch (error) {
    console.error("Failed to load cached extraction result:", error);
  }
  return null;
}

/**
 * Clear cached extraction result
 */
export function clearExtractionCache(documentId: string): void {
  try {
    const cacheKey = `extraction_${documentId}`;
    localStorage.removeItem(cacheKey);
  } catch (error) {
    console.error("Failed to clear extraction cache:", error);
  }
}

/**
 * Auto-extract with caching
 */
export async function autoExtractWithCache(
  documentId: string,
  filePath: string,
  fileType: string
): Promise<DocumentExtractResult> {
  // Check cache first
  const cached = loadCachedExtractionResult(documentId);
  if (cached) {
    return cached;
  }

  // Perform extraction
  const result = await extractDocumentOnLoad(documentId, filePath, fileType);

  // Cache the result
  if (result.text || result.keyPhrases.length > 0) {
    cacheExtractionResult(documentId, result);
  }

  return result;
}
