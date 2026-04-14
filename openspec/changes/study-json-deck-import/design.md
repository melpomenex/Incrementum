## Context

Incrementum already supports importing from Anki (`.apkg`) and SuperMemo (XML/ZIP) through a unified import system. Files can arrive via two paths: the global `DragDropUpload` component (detects file extension and routes to the appropriate handler) or the `EnhancedFilePicker` dialog (tabbed UI with one tab per importer). All import commands pass file paths (strings) to the Rust backend.

The Study JSON format is a flat-map (`{question_text: card_object}`) with SM-2-style scheduling fields. It's simpler than Anki or SuperMemo — single file per deck, no media, no nested structure, and fields that largely overlap with SM-2. Users should be able to import these files from any machine via drag-and-drop or file picker.

## Goals / Non-Goals

**Goals:**
- Import Study JSON files into Incrementum preserving review history (interval, ease_factor, repetitions, due dates)
- Create one Document per deck file, one LearningItem per card
- Validate Study JSON files before import (schema check)
- Support all algorithm targets — seed appropriate state from available fields
- Follow the same architectural patterns as `anki.rs` and `supermemo_import.rs`

**Non-Goals:**
- Export back to Study JSON format
- Import the `.flashcards.study_state.json` session file
- Auto-detect and suggest algorithm switches — user picks algorithm after import if desired
- Bulk import of multiple files at once (user imports file-by-file)
- Tying the importer to any specific directory — the importer works with any `.json` file in the expected format

## Decisions

### 1. Document model: one Document per JSON file

Each JSON file becomes a Document with:
- `title` = `deck_name` field (e.g. "Lehninger Principles of Biochemistry")
- `category` = `subject` field (e.g. "Biochemistry")
- `file_type` = `FileType::Other`
- `file_path` = `study-json://{filename}` (mirrors Anki's `anki://` scheme)

Each card becomes a `LearningItem` with `document_id` pointing to the parent Document.

**Alternative considered**: Create a category instead of a Document per deck. Rejected because Documents are the existing container for learning items and this aligns with how Anki imports work.

### 2. Field mapping: SM-2 compatible by default

The Study JSON fields (`ease_factor`, `interval_days`, `repetitions`) map directly to Incrementum's SM-2 fields. Imported cards default to `algorithm_type = "sm2"` since the data originated from an SM-2-like scheduler.

For algorithm-specific state seeding:
- **SM-2**: Direct mapping — `ease_factor`, `interval`, `review_count` = `repetitions`
- **SM-20**: Seed `SM20State` from JSON fields: `stability = interval_days`, `difficulty` rescaled from `difficulty_score` (map 1-10 range to 0.0-1.0), `repetition = repetitions`, `lapses = lapse_count`
- **FSRS-6**: Seed `MemoryState` from `difficulty_score` (rescaled 1-10 to 1-10) and `stability = interval_days`

**Alternative considered**: Always import as FSRS. Rejected because the source data is SM-2-shaped; importing as SM-2 preserves the scheduling fidelity.

### 3. Card state derivation from existing fields

- `review_count > 0` → `state = Review`, set `due_date` from `due_at`
- `review_count == 0 && due_at != null` → `state = Learning`
- `review_count == 0 && due_at == null` → `state = New`

`known_pile` maps to `is_suspended = true` (card is known, no longer needs review).

### 4. ID generation

Use content-based hashing (SHA-256 of question text) for deterministic IDs, same pattern as the existing session state file which already uses SHA-1 hashes of question text.

### 5. Tags

Each imported LearningItem gets tags: `["study-json-import", subject, deck_name]`.

### 6. File input: drag-and-drop + file picker (not directory-bound)

The importer follows the existing two-path pattern used by Anki and SuperMemo:

**Drag-and-drop**: The `DragDropUpload` component already detects `.apkg` files by extension and routes them to the Anki handler. We add `.json` detection that validates the file is a Study JSON deck (not a settings export or other JSON), then routes to the import flow. On Tauri native drops, file paths are available directly. On browser drops, files are read as bytes.

**File picker**: A new "Study JSON" tab in `EnhancedFilePicker` uses the Tauri dialog with `.json` filter, then calls the import command with the selected file path.

**Ambiguity with other `.json` files**: Incrementum uses `.json` for settings exports, collections, etc. The Study JSON format is distinguishable by its flat-map structure (top-level object where all values are card objects with an `answer` field). The backend validator checks this structure, and invalid JSON files produce a clear validation error.

**Alternative considered**: Restrict to a specific file extension like `.study.json`. Rejected because the existing files use plain `.json` and requiring a rename would be friction for users.

## Risks / Trade-offs

- **[Algorithm mismatch]** → Imported SM-2 intervals may not match optimal intervals for SM-20/FSRS if the user switches algorithms. Mitigation: Document this in import UI. The user can re-review cards to calibrate.
- **[Duplicate imports]** → Re-importing the same file could create duplicate cards. Mitigation: Check for existing LearningItems with the same document_id and question text before creating.
- **[Field loss]** → `correct_count`, `missed_count`, `retention_rate`, `manual_review`, `save_for_later` have no direct Incrementum fields. Mitigation: Store them in `interaction_metadata` JSON field for potential future use.
