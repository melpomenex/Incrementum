/**
 * Audiobook API
 * 
 * Handles audiobook metadata extraction, transcript management,
 * chapter parsing, and cover art fetching.
 * 
 * Supports both local Whisper and Groq cloud transcription.
 */

import { isTauri } from "../lib/tauri";
import { useSettingsStore } from "../stores/settingsStore";
import { 
  transcribeWithGroq, 
  convertGroqToInternalFormat,
  isGroqConfigured,
  GroqTranscriptionError,
} from "./groqTranscription";
import type { Document } from "../types/document";

export interface AudiobookMetadata {
  title: string;
  author?: string;
  narrator?: string;
  duration: number; // in seconds
  chapters: AudiobookChapter[];
  coverUrl?: string;
  description?: string;
  publisher?: string;
  publishYear?: number;
  language?: string;
  genre?: string[];
  isbn?: string;
  series?: string;
  seriesNumber?: number;
}

export interface AudiobookChapter {
  id: number;
  title: string;
  startTime: number; // in seconds
  endTime?: number; // in seconds
  duration?: number; // in seconds
}

export interface AudiobookTranscript {
  segments: TranscriptSegment[];
  fullText: string;
  language?: string;
  source: "generated" | "imported" | "fetched";
  lastUpdated: string;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  speaker?: string;
  confidence?: number;
}

export interface AudiobookImportOptions {
  filePath: string;
  title?: string;
  author?: string;
  coverUrl?: string;
  transcript?: AudiobookTranscript;
  chapters?: AudiobookChapter[];
}

// Supported audiobook formats
export const AUDIOBOOK_FORMATS = [
  "mp3", "m4b", "m4a", "aac", "ogg", "flac", "opus", "wav", "wma"
];

export function isAudiobookFile(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  return AUDIOBOOK_FORMATS.includes(ext);
}

// Scan directory for audiobook files
export async function scanDirectoryForAudiobooks(dirPath: string): Promise<string[]> {
  if (!isTauri()) {
    // Browser mode - can't scan directories
    return [];
  }
  
  const { invokeCommand } = await import("../lib/tauri");
  return await invokeCommand<string[]>("scan_directory_for_audiobooks", {
    dirPath,
    extensions: AUDIOBOOK_FORMATS,
  });
}

// Multi-part audiobook (single book in multiple files)
export interface MultiPartAudiobook {
  title: string;
  author?: string;
  parts: Array<{
    filePath: string;
    partNumber: number;
    duration?: number;
  }>;
  totalDuration: number;
}

// Detect if files are parts of the same book
export function detectMultiPartAudiobook(filePaths: string[]): MultiPartAudiobook | null {
  if (filePaths.length < 2) return null;
  
  // Sort files to ensure proper order
  const sortedPaths = [...filePaths].sort();
  
  const baseNames = sortedPaths.map(path => {
    const fileName = path.split("/").pop()?.split("\\").pop() || "";
    return fileName.replace(/\.[^/.]+$/, "");
  });
  
  const patterns = [
    // "Book Title Part 1", "Book Title Part 2"
    { regex: /^(.+?)\s+(?:part|pt|volume|vol|book|bk)\s*(\d+)$/i, group: 1 },
    // "Book Title - Part 1", "Book Title - Part 2"
    { regex: /^(.+?)\s*[-:]\s*(?:part|pt|volume|vol|book|bk)\s*(\d+)$/i, group: 1 },
    // "Book Title - 001", "Book Title - 002" (dash then number, no keyword)
    { regex: /^(.+?)\s*[-:]\s+(\d+)$/i, group: 1 },
    // "Book Title 1", "Book Title 2" (numbered at end)
    { regex: /^(.+?)\s+(\d+)$/i, group: 1 },
    // "01 Book Title", "02 Book Title" (numbered at start)
    { regex: /^(\d+)\s+(.+)$/i, group: 2 },
  ];
  
  for (const pattern of patterns) {
    const matches = baseNames.map(name => name.match(pattern.regex));
    
    if (matches.every(m => m !== null)) {
      const groups = matches.map(m => m![pattern.group].trim());
      const partNumbers = matches.map(m => parseInt(m![2]));
      
      const baseName = groups[0];
      const allSameBase = groups.every(g => g === baseName);
      
      if (allSameBase) {
        const cleanedBase = baseName
          .replace(/\s*\((?:unabridged|abridged|audiobook)\)\s*$/i, "")
          .trim();

        const titleParts = cleanedBase.split(" - ");
        const author = titleParts.length >= 2 ? titleParts[0].trim() : undefined;
        const title = titleParts.length >= 2 
          ? titleParts.slice(1).join(" - ").trim() 
          : baseName;
        
        return {
          title,
          author,
          parts: sortedPaths.map((path, idx) => ({
            filePath: path,
            partNumber: partNumbers[idx] || idx + 1,
          })),
          totalDuration: 0,
        };
      }
    }
  }
  
  // Fallback: if filenames are very similar (differ only by number)
  if (baseNames.length >= 2) {
    const first = baseNames[0];
    const last = baseNames[baseNames.length - 1];
    
    // Find common prefix (removing trailing numbers)
    const firstWithoutNumbers = first.replace(/\d+\s*$/g, '').trim();
    const lastWithoutNumbers = last.replace(/\d+\s*$/g, '').trim();
    
    if (firstWithoutNumbers === lastWithoutNumbers && firstWithoutNumbers.length > 3) {
      const cleanedFallback = firstWithoutNumbers
        .replace(/\s*\((?:unabridged|abridged|audiobook)\)\s*$/i, "")
        .replace(/\s*[-:]\s*$/, "")
        .trim();
      const titleParts = cleanedFallback.split(" - ");
      const author = titleParts.length >= 2 ? titleParts[0].trim() : undefined;
      const title = titleParts.length >= 2
        ? titleParts.slice(1).join(" - ").trim()
        : cleanedFallback;
      
      return {
        title,
        author,
        parts: sortedPaths.map((path, idx) => ({
          filePath: path,
          partNumber: idx + 1,
        })),
        totalDuration: 0,
      };
    }
  }
  
  return null;
}

