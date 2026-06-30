/**
 * File Transfer - Binary streaming protocol for peer-to-peer file sync
 *
 * Files are transferred in chunks through the existing Yjs WebSocket connection.
 * The server acts as a pure relay - it does not store files.
 *
 * Wire format (all binary, no JSON, no base64):
 *   Every frame is `[0x20][1-byte subtype][subtype-specific bytes]`.
 *   0x20 is a custom message-type byte that the forked y-websocket relay's
 *   `default:` case forwards verbatim to all other connections in the room
 *   (see yjs-sync/utils.js messageListener). It is intentionally NOT a
 *   y-websocket type (0=sync, 1=awareness, 2=auth, 3=query-awareness) and NOT
 *   0x10 (encrypted-sync), so the encrypted provider leaves these frames
 *   untouched on both send and receive paths.
 *
 * Subtypes:
 *   0x01 file-request   [u32 requestIdLen][requestId][u32 fileIdLen][fileId]
 *   0x02 file-response  [u32 requestIdLen][requestId][u8 accepted][u32 totalChunks]
 *   0x03 file-chunk     [u32 requestIdLen][requestId][u32 chunkIndex][u32 totalChunks][raw bytes...]
 *   0x04 file-complete  [u32 requestIdLen][requestId]
 *   0x05 file-error     [u32 requestIdLen][requestId][u32 msgLen][utf8 message]
 *
 * `u32` = 4-byte little-endian unsigned int. String lengths are byte lengths
 * (UTF-8). Chunk data is appended raw after the header — no base64, so a 64KB
 * chunk is 64KB on the wire, not ~85KB.
 */

import { WebsocketProvider } from "y-websocket";
import { FileManifest, getDeviceId } from "./file-manifest";
import { getSyncRoomId } from "./yjsSync";
import { downloadRoomFile } from "./yjs-file-service";

/** Wire message-type byte for the file-transfer protocol. */
const FILE_TRANSFER_TYPE = 0x20;

/** Subtype bytes (second byte of every frame, after FILE_TRANSFER_TYPE). */
const SUBTYPE = {
  REQUEST: 0x01,
  RESPONSE: 0x02,
  CHUNK: 0x03,
  COMPLETE: 0x04,
  ERROR: 0x05,
} as const;

/** Chunk size for file transfers (64KB of payload per chunk frame). */
export const CHUNK_SIZE = 64 * 1024;

/** Decoded file-transfer control message (used internally + in tests). */
// fileId is optional on the non-request variants because the wire protocol
// only carries requestId there — the handler resolves fileId via the transfer
// record (inboundTransfers/outboundTransfers) keyed on requestId. Encoding a
// response/complete/error also only needs requestId, so callers build these
// without fileId.
export type FileTransferMessage =
  | { type: "file-request"; fileId: string; requesterDeviceId: string; requestId: string }
  | { type: "file-response"; fileId?: string; requestId: string; accepted: boolean; totalChunks: number }
  | {
      type: "file-chunk";
      fileId?: string;
      requestId: string;
      chunkIndex: number;
      totalChunks: number;
      data: Uint8Array;
    }
  | { type: "file-complete"; fileId?: string; requestId: string }
  | { type: "file-error"; fileId?: string; requestId: string; error: string };

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

// ─── Binary codec helpers ───────────────────────────────────────────────────
// Tiny length-prefixed encoder/decoder. We avoid lib0 here because these
// frames are NOT y-websocket sync frames — they ride the relay's opaque
// forwarding path, so a self-contained format keeps the protocol decoupled
// from y-protocol versioning and is easy to test in isolation.

function writeU32LE(bytes: number[], value: number): void {
  // value >>> 0 coerces to uint32; safe for lengths up to 4GB.
  const v = value >>> 0;
  bytes.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
}

function readU32LE(view: Uint8Array, offset: number): number {
  // Bounds-check: a truncated frame must not silently read 0 (which would
  // produce a valid-looking but wrong message). Let the decoder's catch
  // convert this to a null drop.
  if (offset < 0 || offset + 4 > view.length) {
    throw new RangeError("readU32LE: out of bounds");
  }
  return (
    (view[offset] |
      (view[offset + 1] << 8) |
      (view[offset + 2] << 16) |
      (view[offset + 3] << 24)) >>>
    0
  );
}

