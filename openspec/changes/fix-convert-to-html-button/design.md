# Design: PDF Convert to HTML

## Conversion Model
The conversion should treat HTML as a secondary representation of the PDF, not as a replacement for the source file. The PDF remains the authoritative view, and converted HTML is generated only after the user clicks the toolbar action.

The backend should return:
- `html_content`: sanitized HTML suitable for the viewer
- `saved_path`: optional sidecar path when the caller requests file output
- `original_filename`: source PDF filename
- page metadata when needed for viewer navigation or page attribution

## Extraction Strategy
Use the best available source in this order:

1. Structured PDF text extraction for PDFs with a usable text layer.
2. Layout-aware grouping of spans into blocks, headings, paragraphs, lists, and tables where geometry makes that possible.
3. Embedded image extraction where images can be associated with a page without breaking reading order.
4. OCR-to-HTML fallback for image-only PDFs or PDFs with unusable text extraction.

The generated HTML should use page wrappers and semantic tags where possible. CSS may preserve approximate spacing, but text should remain naturally selectable and copyable. Avoid absolute-position-only output unless it is the only way to preserve a specific page.

## Viewer Behavior
`DocumentViewer.tsx` should keep the existing PDF toolbar entry point and the PDF/HTML toggle. Successful conversion sets the generated HTML result in viewer state and switches to HTML mode. Failed conversion leaves the PDF mode active.

The UI should not auto-convert PDFs on open. Conversion can be slow and may use OCR resources, so it must remain explicit.

## Error Handling
Errors should distinguish between:
- source PDF missing or unreadable
- PDF parse failure
- no usable text layer
- OCR fallback unavailable
- save-to-file failure

The original PDF should remain readable after every failure.

## Tradeoffs
Pixel-perfect HTML can make extraction worse because every glyph may become absolutely positioned. This change prioritizes readable, selectable HTML while preserving enough layout information for page context, tables, images, and common formatting.
