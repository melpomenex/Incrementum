/**
 * File Transfer - Binary streaming protocol for peer-to-peer file sync
 *
 * Files are transferred in chunks through the existing Yjs WebSocket connection.
 * The server acts as a pure relay - it does not store files.
 */

import { WebsocketProvider } from "y-websocket";
import { FileManifest, getDeviceId } from "./file-manifest";

/** Chunk size for file transfers (64KB) */
export const CHUNK_SIZE = 64 * 1024;

/** Message types for the file transfer protocol */
export type FileTransferMessage =
  | { type: "file-request"; fileId: string; requesterDeviceId: string; requestId: string }
  | { type: "file-response"; fileId: string; requestId: string; accepted: boolean; totalChunks: number }
  | {
      type: "file-chunk";
      fileId: string;
      requestId: string;
      chunkIndex: number;
      totalChunks: number;
      data: string;
    } // data is base64 encoded
  | { type: "file-complete"; fileId: string; requestId: string }
  | { type: "file-error"; fileId: string; requestId: string; error: string };

/** Transfer state for a file being received */
export interface InboundTransfer {
  fileId: string;
  requestId: string;
  sourceDeviceId: string;
  totalChunks: number;
  receivedChunks: Map<number, Uint8Array>;
  startedAt: number;
  lastChunkAt: number;
}

/** Transfer state for a file being sent */
export interface OutboundTransfer {
  fileId: string;
  requestId: string;
  targetDeviceId: string;
  totalChunks: number;
  sentChunks: number;
  startedAt: number;
  lastChunkAt: number;
}

/** File transfer events */
export type FileTransferEvent =
  | { type: "transfer-requested"; fileId: string; requestId: string; requesterDeviceId: string }
  | { type: "transfer-started"; fileId: string; requestId: string; direction: "inbound" | "outbound" }
  | { type: "transfer-progress"; fileId: string; requestId: string; progress: number }
  | { type: "transfer-complete"; fileId: string; requestId: string; blob: Blob }
  | { type: "transfer-error"; fileId: string; requestId: string; error: string }
  | { type: "transfer-cancelled"; fileId: string; requestId: string };

type FileTransferListener = (event: FileTransferEvent) => void;

/**
 * Manages file transfers between devices via WebSocket
 */
export class FileTransferManager {
  private provider: WebsocketProvider;
  private manifest: FileManifest;
  private deviceId: string;
  private listeners: Set<FileTransferListener> = new Set();

  // Active transfers
  private inboundTransfers: Map<string, InboundTransfer> = new Map();
  private outboundTransfers: Map<string, OutboundTransfer> = new Map();

  // File storage - maps fileId to Blob
  private localFiles: Map<string, Blob> = new Map();

  // Pending requests waiting for a source device
  private pendingRequests: Map<string, { fileId: string; resolve: (blob: Blob) => void; reject: (err: Error) => void }> =
    new Map();

  constructor(provider: WebsocketProvider, manifest: FileManifest) {
    this.provider = provider;
    this.manifest = manifest;
    this.deviceId = getDeviceId();

    // Listen for custom messages (file transfer protocol)
    this.provider.awareness.on("change", this.handleAwarenessChange.bind(this));

    // Hook into the WebSocket for binary/custom messages
    const ws = this.provider.ws;
    if (ws) {
      this.setupWebSocketHandlers(ws);
    }

    // Re-setup handlers when WebSocket reconnects
    this.provider.on("status", ({ status }: { status: string }) => {
      if (status === "connected") {
        const newWs = this.provider.ws;
        if (newWs) {
          this.setupWebSocketHandlers(newWs);
        }
      }
    });

    // Listen for manifest events to trigger pending downloads
    this.manifest.subscribe((event) => {
      if (event.type === "device-online" || event.type === "device-files-updated") {
        this.checkPendingRequests(event.hasFiles);
      }
    });
  }

