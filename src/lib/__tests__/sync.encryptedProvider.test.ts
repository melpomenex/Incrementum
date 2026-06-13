import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import { WebSocketServer, WebSocket as WsWebSocket } from "ws";
import { WebsocketProvider } from "y-websocket";
import {
  EncryptedWebsocketProvider,
  __encryptedSyncMessageType,
} from "../sync/encryptedProvider";
import {
  deriveRoomKey,
  deriveSubKeys,
  __test as encryptionTest,
} from "../sync/encryption";

const ROOM_SECRET = "correct horse battery staple";
const ROOM_ID = "encrypted-provider-test-room";

async function makeStateKey(
  secret: string = ROOM_SECRET,
  roomId: string = ROOM_ID,
): Promise<CryptoKey> {
  const roomKey = await deriveRoomKey(secret, roomId);
  const sub = await deriveSubKeys(roomKey, roomId);
  return sub.stateKey;
}

/**
 * A relay that forwards every incoming binary frame to every other connection
 * in the same room, without inspecting the message-type byte. This models the
 * relay behavior the design doc assumes ("forwards opaque bytes") and is what a
 * real E2EE deployment must run: the stock y-websocket relay only handles
 * messageSync/messageAwareness and would drop our encrypted frames.
 *
 * Rooms are keyed by the WebSocket URL path.
 */
function startOpaqueRelay(port: number): { close: () => Promise<void> } {
  const wss = new WebSocketServer({ port });
  const rooms = new Map<string, Set<WsWebSocket>>();

  wss.on("connection", (ws, req) => {
    const room = req.url ?? "/";
    let conns = rooms.get(room);
    if (!conns) {
      conns = new Set();
      rooms.set(room, conns);
    }
    conns.add(ws);

    ws.on("message", (data, isBinary) => {
      for (const peer of conns!) {
        if (peer === ws) continue;
        if (peer.readyState === WsWebSocket.OPEN) {
          peer.send(data, { binary: isBinary });
        }
      }
    });

    ws.on("close", () => {
      conns?.delete(ws);
    });
  });

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        wss.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

function waitFor(
  predicate: () => boolean,
  timeoutMs = 3000,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) {
        return reject(new Error("waitFor timed out"));
      }
      setTimeout(tick, 20);
    };
    tick();
  });
}

// jsdom does not provide a global WebSocket. y-websocket's polyfill needs one,
// so we route it through `ws`.
function installGlobalWebSocket(): void {
  (globalThis as { WebSocket?: typeof WebSocket }).WebSocket =
    WsWebSocket as unknown as typeof WebSocket;
}

