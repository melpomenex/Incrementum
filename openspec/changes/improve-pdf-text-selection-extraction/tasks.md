## 1. PDF text-layer capability detection

- [x] 1.1 Add per-page text-layer availability tracking in `PDFViewer` after text layer render attempts.
- [x] 1.2 Add aggregated document-level selection capability state derived from page availability.
- [x] 1.3 Surface capability state to footer/helper UI so messaging reflects actual selection availability.

## 2. Selection reliability and filtering

- [x] 2.1 Tighten `PDFViewer` selection-origin checks so only text-layer selections produce PDF selection context.
- [x] 2.2 Ensure selection is not prematurely cleared by drag/scroll handlers after mouse/touch release.
- [x] 2.3 Keep selection highlight rendering synced with valid PDF selection state only.

## 3. Extract action integration

- [x] 3.1 Update `DocumentViewer` selection handling to gate extract action on valid non-empty PDF text selections.
- [x] 3.2 Ensure extract dialog receives selected text and page/document context from PDF selection context.
- [x] 3.3 Add explicit no-text-layer behavior so users cannot trigger selection-based extract creation on image-only pages.

## 4. Verification and regression coverage

- [x] 4.1 Add/extend tests for text-layer availability and selection context emission in PDF viewer behavior.
- [x] 4.2 Add/extend tests for extract button visibility/gating based on valid PDF selection.
- [ ] 4.3 Validate behavior manually with at least one text-layer PDF and one image-only/no-text-layer PDF.
