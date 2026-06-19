import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the database module so we exercise the handler logic (sha256 dedup,
// data-URL assembly, field mapping) without a real IndexedDB.
vi.mock("../database", () => {
  const store = new Map<string, any>();
  return {
    __clearStoreForTest: () => store.clear(),
    createImageAsset: vi.fn(async (asset: any) => {
      const record = { id: `img-${Math.random().toString(36).slice(2)}`, ...asset };
      store.set(record.id, record);
      return record;
    }),
    getImageAsset: vi.fn(async (id: string) => store.get(id) ?? null),
    findImageAssetBySha256: vi.fn(async (sha256: string) => {
      for (const record of store.values()) {
        if (record.sha256 === sha256) return record;
      }
      return null;
    }),
    listImageAssets: vi.fn(async () => Array.from(store.values())),
    deleteImageAsset: vi.fn(async (id: string) => {
      store.delete(id);
    }),
    // Also used by the extract-generation handler.
    getExtract: vi.fn(),
    createLearningItem: vi.fn(async (item: any) => ({ id: `li-${Math.random()}`, ...item })),
  };
});

// The extract-generation handler reads from the LLM providers store. Provide a
// controllable implementation.
vi.mock("../../stores/llmProvidersStore", () => ({
  useLLMProvidersStore: {
    getState: () => ({ providers: [] }),
  },
}));

import { browserInvoke } from "../browser-backend";
import * as db from "../database";

// A 1x1 transparent PNG. Deterministic sha256 below.
const PNG_1x1_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

describe("browser backend image registry", () => {
  beforeEach(() => {
    (db as any).__clearStoreForTest();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ingests an image asset and returns a data URL", async () => {
    const asset = await browserInvoke<any>("ingest_image_asset", {
      base64Data: PNG_1x1_BASE64,
      mimeType: "image/png",
      fileName: "pixel.png",
    });

    expect(asset.id).toBeTruthy();
    expect(asset.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(asset.mimeType).toBe("image/png");
    expect(asset.fileName).toBe("pixel.png");
    expect(asset.dataUrl).toBe(`data:image/png;base64,${PNG_1x1_BASE64}`);
    expect(asset.byteSize).toBeGreaterThan(0);
    expect(db.createImageAsset).toHaveBeenCalledTimes(1);
  });

  it("deduplicates by sha256 on a second ingest of the same bytes", async () => {
    const first = await browserInvoke<any>("ingest_image_asset", {
      base64Data: PNG_1x1_BASE64,
      mimeType: "image/png",
    });
    const second = await browserInvoke<any>("ingest_image_asset", {
      base64Data: PNG_1x1_BASE64,
      mimeType: "image/png",
    });

    expect(second.id).toBe(first.id);
    // createImageAsset should only have been called once (for the first ingest).
    expect(db.createImageAsset).toHaveBeenCalledTimes(1);
  });

  it("rejects an ingest without base64 data", async () => {
    await expect(
      browserInvoke("ingest_image_asset", { mimeType: "image/png" })
    ).rejects.toThrow(/base64Data/);
  });

  it("lists image assets with assembled data URLs", async () => {
    await browserInvoke("ingest_image_asset", {
      base64Data: PNG_1x1_BASE64,
      mimeType: "image/png",
    });

    const list = await browserInvoke<any[]>("list_image_assets", {});
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0].dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("returns null for a missing image asset", async () => {
    vi.mocked(db.getImageAsset).mockResolvedValueOnce(null);
    const result = await browserInvoke<any>("get_image_asset", { assetId: "does-not-exist" });
    expect(result).toBeNull();
  });

  it("deletes an existing image asset", async () => {
    const created = await browserInvoke<any>("ingest_image_asset", {
      base64Data: PNG_1x1_BASE64,
      mimeType: "image/png",
    });
    const result = await browserInvoke<{ deleted: boolean }>("delete_image_asset", {
      assetId: created.id,
    });
    expect(result).toEqual({ deleted: true });
    expect(db.deleteImageAsset).toHaveBeenCalledWith(created.id);
  });

  it("reports not-deleted for a missing asset", async () => {
    vi.mocked(db.getImageAsset).mockResolvedValueOnce(null);
    const result = await browserInvoke<{ deleted: boolean; reason?: string }>(
      "delete_image_asset",
      { assetId: "ghost" }
    );
    expect(result.deleted).toBe(false);
  });
});
