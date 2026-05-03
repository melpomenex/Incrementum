# Proposal: Kindle Clippings Import

## Intent

Kindle users accumulate hundreds or thousands of highlights and notes in `My Clippings.txt` — a single append-only text file on every Kindle e-reader. There is no way to bring these into Incrementum today. Users are forced to either manually re-type their highlights or rely on third-party tools that don't integrate with Incrementum's extract/review workflow.

This feature adds a first-class import path for `My Clippings.txt` so users can seamlessly bring their Kindle reading history into Incrementum. Each book becomes a Document. Each highlight or note becomes an Extract. The entire experience is designed around the re-import reality: users will connect their Kindle months after the first import, and the system must handle this gracefully with zero duplicates and clear feedback.

## Scope

**In scope:**
- Parse `My Clippings.txt` format (highlights, notes, bookmarks)
- Create one Document per unique book
- Create one Extract per highlight/note (bookmarks are skipped or optionally imported)
- Re-import-safe deduplication by content hash + book identity
- Import preview dialog showing what will be imported (new vs. already-exists counts per book)
- File picker integration (via EnhancedFilePicker + Import/Export settings)
- Tauri backend commands for parsing and import
- UTF-8 and Latin-1 (common Kindle encoding edge case) support

**Out of scope:**
- Direct USB/MTA Kindle connection or auto-detection
- Kindle annotations database (SQLite at `/var/local/Kindle/vocabulary/vocab.db`) — this is a separate, richer format for a future feature
- Kindle KFX format support or actual book file import
- Highlight location re-mapping (Kindle locations → page numbers) — these don't map cleanly
- Kindle notes sync via Amazon API

## Approach

### Parsing (Rust backend)

A new module `src-tauri/src/kindle_clippings.rs` handles parsing. The `My Clippings.txt` format is deceptively simple:

```
Book Title (Author Name)
- Your Highlight on page 123 | Location 456-457 | Added on Sunday, January 1, 2024 3:45:22 PM

The highlighted text goes here.


Book Title (Author Name)
- Your Note on page 200 | Location 890 | Added on Monday, February 2, 2024 10:00:00 AM

Your note text here.


```

Each clipping is separated by `==========` on its own line. The parser:
1. Splits on the `==========` separator
2. Extracts: book title, author, clipping type (Highlight/Note/Bookmark), location, page, date, and content
3. Normalizes book titles for grouping (strip whitespace, handle common encoding artifacts)
4. Assigns a deterministic content hash to each clipping for deduplication

### Deduplication

The core challenge. Re-import must be safe and smart:

- **Content-based hash**: Each clipping gets `sha256(normalized_content + book_title)` as a fingerprint
- **Source metadata**: Each imported Document stores `source: "kindle-clippings"` and a `kindleImportHash` (sha256 of the full book title) in metadata
- **On re-import**: The system compares incoming clipping hashes against existing Extracts on matching Documents (matched by title). Only genuinely new clippings are created.
- **Cross-file deduplication**: Same book can appear in multiple clippings files (e.g., from different Kindles). The title+author normalization ensures these merge into one Document.

### Import Preview Dialog (Frontend)

Before any data is written, the user sees a preview:

```
┌─────────────────────────────────────────────┐
│  📖 Kindle Clippings Import                  │
├─────────────────────────────────────────────┤
│                                              │
│  Found 4 books with 87 clippings            │
│                                              │
│  ┌─ Atomic Habits (James Clear) ──────────┐ │
│  │  23 highlights · 5 notes               │ │
│  │  ✅ 18 already imported                 │ │
│  │  🆕 10 new to import                    │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  ┌─ Deep Work (Cal Newport) ─────────────┐  │
│  │  15 highlights · 3 notes               │ │
│  │  🆕 18 new to import                   │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  ...and 2 more books                        │
│                                              │
│  Total: 28 new extracts across 4 books      │
│                                              │
│           [ Cancel ]  [ Import 28 New ]      │
└─────────────────────────────────────────────┘
```

Key UX details:
- Books with 0 new clippings are collapsed by default (showing "Already up to date")
- Books are sorted by number of new clippings (most first)
- The "Import N New" button shows the exact count
- After import: a brief success toast with the count and a link to view imported documents
- If everything was already imported: a friendly "All caught up! No new clippings to import." message with just an OK button

### Document & Extract Creation

- **Document**: `title = "Book Title (Author)"`, `fileType = "other"`, `category = "Kindle"`, `tags = ["kindle-import"]`, `filePath = "kindle://<normalized-title-hash>"` (synthetic path), metadata includes `source: "kindle-clippings"`, author parsed from title
- **Extract**: `content = highlight/note text`, `notes = (for highlights: empty; for notes: the note body)`, `tags = ["kindle"]`, `dateCreated = parsed Kindle date` (falling back to file mtime if parsing fails)

### Integration Points

- **Import/Export settings**: New "Kindle Clippings" card in the "Additional Imports" section
- **EnhancedFilePicker**: New "Kindle" tab with `.txt` filter
- **Drag-and-drop**: Not ideal here — `My Clippings.txt` is a generic filename, would conflict with plain text imports. File picker only.

## Capabilities

### New Capabilities
- `kindle-clippings-import`: Parse `My Clippings.txt`, preview per-book breakdown with new-vs-existing counts, and import highlights/notes as Documents + Extracts with content-hash deduplication for safe re-import.

### Modified Capabilities
- None (additive only)
