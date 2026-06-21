/**
 * Shared helper to resolve an `EmbeddingConfig` for whole-library RAG chat.
 *
 * Reads the user's persisted embedding settings (provider/model/chunk-size)
 * and resolves the API key from the **LLM providers store** — the same store
 * the AI settings UI populates and that `chatWithContext` reads from. This is
 * important: the backend `get_embedding_config` command reads from a separate
 * `AIKeyStore` that the settings UI does not populate, so we must resolve keys
 * here on the frontend to actually find the user's configured key.
 *
 * Local Ollama needs no key — only a base URL.
 */

import { buildEmbeddingConfig, type EmbeddingConfig } from "../../api/rag";
import { useSettingsStore } from "../../stores/settingsStore";
import { useLLMProvidersStore } from "../../stores/llmProvidersStore";

/** Find the first enabled provider of a given type with a non-empty API key. */
function keyForProviderType(
  type: "openai" | "openrouter" | "cohere"
): string | undefined {
  // Cohere isn't an LLM provider type in the store, so it has no chat key —
  // but OpenAI/OpenRouter are. Match by the store's provider field.
  const match = useLLMProvidersStore
    .getState()
    .providers.find(
      (p) => p.provider === type && p.apiKey && p.apiKey.trim().length > 0
    );
  return match?.apiKey;
}

export async function resolveEmbeddingConfigForRag(): Promise<EmbeddingConfig> {
  const settings = useSettingsStore.getState().settings.embedding;

  // Local Ollama: no key lookup needed.
  if (settings.provider === "ollama") {
    return buildEmbeddingConfig(settings, {});
  }

  // Cloud providers: resolve keys from the LLM providers store (where the
  // AI settings UI actually saves them).
  return buildEmbeddingConfig(settings, {
    openai: keyForProviderType("openai"),
    openrouter: keyForProviderType("openrouter"),
    cohere: keyForProviderType("cohere"),
  });
}
