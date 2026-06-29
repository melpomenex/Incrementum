import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import * as React from "react";

/**
 * Scan-to-join wiring tests for SyncSettings.
 *
 * These exercise the real handleJoinRoom logic through the SyncQrScanner
 * mock: when the scanner "detects" a value, the component should parse it,
 * write the room id, and call rejoinRoom — with no manual "Join" tap and no
 * reload. The heavy dependencies (y-websocket replication, yjsSync internals,
 * the settings store, the legacy sync API, QR rendering) are mocked so we test
 * the join orchestration in isolation.
 */

// Capture the most recently rendered SyncQrScanner's onDetected so a test can
// simulate a scan by invoking it.
let lastOnDetected: ((value: string) => Promise<boolean> | boolean) | null = null;

// vi.hoisted() runs before vi.mock factory execution, so the mocks defined here
// are available inside the (hoisted) vi.mock factories below.
const mocks = vi.hoisted(() => {
  return {
    scanner: vi.fn(),
    setSyncRoomId: vi.fn(),
    rejoinRoom: vi.fn().mockResolvedValue({
      doc: {},
      provider: {},
      persistence: null,
      url: "wss://example",
      room: "",
      encrypted: false,
    }),
    getSyncRoomId: vi.fn().mockReturnValue("initial-room-1234"),
    createNewSyncRoomId: vi.fn().mockReturnValue("rotated-room"),
    enableEncryptionWithSecret: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../SyncQrScanner", () => ({
  SyncQrScanner: mocks.scanner.mockImplementation((props: {
    onDetected: (v: string) => Promise<boolean> | boolean;
    onClose: () => void;
  }) => {
    // Capture on every render so the test uses the live callback. onClose is
    // exercised by the real component (it sets showScanner=false); we don't
    // assert on it here.
    lastOnDetected = props.onDetected;
    return React.createElement("div", { "data-testid": "mock-scanner" });
  }),
}));

vi.mock("../../../lib/yjsSync", () => ({
  setSyncRoomId: mocks.setSyncRoomId,
  getSyncRoomId: mocks.getSyncRoomId,
  createNewSyncRoomId: mocks.createNewSyncRoomId,
  rejoinRoom: mocks.rejoinRoom,
}));

vi.mock("../../../lib/sync/roomCrypto", () => ({
  enableEncryption: vi.fn().mockResolvedValue("generated-secret"),
  enableEncryptionWithSecret: mocks.enableEncryptionWithSecret,
  disableEncryption: vi.fn().mockResolvedValue(undefined),
  isEncryptionEnabled: vi.fn().mockResolvedValue(false),
  getCachedRoomSecretOrNull: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../stores/settingsStore", () => ({
  useSettingsStore: () => ({
    settings: { sync: { autoDownloadMode: "wifi-only" } },
    updateSettings: vi.fn(),
  }),
}));

vi.mock("../../../lib/i18n", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

vi.mock("qrcode.react", () => ({
  QRCodeCanvas: () => null,
}));

import { SyncSettings } from "../SyncSettings";

beforeEach(() => {
  vi.clearAllMocks();
  lastOnDetected = null;
  localStorage.clear();
});

async function renderToScanner() {
  render(React.createElement(SyncSettings));
}

describe("SyncSettings scan-to-join", () => {
  it("joins a scanned bare room id without a manual Join tap", async () => {
    // Force standalone display mode so the Scan button renders.
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
      matches: query.includes("standalone"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as MediaQueryList);

    render(React.createElement(SyncSettings));

    // Click the Scan button to mount the (mocked) scanner.
    const scanButtons = screen.getAllByRole("button", { name: /scan/i });
    await act(async () => {
      scanButtons[0]?.click();
    });

    await waitFor(() => expect(lastOnDetected).not.toBeNull());

    // Simulate a scan of a bare room id.
    let accepted = false;
    await act(async () => {
      accepted = !!(await lastOnDetected!("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"));
    });

    expect(accepted).toBe(true);
    expect(mocks.setSyncRoomId).toHaveBeenCalledWith("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6");
    expect(mocks.rejoinRoom).toHaveBeenCalledWith("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6");
  });

  it("returns false (keeps scanner open) for an empty scanned value", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
      matches: query.includes("standalone"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as MediaQueryList);

    render(React.createElement(SyncSettings));
    const scanButtons = screen.getAllByRole("button", { name: /scan/i });
    await act(async () => {
      scanButtons[0]?.click();
    });
    await waitFor(() => expect(lastOnDetected).not.toBeNull());

    let accepted = true;
    await act(async () => {
      accepted = !!(await lastOnDetected!("   "));
    });

    expect(accepted).toBe(false);
    expect(mocks.setSyncRoomId).not.toHaveBeenCalled();
    expect(mocks.rejoinRoom).not.toHaveBeenCalled();
  });
});

// Silence the unused-warning for the helper while keeping the file readable.
void renderToScanner;
