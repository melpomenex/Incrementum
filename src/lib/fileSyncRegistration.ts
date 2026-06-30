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
import { deleteCachedFile } from "./file-transfer";
import { uploadRoomFile, checkRoomFileExists } from "./yjs-file-service";
import { readDocumentFile, upsertSyncedDocument } from "../api/documents";
import { publishDocument, ensureDocumentReplicationReady } from "./documentReplication";

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

    if (sizeBytes === 0) {
      console.warn("[fileSyncRegistration] refusing to register zero-byte file for sync", doc.id);
      return null;
    }

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

    // Register the file for serving WITHOUT reading it into memory upfront.
    // The transfer manager accepts a lazy loader: the file's bytes are only
    // fetched (via readDocumentFile) when a peer actually requests the file.
    // This avoids holding every imported file's full content in RAM for the
    // whole session — critical for libraries with many/large documents, which
    // would otherwise thrash memory and crash on import.
    transferManager.registerLocalFileLoader(fileId, async () => {
      const base64 = await readDocumentFile(doc.filePath);
      return base64ToBlob(base64, mimeForFileType(doc.fileType));
    });

    // Upload the file to the file-service in the background so other devices can sync it asynchronously
    void (async () => {
      try {
        const base64 = await readDocumentFile(doc.filePath);
        const mime = mimeForFileType(doc.fileType);
        const blob = base64ToBlob(base64, mime);
        const filename = doc.title || doc.filePath.split(/[\\/]/).pop() || doc.id;
        const file = new File([blob], filename, { type: mime });
        await uploadRoomFile(file, getSyncRoomId(), fileId);
        console.log("[fileSyncRegistration] successfully uploaded file to file-service:", fileId);
      } catch (uploadErr) {
        console.warn("[fileSyncRegistration] background file-service upload failed:", fileId, uploadErr);
      }
    })();

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
 * Register all existing documents that have a fileId with the file sync subsystem.
 * Called at startup/load time so that the device can advertise and serve files
 * that were imported in previous sessions.
 */
export async function registerExistingFilesSync(docs: Document[]): Promise<void> {
  if (!isTauri()) return;
  if (docs.length === 0) return;

  try {
    await getYjsSync();
    await ensureFileSyncReady();
    await ensureDocumentReplicationReady();

    const manifest = getFileManifest();
    const transferManager = getFileTransferManager();

    for (const doc of docs) {
      if (!doc || !doc.filePath) continue;

      let fileId = doc.fileId;
      let localInfo: { contentHash: string; sizeBytes: number } | null = null;

      const getLocalInfo = async () => {
        if (localInfo) return localInfo;
        const [contentHash, sizeBytes] = await invokeCommand<[string, number]>(
          "hash_document_file",
          { filePath: doc.filePath },
        );
        if (sizeBytes === 0) {
          if (fileId) {
            await clearInvalidSyncedFilePath(doc.id, fileId, "zero-byte local file");
            doc.filePath = "";
          }
          return null;
        }
        localInfo = { contentHash, sizeBytes };
        return localInfo;
      };

      // 1. If the document has no fileId (imported before sync setup), generate one
      if (!fileId) {
        try {
          const info = await getLocalInfo();
          if (!info) continue;

          const existing = manifest.findByHash(info.contentHash);
          fileId = existing.length > 0 ? existing[0].id : crypto.randomUUID();

          if (existing.length === 0) {
            const entry: FileManifestEntry = {
              id: fileId,
              room: getSyncRoomId(),
              filename: doc.title || doc.filePath.split(/[\\/]/).pop() || doc.id,
              contentType: mimeForFileType(doc.fileType),
              sizeBytes: info.sizeBytes,
              contentHash: info.contentHash,
              uploadedAt: new Date().toISOString(),
              uploadedBy: getDeviceId(),
            };
            manifest.addFile(entry);
          }

          doc.fileId = fileId;
          // Update the store document in place + SQLite
          doc.metadata = { ...doc.metadata, fileId };
          await documentsApiUpsert(doc).catch((e) => {
            console.warn("[fileSyncRegistration] failed to save fileId to SQLite metadata", e);
          });
        } catch (hashErr) {
          console.warn("[fileSyncRegistration] failed to hash file during sync initialization", doc.id, hashErr);
          continue;
        }
      } else {
        // 2. If it has a fileId, ensure it has a manifest entry so other peers know about it
        const inManifest = manifest.getAllFiles().find((f) => f.id === fileId);
        if (!inManifest) {
          try {
            const info = await getLocalInfo();
            if (!info) continue;
            const entry: FileManifestEntry = {
              id: fileId,
              room: getSyncRoomId(),
              filename: doc.title || doc.filePath.split(/[\\/]/).pop() || doc.id,
              contentType: mimeForFileType(doc.fileType),
              sizeBytes: info.sizeBytes,
              contentHash: info.contentHash,
              uploadedAt: new Date().toISOString(),
              uploadedBy: getDeviceId(),
            };
            manifest.addFile(entry);
          } catch (hashErr) {
            console.warn("[fileSyncRegistration] failed to hash existing file for manifest", doc.id, hashErr);
          }
        }
      }

      // 3. Register the file loader with the transfer manager if not already present
      if (fileId && !transferManager.hasFileLocal(fileId)) {
        transferManager.registerLocalFileLoader(fileId, async () => {
          const base64 = await readDocumentFile(doc.filePath);
          const blob = base64ToBlob(base64, mimeForFileType(doc.fileType));
          if (blob.size === 0) {
            throw new Error("Local sync file is empty");
          }
          return blob;
        });
      }

      // 3.5 Upload the file to the file-service in the background if it's not already on the server
      if (fileId) {
        const currentFileId = fileId;
        void (async () => {
          try {
            const room = getSyncRoomId();
            const exists = await checkRoomFileExists(room, currentFileId);
            if (!exists) {
              const base64 = await readDocumentFile(doc.filePath);
              const mime = mimeForFileType(doc.fileType);
              const blob = base64ToBlob(base64, mime);
              if (blob.size > 0) {
                const filename = doc.title || doc.filePath.split(/[\\/]/).pop() || doc.id;
                const file = new File([blob], filename, { type: mime });
                await uploadRoomFile(file, room, currentFileId);
                console.log("[fileSyncRegistration] background-uploaded existing file to file-service:", currentFileId);
              }
            }
          } catch (uploadErr) {
            // Ignore background upload failures silently (e.g. offline, temporary error)
          }
        })();
      }

      // 4. Publish the document metadata row to Yjs so other devices replicate the row
      await publishDocument(doc).catch((e) => {
        console.warn("[fileSyncRegistration] failed to publish existing document", doc.id, e);
      });
    }
  } catch (err) {
    console.warn("[fileSyncRegistration] failed to register existing files for sync", err);
  }
}

