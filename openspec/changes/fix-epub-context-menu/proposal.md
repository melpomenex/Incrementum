## Why

When a user selects text in an EPUB and right-clicks to open the context menu, actions like Extract and Highlight don't work correctly because the `selectionContext` (EPUB location/CFI range) is null at the time the menu action executes. The `rendition.on("selected")` callback from epubjs is asynchronous and races with the context menu event, so the EPUB-specific selection metadata never reaches the context menu actions.

## What Changes

- Fix the EPUB context menu to reliably provide `selectionContext` (including CFI range and chapter info) to all menu actions
- Ensure Extract and Highlight operations work correctly when triggered from the EPUB right-click context menu
- Eliminate the race condition between epubjs's async `rendition.on("selected")` and the context menu's synchronous `contextmenu` event

## Capabilities

### New Capabilities

- `epub-context-menu-fix`: Ensures the EPUB text selection context menu actions (Extract, Highlight, Copy, Dictionary, Flashcard) all function correctly by making the selection context available at action execution time

### Modified Capabilities

## Impact

- `src/components/viewer/EPUBViewer.tsx` — context menu event handler, selection reporting
- `src/components/viewer/DocumentViewer.tsx` — context menu state management, `buildContextMenuItems`
- `src/components/viewer/SelectionPopup.tsx` — may need adjustments for EPUB selection popup if applicable
