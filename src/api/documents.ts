/**
 * Tauri API wrapper for document commands
 */

import { invokeCommand, isTauri, isNativeMobile, openFilePicker as tauriOpenFilePicker, openFolderPicker as tauriOpenFolderPicker } from "../lib/tauri";
import { browserInvoke } from "../lib/browser-backend";
import { serializeViewState } from "../lib/readerPosition";
import { Document } from "../types/document";
import type { BulkOperationResult } from "./extract-bulk";
import type { ViewState } from "../types/readerPosition";
import { extractYouTubeVideoId } from "../utils/youtubeEmbed";

/** Thin alias so the dedupe intent reads clearly at the call site. */
const extractYouTubeVideoIdFromUrl = extractYouTubeVideoId;

/**
 * Check if running in web mode (not Tauri)
 */
function isWebMode(): boolean {
  // Tauri v2 does not reliably define `window.__TAURI__` in all contexts.
  return !isTauri();
}

export function mapDocument(doc: Document | null): Document | null {
  if (!doc) return null;
  return {
    ...doc,
    fileId: doc.metadata?.fileId || doc.fileId,
  };
}

export function mapDocuments(docs: Document[]): Document[] {
  if (!docs || !Array.isArray(docs)) return [];
  return docs.map((d) => mapDocument(d)).filter((d): d is Document => d !== null);
}

export async function getDocuments(collectionId?: string): Promise<Document[]> {
  const result = isWebMode()
    ? await browserInvoke<Document[]>("get_documents", { collectionId: collectionId ?? null })
    : await invokeCommand<Document[]>("get_documents", { collectionId: collectionId ?? null });
  return mapDocuments(result);
}

export async function getDocument(id: string): Promise<Document | null> {
  const result = isWebMode()
    ? await browserInvoke<Document | null>("get_document", { id })
    : await invokeCommand<Document | null>("get_document", { id });
  return mapDocument(result);
}

export async function resolveDocumentCover(id: string): Promise<Document | null> {
  const result = isWebMode()
    ? await browserInvoke<Document | null>("resolve_document_cover", { id })
    : await invokeCommand<Document | null>("resolve_document_cover", { id });
  return mapDocument(result);
}

export async function createDocument(
  title: string,
  filePath: string,
  fileType: string,
  collectionId?: string
): Promise<Document> {
  const result = isWebMode()
    ? await browserInvoke<Document>("create_document", {
        title,
        filePath,
        fileType,
        collectionId: collectionId ?? null,
      })
    : await invokeCommand<Document>("create_document", {
        title,
        filePath,
        fileType,
        collectionId: collectionId ?? null,
      });
  return mapDocument(result) as Document;
}

export async function updateDocument(
  id: string,
  updates: Document
): Promise<Document> {
  const result = isWebMode()
    ? await browserInvoke<Document>("update_document", { id, updates })
    : await invokeCommand<Document>("update_document", { id, updates });
  return mapDocument(result) as Document;
}

export async function updateDocumentContent(
  id: string,
  content: string
): Promise<Document> {
  const result = isWebMode()
    ? await browserInvoke<Document>("update_document_content", { id, content })
    : await invokeCommand<Document>("update_document_content", { id, content });
  return mapDocument(result) as Document;
}

export async function updateDocumentPriority(
  id: string,
  rating: number,
  slider: number
): Promise<Document> {
  const result = isWebMode()
    ? await browserInvoke<Document>("update_document_priority", { id, rating, slider })
    : await invokeCommand<Document>("update_document_priority", { id, rating, slider });
  return mapDocument(result) as Document;
}

export async function dismissDocument(
  id: string,
  dismissed: boolean
): Promise<Document> {
  const result = isWebMode()
    ? await browserInvoke<Document>("dismiss_document", { id, dismissed })
    : await invokeCommand<Document>("dismiss_document", { id, dismissed });
  return mapDocument(result) as Document;
}

export async function deleteDocument(id: string): Promise<void> {
  if (isWebMode()) {
    await browserInvoke("delete_document", { id });
  } else {
    await invokeCommand("delete_document", { id });
  }
}

/**
 * Delete multiple documents in a single batched call.
 * Returns succeeded/failed/errors so partial failures can be surfaced.
 */
