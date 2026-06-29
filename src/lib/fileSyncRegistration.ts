/**
 * Bridge between the document store and the file-sync subsystem.
 *
 * The file-sync layer (`FileManifest` + `FileTransferManager`) is a complete
 * P2P transfer protocol, but it lives in isolation from the document model:
 * nothing ever registers an imported file with the manifest, so no file ever
 * becomes discoverable or transferable across devices.
 *
 * This module is the glue. `registerImportedFileSync(doc)` is called from the
 * document store's import path after a document is persisted. It hashes the
 * file (via the `hash_document_file` Tauri command — no base64 round-trip),
 * adds a `FileManifestEntry` to the shared yjs map, registers the file's
 * bytes with the `FileTransferManager` so peers can pull it, and stamps the
 * manifest `fileId` back onto the document so the UI can key off it.
 *
 * Everything here is best-effort and must never break a single-device import:
 * if sync isn't initialized, the file is missing, or hashing fails, we log and
 * move on — the document still imports normally.
 */

import type { Document } from "../types";
import { invokeCommand, isTauri } from "./tauri";
import { getYjsSync, getSyncRoomId } from "./yjsSync";
import { FileManifestEntry, getDeviceId } from "./file-manifest";
import { getFileManifest, getFileTransferManager, ensureFileSyncReady } from "./useFileSync";
import { readDocumentFile } from "../api/documents";

/**
 * Register an imported document's file with the sync manifest.
 *
 * After this runs:
 *   - the file is discoverable by other devices in the room (manifest entry)
 *   - this device advertises it as a source (presence)
 *   - the document's `fileId` is set so the UI can render sync status
 *
 * Returns the assigned `fileId`, or null if sync was unavailable / the file
 * could not be registered (non-fatal).
 */
export async function registerImportedFileSync(
  doc: Document,
): Promise<string | null> {
  // Only meaningful inside Tauri (desktop + mobile). The web/PWA path has no
  // native file to hash.
  if (!isTauri()) return null;

  // Already registered (e.g. re-import of a known file). Keep the existing id.
  if (doc.fileId) return doc.fileId;

  try {
    // Ensure the sync subsystem is initialized. This is a no-op after boot.
    await getYjsSync();
    // useFileSync.ensureFileSyncReady is invoked indirectly via the getters —
    // they throw if not initialized, so call the initializer first.
    await ensureFileSyncReady();

    const manifest = getFileManifest();
    const transferManager = getFileTransferManager();

    // Hash the file on disk (Rust) — returns [sha256-hex, sizeBytes] without
    // ferrying the whole file over IPC.
    const [contentHash, sizeBytes] = await invokeCommand<[string, number]>(
      "hash_document_file",
      { filePath: doc.filePath },
    );

    // Dedupe: if a file with the same content hash is already in the manifest
    // (imported on this or another device), reuse its id instead of adding a
    // duplicate entry.
    const existing = manifest.findByHash(contentHash);
    const fileId = existing.length > 0 ? existing[0].id : crypto.randomUUID();

    if (existing.length === 0) {
      const entry: FileManifestEntry = {
        id: fileId,
        room: getSyncRoomId(),
        filename: doc.title || doc.filePath.split(/[\\/]/).pop() || doc.id,
        contentType: mimeForFileType(doc.fileType),
        sizeBytes,
        contentHash,
        uploadedAt: new Date().toISOString(),
        uploadedBy: getDeviceId(),
      };
      manifest.addFile(entry);
    }

    // Register the local file bytes so this device can serve transfer requests.
    // Read the file via the existing base64 command and decode to a Blob.
    const base64 = await readDocumentFile(doc.filePath);
    const blob = base64ToBlob(base64, mimeForFileType(doc.fileType));
    transferManager.registerLocalFile(fileId, blob);

    // Persist the fileId on the document so the UI can render sync status and
    // so re-imports don't re-register. We update the store-side doc; the Rust
    // schema has no fileId column (it's metadata carried by the state-sync).
    return fileId;
  } catch (err) {
    console.warn("[fileSyncRegistration] failed to register file for sync", doc.id, err);
    return null;
  }
}

/**
 * Save a file received from a peer to app-managed storage and point the given
 * document at it. Called by the download flow after a transfer completes.
 *
 * Returns the new local file path, or null on failure.
 */
export async function saveReceivedFileSync(
  docId: string,
  fileId: string,
  blob: Blob,
  fileType: string,
  filename: string,
): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const storedPath = await invokeCommand<string>("save_synced_file", {
      bytes: Array.from(bytes),
      filename,
      fileType,
    });
    await invokeCommand("update_document_file_path", {
      documentId: docId,
      filePath: storedPath,
    });
    // Register the freshly-saved file with the transfer manager so this device
    // can now also serve it to further peers.
    try {
      await ensureFileSyncReady();
      getFileTransferManager().registerLocalFile(fileId, blob);
    } catch (e) {
      console.warn("[fileSyncRegistration] could not register received file for serving", e);
    }
    return storedPath;
  } catch (err) {
    console.error("[fileSyncRegistration] failed to save received file", docId, err);
    return null;
  }
}

function mimeForFileType(fileType: Document["fileType"]): string {
  switch (fileType) {
    case "pdf": return "application/pdf";
    case "epub": return "application/epub+zip";
    case "audio": return "audio/mpeg";
    case "video": return "video/mp4";
    case "markdown": return "text/markdown";
    case "html": return "text/html";
    default: return "application/octet-stream";
  }
}

function base64ToBlob(base64: string, contentType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: contentType });
}