  private setupWebSocketHandlers(ws: WebSocket): void {
    // We use awareness protocol's broadcast function for custom messages
    // since y-websocket doesn't have a direct custom message API
    const originalOnMessage = ws.onmessage;

    ws.onmessage = (event) => {
      // Check if this is a file transfer message (JSON with our type)
      if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data);
          if (msg && typeof msg.type === "string" && msg.type.startsWith("file-")) {
            this.handleFileTransferMessage(msg as FileTransferMessage);
            return;
          }
        } catch {
          // Not JSON, ignore
        }
      }

      // Pass through to original handler
      if (originalOnMessage) {
        originalOnMessage.call(ws, event);
      }
    };
  }

  private handleFileTransferMessage(msg: FileTransferMessage): void {
    switch (msg.type) {
      case "file-request":
        this.handleFileRequest(msg);
        break;
      case "file-response":
        this.handleFileResponse(msg);
        break;
      case "file-chunk":
        this.handleFileChunk(msg);
        break;
      case "file-complete":
        this.handleFileComplete(msg);
        break;
      case "file-error":
        this.handleFileError(msg);
        break;
    }
  }

  private handleFileRequest(msg: { type: "file-request"; fileId: string; requesterDeviceId: string; requestId: string }): void {
    const { fileId, requesterDeviceId, requestId } = msg;

    const fileBlob = this.localFiles.get(fileId);
    if (!fileBlob) {
      // We don't have it, ignore
      return;
    }

    // Notify listeners about the request
    this.emit({ type: "transfer-requested", fileId, requestId, requesterDeviceId });

    // Auto-accept for now (could add UI confirmation later)
    const totalChunks = Math.ceil(fileBlob.size / CHUNK_SIZE);
    this.sendMessage({
      type: "file-response",
      fileId,
      requestId,
      accepted: true,
      totalChunks,
    });

    this.startOutboundTransfer(fileId, requestId, requesterDeviceId, fileBlob);
  }

  private handleFileResponse(msg: { type: "file-response"; fileId: string; requestId: string; accepted: boolean; totalChunks: number }): void {
    const { fileId, requestId, accepted, totalChunks } = msg;

    // We should be waiting for this response
    const transfer = this.outboundTransfers.get(requestId);
    if (!transfer) return;

    if (!accepted) {
      this.emit({ type: "transfer-error", fileId, requestId, error: "Request rejected by source" });
      this.outboundTransfers.delete(requestId);
      return;
    }

    transfer.totalChunks = totalChunks;
    this.emit({ type: "transfer-started", fileId, requestId, direction: "outbound" });
  }

  private handleFileChunk(msg: { type: "file-chunk"; fileId: string; requestId: string; chunkIndex: number; totalChunks: number; data: string }): void {
    const { fileId, requestId, chunkIndex, totalChunks, data } = msg;

    const transfer = this.inboundTransfers.get(requestId);
    if (!transfer) {
      // Orphaned chunk, ignore
      return;
    }

    // Decode base64 chunk
    const chunkData = this.base64ToUint8Array(data);
    transfer.receivedChunks.set(chunkIndex, chunkData);
    transfer.lastChunkAt = Date.now();

    // Calculate progress
    const progress = transfer.receivedChunks.size / totalChunks;
    this.emit({ type: "transfer-progress", fileId, requestId, progress });

    if (transfer.receivedChunks.size === totalChunks) {
      this.assembleAndComplete(transfer);
    }
  }

  private handleFileComplete(msg: { type: "file-complete"; fileId: string; requestId: string }): void {
    const { requestId } = msg;
    const transfer = this.inboundTransfers.get(requestId);
    if (transfer && transfer.receivedChunks.size === transfer.totalChunks) {
      this.assembleAndComplete(transfer);
    }
  }

  private handleFileError(msg: { type: "file-error"; fileId: string; requestId: string; error: string }): void {
    const { fileId, requestId, error } = msg;
    this.emit({ type: "transfer-error", fileId, requestId, error });

    this.inboundTransfers.delete(requestId);
    this.outboundTransfers.delete(requestId);
  }

  /**
   * Register a local file for sharing
   */
  registerLocalFile(fileId: string, blob: Blob): void {
    this.localFiles.set(fileId, blob);

    const fileIds = Array.from(this.localFiles.keys());
    this.manifest.updateMyPresence(fileIds);
  }

  /**
   * Unregister a local file
   */
  unregisterLocalFile(fileId: string): void {
    this.localFiles.delete(fileId);
    const fileIds = Array.from(this.localFiles.keys());
    this.manifest.updateMyPresence(fileIds);
  }

  private async startOutboundTransfer(
    fileId: string,
    requestId: string,
    targetDeviceId: string,
    blob: Blob
  ): Promise<void> {
    const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);

    const transfer: OutboundTransfer = {
      fileId,
      requestId,
      targetDeviceId,
      totalChunks,
      sentChunks: 0,
      startedAt: Date.now(),
      lastChunkAt: Date.now(),
    };
    this.outboundTransfers.set(requestId, transfer);

    // Read and send chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, blob.size);
      const chunk = blob.slice(start, end);
      const chunkBuffer = await chunk.arrayBuffer();
      const chunkBase64 = this.uint8ArrayToBase64(new Uint8Array(chunkBuffer));

      this.sendMessage({
        type: "file-chunk",
        fileId,
        requestId,
        chunkIndex: i,
        totalChunks,
        data: chunkBase64,
      });

      transfer.sentChunks = i + 1;
      transfer.lastChunkAt = Date.now();

      // Small delay to avoid overwhelming the connection
      await this.delay(10);
    }

    // Send completion message
    this.sendMessage({
      type: "file-complete",
      fileId,
      requestId,
    });

    this.emit({ type: "transfer-complete", fileId, requestId, blob });
    this.outboundTransfers.delete(requestId);
  }

  /**
   * Request a file from other devices
   */
  async requestFile(fileId: string): Promise<Blob> {
    const local = this.localFiles.get(fileId);
    if (local) {
      return local;
    }

    const sources = this.manifest.findDevicesWithFile(fileId);
    if (sources.length === 0) {
      return new Promise((resolve, reject) => {
        this.pendingRequests.set(fileId, { fileId, resolve, reject });
      });
    }

    const requestId = `${this.deviceId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const transfer: InboundTransfer = {
      fileId,
      requestId,
      sourceDeviceId: sources[0].deviceId,
      totalChunks: 0,
      receivedChunks: new Map(),
      startedAt: Date.now(),
      lastChunkAt: Date.now(),
    };
    this.inboundTransfers.set(requestId, transfer);

    const transferPromise = new Promise<Blob>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Transfer timeout"));
        this.inboundTransfers.delete(requestId);
      }, 120000); // 2 minute overall timeout

      const unsubscribe = this.subscribe((event) => {
        if (event.requestId !== requestId) return;

        if (event.type === "transfer-complete") {
          clearTimeout(timeout);
          unsubscribe();
          resolve(event.blob);
        } else if (event.type === "transfer-error" || event.type === "transfer-cancelled") {
          clearTimeout(timeout);
          unsubscribe();
          reject(new Error(event.type === "transfer-error" ? event.error : "Transfer cancelled"));
        }
      });
    });

    // Broadcast request to all devices that have the file
    this.sendMessage({
      type: "file-request",
      fileId,
      requesterDeviceId: this.deviceId,
      requestId,
    });

    this.emit({ type: "transfer-started", fileId, requestId, direction: "inbound" });

    return transferPromise;
  }

  private assembleAndComplete(transfer: InboundTransfer): void {
    // Assemble chunks in order
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < transfer.totalChunks; i++) {
      const chunk = transfer.receivedChunks.get(i);
      if (!chunk) {
        this.emit({
          type: "transfer-error",
          fileId: transfer.fileId,
          requestId: transfer.requestId,
          error: `Missing chunk ${i}`,
        });
        this.inboundTransfers.delete(transfer.requestId);
        return;
      }
      chunks.push(chunk);
    }

    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    const entry = this.manifest.getFile(transfer.fileId);
    const blob = new Blob([combined], { type: entry?.contentType || "application/octet-stream" });

    this.localFiles.set(transfer.fileId, blob);
    this.manifest.updateMyPresence(Array.from(this.localFiles.keys()));

    this.emit({ type: "transfer-complete", fileId: transfer.fileId, requestId: transfer.requestId, blob });
    this.inboundTransfers.delete(transfer.requestId);
  }

  private checkPendingRequests(availableFiles: string[]): void {
    for (const [fileId, pending] of this.pendingRequests) {
      if (availableFiles.includes(fileId)) {
        // Source is now available, start transfer
        this.pendingRequests.delete(fileId);
        this.requestFile(fileId).then(pending.resolve).catch(pending.reject);
      }
    }
  }

  private sendMessage(msg: FileTransferMessage): void {
    if (this.provider.ws && this.provider.ws.readyState === WebSocket.OPEN) {
      this.provider.ws.send(JSON.stringify(msg));
    }
  }

  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private handleAwarenessChange(): void {
    // Awareness change - could be used for additional sync signaling
  }

  /**
   * Check if a file is available locally
   */
  hasFileLocal(fileId: string): boolean {
    return this.localFiles.has(fileId);
  }

  /**
   * Get a local file
   */
  getLocalFile(fileId: string): Blob | undefined {
    return this.localFiles.get(fileId);
  }

  /**
   * Get active transfers
   */
  getActiveTransfers(): { inbound: InboundTransfer[]; outbound: OutboundTransfer[] } {
    return {
      inbound: Array.from(this.inboundTransfers.values()),
      outbound: Array.from(this.outboundTransfers.values()),
    };
  }

  /**
   * Cancel an active transfer
   */
  cancelTransfer(requestId: string): void {
    const inbound = this.inboundTransfers.get(requestId);
    if (inbound) {
      this.sendMessage({
        type: "file-error",
        fileId: inbound.fileId,
        requestId,
        error: "Cancelled by receiver",
      });
      this.inboundTransfers.delete(requestId);
      this.emit({ type: "transfer-cancelled", fileId: inbound.fileId, requestId });
    }

    const outbound = this.outboundTransfers.get(requestId);
    if (outbound) {
      this.outboundTransfers.delete(requestId);
      this.emit({ type: "transfer-cancelled", fileId: outbound.fileId, requestId });
    }
  }

  /**
   * Mark this device as going offline
   */
  disconnect(): void {
    this.manifest.goOffline();
  }

  subscribe(listener: FileTransferListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: FileTransferEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error("[FileTransferManager] Listener error:", err);
      }
    });
  }
}

const FILE_CACHE_DB_NAME = "incrementum-file-cache";
const FILE_CACHE_STORE = "files";

/**
 * Save a file to IndexedDB cache
 */
export async function cacheFile(fileId: string, blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FILE_CACHE_DB_NAME, 1);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILE_CACHE_STORE)) {
        db.createObjectStore(FILE_CACHE_STORE);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(FILE_CACHE_STORE, "readwrite");
      const store = tx.objectStore(FILE_CACHE_STORE);
      store.put(blob, fileId);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}

/**
 * Get a file from IndexedDB cache
 */
export async function getCachedFile(fileId: string): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FILE_CACHE_DB_NAME, 1);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILE_CACHE_STORE)) {
        db.createObjectStore(FILE_CACHE_STORE);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(FILE_CACHE_STORE, "readonly");
      const store = tx.objectStore(FILE_CACHE_STORE);
      const getRequest = store.get(fileId);

      getRequest.onsuccess = () => resolve(getRequest.result || null);
      getRequest.onerror = () => reject(getRequest.error);
    };
  });
}

/**
 * Delete a file from IndexedDB cache
 */
export async function deleteCachedFile(fileId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FILE_CACHE_DB_NAME, 1);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILE_CACHE_STORE)) {
        db.createObjectStore(FILE_CACHE_STORE);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(FILE_CACHE_STORE, "readwrite");
      const store = tx.objectStore(FILE_CACHE_STORE);
      store.delete(fileId);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}

/**
 * Get all cached file IDs
 */
export async function getAllCachedFileIds(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FILE_CACHE_DB_NAME, 1);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILE_CACHE_STORE)) {
        db.createObjectStore(FILE_CACHE_STORE);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(FILE_CACHE_STORE, "readonly");
      const store = tx.objectStore(FILE_CACHE_STORE);
      const getAllKeys = store.getAllKeys();

      getAllKeys.onsuccess = () => resolve(getAllKeys.result as string[]);
      getAllKeys.onerror = () => reject(getAllKeys.error);
    };
  });
}