// Batch audiobook import result
export interface BatchImportResult {
  successful: Array<{
    filePath: string;
    document: Document;
    metadata: Partial<AudiobookMetadata>;
  }>;
  failed: Array<{
    filePath: string;
    error: string;
  }>;
  total: number;
}

export async function parseAudiobookMetadata(filePath: string): Promise<AudiobookMetadata> {
  if (isTauri()) {
    // In Tauri, use backend to parse metadata
    const { invokeCommand } = await import("../lib/tauri");
    return await invokeCommand<AudiobookMetadata>("parse_audiobook_metadata", { filePath });
  }
  
  // Browser fallback - create basic metadata
  return createBasicMetadata(filePath);
}

// Create basic metadata from filename (browser fallback)
function createBasicMetadata(filePath: string): AudiobookMetadata {
  const fileName = filePath.split("/").pop()?.split("\\").pop() || "Unknown";
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
  
  // Try to parse "Author - Title" format
  const parts = nameWithoutExt.split(" - ");
  let title = nameWithoutExt;
  let author: string | undefined;
  
  if (parts.length >= 2) {
    author = parts[0].trim();
    title = parts.slice(1).join(" - ").trim();
  }
  
  return {
    title,
    author,
    duration: 0,
    chapters: [{
      id: 1,
      title: "Chapter 1",
      startTime: 0,
    }],
  };
}

// Search for audiobook cover art
export async function searchAudiobookCover(
  title: string,
  author?: string
): Promise<string[]> {
  try {
    // Use OpenLibrary or Google Books API for cover images
    const query = author ? `${title} ${author}` : title;
    const encodedQuery = encodeURIComponent(query);
    
    // Try Google Books first
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodedQuery}&maxResults=5`
    );
    
    if (!response.ok) return [];
    
    const data = await response.json();
    const covers: string[] = [];
    
    for (const item of data.items || []) {
      const imageLinks = item.volumeInfo?.imageLinks;
      if (imageLinks) {
        if (imageLinks.extraLarge) covers.push(imageLinks.extraLarge);
        else if (imageLinks.large) covers.push(imageLinks.large);
        else if (imageLinks.medium) covers.push(imageLinks.medium);
        else if (imageLinks.thumbnail) covers.push(imageLinks.thumbnail);
      }
    }
    
    return covers;
  } catch (error) {
    console.error("Failed to search audiobook cover:", error);
    return [];
  }
}

export async function extractAudioCoverArt(filePath: string): Promise<string | null> {
  if (!isTauri()) {
    return null;
  }

  try {
    const { invokeCommand } = await import("../lib/tauri");
    const result = await invokeCommand<string | null>("extract_audio_cover_art", { filePath });
    return result;
  } catch (error) {
    console.error("Failed to extract audio cover art:", error);
    return null;
  }
}

// Search for audiobook metadata
export async function searchAudiobookMetadata(
  title: string,
  author?: string
): Promise<Partial<AudiobookMetadata>[]> {
  try {
    const query = author ? `${title} ${author}` : title;
    const encodedQuery = encodeURIComponent(query);
    
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodedQuery}&maxResults=5`
    );
    
    if (!response.ok) return [];
    
    const data = await response.json();
    
    return (data.items || []).map((item: any) => ({
      title: item.volumeInfo?.title || title,
      author: item.volumeInfo?.authors?.[0] || author,
      description: item.volumeInfo?.description,
      publisher: item.volumeInfo?.publisher,
      publishYear: item.volumeInfo?.publishedDate 
        ? parseInt(item.volumeInfo.publishedDate.substring(0, 4)) 
        : undefined,
      genre: item.volumeInfo?.categories,
      language: item.volumeInfo?.language,
      isbn: item.volumeInfo?.industryIdentifiers?.find(
        (id: any) => id.type === "ISBN_13" || id.type === "ISBN_10"
      )?.identifier,
      coverUrl: item.volumeInfo?.imageLinks?.thumbnail,
    }));
  } catch (error) {
    console.error("Failed to search audiobook metadata:", error);
    return [];
  }
}