export async function bulkDeleteDocuments(documentIds: string[]): Promise<BulkOperationResult> {
  if (isWebMode()) {
    return await browserInvoke<BulkOperationResult>("bulk_delete_documents", { documentIds });
  }
  return await invokeCommand<BulkOperationResult>("bulk_delete_documents", { documentIds });
}

export async function importDocument(filePath: string, collectionId?: string): Promise<Document> {
  const result = isWebMode()
    ? await browserInvoke<Document>("import_document", { filePath, collectionId: collectionId ?? null })
    : await invokeCommand<Document>("import_document", { filePath, collectionId: collectionId ?? null });
  return mapDocument(result) as Document;
}

export async function importDocuments(filePaths: string[], collectionId?: string): Promise<Document[]> {
  const result = isWebMode()
    ? await browserInvoke<Document[]>("import_documents", { filePaths, collectionId: collectionId ?? null })
    : await invokeCommand<Document[]>("import_documents", { filePaths, collectionId: collectionId ?? null });
  return mapDocuments(result);
}

export async function importPdfHighlightsAsExtracts(documentId: string): Promise<number> {
  return await invokeCommand<number>("import_pdf_highlights_as_extracts", {
    documentId,
    document_id: documentId,
  });
}

/**
 * Import a document from raw file bytes (mobile path). On Android/iOS the
 * WebView file picker yields content:// URIs unreadable as filesystem paths,
 * so the frontend reads the File's bytes and sends them here. The Rust command
 * stages the bytes to disk and reuses the normal extraction pipeline, so the
 * document lands in the same SQLite store as desktop imports.
 */
export async function importDocumentFromBytes(
  fileName: string,
  fileBytes: Uint8Array,
  collectionId?: string
): Promise<Document> {
  // Tauri IPC deserializes Vec<u8> from a JSON array of numbers. Pass a plain
  // array (not a Uint8Array/Buffer) so it round-trips cleanly.
  const result = await invokeCommand<Document>("import_document_from_bytes", {
    fileName,
    fileBytes: Array.from(fileBytes),
    collectionId: collectionId ?? null,
  });
  return mapDocument(result) as Document;
}

/**
 * Import a File (e.g. from the WebView <input type=file> on mobile) by streaming
 * it to the app's private storage in modest chunks, then importing the staged
 * path. This is the mobile-safe path for LARGE files (audiobooks can be hundreds
 * of MB): the Tauri IPC on Android is JSON-only, so passing the whole file as a
 * `Vec<u8>` (Array.from) hangs/OOMs on big files. Chunking keeps each JSON
 * payload small and bounded.
 *
 * `onProgress` receives the fraction complete (0–1) as bytes stream across.
 */
export async function importDocumentFromFileStreamed(
  file: File,
  collectionId?: string,
  onProgress?: (fraction: number) => void,
): Promise<Document> {
  const CHUNK_SIZE = 256 * 1024; // 256 KB per JSON IPC payload — fast & bounded.
  const stagedPath = await invokeCommand<string>("stage_import_file_start", {
    fileName: file.name,
  });

  const total = file.size;
  let written = 0;
  for (let offset = 0; offset < total; offset += CHUNK_SIZE) {
    const slice = file.slice(offset, Math.min(offset + CHUNK_SIZE, total));
    const buf = new Uint8Array(await slice.arrayBuffer());
    // Vec<u8> args cross IPC as a JSON number array (Tauri/serde requirement).
    // Each chunk is small enough that this is cheap.
    written = await invokeCommand<number>("append_import_file_chunk", {
      stagedPath,
      chunk: Array.from(buf),
    });
    if (onProgress && total > 0) onProgress(written / total);
  }

  // Now import the fully-staged file by path (the normal, non-bytes pipeline).
  const result = await invokeCommand<Document>("import_document", {
    filePath: stagedPath,
    collectionId: collectionId ?? null,
  });
  return mapDocument(result) as Document;
}

export interface PodcastImportResult {
  document: Document;
  transcript_segments: number;
}

