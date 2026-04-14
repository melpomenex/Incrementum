## Why

When importing a `.json` deck file from the Documents view (drag-and-drop or EnhancedFilePicker), the backend successfully creates the Document and LearningItems in the database, but the deck never appears under "Decks" in the Review view. Only the ReviewHome import path calls `ensureAnkiStudyDecks()` to register the deck in the Zustand store — the Documents view import handlers skip this step entirely.

## What Changes

- After a successful JSON deck import from the Documents view, call `ensureAnkiStudyDecks()` (or equivalent) so the deck is registered in the `studyDeckStore` and appears in the Decks list.
- Extend `seedFromDocuments()` in `studyDeckStore` to also seed decks from `"study-json-import"` tagged documents (currently it only handles `"anki-import"` tags), so that imported JSON decks are auto-discovered on first load if no decks exist yet.

## Capabilities

### New Capabilities

_(none — this is a bug fix, no new capabilities)_

### Modified Capabilities

_(none — no spec-level behavior changes, only a missing code path is being connected)_

## Impact

- `src/routes/documents.tsx` — `handleImportFromPicker` for `"json"` and `"local"` sources must register imported deck names in the study deck store.
- `src/components/documents/DocumentsView.tsx` — `handleStudyJsonDeck` drag-and-drop handler must also register the deck.
- `src/stores/studyDeckStore.ts` — `seedFromDocuments` should recognize `"study-json-import"` tagged documents in addition to `"anki-import"`.
