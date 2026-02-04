# Design: Full-PDF OCR → HTML

## Goal
Ensure the PDF viewer's `OCR → HTML` action produces OCR output for every page in a PDF and renders a combined HTML view that is continuous by default, preserves tables/images when available, and requires no extra installs for end users.

## Approach
1. Add a PDF-aware OCR path on the backend that can return combined OCR text for all pages.
2. Update the frontend action to call that path and render the combined output.

## Backend Strategy (Tauri)
- Introduce a new command that performs OCR on a PDF as a multi-page document (e.g., `ocr_pdf_file`).
- For providers that accept PDFs directly (e.g., `Marker`, `Nougat`, `GLM-OCR`), use their existing `process_image`/PDF handling for the full document to maximize structure (tables/images) when supported.
- For providers that expect images (e.g., `Tesseract`), extract embedded page images from the PDF using `lopdf` (similar to the existing GLM-OCR PDF image extraction) and OCR each page image in order.
- Combine results with page metadata and an optional page-break marker to support a UI toggle.

### Rationale
- This avoids adding new heavy dependencies while providing full-document OCR for scanned PDFs that store each page as embedded images.
- Providers that can return richer layout (tables/images) are used directly when available, while offline providers still produce a full-text fallback.

### Known Limitations
- PDFs without embedded page images may still need rasterization to OCR correctly; this is deferred to preserve “no extra installs.”

## Frontend Strategy (Document Viewer)
- Replace the current `ocrImageFile` call with the new PDF-aware OCR command.
- Convert the returned combined content to HTML (markdown renderer for text; HTML passthrough when provider returns HTML).
- Add a document setting to show/hide page boundaries; default is continuous reading layout.
- Keep the loading state and toast messaging behavior unchanged.

## Risks and Mitigations
- **Large PDFs**: Multi-page OCR could be slow. Mitigation: keep the existing spinner and show errors on timeout/failure.
- **Provider Capability Gaps**: Not all providers can handle PDF inputs or preserve tables/images. Mitigation: prefer provider-specific PDF handling when available; otherwise fall back to per-page image OCR.

## Alternatives Considered
- **Use `convert_pdf_to_html` only**: fast but fails on scanned PDFs.
- **Add a full PDF rasterization engine**: more robust but violates “no extra installs” requirement.
