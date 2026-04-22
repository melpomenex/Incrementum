## Why

`docs/FEATURES_IMPLEMENTED.md` currently lists document highlighting as "✅ Implemented" with "Multi-color text highlighting with categorization", but the shipped reader behavior does not meet that claim.

The current codebase has several disconnected pieces:

- `src/components/viewer/PDFViewer.tsx` can draw highlight rectangles, but it stores them only in local component state via `useHighlightManager()`, so they disappear when the viewer remounts and are never loaded from persisted data
- `src/components/viewer/DocumentViewer.tsx` maps `Ctrl/Cmd+H` to `CreateExtractDialog`, which persists `selection_context` and `color` on an extract, but those persisted highlights are not rendered back into the PDF/EPUB readers
- `src/components/viewer/EPUBViewer.tsx` only applies temporary search highlights and has no path for persistent user-created highlights
- `src/components/viewer/DocumentViewer.tsx` already supports text selection for `.html` and `.md` reading surfaces, but there is no stable persisted in-document highlight rendering path for those modes either
- extract views render extract content and color metadata, but they do not currently behave like persistent multi-color highlighted reading surfaces

As a result, "highlighting" currently behaves like extract creation with a color field, not persistent multi-color reader highlighting. This proposal aligns the product behavior with the documented feature by making extract-backed highlights render persistently in supported readers and by making the highlight action persist through the extract model instead of ephemeral viewer-only state.

## What Changes

- Treat document highlights as persisted extract-backed annotations, using existing extract fields (`selection_context`, `highlight_color`, `category`, `tags`, `notes`) as the source of truth
- Replace session-local PDF highlight creation with a persistence flow that creates or updates an extract/highlight record and immediately rehydrates the viewer from stored extracts
- Render persisted highlights in PDF, EPUB, HTML, Markdown, and extract views when the extract includes a valid selection locator for that surface
- Keep multi-color highlighting and categorization in the extract dialog, but require those choices to survive document reloads and app restarts
- Restrict the implemented claim to formats that can actually round-trip a stable selection locator; unsupported formats must not present the feature as available
- Update feature/status documentation during implementation so `docs/FEATURES_IMPLEMENTED.md` no longer overstates the state of the feature

## Capabilities

### New Capabilities

- `document-highlighting`: persisted, extract-backed multi-color highlights rendered inside supported document readers and extract views

### Modified Capabilities

- Existing extract creation flows in the document viewer and PDF selection popup become the canonical persistence path for highlighting instead of a separate in-memory overlay path

## Impact

- `src/components/viewer/PDFViewer.tsx`: replace local-only highlight state with persisted highlight loading/rendering
- `src/components/viewer/DocumentViewer.tsx`: load document extracts as highlight data for supported readers and keep extract/highlight creation flows consistent
- `src/components/viewer/EPUBViewer.tsx`: add persisted highlight rendering based on stored EPUB locator data
- `src/components/viewer/MarkdownViewer.tsx` and/or `src/components/viewer/DocumentViewer.tsx`: add persisted highlight rendering for `.md` and `.html` reading surfaces using stable DOM/range locators
- `src/components/extracts/*`: support persistent highlight display and editing for extract content itself
- `src/components/viewer/HighlightLayer.tsx` and selection popup flow: render persisted highlights and stop implying completion before persistence succeeds
- `src/api/extracts.ts` and related extract consumers: clarify extract fields used for highlight rendering
- `docs/FEATURES_IMPLEMENTED.md`: correct the feature status/description as part of the implementation change
- No new external dependencies are required; database changes are optional and only needed if the existing extract schema cannot encode EPUB/HTML/Markdown/extract locators cleanly
