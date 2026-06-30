/**
 * Hook for accessing file sync state
 */

import { useState, useEffect, useCallback } from "react";
import { FileManifest, FileManifestEntry, getDeviceId } from "./file-manifest";
import { FileTransferManager, getCachedFile, deleteCachedFile } from "./file-transfer";
import { getYjsSync, getSyncRoomId, registerRoomChangeListener } from "./yjsSync";

export type FileSyncStatus =
  | "synced" // File is stored locally
  | "available" // File exists on another online device
  | "waiting" // File exists but no device with it is online
  | "downloading" // Transfer in progress
  | "error"; // Transfer failed

export interface FileSyncState {
  status: FileSyncStatus;
  progress?: number; // 0-1 for downloads
  error?: string;
}

let manifestInstance: FileManifest | null = null;
let transferManagerInstance: FileTransferManager | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Initialize file sync (must be called before getFileManifest).
 *
 * Idempotent: safe to call from the boot path (main.tsx) and again lazily from
 * any registration/download call — the `initPromise` guard means the singletons
 * are constructed exactly once per session.
 */
export async function ensureFileSyncReady(): Promise<void> {
  const sync = await getYjsSync();
  if (manifestInstance && manifestInstance.getDoc() !== sync.doc) {
    transferManagerInstance?.dispose();
    manifestInstance = null;
    transferManagerInstance = null;
    initPromise = null;
  }

  if (manifestInstance && transferManagerInstance) return;

  if (!initPromise) {
    initPromise = (async () => {
      try {
        const sync = await getYjsSync();
        if (!manifestInstance) {
          manifestInstance = new FileManifest(sync.doc);
        }
        if (!transferManagerInstance) {
          transferManagerInstance = new FileTransferManager(sync.provider, manifestInstance);
        }
      } catch (error) {
        // CRITICAL: clear the cached promise on failure. Without this, a
        // single transient init error (e.g. getYjsSync rejecting because
        // IndexedDB is unavailable on a mobile WebView, or a race during boot)
        // permanently wedges file sync for the whole session — every later
        // ensureFileSyncReady() call returns the same rejected promise and
        // registerImportedFileSync / useFileSyncStatus can never recover.
        // Resetting lets the next call attempt init afresh.
        initPromise = null;
        console.error("[useFileSync] Failed to initialize file sync:", error);
        throw error;
      }
    })();
  }

  return initPromise;
}

/**
 * Get or create the singleton FileManifest instance
 */
export function getFileManifest(): FileManifest {
  if (!manifestInstance) {
    throw new Error("FileManifest not initialized. Call ensureFileSyncReady() first.");
  }
  return manifestInstance;
}

/**
 * Get or create the singleton FileTransferManager instance
 */
export function getFileTransferManager(): FileTransferManager {
  if (!transferManagerInstance) {
    throw new Error("FileTransferManager not initialized. Call ensureFileSyncReady() first.");
  }
  return transferManagerInstance;
}

export function useFileSyncStatus(fileId: string | null): FileSyncState {
  const [state, setState] = useState<FileSyncState>({ status: "waiting" });
  const [roomId, setRoomId] = useState(() => getSyncRoomId());

  useEffect(() => {
    return registerRoomChangeListener(() => {
      setRoomId(getSyncRoomId());
    });
  }, []);

  useEffect(() => {
    if (!fileId) {
      setState({ status: "waiting" });
      return;
    }

    let mounted = true;
    let unsubManifest: (() => void) | null = null;
    let unsubTransfer: (() => void) | null = null;

    const init = async () => {
      await ensureFileSyncReady();
      if (!mounted) return;

      const manifest = getFileManifest();
      const transferManager = getFileTransferManager();

      const checkStatus = async () => {
        if (transferManager.hasFileLocal(fileId) && mounted) {
          setState({ status: "synced" });
          return;
        }

        const cached = await getCachedFile(fileId);
        if (cached && cached.size > 0 && mounted) {
          setState({ status: "synced" });
          return;
        }
        if (cached && cached.size === 0) {
          await deleteCachedFile(fileId).catch((err) => {
            console.warn("[useFileSyncStatus] failed to delete empty cached file", fileId, err);
          });
        }

        const inManifest = manifest.getAllFiles().some((f) => f.id === fileId);
        const available = inManifest || manifest.isFileAvailable(fileId, { excludeDeviceId: manifest.getDeviceId() });
        if (mounted) {
          setState({ status: available ? "available" : "waiting" });
        }
      };

      checkStatus();

      // Subscribe to manifest changes
      unsubManifest = manifest.subscribe((event) => {
        if (
          event.type === "device-online" ||
          event.type === "device-offline" ||
          event.type === "device-files-updated" ||
          event.type === "file-added" ||
          event.type === "file-removed"
        ) {
          checkStatus();
        }
      });

      // Subscribe to transfer events
      unsubTransfer = transferManager.subscribe((event) => {
        if (event.fileId !== fileId) return;
        if (!mounted) return;

        switch (event.type) {
          case "transfer-started":
            if (event.direction === "inbound") {
              setState({ status: "downloading", progress: 0 });
            }
            break;
          case "transfer-progress":
            setState({ status: "downloading", progress: event.progress });
            break;
          case "transfer-complete":
            setState({ status: "synced" });
            break;
          case "transfer-error":
            setState({ status: "error", error: event.error });
            break;
          case "transfer-cancelled":
            checkStatus(); // Reset to previous state
            break;
        }
      });
    };

    init();

    return () => {
      mounted = false;
      unsubManifest?.();
      unsubTransfer?.();
    };
  }, [fileId, roomId]);

  return state;
}

