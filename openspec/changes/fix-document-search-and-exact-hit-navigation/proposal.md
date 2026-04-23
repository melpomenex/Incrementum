## Why

In-document search and command-palette hit navigation are unreliable across multiple document types. EPUB search often fails entirely; command-palette sub-hits navigate to the top of the document instead of the exact match; and in-viewer search (Ctrl/Cmd+F) has inconsistent behavior across PDF, EPUB, HTML, and markdown viewers. These are core reading features that need to work reliably.

## What Changes

- Fix in-document search UI so Ctrl/Cmd+F (or magnifying glass) works consistently across PDF, EPUB, HTML, and markdown viewers with match count, next/prev navigation, active match highlighting, and an explicit "search unavailable" state
- Fix command-palette content-hit navigation so selecting a specific sub-hit opens the document at that exact occurrence (not the first match or document top)
- Improve EPUB search reliability by falling back to visible-content DOM search when epubjs `book.search()` is slow or fails
- Improve EPUB hit anchoring so command-palette results carry usable CFIs instead of empty strings
- Improve PDF page estimation in CommandCenter by using stored page-break offsets or a more accurate heuristic than linear percentage
- Ensure YouTube transcript search and exact-segment navigation work end-to-end from command palette through TranscriptSync
- Add a unified search-state interface that all viewers report through, so the toolbar/search UI has consistent data regardless of document type

## Capabilities

### New Capabilities

- `in-document-search`: Unified in-document search behavior across all viewer types — match counting, next/prev navigation, active highlighting, and unavailable-state reporting
- `command-palette-exact-navigation`: Reliable exact-hit navigation from command-palette sub-hit selection to the precise match location in any document type

### Modified Capabilities

- `exact-search-hit-navigation`: Expanding the existing spec to cover in-document search requirements (match count, next/prev, highlighting) in addition to the existing command-palette anchor and navigation requirements. Adding explicit degraded-state and unavailable-state requirements.

## Impact

- **Viewers**: PDFViewer, EPUBViewer, MarkdownViewer, YouTubeViewer — all need search-state reporting standardization and bug fixes
- **TranscriptSync**: Already has search; needs tighter integration with unified search state
- **CommandCenter**: Hit anchoring logic needs fixing (EPUB CFI generation, PDF page estimation)
- **DocumentViewer**: Toolbar search UI needs to consume unified search state from child viewers
- **Types**: `SearchHit`, `ExactSearchHitLocation`, `TranscriptSearchState` — may need extensions for unified search state
- **No new dependencies** — changes are internal to existing viewer components
