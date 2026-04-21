## 1. Cleanup dead code

- [x] 1.1 Delete `src/utils/documentProcessor.ts` (unused client-side segmentation utilities)

## 2. Wire auto-segmentation into import flow

- [x] 2.1 Create a helper function in `documentStore.ts` that reads `autoProcessOnImport` from settings, resolves segmentation settings (custom or per-format recommended via `get_recommended_segmentation`), and calls `auto_segment_and_create_extracts`
- [x] 2.2 Update `importFromFile()` to call the segmentation helper after a successful import when `autoProcessOnImport` is enabled
- [x] 2.3 Update `importFromFiles()` to batch-segment after all imports complete, collecting total extract count for the summary notification
- [x] 2.4 Add error handling: if segmentation fails, show a toast but don't block or undo the import

## 3. Segmentation progress feedback

- [x] 3.1 Add a `segmenting` loading state to the document store or import UI
- [x] 3.2 Before segmentation, call `preview_segmentation` to estimate segment count; if >50, show a progress indicator
- [x] 3.3 After segmentation completes, show a success toast with the extract count

## 4. Navigation after auto-segmentation

- [x] 4.1 After single-file import with auto-segmentation, navigate to the document detail/extracts view
- [x] 4.2 After multi-file import with auto-segmentation, navigate to the library view with a summary toast showing total extracts created across all documents

## 5. Manual segmentation action

- [x] 5.1 Add a "Segment" button/action to the document context menu or action bar, visible only when the document has no extracts
- [x] 5.2 Wire the action to call `auto_segment_and_create_extracts` with current settings
- [x] 5.3 Show success/error toast and keep user on current view
- [x] 5.4 Hide the "Segment" action for documents that already have extracts

## 6. Documentation

- [x] 6.1 Update `docs/USER_HANDBOOK.md` to accurately describe auto-segmentation behavior (enable in settings, what happens on import, manual option)
