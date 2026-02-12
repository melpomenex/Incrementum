/**
 * File Manifest Sync - Manages file metadata across devices via Yjs
 *
 * Files are NOT stored on the server - they are streamed in real-time
 * between devices that are online simultaneously.
 */

import * as Y from "yjs";

// =============================================================================
// Types
// =============================================================================

/**
 * Metadata for a file in the sync manifest
 */
export interface FileManifestEntry {
  /** Unique file ID (UUID) */
  id: string;
  /** Sync room ID */
  room: string;
  /** Original filename */
  filename: string;
  /** MIME type */
  contentType: string;
  /** File size in bytes */
  sizeBytes: number;
  /** SHA-256 hash of file content for integrity */
  contentHash: string;
  /** ISO timestamp when file was uploaded */
  uploadedAt: string;
  /** Device ID that uploaded the file */
  uploadedBy: string;
}

/**
 * Device presence info - tracks which devices have which files locally
 */
export interface DevicePresence {
  /** Device ID */
  deviceId: string;
  /** Timestamp of last presence update */
  lastSeen: string;
  /** Set of file IDs this device has locally */
  hasFiles: string[];
}

/**
 * Events emitted by FileManifest
 */
export type FileManifestEvent =
  | { type: "file-added"; entry: FileManifestEntry; sourceDeviceId: string }
  | { type: "file-removed"; fileId: string }
  | { type: "device-online"; deviceId: string; hasFiles: string[] }
  | { type: "device-offline"; deviceId: string }
  | { type: "device-files-updated"; deviceId: string; hasFiles: string[] };

type FileManifestListener = (event: FileManifestEvent) => void;

// =============================================================================
// FileManifest Class
// =============================================================================

const DEVICE_ID_KEY = "incrementum_device_id";

/**
 * Generate a unique device ID
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") {
    return `server-${Date.now()}`;
  }

  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    deviceId = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

/**
 * FileManifest manages file metadata synchronization across devices
 */
export class FileManifest {
  private doc: Y.Doc;
  private deviceId: string;
  private listeners: Set<FileManifestListener> = new Set();
  private knownDeviceFiles: Map<string, Set<string>> = new Map();

  // Y.js shared types
  private filesMap: Y.Map<Record<string, unknown>>;
  private devicesMap: Y.Map<Record<string, unknown>>;

  constructor(doc: Y.Doc) {
    this.doc = doc;
    this.deviceId = getDeviceId();

    // Get or create the shared maps
    this.filesMap = doc.getMap("fileManifest") as Y.Map<Record<string, unknown>>;
    this.devicesMap = doc.getMap("devicePresence") as Y.Map<Record<string, unknown>>;

    // Observe changes to files
    this.filesMap.observe((event) => {
      event.changes.keys.forEach((change, key) => {
        if (change.action === "add") {
          const entry = this.getFile(key);
          if (entry) {
            this.emit({ type: "file-added", entry, sourceDeviceId: entry.uploadedBy });
          }
        } else if (change.action === "delete") {
          this.emit({ type: "file-removed", fileId: key });
        }
      });
    });

    // Observe changes to device presence
    this.devicesMap.observe((event) => {
      event.changes.keys.forEach((change, key) => {
        if (change.action === "add" || change.action === "update") {
          const presence = this.getDevicePresence(key);
          if (presence) {
            const prevFiles = this.knownDeviceFiles.get(key) || new Set();
            const newFiles = new Set(presence.hasFiles);

            // Check if this is a new device or file list changed
            const filesChanged =
              prevFiles.size !== newFiles.size ||
              ![...prevFiles].every((f) => newFiles.has(f));

            if (change.action === "add") {
              this.emit({ type: "device-online", deviceId: key, hasFiles: presence.hasFiles });
            } else if (filesChanged) {
              this.emit({ type: "device-files-updated", deviceId: key, hasFiles: presence.hasFiles });
            }

            this.knownDeviceFiles.set(key, newFiles);
          }
        } else if (change.action === "delete") {
          this.knownDeviceFiles.delete(key);
          this.emit({ type: "device-offline", deviceId: key });
        }
      });
    });
  }

  // ===========================================================================
  // File Operations
  // ===========================================================================

  /**
   * Add a file to the manifest
   */
  addFile(entry: FileManifestEntry): void {
    this.doc.transact(() => {
      this.filesMap.set(entry.id, entry as unknown as Record<string, unknown>);
    });
  }

  /**
   * Remove a file from the manifest
   */
  removeFile(fileId: string): void {
    this.doc.transact(() => {
      this.filesMap.delete(fileId);
    });
  }

  /**
   * Get a file entry by ID
   */
  getFile(fileId: string): FileManifestEntry | null {
    const data = this.filesMap.get(fileId);
    return data ? (data as unknown as FileManifestEntry) : null;
  }

  /**
   * Get all files in the manifest
   */
  getAllFiles(): FileManifestEntry[] {
    const files: FileManifestEntry[] = [];
    this.filesMap.forEach((value) => {
      files.push(value as unknown as FileManifestEntry);
    });
    return files;
  }

  /**
   * Find files by content hash (for duplicate detection)
   */
  findByHash(contentHash: string): FileManifestEntry[] {
    return this.getAllFiles().filter((f) => f.contentHash === contentHash);
  }

  // ===========================================================================
  // Device Presence
  // ===========================================================================

  /**
   * Update this device's presence and which files it has
   */
  updateMyPresence(hasFiles: string[]): void {
    const presence: DevicePresence = {
      deviceId: this.deviceId,
      lastSeen: new Date().toISOString(),
      hasFiles,
    };
    this.devicesMap.set(this.deviceId, presence as unknown as Record<string, unknown>);
  }

  /**
   * Mark this device as offline
   */
  goOffline(): void {
    this.devicesMap.delete(this.deviceId);
  }

  /**
   * Get presence info for a device
   */
  getDevicePresence(deviceId: string): DevicePresence | null {
    const data = this.devicesMap.get(deviceId);
    return data ? (data as unknown as DevicePresence) : null;
  }

  /**
   * Get all online devices
   */
  getOnlineDevices(): DevicePresence[] {
    const devices: DevicePresence[] = [];
    this.devicesMap.forEach((value) => {
      devices.push(value as unknown as DevicePresence);
    });
    return devices;
  }

  /**
   * Get this device's ID
   */
  getDeviceId(): string {
    return this.deviceId;
  }

  /**
   * Find devices that have a specific file
   */
  findDevicesWithFile(fileId: string): DevicePresence[] {
    return this.getOnlineDevices().filter((d) => d.hasFiles.includes(fileId));
  }

  /**
   * Check if a file is available from any online device
   */
  isFileAvailable(fileId: string): boolean {
    return this.findDevicesWithFile(fileId).length > 0;
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  subscribe(listener: FileManifestListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: FileManifestEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error("[FileManifest] Listener error:", err);
      }
    });
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate SHA-256 hash of a file
 */
export async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
