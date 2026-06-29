import { describe, it, expect } from "vitest";
import {
  decodeFileTransferFrame,
  // encodeControlFrame and encodeChunkFrame are not exported (they're internal
  // to the manager), so this test exercises the codec via the public decoder
  // and hand-built frames. The manager-level round-trip is covered by the
  // integration test in SyncSettings.join / yjsSync.rejoin suites.
} from "../file-transfer";

// The wire constants mirror file-transfer.ts. Duplicated here intentionally so
// a protocol regression can't be hidden by importing from the module under test
// (if someone renames the constant, the literal here still encodes the
// documented on-wire value and the test catches the divergence).
const FILE_TRANSFER_TYPE = 0x20;

function buildFrame(subtype: number, fields: (number[] | Uint8Array)[]): Uint8Array {
  const parts: number[][] = [[FILE_TRANSFER_TYPE, subtype]];
  for (const f of fields) {
    parts.push(Array.from(f));
  }
  return new Uint8Array(parts.flat());
}

function u32(value: number): number[] {
  const v = value >>> 0;
  return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
}

function lp(str: string): number[] {
  const enc = Array.from(new TextEncoder().encode(str));
  return [...u32(enc.length), ...enc];
}

describe("file-transfer binary protocol codec", () => {
  it("decodes a file-request frame (subtype 0x01)", () => {
    const frame = buildFrame(0x01, [
      lp("req-1"),
      lp("file-abc"),
      lp("device-7"),
    ]);
    const msg = decodeFileTransferFrame(frame);
    expect(msg).toEqual({
      type: "file-request",
      requestId: "req-1",
      fileId: "file-abc",
      requesterDeviceId: "device-7",
    });
  });

  it("decodes a file-response frame with accepted flag + totalChunks (subtype 0x02)", () => {
    const accepted = 1; // true
    const total = 42;
    const frame = buildFrame(0x02, [lp("req-1"), [accepted], u32(total)]);
    const msg = decodeFileTransferFrame(frame);
    expect(msg).toEqual({
      type: "file-response",
      requestId: "req-1",
      accepted: true,
      totalChunks: 42,
    });
  });

  it("decodes a rejected file-response (accepted=0)", () => {
    const frame = buildFrame(0x02, [lp("req-1"), [0], u32(0)]);
    const msg = decodeFileTransferFrame(frame);
    expect(msg).toMatchObject({ accepted: false, totalChunks: 0 });
  });

  it("decodes a file-chunk frame with raw payload bytes (subtype 0x03)", () => {
    const payload = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02]);
    const frame = buildFrame(0x03, [lp("req-9"), u32(3), u32(10), Array.from(payload)]);
    const msg = decodeFileTransferFrame(frame);
    expect(msg).toEqual({
      type: "file-chunk",
      requestId: "req-9",
      chunkIndex: 3,
      totalChunks: 10,
      data: payload,
    });
  });

  it("decodes a file-complete frame (subtype 0x04)", () => {
    const frame = buildFrame(0x04, [lp("req-done")]);
    const msg = decodeFileTransferFrame(frame);
    expect(msg).toEqual({ type: "file-complete", requestId: "req-done" });
  });

  it("decodes a file-error frame with a UTF-8 message (subtype 0x05)", () => {
    const frame = buildFrame(0x05, [lp("req-x"), lp("transfer cancelled")]);
    const msg = decodeFileTransferFrame(frame);
    expect(msg).toEqual({
      type: "file-error",
      requestId: "req-x",
      error: "transfer cancelled",
    });
  });

  it("returns null for non-file-transfer frames (wrong type byte)", () => {
    // A yjs sync frame starts with 0x00 — must NOT be consumed.
    const syncFrame = new Uint8Array([0x00, 0x01, 0x02]);
    expect(decodeFileTransferFrame(syncFrame)).toBeNull();
    // An awareness frame starts with 0x01.
    const awarenessFrame = new Uint8Array([0x01, 0x00]);
    expect(decodeFileTransferFrame(awarenessFrame)).toBeNull();
  });

  it("returns null for an unknown subtype (forward-compat / graceful drop)", () => {
    const frame = buildFrame(0xff, [lp("future")]);
    expect(decodeFileTransferFrame(frame)).toBeNull();
  });

  it("returns null (does not throw) on a truncated frame", () => {
    // A response frame missing the totalChunks u32.
    const frame = buildFrame(0x02, [lp("req-1"), [1]]);
    expect(decodeFileTransferFrame(frame)).toBeNull();
  });

  it("returns null for a too-short frame (< 2 bytes)", () => {
    expect(decodeFileTransferFrame(new Uint8Array([0x20]))).toBeNull();
    expect(decodeFileTransferFrame(new Uint8Array([]))).toBeNull();
  });

  it("round-trips chunk payloads containing all byte values (0x00..0xff)", () => {
    // Verifies no byte-stuffing/escaping assumption: raw bytes go through
    // untouched, including 0x00 and 0xff which some protocols misread.
    const payload = new Uint8Array(256);
    for (let i = 0; i < 256; i++) payload[i] = i;
    const frame = buildFrame(0x03, [lp("r"), u32(0), u32(1), Array.from(payload)]);
    const msg = decodeFileTransferFrame(frame);
    expect(msg?.type).toBe("file-chunk");
    expect(Array.from((msg as { data: Uint8Array }).data)).toEqual(Array.from(payload));
  });
});
