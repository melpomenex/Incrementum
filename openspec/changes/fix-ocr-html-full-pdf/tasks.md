# Tasks

1. Audit current `OCR → HTML` flow in `src/components/viewer/DocumentViewer.tsx` and identify the exact OCR command usage.
2. Add a PDF-aware OCR command in Tauri that returns combined content for all pages, with provider-specific handling for PDFs vs images and optional page-break markers.
3. Wire the PDF viewer button to call the new PDF OCR command and render combined HTML output, defaulting to continuous layout with a page-break toggle.
4. Add/extend tests to cover multi-page OCR results, page-break toggling, and error handling when no page images exist.
5. Validate with `openspec validate fix-ocr-html-full-pdf --strict`.
