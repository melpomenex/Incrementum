import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { IndexeddbPersistence } from "y-indexeddb";
import { EncryptedWebsocketProvider } from "./sync/encryptedProvider";
import { getCachedSubKeys } from "./sync/roomCrypto";

type YjsSyncState = {
  doc: Y.Doc;
  provider: WebsocketProvider;
  persistence: IndexeddbPersistence;
  url: string;
  room: string;
  encrypted: boolean;
  /** Detaches the visibilitychange listener added in getYjsSync. Null when no
   *  listener was attached (e.g. no document, or persistence-less build). */
  visibilityCleanup: (() => void) | null;
};

const DEFAULT_SYNC_URL = "wss://sync.readsync.org";
const ROOM_KEY = "incrementum_sync_room";
const DB_NAME = "incrementum-yjs";
const CORRUPTION_FLAG_KEY = "incrementum-yjs-corruption-detected";

let instance: YjsSyncState | null = null;

function isSyncDebugEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  if (import.meta.env.VITE_DEBUG_NETWORK === "1") return true;
  if (typeof window === "undefined") return false;
  return localStorage.getItem("incrementum.debug.network") === "1";
}

function generateRoomId(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export function getSyncRoomId(): string {
  if (typeof window === "undefined") {
    return "incrementum-local";
  }

  let room = localStorage.getItem(ROOM_KEY);
  if (!room) {
    room = generateRoomId();
    localStorage.setItem(ROOM_KEY, room);
  }
  return room;
}

export function setSyncRoomId(roomId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(ROOM_KEY, roomId);
}

export function createNewSyncRoomId(): string {
  const room = generateRoomId();
  setSyncRoomId(room);
  return room;
}

/**
 * Clear corrupted IndexedDB data for Yjs
 */
export async function clearYjsIndexedDB(): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;

  try {

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        console.error("[YjsSync] Failed to clear IndexedDB:", request.error);
        reject(request.error);
      };
      request.onblocked = () => {
        console.warn("[YjsSync] Database deletion blocked");
        resolve();
      };
    });

    // Clear the corruption flag
    localStorage.removeItem(CORRUPTION_FLAG_KEY);
    return true;
  } catch (error) {
    console.error("[YjsSync] Error clearing IndexedDB:", error);
    return false;
  }
}

/**
 * Check if IndexedDB data is corrupted by trying to read it
 */
async function checkAndRepairCorruption(): Promise<void> {
  if (typeof indexedDB === "undefined") return;

  const wasCorrupted = localStorage.getItem(CORRUPTION_FLAG_KEY);

  // If we detected corruption in a previous session, clear data now
  if (wasCorrupted === "true") {
    await clearYjsIndexedDB();
    return;
  }

  const originalErrorHandler = window.onerror;
  let detectedCorruption = false;

  window.onerror = (message, source, lineno, colno, error) => {
    const msg = String(message);
    if (
      msg.includes("Cannot read properties of null") ||
      msg.includes("reading 'length'") ||
      (source?.includes("chunk") && msg.includes("readVarUint"))
    ) {
      detectedCorruption = true;
      console.warn("[YjsSync] Detected corrupted Yjs data, will clear on next load");
      localStorage.setItem(CORRUPTION_FLAG_KEY, "true");

      setTimeout(() => {
        clearYjsIndexedDB();
      }, 100);

      return true; // Prevent the error from propagating
    }

    if (originalErrorHandler) {
      return originalErrorHandler(message, source, lineno, colno, error);
    }
    return false;
  };

  // Restore original handler after a delay
  setTimeout(() => {
    if (!detectedCorruption) {
      window.onerror = originalErrorHandler;
    }
  }, 5000);
}

