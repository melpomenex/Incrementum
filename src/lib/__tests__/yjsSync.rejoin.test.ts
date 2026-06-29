import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Unit tests for rejoinRoom() — the in-process room switch that lets the
 * scan-to-join flow change rooms without a page reload.
 *
 * y-websocket / y-indexeddb / the crypto layer are mocked so these tests
 * exercise the orchestration logic (tear down old instance, write room ID,
 * rebuild against new room) rather than real Yjs replication. The crypto
 * mocks return null sub-keys so buildProvider takes the plain-provider branch.
 */

// --- Mocks --------------------------------------------------------------

// Track the constructor calls so each test can assert which room the provider
// was built against and that disconnect() ran.
let lastBuiltRoom: string | null = null;
let disconnectCalls = 0;
let providerConstructionCount = 0;

const mockProvider = {
  shouldConnect: true,
  wsconnected: false,
  connect: vi.fn(() => {
    mockProvider.wsconnected = true;
  }),
  disconnect: vi.fn(() => {
    disconnectCalls += 1;
    mockProvider.wsconnected = false;
  }),
  on: vi.fn(),
  off: vi.fn(),
  ws: undefined as unknown,
};

// A real constructable (a class body) so `new WebsocketProvider(...)` works.
// vi.fn().mockImplementation is not reliably `new`-able here, so we define a
// class and re-export the spy via a factory.
class MockWebsocketProvider {
  constructor(_url: string, room: string) {
    lastBuiltRoom = room;
    providerConstructionCount += 1;
    Object.assign(this, mockProvider);
  }
}

vi.mock("y-websocket", () => ({
  WebsocketProvider: MockWebsocketProvider,
}));

vi.mock("y-indexeddb", () => ({
  IndexeddbPersistence: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    clearData: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
  })),
}));

vi.mock("../sync/roomCrypto", () => ({
  // null → buildProvider takes the plain WebsocketProvider branch.
  getCachedSubKeys: vi.fn().mockResolvedValue(null),
}));

// Prevent the corruption check from installing a real window.onerror handler
// and from touching storage in unexpected ways.
vi.mock("../sync/encryptedProvider", () => ({
  EncryptedWebsocketProvider: vi.fn(),
}));

// --- Setup ---------------------------------------------------------------

const ROOM_KEY = "incrementum_sync_room";

beforeEach(async () => {
  vi.clearAllMocks();
  lastBuiltRoom = null;
  disconnectCalls = 0;
  providerConstructionCount = 0;
  mockProvider.wsconnected = false;
  localStorage.clear();

  const { resetYjsSync } = await import("../yjsSync");
  await resetYjsSync();
});

afterEach(async () => {
  const { resetYjsSync } = await import("../yjsSync");
  await resetYjsSync();
});

// --- Tests ---------------------------------------------------------------

describe("rejoinRoom", () => {
  it("builds the provider against the requested room", async () => {
    const { rejoinRoom } = await import("../yjsSync");
    await rejoinRoom("room-new");
    expect(lastBuiltRoom).toBe("room-new");
    expect(providerConstructionCount).toBe(1);
  });

  it("writes the new room id to localStorage", async () => {
    const { rejoinRoom } = await import("../yjsSync");
    await rejoinRoom("persisted-room");
    expect(localStorage.getItem(ROOM_KEY)).toBe("persisted-room");
  });

  it("tears down the previous instance before rebuilding", async () => {
    const { getYjsSync, rejoinRoom } = await import("../yjsSync");
    // Establish a first instance.
    await getYjsSync();
    expect(providerConstructionCount).toBe(1);
    expect(disconnectCalls).toBe(0);

    await rejoinRoom("second-room");

    // The old provider must have been disconnected.
    expect(disconnectCalls).toBeGreaterThanOrEqual(1);
    // And a new provider built against the new room.
    expect(lastBuiltRoom).toBe("second-room");
    expect(providerConstructionCount).toBe(2);
  });

  it("is a no-op (no teardown, no rebuild) when rejoining the current room", async () => {
    const { getYjsSync, rejoinRoom } = await import("../yjsSync");
    await getYjsSync(); // builds against whatever localStorage has
    const firstRoom = lastBuiltRoom;
    const constructionsBefore = providerConstructionCount;

    await rejoinRoom(firstRoom!);

    expect(providerConstructionCount).toBe(constructionsBefore);
    expect(lastBuiltRoom).toBe(firstRoom);
  });

  it("rejects an empty room id", async () => {
    const { rejoinRoom } = await import("../yjsSync");
    await expect(rejoinRoom("")).rejects.toThrow(/roomId is required/);
  });

  it("returns a YjsSyncState bound to the new room", async () => {
    const { rejoinRoom } = await import("../yjsSync");
    const state = await rejoinRoom("return-value-room");
    expect(state.room).toBe("return-value-room");
  });
});

describe("IndexeddbPersistence guard", () => {
  it("does not throw when indexedDB is undefined", async () => {
    const original = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
    // Simulate a WebView without IndexedDB.
    Object.defineProperty(globalThis, "indexedDB", {
      value: undefined,
      configurable: true,
    });
    try {
      const { resetYjsSync, getYjsSync } = await import("../yjsSync");
      await resetYjsSync();
      // Should resolve rather than throw.
      const state = await getYjsSync();
      // Provider still built; persistence just skipped.
      expect(state.provider).toBeDefined();
      expect(lastBuiltRoom).not.toBeNull();
    } finally {
      Object.defineProperty(globalThis, "indexedDB", {
        value: original,
        configurable: true,
      });
    }
  });
});
