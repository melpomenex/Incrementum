# Change: Add right-click context menu to Review Decks modal

## Why
The "View Decks" modal in the Review tab (`ReviewDecksModal.tsx`) shows a list of decks with checkboxes to toggle which ones are active for review. Currently, the only actions available are toggle-select and close. Users have no way to perform common deck operations (rename, delete, study, export) from this view — they must navigate elsewhere (DeckManager) for these actions. A right-click context menu on deck items would bring deck management into this view, matching the existing pattern used in `DeckManager` and `CardContextMenu`.

## What Changes
- Add a right-click context menu to each deck item in `ReviewDecksModal`
- Support long-press on mobile for the same menu
- Menu actions:
  - **Study Now** — Start a review session for this deck only (close modal, set active deck, start review)
  - **Rename** — Inline rename with text input
  - **Edit Tags** — Open tag editor to modify the deck's tag filters
  - **Duplicate** — Create a copy of the deck with "(copy)" suffix
  - **Export as .apkg** — Export deck cards as Anki package
  - **Export as .csv** — Export deck cards as CSV
  - **Suspend All** — Suspend all cards in the deck
  - **Unsuspend All** — Unsuspend all cards in the deck
  - **Delete** — Delete the deck (with confirmation)
- Reuse the existing `useStudyDeckStore` actions (`updateDeck`, `removeDeck`, `addDeck`) and the existing bulk action APIs (`bulkSuspendItems`, `bulkUnsuspendItems`, `exportDeckAsApkg`, `exportDeckAsCsv`)
- Follow the same visual style and portal-based rendering pattern as `CardContextMenu`

## Impact
- **Affected code**: `ReviewDecksModal.tsx` (primary), possibly minor imports from existing APIs
- **New component**: `DeckItemContextMenu.tsx` in `src/components/review/`
- **Reuses**: `useStudyDeckStore`, `bulkSuspendItems`, `bulkUnsuspendItems`, `exportDeckAsApkg`, `exportDeckAsCsv`, `getAllLearningItems`, `matchesDeckTags` — all existing
- **No backend changes needed** — all APIs already exist
- **Risk**: Low — purely additive UI, no changes to existing flows

## Non-Goals
- Adding new deck management capabilities (all actions already exist in DeckManager)
- Changing the modal's selection/toggle behavior
- Adding drag-and-drop deck reordering

## Success Criteria
- Right-clicking a deck item shows context menu with all listed actions
- Long-press on mobile shows the same menu
- Actions work identically to their DeckManager equivalents
- Menu dismisses on click outside, Escape, or after an action
- No visual regression in the modal's existing selection UI
