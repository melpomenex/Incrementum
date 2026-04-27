## Context

DocumentViewer tracks the current page number (`pageNumber` state) in both PDF and HTML (OCR) views. In HTML view, a scroll listener detects which `<div class="page" id="page-N">` is at the viewport midpoint and calls `setPageNumber()`. In PDF view, the PDFViewer component independently restores its scroll position from localStorage via `loadReadingPosition()` and its own `restoreState`/`restoreRequestId` mechanism.

The toggle between PDF and HTML is controlled by `pdfViewMode` state (`"pdf"` | `"ocr-html"`). When toggling to PDF, the PDFViewer remounts (conditional render at line 4338) and triggers its own position restoration, ignoring the current `pageNumber` that was active in HTML view.

## Goals / Non-Goals

**Goals:**
- When toggling from HTML back to PDF, navigate PDFViewer to the page that was visible in HTML view
- Minimal changes — leverage existing `pageNumber` state and PDFViewer's `restoreState` mechanism

**Non-Goals:**
- Preserving exact scroll offset within the page (page-level accuracy is sufficient)
- Syncing between native HTML documents and PDF (only applies to PDF docs with OCR conversion)
- Changing how position is persisted to localStorage

## Decisions

### Decision 1: Use `restoreState` to override position on toggle

When `setPdfViewMode("pdf")` is called, create a new `restoreState` with `pageNumber` from the current HTML view (and no `scrollTop`/`dest`) and increment `restoreRequestId`. PDFViewer already handles `restoreState` restoration (line 2019+), so no changes needed inside PDFViewer itself.

**Why this approach**: PDFViewer already has a well-tested `restoreState`/`restoreRequestId` mechanism that scrolls to a given page. Reusing it avoids modifying PDFViewer internals and avoids timing issues with the PDF loading.

**Alternative considered**: Passing `pageNumber` as a prop and having PDFViewer scroll on prop change — rejected because PDFViewer already has its own page-tracking via scroll and this would conflict with its restoration logic.

### Decision 2: Only override on toggle from HTML to PDF, not on initial load

The page sync only applies when switching FROM `"ocr-html"` TO `"pdf"`. Initial PDF loads (document change, app startup) continue to use the normal position restoration from localStorage.

## Risks / Trade-offs

- [Race condition with restoreRequestId] → The `restoreRequestId` must be incremented before PDFViewer remounts. Since React state updates batch, calling both `setPdfViewMode` and `setRestoreState`/`setRestoreRequestId` in the same handler is safe.
- [PDFViewer remounts on toggle] → Since PDFViewer is conditionally rendered (not hidden), it fully remounts each toggle. This is existing behavior and the `restoreState` mechanism already handles restoration on mount.