describe("EncryptedWebsocketProvider", () => {
  let relay: { close: () => Promise<void> } | null = null;
  let port: number;

  beforeEach(() => {
    encryptionTest.resetStateCounterForTesting();
    encryptionTest.resetDevicePrefixForTesting();
    installGlobalWebSocket();
    port = 30000 + Math.floor(Math.random() * 9999);
    relay = startOpaqueRelay(port);
  });

  afterEach(async () => {
    await relay?.close().catch(() => {});
    relay = null;
  });

  it("round-trips state between two providers sharing the same stateKey", async () => {
    const stateKey = await makeStateKey();
    const url = `ws://localhost:${port}`;
    const room = "rt-room";

    const docA = new Y.Doc();
    const docB = new Y.Doc();

    const provA = new EncryptedWebsocketProvider(
      WebsocketProvider,
      url,
      room,
      docA,
      stateKey,
    );
    const provB = new EncryptedWebsocketProvider(
      WebsocketProvider,
      url,
      room,
      docB,
      stateKey,
    );

    try {
      await waitFor(() => provA.wsconnected && provB.wsconnected);

      const mapA = docA.getMap<string>("data");
      mapA.set("greeting", "hello from A");

      // B's doc should converge to A's value.
      await waitFor(() => docB.getMap<string>("data").get("greeting") === "hello from A");
      expect(docB.getMap<string>("data").get("greeting")).toBe("hello from A");
    } finally {
      provA.destroy();
      provB.destroy();
      docA.destroy();
      docB.destroy();
    }
  });

  it("drops inbound messages when the stateKey does not match (no crash, doc unchanged)", async () => {
    const keyA = await makeStateKey("passphrase-A", ROOM_ID);
    const keyB = await makeStateKey("passphrase-B", ROOM_ID); // different secret -> different key
    const url = `ws://localhost:${port}`;
    const room = "mismatch-room";

    const docA = new Y.Doc();
    const docB = new Y.Doc();

    const provA = new EncryptedWebsocketProvider(
      WebsocketProvider,
      url,
      room,
      docA,
      keyA,
    );
    const provB = new EncryptedWebsocketProvider(
      WebsocketProvider,
      url,
      room,
      docB,
      keyB,
    );

    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    try {
      await waitFor(() => provA.wsconnected && provB.wsconnected);

      const mapA = docA.getMap<string>("data");
      mapA.set("secret", "should-not-arrive");

      // Give B a window to (fail to) decrypt. We cannot assert on the absence
      // of an event directly; instead wait long enough that a successful
      // delivery would have landed, then assert the doc is untouched.
      await new Promise((r) => setTimeout(r, 500));

      expect(docB.getMap<string>("data").get("secret")).toBeUndefined();

      // The wrapper must have logged at least one decrypt-failure warning.
      const warned = warnSpy.mock.calls.some((c) =>
        String(c[0]).includes("decryption failed"),
      );
      expect(warned).toBe(true);
    } finally {
      warnSpy.mockRestore();
      provA.destroy();
      provB.destroy();
      docA.destroy();
      docB.destroy();
    }
  });

  it("does not leak plaintext Yjs update bytes onto the wire", async () => {
    const stateKey = await makeStateKey();
    const url = `ws://localhost:${port}`;
    const room = "leak-room";

    // A bare ws client that records everything the relay would forward.
    const captured: Uint8Array[] = [];
    const sniffer = new WsWebSocket(`${url}/${room}`);
    sniffer.binaryType = "arraybuffer";
    sniffer.on("message", (data) => {
      captured.push(new Uint8Array(data as ArrayBuffer));
    });

    const docA = new Y.Doc();
    const provA = new EncryptedWebsocketProvider(
      WebsocketProvider,
      url,
      room,
      docA,
      stateKey,
    );

    try {
      await waitFor(() => provA.wsconnected && sniffer.readyState === WsWebSocket.OPEN);

      const marker = "PLAINTEXT-MARKER-SHOULD-NOT-APPEAR-ON-WIRE";
      const mapA = docA.getMap<string>("data");
      mapA.set("key", marker);

      // Wait for at least one encrypted-sync frame to flow past the sniffer.
      await waitFor(() =>
        captured.some((b) => b.length > 0 && b[0] === __encryptedSyncMessageType),
      );
      await new Promise((r) => setTimeout(r, 200));

      // None of the captured frames may contain the plaintext marker bytes.
      for (const frame of captured) {
        const frameStr = Buffer.from(frame).toString("binary");
        expect(frameStr).not.toContain(marker);
      }

      // At least one frame must be an encrypted-sync frame (message type 0x10).
      const sawEncryptedType = captured.some(
        (b) => b.length > 0 && b[0] === __encryptedSyncMessageType,
      );
      expect(sawEncryptedType).toBe(true);
    } finally {
      provA.destroy();
      docA.destroy();
      sniffer.close();
    }
  });

  it("logs and drops garbage on the inbound path instead of throwing", async () => {
    const stateKey = await makeStateKey();
    const url = `ws://localhost:${port}`;
    const room = "garbage-room";

    const docB = new Y.Doc();
    const provB = new EncryptedWebsocketProvider(
      WebsocketProvider,
      url,
      room,
      docB,
      stateKey,
    );

    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    // A bare client that injects an encrypted-sync frame with garbage payload.
    const attacker = new WsWebSocket(`${url}/${room}`);
    attacker.binaryType = "arraybuffer";

    try {
      await waitFor(
        () => provB.wsconnected && attacker.readyState === WsWebSocket.OPEN,
      );

      const before = docB.getMap<string>("data").get("anything");
      expect(before).toBeUndefined();

      // Build a properly-framed encrypted-sync message whose ciphertext body
      // is garbage that cannot decrypt under any key: write the encrypted-sync
      // message-type byte, then a varuint-length-prefixed blob of random bytes
      // too short to hold a valid AES-GCM nonce+tag.
      const garbagePayload = new Uint8Array(8);
      crypto.getRandomValues(garbagePayload);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, __encryptedSyncMessageType);
      encoding.writeVarUint8Array(encoder, garbagePayload);
      attacker.send(encoding.toUint8Array(encoder));

      // Give the decrypt pipeline time to run and fail.
      await new Promise((r) => setTimeout(r, 300));

      const warned = warnSpy.mock.calls.some((c) =>
        String(c[0]).includes("dropping inbound message"),
      );
      expect(warned).toBe(true);

      // Doc must be unchanged and no uncaught rejection should surface.
      expect(docB.getMap<string>("data").get("anything")).toBeUndefined();
    } finally {
      warnSpy.mockRestore();
      provB.destroy();
      docB.destroy();
      attacker.close();
    }
  });
});
