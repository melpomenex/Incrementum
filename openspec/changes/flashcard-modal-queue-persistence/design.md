# Design: FlashcardStudioModal Queue Persistence

## Root Cause
`QueueScrollPage` registers a `keydown` handler at **capture phase** (`{ capture: true }`) that calls `closeTab()` on every `Escape`. `FlashcardStudioModal` registers its handler at **bubble phase** (default). Capture fires first, so the tab is already closing before the modal can handle the event.

## Approach
Add a derived boolean `isOverlayOpen` to `QueueScrollPage` that checks all modal/popup state flags. Guard the Escape → closeTab path with this check.

The relevant state flags already exist:
- `flashcardStudioSeed` (FlashcardStudioModal)
- `activeExtractForCloze` (ClozeCreatorPopup)
- `activeExtractForQA` (QACreatorPopup)
- `isExtractDialogOpen` (CreateExtractDialog)
- `showSettings` (settings overlay)
- `showRssSettings` (RSS settings modal)
- `showShortcuts` (shortcuts panel — checked inside keyboard handler)

## Files Changed
- `src/pages/QueueScrollPage.tsx` — Add `isOverlayOpen` guard to Escape handler
