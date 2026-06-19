import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../database", () => ({
  getExtract: vi.fn(),
  createLearningItem: vi.fn(async (item: any) => ({
    id: `li-${Math.random().toString(36).slice(2)}`,
    ...item,
  })),
}));

const mockProviders = { providers: [] as Array<Record<string, unknown>> };

vi.mock("../../stores/llmProvidersStore", () => ({
  useLLMProvidersStore: {
    getState: () => mockProviders,
  },
}));

import { browserInvoke } from "../browser-backend";
import * as db from "../database";

function llmResponse(content: string) {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }),
    text: async () => "",
  };
}

describe("browser backend generate_learning_items_from_extract", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProviders.providers = [
      {
        id: "p1",
        provider: "openai",
        enabled: true,
        apiKey: "sk-test",
        model: "gpt-4o",
        baseUrl: undefined,
      },
    ];
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("throws when the extract does not exist", async () => {
    vi.mocked(db.getExtract).mockResolvedValueOnce(null);
    await expect(
      browserInvoke("generate_learning_items_from_extract", { extractId: "ghost" })
    ).rejects.toThrow(/Extract ghost not found/);
  });

  it("throws a clear message when no LLM provider is configured", async () => {
    vi.mocked(db.getExtract).mockResolvedValueOnce({
      id: "e1",
      document_id: "d1",
      content: "Some text",
    } as any);
    mockProviders.providers = [];

    await expect(
      browserInvoke("generate_learning_items_from_extract", { extractId: "e1" })
    ).rejects.toThrow(/No LLM provider configured/);
  });

  it("parses the LLM response and persists qa + cloze cards", async () => {
    vi.mocked(db.getExtract).mockResolvedValueOnce({
      id: "e1",
      document_id: "d1",
      content: "The mitochondria is the powerhouse of the cell.",
    } as any);

    const cardsJson = JSON.stringify({
      cards: [
        { type: "qa", question: "What is the mitochondria?", answer: "The powerhouse of the cell." },
        { type: "cloze", text: "The {{c1::mitochondria}} is the powerhouse of the cell." },
      ],
    });

    global.fetch = vi.fn().mockResolvedValue(llmResponse("```json\n" + cardsJson + "\n```")) as typeof fetch;

    const items = await browserInvoke<any[]>("generate_learning_items_from_extract", {
      extractId: "e1",
    });

    expect(items).toHaveLength(2);
    expect(db.createLearningItem).toHaveBeenCalledTimes(2);

    // First call: the qa card, linked to the extract + document.
    const firstCall = vi.mocked(db.createLearningItem).mock.calls[0][0];
    expect(firstCall.item_type).toBe("Qa");
    expect(firstCall.question).toBe("What is the mitochondria?");
    expect(firstCall.extract_id).toBe("e1");
    expect(firstCall.document_id).toBe("d1");

    // Second call: the cloze card.
    const secondCall = vi.mocked(db.createLearningItem).mock.calls[1][0];
    expect(secondCall.item_type).toBe("Cloze");
    expect(secondCall.cloze_text).toContain("{{c1::mitochondria}}");
  });

  it("returns an empty array when the LLM emits no parseable cards", async () => {
    vi.mocked(db.getExtract).mockResolvedValueOnce({
      id: "e2",
      document_id: "d2",
      content: "Unrelated text.",
    } as any);

    global.fetch = vi.fn().mockResolvedValue(llmResponse("Sorry, I can't help with that.")) as typeof fetch;

    const items = await browserInvoke<any[]>("generate_learning_items_from_extract", {
      extractId: "e2",
    });

    expect(items).toEqual([]);
    expect(db.createLearningItem).not.toHaveBeenCalled();
  });
});
