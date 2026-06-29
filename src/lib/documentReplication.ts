/**
 * Document-row replication across devices via the shared Yjs doc.
 *
 * Background: the document library is backed by per-device SQLite, NOT
 * localStorage, so the localStorage bridge (which syncs settings/collections/
 * highlights) never carried document rows. Devices in the same room therefore
 * saw disjoint libraries — even with file sync working, the receiving device
 * had no row to show in its Documents tab.
 *
 * This layer closes that gap with a `documents` Y.Map keyed by document id:
 *   - publishDocument(doc): writes the local doc to the map. Called from the
 *     import path and on local edits.
 *   - remote entries are observed and upserted into local SQLite via the
 *     `upsert_synced_document` Tauri command (conflict resolution: only write
 *     when the remote dateModified is newer than local, or local is absent).
 *   - after an upsert, the documentStore reloads so the new row appears in the
 *     library UI immediately.
 *
 * The `filePath` of a remote doc is the SOURCE device's path — meaningless on
 * the receiver. We preserve the doc row (id, title, type, fileId, …) but leave
 * the receiver's filePath as-is; the file-transfer path (`fileId` → download)
 * supplies the actual bytes and writes the receiver's own path via
 * update_document_file_path once downloaded. Until then the row shows in the
 * library with an "available to download" badge.
 *
 * We store the full Document shape (minus the large `content` extracted-text
 * field, which is regenerable) so the Rust `Document` struct deserializes
 * cleanly. Best-effort by design: every failure is logged and swallowed so a
 * single bad row can never wedge replication or break local DB writes.
 */

import * as Y from "yjs";
import { invokeCommand, isTauri } from "./tauri";
import { getYjsSync } from "./yjsSync";
import type { Document } from "../types";
import { useDocumentStore } from "../stores/documentStore";

let initialized = false;
let initPromise: Promise<void> | null = null;
let documentsMap: Y.Map<Document> | null = null;

/**
 * Initialize the replication layer: attach to the shared yjs doc's `documents`
 * map and subscribe to remote changes. Idempotent; safe to call from boot and
 * lazily from the publish path.
 */
export async function ensureDocumentReplicationReady(): Promise<void> {
  if (initialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const sync = await getYjsSync();
        documentsMap = sync.doc.getMap<Document>("documents");
        documentsMap.observe((event) => {
          for (const key of event.keysChanged) {
            // Don't re-process our own writes: handleRemoteDocument checks
            // dateModified against local and no-ops if we're already current.
            void handleRemoteDocument(key);
          }
        });
        // Process anything already in the map (e.g. docs published before this
        // device joined the room).
        documentsMap.forEach((_value, key) => {
          void handleRemoteDocument(key);
        });
        initialized = true;
      } catch (err) {
        // Reset so a later call can retry — mirrors the file-sync fix.
        initPromise = null;
        console.error("[documentReplication] init failed", err);
        throw err;
      }
    })();
  }
  return initPromise;
}

/**
 * Publish a local document to the shared map so other devices receive it.
 * No-op outside Tauri (web/PWA has no docs to share via this path). Strips the
 * large `content` field (regenerable extracted text) to keep the wire small.
 */
export async function publishDocument(doc: Document): Promise<void> {
  if (!isTauri()) return;
  try {
    await ensureDocumentReplicationReady();
    if (!documentsMap) return;
    // Drop heavy extracted text — it's large and regenerable, and the receiver
    // can re-extract from the file once downloaded. Everything else goes.
    const { content: _content, ...lightweight } = doc;
    documentsMap.set(doc.id, lightweight as Document);
  } catch (err) {
    console.warn("[documentReplication] publish failed", doc.id, err);
  }
}

/**
 * Handle a document entry from the shared map: if it's newer than the local
 * row (or local doesn't have it), upsert into SQLite and reload the store so
 * the library reflects it. Skips our own writes (handled by dateModified check
 * — our publish stamped the same timestamp we'd be receiving back).
 */
async function handleRemoteDocument(docId: string): Promise<void> {
  if (!isTauri() || !documentsMap) return;
  const remote = documentsMap.get(docId);
  if (!remote) return; // entry was deleted; deletion sync is out of scope here.

  // Conflict check: only write if remote is newer than local (or local absent).
  const localDocs = useDocumentStore.getState().documents ?? [];
  const local = localDocs.find((d) => d.id === docId);
  if (local) {
    const localMs = Date.parse(local.dateModified || local.dateAdded);
    const remoteMs = Date.parse(remote.dateModified || remote.dateAdded);
    if (!Number.isNaN(localMs) && !Number.isNaN(remoteMs) && remoteMs <= localMs) {
      return; // local is at least as new — don't clobber.
    }
  }

  try {
    // Upsert into SQLite. filePath stays as the remote (source) path; the
    // receiver will overwrite it with its own path once the file downloads.
    await invokeCommand("upsert_synced_document", { document: remote });
    // Reload so the new row shows in the library.
    await useDocumentStore.getState().loadDocuments();
  } catch (err) {
    console.warn("[documentReplication] upsert failed", docId, err);
  }
}
