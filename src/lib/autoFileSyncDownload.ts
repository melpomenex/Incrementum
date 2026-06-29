/**
 * Auto-download controller for file sync.
 *
 * Honors the `sync.autoDownloadMode` setting ("always" | "wifi-only" | "manual")
 * by subscribing to manifest events. When a file appears on another device and
 * the mode allows, the file is fetched + persisted automatically. "manual"
 * disables this entirely (the user taps Download in the UI).
 *
 * The mapping from manifest `fileId` → document (needed to persist + update
 * filePath) is resolved via the document store's `fileId` index. Files that
 * don't correspond to a known document on this device are skipped — they may
 * be pre-import manifests from a device this one hasn't synced state with yet.
 */

import type { FileManifestEvent } from "./file-manifest";
import { getFileManifest, ensureFileSyncReady, getFileTransferManager } from "./useFileSync";
import { saveReceivedFileSync } from "./fileSyncRegistration";
import { useSettingsStore } from "../stores/settingsStore";
import { useDocumentStore } from "../stores/documentStore";

let started = false;
// Retained for a future stop()/restart() API; intentionally not read yet.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let unsubscribe: (() => void) | null = null;

/**
 * Begin watching the manifest for newly-available files and auto-download them
 * per the user's setting. Idempotent — safe to call from the boot path and
 * again if sync reinitializes. The subscription lives for the session.
 */
export async function startAutoFileSyncDownload(): Promise<void> {
  if (started) return;
  try {
    await ensureFileSyncReady();
  } catch (err) {
    console.warn("[autoFileSyncDownload] sync not ready, deferring", err);
    return;
  }

  const manifest = getFileManifest();
  started = true;

  unsubscribe = manifest.subscribe((event: FileManifestEvent) => {
    if (event.type !== "device-online" && event.type !== "device-files-updated") {
      return;
    }
    // Re-evaluate on any availability change — a device came online or
    // announced its file list. The setting is read fresh each time so the
    // user can toggle it without a restart.
    void maybeAutoDownload(event.hasFiles);
  });
}

async function maybeAutoDownload(availableFileIds: string[]): Promise<void> {
  if (!availableFileIds || availableFileIds.length === 0) return;

  const mode = useSettingsStore.getState().settings.sync?.autoDownloadMode ?? "wifi-only";
  if (mode === "manual") return;
  if (mode === "wifi-only" && !(await isOnWifi())) return;
  // mode === "always" → proceed unconditionally

  const documents = useDocumentStore.getState().documents;
  const transferManager = getFileTransferManager();

  for (const fileId of availableFileIds) {
    // Skip files we already have locally (in-memory map or cached).
    if (transferManager.hasFileLocal(fileId)) continue;

    // Find the document this file belongs to on this device (needed to persist
    // + update filePath). If we don't know about it yet, skip — it'll be
    // handled once state-sync delivers the document row.
    const doc = documents.find((d) => d.fileId === fileId);
    if (!doc) continue;

    try {
      const blob = await transferManager.requestFile(fileId);
      const storedPath = await saveReceivedFileSync(doc.id, fileId, blob, doc.fileType, doc.title);
      if (storedPath) {
        useDocumentStore.setState((state) => ({
          documents: state.documents.map((d) =>
            d.id === doc.id ? { ...d, filePath: storedPath } : d,
          ),
        }));
      }
    } catch (err) {
      console.warn("[autoFileSyncDownload] auto-download failed", fileId, err);
    }
  }
}

/**
 * Best-effort WiFi detection. On Tauri mobile we can't easily query connection
 * type from the WebView without a plugin, so we use the browser's
 * `navigator.connection.effectiveType` / `type` when available and fall back to
 * true (allow downloads) when unknown — the user explicitly chose "wifi-only"
 * and we shouldn't silently block them on networks we can't classify.
 */
async function isOnWifi(): Promise<boolean> {
  const conn = (navigator as unknown as { connection?: { type?: string; effectiveType?: string } }).connection;
  if (conn) {
    // 'type' is the most explicit (experimental but supported in Chromium WebView).
    if (conn.type) return conn.type === "wifi";
    // effectiveType ('4g' etc.) is a rough proxy — treat anything not cellular
    // as wifi-friendly. Conservative: only block on known slow cellular.
    if (conn.effectiveType) {
      return !["slow-2g", "2g"].includes(conn.effectiveType);
    }
  }
  // Unknown → assume wifi to avoid dead-locking the user's chosen mode.
  return true;
}
