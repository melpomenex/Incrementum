# Design: Kindle Clippings Import

## Architecture

This follows the established import pattern: Rust backend module → Tauri commands → Frontend utility → UI integration.

```
src-tauri/src/kindle_clippings.rs      (NEW - parser + dedup logic)
src-tauri/src/commands/mod.rs           (register new commands)
src/utils/kindleClippingsImport.ts      (NEW - frontend utility wrapper)
src/components/import/KindleImportDialog.tsx  (NEW - preview dialog)
src/components/settings/ImportExportSettings.tsx  (add Kindle entry)
```

## Rust Backend: `kindle_clippings.rs`

### Data Structures

```rust
#[derive(Debug, Clone)]
pub struct KindleClipping {
    pub book_title: String,
    pub author: Option<String>,
    pub clipping_type: ClippingType,  // Highlight, Note, Bookmark
    pub page: Option<i32>,
    pub location_start: Option<i32>,
    pub location_end: Option<i32>,
    pub date_added: Option<DateTime<Utc>>,
    pub content: String,
    pub content_hash: String,  // sha256(title + content), computed at parse time
}

#[derive(Debug, Clone)]
pub enum ClippingType {
    Highlight,
    Note,
    Bookmark,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KindleBookGroup {
    pub title: String,
    pub author: Option<String>,
    pub normalized_title: String,
    pub highlights: Vec<KindleClipping>,
    pub notes: Vec<KindleClipping>,
    pub bookmarks: Vec<KindleClipping>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KindleValidationResult {
    pub books: Vec<KindleBookGroup>,
    pub total_clippings: usize,
    pub total_highlights: usize,
    pub total_notes: usize,
    pub total_bookmarks: usize,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KindlePreviewResult {
    pub books: Vec<KindleBookPreview>,
    pub total_new_extracts: usize,
    pub total_existing_extracts: usize,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KindleBookPreview {
    pub title: String,
    pub author: Option<String>,
    pub new_highlights: usize,
    pub existing_highlights: usize,
    pub new_notes: usize,
    pub existing_notes: usize,
    pub skipped_bookmarks: usize,
    pub is_new_book: bool,  // true if no Document exists yet
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KindleImportResult {
    pub new_documents: usize,
    pub new_extracts: usize,
    pub updated_documents: usize,
    pub warnings: Vec<String>,
}
```

### Parser Design

The `My Clippings.txt` format:

```
Book Title (Author Name)
- Your Highlight on page 123 | Location 456-457 | Added on Sunday, January 1, 2024 3:45:22 PM

Highlighted text here.


==========
```

**Parsing strategy:**

1. Read file bytes. Try UTF-8 first; if invalid sequences found, fall back to Latin-1.
2. Split on `\n==========\n` (the standard separator). Each chunk is one clipping entry.
3. For each chunk:
   - Line 1 = book title line (may contain author in parentheses)
   - Line 2 = metadata line (type, page, location, date)
   - Empty line
   - Remaining lines = content
4. Parse the metadata line with regex:
   ```
   - Your (Highlight|Note|Bookmark) (on page (\d+) \| )?(Location (\d+)(?:-(\d+))? \| )?Added on (.+)
   ```
5. Parse the date: `"DayOfWeek, Month DD, YYYY H:MM:SS AM/PM"` → `DateTime<Utc>`
6. Parse book title: strip known patterns like `(Author Name)` from the end
7. Compute content hash: `sha256(normalized_title + "|" + content.trim())`

**Title normalization for grouping:**

```rust
fn normalize_book_title(title: &str) -> String {
    title.trim()
        .replace('\u{feff}', "")      // BOM
        .replace('\u{200b}', "")      // zero-width space
        .replace('\r\n', " ")
        .replace('\n', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}
```

### Deduplication Strategy

**Why content hash, not location?** Kindle locations are unstable — they change between device models, firmware versions, and file formats. The same highlighted passage may have location 456-457 on one Kindle and 412-413 on another. Content is the stable identifier.

**Hash function:**
```
sha256(normalize_book_title(book_title) + "|" + content.trim().to_lowercase())
```

Lowercasing the content catches near-duplicates from encoding differences.

**Database lookup flow (in `validate_kindle_clippings`):**

1. Parse file → get list of `KindleClipping` with their `content_hash`
2. For each book group, check if a Document exists:
   - Query: `SELECT id FROM documents WHERE file_path = 'kindle://<sha256(normalized_title)>'`
   - The synthetic `file_path` acts as a stable lookup key
