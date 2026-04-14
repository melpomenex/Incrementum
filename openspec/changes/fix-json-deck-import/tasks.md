## 1. Extract ensureAnkiStudyDecks into studyDeckStore

- [x] 1.1 Add `ensureDecksExist(deckNames: string[]): string[]` action to `studyDeckStore.ts` — move the logic from `ReviewHome.ensureAnkiStudyDecks` into the store so all import paths can use it
- [x] 1.2 Update `ReviewHome.tsx` to call `useStudyDeckStore.getState().ensureDecksExist(deckNames)` instead of the local `ensureAnkiStudyDecks` function, and remove the local function

## 2. Register decks from Documents-view import paths

- [x] 2.1 In `DocumentsView.tsx` `handleStudyJsonDeck`, call `ensureDecksExist([result.deck_name])` after successful `import_study_json_file` invoke
- [x] 2.2 In `routes/documents.tsx` `handleImportFromPicker` for source `"json"`, call `ensureDecksExist([result.deck_name])` after successful import
- [x] 2.3 In `routes/documents.tsx` `handleImportFromPicker` for source `"local"`, call `ensureDecksExist([result.deck_name])` inside the JSON import loop after each successful import

## 3. Extend seedFromDocuments for study-json-import

- [x] 3.1 Update `seedFromDocuments` in `studyDeckStore.ts` to recognize `"study-json-import"` tagged documents in addition to `"anki-import"` (change the guard clause to accept both tags)