export async function getYjsSync(): Promise<YjsSyncState> {
  if (instance) {
    return instance;
  }

  try {
    await checkAndRepairCorruption();

    const url = import.meta.env.VITE_YJS_SYNC_URL || DEFAULT_SYNC_URL;
    const room = import.meta.env.VITE_YJS_ROOM || getSyncRoomId();

    let doc: Y.Doc;
    let persistence: IndexeddbPersistence | null = null;

    try {
      doc = new Y.Doc();

      // y-indexeddb relies on the browser IndexedDB API, which may be absent
      // in some mobile WebView builds. Skip persistence there (in-memory only)
      // rather than throwing — the corruption helpers below already use this
      // same `typeof indexedDB` guard. Without it, getYjsSync() rejects and the
      // whole sync stack fails to start on such a WebView.
      try {
        if (typeof indexedDB === "undefined") {
          console.warn("[YjsSync] IndexedDB unavailable; running without persistence");
          throw new Error("IndexedDB unavailable");
        }
        persistence = new IndexeddbPersistence(DB_NAME, doc);

        persistence.on("sync", (isSynced: boolean) => {
          if (isSynced) {
            // Clear corruption flag on successful sync
            localStorage.removeItem(CORRUPTION_FLAG_KEY);
          }
        });

        persistence.on("error", async (error: Error) => {
          console.error("[YjsSync] IndexedDB error:", error);
          localStorage.setItem(CORRUPTION_FLAG_KEY, "true");
        });

      } catch (persistenceError) {
        console.error("[YjsSync] Failed to create IndexedDB persistence:", persistenceError);
        persistence = null;
      }

      const provider = await buildProvider(url, room, doc);

      if (isSyncDebugEnabled()) {
        console.debug("[YjsSync] provider constructed", {
          encrypted: provider !== undefined && (provider as unknown as { __encrypted?: boolean }).__encrypted === true,
        });
      }

      provider.on("status", (event: { status: string }) => {
        const ws = (provider as any).ws as WebSocket | undefined;
        const socketUrl = ws?.url;
      });

      provider.on("connection-error", (error: Error) => {
        console.warn("[YjsSync] WebSocket connection error:", error?.message || error);
      });

      provider.on("connection-close", (event: CloseEvent | { code?: number; reason?: string }) => {
        console.warn("[YjsSync] WebSocket closed:", {
          code: (event as any)?.code,
          reason: (event as any)?.reason,
        });
      });

      instance = {
        doc,
        provider,
        persistence,
        url,
        room,
        encrypted: (provider as unknown as { __encrypted?: boolean }).__encrypted === true,
        visibilityCleanup: null,
      };

      let idleTimer: ReturnType<typeof setTimeout> | null = null;
      const IDLE_MS = 5 * 60 * 1000; // 5 minutes
      let disconnectedFromIdle = false;

      function resetIdleTimer() {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          if (provider.shouldConnect && provider.wsconnected) {
            provider.disconnect();
            disconnectedFromIdle = true;
            if (isSyncDebugEnabled()) {
            }
          }
        }, IDLE_MS);
      }

      function reconnectIfNeeded() {
        if (disconnectedFromIdle && !provider.wsconnected) {
          provider.connect();
          disconnectedFromIdle = false;
          if (isSyncDebugEnabled()) {
          }
        }
        resetIdleTimer();
      }

      // Listen for local document updates to reset the idle timer
      doc.on("update", () => {
        reconnectIfNeeded();
      });

      // Disconnect when page is hidden, reconnect when visible
      function handleVisibilityChange() {
        if (document.hidden) {
          if (provider.wsconnected) {
            provider.disconnect();
            if (idleTimer) clearTimeout(idleTimer);
            if (isSyncDebugEnabled()) {
            }
          }
        } else {
          if (!provider.wsconnected) {
            provider.connect();
            resetIdleTimer();
            if (isSyncDebugEnabled()) {
            }
          }
        }
      }
      document.addEventListener("visibilitychange", handleVisibilityChange);
      // Track the listener so resetYjsSync() can detach it on teardown — without
      // this, every room rebuild leaks a visibilitychange handler that keeps
      // calling disconnect()/connect() on a destroyed provider.
      if (instance) {
        instance.visibilityCleanup = () => {
          document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
      }

      resetIdleTimer();

      return instance;
    } catch (initError) {
      console.error("[YjsSync] Failed to initialize Y.js sync:", initError);

      // If initialization failed, try to clean up and rethrow
      if (doc) {
        try {
          doc.destroy();
        } catch (e) {
          console.warn("[YjsSync] Error destroying doc during cleanup:", e);
        }
      }

      throw initError;
    }
  } catch (error) {
    console.error("[YjsSync] Critical error in getYjsSync:", error);

    // If all else fails, try to clear corrupted data and throw
    await clearYjsIndexedDB().catch(e => {
      console.warn("[YjsSync] Failed to clear IndexedDB after error:", e);
    });

    throw error;
  }
}

/**
 * Get existing sync instance without creating new one
 */
export function getYjsSyncInstance(): YjsSyncState | null {
  return instance;
}

/**
 * Construct the WebSocket provider for the sync doc. If a cached room key is
 * present (set via the SyncSettings → roomCrypto.enableEncryption flow), the
 * returned provider wraps y-websocket in EncryptedWebsocketProvider so all
 * sync payloads are AES-GCM-encrypted on the wire. If no key is cached, sync
 * runs in "TLS only" mode (plain WebsocketProvider — confidentiality depends
 * on TLS plus the room ID as a bearer secret).
 *
 * The wrapper's underlying provider is a real WebsocketProvider instance
 * using a polyfilled WebSocket, so all WebsocketProvider API (events,
 * wsconnected, connect/disconnect) works unchanged for the rest of this
 * module.
 */
