import { getYjsSync } from "./yjsSync";

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
]);

const BLOCKED_PREFIXES = [
  "incrementum_auth_",
  "sync_",
];

let initialized = false;
let initPromise: Promise<void> | null = null;
const LOCAL_WRITE_DEBOUNCE_MS = 350;

function isBlocked(key: string): boolean {
  if (BLOCKED_KEYS.has(key)) {
    return true;
  }
  return BLOCKED_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export async function initLocalStorageSync(): Promise<void> {
  if (initialized || typeof window === "undefined" || !window.localStorage) {
    return;
  }

  if (initPromise) {
    return initPromise;
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

  const map: any = sync.doc.getMap("localStorage");
  const lastApplied = new Map<string, number>();
  const pendingWrites = new Map<string, string | null>();
  let flushTimer: number | null = null;

  const originalSetItem = localStorage.setItem.bind(localStorage);
  const originalRemoveItem = localStorage.removeItem.bind(localStorage);
  const originalClear = localStorage.clear.bind(localStorage);

  let isApplyingRemote = false;

  const applyRemote = (key: string, entry?: SyncEntry) => {
    if (isApplyingRemote) {
      return;
    }

    isApplyingRemote = true;
    try {
      if (!entry || entry.value === null) {
        originalRemoveItem(key);
      } else {
        originalSetItem(key, entry.value);
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
      if (isBlocked(key)) {
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
    if (isBlocked(key)) {
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
    originalSetItem(key, value);
    if (!isApplyingRemote) {
      schedulePushLocal(key, value);
    }
  };

  localStorage.removeItem = (key: string) => {
    originalRemoveItem(key);
    if (!isApplyingRemote) {
      schedulePushLocal(key, null);
    }
  };

  localStorage.clear = () => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && !isBlocked(key)) {
        keys.push(key);
      }
    }

    originalClear();

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
      if (!key || isBlocked(key)) {
        continue;
      }
      const value = localStorage.getItem(key);
      if (value !== null) {
        const now = Date.now();
        map.set(key, { value, updatedAt: now });
        lastApplied.set(key, now);
      }
    }
  } else {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || isBlocked(key)) {
        continue;
      }
      if (!map.has(key)) {
        const value = localStorage.getItem(key);
        if (value !== null) {
          const now = Date.now();
          map.set(key, { value, updatedAt: now });
          lastApplied.set(key, now);
        }
      }
    }

    map.forEach((entry, key) => {
      if (isBlocked(key)) {
        return;
      }
      applyRemote(key, entry);
    });
  }

  map.observe((event) => {
    event.keysChanged.forEach((key) => {
      if (isBlocked(key)) {
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
