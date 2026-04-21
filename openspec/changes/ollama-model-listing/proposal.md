## Why

When users configure Ollama as an AI provider, they must manually type model names or choose from a hardcoded, outdated list (llama3.2, mistral, codellama, phi3, deepseek-coder). This is a poor UX — users can't see what models they actually have installed, and the static list quickly becomes irrelevant as they add/remove models via `ollama pull`/`ollama rm`.

## What Changes

- Add a "Refresh Models" button in the LLM provider settings that queries the local Ollama instance (`GET /api/tags`) and returns all installed models
- When Ollama is selected as the provider type, dynamically populate the model dropdown with models fetched from the running Ollama instance
- Show model details (size, family) alongside names to help users identify the right model
- Display a clear empty state when Ollama is unreachable or no models are installed
- Persist the last-fetched model list so it's available offline on next settings open

## Capabilities

### New Capabilities
- `ollama-model-discovery`: Fetching, displaying, and caching the list of models installed on the local Ollama instance from the settings UI

### Modified Capabilities
<!-- No existing spec requirements change -->

## Impact

- **Frontend**: `LLMProviderSettings.tsx` — model selection UI changes for Ollama provider type; `api/llm/index.ts` — new API function for fetching Ollama models
- **Backend**: `commands/llm.rs` — `llm_get_models` command needs Ollama support (currently returns hardcoded list)
- **Storage**: `llmProvidersStore.ts` — optionally cache fetched model list
- **Legacy code**: `commands/ai.rs` already has a working `list_ollama_models` command calling `/api/tags` — this can be reused or consolidated
