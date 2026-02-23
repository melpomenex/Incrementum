import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildClozeFromSelection,
  buildQaFromSelection,
  createResearchSession,
  createSelectionRange,
  loadOrCreateResearchSession,
  orchestrateNotebooklmResearch,
  saveResearchDraft,
  type DocumentResearchSession,
} from "../notebooklmResearch";

const { mockNotebooklmResearch } = vi.hoisted(() => ({
  mockNotebooklmResearch: vi.fn(),
}));

vi.mock("../../../api/integrations", () => ({
  notebooklmResearch: mockNotebooklmResearch,
}));

describe("documentQa notebooklm research helpers", () => {
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

  it("builds cloze content from a validated selection", () => {
    const text = "Neurons communicate through synaptic signaling.";
    const selection = createSelectionRange(text, 0, 7);
    expect(selection).not.toBeNull();

    const cloze = buildClozeFromSelection(text, selection!);
    expect(cloze).toBe("{{Neurons}} communicate through synaptic signaling.");
  });

  it("creates qa draft from selection", () => {
    const selection = createSelectionRange("hello world", 0, 5);
    expect(selection).not.toBeNull();

    const qa = buildQaFromSelection(selection!);
    expect(qa.question).toContain("What does this passage describe");
    expect(qa.answer).toBe("hello");
  });

  it("persists and restores session drafts", () => {
    const session = loadOrCreateResearchSession("doc-1", "nb-1");
    const updated = saveResearchDraft(session, "Draft content");
    const restored = loadOrCreateResearchSession("doc-1", "nb-1");

    expect(updated.draftText).toBe("Draft content");
    expect(restored.draftText).toBe("Draft content");
    expect(restored.id).toBe(session.id);
  });

  it("orchestrates notebooklm research and appends session history", async () => {
    const session: DocumentResearchSession = createResearchSession("doc-2", "nb-1");
    mockNotebooklmResearch.mockResolvedValue({
      status: "ok",
      importedSources: 2,
      summary: "Key concepts include active recall and spacing.",
    });

    const result = await orchestrateNotebooklmResearch({
      documentId: "doc-2",
      notebookId: "nb-1",
      query: "Summarize key concepts",
      session,
      retryCount: 0,
    });

    expect(result.session.history).toHaveLength(1);
    expect(result.session.draftText).toContain("active recall");
    expect(result.event.query).toBe("Summarize key concepts");
  });
});
