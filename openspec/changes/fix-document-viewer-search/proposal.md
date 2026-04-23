## Why

The document viewer exposes a search affordance, but in-document search is not actually implemented end-to-end. `DocumentViewer.tsx` shows a search bar and keyboard affordance, yet `handleSearch()` is still a TODO, so typing a query does not reliably find or navigate matches in PDFs, EPUBs, or YouTube transcripts.

This leaves a core reading workflow broken:

- PDF readers cannot use the viewer search bar to find text and step through matches
- EPUB readers only have partial jump-highlighting support, not a real interactive find flow
- YouTube transcript search exists only as a local panel-specific filter and is not coordinated from the main viewer search UI
- Users get no consistent match counts, next/previous navigation, or clear "no searchable text" state

## What Changes

- Implement a unified in-document search flow in `DocumentViewer` for searchable document types
- Wire the viewer search UI and keyboard shortcuts to format-specific search adapters for PDF, EPUB, HTML/Markdown, and YouTube transcript documents
- Add match counting, next/previous navigation, current-match emphasis, and consistent empty/no-text states
- Surface explicit fallback messaging for PDFs that have no searchable text layer so users understand they need OCR or extracted text

## Capabilities

### New Capabilities

- `document-viewer-search`

### Modified Capabilities

None.

## Impact

- `src/components/viewer/DocumentViewer.tsx` — currently owns the search bar but does not execute searches
- `src/components/viewer/PDFViewer.tsx` — needs searchable match enumeration and next/previous navigation
- `src/components/viewer/EPUBViewer.tsx` — needs an interactive search API instead of jump-highlight-only behavior
- `src/components/viewer/MarkdownViewer.tsx` / HTML viewer path in `DocumentViewer.tsx` — need to participate in the same search contract
- `src/components/viewer/YouTubeViewer.tsx`
- `src/components/media/TranscriptSync.tsx` — transcript search must be externally controllable from the viewer-level search UI
