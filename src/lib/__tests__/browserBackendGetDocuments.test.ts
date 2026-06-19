import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../database", () => ({
  getDocuments: vi.fn(),
}));

vi.mock("../../stores/llmProvidersStore", () => ({
  useLLMProvidersStore: { getState: () => ({ providers: [] }) },
}));

import { browserInvoke } from "../browser-backend";
import * as db from "../database";

describe("browser backend get_documents collection filter", () => {
  const DEFAULT_COLLECTION_ID = "00000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("includes documents with no collection_id when filtering by the default collection", async () => {
    // Browser imports create documents without a collection_id.
    vi.mocked(db.getDocuments).mockResolvedValue([
      { id: "d1", title: "Imported doc", collection_id: undefined } as any,
      { id: "d2", title: "Explicit default", collection_id: DEFAULT_COLLECTION_ID } as any,
      { id: "d3", title: "Other collection", collection_id: "other-collection" } as any,
    ]);

    const docs = await browserInvoke<any[]>("get_documents", {
      collectionId: DEFAULT_COLLECTION_ID,
    });

    const ids = docs.map((d) => d.id);
    expect(ids).toEqual(["d1", "d2"]);
    expect(ids).not.toContain("d3");
  });

  it("returns all documents when no collectionId is requested", async () => {
    vi.mocked(db.getDocuments).mockResolvedValue([
      { id: "d1", title: "A", collection_id: undefined } as any,
      { id: "d2", title: "B", collection_id: "other" } as any,
    ]);

    const docs = await browserInvoke<any[]>("get_documents", { collectionId: null });
    expect(docs.map((d) => d.id)).toEqual(["d1", "d2"]);
  });
});
