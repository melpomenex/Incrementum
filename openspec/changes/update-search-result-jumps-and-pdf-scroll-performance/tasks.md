## 1. Implementation
- [x] 1.1 Add a typed hit-location model for search results (page/CFI/selector/time) and update the command palette search pipeline to produce location-aware, grouped results.
- [x] 1.2 Update command palette results UI to show one entry per document with “more matches” revealed on hover; ensure keyboard navigation still works (Arrow keys + Enter).
- [x] 1.3 Implement jump + highlight plumbing into viewers:
- [x] 1.3.1 PDF: open to `pageNumber` and highlight matches on that page; keep highlight until tab closes.
- [x] 1.3.2 EPUB: open to `cfi`/`cfiRange` and highlight; keep highlight until tab closes.
- [x] 1.3.3 Web Import (HTML): scroll to selector/approx location and highlight; keep highlight until tab closes.
- [x] 1.3.4 YouTube transcript: seek to timestamp, start playback, and highlight the matching transcript segment; otherwise resume saved position for title-only matches.
- [x] 1.4 Improve PDF scrolling performance:
- [x] 1.4.1 Replace eager “render all pages” with windowed/lazy rendering and cancelable render tasks.
- [x] 1.4.2 Reduce per-scroll overhead (remove per-scroll logging, avoid React state churn, replace O(pages) scans with cached offsets or IntersectionObserver).
- [ ] 1.5 Add lightweight validation:
- [ ] 1.5.1 Manual: command palette search -> click result -> viewer navigates + highlights for PDF/EPUB/HTML/YouTube.
- [ ] 1.5.2 Manual: PDF scroll performance feels smoother on a large PDF (>= 200 pages); confirm CPU usage drops and scroll remains responsive.
- [ ] 1.5.3 Regression: existing selection highlighting and restore-position behavior still works for PDFs.

## 2. Tooling / Docs
- [x] 2.1 Update any relevant user-facing docs (if present) describing “click search result jumps to match” behavior.