function writeUtf8(bytes: number[], str: string): void {
  const encoded = new TextEncoder().encode(str);
  writeU32LE(bytes, encoded.length);
  for (let i = 0; i < encoded.length; i++) bytes.push(encoded[i]);
}

function readUtf8(view: Uint8Array, offset: number): { value: string; next: number } {
  const len = readU32LE(view, offset);
  const start = offset + 4;
  const value = new TextDecoder().decode(view.subarray(start, start + len));
  return { value, next: start + len };
}

/**
 * Encode a control message (all subtypes except chunk) to a binary frame.
 * Chunk messages are encoded separately by `encodeChunkFrame` because their
 * payload is raw bytes, not a string.
 */
function encodeControlFrame(msg: FileTransferMessage): Uint8Array {
  const bytes: number[] = [FILE_TRANSFER_TYPE];
  switch (msg.type) {
    case "file-request":
      bytes.push(SUBTYPE.REQUEST);
      writeUtf8(bytes, msg.requestId);
      writeUtf8(bytes, msg.fileId);
      writeUtf8(bytes, msg.requesterDeviceId);
      break;
    case "file-response":
      bytes.push(SUBTYPE.RESPONSE);
      writeUtf8(bytes, msg.requestId);
      bytes.push(msg.accepted ? 1 : 0);
      writeU32LE(bytes, msg.totalChunks);
      break;
    case "file-complete":
      bytes.push(SUBTYPE.COMPLETE);
      writeUtf8(bytes, msg.requestId);
      break;
    case "file-error":
      bytes.push(SUBTYPE.ERROR);
      writeUtf8(bytes, msg.requestId);
      writeUtf8(bytes, msg.error);
      break;
    default:
      throw new Error(`encodeControlFrame: not a control message: ${(msg as FileTransferMessage).type}`);
  }
  return new Uint8Array(bytes);
}

/**
 * Encode a chunk frame. Layout:
 *   [0x20][0x03][u32 requestIdLen][requestId][u32 chunkIndex][u32 totalChunks][raw data]
 */
function encodeChunkFrame(
  requestId: string,
  chunkIndex: number,
  totalChunks: number,
  data: Uint8Array,
): Uint8Array {
  const encReqId = new TextEncoder().encode(requestId);
  // header: type + subtype + reqIdLen + reqId + chunkIndex + totalChunks
  const headerLen = 1 + 1 + 4 + encReqId.length + 4 + 4;
  const frame = new Uint8Array(headerLen + data.length);
  let p = 0;
  frame[p++] = FILE_TRANSFER_TYPE;
  frame[p++] = SUBTYPE.CHUNK;
  frame.set(u32Bytes(encReqId.length), p); p += 4;
  frame.set(encReqId, p); p += encReqId.length;
  frame.set(u32Bytes(chunkIndex), p); p += 4;
  frame.set(u32Bytes(totalChunks), p); p += 4;
  frame.set(data, p);
  return frame;
}

function u32Bytes(value: number): Uint8Array {
  const v = value >>> 0;
  return new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]);
}

/**
 * Decode an inbound frame into a FileTransferMessage, or null if the frame is
 * not a file-transfer frame (byte 0 !== 0x20). Throws on truncated/malformed
 * frames — callers should catch and drop, since a malformed peer frame must
 * never crash the sync stack.
 */
