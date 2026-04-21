## Why

Users cannot edit existing AI provider configurations. To change an API key, model, base URL, or name, they must delete the provider and re-add it from scratch. This is frustrating and error-prone, especially when only one field needs updating (e.g., rotating an API key).

## What Changes

- Add an edit mode to the LLM provider settings UI that pre-populates the existing provider form with current values
- Allow users to modify all provider fields (name, API key, base URL, model) in-place
- Add a visual indicator in the provider list to distinguish edit mode from add mode

## Capabilities

### New Capabilities

- `provider-editing`: UI and interaction pattern for editing an existing AI provider configuration in-place

### Modified Capabilities

_(No existing spec-level requirement changes — this extends the UI surface only)_

## Impact

- **Frontend**: `LLMProviderSettings.tsx` and `AIProviderSettings.tsx` — new edit state management and form reuse
- **Store**: `llmProvidersStore.ts` — `updateProvider` already supports partial merges, no changes needed
- **Backend**: No changes required — all provider persistence is client-side via localStorage/Zustand
