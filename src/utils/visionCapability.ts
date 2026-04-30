/**
 * Heuristic-based vision capability detection for LLM models.
 *
 * Since there's no reliable API to query "does this model support vision?"
 * across all providers, we use model ID pattern matching.
 */

export type LLMProvider = "openai" | "anthropic" | "ollama" | "openrouter";

/**
 * Check whether a given provider/model combination likely supports vision inputs.
 *
 * @param provider - The LLM provider identifier
 * @param model - The model ID string (e.g. "gpt-4o", "claude-3-5-sonnet-20241022")
 * @returns true if the model is believed to support image/vision inputs
 */
export function supportsVision(provider: string, model: string): boolean {
  if (!model) return false;

  // Anthropic: all current Claude models support vision
  if (provider === "anthropic") return true;

  // OpenAI vision-capable models
  if (provider === "openai") {
    const visionPatterns = ["gpt-4o", "gpt-4-turbo", "o1", "o3", "o4-mini"];
    // Must NOT match gpt-4o-mini-vision (if it existed without vision) — but all gpt-4o* have vision
    return visionPatterns.some((p) => model.includes(p));
  }

  // OpenRouter: check model ID prefix or known vision indicators
  if (provider === "openrouter") {
    const visionPrefixes = [
      "openai/gpt-4o",
      "anthropic/claude",
      "google/gemini",
      "meta-llama/llama-3.2-vision",
      "google/gemma-3",
    ];
    if (visionPrefixes.some((p) => model.startsWith(p))) return true;
    // Many OpenRouter models include ":vision" suffix
    if (model.includes(":vision")) return true;
    // Wildcard: if "vision" appears anywhere in the model ID, probably supports it
    if (model.toLowerCase().includes("vision")) return true;
    return false;
  }

  // Ollama: vision models typically have -vision, -vl suffix, or are known vision models
  if (provider === "ollama") {
    const lower = model.toLowerCase();
    return (
      lower.includes("-vision") ||
      lower.includes("-vl") ||
      lower.includes("llava") ||
      lower.includes("bakllava") ||
      lower.includes("minicpm-v")
    );
  }

  return false;
}
