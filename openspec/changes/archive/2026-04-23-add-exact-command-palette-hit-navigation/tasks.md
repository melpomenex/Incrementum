# Implementation Tasks

## 1. Define exact-hit navigation contract
- [x] 1.1 Add a shared exact-hit type for command palette results and document viewer tabs.
- [x] 1.2 Replace coarse result metadata where needed so content-backed hits preserve exact anchors plus `textQuote`.
- [x] 1.3 Document fallback order: exact anchor, nearest quote match, then coarse page/scroll jump.

## 2. Update command palette search hit generation
- [x] 2.1 PDF: emit page number plus exact text anchor metadata for the matched span.
- [x] 2.2 EPUB: emit an exact text anchor for the matched span and let the viewer resolve the final location.
- [x] 2.3 HTML/Markdown/Web import: emit selector and/or text-quote anchors for the matched span.
- [x] 2.4 YouTube transcript: ensure hits always preserve exact segment id plus timestamp.
- [x] 2.5 Pass the selected exact hit through `openDocumentInTab()` for both click and Enter activation.

## 3. Update viewer jump and highlight behavior
- [x] 3.1 PDF viewer: resolve the exact page-local hit, scroll it into view, and highlight the matched text.
- [x] 3.2 EPUB viewer: resolve the matched text via viewer search/highlight and open the exact visible span.
- [x] 3.3 HTML/Markdown viewer: resolve the exact DOM/text anchor and highlight the matched range.
- [x] 3.4 Transcript viewer: seek to the matched timestamp and highlight the exact segment.
- [x] 3.5 Keep hit highlights visible for the lifetime of the opened tab.

## 4. Failure handling and regression coverage
- [x] 4.1 Add fallback handling when the exact anchor cannot be resolved because content drifted.
- [x] 4.2 Validate that title-only or metadata-only matches still open normally without fake exact highlighting.
- [ ] 4.3 Manual test: search term in PDF opens to exact sentence and highlights it.
- [ ] 4.4 Manual test: search term in EPUB opens to exact paragraph and highlights it.
- [ ] 4.5 Manual test: search term in HTML/Markdown opens to exact location and highlights it.
- [ ] 4.6 Manual test: search term in YouTube transcript seeks to exact segment and highlights it.