export async function importPodcastAudioFile(
  filePath: string,
  title?: string,
  language?: string,
  modelId?: string,
  autoTranscribe?: boolean
): Promise<PodcastImportResult> {
  const result = await invokeCommand<PodcastImportResult>("import_podcast_audio_file", {
    filePath,
    title,
    language,
    modelId,
    autoTranscribe,
  });
  if (result && result.document) {
    result.document = mapDocument(result.document) as Document;
  }
  return result;
}

/**
 * Read document file contents as base64
 * Used for loading PDFs, EPUBs, etc. in the viewer
 */
export async function readDocumentFile(filePath: string): Promise<string> {
  if (isWebMode()) {
    return await browserInvoke<string>("read_document_file", { filePath });
  }
  return await invokeCommand<string>("read_document_file", { filePath });
}

/**
 * Extract text content from a document (for documents without content)
 * Returns the extracted text and whether it was newly extracted
 */
export async function extractDocumentText(id: string): Promise<{ content: string; extracted: boolean }> {
  if (isWebMode()) {
    return await browserInvoke<{ content: string; extracted: boolean }>("extract_document_text", { id });
  }
  return await invokeCommand<{ content: string; extracted: boolean }>("extract_document_text", { id });
}

/**
 * Open file picker dialog for selecting documents to import
 */
export async function openFilePicker(options?: {
  title?: string;
  multiple?: boolean;
  filters?: Array<{ name: string; extensions: string[] }>;
}): Promise<string[] | null> {
  return await tauriOpenFilePicker({
    ...options,
    filters: options?.filters ?? [
      {
        name: "Supported Documents",
        extensions: [
          "pdf",
          "epub",
          "md",
          "markdown",
          "html",
          "htm",
          "mp3",
          "wav",
          "m4a",
          "aac",
          "ogg",
          "flac",
          "opus",
          "mp4",
          "webm",
          "mov",
          "mkv",
          "avi",
          "m4v",
        ],
      },
      {
        name: "PDF",
        extensions: ["pdf"],
      },
      {
        name: "EPUB",
        extensions: ["epub"],
      },
      {
        name: "Markdown",
        extensions: ["md", "markdown"],
      },
      {
        name: "HTML",
        extensions: ["html", "htm"],
      },
    ],
  });
}

/**
 * Open folder picker dialog for bulk import
 */
export async function openFolderPicker(options?: {
  title?: string;
}): Promise<string | null> {
  return await tauriOpenFolderPicker(options);
}

/**
 * A file staged by the folder-import plugin: a readable copy (real path on
 * desktop, staged into app-private storage on mobile) plus its path relative
 * to the picked folder root.
 */
export interface StagedFolderFile {
  /** Absolute filesystem path to a readable copy of the file. */
  path: string;
  /** Path relative to the picked folder root (e.g. "Sci-Fi/Dune.epub"). */
  relativePath: string;
  /** Bare file name (e.g. "Dune.epub"). */
  fileName: string;
}

/**
 * Pick a folder and return every supported file inside it (recursively,
 * including subdirectories).
 *
 * On desktop this opens a native folder dialog and walks the tree; on Android
 * it uses the Storage Access Framework (ACTION_OPEN_DOCUMENT_TREE) and on iOS a
 * UIDocumentPickerViewController in folder mode. On mobile the chosen files are
 * staged into app-private storage first, so the returned paths are readable by
 * the path-based `importDocument` pipeline.
 *
 * Returns an empty array if the user cancels or the folder has no supported files.
 *
 * Uses the in-repo `incrementum-folder-import` Tauri plugin. In browser/PWA
 * mode (no Tauri backend) this is unavailable and resolves to an empty array.
 */
export async function pickFolderDocuments(
  extensions?: string[]
): Promise<StagedFolderFile[]> {
  if (isWebMode()) {
    // Folder import requires the native plugin (SAF / document picker / dialog),
    // which is absent in pure browser/PWA mode.
    return [];
  }
  return await invokeCommand<StagedFolderFile[]>(
    "plugin:incrementum-folder-import|pick_folder_documents",
    { extensions: extensions ?? null }
  );
}

