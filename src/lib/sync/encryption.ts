import { argon2id } from 'hash-wasm';

const ROOM_KEY_BYTES = 32;
const AES_GCM_NONCE_BYTES = 12;
const AES_GCM_TAG_BYTES = 16;
const SUB_KEY_BYTES = 32;
const NONCE_DEVICE_PREFIX_BYTES = 4;
const NONCE_COUNTER_BYTES = AES_GCM_NONCE_BYTES - NONCE_DEVICE_PREFIX_BYTES;

const HKDF_INFO_STATE = new TextEncoder().encode('incrementum-sync/state-v1');
const HKDF_INFO_FILES = new TextEncoder().encode('incrementum-sync/files-v1');
const HKDF_INFO_AUTH = new TextEncoder().encode('incrementum-sync/auth-v1');

const ARGON2_MEMORY_KIB = 65536;
const ARGON2_ITERATIONS = 3;
const ARGON2_PARALLELISM = 4;

export interface SubKeys {
  stateKey: CryptoKey;
  fileKey: CryptoKey;
  manifestAuthKey: CryptoKey;
}

export interface EncryptedChunk {
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}

export class DecryptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptError';
  }
}

export async function deriveRoomKey(
  roomSecret: string,
  roomId: string,
): Promise<Uint8Array> {
  if (!roomSecret) throw new Error('deriveRoomKey: roomSecret is required');
  if (!roomId) throw new Error('deriveRoomKey: roomId is required');

  const passwordBytes = new TextEncoder().encode(roomSecret);
  const salt = new TextEncoder().encode(`incrementum-sync/${roomId}`);

  return argon2id({
    password: passwordBytes,
    salt,
    parallelism: ARGON2_PARALLELISM,
    memorySize: ARGON2_MEMORY_KIB,
    iterations: ARGON2_ITERATIONS,
    hashLength: ROOM_KEY_BYTES,
    outputType: 'binary',
  });
}

export async function deriveSubKeys(
  roomKey: Uint8Array,
  roomId: string,
): Promise<SubKeys> {
  if (roomKey.length !== ROOM_KEY_BYTES) {
    throw new Error(
      `deriveSubKeys: expected ${ROOM_KEY_BYTES}-byte room key, got ${roomKey.length}`,
    );
  }

  const salt = new TextEncoder().encode(roomId);

  const [stateRaw, fileRaw, authRaw] = await Promise.all([
    hkdfSha256(roomKey, salt, HKDF_INFO_STATE, SUB_KEY_BYTES),
    hkdfSha256(roomKey, salt, HKDF_INFO_FILES, SUB_KEY_BYTES),
    hkdfSha256(roomKey, salt, HKDF_INFO_AUTH, SUB_KEY_BYTES),
  ]);

  const [stateKey, fileKey, manifestAuthKey] = await Promise.all([
    crypto.subtle.importKey('raw', stateRaw, { name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]),
    crypto.subtle.importKey('raw', fileRaw, { name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]),
    crypto.subtle.importKey(
      'raw',
      authRaw,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    ),
  ]);

  return { stateKey, fileKey, manifestAuthKey };
}

let stateCounter = randomUint64();
let devicePrefixPromise: Promise<Uint8Array> | null = null;

function getDevicePrefix(): Promise<Uint8Array> {
  if (!devicePrefixPromise) {
    devicePrefixPromise = deriveDevicePrefix();
  }
  return devicePrefixPromise;
}

function randomUint64(): bigint {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const view = new DataView(bytes.buffer);
  return view.getBigUint64(0, false);
}

async function deriveDevicePrefix(): Promise<Uint8Array> {
  let deviceId = '';
  try {
    deviceId =
      typeof localStorage !== 'undefined'
        ? (localStorage.getItem('incrementum_device_id') ?? '')
        : '';
  } catch {
    // localStorage unavailable (test context, sandboxed iframe) — fall through to random.
  }
  if (!deviceId) {
    const random = new Uint8Array(NONCE_DEVICE_PREFIX_BYTES);
    crypto.getRandomValues(random);
    return random;
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(deviceId));
  return new Uint8Array(digest).slice(0, NONCE_DEVICE_PREFIX_BYTES);
}

