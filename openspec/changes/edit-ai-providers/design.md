## Context

AI provider configurations are stored in a Zustand store persisted to localStorage. The `updateProvider(id, updates)` action already supports partial merges, so the backend/store layer is ready. The gap is purely UI: `LLMProviderSettings.tsx` has an "Add Provider" form but no way to populate it with existing values for editing.

## Goals / Non-Goals

**Goals:**
- Reuse the existing add-provider form for editing by pre-populating it with current values
- Add an edit button to each provider card in the list
- Switch form submission between create and update based on mode

**Non-Goals:**
- Backend or store changes (the store already supports updates)
- Provider reordering or drag-and-drop
- Bulk editing multiple providers at once

## Decisions

**Reuse the add form in edit mode** — The add form already has all the fields needed (provider type, name, API key, base URL, model). Rather than building a separate edit form, introduce an `editingProvider` state. When set, the form renders pre-filled and the submit handler calls `updateProvider` instead of `addProvider`.

- *Alternative considered*: A modal/dialog for editing. Rejected because the inline add form pattern already works well and a modal adds complexity without benefit for a single form.

**Disable provider type selector during edit** — Changing the provider type (e.g., OpenAI → Anthropic) after creation could cause confusion with model validation and API key format. Lock the type during edit; users who need to change type can delete and re-add.

## Risks / Trade-offs

- [Editing a provider while it's in use by an active chat] → The `updateProvider` merge is synchronous in Zustand, so changes take effect immediately. No special handling needed — this matches the current behavior of the enable/disable toggle.
- [Provider type cannot be changed in edit mode] → Mitigated by the delete-and-re-add path which is already the only option today.
