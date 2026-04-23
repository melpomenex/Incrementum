## Context

Incrementum has five document viewers (PDF, EPUB, HTML, Markdown, YouTube) each with partially-implemented search. CommandCenter performs in-memory content search and builds `SearchHit` objects with `ExactSearchHitLocation` payloads, then passes them via `tabsStore` → `DocumentViewer` → child viewers. The current problems:

1. **EPUB CFI generation is missing** — CommandCenter sets `cfi: ""` because it can't derive a CFI from extracted plain text
2. **PDF page estimation is inaccurate** — linear percentage mapping doesn't account for variable page density
3. **In-document search is inconsistent** — each viewer implements its own search with different callback signatures and no unified contract
4. **Sub-hit navigation doesn't work** — CommandCenter builds secondary hits with locations, but the DocumentViewer often ignores `initialJump` or doesn't resolve the anchor correctly
5. **No unavailable state** — viewers don't report when content isn't searchable (e.g., image-based PDFs)

## Goals / Non-Goals

**Goals:**
- Make Ctrl/Cmd+F search work reliably in all five viewers with match count, next/prev, and highlighting
- Make command-palette sub-hit selection navigate to the exact match in every document type
- Standardize search-state reporting across all viewers behind a single interface
- Fix EPUB search reliability (CFI anchoring + DOM fallback)
- Fix PDF page estimation accuracy

**Non-Goals:**
- Semantic search or AI-powered search
- OCR quality improvements
- Command palette UI redesign
- Full-text search index / backend search
- Search across multiple documents simultaneously in a viewer
- Changing the existing `SearchHit` / `ExactSearchHitLocation` type shapes (they're already correct — the problem is population and consumption)

## Decisions

### Decision 1: Unified `DocumentSearchState` interface

All viewers report search state through a single callback:

```typescript
interface DocumentSearchState {
  available: boolean;       // false when content isn't searchable
  query: string;
  totalMatches: number;
  activeMatchIndex: number; // 0-based, -1 if none active
  // Viewer-specific anchor for the active match (e.g., CFI for EPUB, page for PDF)
  activeMatchAnchor?: ExactSearchHitLocation;
}
```

**Rationale**: Each viewer currently has a different callback shape (`onSearchResultsChange` with different parameter signatures). A unified interface lets DocumentViewer's toolbar consume search state identically regardless of viewer type.

**Alternative considered**: Keep per-viewer callbacks and normalize in DocumentViewer. Rejected because it spreads the normalization logic and makes it easy to forget when adding new viewers.

### Decision 2: EPUB hit anchoring via two-phase resolution

Phase 1 (CommandCenter): Set `textQuote` and `matchIndex` on EPUB `SearchHit` locations. Leave `cfi` empty.

Phase 2 (EPUBViewer at open time): When an `initialJump` arrives with `kind: "epub"` and no CFI, run `searchVisibleContents()` or `book.search()` to find the match, then navigate to the resolved CFI.

**Rationale**: CommandCenter doesn't have access to the epubjs book instance or rendered DOM. The viewer does. Two-phase resolution keeps the search engine simple while leveraging the viewer's rendering context for precise anchoring.

**Alternative considered**: Pre-generate CFIs by loading the EPUB in a headless epubjs instance in CommandCenter. Rejected — too slow and adds epubjs dependency to the search layer.

### Decision 3: PDF page estimation via stored page-break markers

When documents are imported, store approximate character offsets for page breaks in the document metadata (if available from the PDF parser). CommandCenter uses these offsets instead of linear percentage.

**Rationale**: Linear percentage (`buildPdfPageFromIndex()`) is inaccurate for PDFs with variable page density. Storing page-break offsets during import gives much better accuracy without runtime cost.

**Alternative considered**: Fuzzy text search on the target page at open time. This is the fallback when offsets aren't available, but using stored offsets avoids the need for fuzzy matching in most cases.

### Decision 4: Search toolbar in DocumentViewer controls child viewers

DocumentViewer's search toolbar (already exists) sends `searchQuery` and `searchNavigationRequest` (or equivalent) down to the active child viewer. The child viewer performs the actual search and reports `DocumentSearchState` back up.

**Rationale**: Keeps search UI consistent (one toolbar, one set of controls) while letting each viewer implement search in its native way (PDFjs text extraction, epubjs search, DOM walking, transcript filtering).

### Decision 5: Graceful degradation for unavailable search

Viewers report `available: false` in `DocumentSearchState` when content can't be searched. The toolbar shows an explicit "Search unavailable" message instead of silently failing.

**Rationale**: Image-based PDFs, DRM-protected EPUBs, or videos without transcripts should show a clear state rather than appearing to search but finding nothing.

## Risks / Trade-offs

- **[EPUB search timing]** epubjs `book.search()` can be slow for large books. → Mitigation: Use `searchVisibleContents()` (DOM-based) as primary method for in-viewer search. Use `book.search()` only for resolving initial-jump anchors when the match isn't in the visible viewport.

- **[Cross-platform webview timing]** Viewer rendering (especially EPUB and PDF) may take different amounts of time on different platforms. Initial-jump resolution must wait for viewer readiness. → Mitigation: Use each viewer's existing ready-state callback (e.g., `onDocumentReady`, `onPageChange`) before attempting anchor resolution. Add a timeout fallback (3s) that scrolls to coarse position if exact resolution hasn't completed.

- **[PDF page-break storage]** Storing page-break offsets requires re-indexing existing PDFs to get the data. → Mitigation: Fall back to current linear estimation for PDFs that don't have stored offsets. New imports get offsets automatically.

- **[Regression risk]** Changes to shared search interfaces may break existing viewer search that already works (e.g., PDF). → Mitigation: Test each viewer independently before wiring up the unified interface. Keep existing prop-based search working during transition.
