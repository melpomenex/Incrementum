/**
 * Per-device secure storage of the cached Yjs sync room key.
 *
 * Design context: see `openspec/changes/overhaul-cross-device-sync/design.md`
 * Decision 5 (Real end-to-end encryption). After a device derives the room key
 * from the user's passphrase via Argon2id (expensive), we cache the derived
 * 32-byte key so subsequent launches of the same device do not re-prompt.
 *
 * Two backends:
 * - Tauri (desktop + mobile): delegates to Rust commands backed by the
 *   `keyring` crate, which routes to macOS Keychain, Windows Credential
 *   Manager, Linux Secret Service, Android Keystore, iOS Keychain. This is the
 *   same crate already used for AI API keys and OAuth tokens — see
 *   `src-tauri/src/commands/ai_key_store.rs` and
 *   `src-tauri/src/cloud/auth_store.rs`. No new dependency was needed.
 * - Web/PWA: stores the key in a dedicated IndexedDB database, encrypted with
 *   AES-GCM under a per-device secret kept in localStorage. This is strictly
 *   weaker than the OS keychain (localStorage is readable by any JS on the
 *   origin, so an XSS attacker who can read it can also just ask the app to
 *   decrypt), but it raises the bar against casual disk inspection and is the
 *   best boundary available inside a browser tab. The plaintext room key never
 *   touches IndexedDB.
 */

import { isTauri } from '../tauri.js';
import { invokeCommand } from '../tauri.js';

const KEYRING_SERVICE = 'incrementum-sync';
const KEYRING_ACCOUNT_KEY = 'room-key';
const KEYRING_ACCOUNT_SECRET = 'room-secret';

const WEB_DB_NAME = 'incrementum-secure-storage';
const WEB_DB_VERSION = 1;
const WEB_STORE_NAME = 'kv';
const WEB_KEY_RECORD = 'room-key';
const WEB_SECRET_RECORD = 'room-secret';

const DEV_SECRET_KEY = 'incrementum_secure_storage_dev_secret';
const DEV_SECRET_BYTES = 32;
const AES_GCM_NONCE_BYTES = 12;

interface PackedBlob {
  v: 1;
  nonce: string;
  ciphertext: string;
}

// ── Public API ────────────────────────────────────────────────────────────

export async function setCachedRoomKey(roomKey: Uint8Array): Promise<void> {
  if (roomKey.length !== 32) {
    throw new Error(`setCachedRoomKey: expected 32-byte room key, got ${roomKey.length}`);
  }
  if (isTauri()) {
    await invokeCommand('secure_storage_set', {
      service: KEYRING_SERVICE,
      account: KEYRING_ACCOUNT_KEY,
      value: bytesToBase64(roomKey),
    });
    return;
  }
  await webSet(WEB_KEY_RECORD, roomKey);
}

export async function getCachedRoomKey(): Promise<Uint8Array | null> {
  if (isTauri()) {
    const value = await invokeCommand<string | null>('secure_storage_get', {
      service: KEYRING_SERVICE,
      account: KEYRING_ACCOUNT_KEY,
    });
    if (!value) return null;
    return base64ToBytes(value);
  }
  return webGet(WEB_KEY_RECORD);
}

export async function clearCachedRoomKey(): Promise<void> {
  if (isTauri()) {
    await invokeCommand('secure_storage_clear', {
      service: KEYRING_SERVICE,
      account: KEYRING_ACCOUNT_KEY,
    });
    return;
  }
  await webClear(WEB_KEY_RECORD);
}

/**
 * Cache the room SECRET (the user-held string — passphrase or base64url key —
 * that gets shared via QR or typed on a new device). Stored separately from
 * the derived room key because:
 *   (a) the derived key is what the crypto primitives want in memory;
 *   (b) the secret is what the UI needs to redisplay for QR generation,
 *       since the QR format includes it.
 *
 * Both are stored under the same backend (keychain / encrypted IndexedDB)
 * but distinct accounts/records so compromising one doesn't grant the other.
 */
export async function setCachedRoomSecret(secret: string): Promise<void> {
  if (!secret) throw new Error('setCachedRoomSecret: secret is required');
  const bytes = new TextEncoder().encode(secret);
  if (isTauri()) {
    await invokeCommand('secure_storage_set', {
      service: KEYRING_SERVICE,
      account: KEYRING_ACCOUNT_SECRET,
      value: bytesToBase64(bytes),
    });
    return;
  }
  await webSet(WEB_SECRET_RECORD, bytes);
}

