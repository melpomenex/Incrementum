## Context

The current viewer search UI is only partially built:

- `DocumentViewer.tsx` renders a search field and listens for Enter/Escape, but `handleSearch()` is still a placeholder
- `PDFViewer.tsx` already extracts page text for some features and supports jump-highlighting from command-palette navigation, but it does not expose a user-driven find workflow with indexed matches and next/previous traversal
- `EPUBViewer.tsx` can apply highlight annotations for a provided `highlightQuery`, but that path is oriented around jump navigation, not interactive search state
- `TranscriptSync.tsx` has its own internal `searchQuery` filter state, so transcript searching is siloed inside the transcript panel rather than integrated with the main viewer search control

The result is inconsistent behavior by format and no shared contract for match state.

## Goals / Non-Goals

**Goals:**

- Make the existing viewer search affordance actually work for PDFs, EPUBs, HTML/Markdown documents, and YouTube transcripts
- Provide a consistent user model: open search, enter query, see match count, navigate next/previous, highlight the active match
- Keep format-specific search logic inside each viewer while centralizing shared search state and keyboard behavior in `DocumentViewer`
- Make failure states explicit when content is not searchable

**Non-Goals:**

- Replacing the command-palette/global-search system
- Implementing semantic search
- Solving OCR quality issues for image-only PDFs
- Redesigning transcript UI beyond what is needed to support externally-controlled find behavior

## Decisions

**1. `DocumentViewer` becomes the search coordinator**

The top-level viewer already owns the search UI and keyboard affordances, so it should also own the normalized query, active-match index, result count, and next/previous commands. Child viewers should implement a narrow search adapter contract instead of each inventing their own unrelated search state.

Why:

- Keeps keyboard behavior and toolbar state consistent across formats
- Avoids duplicating search chrome inside each viewer
- Makes it possible to show one match-count/status area for all document types

**2. Each viewer implements format-native search resolution**

Search should not be reduced to a generic string scan at the `DocumentViewer` level. Each viewer already has format-specific primitives:

- PDF: extracted page text, page-aware highlighting, and current-page rendering state
- EPUB: `book.search()` and CFI-based highlight annotations
- HTML/Markdown: DOM text search with match markers and scroll-to-match behavior
- YouTube transcripts: segment-based matching with seek-to-segment navigation

Why:

- Preserves accurate navigation for each format
- Allows active-match highlighting to line up with the actual rendered surface
- Prevents lossy conversions from format-specific locations into generic offsets

**3. Transcript search becomes externally controllable**

`TranscriptSync` should stop owning the authoritative search query for viewer-driven find operations. Instead, `YouTubeViewer`/`TranscriptSync` should accept the active query, resolved matches, and navigation commands from the shared viewer search controller.

Why:

- The transcript panel already knows how to highlight and scroll segments, but its current local-only filter state prevents `Ctrl/Cmd+F` from working consistently
- Search opened from the viewer toolbar and from keyboard shortcuts must target the same result set

**4. PDFs without a searchable text layer must fail clearly**

If a PDF has no extracted text or the rendered text layer cannot resolve matches, the viewer should show a clear "search unavailable" state with an OCR/extract-text suggestion instead of silently reporting nothing.

Why:

- "0 results" is misleading when the real problem is "this document has no searchable text"
- The repo already has OCR/extraction pathways, so the correct fallback is discoverable

## Risks / Trade-offs

- **[Risk] PDF search may feel incomplete on partially extracted documents** -> Mitigation: distinguish between "0 matches" and "search unavailable/no text layer", and base page navigation on the extracted text cache the viewer actually has.
- **[Risk] EPUB search results may be expensive on large books** -> Mitigation: debounce query execution and cap eager highlight rendering while still allowing next/previous traversal across the full result set.
- **[Risk] Transcript filtering can hide temporal context** -> Mitigation: viewer-driven search should highlight and navigate matches without requiring the entire transcript to collapse to only matching rows.
- **[Trade-off] Shared coordination adds prop surface between `DocumentViewer` and child viewers** -> Acceptable because the current disconnected approach is the root cause of the broken UX.
