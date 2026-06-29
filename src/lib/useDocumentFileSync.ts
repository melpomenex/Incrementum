/**
 * Per-document file-sync hook.
 *
 * Bridges a `Document` (which may carry a `fileId`) to the file-sync subsystem
 * (`useFileSyncStatus` + `useFileDownloader`), and extends the plain download
 * path with disk persistence via `saveReceivedFileSync` so a received file
 * actually lands in app storage and the document's `filePath` gets updated —
 * without that, a downloaded file lives only in the transfer manager's
 * in-memory map and the viewer still can't open it.
 *
 * Returns null when the document has no `fileId` (sync not applicable — e.g.
 * documents imported before file sync, or YouTube/URL documents with no local
 * file), so callers can early-return and skip rendering an indicator.
 */

import { useCallback } from "react";
import { useFileSyncStatus, ensureFileSyncReady, getFileTransferManager } from "./useFileSync";
import { saveReceivedFileSync } from "./fileSyncRegistration";
import type { Document } from "../types";
import { useDocumentStore } from "../stores/documentStore";

export interface DocumentFileSyncState {
  status: ReturnType<typeof useFileSyncStatus>["status"];
  progress?: number;
  error?: string;
  /** Trigger a download (and persist to disk) for this document's file. */
  download: () => Promise<void>;
}

export function useDocumentFileSync(doc: Document | null | undefined): DocumentFileSyncState | null {
  const fileId = doc?.fileId;
  const docId = doc?.id;
  const fileType = doc?.fileType;
  const title = doc?.title;
  const syncState = useFileSyncStatus(fileId ?? null);

  const download = useCallback(async () => {
    if (!fileId || !docId || !fileType || !title) return;
    try {
      await ensureFileSyncReady();
      const transferManager = getFileTransferManager();
      const blob = await transferManager.requestFile(fileId);
      // Persist to disk + update the document's filePath so the viewer can open it.
      const storedPath = await saveReceivedFileSync(docId, fileId, blob, fileType, title);
      if (storedPath) {
        // Update the store so the UI reflects the now-local file immediately.
        useDocumentStore.setState((state) => ({
          documents: state.documents.map((d) =>
            d.id === docId ? { ...d, filePath: storedPath } : d,
          ),
        }));
      }
    } catch (err) {
      console.error("[useDocumentFileSync] download failed", docId, err);
    }
  }, [fileId, docId, fileType, title]);

  if (!fileId) return null;
  return {
    status: syncState.status,
    progress: syncState.progress,
    error: syncState.error,
    download,
  };
}
