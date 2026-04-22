## Tasks

- [ ] Audit current reader highlight flows and document exactly which locator support exists today for PDF, EPUB, HTML, Markdown, and extract views
- [ ] Replace the local-only PDF `useHighlightManager()` persistence path with extract-backed persistence
- [ ] Load persisted extracts for the active document and map valid selection metadata into PDF highlight overlays
- [ ] Add persisted EPUB highlight rendering using stored EPUB locator metadata
- [ ] Add persisted HTML and Markdown highlight rendering using stable DOM/range locator metadata
- [ ] Add persisted highlighting for extract content using stable range locators within extract text
- [ ] Ensure highlight creation/edit flows preserve color, category, tags, and notes and immediately refresh rendered highlights
- [ ] Add tests covering persisted highlight rehydration for supported reader and extract surfaces
- [ ] Update `docs/FEATURES_IMPLEMENTED.md` so the feature status reflects the real shipped behavior after the fix
- [ ] Run `openspec validate fix-document-highlighting --strict`

## Task Details

### Task 1: Audit current reader highlight flows

Review:

- `src/components/viewer/DocumentViewer.tsx`
- `src/components/viewer/PDFViewer.tsx`
- `src/components/viewer/EPUBViewer.tsx`
- `src/components/extracts/CreateExtractDialog.tsx`
- extract persistence types in `src/api/extracts.ts`

Document which flows currently:

- persist selection metadata
- render persisted highlights
- only render temporary/session-local highlights
- lack any stable locator persistence for the relevant surface

### Task 2: Replace local-only PDF highlight persistence

The PDF selection popup currently calls `addStoredHighlight()` in `PDFViewer.tsx`. Replace that flow so highlight creation persists through the extract/highlight store and is reloaded into the viewer from persisted data.

### Task 3: Rehydrate PDF highlights from extracts

For persisted extracts with valid PDF selection metadata:

- map extract IDs to highlight IDs
- map `highlight_color` into viewer colors
- render highlights through `HighlightLayer`
- keep click/edit actions aligned with the underlying extract

### Task 4: Implement EPUB persisted highlighting

Implement persisted EPUB highlight rendering using stable EPUB locator data stored in `selection_context`.

### Task 5: Implement persisted HTML/Markdown highlighting

For `.html` and `.md` document readers, persist a stable locator for the selected DOM/text range and re-render saved highlights when the document view reloads.

### Task 6: Implement persisted extract highlighting

For extract content views, allow highlighted ranges inside an extract to persist and re-render against the extract's content. Define behavior for edited extracts whose content no longer matches the stored ranges.

### Task 7: Preserve categorization metadata

Verify that highlight creation and editing preserve:

- color
- category
- tags
- notes

The reader-highlight feature must continue to use those fields through the extract model.

### Task 8: Add coverage

Add tests for at least:

- persisted highlight survives viewer remount/reload
- persisted highlight color is rendered correctly
- extract records without valid locator metadata do not crash the viewer
- HTML/Markdown and extract range locators rehydrate correctly on unchanged content
