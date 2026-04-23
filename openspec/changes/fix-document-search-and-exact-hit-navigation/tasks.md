## 1. Unified Search State Interface

- [x] 1.1 Define `DocumentSearchState` interface in a shared types file with `available`, `query`, `totalMatches`, `activeMatchIndex`, and optional `activeMatchAnchor`
- [x] 1.2 Update PDFViewer to report `DocumentSearchState` via a new or adapted callback from its existing `onSearchResultsChange`
- [x] 1.3 Update EPUBViewer to report `DocumentSearchState` via adapted callback from its existing `onSearchResultsChange`
- [x] 1.4 Update MarkdownViewer to report `DocumentSearchState` via adapted callback
- [x] 1.5 Update YouTubeViewer/TranscriptSync to report `DocumentSearchState` from transcript search state
- [x] 1.6 Add `available: false` reporting for non-searchable content (image-based PDFs, videos without transcripts)

## 2. DocumentViewer Search Toolbar

- [x] 2.1 Wire DocumentViewer toolbar to consume `DocumentSearchState` from the active child viewer
- [x] 2.2 Add keyboard shortcut listener (Ctrl+F / Cmd+F) in DocumentViewer that opens search toolbar and focuses input
- [x] 2.3 Display match count and active index (e.g., "3 of 12") in the search toolbar
- [x] 2.4 Add next/previous match navigation buttons and wire them to the active viewer
- [x] 2.5 Display explicit "Search unavailable" message when child viewer reports `available: false`
- [x] 2.6 Ensure search close (Escape / close button) clears all highlights and resets state
- [x] 2.7 Add keyboard shortcuts for next/prev match navigation (Enter / Shift+Enter or arrow keys)

## 3. EPUB Search Reliability

- [x] 3.1 Ensure EPUBViewer's `searchVisibleContents()` DOM-based search is the primary search method for in-viewer queries
- [x] 3.2 Add fallback to `book.search()` for non-visible sections when user navigates to a match outside the current chapter
- [x] 3.3 Ensure search highlights use consistent CSS classes (`epub-search-highlight` / `epub-search-highlight-active`) and are visually distinct
- [x] 3.4 Verify match count is accurate and updates as chapters are searched

## 4. EPUB Command-Palette Hit Anchoring

- [x] 4.1 Update CommandCenter to populate `textQuote` and `matchIndex` for EPUB SearchHit locations (currently sets `cfi: ""`)
- [x] 4.2 In EPUBViewer, add initial-jump resolution logic: when `initialJump.kind === "epub"` and CFI is empty, search rendered content for `textQuote` at the specified `matchIndex`
- [x] 4.3 After resolving the match, generate a CFI from the match location and navigate to it
- [x] 4.4 Highlight the resolved match with the `epub-search-highlight-active` style

## 5. PDF Page Estimation Fix

- [x] 5.1 Update PDF import/indexing to store page-break character offsets in document metadata
- [x] 5.2 Update CommandCenter's `buildPdfPageFromIndex()` to use stored offsets when available, falling back to linear estimation
- [x] 5.3 Verify PDF sub-hit navigation lands on the correct page after the fix

## 6. Initial Jump Viewer Readiness

- [x] 6.1 Add a readiness gate in DocumentViewer that defers initial-jump resolution until the child viewer reports it has rendered content
- [x] 6.2 Add a 3-second timeout fallback: if viewer doesn't report readiness, log a warning and skip exact navigation
- [x] 6.3 Verify EPUB, PDF, HTML, and Markdown viewers all signal readiness before initial-jump resolution attempts

## 7. HTML Viewer Exact Navigation

- [x] 7.1 Ensure HTML viewer's `scrollHtmlFrameToInitialHit()` correctly searches iframe DOM for the text quote
- [x] 7.2 Add visible highlighting of the matched text in the HTML iframe after scrolling
- [x] 7.3 Handle case where text quote is not found — fall back to scroll percentage or skip

## 8. Cross-Viewer Verification

- [x] 8.1 Test PDF: open from command-palette sub-hit → verify correct page, highlighted text, and match count in toolbar
- [x] 8.2 Test EPUB: open from command-palette sub-hit → verify correct location, highlighted text, and match count
- [x] 8.3 Test Markdown: open from command-palette sub-hit → verify correct scroll position and highlighted text
- [x] 8.4 Test YouTube: open from command-palette sub-hit → verify correct seek time and highlighted transcript segment
- [x] 8.5 Test HTML: open from command-palette sub-hit → verify correct scroll and highlighted text
- [x] 8.6 Test search-unavailable state for image-based PDF and video without transcript
- [x] 8.7 Verify Ctrl+F / Cmd+F keyboard shortcut works on Linux, macOS, and Windows