// Inline helper because of cyclic imports or naming
async function documentsApiUpsert(doc: Document): Promise<Document> {
  return upsertSyncedDocument(doc);
}

/**
 * Clear a synced document's local file pointer when the file behind it is known
 * to be unusable (for example, a failed old Android save that left a zero-byte
 * EPUB). The manifest `fileId` stays intact so the UI can request the file from
 * another peer again.
 */
export async function clearInvalidSyncedFilePath(
  docId: string,
  fileId?: string | null,
  reason = "invalid local file",
): Promise<void> {
  if (!isTauri()) return;

  console.warn("[fileSyncRegistration] clearing invalid synced file path", docId, reason);

  try {
    await invokeCommand("update_document_file_path", {
      documentId: docId,
      filePath: "",
    });
  } catch (err) {
    console.warn("[fileSyncRegistration] failed to clear invalid file path", docId, err);
  }

  if (!fileId) return;

  try {
    await ensureFileSyncReady();
    getFileTransferManager().unregisterLocalFile(fileId);
  } catch (err) {
    console.warn("[fileSyncRegistration] failed to unregister invalid local file", fileId, err);
  }

  try {
    await deleteCachedFile(fileId);
  } catch (err) {
    console.warn("[fileSyncRegistration] failed to delete invalid cached file", fileId, err);
  }
}

const pendingSaves = new Map<string, Promise<string | null>>();

/**
 * Save a file received from a peer to app-managed storage and point the given
 * document at it. Called by the download flow after a transfer completes.
 *
 * Returns the new local file path, or null on failure.
 *
 * Large files (EPUBs/PDFs can be several MB) are streamed to disk in 256 KB
 * chunks via the staging commands, because the Tauri IPC on Android is JSON-
 * only — passing the whole file as a single `Vec<u8>` (`Array.from`) hangs or
 * OOMs the WebView. Small files use the one-shot `save_synced_file` path.
 */
export async function saveReceivedFileSync(
  docId: string,
  fileId: string,
  blob: Blob,
  fileType: string,
  filename: string,
): Promise<string | null> {
  if (!isTauri()) return null;

  const existing = pendingSaves.get(fileId);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    try {
      if (blob.size === 0) {
        throw new Error("Refusing to save an empty synced file");
      }

      const storedPath = await persistReceivedBytes(blob, filename, fileType);
      if (!storedPath) return null;

      const [, storedSize] = await invokeCommand<[string, number]>(
        "hash_document_file",
        { filePath: storedPath },
      );
      if (storedSize !== blob.size) {
        throw new Error(`Synced file persisted with wrong size: expected ${blob.size}, got ${storedSize}`);
      }

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
    } finally {
      pendingSaves.delete(fileId);
    }
  })();

  pendingSaves.set(fileId, promise);
  return promise;
}

/**
 * Write a received blob to app-managed storage and return its absolute path.
 * Uses chunked staging for files above the small-file threshold so the JSON IPC
 * payload stays bounded on Android; falls back to the one-shot command otherwise.
 */
const SMALL_FILE_THRESHOLD = 512 * 1024; // 512 KiB — one-shot payload stays modest.
const STREAM_CHUNK_SIZE = 256 * 1024; // 256 KiB per IPC payload — matches the import path.

async function persistReceivedBytes(
  blob: Blob,
  filename: string,
  fileType: string,
): Promise<string | null> {
  if (blob.size <= SMALL_FILE_THRESHOLD) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return invokeCommand<string>("save_synced_file", {
      bytes: Array.from(bytes),
      filename,
      fileType,
    });
  }

  // Stream the blob to disk in bounded chunks via the staging commands. The
  // staged file lands under app_data_dir/imports, which read_document_file can
  // open like any other absolute path.
  const stagedPath = await invokeCommand<string>("stage_import_file_start", { fileName: filename });
  const total = blob.size;
  for (let offset = 0; offset < total; offset += STREAM_CHUNK_SIZE) {
    const slice = blob.slice(offset, Math.min(offset + STREAM_CHUNK_SIZE, total));
    const buf = new Uint8Array(await slice.arrayBuffer());
    const written = await invokeCommand<number>("append_import_file_chunk", {
      stagedPath,
      chunk: Array.from(buf),
    });
    const expected = Math.min(offset + STREAM_CHUNK_SIZE, total);
    if (written !== expected) {
      throw new Error(`Chunked synced file write mismatch: expected ${expected}, got ${written}`);
    }
  }
  return stagedPath;
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
