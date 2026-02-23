import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NotebookLMResearchError,
  createResearchSession,
  orchestrateNotebooklmResearch,
} from "../../features/documentQa/notebooklmResearch";

const { mockNotebooklmResearch } = vi.hoisted(() => ({
  mockNotebooklmResearch: vi.fn(),
}));

vi.mock("../integrations", () => ({
  notebooklmResearch: mockNotebooklmResearch,
}));

describe("Document Q&A NotebookLM orchestration integration", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    });
    mockNotebooklmResearch.mockReset();
  });

  it("retries after transient failure and succeeds", async () => {
    const session = createResearchSession("doc-retry", "nb-1");

    mockNotebooklmResearch
      .mockRejectedValueOnce(new Error("temporary backend error"))
      .mockResolvedValueOnce({
        status: "ok",
        importedSources: 1,
        summary: "Recovered response",
      });

    const result = await orchestrateNotebooklmResearch({
      documentId: "doc-retry",
      notebookId: "nb-1",
      query: "retry me",
      session,
      retryCount: 1,
      timeoutMs: 5000,
    });

    expect(mockNotebooklmResearch).toHaveBeenCalledTimes(2);
    expect(result.session.history.at(-1)?.summary).toBe("Recovered response");
  });

  it("throws rate limit error for back-to-back requests", async () => {
    const session = createResearchSession("doc-rate", "nb-1");
    mockNotebooklmResearch.mockResolvedValue({
      status: "ok",
      importedSources: 1,
      summary: "first",
    });

    await orchestrateNotebooklmResearch({
      documentId: "doc-rate",
      notebookId: "nb-1",
      query: "first request",
      session,
      retryCount: 0,
    });

    await expect(
      orchestrateNotebooklmResearch({
        documentId: "doc-rate",
        notebookId: "nb-1",
        query: "second request",
        session,
        retryCount: 0,
      }),
    ).rejects.toBeInstanceOf(NotebookLMResearchError);
  });
});
