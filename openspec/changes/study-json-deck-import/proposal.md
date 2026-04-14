## Why

Users have deck files in a flat-map JSON format (`{question: card_object}`) with existing scheduling data (ease factor, interval, repetitions, due dates) from a prior study tool. There is no way to import these into Incrementum. Adding a generic Study JSON importer lets users bring these decks — complete with their review history — into the app from any machine, via drag-and-drop or file picker, without losing progress.

## What Changes

- Add a new import path for the Study JSON format (`{question: card_object}` flat map)
- Create a Document per deck file (title = deck_name, category = subject)
- Create a LearningItem per card, mapping fields to Incrementum's schema
- Transform the Study JSON fields to be compatible with SM-2, SM-18, SM-20, and FSRS-6 algorithms
- Add Tauri commands for validation and import of Study JSON files (path-based, matching existing import patterns)
- Hook into the existing global `DragDropUpload` component so `.json` deck files can be dropped anywhere on the app window
- Add a "Study JSON" tab to the `EnhancedFilePicker` import dialog

## Capabilities

### New Capabilities
- `study-json-import`: Parsing, validation, and import of Study JSON deck files into Incrementum's document/learning_item model, with field mapping for all supported algorithms. Accepts files via drag-and-drop (global) or file picker (EnhancedFilePicker tab)

### Modified Capabilities

## Impact

- **Rust backend**: New module `src-tauri/src/study_json_import.rs` alongside existing `anki.rs` and `supermemo_import.rs`
- **Frontend**: Global drag-and-drop handling for `.json` files in `DragDropUpload`, new "Study JSON" tab in `EnhancedFilePicker`
- **Dependencies**: No new crate dependencies (uses serde_json, chrono already in the project)
- **Algorithms**: Imported cards default to SM-2 (compatible with ease_factor/interval/repetitions fields in the JSON). Users can switch algorithms post-import. For SM-20, initial `SM20State` can be seeded from the JSON fields.
