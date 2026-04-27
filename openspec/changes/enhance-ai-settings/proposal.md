## Why

The AI settings UI has gaps that prevent users from fine-tuning LLM behavior per-provider. Temperature, max tokens, and system prompt are not configurable per-provider; auto-generation, summarization, and context window controls are missing entirely. This limits power users and makes the app less competitive for AI-assisted study workflows.

## What Changes

- Extend `LLMProviderConfig` with temperature, max_tokens, and system_prompt fields
- Add auto-generation settings section: enable toggle, cards-per-extract, quality threshold, require manual approval
- Add summarization settings section: auto-summarize toggle, summary length (short/medium/long), include in card content toggle
- Add context window settings section: max tokens per request, context from related cards toggle, document snippet length
- Wire all new settings through the Zustand stores (persisted to localStorage)
- Add a new "AI Settings" tab in the Settings page with sub-sections for these categories
- No breaking changes

## Capabilities

### New Capabilities
- `per-provider-advanced-settings`: Temperature, max tokens, and system prompt per LLM provider
- `auto-card-generation`: Auto-generate flashcards from extracts with configurable count, quality threshold, and approval workflow
- `summarization-controls`: Auto-summarize long extracts with configurable length and card content inclusion
- `context-window-settings`: Configure max tokens per request, related card context, and document snippet length

### Modified Capabilities
- (none)

## Impact

- Frontend: New UI components in `src/components/settings/`, extended Zustand store interfaces and defaults
- Rust backend: Extend `ModelPreferences` / `LLMProviderType` serialization to include temperature, max_tokens if needed (currently these are frontend-only)
- No new database migrations (settings remain in localStorage via Zustand persistence)
