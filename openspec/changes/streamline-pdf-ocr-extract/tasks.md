# Tasks: Streamline PDF OCR → Extract

## 1. Wire OCR to instant extract
- [x] 1.1 In `DocumentViewer.tsx`, change the `onOcrExtractText` handler to call `createInstantExtract({ documentId, text, pageNumber })` instead of opening `CreateExtractDialog`
- [x] 1.2 Ensure `ocr.exitOcrMode()` is still called after extraction (handled in PDFViewer.tsx)

## 2. Update PDFViewer.tsx onCreateExtract callback
- [x] 2.1 Verify the `onCreateExtract` callback in PDFViewer.tsx still correctly calls `onOcrExtractText` and `ocr.exitOcrMode()` (no changes needed, but verify)

## 3. Clean up OcrTextPreview for error-only use
- [x] 3.1 OcrTextPreview already only renders on `previewing`/`error` states — verify the `previewing` state auto-transitions to `idle` after the callback fires
- [x] 3.2 No structural changes to OcrTextPreview needed (still used for retry on errors)

## 4. Test
- [ ] 4.1 Verify: OCR a region → extract created instantly, toast appears with Edit button
- [ ] 4.2 Verify: Click Edit on toast → EditExtractDialog opens with the extract data
- [ ] 4.3 Verify: OCR failure → OcrTextPreview retry panel appears (unchanged behavior)