/**
 * Generate transcript using local Whisper
 */
async function generateTranscriptWithLocalWhisper(
  filePath: string,
  onProgress?: (progress: number) => void
): Promise<AudiobookTranscript> {
  const { invokeCommand, listen } = await import("../lib/tauri");
  
  // Listen for progress events
  let unlisten: (() => void) | undefined;
  if (onProgress) {
    unlisten = await listen<{ progress: number }>("transcription://progress", (event) => {
      onProgress(event.payload.progress);
    });
  }

  try {
    const settings = useSettingsStore.getState().settings.audioTranscription;
    
    // Use Tauri backend with Whisper
    const result = await invokeCommand<{
      segments: TranscriptSegment[];
      language?: string;
    }>("generate_audiobook_transcript", { 
      filePath,
      model: settings.preferredModelId || "distil-small.en",
      language: settings.language === 'auto' ? undefined : settings.language,
    });
    
    const fullText = result.segments.map(s => s.text).join(" ");
    
    return {
      segments: result.segments,
      fullText,
      language: result.language,
      source: "generated",
      lastUpdated: new Date().toISOString(),
    };
  } finally {
    if (unlisten) {
      try {
        unlisten();
      } catch {
        // Ignore errors during cleanup - listener may already be removed
      }
    }
  }
}

/**
 * Generate transcript using Groq API
 * Automatically handles chunking for large files
 */