function nextStateNonce(devicePrefix: Uint8Array): Uint8Array {
  if (stateCounter >= 0xffffffffffffffffn) {
    throw new Error('state-encryption counter exhausted; restart the app');
  }
  const counter = stateCounter;
  stateCounter += 1n;

  const nonce = new Uint8Array(AES_GCM_NONCE_BYTES);
  nonce.set(devicePrefix, 0);
  const view = new DataView(nonce.buffer, NONCE_DEVICE_PREFIX_BYTES, NONCE_COUNTER_BYTES);
  view.setBigUint64(0, counter, false);
  return nonce;
}

export async function encryptState(
  update: Uint8Array,
  stateKey: CryptoKey,
): Promise<Uint8Array> {
  const devicePrefix = await getDevicePrefix();
  const nonce = nextStateNonce(devicePrefix);

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, stateKey, update),
  );

  const out = new Uint8Array(nonce.length + ciphertext.length);
  out.set(nonce, 0);
  out.set(ciphertext, nonce.length);
  return out;
}

export async function decryptState(
  packed: Uint8Array,
  stateKey: CryptoKey,
): Promise<Uint8Array> {
  if (packed.length < AES_GCM_NONCE_BYTES + AES_GCM_TAG_BYTES) {
    throw new DecryptError('decryptState: payload too short');
  }
  const nonce = packed.slice(0, AES_GCM_NONCE_BYTES);
  const ciphertext = packed.slice(AES_GCM_NONCE_BYTES);
  try {
    return new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, stateKey, ciphertext),
    );
  } catch {
    throw new DecryptError('decryptState: decryption failed (wrong key or tampering)');
  }
}

export async function encryptChunk(
  plaintext: Uint8Array,
  fileKey: CryptoKey,
): Promise<EncryptedChunk> {
  const nonce = new Uint8Array(AES_GCM_NONCE_BYTES);
  crypto.getRandomValues(nonce);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, fileKey, plaintext),
  );
  return { nonce, ciphertext };
}

export async function decryptChunk(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  fileKey: CryptoKey,
): Promise<Uint8Array> {
  if (nonce.length !== AES_GCM_NONCE_BYTES) {
    throw new DecryptError(
      `decryptChunk: expected ${AES_GCM_NONCE_BYTES}-byte nonce, got ${nonce.length}`,
    );
  }
  try {
    return new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, fileKey, ciphertext),
    );
  } catch {
    throw new DecryptError('decryptChunk: decryption failed (wrong key or tampering)');
  }
}

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data));
}

export async function hmacManifest(
  entryBytes: Uint8Array,
  manifestAuthKey: CryptoKey,
): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.sign('HMAC', manifestAuthKey, entryBytes),
  );
}

export async function verifyManifestHmac(
  entryBytes: Uint8Array,
  expectedMac: Uint8Array,
  manifestAuthKey: CryptoKey,
): Promise<boolean> {
  return crypto.subtle.verify('HMAC', manifestAuthKey, expectedMac, entryBytes);
}

async function hkdfSha256(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    baseKey,
    length * 8,
  );
  return new Uint8Array(bits);
}

export const __test = {
  AES_GCM_NONCE_BYTES,
  NONCE_DEVICE_PREFIX_BYTES,
  NONCE_COUNTER_BYTES,
  resetStateCounterForTesting(): void {
    stateCounter = randomUint64();
  },
  resetDevicePrefixForTesting(): void {
    devicePrefixPromise = null;
  },
  async getStateNoncePrefixForTesting(): Promise<Uint8Array> {
    return getDevicePrefix();
  },
};
