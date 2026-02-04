# Proposal: Full-PDF OCR → HTML

## Summary
Update the `OCR → HTML` action in the PDF Document Viewer so it OCRs the entire PDF, not just the current page, and renders a complete HTML view that preserves selectable text, tables, and inline images as well as possible with low-friction setup.

## Motivation
Today, clicking `OCR → HTML` only OCRs the current page. Users expect full-document OCR output to enable selection/search for the entire PDF. This change aligns the button behavior with user expectations for full-document conversion.

## Current Behavior
- `OCR → HTML` calls OCR on `currentDocument.filePath` as a single image input.
- For PDFs, this results in OCR of only a single page (often the first page), not the entire document.

## Desired Behavior
- `OCR → HTML` OCRs every page in the PDF and combines results into a single HTML view.
- Output is continuous by default (no visible page breaks) with an optional toggle to show page boundaries.
- Tables and images are preserved in the HTML when available from the OCR provider.
- The UI continues to show the loading spinner while OCR is running, and renders the full HTML when complete.

## Scope
- Update the OCR pipeline for PDFs to operate on all pages.
- Preserve tables and images when supported by providers.
- Add a UI toggle to show/hide page breaks in OCR HTML view.
- Keep the change scoped to the PDF viewer action and underlying OCR command(s).

## Out of Scope
- Adding a full PDF rasterization engine (e.g., pdfium/poppler). No extra installs for end users.
- New OCR providers or major UI redesigns.

## Open Questions
- None.

## Assumptions
- The selected OCR provider should be used for the entire document.
- Offline OCR is the default path; cloud providers are optional enhancements.
- Continuous reading layout is the default; page breaks are optional via toggle.
- The HTML output includes only the content returned by the selected provider (no extra image extraction).