async function generateTranscriptWithGroq(
  filePath: string,
  onProgress?: (progress: number) => void
): Promise<AudiobookTranscript> {
  if (!isGroqConfigured()) {
    throw new Error("Groq API key not configured. Please add your API key in Audio Transcription settings.");
  }
  
  const settings = useSettingsStore.getState().settings.audioTranscription;
  const language = settings.language === 'auto' ? undefined : settings.language;
  
  try {
    // Use the transcribeWithGroq API with filePath - it handles chunking automatically
    const response = await transcribeWithGroq({
      filePath,
      language,
      responseFormat: 'verbose_json',
      timestampGranularities: ['segment'],
      temperature: 0,
      onProgress,
    });
    
    const converted = convertGroqToInternalFormat(response);
    
    // Map to our segment format
    const segments: TranscriptSegment[] = converted.segments.map((seg, index) => ({
      id: `segment-${index}`,
      text: seg.text,
      startTime: seg.start_ms / 1000,
      endTime: seg.end_ms / 1000,
      confidence: seg.confidence,
    }));
    
    return {
      segments,
      fullText: converted.text,
      language: response.language,
      source: "generated",
      lastUpdated: new Date().toISOString(),
    };
    
  } catch (error) {
    if (error instanceof GroqTranscriptionError) {
      // Enhance error messages for audiobook context
      if (error.code === 'RATE_LIMITED') {
        throw new Error(
          `Groq rate limit reached. ${error.message} ` +
          `You can switch to local Whisper in settings or wait until your limits reset.`
        );
      }
      if (error.code === 'FILE_TOO_LARGE' || error.code === 'CHUNKING_FAILED') {
        throw new Error(
          `This audiobook is too large for Groq's free tier. ` +
          `Consider switching to local Whisper in settings for large audiobooks.`
        );
      }
      throw new Error(`Groq transcription failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Generate transcript using local models (Whisper/Parakeet) or Groq (Web/PWA)
 * Automatically uses the configured provider (local or Groq)
 * 
 * @param filePath Path to the audio file
 * @param onProgress Progress callback (0-100)
 * @returns Transcript with segments
 */
export async function generateTranscript(
  filePath: string,
  onProgress?: (progress: number) => void
): Promise<AudiobookTranscript> {
  const provider = useSettingsStore.getState().settings.audioTranscription.provider;

  if (provider === 'groq') {
    if (!isTauri()) {
      const { getBrowserFile } = await import("../lib/browser-file-store");
      const file = getBrowserFile(filePath);
      if (!file) throw new Error("Audio file not found in browser");
      
      const { transcribeWithGroq, convertGroqToInternalFormat } = await import("./groqTranscription");
      const language = useSettingsStore.getState().settings.audioTranscription.language;
      
      const response = await transcribeWithGroq({
        file,
        language: language === 'auto' ? undefined : language,
        responseFormat: 'verbose_json',
        timestampGranularities: ['segment'],
        temperature: 0,
        onProgress,
      });

      const converted = convertGroqToInternalFormat(response);
      const segments: TranscriptSegment[] = converted.segments.map((seg, index) => ({
        id: `segment-${index}`,
        text: seg.text,
        startTime: seg.start_ms / 1000,
        endTime: seg.end_ms / 1000,
        confidence: seg.confidence,
      }));

      return {
        segments,
        fullText: converted.text,
        language: response.language,
        source: "generated",
        lastUpdated: new Date().toISOString(),
      };
    } else {
      return generateTranscriptWithGroq(filePath, onProgress);
    }
  } else {
    return generateTranscriptWithLocalWhisper(filePath, onProgress);
  }
}

/**
 * Get the currently configured transcription provider
 */
export function getTranscriptionProvider(): 'local' | 'groq' {
  return useSettingsStore.getState().settings.audioTranscription.provider;
}

/**
 * Check if transcription is available based on current provider and configuration
 */
export function isTranscriptionAvailable(): boolean {
  const provider = getTranscriptionProvider();
  
  if (provider === 'groq') {
    return isGroqConfigured();
  }
  
  return true;
}

export async function importTranscriptFromFile(
  filePath: string
): Promise<AudiobookTranscript> {
  const { readDocumentFile } = await import("./documents");
  
  // Read file content
  const content = await readDocumentFile(filePath);
  const text = atob(content);
  
  // Try to parse as JSON first
  try {
    const json = JSON.parse(text);
    if (json.segments) {
      return {
        segments: json.segments,
        fullText: json.segments.map((s: TranscriptSegment) => s.text).join(" "),
        language: json.language,
        source: "imported",
        lastUpdated: new Date().toISOString(),
      };
    }
  } catch {
    // Not JSON, treat as plain text
  }
  
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  const segments: TranscriptSegment[] = paragraphs.map((text, index) => ({
    id: `segment-${index}`,
    text: text.trim(),
    startTime: 0, // Unknown timing for plain text
    endTime: 0,
  }));
  
  return {
    segments,
    fullText: text,
    source: "imported",
    lastUpdated: new Date().toISOString(),
  };
}

// Search for existing transcript online
export async function searchExistingTranscript(
  _title: string,
  _author?: string
): Promise<AudiobookTranscript | null> {
  // This could search various transcript repositories
  // For now, return null - would need to integrate with specific APIs
  return null;
}

export async function parseChapters(filePath: string): Promise<AudiobookChapter[]> {
  if (isTauri()) {
    const { invokeCommand } = await import("../lib/tauri");
    return await invokeCommand<AudiobookChapter[]>("parse_audiobook_chapters", { filePath });
  }
  
  return [{
    id: 1,
    title: "Chapter 1",
    startTime: 0,
  }];
}

export async function prepareAudiobookPlayback(filePath: string): Promise<string> {
  if (!isTauri()) {
    return filePath;
  }

  const { invokeCommand } = await import("../lib/tauri");
  return await invokeCommand<string>("prepare_audiobook_playback", { filePath });
}

// Format duration in seconds to human readable
export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export async function extractAudioSample(
  filePath: string,
  startTime: number,
  duration: number
): Promise<string> {
  if (!isTauri()) {
    throw new Error("Audio sample extraction requires the desktop app");
  }
  
  const { invokeCommand } = await import("../lib/tauri");
  return await invokeCommand<string>("extract_audio_sample", {
    filePath,
    startTime,
    duration,
  });
}

/**
 * Enrich a freshly-imported audiobook document with metadata + cover art derived
 * from its filename and an online lookup (Google Books). Used by the main import
 * path (which doesn't run the full AudiobookImportDialog flow) so that audiobooks
 * imported via the quick "+" import still get a title, author, description, and
 * cover attached. Best-effort and non-blocking — failures are swallowed.
 *
 * @param doc The document as imported (title is likely the filename).
 * @param filePath The staged readable filesystem path of the audio file.
 */
export async function enrichAudiobookDocument(doc: Document, filePath: string): Promise<void> {
  try {
    const fileName = filePath.split("/").pop()?.split("\\").pop() || filePath;
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
    // Parse "Author - Title" (the most common audiobook naming convention).
    const parts = nameWithoutExt.split(" - ");
    const titleGuess = parts.length >= 2 ? parts.slice(1).join(" - ").trim() : nameWithoutExt;
    const authorGuess = parts.length >= 2 ? parts[0].trim() : undefined;

    // Online metadata + cover lookup in parallel.
    const [metaResults, covers] = await Promise.all([
      searchAudiobookMetadata(titleGuess, authorGuess),
      searchAudiobookCover(titleGuess, authorGuess),
    ]);

    const best = metaResults[0] || {};
    const finalTitle = best.title || titleGuess;
    const finalAuthor = best.author || authorGuess;
    const coverUrl = best.coverUrl || covers[0];

    // Persist the enriched fields. Only attach what we found.
    const { updateDocument: updateDocumentApi } = await import("./documents");
    await updateDocumentApi(doc.id, {
      ...doc,
      title: finalTitle,
      coverImageUrl: coverUrl ?? doc.coverImageUrl,
      fileType: "audio",
      tags: ["audiobook", "audio", ...(best.genre || [])],
      metadata: {
        ...(doc.metadata || {}),
        author: finalAuthor,
        subject: best.description?.substring(0, 200),
        keywords: best.genre,
        language: best.language,
      },
    } as Document);
  } catch (err) {
    console.error("[audiobook] enrichAudiobookDocument failed (non-critical):", err);
  }
}

/**
 * Transcribe a local audiobook file via Groq cloud transcription, entirely on
 * the Rust side (read file → ffmpeg-free chunking → per-chunk Groq upload →
 * persist segments to the document transcript tables). This is the path used on
 * mobile, where local Whisper/Parakeet/SenseVoice sidecars are unavailable and
 * the auto-transcription queue worker has no Groq branch. Also works on desktop
 * when the user's provider is Groq.
 *
 * The Rust command persists segments into the same `transcripts`/`
 * transcript_segments` tables `get_transcript` reads from (keyed by
 * book_id=chapter_id=document_id), and writes the combined text to
 * `documents.content`. So once this resolves, the viewer's transcript panel,
 * karaoke highlight, and auto-scroll (book sync) all work automatically.
 *
 * Emits `audiobook://transcription-progress` / `-complete` / `-error` events
 * keyed by `documentId` (these are also emitted from Rust during processing).
 * Returns the number of transcribed segments.
 */
export async function transcribeAudiobookWithGroq(
  documentId: string,
  filePath: string,
  language?: string,
): Promise<number> {
  if (!isTauri()) {
    throw new Error("Groq audiobook transcription requires the app (Tauri) backend.");
  }

  // Read the Groq key + model from persisted settings — the Rust command runs
  // server-side and can't read the JS store. Mirrors the podcast path.
  const { apiKey, model } = (() => {
    try {
      const raw = localStorage.getItem("incrementum-settings");
      const parsed = raw ? JSON.parse(raw) : null;
      const g = parsed?.state?.settings?.audioTranscription?.groq;
      return { apiKey: g?.apiKey || "", model: g?.model || "whisper-large-v3-turbo" };
    } catch {
      return { apiKey: "", model: "whisper-large-v3-turbo" };
    }
  })();
  if (!apiKey) {
    throw new Error("Groq API key not configured. Please add your API key in Audio Transcription settings.");
  }

  const { invokeCommand } = await import("../lib/tauri");
  const segmentCount = await invokeCommand<number>("transcribe_audio_file_groq", {
    documentId,
    filePath,
    language: language ?? null,
    groqApiKey: apiKey,
    groqModel: model,
  });
  return segmentCount;
}
