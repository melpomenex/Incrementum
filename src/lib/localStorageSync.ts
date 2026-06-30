import { getYjsSync, registerRoomChangeListener } from "./yjsSync";

type SyncEntry = {
  value: string | null;
  updatedAt: number;
};

const BLOCKED_KEYS = new Set([
  "incrementum_auth_token",
  "incrementum_user",
  "incrementum_last_sync_version",
  "incrementum_youtube_cookies",
  "incrementum_sync_room",
  "llm-providers-storage",
  "mcp-servers-storage",
  "integration_settings",
  // Theme preferences should be device-specific and not synced
  "incrementum-last-theme",
  "incrementum-custom-themes",
  // Corruption flag should not be synced
  "incrementum-yjs-corruption-detected",
  // Tabs and reading-session history are per-device UI state that grows without
  // bound; syncing them bloats the shared Yjs document (each edit becomes a
  // tombstone that never shrinks). Keep them local.
  "incrementum-tabs",
  "incrementum.reading-sessions",
  "assistant-panel-conversations-v1",
  "web-browser-extracts",
]);

const BLOCKED_PREFIXES = [
  "incrementum_auth_",
  "sync_",
  // Per-document view/scroll state is large (one entry per opened doc) and
  // device-specific (screen size, zoom). It must not enter the shared doc.
  "document-view-state:",
  "document-scroll-position:",
  // Extract drafts and per-doc caches are device-local working state.
  "extract:",
  "document-cache:",
];

/**
 * Maximum localStorage value size to sync through the Yjs document. Values
 * larger than this are skipped: the shared CRDT document grows monotonically
 * (deletes become permanent tombstones), so a few hundred-KB cover-image
 * data-URLs or large JSON blobs can balloon the doc to multiple MB — which
 * then makes every sync exchange so slow that connections drop before the
 * handshake completes, breaking replication entirely. 8 KiB comfortably fits
 * every legitimate small setting while excluding images and big histories.
 */
const MAX_SYNC_VALUE_BYTES = 8 * 1024;

/**
 * Values that are obviously binary payload masquerading as text (base64
 * cover images, data-URLs) never belong in a synced settings document. Match
 * the leading scheme so we catch both `data:image/...` and any future
 * `data:video/...`/`data:application/...` blobs regardless of size.
 */
const DATA_URL_RE = /^data:[a-z]+\//i;

let initialized = false;
let initPromise: Promise<void> | null = null;
let currentDoc: any = null;
let unsubscribeRoomChangeListener: (() => void) | null = null;

let originalSetItem: ((key: string, value: string) => void) | null = null;
let originalRemoveItem: ((key: string) => void) | null = null;
let originalClear: (() => void) | null = null;

const LOCAL_WRITE_DEBOUNCE_MS = 350;

