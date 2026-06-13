/**

 Orchestration helper for the per-room encryption setup. Wraps the three
 lower-level pieces (secret generation, Argon2id key derivation, secure
 storage of both) behind a small API the UI can call without touching
 crypto primitives directly.

 Flow:
   1. User clicks "Enable encryption" → UI calls `enableEncryption(roomId)`
      or `enableEncryptionWithSecret(roomId, userChosenSecret)`.
   2. This module generates (or accepts) the room secret, derives the
      32-byte room key via Argon2id, and persists BOTH to secure storage.
   3. On next app launch, `yjsSync.ts` calls `getCachedSubKeys(roomId)` to
      get the derived AES-GCM state key; if present, it constructs the
      EncryptedWebsocketProvider. If absent, sync runs in "TLS only" mode.
   4. User clicks "Disable" → `disableEncryption()` clears both records.

*/

import { deriveRoomKey, deriveSubKeys, type SubKeys } from './encryption';
import {
  setCachedRoomKey,
  getCachedRoomKey,
  clearAllCachedSyncCrypto,
  setCachedRoomSecret,
  getCachedRoomSecret,
} from './secureStorage';

const GENERATED_SECRET_BYTES = 32;

/**
 * Generate a fresh 32-byte room secret, base64url-encoded for display/QR.
 * This is the recommended path — a random 256-bit secret has far higher
 * entropy than any user-chosen passphrase and avoids Argon2id's main
 * defense (offline brute force) mattering at all.
 */
export function generateRoomSecret(): string {
  const bytes = new Uint8Array(GENERATED_SECRET_BYTES);
  crypto.getRandomValues(bytes);
  return bytesToBase64url(bytes);
}

/**
 * Enable encryption on this device for the given room, using a
 * freshly-generated strong secret. Persists both the secret and the derived
 * key. Returns the secret so the UI can display it for the user to share
 * (via QR or copy) with their other devices.
 */
export async function enableEncryption(roomId: string): Promise<string> {
  if (!roomId) throw new Error('enableEncryption: roomId is required');
  const secret = generateRoomSecret();
  await persistSecretAndKey(secret, roomId);
  return secret;
}

/**
 * Enable encryption using a user-provided secret (passphrase or
 * previously-shared key string). Use this when joining an existing
 * encrypted room — the secret comes from the QR code or manual entry.
 */
export async function enableEncryptionWithSecret(
  roomId: string,
  secret: string,
): Promise<void> {
  if (!roomId) throw new Error('enableEncryptionWithSecret: roomId is required');
  if (!secret) throw new Error('enableEncryptionWithSecret: secret is required');
  await persistSecretAndKey(secret, roomId);
}

async function persistSecretAndKey(secret: string, roomId: string): Promise<void> {
  const roomKey = await deriveRoomKey(secret, roomId);
  await setCachedRoomSecret(secret);
  await setCachedRoomKey(roomKey);
}

/**
 * Disable encryption on this device. Clears both the cached secret and the
 * derived key. Does NOT change the room ID — sync continues the "TLS only"
 * mode against the same room.
 */
export async function disableEncryption(): Promise<void> {
  await clearAllCachedSyncCrypto();
}

/**
 * Returns true if a derived room key is cached on this device (encryption
 * will be active on next yjsSync init). Cheaper than `getCachedSubKeys`
 * when the UI just wants a boolean.
 */
export async function isEncryptionEnabled(): Promise<boolean> {
  const key = await getCachedRoomKey();
  return key !== null;
}

/**
 * Load the cached room secret (for QR generation) or null if none cached.
 */
export async function getCachedRoomSecretOrNull(): Promise<string | null> {
  return getCachedRoomSecret();
}

/**
 * Derive the full sub-key set from the cached room key. Returns null if no
 * key is cached (caller should fall back to plain WebsocketProvider).
 *
 * This is the entry point yjsSync.ts uses at provider-construction time.
 * Argon2id is NOT re-run here — the room key is already cached; we only
 * run HKDF, which is fast.
 */
export async function getCachedSubKeys(roomId: string): Promise<SubKeys | null> {
  const roomKey = await getCachedRoomKey();
  if (!roomKey) return null;
  return deriveSubKeys(roomKey, roomId);
}

// --- internal helpers ---

function bytesToBase64url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
