# Fix Convert to HTML for PDF Documents

## Summary
Make the PDF viewer's `Convert to HTML` toolbar action produce a usable HTML representation of the current PDF when the user opts into conversion. The converted output should preserve the document's visible reading order, page structure, text styling, tables, and images as much as practical so it is easier to read, select, search, and extract from than the raw PDF view.

## Problem
The PDF viewer exposes a `Convert to HTML` button above PDF documents, but the current behavior does not reliably give users an HTML reading/extraction view. Even when conversion runs, a plain text dump loses important formatting such as headings, columns, tables, page boundaries, and image placement. That makes the result less useful for reading, copying, and creating extracts.

Users need an explicit conversion path because many PDFs are awkward to inspect through the canvas/text-layer viewer. A converted HTML view can expose selectable semantic text, simplify downstream extraction, and make generated content easier to reuse.

## Goals
- Keep the existing PDF toolbar button as the user-initiated entry point.
- Convert the full PDF, not only the visible page.
- Preserve visual structure where feasible: page order, headings, paragraphs, lists, tables, images, font emphasis, and page boundaries.
- Render the generated HTML in the document viewer so the user can switch between PDF and converted HTML.
- Save the generated HTML alongside the source PDF when requested by the conversion flow.
- Provide clear loading, success, and failure feedback.

## Non-Goals
- Perfect reproduction of every PDF layout detail.
- Replacing the PDF viewer with HTML conversion by default.
- Building a general purpose PDF editor.
- Requiring cloud OCR or a network service for normal text-layer PDFs.

## Proposed Approach
Use a layered conversion pipeline:

1. Prefer structured PDF extraction for PDFs with an embedded text layer, including text spans, page dimensions, approximate bounding boxes, images, and simple table reconstruction when available.
2. Generate HTML that keeps page-level containers and reading-order blocks, with CSS that preserves relative spacing without making extraction difficult.
3. Fall back to existing OCR-to-HTML capabilities for image-only or low-quality text-layer PDFs, while keeping the same viewer state and feedback model.
4. Store the conversion result in viewer state and optionally on disk, then expose a PDF/HTML toggle so users can return to the original PDF.

## User Experience
- The toolbar button remains visible only for PDFs.
- While conversion is running, the button shows a loading state and is disabled.
- On success, the viewer switches to the generated HTML view and shows a success toast.
- If an HTML file is saved, the toast includes the saved path or a concise confirmation.
- On failure, the user sees a specific error, such as unsupported PDF structure, extraction failure, or OCR provider unavailable.

## Impact
- Affected specs: `pdf-conversion`
- Affected code:
  - `src/components/viewer/DocumentViewer.tsx`
  - `src/api/documents.ts`
  - `src-tauri/src/commands/document.rs`
  - `src-tauri/src/processor/pdf.rs`
  - OCR conversion code used for image-only fallback

## Open Questions
- Should the saved HTML become a new imported document automatically, or remain a generated sidecar file until the user imports it?
- Should page boundaries be visible by default in the HTML view, or should the default be continuous reading with an optional page boundary toggle?
