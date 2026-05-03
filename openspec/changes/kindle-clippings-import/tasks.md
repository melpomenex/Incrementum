# Tasks: Kindle Clippings Import

## 1. Database Migration
- [x] 1.1 Add `source_hash TEXT NULL` column to `extracts` table
- [x] 1.2 Add index `idx_extracts_source_hash ON extracts(source_hash)`
- [x] 1.3 Ensure migration is backwards-compatible (nullable column, existing rows get NULL)

## 2. Rust Parser (`src-tauri/src/kindle_clippings.rs`)
- [x] 2.1 Define data structures: `KindleClipping`, `ClippingType`, `KindleBookGroup`, `KindleValidationResult`
- [x] 2.2 Implement file reading with UTF-8 → Latin-1 fallback
- [x] 2.3 Implement separator-based splitting (`==========`)
- [x] 2.4 Implement per-clipping parsing: title, metadata line (type, page, location, date), content
- [x] 2.5 Implement date parsing: `"DayOfWeek, Month DD, YYYY H:MM:SS AM/PM"` → `DateTime<Utc>`
- [x] 2.6 Implement author extraction from title line (pattern: `Title (Author)`)
- [x] 2.7 Implement book title normalization (trim, BOM strip, whitespace collapse)
- [x] 2.8 Implement content hash computation: `sha256(normalized_title + "|" + content.trim().to_lowercase())`
- [x] 2.9 Implement grouping: parsed clippings → `Vec<KindleBookGroup>`
- [x] 2.10 Handle edge cases: empty content, Windows line endings, BOM, orphan separators, empty files

## 3. Rust Deduplication Logic
- [x] 3.1 Implement Document lookup by synthetic file_path: `kindle://<sha256(normalized_title)>`
- [x] 3.2 Implement Extract lookup by `source_hash` within a document
- [x] 3.3 Build `KindlePreviewResult` by comparing parsed clippings against existing DB state
- [x] 3.4 Build per-book `KindleBookPreview` with new/exists counts for highlights and notes

## 4. Rust Import Logic
- [x] 4.1 Create Documents for new books (with synthetic filePath, metadata.source, metadata.author)
- [x] 4.2 Create Extracts for new clippings (with source_hash, dateCreated from parsed date, tags)
- [x] 4.3 Update existing Documents (increment extractCount, refresh dateModified)
- [x] 4.4 Return `KindleImportResult` with counts

## 5. Tauri Commands
- [x] 5.1 Implement `parse_kindle_clippings_file(path)` → `KindleValidationResult`
- [x] 5.2 Implement `validate_kindle_clippings(path, state)` → `KindlePreviewResult`
- [x] 5.3 Implement `import_kindle_clippings_file(path, state)` → `KindleImportResult`
- [x] 5.4 Register commands in `lib.rs` invoke_handler

## 6. Frontend Utility (`src/utils/kindleClippingsImport.ts`)
- [x] 6.1 Create TypeScript interfaces mirroring Rust result types
- [x] 6.2 Implement `parseKindleClippings(filePath)` wrapper
- [x] 6.3 Implement `validateKindleClippings(filePath)` wrapper
- [x] 6.4 Implement `importKindleClippings(filePath)` wrapper

## 7. Import Preview Dialog (`src/components/import/KindleImportDialog.tsx`)
- [x] 7.1 Create dialog component with state machine: idle → parsing → validating → preview → importing → done
- [x] 7.2 Implement file picker input (`.txt` filter)
- [x] 7.3 Implement preview list: per-book cards with new/exists counts
- [x] 7.4 Implement collapse/expand for fully-imported books ("X books already up to date")
- [x] 7.5 Sort books by new content count (descending)
- [x] 7.6 Implement contextual import button ("Import N New")
- [x] 7.7 Implement "All caught up" state when zero new clippings
- [x] 7.8 Implement error state display for invalid files
- [x] 7.9 Implement success state with summary

## 8. Settings Integration
- [x] 8.1 Add "Kindle Clippings" entry to "Additional Imports" section in `ImportExportSettings.tsx`
- [x] 8.2 Wire file picker to `KindleImportDialog`
- [x] 8.3 Add i18n keys for settings labels and descriptions (en.ts)

## 9. Testing
- [x] 9.1 Rust unit tests: parser with sample clippings (highlight, note, bookmark, edge cases)
- [x] 9.2 Rust unit tests: date parsing (valid dates, invalid dates, AM/PM edge cases)
- [x] 9.3 Rust unit tests: title normalization and author extraction
- [x] 9.4 Rust unit tests: content hash stability and collision resistance
- [x] 9.5 Rust unit tests: empty files, only-bookmarks files, empty-content clippings
- [ ] 9.6 Manual test: import real `My Clippings.txt` file
- [ ] 9.7 Manual test: re-import same file → zero new
- [ ] 9.8 Manual test: re-import file with new clippings appended → only new ones imported

## Out of Scope (deferred)
- EnhancedFilePicker tab integration (not needed — file picker in settings is sufficient)
- Frontend automated tests for dialog