/**
 * Pick one or more FILES (mobile only) via the folder-import plugin's native
 * Storage Access Framework picker (ACTION_OPEN_DOCUMENT). Each picked file is
 * copied into app-private storage in native Kotlin — no bytes cross the
 * JSON-only Tauri IPC — so this works instantly for large files (audiobooks,
 * videos) and returns readable filesystem paths ready for the path-based
 * `importDocument` pipeline. This is the mobile equivalent of `openFilePicker`
 * but with the native fast-copy path.
 *
 * Returns an empty array in pure browser/PWA or if the user cancels.
 */
export async function pickFilesMobile(
  options?: { multiple?: boolean; extensions?: string[] }
): Promise<StagedFolderFile[]> {
  if (isWebMode()) {
    return [];
  }
  return await invokeCommand<StagedFolderFile[]>(
    "plugin:incrementum-folder-import|pick_files",
    {
      extensions: options?.extensions ?? null,
      multiple: options?.multiple ?? false,
    }
  );
}

/**
 * Result from fetching URL content
 */
export interface FetchedUrlContent {
  file_path: string;
  file_name: string;
  content_type: string;
  // Optional properties for rich content previews
  title?: string;
  author?: string;
  text?: string;
  html?: string;
  excerpt?: string;
}

/**
 * Fetch content from a URL and save it to a temporary location
 * Used for Arxiv PDF downloads and URL-based imports
 */
export async function fetchUrlContent(url: string): Promise<FetchedUrlContent> {
  if (isWebMode()) {
    return await browserInvoke<FetchedUrlContent>("fetch_url_content", { url });
  }
  return await invokeCommand<FetchedUrlContent>("fetch_url_content", { url });
}

/**
 * Import a YouTube video as a document.
 *
 * Desktop: uses the Rust `import_youtube_video` command, which fetches metadata
 * and the transcript via yt-dlp.
 *
 * Native mobile (Android/iOS): yt-dlp can't run, and the app's documents are
 * persisted in the Rust SQLite store (not IndexedDB), so we must NOT route
 * through the browser backend (that would write to IndexedDB and the doc would
 * never appear). Instead create the document directly via the Rust
 * `create_document` command with fileType "youtube"; the viewer fetches the
 * transcript on demand from the hosted readsync.org API.
 */
export async function importYouTubeVideo(url: string, collectionId?: string): Promise<Document> {
  // Dedupe by video id: re-importing the same YouTube URL used to create a new
  // doc row each time (new id), and every copy synced to other devices —
  // producing the "4 duplicates" explosion on the phone. If a youtube doc with
  // this video id already exists, return it instead of creating a duplicate.
  // Matches the check in useURLMetadata, but enforced at the import source so
  // every entry point is covered.
  const vidId = extractYouTubeVideoIdFromUrl(url);
  if (vidId) {
    try {
      const existing = (await getDocuments()).find(
        (d) => d && d.fileType === "youtube" && typeof d.filePath === "string" && d.filePath.includes(vidId),
      );
      if (existing) return existing;
    } catch {
      // Non-fatal: fall through to normal import if the lookup fails.
    }
  }

  if (isNativeMobile()) {
    // Resolve a title via oEmbed (best-effort; thumbnail comes from the viewer).
    let title = `YouTube: ${url}`;
    try {
      const resp = await fetch(
        `https://noembed.com/embed?url=${encodeURIComponent(url)}`
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data?.title) title = data.title;
      }
    } catch {
      // noembed is best-effort; keep the URL-based fallback title.
    }
    return await invokeCommand<Document>("create_document", {
      title,
      filePath: url,
      fileType: "youtube",
      collectionId: collectionId ?? null,
    });
  }
  if (isWebMode()) {
    return await browserInvoke<Document>("import_youtube_video", { url, collectionId: collectionId ?? null });
  }
  const doc = await invokeCommand<Document>("import_youtube_video", { url, collectionId: collectionId ?? null });
  // Publish so other devices' libraries receive the YouTube doc. Its filePath
  // is the watch URL (the content), so the receiver opens it directly — no
  // file-sync transfer involved. Fire-and-forget; dynamic import avoids the
  // static cycle (documentReplication -> this module).
  if (doc) {
    void import("../lib/documentReplication")
      .then(({ publishDocument }) => publishDocument(doc))
      .catch(() => {});
  }
  return doc;
}

/**
 * Metadata for a Twitter/X post containing a video.
 * Tauri-only: returned by `get_twitter_video_info` / `import_twitter_video`.
 */
