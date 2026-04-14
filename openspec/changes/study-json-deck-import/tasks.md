## 1. Rust Backend: Study JSON Parser

- [x] 1.1 Create `src-tauri/src/study_json_import.rs` with `StudyJsonCard` and `StudyJsonDeck` structs matching the flat-map JSON format
- [x] 1.2 Implement `parse_study_json_file(path) -> Result<StudyJsonDeck>` that reads and deserializes the file, validating the structure (flat map of string -> card object with required fields)
- [x] 1.3 Add unit tests for parser: valid file, invalid JSON, missing required fields, empty deck

## 2. Rust Backend: Validation Command

- [x] 2.1 Implement `validate_study_json` function that returns deck_name, subject, total card count, new count (review_count == 0), review count (review_count > 0)
- [x] 2.2 Register `validate_study_json_file` Tauri command in `src-tauri/src/main.rs` or the commands module

## 3. Rust Backend: Import Logic

- [x] 3.1 Implement Document creation: one Document per deck with title=deck_name, category=subject, file_type=Other, file_path=study-json://{filename}
- [x] 3.2 Implement LearningItem creation with field mapping: ease_factor, interval=interval_days, review_count=repetitions, lapses=lapse_count, question from key, answer from card.answer
- [x] 3.3 Implement state derivation: Review if review_count > 0, New if review_count == 0, is_suspended if known_pile
- [x] 3.4 Store unmapable fields (correct_count, missed_count, retention_rate, manual_review, save_for_later) in interaction_metadata JSON
- [x] 3.5 Implement deduplication: check existing LearningItems by document_id + question before creating
- [x] 3.6 Generate deterministic IDs using SHA-256 of question text (matching the pattern already used in the session state file)
- [x] 3.7 Set algorithm_type to "sm2" and add tags ["study-json-import", subject, deck_name]
- [x] 3.8 Register `import_study_json_file` Tauri command

## 4. Rust Backend: Tests

- [x] 4.1 Add integration test for full import flow with a sample Study JSON fixture
- [x] 4.2 Add test for deduplication on re-import
- [x] 4.3 Add test for known_pile → is_suspended mapping

## 5. Frontend: Drag-and-Drop Integration

- [x] 5.1 Add `.json` file detection in `DragDropUpload.tsx` — when a `.json` file is dropped, call `validate_study_json_file` to check if it's a deck file
- [x] 5.2 If validation succeeds, show deck summary and proceed with import; if validation fails, show error (don't silently swallow non-deck JSON files)

## 6. Frontend: EnhancedFilePicker Tab

- [x] 6.1 Add a "Study JSON" tab to `EnhancedFilePicker.tsx` with a `.json` file filter
- [x] 6.2 On file selection, call `validate_study_json_file`, show deck summary (deck name, subject, card counts), and import on confirmation
- [x] 6.3 Show import progress and result (Document created, N cards imported)

## 7. Frontend: Import Summary Dialog

- [x] 7.1 Create or reuse an import summary component that displays: deck name, subject, total cards, new cards, cards with review history
- [x] 7.2 Show confirmation button and import result feedback