/**
 * Hook to get all files and their sync status
 */
export function useAllFileSyncStatus(): Map<string, FileSyncState> {
  const [states, setStates] = useState<Map<string, FileSyncState>>(new Map());
  const [roomId, setRoomId] = useState(() => getSyncRoomId());

  useEffect(() => {
    return registerRoomChangeListener(() => {
      setRoomId(getSyncRoomId());
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    let unsubManifest: (() => void) | null = null;
    let unsubTransfer: (() => void) | null = null;

    const init = async () => {
      await ensureFileSyncReady();
      if (!mounted) return;

      const manifest = getFileManifest();
      const transferManager = getFileTransferManager();

      const updateStates = async () => {
        const files = manifest.getAllFiles();
        const newStates = new Map<string, FileSyncState>();

        for (const file of files) {
          const isLocal = transferManager.hasFileLocal(file.id);
          const cached = isLocal ? null : await getCachedFile(file.id);
          if (cached && cached.size === 0) {
            await deleteCachedFile(file.id).catch((err) => {
              console.warn("[useAllFileSyncStatus] failed to delete empty cached file", file.id, err);
            });
          }
          const available = manifest.isFileAvailable(file.id, { excludeDeviceId: manifest.getDeviceId() });

          if (isLocal || (cached && cached.size > 0)) {
            newStates.set(file.id, { status: "synced" });
          } else if (available) {
            newStates.set(file.id, { status: "available" });
          } else {
            newStates.set(file.id, { status: "waiting" });
          }
        }

        if (mounted) {
          setStates(newStates);
        }
      };

      updateStates();

      unsubManifest = manifest.subscribe((event) => {
        if (event.type === "file-added" || event.type === "file-removed") {
          updateStates();
        }
        if (event.type === "device-online" || event.type === "device-offline" || event.type === "device-files-updated") {
          updateStates();
        }
      });

      unsubTransfer = transferManager.subscribe((event) => {
        setStates((prev) => {
          const next = new Map(prev);
          switch (event.type) {
            case "transfer-started":
              if (event.direction === "inbound") {
                next.set(event.fileId, { status: "downloading", progress: 0 });
              }
              break;
            case "transfer-progress":
              next.set(event.fileId, { status: "downloading", progress: event.progress });
              break;
            case "transfer-complete":
              next.set(event.fileId, { status: "synced" });
              break;
            case "transfer-error":
              next.set(event.fileId, { status: "error", error: event.error });
              break;
          }
          return next;
        });
      });
    };

    init();

    return () => {
      mounted = false;
      unsubManifest?.();
      unsubTransfer?.();
    };
  }, [roomId]);

  return states;
}

/**
 * Hook to trigger file download
 */
export function useFileDownloader() {
  const downloadFile = useCallback(async (fileId: string): Promise<Blob | null> => {
    await ensureFileSyncReady();
    const transferManager = getFileTransferManager();

    const local = transferManager.getLocalFile(fileId);
    if (local) {
      return local;
    }

    // Request from other devices
    try {
      const blob = await transferManager.requestFile(fileId);
      return blob;
    } catch (err) {
      console.error("[useFileDownloader] Download failed:", err);
      return null;
    }
  }, []);

  return downloadFile;
}

/**
 * Hook to register a local file for sync
 */
export function useFileUploader() {
  const uploadFile = useCallback(
    async (file: File): Promise<FileManifestEntry> => {
      await ensureFileSyncReady();
      const manifest = getFileManifest();
      const transferManager = getFileTransferManager();

      // Calculate hash
      const { calculateFileHash } = await import("./file-manifest");
      const contentHash = await calculateFileHash(file);

      const existing = manifest.findByHash(contentHash);
      if (existing.length > 0) {
        // File already exists with same content
        return existing[0];
      }

      const fileId = crypto.randomUUID();
      const entry: FileManifestEntry = {
        id: fileId,
        room: manifest.getDeviceId(), // Using device ID as room for now
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        contentHash,
        uploadedAt: new Date().toISOString(),
        uploadedBy: getDeviceId(),
      };

      // Add to manifest
      manifest.addFile(entry);

      // Register locally for serving to other devices
      transferManager.registerLocalFile(fileId, file);

      return entry;
    },
    []
  );

  return uploadFile;
}
