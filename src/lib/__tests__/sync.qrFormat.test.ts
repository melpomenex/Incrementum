import { describe, expect, it } from 'vitest';
import {
  SYNC_QR_FORMAT_VERSION,
  SYNC_QR_PREFIX,
  InvalidQrPayloadError,
  encodeSyncQrPayload,
  parseSyncQrPayload,
  isSyncQrPayload,
} from '../sync/qrFormat';

const ROOM_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const ROOM_SECRET = 'correct horse battery staple';

function buildPayload(
  prefix: string,
  versionField: string,
  roomId: string,
  encodedSecret: string,
): string {
  return [prefix, versionField, roomId, encodedSecret].join(':');
}

describe('constants', () => {
  it('exposes the current format version (v1)', () => {
    expect(SYNC_QR_FORMAT_VERSION).toBe(1);
  });
  it('exposes the literal prefix', () => {
    expect(SYNC_QR_PREFIX).toBe('incrementum-sync');
  });
});

describe('encodeSyncQrPayload + parseSyncQrPayload round-trip', () => {
  it('round-trips a typical passphrase secret', () => {
    const payload = encodeSyncQrPayload(ROOM_ID, ROOM_SECRET);
    const parsed = parseSyncQrPayload(payload);
    expect(parsed).toEqual({
      version: 1,
      roomId: ROOM_ID,
      roomSecret: ROOM_SECRET,
    });
  });

  it('round-trips a 32-hex-char room ID (existing format)', () => {
    const payload = encodeSyncQrPayload(ROOM_ID, ROOM_SECRET);
    expect(payload).toContain(`:${ROOM_ID}:`);
    expect(parseSyncQrPayload(payload).roomId).toBe(ROOM_ID);
  });

  it('produces the documented prefix and version field', () => {
    const payload = encodeSyncQrPayload(ROOM_ID, ROOM_SECRET);
    expect(payload.startsWith(`${SYNC_QR_PREFIX}:v${SYNC_QR_FORMAT_VERSION}:`)).toBe(true);
  });

  it('never emits standard-base64 chars (+ or /) in the encoded secret', () => {
    // Secrets that produce +, /, = in standard base64 are exactly the
    // reason we chose base64url — verify the encoder actually avoids them.
    const tricky = 'aa+bb/cc=dd';
    const payload = encodeSyncQrPayload(ROOM_ID, tricky);
    const encodedSecret = payload.split(':')[3];
    expect(encodedSecret).not.toContain('+');
    expect(encodedSecret).not.toContain('/');
    expect(encodedSecret).not.toContain('=');
  });

  it('is deterministic: same inputs → same payload', () => {
    const a = encodeSyncQrPayload(ROOM_ID, ROOM_SECRET);
    const b = encodeSyncQrPayload(ROOM_ID, ROOM_SECRET);
    expect(a).toBe(b);
  });
});

describe('encoding edge cases', () => {
  it('round-trips a secret containing +, /, and = characters', () => {
    // These are the exact characters that motivated the base64url choice.
    const tricky = 'a+b/c=d';
    const payload = encodeSyncQrPayload(ROOM_ID, tricky);
    const parsed = parseSyncQrPayload(payload);
    expect(parsed.roomSecret).toBe(tricky);
  });

  it('round-trips a secret with multi-byte UTF-8 characters', () => {
    const unicode = 'pässwörd-日本語-🔐';
    const payload = encodeSyncQrPayload(ROOM_ID, unicode);
    const parsed = parseSyncQrPayload(payload);
    expect(parsed.roomSecret).toBe(unicode);
  });

  it('round-trips a base64url-encoded 256-bit key as the secret', () => {
    // A plausible RoomSecret for the "scanned 256-bit key" branch of the spec.
    const keySecret = 'c29tZV9yYW5kb21fMjU2X2JpdF9rZXlfaGVyZQ';
    const payload = encodeSyncQrPayload(ROOM_ID, keySecret);
    const parsed = parseSyncQrPayload(payload);
    expect(parsed.roomSecret).toBe(keySecret);
  });

  it('encode rejects empty roomSecret (it would decode to empty bytes)', () => {
    expect(() => encodeSyncQrPayload(ROOM_ID, '')).toThrow(InvalidQrPayloadError);
  });

  it('encode rejects empty roomId', () => {
    expect(() => encodeSyncQrPayload('', ROOM_SECRET)).toThrow(InvalidQrPayloadError);
  });

  it('encode rejects a roomId containing a colon', () => {
    expect(() => encodeSyncQrPayload('room:with:colons', ROOM_SECRET)).toThrow(
      InvalidQrPayloadError,
    );
  });

  it('encode rejects a roomId with other unsafe chars', () => {
    expect(() => encodeSyncQrPayload('room/with/slashes', ROOM_SECRET)).toThrow(
      InvalidQrPayloadError,
    );
    expect(() => encodeSyncQrPayload('room with space', ROOM_SECRET)).toThrow(
      InvalidQrPayloadError,
    );
  });
});

