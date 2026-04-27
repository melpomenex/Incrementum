## 1. Scroll Capture from HTML Iframe

- [x] 1.1 Add a ref (`htmlScrollTimeoutRef`) to debounce scroll capture from the iframe's `contentWindow`
- [x] 1.2 Create `captureHtmlScrollState()` callback that reads `scrollTop`, `scrollLeft`, `scrollHeight`, `clientHeight` from `iframeRef.current.contentWindow` (guarded with try/catch) and returns the same shape as `captureScrollState()`
- [x] 1.3 Add a scroll event listener on `iframeRef.current.contentWindow` after iframe load, calling `handleScrollPositionChange` with the captured state (debounced at 500ms); clean up the listener on unmount or iframe reload

## 2. Scroll Persistence for HTML Documents

- [x] 2.1 Extend `captureScrollState()` to fall back to `captureHtmlScrollState()` when `[data-document-scroll-container]` is not found and the document is HTML/OCR-HTML
- [x] 2.2 Generalize `savePdfProgress` into `saveScrollProgress` by removing the `docType !== "pdf"` guard so it also saves for HTML documents
- [x] 2.3 Update the viewMode-change effect (line ~1432) to call the generalized save function instead of `savePdfProgress`, ensuring HTML scroll is flushed before the iframe unmounts

## 3. Scroll Restoration for HTML Documents

- [x] 3.1 Remove or relax the `docType !== "pdf"` guard in the restoration effect (line ~1751) to allow HTML documents through
- [x] 3.2 Add HTML-specific restoration logic: after the iframe loads and the restoration effect determines a saved ViewState exists, scroll `iframeRef.current.contentWindow` to the saved `scrollTop` and `scrollLeft`
- [x] 3.3 Coordinate restoration with the `onLoad` handler: if a restoration is pending when the iframe loads, apply the scroll after `scrollHtmlFrameToInitialHit()` (skip restoration if there's an `initialJump` target that takes priority)
- [x] 3.4 Add a `restorationInProgressRef` guard for HTML restoration to prevent the scroll-capture listener from overwriting the saved position during restoration

## 4. Testing & Verification

- [ ] 4.1 Test: open an HTML document, scroll to mid-page, switch to "View Extracts", switch back — verify scroll position is restored (manual)
- [ ] 4.2 Test: open an HTML document, scroll, switch to "View Learning Cards", switch back — verify scroll position is restored (manual)
- [ ] 4.3 Test: open a PDF in OCR-HTML mode, scroll, switch to extracts and back — verify scroll position is restored (manual)
- [ ] 4.4 Test: open an HTML document with no saved position — verify it loads at the top with no errors (manual)
- [ ] 4.5 Test: navigate to an HTML document via search hit (initialJump) — verify it scrolls to the hit, not a stale saved position (manual)

## 5. Fix extract button for HTML iframe selection

- [x] 5.1 Add `mouseup` handler on iframe element in parent document to read selection from `iframeRef.current.contentWindow.getSelection()` as fallback for when the iframe-internal selection listener fails to attach
- [x] 5.2 Ensure the handler also works for OCR-HTML mode (docType === "pdf" && pdfViewMode === "ocr-html")
