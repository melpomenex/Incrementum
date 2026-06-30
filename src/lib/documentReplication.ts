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
import { getDocument, getDocuments } from "../api/documents";

let initialized = false;
let initPromise: Promise<void> | null = null;
let documentsMap: Y.Map<Document> | null = null;

/**
 * filePath schemes that are the document's CONTENT rather than a device-local
 * filesystem location, and therefore must survive replication to other devices.
 * YouTube imports store the watch URL in filePath (the viewer extracts the video
 * id from it); web/URL imports use `browser-fetched://`; the clipboard inbox and
 * screenshot/bundle imports use their own schemes. Absolute paths (/home/...,
 * C:\...) and bare filenames are device-local and excluded — those docs reach
 * peers through the file-sync layer, not via filePath.
 */
const PORTABLE_FILEPATH_SCHEMES = [
  "http://",
  "https://",
  "browser-fetched://",
  "clipboard://",
  "screenshot://",
  "bundle://",
];

function isPortableFilePath(
  filePath: string | undefined,
  fileType?: string,
): boolean {
  if (!filePath) return false;
  // The "youtube" / "video" fileTypes are URL-backed by construction
  // (importYouTubeVideo / import_twitter_video store the source URL in filePath).
  if (fileType === "youtube") return true;
  return PORTABLE_FILEPATH_SCHEMES.some((scheme) =>
    filePath.startsWith(scheme),
  );
}

/**
 * Initialize the replication layer: attach to the shared yjs doc's `documents`
 * map and subscribe to remote changes. Idempotent; safe to call from boot and
 * lazily from the publish path.
 */
export async function ensureDocumentReplicationReady(): Promise<void> {
  const sync = await getYjsSync();
  if (initialized && documentsMap && documentsMap.doc === sync.doc) return;

  if (documentsMap && documentsMap.doc !== sync.doc) {
    initialized = false;
    initPromise = null;
    documentsMap = null;
  }

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
    // Drop fields that are large and either regenerable or device-specific, so
    // the shared CRDT document stays small. The Yjs doc grows monotonically
    // (deletes are permanent tombstones), so publishing a few hundred-KB
    // cover-image data-URLs here bloats the doc to multiple MB — which then
    // makes the sync exchange so large that connections drop before the
    // handshake completes, breaking replication entirely. This was the actual
    // root cause of the "nothing syncs" failure in the field.
    //
    //   content          — extracted text; receiver re-extracts from the file.
    //   coverImageUrl    — often a 100KB+ base64 data-URL; receiver regenerates
    //                      its own cover from the downloaded file.
    //   currentViewState — device-specific (window size, zoom).
    const {
      content: _content,
      coverImageUrl: _coverImageUrl,
      currentViewState: _currentViewState,
      ...lightweight
    } = doc;
    documentsMap.set(doc.id, lightweight as Document);
  } catch (err) {
    console.warn("[documentReplication] publish failed", doc.id, err);
  }
}

/**
 * Trailing debounce window for position re-publishes. Reading-position saves
 * fire frequently (scroll/timeupdate/relocate tick many times per second), and
 * every publish appends a Y.Map entry that the CRDT retains forever as a
 * tombstone — so collapsing a burst of saves into one publish is what keeps
 * the shared doc from ballooning into multi-MB sync exchanges that drop the
 * connection before handshake completes (the original "nothing syncs" failure).
 */
const POSITION_REPUBLISH_DEBOUNCE_MS = 1500;
const pendingPositionRepublish = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Re-publish a document to the shared `documents` map after a reading-position
 * change, so other devices in the room learn the new CFI / page / scroll /
 * time position. This is the missing link for cross-device position sync:
 * `publishDocument` only runs at import time, but position is written later by
 * the viewers via `update_document_progress` / `save_document_position`, which
 * until now touched only local SQLite.
 *
 * Accepts either the full updated Document (preferred — avoids a SQLite
 * round-trip) or just the id (refetched via `getDocument`). Fire-and-forget by
 * design: callers (viewer save paths) must never block on sync. Coalesces
 * rapid successive calls for the same doc id via a trailing debounce.
 *
 * The existing `handleRemoteDocument` conflict check (dateModified newest-wins)
 * prevents an echo loop: the receiver upserts the remote row verbatim
 * (including its `dateModified`), so a re-broadcast of that same timestamp is
 * a no-op. `publishDocument` also strips device-local fields, so position is
 * the only thing that actually changes on the wire.
 */