export function decodeFileTransferFrame(data: Uint8Array): FileTransferMessage | null {
  if (data.length < 2 || data[0] !== FILE_TRANSFER_TYPE) return null;
  const subtype = data[1];
  try {
    switch (subtype) {
      case SUBTYPE.REQUEST: {
        let off = 2;
        const req = readUtf8(data, off); off = req.next;
        const fid = readUtf8(data, off); off = fid.next;
        const dev = readUtf8(data, off);
        return { type: "file-request", requestId: req.value, fileId: fid.value, requesterDeviceId: dev.value };
      }
      case SUBTYPE.RESPONSE: {
        let off = 2;
        const req = readUtf8(data, off); off = req.next;
        const accepted = data[off] !== 0; off += 1;
        const totalChunks = readU32LE(data, off);
        return { type: "file-response", requestId: req.value, accepted, totalChunks };
      }
      case SUBTYPE.CHUNK: {
        let off = 2;
        const req = readUtf8(data, off); off = req.next;
        const chunkIndex = readU32LE(data, off); off += 4;
        const totalChunks = readU32LE(data, off); off += 4;
        const chunkData = data.subarray(off);
        return { type: "file-chunk", requestId: req.value, chunkIndex, totalChunks, data: chunkData };
      }
      case SUBTYPE.COMPLETE: {
        const req = readUtf8(data, 2);
        return { type: "file-complete", requestId: req.value };
      }
      case SUBTYPE.ERROR: {
        let off = 2;
        const req = readUtf8(data, off); off = req.next;
        const errMsg = readUtf8(data, off);
        return { type: "file-error", requestId: req.value, error: errMsg.value };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
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

  // File storage - maps fileId to Blob. Populated eagerly for received files
  // (rehydrated from cache) and lazily for locally-owned files via loaders.
  private localFiles: Map<string, Blob> = new Map();

  // Lazy loaders for locally-owned files (e.g. imported documents on disk).
  // The bytes are fetched on demand only when a peer requests the file, so the
  // app doesn't hold every document's full content in RAM for the session.
  private localFileLoaders: Map<string, () => Promise<Blob>> = new Map();

  // Pending requests waiting for a source device
  private pendingRequests: Map<string, { fileId: string; resolve: (blob: Blob) => void; reject: (err: Error) => void }> =
    new Map();

  private presenceHeartbeat: ReturnType<typeof setInterval> | null = null;

  constructor(provider: WebsocketProvider, manifest: FileManifest) {
    this.provider = provider;
    this.manifest = manifest;
    this.deviceId = getDeviceId();

    // Rehydrate previously-received files from the IndexedDB cache so this
    // device can serve them to peers and the UI shows them as "synced" right
    // after launch instead of "waiting".
    void this.rehydrateCachedFiles();

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

    this.refreshPresence();
    this.presenceHeartbeat = setInterval(() => {
      this.refreshPresence();
    }, 30000);
  }

  /**
   * Load every cached file Blob into the in-memory localFiles map. Run once at
   * construction. Failures are non-fatal — a missing cache just means the
   * device can't seed that file until it's re-fetched.
   */
  private async rehydrateCachedFiles(): Promise<void> {
    try {
      const ids = await getAllCachedFileIds();
      for (const id of ids) {
        const blob = await getCachedFile(id);
        if (blob && blob.size > 0) {
          this.localFiles.set(id, blob);
        } else if (blob && blob.size === 0) {
          await deleteCachedFile(id);
        }
      }
      if (this.localFiles.size > 0) {
        this.refreshPresence();
      }
    } catch (err) {
      console.warn("[FileTransferManager] failed to rehydrate cached files", err);
    }
  }

  private setupWebSocketHandlers(ws: WebSocket): void {
    // Intercept inbound binary frames that carry our file-transfer protocol
    // (type byte 0x20). All other frames (yjs sync/awareness binary, any text)
    // pass through to the original handler y-websocket installed.
    const originalOnMessage = ws.onmessage;

    ws.onmessage = (event) => {
      const data = event.data;
      // Our frames are always binary ArrayBuffers/BlobViews. y-websocket also
      // sends binary, so we must peek byte 0 to distinguish: 0x20 = ours.
      if (data instanceof ArrayBuffer) {
        const bytes = new Uint8Array(data);
        if (bytes.length >= 2 && bytes[0] === FILE_TRANSFER_TYPE) {
          const msg = decodeFileTransferFrame(bytes);
          if (msg) {
            this.handleFileTransferMessage(msg);
          }
          return;
        }
      }
      // Not ours — hand to y-websocket's handler.
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

    if (requesterDeviceId === this.deviceId) {
      return;
    }

    const fileBlob = this.localFiles.get(fileId);
    const loader = this.localFileLoaders.get(fileId);
    if (!fileBlob && !loader) {
      // We don't have it (neither eager nor lazy), ignore. If our own
      // presence somehow listed it, refresh so peers stop requesting us.
      const presence = this.manifest.getDevicePresence(this.deviceId);
      if (presence?.hasFiles.includes(fileId)) {
        this.refreshPresence();
      }
      return;
    }

    // Notify listeners about the request
    this.emit({ type: "transfer-requested", fileId, requestId, requesterDeviceId });

    // Resolve the blob: use the eager copy if present, otherwise invoke the
    // lazy loader to read bytes from disk on demand. The actual transfer
    // (chunking + sending) only happens once we have the bytes.
    const resolveAndSend = async (blob: Blob) => {
      if (blob.size === 0) {
        this.localFiles.delete(fileId);
        this.localFileLoaders.delete(fileId);
        this.refreshPresence();
        void deleteCachedFile(fileId).catch((err) => {
          console.warn("[FileTransferManager] failed to delete empty cached file", fileId, err);
        });
        this.sendMessage({
          type: "file-error",
          fileId,
          requestId,
          error: "Source file is empty",
        });
        return;
      }
      const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);
      this.sendMessage({
        type: "file-response",
        fileId,
        requestId,
        accepted: true,
        totalChunks,
      });
      await this.startOutboundTransfer(fileId, requestId, requesterDeviceId, blob);
    };

    if (fileBlob) {
      if (fileBlob.size === 0) {
        this.localFiles.delete(fileId);
        this.refreshPresence();
        void deleteCachedFile(fileId).catch((err) => {
          console.warn("[FileTransferManager] failed to delete empty cached file", fileId, err);
        });
        this.sendMessage({
          type: "file-error",
          fileId,
          requestId,
          error: "Source file is empty",
        });
      } else {
        void resolveAndSend(fileBlob);
      }
    } else if (loader) {
      loader()
        .then((blob) => resolveAndSend(blob))
        .catch((err) => {
          console.warn("[FileTransferManager] lazy loader failed for", fileId, err);
          this.sendMessage({
            type: "file-error",
            fileId,
            requestId,
            error: `Source could not read file: ${(err as Error).message}`,
          });
        });
    }
  }

  private handleFileResponse(msg: { type: "file-response"; fileId?: string; requestId: string; accepted: boolean; totalChunks: number }): void {
    const { requestId, accepted, totalChunks } = msg;

    // The requester is receiving a source's acceptance. This must update the
    // inbound transfer record created by requestFile(); otherwise completion
    // assembles against the initial 0 chunk count.
    const transfer = this.inboundTransfers.get(requestId);
    if (!transfer) return;

    if (!accepted) {
      this.emit({ type: "transfer-error", fileId: transfer.fileId, requestId, error: "Request rejected by source" });
      this.inboundTransfers.delete(requestId);
      return;
    }

    if (totalChunks <= 0) {
      this.emit({ type: "transfer-error", fileId: transfer.fileId, requestId, error: "Source returned an empty file" });
      this.inboundTransfers.delete(requestId);
      return;
    }

    transfer.totalChunks = totalChunks;
    this.emit({ type: "transfer-started", fileId: transfer.fileId, requestId, direction: "inbound" });
  }

  private handleFileChunk(msg: {
    type: "file-chunk";
    requestId: string;
    chunkIndex: number;
    totalChunks: number;
    data: Uint8Array;
  }): void {
    const { requestId, chunkIndex, totalChunks, data } = msg;
    // The decoder returns a subarray view into the frame buffer; copy it so the
    // chunk outlives the pooled receive buffer and is safe to retain in the map.
    const chunkData = data.slice();

    const transfer = this.inboundTransfers.get(requestId);
    if (!transfer) {
      // Orphaned chunk, ignore
      return;
    }

    if (totalChunks <= 0 || chunkIndex >= totalChunks || chunkData.length === 0) {
      this.emit({
        type: "transfer-error",
        fileId: transfer.fileId,
        requestId,
        error: "Invalid file chunk received",
      });
      this.inboundTransfers.delete(requestId);
      return;
    }

    if (transfer.totalChunks === 0) {
      transfer.totalChunks = totalChunks;
    } else if (transfer.totalChunks !== totalChunks) {
      this.emit({
        type: "transfer-error",
        fileId: transfer.fileId,
        requestId,
        error: "Inconsistent chunk count received",
      });
      this.inboundTransfers.delete(requestId);
      return;
    }

    transfer.receivedChunks.set(chunkIndex, chunkData);
    transfer.lastChunkAt = Date.now();

    // Calculate progress
    const progress = transfer.receivedChunks.size / transfer.totalChunks;
    this.emit({ type: "transfer-progress", fileId: transfer.fileId, requestId, progress });

    if (transfer.receivedChunks.size === transfer.totalChunks) {
      this.assembleAndComplete(transfer);
    }
  }

  private handleFileComplete(msg: { type: "file-complete"; fileId?: string; requestId: string }): void {
    const { requestId } = msg;
    const transfer = this.inboundTransfers.get(requestId);
    if (transfer && transfer.receivedChunks.size === transfer.totalChunks) {
      this.assembleAndComplete(transfer);
    }
  }

  private handleFileError(msg: { type: "file-error"; fileId?: string; requestId: string; error: string }): void {
    const { requestId, error } = msg;
    // Resolve fileId from whichever transfer record holds it; the wire error
    // frame carries only requestId.
    const inTx = this.inboundTransfers.get(requestId);
    const outTx = this.outboundTransfers.get(requestId);
    const fileId = msg.fileId ?? inTx?.fileId ?? outTx?.fileId ?? "";
    this.emit({ type: "transfer-error", fileId, requestId, error });

    this.inboundTransfers.delete(requestId);
    this.outboundTransfers.delete(requestId);
  }

  /**
   * Register a local file for sharing with its bytes already in memory.
   * Use {@link registerLocalFileLoader} for files that live on disk to avoid
   * holding every document's content in RAM for the whole session.
   */
  registerLocalFile(fileId: string, blob: Blob): void {
    if (blob.size === 0) {
      this.localFiles.delete(fileId);
      this.refreshPresence();
      void deleteCachedFile(fileId).catch((err) => {
        console.warn("[FileTransferManager] failed to delete empty cached file", fileId, err);
      });
      return;
    }

    this.localFiles.set(fileId, blob);
    this.localFileLoaders.delete(fileId);
    this.refreshPresence();
  }

  /**
   * Register a lazy loader for a locally-owned file. The loader is invoked only
   * when a peer actually requests the file (in handleFileRequest), so the bytes
   * are read from disk on demand and discarded after the transfer. This is the
   * preferred registration path for imported documents, whose full content must
   * not be pinned in memory.
   */
  registerLocalFileLoader(fileId: string, loader: () => Promise<Blob>): void {
    this.localFileLoaders.set(fileId, loader);
    // If we previously had an in-memory copy, drop it — the loader is now the
    // source of truth, and we don't want to advertise/serve a stale blob.
    this.localFiles.delete(fileId);
    this.refreshPresence();
  }

  /**
   * All file IDs this device can serve — eager blobs + lazy loaders. This is
   * what we advertise in our presence so peers know what they can request.
   */
  private allOwnedFileIds(): string[] {
    const ids = new Set<string>(this.localFiles.keys());
    for (const id of this.localFileLoaders.keys()) ids.add(id);
    return Array.from(ids);
  }

  /**
   * Unregister a local file
   */
  unregisterLocalFile(fileId: string): void {
    this.localFiles.delete(fileId);
    this.localFileLoaders.delete(fileId);
    this.refreshPresence();
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

    // Read and send chunks. Raw bytes on the wire — no base64 — via the binary
    // chunk frame encoder.
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, blob.size);
      const chunkBuffer = await blob.slice(start, end).arrayBuffer();
      const chunkBytes = new Uint8Array(chunkBuffer);

      this.sendFrame(
        encodeChunkFrame(requestId, i, totalChunks, chunkBytes),
      );

      transfer.sentChunks = i + 1;
      transfer.lastChunkAt = Date.now();

      // Small delay to avoid overwhelming the relay / backpressuring the WS.
      // Chunk frames carry 64KB each; yielding lets the event loop drain sends.
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
    if (local && local.size > 0) {
      return local;
    }
    if (local && local.size === 0) {
      this.localFiles.delete(fileId);
      this.refreshPresence();
      void deleteCachedFile(fileId).catch((err) => {
        console.warn("[FileTransferManager] failed to delete empty cached file", fileId, err);
      });
    }

    // Try downloading from the HTTP file-service first (server-backed async sync)
    try {
      const room = getSyncRoomId();
      const blob = await downloadRoomFile(room, fileId);
      if (blob && blob.size > 0) {
        this.localFiles.set(fileId, blob);
        this.refreshPresence();
        await cacheFile(fileId, blob).catch((e) => {
          console.warn("[FileTransferManager] failed to cache downloaded file", fileId, e);
        });
        return blob;
      }
    } catch (downloadErr) {
      console.log("[FileTransferManager] file-service download failed or not on server, falling back to P2P:", downloadErr);
    }

    const sources = this.manifest.findDevicesWithFile(fileId, { excludeDeviceId: this.deviceId });
    if (sources.length === 0) {
      throw new Error("No online device currently has this file");
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
    if (totalLength === 0) {
      this.emit({
        type: "transfer-error",
        fileId: transfer.fileId,
        requestId: transfer.requestId,
        error: "Received empty file",
      });
      this.inboundTransfers.delete(transfer.requestId);
      return;
    }

    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    const entry = this.manifest.getFile(transfer.fileId);
    const blob = new Blob([combined], { type: entry?.contentType || "application/octet-stream" });

    this.localFiles.set(transfer.fileId, blob);
    this.refreshPresence();

    // Persist to IndexedDB so the file survives a reload. Without this, a
    // received file lived only in this manager's in-memory map and was lost
    // the moment the app closed — leaving the UI stuck on "waiting" forever.
    cacheFile(transfer.fileId, blob).catch((err) => {
      console.warn("[FileTransferManager] failed to cache received file", transfer.fileId, err);
    });

    this.emit({ type: "transfer-complete", fileId: transfer.fileId, requestId: transfer.requestId, blob });
    this.inboundTransfers.delete(transfer.requestId);
  }

  private checkPendingRequests(availableFiles: string[]): void {
    for (const [fileId, pending] of this.pendingRequests) {
      const hasRemoteSource =
        availableFiles.includes(fileId) &&
        this.manifest.isFileAvailable(fileId, { excludeDeviceId: this.deviceId });
      if (hasRemoteSource) {
        // Source is now available, start transfer
        this.pendingRequests.delete(fileId);
        this.requestFile(fileId).then(pending.resolve).catch(pending.reject);
      }
    }
  }

  private refreshPresence(): void {
    this.manifest.updateMyPresence(this.allOwnedFileIds());
  }

  private sendMessage(msg: FileTransferMessage): void {
    if (msg.type === "file-chunk") {
      // Chunks go through encodeChunkFrame (raw bytes); sendMessage is for
      // control messages only. This branch is defensive — the outbound path
      // calls sendFrame(encodeChunkFrame(...)) directly.
      this.sendFrame(
        encodeChunkFrame(msg.requestId, msg.chunkIndex, msg.totalChunks, msg.data),
      );
      return;
    }
    this.sendFrame(encodeControlFrame(msg));
  }

  /**
   * Send a fully-encoded binary frame on the live WebSocket. No-op if the
   * socket isn't OPEN (the caller may retry on reconnect for control frames;
   * chunk sends are part of a transfer that the peer can re-request).
   */
  private sendFrame(frame: Uint8Array): void {
    const ws = this.provider.ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(frame);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private handleAwarenessChange(): void {
    // Awareness change - could be used for additional sync signaling
  }

  /**
   * Check if a file is available locally (eager blob or lazy loader).
   */
  hasFileLocal(fileId: string): boolean {
    return this.localFiles.has(fileId) || this.localFileLoaders.has(fileId);
  }

  /**
   * Get a local file's blob if eagerly loaded. Returns undefined for lazy-
   * loader files (their bytes aren't in memory) — callers that need the bytes
   * should go through requestFile, which invokes the loader.
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
    this.stopPresenceHeartbeat();
    this.manifest.goOffline();
  }

  dispose(): void {
    this.disconnect();
    for (const pending of this.pendingRequests.values()) {
      pending.reject(new Error("File sync was reset"));
    }
    this.listeners.clear();
    this.inboundTransfers.clear();
    this.outboundTransfers.clear();
    this.pendingRequests.clear();
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

  private stopPresenceHeartbeat(): void {
    if (this.presenceHeartbeat) {
      clearInterval(this.presenceHeartbeat);
      this.presenceHeartbeat = null;
    }
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