export interface TwitterVideoInfo {
  tweetId: string;
  statusUrl: string;
  title: string;
  author: string;
  thumbnailUrl?: string | null;
  durationSecs?: number | null;
  mp4Url: string;
}

/**
 * Resolve a Twitter/X video URL to its metadata (no download). Tauri-only.
 */
export async function fetchTwitterVideoInfo(url: string): Promise<TwitterVideoInfo> {
  return await invokeCommand<TwitterVideoInfo>("get_twitter_video_info", { url });
}

/**
 * Import a Twitter/X video: downloads the best MP4 and creates a Video document.
 * Tauri-only — throws when invoked outside the desktop app.
 */
export async function importTwitterVideo(url: string, collectionId?: string): Promise<Document> {
  const doc = await invokeCommand<Document>("import_twitter_video", { url, collectionId: collectionId ?? null });
  // Twitter downloads a local MP4, so — unlike YouTube — the receiver needs the
  // file-sync layer to obtain the bytes. Register the file (manifest entry +
  // lazy loader + background upload to the file-service), stamp the fileId onto
  // the doc + metadata, persist it, then publish the row. Mirrors the local-
  // file import path (see documentStore.importFromFile). Fire-and-forget via
  // dynamic import to avoid the static cycle (fileSyncRegistration ->
  // documentReplication -> this module).
  if (doc) {
    void import("../lib/fileSyncRegistration")
      .then(async ({ registerImportedFileSync }) => {
        const fileId = await registerImportedFileSync(doc).catch((e) => {
          console.warn("[importTwitterVideo] file-sync registration failed", e);
          return null;
        });
        if (fileId) {
          doc.fileId = fileId;
          doc.metadata = { ...doc.metadata, fileId };
          await upsertSyncedDocument(doc).catch((e) => {
            console.warn("[importTwitterVideo] failed to save fileId to metadata", e);
          });
        }
        const { publishDocument } = await import("../lib/documentReplication");
        await publishDocument(doc);
      })
      .catch(() => {});
  }
  return doc;
}

/**
 * Unified getDocument function that works in both Tauri and web mode
 */
export async function getDocumentAuto(id: string): Promise<any | null> {
  if (isWebMode()) {
    return await browserInvoke<Document | null>("get_document", { id });
  }
  return await invokeCommand<Document | null>("get_document", { id });
}

/**
 * Unified updateDocumentProgress function that works in both Tauri and web mode
 */
export async function updateDocumentProgressAuto(
  id: string,
  currentPage?: number | null,
  currentScrollPercent?: number | null,
  currentCfi?: string | null,
  currentViewState?: ViewState | string | null
): Promise<any> {
  try {
    const viewStatePayload = serializeViewState(currentViewState);

    if (isWebMode()) {
      return await browserInvoke<Document>("update_document_progress", {
        id,
        current_page: currentPage ?? null,
        current_scroll_percent: currentScrollPercent ?? null,
        current_cfi: currentCfi ?? null,
        current_view_state: viewStatePayload,
      });
    }

    // Tauri invoke expects camelCase for snake_case Rust parameters.
    const updated = await invokeCommand<Document>("update_document_progress", {
      id,
      currentPage: currentPage ?? null,
      currentScrollPercent: currentScrollPercent ?? null,
      currentCfi: currentCfi ?? null,
      currentViewState: viewStatePayload,
    });

    // Re-publish so other devices learn the new position. The command returns
    // the full updated Document, so we pass it straight through (no refetch).
    // Dynamic import breaks the static cycle: documentReplication imports this
    // module. Fire-and-forget — the local save already succeeded; sync must
    // never block the viewer's save path.
    if (updated) {
      void import("../lib/documentReplication")
        .then(({ republishDocumentPosition }) =>
          republishDocumentPosition(updated),
        )
        .catch(() => {});
    }
    return updated;
  } catch (error) {
    // Non-critical — scroll/page position save can fail (e.g. disk I/O on Pi)
    // without affecting the user experience. Log but don't surface.
    console.warn("[Document] updateDocumentProgress failed (non-critical):", error);
  }
}

/**
 * Result from PDF to HTML conversion
 */