export function republishDocumentPosition(docOrId: Document | string): void {
  if (!isTauri()) return;
  const docId = typeof docOrId === "string" ? docOrId : docOrId.id;
  if (!docId) return;

  const existing = pendingPositionRepublish.get(docId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    pendingPositionRepublish.delete(docId);
    void (async () => {
      try {
        await ensureDocumentReplicationReady();
        const doc =
          typeof docOrId === "string" ? await getDocument(docOrId) : docOrId;
        if (doc) await publishDocument(doc);
      } catch (err) {
        console.warn(
          "[documentReplication] position republish failed",
          docId,
          err,
        );
      }
    })();
  }, POSITION_REPUBLISH_DEBOUNCE_MS);

  pendingPositionRepublish.set(docId, timer);
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

  const localDocs = useDocumentStore.getState().documents ?? [];

  // Dedupe by fileId: each book has one sync-manifest fileId shared across
  // devices, but each device originally created its own document row with its
  // own id. If a local row already exists for the same fileId under a DIFFERENT
  // id, upserting `remote` as-is would create a duplicate (one row per device
  // id). Instead, adopt the local row's id so `INSERT OR REPLACE` updates the
  // existing row in place, and preserve device-local state (filePath, reading
  // position). Falls back to the remote id when there's no local match.
  const remoteFileId = remote.fileId;
  let sameFileIdLocal = remoteFileId
    ? localDocs.find((d) => d.fileId === remoteFileId)
    : undefined;

  let local = localDocs.find((d) => d.id === docId) ?? sameFileIdLocal;

  // The replication layer can initialize before the document store has loaded
  // from SQLite on cold startup. Consult SQLite before deciding "local absent";
  // otherwise a remote row can overwrite a valid local filePath with "".
  if (!local) {
    try {
      local = (await getDocument(docId)) ?? undefined;
    } catch (err) {
      console.warn("[documentReplication] failed to load local document by id", docId, err);
    }
  }

  if (!local && remoteFileId) {
    try {
      const persistedDocs = await getDocuments();
      sameFileIdLocal = persistedDocs.find((d) => d.fileId === remoteFileId);
      local = sameFileIdLocal;
    } catch (err) {
      console.warn("[documentReplication] failed to load local documents for fileId dedupe", docId, err);
    }
  }

  // Conflict check: only write if remote is newer than local (or local absent).
  if (local) {
    const localMs = Date.parse(local.dateModified || local.dateAdded);
    const remoteMs = Date.parse(remote.dateModified || remote.dateAdded);
    if (!Number.isNaN(localMs) && !Number.isNaN(remoteMs) && remoteMs <= localMs) {
      return; // local is at least as new — don't clobber.
    }
  }

  try {
    const docToUpsert = { ...remote };
    // Reuse the local row's id when deduping by fileId (see above).
    if (local && local.id !== docToUpsert.id) {
      docToUpsert.id = local.id;
    }
    // If local exists and has a filePath, preserve it. Otherwise decide by
    // filePath kind: URL/identifier filePaths (YouTube links, web articles,
    // clipboard://, screenshot://, bundle://, …) are the document's CONTENT,
    // not a device-local filesystem location, so they must be preserved on the
    // receiver — blanking them would make the doc unopenable. True local paths
    // (e.g. /home/user/book.epub) are meaningless on other devices and get
    // cleared to "" (the file arrives separately via the file-sync layer).
    if (local && local.filePath) {
      docToUpsert.filePath = local.filePath;
    } else if (isPortableFilePath(remote.filePath, remote.fileType)) {
      docToUpsert.filePath = remote.filePath ?? "";
    } else {
      docToUpsert.filePath = "";
    }
    // Preserve device-local fields the sender intentionally strips (see
    // publishDocument): coverImageUrl is regenerated by each device from its
    // own copy of the file, and currentViewState is screen-size-specific. The
    // remote payload omits these, so without preserving them here the
    // INSERT OR REPLACE would blank the receiver's cover on every sync.
    if (local) {
      if (local.coverImageUrl) docToUpsert.coverImageUrl = local.coverImageUrl;
      if (local.coverImageSource) docToUpsert.coverImageSource = local.coverImageSource;
      if (local.currentViewState) docToUpsert.currentViewState = local.currentViewState;
    }

    await invokeCommand("upsert_synced_document", { document: docToUpsert });
    // Reload so the new row shows in the library.
    await useDocumentStore.getState().loadDocuments();
  } catch (err) {
    console.warn("[documentReplication] upsert failed", docId, err);
  }
}
