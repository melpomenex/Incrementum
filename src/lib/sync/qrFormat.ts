export const SYNC_QR_FORMAT_VERSION = 1;
export const SYNC_QR_PREFIX = 'incrementum-sync';

export interface ParsedSyncQrPayload {
  version: number;
  roomId: string;
  roomSecret: string;
}

export class InvalidQrPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidQrPayloadError';
  }
}

const DELIMITER = ':';
// roomId is permissive beyond the existing 32-hex-char format: any non-empty
// run of URL-safe chars, never the delimiter. Keeping this a regex (rather
// than a hardcoded 32-hex check) lets the QR carry future room-id shapes.
const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]*$/;

export function encodeSyncQrPayload(roomId: string, roomSecret: string): string {
  if (!roomId) throw new InvalidQrPayloadError('encodeSyncQrPayload: roomId is required');
  if (!roomSecret) throw new InvalidQrPayloadError('encodeSyncQrPayload: roomSecret is required');
  if (!ROOM_ID_PATTERN.test(roomId)) {
    throw new InvalidQrPayloadError(
      'encodeSyncQrPayload: roomId contains characters outside [A-Za-z0-9_-]',
    );
  }

  const encodedSecret = base64urlEncode(new TextEncoder().encode(roomSecret));
  return [
    SYNC_QR_PREFIX,
    `v${SYNC_QR_FORMAT_VERSION}`,
    roomId,
    encodedSecret,
  ].join(DELIMITER);
}

export function parseSyncQrPayload(payload: string): ParsedSyncQrPayload {
  if (typeof payload !== 'string') {
    throw new InvalidQrPayloadError('parseSyncQrPayload: payload must be a string');
  }

  const parts = payload.split(DELIMITER);
  if (parts.length !== 4) {
    throw new InvalidQrPayloadError(
      `parseSyncQrPayload: expected 4 colon-delimited parts, got ${parts.length}`,
    );
  }

  const [prefix, versionField, roomId, encodedSecret] = parts;

  if (prefix !== SYNC_QR_PREFIX) {
    throw new InvalidQrPayloadError(
      `parseSyncQrPayload: missing or wrong prefix (expected "${SYNC_QR_PREFIX}")`,
    );
  }

  if (!/^v\d+$/.test(versionField)) {
    throw new InvalidQrPayloadError(
      `parseSyncQrPayload: version field "${versionField}" is malformed (expected v<positive-int>)`,
    );
  }
  const version = Number(versionField.slice(1));
  if (version !== SYNC_QR_FORMAT_VERSION) {
    throw new InvalidQrPayloadError(
      `parseSyncQrPayload: QR version v${version} is not supported (supported: v${SYNC_QR_FORMAT_VERSION})`,
    );
  }

  if (!roomId) {
    throw new InvalidQrPayloadError('parseSyncQrPayload: roomId is empty');
  }
  if (!ROOM_ID_PATTERN.test(roomId)) {
    throw new InvalidQrPayloadError(
      'parseSyncQrPayload: roomId contains characters outside [A-Za-z0-9_-]',
    );
  }

  if (!encodedSecret) {
    throw new InvalidQrPayloadError('parseSyncQrPayload: roomSecret is empty');
  }

  // Tolerate an over-elegant encoder that appended `=` padding — strip it,
  // then validate the alphabet. The base64url decode below handles re-padding.
  const stripped = encodedSecret.replace(/=+$/, '');
  if (!BASE64URL_PATTERN.test(stripped)) {
    throw new InvalidQrPayloadError(
      'parseSyncQrPayload: roomSecret is not valid base64url',
    );
  }

  let secretBytes: Uint8Array;
  try {
    secretBytes = base64urlDecode(stripped);
  } catch {
    throw new InvalidQrPayloadError(
      'parseSyncQrPayload: roomSecret is not valid base64url',
    );
  }
  if (secretBytes.length === 0) {
    throw new InvalidQrPayloadError('parseSyncQrPayload: roomSecret is empty');
  }

  const roomSecret = new TextDecoder().decode(secretBytes);

  return { version, roomId, roomSecret };
}

export function isSyncQrPayload(payload: string): boolean {
  try {
    parseSyncQrPayload(payload);
    return true;
  } catch {
    return false;
  }
}

// base64url helpers — RFC 4648 section 5, no `=` padding. Implementation
// routes through btoa/atob (universally available in browser and jsdom),
// swapping the two URL-unsafe chars and stripping padding. UTF-8 is handled
// at the caller boundary (TextEncoder/TextDecoder), so these operate on raw
// bytes only.
function base64urlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(s: string): Uint8Array {
  const std = s.replace(/-/g, '+').replace(/_/g, '/');
  // atob rejects lengths that aren't a multiple of 4 after padding.
  const padded = std.padEnd(Math.ceil(std.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
