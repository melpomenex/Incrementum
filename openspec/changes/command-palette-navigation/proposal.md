## Why

Selecting an item in the command palette (Ctrl+K) does not reliably navigate the user to the corresponding feature. Currently, the system has two disjoint navigation paths — `setCurrentPage()` (page-based, used by sidebar and default commands) and `addTab()` (tab-based, used by inline commands in CommandCenter) — but neither is consistently wired to all palette results. A user typing "image", seeing "Image Registry", and pressing Enter expects to land on the image registry, but the navigation may silently fail or do nothing visible.

## What Changes

- Ensure every command palette result type (Command, Section, Document, Extract) triggers a visible navigation action on selection
- Unify the navigation mechanism so selecting a palette item reliably opens the target feature (page, tab, or modal)
- Verify and fix the `navigate` CustomEvent pipeline from palette action → App.tsx listener → `setCurrentPage` / `addTab`
- Add the image registry as a first-class tab target in CommandCenter alongside the existing dashboard/documents/queue tabs

## Capabilities

### New Capabilities

- `palette-result-navigation`: Reliable action dispatch when any command palette result is selected — covering commands, sections, documents, and extracts with consistent navigation behavior

### Modified Capabilities

## Impact

- **Frontend**: `src/components/search/CommandCenter.tsx` — action handlers and navigation targets
- **Frontend**: `src/components/search/GlobalSearch.tsx` — result click handling and keyboard Enter flow
- **Frontend**: `src/components/common/CommandPalette.tsx` — default command actions
- **Frontend**: `src/App.tsx` — `navigate` event listener and page routing