function isBlockedKey(key: string): boolean {
  if (BLOCKED_KEYS.has(key)) {
    return true;
  }
  return BLOCKED_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * Decide whether a localStorage entry should be synced. Returns true (skip)
 * when the key is blocklisted, the value is too large, or the value is a
 * binary data-URL. The `value` is optional so callers that only have the key
 * (e.g. `removeItem`) still work — deletion of a never-synced key is harmless.
 *
 * The size/content checks are deliberately value-based: a blocklisted *key*
 * never enters the doc, but we must also reject a small-keyed entry whose
 * *value* is a 300 KB cover image, since that is what actually bloated the
 * shared document in the field.
 */
function shouldSkipSync(key: string, value: string | null | undefined): boolean {
  if (isBlockedKey(key)) return true;
  if (value == null) return false; // deletion / tombstone — let it through
  if (value.length > MAX_SYNC_VALUE_BYTES) return true;
  if (DATA_URL_RE.test(value)) return true;
  return false;
}

export async function initLocalStorageSync(): Promise<void> {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  const sync = await getYjsSync();
  if (initialized && currentDoc === sync.doc) {
    return;
  }

  if (currentDoc && currentDoc !== sync.doc) {
    initialized = false;
    initPromise = null;
  }

  if (initPromise) {
    return initPromise;
  }

  if (!unsubscribeRoomChangeListener) {
    unsubscribeRoomChangeListener = registerRoomChangeListener(() => {
      // Defer slightly to let rejoinRoom finish and getYjsSync() load the new doc
      setTimeout(() => {
        void initLocalStorageSync();
      }, 100);
    });
  }

  initPromise = (async () => {
    let sync;
    try {
      sync = await getYjsSync();
    } catch (error) {
      console.error("[LocalStorageSync] Failed to initialize Y.js sync:", error);
      // Continue without sync - localStorage will still work locally
      initialized = true;
      return;
    }

    currentDoc = sync.doc;

    const map: any = sync.doc.getMap("localStorage");
    const lastApplied = new Map<string, number>();
    const pendingWrites = new Map<string, string | null>();
    let flushTimer: number | null = null;

    if (!originalSetItem) {
      originalSetItem = localStorage.setItem.bind(localStorage);
      originalRemoveItem = localStorage.removeItem.bind(localStorage);
      originalClear = localStorage.clear.bind(localStorage);
    }

    let isApplyingRemote = false;

    const applyRemote = (key: string, entry?: SyncEntry) => {
      if (isApplyingRemote) {
        return;
      }

      isApplyingRemote = true;
      try {
        if (!entry || entry.value === null) {
          originalRemoveItem!(key);
        } else {
          originalSetItem!(key, entry.value);
        }
        if (entry) {
          lastApplied.set(key, entry.updatedAt);
        }
      } finally {
        isApplyingRemote = false;
      }
    };

    const flushPendingWrites = () => {
      flushTimer = null;

      pendingWrites.forEach((value, key) => {
        if (shouldSkipSync(key, value)) {
          return;
        }

        const current = map.get(key);
        if ((current?.value ?? null) === value) {
          if (current) {
            lastApplied.set(key, current.updatedAt);
          }
          return;
        }

        const now = Date.now();
        map.set(key, { value, updatedAt: now });
        lastApplied.set(key, now);
      });

      pendingWrites.clear();
    };

    const schedulePushLocal = (key: string, value: string | null) => {
      if (shouldSkipSync(key, value)) {
        return;
      }

      pendingWrites.set(key, value);
      if (flushTimer !== null) {
        window.clearTimeout(flushTimer);
      }
      flushTimer = window.setTimeout(flushPendingWrites, LOCAL_WRITE_DEBOUNCE_MS);
    };

    // Patch localStorage to broadcast changes through Yjs.
    localStorage.setItem = (key: string, value: string) => {
      originalSetItem!(key, value);
      if (!isApplyingRemote) {
        schedulePushLocal(key, value);
      }
    };

    localStorage.removeItem = (key: string) => {
      originalRemoveItem!(key);
      if (!isApplyingRemote) {
        schedulePushLocal(key, null);
      }
    };

    localStorage.clear = () => {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && !isBlockedKey(key)) {
          keys.push(key);
        }
      }

      originalClear!();

      if (!isApplyingRemote) {
        keys.forEach((key) => {
          schedulePushLocal(key, null);
        });
      }
    };

    // Initial merge: if the map is empty, seed from localStorage.
    if (map.size === 0) {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key) continue;
        const value = localStorage.getItem(key);
        if (value === null || shouldSkipSync(key, value)) {
          continue;
        }
        const now = Date.now();
        map.set(key, { value, updatedAt: now });
        lastApplied.set(key, now);
      }
    } else {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (!map.has(key)) {
          const value = localStorage.getItem(key);
          if (value !== null && !shouldSkipSync(key, value)) {
            const now = Date.now();
            map.set(key, { value, updatedAt: now });
            lastApplied.set(key, now);
          }
        }
      }

      map.forEach((entry: SyncEntry, key: string) => {
        if (isBlockedKey(key)) {
          return;
        }
        applyRemote(key, entry);
      });
    }

    map.observe((event: any) => {
      event.keysChanged.forEach((key: string) => {
        if (isBlockedKey(key)) {
          return;
        }
        const entry = map.get(key);
        const last = lastApplied.get(key);
        if (entry && last === entry.updatedAt) {
          return;
        }
        applyRemote(key, entry);
      });
    });

    initialized = true;
  })();

  return initPromise;
}
