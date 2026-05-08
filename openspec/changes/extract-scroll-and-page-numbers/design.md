## Context

Extracts in scroll mode are rendered by `ExtractScrollItem.tsx`, which wraps content in a card with `max-h-[60vh] overflow-y-auto`. The parent `QueueScrollPage` captures all wheel events on the container and uses them to navigate between queue items. Currently, extract items are not treated as "scrollable documents" in the wheel handler — unlike EPUB/PDF document items which have `isScrollableDocument` checks that prevent auto-advance. This means long extract content cannot be scrolled with the mouse wheel.

For page numbers: EPUB extracts always get `page_number: 1` because the DocumentViewer hardcodes `pageNumber: 1` in the EPUB progress handler. EPUBs use CFI-based positions and emit `progressPercent` (0-100). The EPUB's `totalPages` in the database is actually the spine/chapter count, not printed pages. PDF extracts correctly read `pageNumber` from `PdfSelectionContext.pages[0].pageNumber`, but fall back to the viewer's `pageNumber` state if the selection context is missing — a fragile path.

## Goals / Non-Goals

**Goals:**
- Extract content in scroll mode SHALL be scrollable via mouse wheel without triggering queue navigation
- EPUB extract cards SHALL display a meaningful approximate page number derived from reading progress
- PDF extract page numbers SHALL be reliably sourced from the selection context

**Non-Goals:**
- Adding true "printed page numbers" to EPUBs (reflowable format, no fixed pages)
- Backfilling page numbers for existing extracts without page_number
- Changing how extracts are ordered in the database (currently by page_number)

## Decisions

### 1. Scroll containment via data attribute + parent check

**Decision:** Mark the extract content scrollable area with a `data-extract-scroll="true"` attribute on the `overflow-y-auto` container in `ExtractScrollItem`. In `QueueScrollPage`'s wheel handler, check for this attribute (same pattern used for `[data-transcript-scroll="true"]` and `[data-document-scroll-container]`) and prevent auto-advance when the content can still scroll.

**Why:** This mirrors the existing pattern for transcript scroll containment and document scroll containers. No new state or event handling needed — just a DOM query.

**Alternative:** Using `e.stopPropagation()` on the extract container. Rejected because it would also prevent scroll events from reaching any parent overlays (assistant panel, etc.).

### 2. EPUB page number from progress percentage

**Decision:** Compute approximate EPUB page number at extract creation time using `Math.ceil((progressPercent / 100) * totalPages)` where `totalPages` is the document's `total_pages` from the database (spine/chapter count) and `progressPercent` is the value emitted by EPUBViewer's `onProgressChange`. Store this as the `page_number` on the extract.

**Why:** The progress percentage is already available at the point of selection (it's the only quantitative metric EPUBViewer exposes). Using `totalPages` (spine count) gives chapter-level granularity which is meaningful for navigation: "Chapter 5 of 20" is useful context even if not a printed page number.

**Alternative:** Map CFI to a location index. Rejected because `epubBook.locations` array is internal to epubjs and not exposed, and parsing CFI strings to extract indices is fragile.

### 3. PDF page number from selection context only

**Decision:** For PDF extracts, use `selectionContext.pages[0]?.pageNumber` when available. Only fall back to the viewer's `pageNumber` state if the selection context has no page info (shouldn't happen in practice with the custom PDF selection engine).

**Why:** The selection context's page number is authoritative — it records exactly which page the highlight was on. The viewer's `pageNumber` state can drift if the user navigates after selecting text.

**Alternative:** Always use the viewer's `pageNumber`. Rejected because of the drift risk.

### 4. Pass progressPercent through DocumentViewer to EPUB extract creation

**Decision:** Store the latest `progressPercent` from the EPUBViewer in a ref within DocumentViewer (already tracked via `handleScrollPositionChange` which receives `scrollPercent`). Use this value when creating extracts from EPUB selections to compute the approximate page number.

**Why:** The `scrollPercent` value is already flowing through `handleScrollPositionChange`. We just need to read it from the ref state at extract creation time rather than ignoring it for EPUBs.

## Risks / Trade-offs

- **EPUB "page numbers" are approximate** → Display as chapter-relative (e.g., "Ch. 5") or with a tilde prefix to set expectations. The `totalPages` for EPUB is spine count (chapters), so `Math.ceil(12% * 20) = 3` means "roughly chapter 3 of 20".
- **Existing EPUB extracts with `page_number: 1`** → Not backfilled. These will continue showing "Pg. 1" until re-extracted. Acceptable since the fix is forward-only.
- **Scroll containment edge case** → If an extract's content exactly fills the container (no overflow), wheel events will correctly advance to the next item. No special handling needed since `canScrollDown` will be false.
