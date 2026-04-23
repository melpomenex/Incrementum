# Design: Exact command palette hit navigation

## Goals
- Preserve exact match anchors from command-palette search through viewer open.
- Make all content-backed search results behave consistently across PDFs, books, web documents, markdown, and transcripts.
- Keep highlight state visible after the jump so the user can confirm the navigation succeeded.

## Non-Goals
- Changing ranking, fuzzy matching, or result grouping in the command palette.
- Solving unrelated PDF rendering performance issues.

## Current Gap
The current search path already passes `highlightQuery` and `initialJump`, but the hit model is mixed:
- PDF uses estimated page number only.
- EPUB may degrade to generic scroll position.
- HTML/Markdown can degrade to scroll percent.
- YouTube transcript is closest to exact behavior because it can target a segment timestamp.

That means the viewer contract is not strong enough to guarantee exact hit navigation.

## Proposed Architecture

### 1. Canonical exact-hit descriptor
Add a viewer-facing hit descriptor that can preserve both the document-level jump and the exact match anchor.

Example shape:

```ts
type ExactSearchHit =
  | { kind: "pdf"; pageNumber: number; textQuote: string; textOffsetHint?: number }
  | { kind: "epub"; cfi: string; cfiRange?: string; textQuote: string }
  | { kind: "html"; selector?: string; textQuote: string; textPosition?: { start: number; end: number } }
  | { kind: "markdown"; textQuote: string; textPosition?: { start: number; end: number } }
  | { kind: "youtube"; timeSeconds: number; segmentId: string; textQuote: string };
```

The key rule is that every hit must carry enough information for the destination viewer to identify the exact matched span, not just the broader page or section.

### 2. Search-layer responsibilities
`CommandCenter` should:
- compute the exact matched span when building excerpts
- attach stable anchor data to `primaryHit` and `secondaryHits`
- avoid degrading to scroll percent when a stronger anchor exists

Per content type:
- **PDF**: preserve page number plus text quote and offset hint for the page text layer
- **EPUB**: use CFI or CFI range from the EPUB search result when available
- **HTML/Markdown**: preserve a text quote anchor and optional selector or range hint
- **YouTube**: preserve segment id and timestamp for the matched transcript segment

### 3. Viewer responsibilities
`DocumentViewer` and child viewers should treat exact-hit navigation as a first-class mode:
- resolve the anchor
- scroll or seek to that anchor
- apply a visible highlight to the matched span
- keep the highlight alive while the tab remains open

Fallback behavior should be explicit:
1. resolve exact anchor
2. if exact anchor fails, run a local nearest-match search using `textQuote`
3. only if that fails, fall back to coarse page/scroll navigation

### 4. Persistence and lifecycle
Search-hit highlights should be scoped to the opened tab:
- they remain visible while the tab stays open
- they are cleared on unmount or when a new explicit search-hit navigation replaces them

## Risks
- PDF exact-hit navigation depends on text-layer fidelity and OCR quality.
- HTML exact anchors can drift if sanitized markup changes after indexing.
- EPUB exact CFI ranges may need extra normalization across renderer reloads.

## Mitigations
- Preserve both structural anchor data and a `textQuote` fallback.
- Prefer viewer-local re-resolution at open time instead of trusting only stored offsets.
- Treat exact-hit resolution failures as recoverable, but log them so degraded navigation can be fixed.
