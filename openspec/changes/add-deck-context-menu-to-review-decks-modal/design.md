# Design: Add right-click context menu to Review Decks modal

## Architecture

```
ReviewDecksModal (existing)
└── DeckItemContextMenu (new)
    ├── Study Now → toggleDeckSelection(deckId) + onStartReview()
    ├── Rename → updateDeck(deckId, { name }) inline
    ├── Edit Tags → updateDeck(deckId, { tagFilters })
    ├── Duplicate → addDeck({ name, tagFilters })
    ├── Export as .apkg → exportDeckAsApkg()
    ├── Export as .csv → exportDeckAsCsv()
    ├── Suspend All → bulkSuspendItems(matchingCardIds)
    ├── Unsuspend All → bulkUnsuspendItems(matchingCardIds)
    └── Delete → removeDeck(deckId) with confirm
```

## Key Decisions

### 1. Reuse existing APIs, no new backend
All actions already have working implementations in `DeckManager.tsx`. We extract the same API calls into `DeckItemContextMenu`:
- `bulkSuspendItems` / `bulkUnsuspendItems` from `api/queue.ts`
- `exportDeckAsApkg` / `exportDeckAsCsv` from `api/learning-items.ts`
- `getAllLearningItems` + `matchesDeckTags` to resolve card IDs for bulk actions
- `useStudyDeckStore` for `updateDeck`, `removeDeck`, `addDeck`

### 2. Inline rename within the context menu
Instead of opening a separate dialog, show a text input directly in the context menu (similar to `CardContextMenu`'s delete confirm pattern). This keeps the interaction lightweight.

### 3. Study Now closes the modal
When "Study Now" is clicked, close the modal, set only this deck as active, and trigger the review start. This requires passing `onStartReview` down to `ReviewDecksModal` and through to the context menu.

### 4. Portal-based rendering
Use `createPortal` to render the menu at the document body level, matching `CardContextMenu`'s approach. This avoids z-index conflicts with the modal's backdrop.

### 5. Props flow
```
ReviewHome
  ├── ReviewDecksModal
  │     ├── decks, deckStats, activeDeckIds (existing)
  │     ├── onToggleDeck (existing)
  │     └── onStartReview (new prop)
  └── (all existing store/API usage stays)
```

`ReviewDecksModal` needs a new `onStartReview?: (deckId: string) => void` prop so the context menu can initiate a review for a specific deck.

## Component: DeckItemContextMenu

```typescript
interface DeckItemContextMenuProps {
  deck: StudyDeck;
  cardCount: number;
  x: number;
  y: number;
  onClose: () => void;
  onStartReview: (deckId: string) => void;
}
```

Internal state:
- `showDeleteConfirm: boolean`
- `isRenaming: boolean`
- `renameValue: string`

### Mobile Support
Add `onTouchStart` / `onTouchEnd` handlers to each deck item button for long-press detection (500ms), matching the existing `DeckManagerCardRow` pattern.
