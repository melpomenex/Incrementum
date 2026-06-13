import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

// The project test setup (`src/test/setup.ts`) stubs `window.__TAURI__`, so the
// real `isTauri()` would return true and route every call through
// `invokeCommand` instead of the web path under test. Mock the module so
// `isTauri` is always false here. `invokeCommand` is also stubbed so that if a
// test ever accidentally reaches the Tauri branch it fails loudly instead of
// silently hitting the mocked browser backend.
vi.mock('../tauri', () => ({
  isTauri: () => false,
  invokeCommand: async () => {
    throw new Error('invokeCommand should not be called when isTauri() is false');
  },
}));

import {
  setCachedRoomKey,
  getCachedRoomKey,
  clearCachedRoomKey,
  __secureStorageTest,
} from '../sync/secureStorage';

// Schedule IDB success/complete callbacks on a macrotask rather than a
// microtask so the caller has always finished wiring `onsuccess`/`oncomplete`
// before the callback fires. `queueMicrotask` runs within the same microtask
// checkpoint as the caller's setup and races with it under vitest.
function tick(fn: () => void): void {
  setTimeout(fn, 0);
}

// jsdom does not ship IndexedDB. Rather than add `fake-indexeddb` as a
// dependency (which would touch package.json + lockfile), install a minimal
// in-memory shim that supports the surface secureStorage.ts actually uses:
// `indexedDB.open` with `onupgradeneeded`, `transaction(store, mode)`,
// `objectStore.put/get/delete`, and request/transaction event semantics.
// We cast through `any` because re-implementing the full lib.dom IDB type
// hierarchy for a test double is not worth the noise.

class ShimStore {
  private map = new Map<string, unknown>();
  put(value: unknown, key?: IDBValidKey): IDBRequest<undefined> {
    this.map.set(String(key), value);
    return successRequest<undefined>(undefined);
  }
  get(key: IDBValidKey): IDBRequest<unknown> {
    return successRequest(this.map.get(String(key)));
  }
  delete(key: IDBValidKey): IDBRequest<undefined> {
    this.map.delete(String(key));
    return successRequest<undefined>(undefined);
  }
  clearForTest(): void {
    this.map.clear();
  }
}

class ShimDB {
  name: string;
  version: number;
  objectStoreNames = { contains: () => true, length: 1 };
  private store = new ShimStore();
  constructor(name: string, version: number) {
    this.name = name;
    this.version = version;
  }
  transaction(_storeName: string, _mode: IDBTransactionMode): any {
    const handlers: { oncomplete: ((ev: Event) => void) | null; onerror: ((ev: Event) => void) | null; onabort: ((ev: Event) => void) | null } = {
      oncomplete: null,
      onerror: null,
      onabort: null,
    };
    const tx: any = {
      objectStore: () => this.store,
      error: null,
      set oncomplete(fn: any) { handlers.oncomplete = fn; },
      get oncomplete() { return handlers.oncomplete; },
      set onerror(fn: any) { handlers.onerror = fn; },
      get onerror() { return handlers.onerror; },
      set onabort(fn: any) { handlers.onabort = fn; },
      get onabort() { return handlers.onabort; },
    };
    tick(() => {
      const cb = handlers.oncomplete;
      if (cb) cb(new Event('complete') as unknown as Event);
    });
    return tx;
  }
  close(): void {
    /* noop */
  }
  _resetStore(): void {
    this.store.clearForTest();
  }
}

const dbs = new Map<string, ShimDB>();

function successRequest<T>(result: T): IDBRequest<T> {
  const handlers: { onsuccess: ((ev: Event) => void) | null; onerror: ((ev: Event) => void) | null } = {
    onsuccess: null,
    onerror: null,
  };
  const req: any = {
    result: result,
    error: null,
    set onsuccess(fn: any) { handlers.onsuccess = fn; },
    get onsuccess() { return handlers.onsuccess; },
    set onerror(fn: any) { handlers.onerror = fn; },
    get onerror() { return handlers.onerror; },
  };
  tick(() => {
    const cb = handlers.onsuccess;
    if (cb) cb(new Event('success') as unknown as Event);
  });
  return req as unknown as IDBRequest<T>;
}

