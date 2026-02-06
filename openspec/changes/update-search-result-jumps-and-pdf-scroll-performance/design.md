# Design: Search Jump Navigation and PDF Scroll Performance

## Goals
- Selecting a command-palette search result navigates to the match location and highlights the user’s query within the opened document.
- Search results remain “one row per document” by default, while exposing additional match options on hover.
- YouTube transcript results seek to a timestamp and start playback.
- PDF scrolling becomes meaningfully smoother by removing eager full-document rendering and reducing per-scroll work.

## Non-Goals (for this change)
- Pixel-perfect “scroll to exact within-page match” for PDFs. For PDFs, page-level navigation is sufficient (open the page and highlight there).
- A full semantic transcript search mode (handled by `add-semantic-transcript-search`).

## Current State (Observed)
- `src/components/search/CommandCenter.tsx` returns search results with excerpt text and `<mark>` highlighting, but no location metadata.
- Clicking a result opens `DocumentViewer` without scrolling/seeking to a match.
- `src/components/viewer/PDFViewer.tsx` eagerly renders all pages and text layers on load and on zoom changes, and the scroll handler performs O(pages) work plus frequent logging.

## Proposed Architecture

### 1) Location-Aware Search Hits
Introduce a small, typed “hit location” model that can be attached to a search result:
- `pdf`: `{ pageNumber: number }`
- `epub`: `{ cfi: string, cfiRange?: string }` (range preferred when available)
- `html`: `{ selector?: string, scrollPercent?: number }` (selector preferred)
- `youtube`: `{ timeSeconds: number, segmentId?: string }`

Each command-palette document result should carry:
- `primaryHit`: the best match location
- `secondaryHits`: a small list (e.g. up to 5) of additional locations within that same document
- `highlightQuery`: the user’s raw query string

### 2) One Row Per Document, More Hits on Hover
UI behavior:
- The results list shows one entry per document (using `primaryHit` excerpt).
- Hovering a document entry reveals a lightweight “More matches in this document” list showing secondary hit snippets (or timestamps/pages).
- Clicking a secondary hit navigates to that specific location.

Implementation note: this is easiest if the search layer returns grouped results already, rather than asking the UI to de-duplicate and re-group.

### 3) Navigation + Highlight Plumbing
When a result is selected:
1. Open the document tab (existing behavior).
2. Pass navigation intent into the viewer via tab `data`, e.g.:
   - `initialJump`: the chosen hit location (page/cfi/selector/time)
   - `highlightQuery`: the query to highlight
3. Viewer applies the jump and enables “search highlight mode” for the lifetime of that tab.

Highlight lifetime:
- Highlights persist until the document tab is closed (unmount of viewer clears any injected marks/overlays).

YouTube specifics:
- If the result is a transcript hit, seek to `timeSeconds` and start playback.
- If the result matched only title/metadata, open the video normally (resume saved position, as implemented today).

### 4) PDF Performance Strategy
The lag is consistent with:
- Eager rendering of every page canvas + every page text layer (`for i=1..numPages`).
- O(pages) scan on every scroll frame to compute current page.
- Frequent `console.log` in the scroll handler.
- State updates on scroll that force React re-rendering (`setScrollPosition`).

Proposed minimal performance fixes:
- Switch to windowed rendering:
  - Keep page containers for layout, but only render canvas + text layer for pages within a render window around the viewport (e.g. current page ± 2).
  - Ensure rendered pages are re-used while scrolling, and render work is queued/cancelable.
- Reduce scroll handler cost:
  - Remove per-scroll logging.
  - Avoid React state updates on normal scroll; use refs for ephemeral scroll position except where UI needs it.
  - Replace linear scan for current page with cached page offsets and binary search, or an `IntersectionObserver`-based “current page” tracker.
- Limit text layer creation:
  - Only build text layers for rendered pages in the window.

## Tradeoffs
- Windowed rendering reduces CPU/GPU load but introduces “late render” risk during fast scroll; mitigate by prefetching a small buffer and prioritizing the next pages in scroll direction.
- Highlighting in PDFs depends on the text layer; matches outside the render window are not highlighted until that page is rendered (acceptable given page-level jump requirement).