describe('version handling', () => {
  it('accepts v1', () => {
    const payload = encodeSyncQrPayload(ROOM_ID, ROOM_SECRET);
    expect(() => parseSyncQrPayload(payload)).not.toThrow();
    expect(parseSyncQrPayload(payload).version).toBe(1);
  });

  it('rejects v2 with a "not supported" message (does not crash)', () => {
    const validSecret = payload => payload.split(':')[3];
    const base = encodeSyncQrPayload(ROOM_ID, ROOM_SECRET);
    const v2 = base.replace(':v1:', ':v2:');
    expect(validSecret(v2)).toBe(validSecret(base));
    expect(() => parseSyncQrPayload(v2)).toThrow(InvalidQrPayloadError);
    expect(() => parseSyncQrPayload(v2)).toThrow(/not supported/i);
  });

  it('rejects v0', () => {
    const payload = encodeSyncQrPayload(ROOM_ID, ROOM_SECRET).replace(':v1:', ':v0:');
    expect(() => parseSyncQrPayload(payload)).toThrow(InvalidQrPayloadError);
  });

  it('rejects vX (non-numeric version)', () => {
    const payload = encodeSyncQrPayload(ROOM_ID, ROOM_SECRET).replace(':v1:', ':vX:');
    expect(() => parseSyncQrPayload(payload)).toThrow(InvalidQrPayloadError);
    expect(() => parseSyncQrPayload(payload)).toThrow(/malformed|version/i);
  });

  it('rejects a missing version field (bare prefix)', () => {
    // Missing the colon-delimited version means fewer parts overall.
    const payload = `${SYNC_QR_PREFIX}:${ROOM_ID}`;
    expect(() => parseSyncQrPayload(payload)).toThrow(InvalidQrPayloadError);
  });

  it('rejects a version field without the v prefix', () => {
    const payload = buildPayload(SYNC_QR_PREFIX, '1', ROOM_ID, 'YWJj');
    expect(() => parseSyncQrPayload(payload)).toThrow(InvalidQrPayloadError);
  });
});

describe('prefix handling', () => {
  it('rejects a payload with the wrong prefix', () => {
    const valid = encodeSyncQrPayload(ROOM_ID, ROOM_SECRET);
    const wrong = valid.replace(`${SYNC_QR_PREFIX}:`, 'other-app:');
    expect(() => parseSyncQrPayload(wrong)).toThrow(InvalidQrPayloadError);
    expect(() => parseSyncQrPayload(wrong)).toThrow(/prefix/i);
  });

  it('rejects a payload with no prefix at all', () => {
    const payload = `v1:${ROOM_ID}:YWJj`;
    expect(() => parseSyncQrPayload(payload)).toThrow(InvalidQrPayloadError);
  });
});

