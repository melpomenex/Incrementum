# Tasks

## 1. Audit current conversion flow
- [x] Confirm the PDF toolbar button calls `convertDocumentPdfToHtml` for the active document.
- [x] Confirm desktop and web-mode API parameter names match their command handlers.
- [x] Identify where converted HTML is stored in viewer state and how the PDF/HTML toggle is shown.

## 2. Improve PDF-to-HTML extraction
- [x] Update the backend conversion pipeline to process every PDF page in order.
- [x] Preserve page containers with stable page numbers and source page metadata.
- [x] Preserve text blocks, headings, paragraph breaks, lists, emphasis, and approximate reading order when the PDF text layer supports it.
- [x] Preserve tables and embedded images where they can be extracted without corrupting text flow.
- [x] Escape and sanitize generated HTML before returning it to the renderer.

## 3. Add fallback behavior
- [x] Detect PDFs with missing or unusable text extraction output.
- [x] Route image-only or low-quality PDFs through the existing OCR-to-HTML pipeline when OCR is available.
- [x] Return a clear actionable error when neither structured extraction nor OCR fallback can produce usable HTML.

## 4. Wire viewer UX
- [x] Keep the `Convert to HTML` button disabled with a spinner while conversion is running.
- [x] Switch to the generated HTML view after successful conversion.
- [x] Keep a PDF/HTML toggle available after conversion.
- [x] Show success feedback, including saved-file feedback when a sidecar HTML file is written.
- [x] Show specific failure feedback for conversion, save, and OCR fallback failures.

## 5. Verify behavior
- [x] Add or update unit tests for API parameter mapping and conversion result handling.
- [x] Add backend tests or fixtures for text-layer, multi-page, table/image, and image-only PDFs where practical.
- [ ] Manually verify conversion from the PDF toolbar in the Tauri app.
- [x] Run `openspec validate fix-convert-to-html-button --strict`.
