/**
 * TTS Text Extraction Utilities
 *
 * Provides text extraction helpers for different document types (PDF, EPUB, Markdown)
 * to support text-to-speech functionality across all document viewers.
 */

/**
 * Configuration for text extraction
 */
export interface TextExtractionOptions {
  /** Maximum characters per chunk (for streaming) */
  maxChunkSize?: number;
  /** Whether to preserve paragraph breaks */
  preserveParagraphs?: boolean;
  /** Whether to include page numbers in output */
  includePageNumbers?: boolean;
}

/**
 * Result of text extraction
 */
export interface ExtractedText {
  /** Full extracted text */
  text: string;
  /** Text chunks for streaming (if maxChunkSize specified) */
  chunks?: string[];
  /** Character count */
  charCount: number;
  /** Estimated word count */
  wordCount: number;
  /** Estimated reading time in seconds */
  readingTimeSec: number;
}

/**
 * Clean and normalize text for TTS
 */
export function cleanTextForTTS(text: string): string {
  return text
    // Remove HTML tags
    .replace(/<[^>]*>/g, " ")
    // Remove markdown links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove markdown images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
    // Remove markdown headers markers
    .replace(/^#{1,6}\s+/gm, "")
    // Remove markdown bold/italic markers
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")
    // Remove markdown code blocks
    .replace(/```[\s\S]*?```/g, "")
    // Remove inline code
    .replace(/`([^`]+)`/g, "$1")
    // Remove markdown horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, "")
    // Remove markdown list markers
    .replace(/^[\s]*[-*+]\s+/gm, "")
    .replace(/^[\s]*\d+\.\s+/gm, "")
    // Remove markdown blockquotes
    .replace(/^>\s+/gm, "")
    // Normalize whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Chunk text for streaming TTS
 */
export function chunkTextForTTS(
  text: string,
  maxChunkSize: number = 500
): string[] {
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  let currentChunk = "";

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if (currentChunk.length + trimmed.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }

    currentChunk += " " + trimmed;
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

/**
 * Extract text from PDF.js page content
 */
export function extractTextFromPDFContent(items: unknown[]): string {
  const textItems = items
    .map((item: unknown) => {
      if (typeof item === "object" && item !== null && "str" in item) {
        return (item as { str: string }).str;
      }
      return "";
    })
    .filter((str) => str.length > 0);

  return textItems.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Extract text from EPUB.js section
 */
export function extractTextFromEPUBSection(doc: Document): string {
  // Clone the document to avoid modifying the original
  const clone = doc.cloneNode(true) as Document;

  // Remove script and style elements
  clone.querySelectorAll("script, style, nav, header, footer").forEach((el) => el.remove());

  // Get text content
  return clone.body?.textContent?.replace(/\s+/g, " ").trim() || "";
}

/**
 * Process extracted text with options
 */
export function processExtractedText(
  text: string,
  options: TextExtractionOptions = {}
): ExtractedText {
  const {
    maxChunkSize,
    preserveParagraphs = true,
  } = options;

  let processedText = text;

  if (!preserveParagraphs) {
    processedText = processedText.replace(/\n+/g, " ");
  }

  processedText = cleanTextForTTS(processedText);

  const charCount = processedText.length;
  const wordCount = processedText.split(/\s+/).filter((w) => w.length > 0).length;
  const readingTimeSec = Math.ceil((wordCount / 200) * 60); // 200 words per minute

  const result: ExtractedText = {
    text: processedText,
    charCount,
    wordCount,
    readingTimeSec,
  };

  if (maxChunkSize && charCount > maxChunkSize) {
    result.chunks = chunkTextForTTS(processedText, maxChunkSize);
  }

  return result;
}

/**
 * Calculate reading progress
 */
export function calculateReadingProgress(
  currentPosition: number,
  totalLength: number
): number {
  if (totalLength <= 0) return 0;
  return Math.min(100, Math.round((currentPosition / totalLength) * 100));
}

/**
 * Find the nearest sentence boundary
 */
export function findSentenceBoundary(
  text: string,
  position: number,
  direction: "forward" | "backward" = "forward"
): number {
  const sentenceEndRegex = /[.!?]\s+/g;

  if (direction === "forward") {
    let match;
    while ((match = sentenceEndRegex.exec(text)) !== null) {
      if (match.index > position) {
        return match.index + match[0].length;
      }
    }
    return text.length;
  } else {
    let lastBoundary = 0;
    let match;
    while ((match = sentenceEndRegex.exec(text)) !== null) {
      if (match.index < position) {
        lastBoundary = match.index + match[0].length;
      } else {
        break;
      }
    }
    return lastBoundary;
  }
}

/**
 * Format reading time for display
 */
export function formatReadingTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
