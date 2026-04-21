import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { browserInvoke } from "../browser-backend";

describe("browser backend model discovery", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("loads a custom llama.cpp model from a local OpenAI-compatible /models endpoint without an API key", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: "Qwopus3.5-27B-v3.5" },
        ],
      }),
    }) as typeof fetch;

    const models = await browserInvoke<Array<{ id: string; name: string }>>("llm_get_models", {
      provider: "openai",
      baseUrl: "http://localhost:8080/v1",
      apiKey: "",
    });

    expect(global.fetch).toHaveBeenCalledWith("http://localhost:8080/v1/models", { headers: {} });
    expect(models).toEqual([
      {
        id: "Qwopus3.5-27B-v3.5",
        name: "Qwopus3.5-27B-v3.5",
      },
    ]);
  });
});