describe('malformed payloads (one test per error path)', () => {
  it('rejects an empty string', () => {
    expect(() => parseSyncQrPayload('')).toThrow(InvalidQrPayloadError);
  });

  it('rejects just the prefix (no colons)', () => {
    expect(() => parseSyncQrPayload(SYNC_QR_PREFIX)).toThrow(InvalidQrPayloadError);
  });

  it('rejects just the prefix with a trailing colon', () => {
    expect(() => parseSyncQrPayload(`${SYNC_QR_PREFIX}:`)).toThrow(InvalidQrPayloadError);
  });

  it('rejects too few colon-separated parts', () => {
    // prefix:v1:roomId  (3 parts)
    const payload = `${SYNC_QR_PREFIX}:v1:${ROOM_ID}`;
    expect(() => parseSyncQrPayload(payload)).toThrow(/4 colon-delimited parts/i);
  });

  it('rejects too many colon-separated parts', () => {
    const valid = encodeSyncQrPayload(ROOM_ID, ROOM_SECRET);
    // Append an extra :trailing segment
    expect(() => parseSyncQrPayload(`${valid}:extra`)).toThrow(/4 colon-delimited parts/i);
  });

  it('rejects an empty roomId (between two colons)', () => {
    const payload = buildPayload(SYNC_QR_PREFIX, 'v1', '', 'YWJj');
    expect(() => parseSyncQrPayload(payload)).toThrow(/roomId is empty/i);
  });

  it('rejects a roomId containing a colon-equivalent unsafe char', () => {
    // Colons can't appear in a single split-part, but other unsafe chars
    // (space, slash) still must be rejected by the alphabet check.
    const payload = buildPayload(SYNC_QR_PREFIX, 'v1', 'room id', 'YWJj');
    expect(() => parseSyncQrPayload(payload)).toThrow(/roomId.*outside/i);
  });

  it('rejects a roomSecret that is not valid base64url (contains +)', () => {
    // `+` is valid standard base64 but not base64url.
    const payload = buildPayload(SYNC_QR_PREFIX, 'v1', ROOM_ID, 'a+b+c');
    expect(() => parseSyncQrPayload(payload)).toThrow(/not valid base64url/i);
  });

  it('rejects a roomSecret that is not valid base64url (contains /)', () => {
    const payload = buildPayload(SYNC_QR_PREFIX, 'v1', ROOM_ID, 'a/b/c');
    expect(() => parseSyncQrPayload(payload)).toThrow(/not valid base64url/i);
  });

  it('rejects a roomSecret that decodes to empty bytes', () => {
    const payload = buildPayload(SYNC_QR_PREFIX, 'v1', ROOM_ID, '');
    expect(() => parseSyncQrPayload(payload)).toThrow(/roomSecret is empty/i);
  });

  it('rejects a non-string payload', () => {
    expect(() => parseSyncQrPayload(null as unknown as string)).toThrow(
      InvalidQrPayloadError,
    );
    expect(() => parseSyncQrPayload(undefined as unknown as string)).toThrow(
      InvalidQrPayloadError,
    );
  });
});

describe('isSyncQrPayload (non-throwing)', () => {
  it('returns true for a valid payload', () => {
    const payload = encodeSyncQrPayload(ROOM_ID, ROOM_SECRET);
    expect(isSyncQrPayload(payload)).toBe(true);
  });

  it('returns false for an empty string', () => {
    expect(isSyncQrPayload('')).toBe(false);
  });

  it('returns false for a payload with the wrong prefix', () => {
    const valid = encodeSyncQrPayload(ROOM_ID, ROOM_SECRET);
    expect(isSyncQrPayload(valid.replace(SYNC_QR_PREFIX, 'other'))).toBe(false);
  });

  it('returns false for a payload with an unsupported version', () => {
    const v2 = encodeSyncQrPayload(ROOM_ID, ROOM_SECRET).replace(':v1:', ':v2:');
    expect(isSyncQrPayload(v2)).toBe(false);
  });

  it('returns false for a payload with the wrong number of parts', () => {
    expect(isSyncQrPayload(`${SYNC_QR_PREFIX}:v1:${ROOM_ID}`)).toBe(false);
  });

  it('returns false for a payload with an invalid base64url secret', () => {
    const payload = buildPayload(SYNC_QR_PREFIX, 'v1', ROOM_ID, 'a+b+c');
    expect(isSyncQrPayload(payload)).toBe(false);
  });

  it('returns false for a non-string (without throwing)', () => {
    expect(isSyncQrPayload(null as unknown as string)).toBe(false);
  });
});

describe('tolerance: extra base64 padding', () => {
  it('accepts a roomSecret that an over-elegant encoder padded with =', () => {
    // base64url officially omits padding, but some encoders add it. We strip
    // trailing `=` before validating the alphabet and decoding.
    const valid = encodeSyncQrPayload(ROOM_ID, ROOM_SECRET);
    const encoded = valid.split(':')[3];
    const padded = encoded + '==';
    const payload = buildPayload(SYNC_QR_PREFIX, 'v1', ROOM_ID, padded);
    expect(() => parseSyncQrPayload(payload)).not.toThrow();
    expect(parseSyncQrPayload(payload).roomSecret).toBe(ROOM_SECRET);
  });
});

describe('InvalidQrPayloadError', () => {
  it('is a named Error subclass suitable for instanceof checks', () => {
    let caught: unknown = null;
    try {
      parseSyncQrPayload('garbage');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(InvalidQrPayloadError);
    expect(caught).toBeInstanceOf(Error);
    expect((caught as InvalidQrPayloadError).name).toBe('InvalidQrPayloadError');
  });
});