3. For each clipping, check if an Extract already exists:
   - Query: `SELECT id FROM extracts WHERE document_id = ? AND content_hash = ?`
   - We need to store the content hash on the Extract. Options:
     a. Add a `source_hash` column to the extracts table
     b. Store it in the existing `selection_context` JSON field
   - **Decision**: Store in `selection_context` as `{"kindleContentHash": "sha256:..."}`. This avoids a schema migration for a single import feature and keeps the hash queryable via JSON.

**Wait — JSON field queries are slow.** Better approach:

- Add a `source_hash` TEXT column to the `extracts` table (nullable, only populated for imported extracts)
- This requires a migration, but it's a clean solution and the column has general utility for any future import dedup

**Revised decision**: Add `source_hash` column to `extracts` table. This is the right call — it's a single nullable column, serves the dedup use case cleanly, and is future-proof for other importers.

### Database Migration

```sql
ALTER TABLE extracts ADD COLUMN source_hash TEXT NULL;
CREATE INDEX idx_extracts_source_hash ON extracts(source_hash);
```

The index is important — during re-import validation, we'll query for hundreds of hashes at once.

### Tauri Commands

```rust
#[tauri::command]
pub async fn parse_kindle_clippings(path: String) -> Result<KindleValidationResult, String>

#[tauri::command]
pub async fn validate_kindle_clippings(
    path: String,
    state: State<'_, AppState>
) -> Result<KindlePreviewResult, String>

#[tauri::command]
pub async fn import_kindle_clippings(
    path: String,
    state: State<'_, AppState>
) -> Result<KindleImportResult, String>
```

The three-step flow:
1. `parse` → quick format check, no DB involved (used for initial validation)
2. `validate` → parse + check existing DB for dedup counts (used for preview)
3. `import` → parse + create/update DB records (the actual import)

This separation lets the preview be fast (no writes) and the import be idempotent.

## Frontend

### `KindleImportDialog.tsx`

A modal dialog that shows the preview. Follows the same patterns as existing import dialogs in the project.

**States:**
1. `idle` — waiting for file selection
2. `parsing` — reading/parsing file (brief, < 1s)
3. `validating` — checking against database (brief)
4. `preview` — showing results, waiting for user confirmation
5. `importing` — writing to database
6. `done` — showing success

**Key UX decisions:**

- **No multi-select for files**: Kindle produces a single `My Clippings.txt`. One file, one dialog.
- **Collapse fully-imported books**: Books where `newHighlights + newNotes == 0` are collapsed behind a "X books already up to date" toggle. Keeps the preview focused on actionable items.
- **Sort by new content count**: Books with the most new clippings appear first.
- **Import button is contextual**: Shows "Import N New" with the exact count. Disabled (or hidden) when count is 0.
- **Success state includes navigation**: After import, the dialog shows a summary and a "View Imported Books" button that navigates to the documents view.

### `ImportExportSettings.tsx` Integration

Add to the "Additional Imports" section:

```tsx
<div className="p-4 bg-muted/30 rounded-lg space-y-3">
  <h4 className="text-sm font-medium text-foreground">
    {t("importExport.kindleClippings")}
  </h4>
  <p className="text-xs text-muted-foreground">
    {t("importExport.kindleClippingsDesc")}
  </p>
  <div className="flex items-center gap-2">
    <input type="file" accept=".txt" onChange={handleKindleFile} className="flex-1 text-sm" />
    <button onClick={handleKindleImport} className="...">
      {t("documentsView.import")}
    </button>
  </div>
</div>
```

### EnhancedFilePicker Tab

Add a "Kindle" tab alongside "Anki", "SuperMemo", etc. with `.txt` filter and the same preview dialog flow.

## Edge Cases

1. **Empty content clippings**: Kindle sometimes creates clippings with empty content. Skip these silently.
2. **Very long clippings**: Some users highlight entire chapters. No length limit, but truncate preview display.
3. **Non-English titles**: UTF-8 handles this natively. Latin-1 fallback covers older Kindles.
4. **Same highlight text in different books**: The content hash includes the book title, so these are correctly treated as distinct.
5. **File with only the separator line**: Return empty result, not an error.
6. **Windows line endings (`\r\n`)**: Handle in the parser's split logic.
7. **BOM at file start**: Strip UTF-8 BOM (`\u{feff}`) before parsing.
8. **Author in title**: Kindle puts the author in parentheses at the end of the title line. Parse this out for both the Document title and the `metadata.author` field.
