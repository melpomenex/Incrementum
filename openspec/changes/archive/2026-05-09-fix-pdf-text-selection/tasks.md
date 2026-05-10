## 1. Per-page selection fallback infrastructure

- [x] 1.1 Add `extractionSuccessRef: Map<number, boolean>` to `usePdfCustomSelection` to track per-page extraction success alongside existing `indexedPagesRef`
- [x] 1.2 Expose `extractionSuccessRef` (or a derived getter) from the hook return value so `PDFViewer.tsx` can read per-page status
- [x] 1.3 Replace the blanket `ENABLE_CUSTOM_PDF_SELECTION && "customSelectionActive"` class in PDFViewer.tsx (line 2803) with a per-page check: only apply `customSelectionActive` when `extractionSuccessRef.get(pageIndex) === true`

## 2. Token extraction failure recovery

- [x] 2.1 In `extractPageTokens`, update `extractionSuccessRef` to `true` on success and `false` on failure (currently errors are caught and logged but success/failure is not tracked)
- [x] 2.2 Improve error logging in `extractPageTokens`: include page number and whether `textContent.items` was empty vs an exception was thrown

## 3. Queued selection retry on unindexed pages

- [x] 3.1 In `handlePointerDown`, when a page is not yet indexed, trigger extraction and set up a pending selection state (pageIndex + coordinates) instead of silently returning
- [x] 3.2 After `extractPageTokens` completes for a page, check if there is a pending selection for that page and replay it if extraction succeeded, or remove `customSelectionActive` if it failed
- [x] 3.3 Add a 2-second timeout for pending selections — if extraction hasn't completed, remove `customSelectionActive` for that page to re-enable native selection

## 4. CSS update

- [x] 4.1 Verify that removing `customSelectionActive` from a page's `textLayerContainer` correctly restores `pointer-events: auto` and `user-select: text` on the text layer spans (check CSS specificity in PDFViewer.css lines 265-273)

## 5. Testing

- [ ] 5.1 Manual test: open a PDF, verify text selection works on current page and adjacent pages
- [ ] 5.2 Manual test: test with a scanned/image-only PDF page — verify native selection is available (even if no text to select)
- [ ] 5.3 Console check: trigger token extraction failure and verify diagnostic logs include page number and reason
