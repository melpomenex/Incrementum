## Context

The app has two AI configuration systems: a legacy Rust `AIConfig` (in-memory, single provider) and a newer `LLMProviderConfig` system (Zustand + localStorage, multi-provider). Settings currently live in two Zustand stores (`useSettingsStore` and `useLLMProvidersStore`), both persisted to localStorage. The Rust backend accepts `temperature` and `max_tokens` per-request via `ChatCompletionRequest` but has no per-provider defaults. The `AISettings` interface in `useSettingsStore` has flat `temperature` and `maxTokens` fields, not per-provider. Auto-generation, summarization, and context window controls do not exist.

## Goals / Non-Goals

**Goals:**
- Add `temperature`, `max_tokens`, and `system_prompt` to each `LLMProviderConfig` entry
- Add auto-generation settings (enabled toggle, cards per extract, quality threshold, require manual approval)
- Add summarization settings (auto-summarize toggle, summary length selector, include in card content toggle)
- Add context window settings (max tokens per request, context from related cards toggle, document snippet length)
- All settings persisted in Zustand stores (localStorage), no DB migration needed
- New "AI Settings" settings page section with sub-categories

**Non-Goals:**
- No Rust backend changes to `AIConfig` / `ModelPreferences` (these settings are frontend-managed; the new multi-provider system (`LLMProviderConfig`) handles them directly)
- No database migrations
- No encryption of API keys (already handled by existing TODO in store)
- No changes to the Tauri command layer (commands already accept values per-request)

## Decisions

1. **Settings in `useLLMProvidersStore` (not `useSettingsStore`)** — Per-provider temperature, max_tokens, and system_prompt belong on each `LLMProviderConfig` object, not in the flat `AISettings`. This aligns with the existing multi-provider architecture.
2. **Global auto-gen/summarization/context settings in a new store utility** — These are global toggles, not per-provider. Add an `AISettingsControls` interface to the existing `useSettingsStore` under a new `aiControls` key (or extend the existing `ai` key).
3. **Quality threshold as a number 0.0–1.0** — Simple, familiar, maps directly to confidence thresholds.
4. **Summary length as an enum** — `"short"` / `"medium"` / `"long"` with word-count mappings in the UI layer.
5. **No new Tauri commands** — Existing commands (`flashcard_generator`, `summarizer`, etc.) accept parameters at call time. The UI reads settings from the store and passes them as arguments.

## Risks / Trade-offs

- **[Risk] Zustand localStorage grows** — Minimal: the new fields are small primitives.
- **[Risk] Feature creep** — Mitigation: each sub-section is independently implementable and gated behind its own toggle.
