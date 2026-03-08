## Why

Users expect PDF reading in the app to match browser and native PDF reader behavior, where text-backed PDFs allow selecting and copying words, lines, and paragraphs directly from the document. Today the app renders PDF pages through a custom canvas-based viewer, and text selection remains inconsistent or unavailable even when the PDF itself contains extractable text. This blocks core reading, quoting, copy/paste, and extract-to-learning-item workflows.

## What Changes

- Ensure the PDF viewer exposes the PDF.js text layer above rendered canvas pages whenever a PDF page contains selectable text.
- Ensure users can select and copy words, sentences, and paragraphs from text-backed PDFs using normal browser selection behavior.
- Improve selection ergonomics (hit targets, drag behavior, and selection persistence) so users can select with fewer retries and without the viewer clearing selections prematurely.
- Ensure selected PDF text can flow into existing capture/extract workflows so users can turn selections into learning items or flashcards without extra manual copy/paste steps.
- Keep image-only/scanned PDFs out of scope for guaranteed selection behavior unless OCR-generated text is available.

## Capabilities

### New Capabilities
- `pdf-text-selection-extraction`: Reliable text selection and extraction behavior for PDFs that include a text layer.

### Modified Capabilities
- None.

## Impact

- Affected areas: PDF reader UI, PDF.js text layer mounting and styling, pointer/selection event handling, selection-to-extract pipeline, and related state management.
- Potential dependencies: PDF rendering configuration, extraction parsing utilities, and regression coverage for PDF interaction behaviors across browser/PWA/Tauri runtimes.