async function buildProvider(
  url: string,
  room: string,
  doc: Y.Doc,
): Promise<WebsocketProvider> {
  const subKeys = await getCachedSubKeys(room).catch((err) => {
    console.warn("[YjsSync] failed to load cached sub-keys; falling back to plaintext", err);
    return null;
  });
  if (!subKeys) {
    return new WebsocketProvider(url, room, doc, { connect: true });
  }
  const wrapper = new EncryptedWebsocketProvider(
    WebsocketProvider,
    url,
    room,
    doc,
    subKeys.stateKey,
  );
  // Mark for diagnostics (read by buildProvider's debug log above).
  Object.defineProperty(wrapper.provider, "__encrypted", {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });
  return wrapper.provider;
}

/**
 * Reset Yjs sync state and clear all data
 */
export async function resetYjsSync(): Promise<void> {
  if (instance) {
    try {
      instance.provider.disconnect();
    } catch (e) {
      console.warn("[YjsSync] Error disconnecting provider:", e);
    }
    // Detach the visibility listener before destroying the provider so a
    // hidden/visible toggle can't call connect()/disconnect() on a dead
    // provider mid-teardown.
    try {
      instance.visibilityCleanup?.();
    } catch (e) {
      console.warn("[YjsSync] Error removing visibility listener:", e);
    }
    if (instance.persistence) {
      try {
        await instance.persistence.destroy();
      } catch (e) {
        console.warn("[YjsSync] Error destroying persistence:", e);
      }
    }
    try {
      instance.doc.destroy();
    } catch (e) {
      console.warn("[YjsSync] Error destroying doc:", e);
    }
    instance = null;
  }
  await clearYjsIndexedDB();
}

/**
 * Switch the running sync to a different room WITHOUT a full page reload.
 *
 * getYjsSync() is a module singleton that captures the room ID at first
 * construction, so a bare setSyncRoomId() has no effect on the live provider
 * (this is why the old join flow told the user to reload). This tears down the
 * current instance, writes the new room ID, and rebuilds the provider against
 * the new room in-process — the UX the scan-to-join flow needs.
 *
 * y-indexeddb uses ONE database (DB_NAME) shared across rooms, so switching
 * rooms must clear it first or the new room's doc would be seeded with the old
 * room's CRDT state. A no-op is returned early when rejoining the same room to
 * avoid that wipe.
 *
 * Returns the new YjsSyncState. On any failure, the instance is left in the
 * best available state and an error is thrown so the caller can fall back to a
 * reload.
 */
export type RoomChangeListener = () => void | Promise<void>;

export const roomChangeListeners = new Set<RoomChangeListener>();

export function registerRoomChangeListener(listener: RoomChangeListener): () => void {
  roomChangeListeners.add(listener);
  return () => {
    roomChangeListeners.delete(listener);
  };
}

export async function rejoinRoom(roomId: string): Promise<YjsSyncState> {
  if (!roomId) throw new Error("rejoinRoom: roomId is required");

  const currentRoom = instance?.room;
  if (currentRoom === roomId) {
    // Already on the requested room. Avoid the IndexedDB wipe below.
    return instance ?? (await getYjsSync());
  }

  // Write the new room ID FIRST so getYjsSync() (called via resetYjsSync's
  // clear + the fresh build below) reads it back.
  setSyncRoomId(roomId);

  // resetYjsSync() disconnects, destroys the doc, nulls the singleton, and
  // clears the shared IndexedDB so the new room starts clean.
  await resetYjsSync();

  // Rebuild against the new room. getYjsSync() reads the room ID we just wrote.
  const newState = await getYjsSync();

  // Notify listeners that room has changed, awaiting each so replication /
  // file-sync reinit fully settles against the new doc before we return. Fire-
  // and-forget here let callers race ahead and issue writes against the stale
  // doc during the transition. A listener that throws is logged and isolated so
  // one bad subscriber can't abort the rest of the transition.
  await Promise.all(
    Array.from(roomChangeListeners).map(async (listener) => {
      try {
        await listener();
      } catch (e) {
        console.error("[YjsSync] room change listener failed:", e);
      }
    }),
  );

  return newState;
}

// Export synchronous version for backward compatibility
export { getYjsSync as getYjsSyncSync };
