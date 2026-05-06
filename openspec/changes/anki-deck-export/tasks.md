## 1. Backend: Card type mapping in .apkg export

- [x] 1.1 Update `export_deck_as_apkg` in `src-tauri/src/anki.rs` to create both "Basic" (model id 1) and "Cloze" (model id 2) Anki note models in the collection metadata
- [x] 1.2 Add logic to map each `LearningItem` to the correct model: Basic/Flashcard/QA → model 1, Cloze → model 2
- [x] 1.3 Implement cloze range → `{{c1::text}}` conversion: read `cloze_text` and `cloze_ranges`, generate properly formatted cloze syntax, fall back to Basic model if ranges are invalid
- [x] 1.4 Add unit tests for card type mapping and cloze syntax generation

## 2. Backend: Media embedding in .apkg

- [x] 2.1 Read image assets for exported cards from the image registry/filesystem
- [x] 2.2 Number media files sequentially and build the `media` JSON manifest (e.g., `{"0": "image1.png", "1": "image2.jpg"}`)
- [x] 2.3 Replace image references in card fields with `<img src="N">` pointing to the numbered media entries
- [x] 2.4 Write media files into the .apkg ZIP alongside `collection.anki2` and the `media` manifest

## 3. Backend: CSV/tab-separated export

- [x] 3.1 Add new Tauri command `export_deck_as_csv(deck_name, output_path)` in `src-tauri/src/anki.rs`
- [x] 3.2 Generate tab-separated output: `Front\tBack\tTags` per line, filter by deck tag, handle cloze cards by including cloze syntax verbatim
- [x] 3.3 Register the command in `src-tauri/src/lib.rs`
- [x] 3.4 Add frontend API function `exportDeckAsCsv(deckName, outputPath)` in `src/api/learning-items.ts`

## 4. Backend: Bulk export all decks

- [x] 4.1 Add new Tauri command `export_all_decks_as_apkg(output_path)` that fetches all learning items, groups by deck tag, and creates a single .apkg with multiple Anki decks
- [x] 4.2 Register the command in `src-tauri/src/lib.rs`
- [x] 4.3 Add frontend API function `exportAllDecksAsApkg(outputPath)` in `src/api/learning-items.ts`

## 5. Frontend: DeckManager toolbar export button

- [x] 5.1 Add a visible "Export to Anki" button in the DeckManager toolbar (alongside existing buttons)
- [x] 5.2 Implement format picker: show a dropdown or popover with APKG and CSV options
- [x] 5.3 Wire up the button to call the correct export command with a save dialog
- [x] 5.4 Show export preview (card count + deck name) before generating the file
- [x] 5.5 Disable the button when no deck is selected

## 6. Frontend: Import/Export settings section

- [x] 6.1 Add a new "Export to Anki" section in `src/components/settings/ImportExportSettings.tsx`
- [x] 6.2 Add a deck picker dropdown populated from `useStudyDeckStore` decks
- [x] 6.3 Add format selector (APKG / CSV) and "Export All Decks" option
- [x] 6.4 Wire up export actions to the API functions with save dialogs
- [x] 6.5 Show error message when exporting an empty deck

## 7. Polish and testing

- [x] 7.1 Add i18n keys for all new UI strings (en, zh, ja, fr, es, de)
- [ ] 7.2 Test full export round-trip: create deck with mixed card types + images → export .apkg → import into Anki desktop and verify cards, cloze syntax, and media *(manual testing)*
- [ ] 7.3 Test CSV export: import the .txt file into Anki and verify fields parse correctly *(manual testing)*
- [ ] 7.4 Test bulk export with multiple decks and verify deck separation in Anki *(manual testing)*