function installShimIndexedDB(): void {
  const shim = {
    open(name: string, version: number): IDBOpenDBRequest {
      let db = dbs.get(name);
      let firstOpen = false;
      if (!db) {
        db = new ShimDB(name, version);
        dbs.set(name, db);
        firstOpen = true;
      }
      const handlers: {
        onupgradeneeded: ((ev: Event) => void) | null;
        onsuccess: ((ev: Event) => void) | null;
        onerror: ((ev: Event) => void) | null;
      } = { onupgradeneeded: null, onsuccess: null, onerror: null };
      const req: any = {
        result: db as unknown as IDBDatabase,
        error: null,
        set onupgradeneeded(fn: any) { handlers.onupgradeneeded = fn; },
        get onupgradeneeded() { return handlers.onupgradeneeded; },
        set onsuccess(fn: any) { handlers.onsuccess = fn; },
        get onsuccess() { return handlers.onsuccess; },
        set onerror(fn: any) { handlers.onerror = fn; },
        get onerror() { return handlers.onerror; },
      };
      tick(() => {
        if (firstOpen) {
          const upg = handlers.onupgradeneeded;
          if (upg) upg(new Event('upgradeneeded') as unknown as Event);
        }
        const ok = handlers.onsuccess;
        if (ok) ok(new Event('success') as unknown as Event);
      });
      return req as unknown as IDBOpenDBRequest;
    },
  };
  vi.stubGlobal('indexedDB', shim);
}

// jsdom in this project's vitest config may not provide a working
// localStorage (`--localstorage-file` warning), so install a Map-backed one.
function installShimLocalStorage(): void {
  const store = new Map<string, string>();
  const shim: Storage = {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    removeItem: (k: string) => { store.delete(k); },
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
  };
  vi.stubGlobal('localStorage', shim);
}

beforeEach(() => {
  dbs.clear();
  installShimLocalStorage();
  installShimIndexedDB();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function randomKey(): Uint8Array {
  const k = new Uint8Array(32);
  crypto.getRandomValues(k);
  return k;
}

describe('secureStorage (web/PWA path)', () => {
  it('returns null before any key has been set', async () => {
    const result = await getCachedRoomKey();
    expect(result).toBeNull();
  });

  it('round-trips a 32-byte room key', async () => {
    const key = randomKey();
    await setCachedRoomKey(key);
    const got = await getCachedRoomKey();
    expect(got).not.toBeNull();
    expect(got).toBeInstanceOf(Uint8Array);
    expect(Array.from(got!)).toEqual(Array.from(key));
  });

  it('clear() removes the cached key', async () => {
    const key = randomKey();
    await setCachedRoomKey(key);
    expect(await getCachedRoomKey()).not.toBeNull();
    await clearCachedRoomKey();
    expect(await getCachedRoomKey()).toBeNull();
  });

  it('does NOT store the plaintext room key in IndexedDB', async () => {
    const key = randomKey();
    await setCachedRoomKey(key);

    const blob = await __secureStorageTest.readRawBlob();
    expect(blob).toBeDefined();
    expect(blob!.v).toBe(1);

    // Ciphertext = plaintext length + 16-byte AES-GCM tag.
    const storedCipherBytes = Uint8Array.from(atob(blob!.ciphertext), (c) =>
      c.charCodeAt(0),
    );
    expect(storedCipherBytes.length).toBe(key.length + 16);

    // The leading 32 bytes of the ciphertext must not equal the plaintext key.
    const first32 = storedCipherBytes.slice(0, 32);
    expect(Array.from(first32)).not.toEqual(Array.from(key));

    // The base64 of the plaintext key must not appear in the serialized blob
    // (would indicate the key was stored verbatim somewhere).
    const keyB64 = btoa(String.fromCharCode(...key));
    expect(JSON.stringify(blob)).not.toContain(keyB64);
  });

  it('rejects a room key that is not exactly 32 bytes', async () => {
    await expect(setCachedRoomKey(new Uint8Array(16))).rejects.toThrow(/32-byte/);
    await expect(setCachedRoomKey(new Uint8Array(64))).rejects.toThrow(/32-byte/);
  });

  it('retrieves the same key after a page reload (dev secret persists in localStorage)', async () => {
    const key = randomKey();
    await setCachedRoomKey(key);

    // Simulate reload: keep localStorage + IndexedDB (shim keeps `dbs`), drop
    // any module-level caches by re-importing fresh.
    vi.resetModules();
    const fresh = await import('../sync/secureStorage');
    const got = await fresh.getCachedRoomKey();
    expect(got).not.toBeNull();
    expect(Array.from(got!)).toEqual(Array.from(key));
  });
});
