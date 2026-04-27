## Why

When going through the Optimal Queue in scroll mode, the "Hide Assistant" button is fixed at the bottom-left and overlaps with audiobook controls (chapter buttons, etc.), making them unclickable. The button is also redundant since the assistant panel already has a collapse chevron in its top-right corner. Additionally, scroll mode items (documents, RSS articles) lack the toolbar buttons that exist in the standalone DocumentViewer — users can't view extracts, learning items, or create extracts without leaving scroll mode.

## What Changes

- **Remove** the "Hide Assistant" floating button from `QueueScrollPage`. The `AssistantPanel` already has a built-in collapse/expand chevron, making this redundant.
- **Add** a DocumentViewer-style toolbar to scroll mode document items with view mode toggles (Document / Extracts / Learning Cards) and the Create Extract button.

## Capabilities

### New Capabilities
- `scroll-mode-toolbar`: Adds a contextual toolbar at the top of document/RSS scroll items with extract creation, view mode toggling (document/extracts/learning cards), mirroring the DocumentViewer toolbar.

### Modified Capabilities
_(none)_

## Impact

- `QueueScrollPage.tsx` — Remove assistant toggle button, add toolbar rendering for document/RSS items
- `DocumentViewer.tsx` — The embedded mode may need minor adjustments to support toolbar extraction or the toolbar may be rendered externally in scroll mode
- Potentially shared toolbar component extracted from DocumentViewer for reuse
- i18n keys for any new toolbar labels
