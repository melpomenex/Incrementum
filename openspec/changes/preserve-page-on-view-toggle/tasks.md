## 1. Page Sync on Toggle

- [x] 1.1 In `DocumentViewer.tsx`, replace the `onClick={() => setPdfViewMode("pdf")}` handler (line 3959) with a function that captures the current `pageNumber`, sets `restoreState` to `{ pageNumber, docId, scale, zoomMode, updatedAt: Date.now() }`, increments `restoreRequestId`, and then calls `setPdfViewMode("pdf")`
- [x] 1.2 Verify the toggle from PDF → HTML → PDF preserves the page number correctly

## 2. Validation

- [x] 2.1 Test toggle from HTML page 14 back to PDF — confirm page 14 renders
- [x] 2.2 Test opening a fresh PDF with a saved position — confirm normal restore behavior is unaffected
- [x] 2.3 Test toggle from PDF → HTML → PDF round-trip preserves page