export interface PdfToHtmlResult {
  /** The generated HTML content */
  html_content: string;
  /** Path where the HTML file was saved (if save_to_file was true) */
  saved_path: string | null;
  /** The original PDF filename */
  original_filename: string;
}

/**
 * Convert a PDF file to HTML format for better text selection and extraction
 * @param filePath Path to the PDF file
 * @param saveToFile Whether to save the HTML to a file
 * @param outputPath Custom output path (optional, defaults to same directory as PDF)
 */
export async function convertPdfToHtml(
  filePath: string,
  saveToFile?: boolean,
  outputPath?: string
): Promise<PdfToHtmlResult> {
  if (isWebMode()) {
    return await browserInvoke<PdfToHtmlResult>("convert_pdf_to_html", {
      file_path: filePath,
      save_to_file: saveToFile,
      output_path: outputPath,
    });
  }
  return await invokeCommand<PdfToHtmlResult>("convert_pdf_to_html", {
    file_path: filePath,
    save_to_file: saveToFile,
    output_path: outputPath,
  });
}

/**
 * Convert a PDF document by ID to HTML format
 * @param id Document ID
 * @param saveToFile Whether to save the HTML to a file
 * @param outputPath Custom output path (optional)
 */
export async function convertDocumentPdfToHtml(
  id: string,
  saveToFile?: boolean,
  outputPath?: string
): Promise<PdfToHtmlResult> {
  if (isWebMode()) {
    return await browserInvoke<PdfToHtmlResult>("convert_document_pdf_to_html", {
      id,
      save_to_file: saveToFile,
      output_path: outputPath,
    });
  }
  return await invokeCommand<PdfToHtmlResult>("convert_document_pdf_to_html", {
    id,
    save_to_file: saveToFile,
    output_path: outputPath,
  });
}

/**
 * Store a bundle image for a document
 * In Tauri: copies the image to the document's bundle directory
 * In browser: stores in IndexedDB
 */
export async function storeBundleImage(
  docId: string,
  imageName: string,
  imageData: string // base64 encoded
): Promise<void> {
  if (isWebMode()) {
    // Convert base64 to blob and store in IndexedDB
    const response = await fetch(`data:application/octet-stream;base64,${imageData}`);
    const blob = await response.blob();
    const { storeImage } = await import("../lib/bundleImageStore");
    await storeImage(docId, imageName, blob);
    return;
  }
  return await invokeCommand<void>("store_bundle_image", {
    docId,
    imageName,
    imageData,
  });
}

/**
 * Get a bundle image for a document
 * Returns base64 encoded image data
 */
export async function getBundleImage(
  docId: string,
  imageName: string
): Promise<string | null> {
  if (isWebMode()) {
    const { getImage } = await import("../lib/bundleImageStore");
    const blob = await getImage(docId, imageName);
    if (!blob) return null;

    // Convert blob to base64
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        const commaIndex = base64.indexOf(",");
        resolve(commaIndex >= 0 ? base64.slice(commaIndex + 1) : base64);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  }
  return await invokeCommand<string | null>("get_bundle_image", { docId, imageName });
}

/**
 * Get a bundle image URL for display
 * In Tauri: returns a special protocol URL
 * In browser: creates a blob URL
 */
export async function getBundleImageUrl(
  docId: string,
  imageName: string
): Promise<string | null> {
  if (isWebMode()) {
    const { getImageUrl } = await import("../lib/bundleImageStore");
    return await getImageUrl(docId, imageName);
  }
  // In Tauri, return the API path that will be handled by the backend
  return `/api/documents/${docId}/images/${encodeURIComponent(imageName)}`;
}

/**
 * Delete all bundle images for a document
 */
export async function deleteBundleImages(docId: string): Promise<void> {
  if (isWebMode()) {
    const { deleteBundleImages: deleteImages } = await import("../lib/bundleImageStore");
    await deleteImages(docId);
    return;
  }
  return await invokeCommand<void>("delete_bundle_images", { docId });
}

export async function upsertSyncedDocument(document: Document): Promise<Document> {
  const result = isWebMode()
    ? await browserInvoke<Document>("upsert_synced_document", { document })
    : await invokeCommand<Document>("upsert_synced_document", { document });
  return mapDocument(result) as Document;
}
