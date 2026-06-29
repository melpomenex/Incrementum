/**
 * Read-only view of the file-sync manifest for the Sync Settings panel.
 *
 * Returns the list of files known to the shared yjs FileManifest (across all
 * devices in the room) with this device's local status for each. Used by the
 * SyncFilesPanel in Settings so the user can see what's in the sync manifest —
 * the key diagnostic for "are my imported files actually registered?"
 *
 * If the manifest isn't initialized (sync disabled / not yet ready), returns
 * an empty list + a `ready: false` flag so the UI can distinguish "no files"
 * from "sync not running".
 */

import { useEffect, useState } from "react";
import { ensureFileSyncReady, getFileManifest } from "./useFileSync";
import { getCachedFile } from "./file-transfer";
import type { FileManifestEntry } from "./file-manifest";

export interface ManifestFile {
  id: string;
  filename: string;
  sizeBytes: number;
  /** "synced" if this device has the file locally, else "available". */
  status: "synced" | "available";
}

export interface FileSyncManifestState {
  ready: boolean;
  files: ManifestFile[];
}

export function useFileSyncManifest(): FileSyncManifestState {
  const [state, setState] = useState<FileSyncManifestState>({ ready: false, files: [] });

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;

    const refresh = async () => {
      try {
        await ensureFileSyncReady();
        if (cancelled) return;
        const manifest = getFileManifest();
        const entries = manifest.getAllFiles();
        const files: ManifestFile[] = [];
        for (const entry of entries) {
          const cached = await getCachedFile(entry.id).catch(() => null);
          files.push({
            id: entry.id,
            filename: entry.filename,
            sizeBytes: entry.sizeBytes,
            status: cached ? "synced" : "available",
          });
        }
        if (!cancelled) setState({ ready: true, files });
      } catch {
        if (!cancelled) setState({ ready: false, files: [] });
      }
    };

    void refresh();

    // Subscribe so the panel updates live as files are added/removed.
    (async () => {
      try {
        await ensureFileSyncReady();
        if (cancelled) return;
        const manifest = getFileManifest();
        unsub = manifest.subscribe((event) => {
          if (event.type === "file-added" || event.type === "file-removed") {
            void refresh();
          }
        });
      } catch {
        // sync not ready — leave ready: false
      }
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  return state;
}

// Re-export for convenience so Settings can read the raw entry if needed.
export type { FileManifestEntry };
