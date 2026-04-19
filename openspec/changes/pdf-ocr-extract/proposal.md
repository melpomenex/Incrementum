## Why

When viewing PDFs, many documents (especially scanned books, image-only PDFs, or PDFs with non-standard text encoding) have no selectable text layer. The existing PDF.js text layer fails silently, and users cannot create extracts from these pages. The project already has robust OCR infrastructure (Tesseract, GLM-OCR) and an Extract Modal — but there is no way to connect them at the point where the user is reading.

## What Changes

- Add a region-selection overlay on the PDF canvas that lets the user drag a rectangle to select an area of the page (similar to a screenshot selection)
- Capture the selected region as a canvas image and run it through the existing local OCR pipeline (`ocr_image_bytes`)
- Open the existing `CreateExtractDialog` pre-populated with the OCR'd text, allowing the user to create an extract, generate flashcards, or create cloze deletions as they normally would
- Add a UI affordance (button/menu item) in the PDF viewer toolbar that activates OCR region-select mode
- Show OCR processing progress and error feedback inline

## Capabilities

### New Capabilities
- `pdf-ocr-region-select`: Drag-to-select a region on a PDF page canvas and OCR it into extractable text
- `ocr-extract-flow`: End-to-end flow from region selection → OCR processing → Extract Modal with recognized text

### Modified Capabilities

## Impact

- **Frontend**: `PDFViewer.tsx` (new region selection overlay and toolbar button), `DocumentViewer.tsx` (wiring OCR result to Extract Modal), new OCR region selection component
- **API**: Uses existing `ocr_image_bytes` Tauri command — no new backend commands needed
- **Dependencies**: Leverages existing OCR providers (Tesseract local / GLM-OCR) — no new dependencies
- **UX**: New toolbar affordance in PDF view; selection overlay on top of canvas layer