export async function getCachedRoomSecret(): Promise<string | null> {
  let bytes: Uint8Array | null;
  if (isTauri()) {
    const value = await invokeCommand<string | null>('secure_storage_get', {
      service: KEYRING_SERVICE,
      account: KEYRING_ACCOUNT_SECRET,
    });
    if (!value) return null;
    bytes = base64ToBytes(value);
  } else {
    bytes = await webGet(WEB_SECRET_RECORD);
  }
  if (!bytes) return null;
  return new TextDecoder().decode(bytes);
}

export async function clearCachedRoomSecret(): Promise<void> {
  if (isTauri()) {
    await invokeCommand('secure_storage_clear', {
      service: KEYRING_SERVICE,
      account: KEYRING_ACCOUNT_SECRET,
    });
    return;
  }
  await webClear(WEB_SECRET_RECORD);
}

/**
 * Convenience: clear both the derived key and the secret. Call this on
 * "disable encryption" or "rotate room key" flows.
 */
export async function clearAllCachedSyncCrypto(): Promise<void> {
  await Promise.all([clearCachedRoomKey(), clearCachedRoomSecret()]);
}

// ── Web/PWA backend ───────────────────────────────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function getOrCreateDevSecret(): Promise<CryptoKey> {
  let b64: string | null = null;
  try {
    b64 = localStorage.getItem(DEV_SECRET_KEY);
  } catch {
    // localStorage unavailable — derive an ephemeral secret; data won't
    // survive a reload but we never store the plaintext either way.
  }
  if (!b64) {
    const raw = new Uint8Array(DEV_SECRET_BYTES);
    crypto.getRandomValues(raw);
    b64 = bytesToBase64(raw);
    try {
      localStorage.setItem(DEV_SECRET_KEY, b64);
    } catch {
      // swallow — we still return an in-memory key for this session
    }
  }
  return crypto.subtle.importKey(
    'raw',
    base64ToBytes(b64),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function openSecureDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable in this environment'));
      return;
    }
    const req = indexedDB.open(WEB_DB_NAME, WEB_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(WEB_STORE_NAME)) {
        db.createObjectStore(WEB_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

async function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WEB_STORE_NAME, 'readwrite');
    tx.objectStore(WEB_STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB put failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB put aborted'));
  });
}

async function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WEB_STORE_NAME, 'readonly');
    const req = tx.objectStore(WEB_STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB get failed'));
  });
}

async function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WEB_STORE_NAME, 'readwrite');
    tx.objectStore(WEB_STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'));
  });
}

async function webSet(record: string, bytes: Uint8Array): Promise<void> {
  const devKey = await getOrCreateDevSecret();
  const nonce = new Uint8Array(AES_GCM_NONCE_BYTES);
  crypto.getRandomValues(nonce);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, devKey, bytes),
  );
  const blob: PackedBlob = {
    v: 1,
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(ciphertext),
  };
  const db = await openSecureDB();
  try {
    await idbPut(db, record, blob);
  } finally {
    db.close();
  }
}

async function webGet(record: string): Promise<Uint8Array | null> {
  const db = await openSecureDB();
  let blob: PackedBlob | undefined;
  try {
    blob = await idbGet<PackedBlob>(db, record);
  } finally {
    db.close();
  }
  if (!blob) return null;
  const devKey = await getOrCreateDevSecret();
  const nonce = base64ToBytes(blob.nonce);
  const ciphertext = base64ToBytes(blob.ciphertext);
  try {
    return new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, devKey, ciphertext),
    );
  } catch {
    // Per-device secret rotated or tampered — treat as no cached value.
    return null;
  }
}

async function webClear(record: string): Promise<void> {
  const db = await openSecureDB();
  try {
    await idbDelete(db, record);
  } finally {
    db.close();
  }
}

// Exported for tests that need to inspect the raw stored blob.
export const __secureStorageTest = {
  WEB_DB_NAME,
  WEB_STORE_NAME,
  WEB_KEY_RECORD,
  async readRawBlob(): Promise<PackedBlob | undefined> {
    const db = await openSecureDB();
    try {
      return await idbGet<PackedBlob>(db, WEB_KEY_RECORD);
    } finally {
      db.close();
    }
  },
};
