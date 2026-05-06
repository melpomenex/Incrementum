# Tasks: Add right-click context menu to Review Decks modal

## Implementation

- [ ] **1.1** Create `src/components/review/DeckItemContextMenu.tsx` with the context menu component, supporting: Study Now, Rename (inline), Duplicate, Export (.apkg/.csv), Suspend All, Unsuspend All, Delete (with confirm). Use `createPortal` for rendering. Follow `CardContextMenu` patterns for positioning, click-outside dismiss, and Escape handling.

- [ ] **1.2** Add `onContextMenu` handler to each deck `<button>` in `ReviewDecksModal.tsx` that opens `DeckItemContextMenu` at the cursor position. Pass `onClose` to dismiss the menu.

- [ ] **1.3** Add mobile long-press support to deck items in `ReviewDecksModal.tsx` — `onTouchStart`/`onTouchEnd`/`onTouchMove` with 500ms timer, matching the `DeckManagerCardRow` pattern.

- [ ] **1.4** Pass `onStartReview` prop from `ReviewHome` → `ReviewDecksModal` → `DeckItemContextMenu`. In `ReviewHome`, implement `handleStartReviewForDeck(deckId)` that sets only that deck as active (via `setActiveDeckIds`), closes the modal, and starts the review session.

- [ ] **1.5** Implement "Study Now" action in context menu: call `onStartReview(deck.id)`, close modal and context menu.

- [ ] **1.6** Implement "Rename" action: inline text input in the context menu, call `updateDeck(deck.id, { name: renameValue })` on Enter/blur, cancel on Escape.

- [ ] **1.7** Implement "Duplicate" action: call `addDeck({ name: deck.name + " (copy)", tagFilters: [...deck.tagFilters] })`.

- [ ] **1.8** Implement "Export as .apkg" and "Export as .csv" actions: call `getAllLearningItems()`, filter by deck tags using `matchesDeckTags`, then call `exportDeckAsApkg()` / `exportDeckAsCsv()`.

- [ ] **1.9** Implement "Suspend All" / "Unsuspend All": call `getAllLearningItems()`, filter by deck tags, collect IDs, call `bulkSuspendItems(ids)` / `bulkUnsuspendItems(ids)`. Show toast with count.

- [ ] **1.10** Implement "Delete": show inline confirmation in context menu, call `removeDeck(deck.id)`, close modal, show toast.

## Cleanup

- [ ] **1.11** Ensure the context menu renders above the modal backdrop (z-index > 110).
- [ ] **1.12** Verify keyboard accessibility: Escape closes menu, Enter triggers focused action.
- [ ] **1.13** Test on mobile viewport: long-press triggers menu, menu is scrollable if it overflows.
