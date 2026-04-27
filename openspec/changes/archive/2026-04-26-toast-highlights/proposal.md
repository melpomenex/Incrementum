## Why

When a user highlights or excerpts text in any viewer (PDF, EPUB, HTML, RSS), the app currently opens a full modal dialog (`CreateExtractDialog`) that interrupts reading flow. A user reported: "After highlighting or excerpting text, the software forcibly pops up a dialog box, which significantly disrupts the reading flow." SuperMemo's approach is more scientifically designed — it creates extracts instantly with minimal friction. The app already has an inline extraction path (`useInlineExtraction`, Alt+X) that does zero-dialog extraction, but the primary UI-driven highlight actions still force a dialog.

## What Changes

- Replace the modal dialog popup on highlight/excerpt creation with a toast notification confirming the extract was created
- The toast should show a brief message (e.g., "Highlight saved") and optionally include an action button to edit the extract or open the full dialog for advanced options
- Preserve keyboard shortcut behavior (Alt+X for instant extract, Alt+Z for cloze) unchanged
- The full `CreateExtractDialog` remains accessible via explicit "Edit extract" action from the toast or from the extracts sidebar
- Highlight colors default to the user's preferred color (or last-used color) without requiring a dialog choice

## Capabilities

### New Capabilities
- `toast-extract-feedback`: Non-disruptive toast notification feedback when an extract/highlight is created, replacing the forced modal dialog

### Modified Capabilities
<!-- No existing specs are being modified at the requirements level -->

## Impact

- **Frontend**: `SelectionPopup.tsx`, `DocumentViewer.tsx`, `EPUBViewer.tsx`, `RSSScrollMode.tsx`, `HighlightRenderer.tsx`, viewer toolbar components — all paths that trigger `CreateExtractDialog` on highlight creation
- **Existing toast system**: `Toast.tsx` / `useToast` hook — leveraged for the new notifications
- **Extract API**: No backend changes needed — `createExtract` command already supports creating with default values
- **User workflow**: Primary highlight action becomes instant; power users can still access the full dialog for metadata (category, tags, progressive disclosure) via the toast action or sidebar
