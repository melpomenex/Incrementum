import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { FileManifest } from "../file-manifest";

const DEVICE_ID_KEY = "incrementum_device_id";

function setPresence(doc: Y.Doc, deviceId: string, lastSeen: string, hasFiles: string[]): void {
  const devices = doc.getMap("devicePresence") as Y.Map<Record<string, unknown>>;
  devices.set(deviceId, { deviceId, lastSeen, hasFiles });
}

describe("FileManifest device availability", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(DEVICE_ID_KEY, "device-local");
    vi.useRealTimers();
  });

  it("can exclude the current device from file availability", () => {
    const manifest = new FileManifest(new Y.Doc());
    manifest.updateMyPresence(["file-1"]);

    expect(manifest.isFileAvailable("file-1")).toBe(true);
    expect(manifest.findDevicesWithFile("file-1", { excludeDeviceId: "device-local" })).toEqual([]);
    expect(manifest.isFileAvailable("file-1", { excludeDeviceId: "device-local" })).toBe(false);
  });

  it("filters stale device presence by default", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-30T12:00:00.000Z"));
    const doc = new Y.Doc();
    const manifest = new FileManifest(doc);

    setPresence(doc, "device-old", "2026-06-30T11:57:30.000Z", ["file-1"]);
    setPresence(doc, "device-fresh", "2026-06-30T11:59:30.000Z", ["file-1"]);

    expect(manifest.findDevicesWithFile("file-1").map((d) => d.deviceId)).toEqual(["device-fresh"]);
    expect(manifest.findDevicesWithFile("file-1", { includeStale: true }).map((d) => d.deviceId)).toEqual([
      "device-old",
      "device-fresh",
    ]);
  });
});
