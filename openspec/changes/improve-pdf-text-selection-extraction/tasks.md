## 1. PDF text-layer capability detection

- [x] 1.1 Ensure `PDFViewer` reliably mounts and exposes the PDF.js text layer above canvas-rendered pages when selectable text exists.
- [x] 1.2 Add aggregated document-level selection capability state derived from page availability.
- [x] 1.3 Surface capability state to footer/helper UI so messaging reflects actual selection availability.

## 2. Selection reliability and filtering

- [x] 2.0 Restore normal browser-style copy/select behavior for words, lines, and paragraphs in text-backed PDFs.
- [x] 2.1 Tighten `PDFViewer` selection-origin checks so only text-layer selections produce PDF selection context.
- [x] 2.2 Ensure selection is not prematurely cleared by drag/scroll handlers after mouse/touch release.
- [x] 2.3 Keep selection highlight rendering synced with valid PDF selection state only.

## 3. Extract action integration

- [x] 3.1 Update `DocumentViewer` selection handling to gate extract action on valid non-empty PDF text selections.
- [x] 3.2 Ensure extract dialog receives selected text and page/document context from PDF selection context.
- [x] 3.3 Ensure selected PDF text can be sent into existing extract creation flows for learning items and flashcards without extra manual copy/paste.
- [x] 3.4 Add explicit no-text-layer behavior so users cannot trigger selection-based extract creation on image-only pages.

## 4. Verification and regression coverage

- [x] 4.1 Add/extend tests for text-layer availability and selection context emission in PDF viewer behavior.
- [x] 4.2 Add/extend tests for browser-style copy/select behavior and extract button visibility/gating based on valid PDF selection.
- [ ] 4.3 Validate behavior manually with at least one text-layer PDF and one image-only/no-text-layer PDF, including copy/select and extract-to-learning-item flows.
