## Why

Browser extension extracts and manually-created extracts are stored in the same `Extract` table in SQLite, but they are displayed in completely different UIs with vastly different capabilities:

**`ExtractInbox`** (browser-sent extracts): A simplified standalone component that shows extracts as expandable cards. It supports viewing rich HTML content and AI analysis, but **lacks** the ability to edit content, add/edit notes, set category, manage tags, change highlight color, adjust disclosure level, generate learning cards, or rate extracts.

**`ExtractsList`** (regular document extracts): A full-featured component rendered inside `DocumentViewer` in `"extracts"` view mode. It supports editing via `EditExtractDialog`, notes, categories, tags, highlight colors, disclosure levels, bulk operations, card generation, and sub-extract creation from selections.

This means browser-extension-sourced extracts — which often arrive with rich HTML, analysis, priority, and FSRS data — end up in a stripped-down view where users cannot edit them, annotate them, or manage their learning metadata. The user's request is clear: extracts imported via the browser extension should share the same "view" as regular extracts, centered on the screen with full editing, notes, rating, and card generation capabilities.

## What Changes

- Replace the simplified `ExtractInbox` expandable-card layout with the full `ExtractsList` + `EditExtractDialog` editing experience for browser-imported extracts
- When a user navigates to the extract inbox / "from Browser" section, extracts render using the same card component used in `DocumentViewer`'s extracts view — including edit, notes, tags, category, highlight color, disclosure level, rating, and card generation
- Preserve the AI analysis feature (summary, key points, questions) from `ExtractInbox` as an optional per-extract action available in the unified view
- Preserve the "from Browser" header/branding so users know these came from the browser extension
- Ensure browser extracts without a parent `document_id` (orphaned extracts) still display correctly in the unified view

## Capabilities

### Modified Capabilities
- `extract-inbox-view`: Upgrade from simplified expandable cards to the full extract editing experience (edit, notes, tags, category, highlight color, disclosure level, rating, card generation)

### Preserved Capabilities
- `extract-ai-analysis`: AI summary, key points, and questions generation remain available as an action on each extract

## Impact

- `src/components/extracts/ExtractInbox.tsx`: Major rewrite — replace expandable-card layout with `ExtractsList`-style rendering, or compose from shared sub-components
- `src/components/extracts/ExtractsList.tsx`: Possible refactor — extract the per-extract card rendering into a reusable `ExtractCard` component that both `ExtractsList` and `ExtractInbox` can use
- `src/components/extracts/EditExtractDialog.tsx`: Likely minor changes — ensure it works without a parent document context (orphaned extracts)
- No backend/Rust changes required — the data model already stores browser extracts identically to manual extracts
- No browser extension changes required
