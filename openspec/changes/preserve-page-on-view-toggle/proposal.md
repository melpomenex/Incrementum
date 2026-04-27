## Why

When viewing a PDF converted to HTML (OCR mode), the current page number is tracked. But toggling back to PDF view restores the last-saved PDF scroll position — which is often a different page. This breaks reading flow and forces users to manually navigate back to where they were.

## What Changes

- When switching from HTML view back to PDF view, the PDF viewer will navigate to the page that was visible in HTML view instead of restoring the previous PDF scroll position.
- The `pageNumber` state already tracks the current page in both views — the gap is that PDFViewer's independent position restoration overrides the passed `pageNumber` prop on load.

## Capabilities

### New Capabilities
- `page-sync-on-toggle`: Ensures the current page number is preserved when toggling between PDF and HTML view modes for the same document.

### Modified Capabilities

## Impact

- `src/components/viewer/DocumentViewer.tsx` — pdfViewMode toggle handler, page number state coordination
- `src/components/viewer/PDFViewer.tsx` — position restoration logic, handling externally-supplied page number overrides
- `src/types/readerPosition.ts` — ViewState type may need a flag to skip position restoration on toggle
