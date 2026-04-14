## Context

JSON deck import works end-to-end when triggered from ReviewHome (the review page). The same import, when triggered from the Documents view, succeeds on the backend (Document + LearningItems are persisted) but fails to register a `StudyDeck` in the Zustand `studyDeckStore`, so the deck is invisible in the Decks list.

Three Documents-view entry points are affected:
1. `DocumentsView.handleStudyJsonDeck` — drag-and-drop on the DocumentsView
2. `Documents.handleImportFromPicker` (source `"json"`) — EnhancedFilePicker JSON source
3. `Documents.handleImportFromPicker` (source `"local"` with `.json` files) — local file import with mixed JSON + regular files

The `ReviewHome` path already uses `ensureAnkiStudyDecks(deckNames)` after import. This function is local to `ReviewHome.tsx` and not shared.

## Goals / Non-Goals

**Goals:**
- All JSON deck import paths register the deck in `studyDeckStore`
- `seedFromDocuments` also auto-discovers JSON-imported decks on first load

**Non-Goals:**
- Changing the backend import logic or data model
- Adding new UI feedback toasts to the Documents view (the user didn't report this as a problem)
- Refactoring `ensureAnkiStudyDecks` into a shared utility (nice-to-have but out of scope for this bug fix)

## Decisions

**1. Extract `ensureAnkiStudyDecks` into the study deck store**
Move the function from `ReviewHome.tsx` into `studyDeckStore.ts` as a store action (`ensureDecksExist(deckNames)`) so all import paths can call it without duplication. This is the cleanest fix since the function operates directly on the store.

**2. Call `ensureDecksExist` from all Documents-view import paths**
After each successful `import_study_json_file` invoke, call `useStudyDeckStore.getState().ensureDecksExist([result.deck_name])`. This matches what ReviewHome already does.

**3. Extend `seedFromDocuments` tag check**
Change the guard from `tags.some((tag) => tag.toLowerCase() === "anki-import")` to also accept `"study-json-import"`. This ensures that if a user imports a JSON deck and then clears their decks list, the JSON decks are re-seeded on next load (same behavior as Anki decks).

## Risks / Trade-offs

- **Duplicate decks** → `ensureDecksExist` does a case-insensitive name match before creating, so re-importing the same deck won't create duplicates. `seedFromDocuments` also checks `decks.length > 0` before seeding.
- **Persistence timing** → The Zustand store is persisted to localStorage. The `ensureDecksExist` call writes synchronously via `set()`, so the deck is immediately available even if the component unmounts.
