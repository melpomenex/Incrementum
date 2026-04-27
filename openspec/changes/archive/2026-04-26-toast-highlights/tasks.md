## 1. Shared Extraction Logic

- [x] 1.1 Add `lastHighlightColor` field to the extracts/settings Zustand store, defaulting to yellow
- [x] 1.2 Extract a shared `createExtractInstant(selection, color, documentId)` function from `useInlineExtraction.ts` that creates an extract, flashes the selection, and returns the extract ID — without showing a dialog or toast
- [x] 1.3 Create a `useToastExtract` hook that wraps the shared extraction function, shows a success toast with "Edit" action button (or error toast on failure), and updates `lastHighlightColor`

## 2. PDF Viewer Integration

- [x] 2.1 Update `SelectionPopup.tsx` "Highlight" button to call `useToastExtract` instead of opening `CreateExtractDialog`
- [x] 2.2 Add Shift+click handler on the "Highlight" button to open the full `CreateExtractDialog` for users who want metadata

## 3. EPUB Viewer Integration

- [x] 3.1 Update `EPUBViewer.tsx` highlight action to use `useToastExtract` instead of opening a dialog

## 4. HTML/Markdown Viewer Integration

- [x] 4.1 Update `MarkdownViewer.tsx` and related text highlight flow to use `useToastExtract` for instant highlight creation

## 5. RSS Viewer Integration

- [x] 5.1 Update `RSSScrollMode.tsx` and `HighlightRenderer.tsx` highlight action to use `useToastExtract`

## 6. Toast Action — Edit Extract

- [x] 6.1 Wire the toast "Edit" action button to open `CreateExtractDialog` (or `EditExtractDialog`) pre-filled with the just-created extract's data
- [x] 6.2 Ensure the dialog closes cleanly after editing and the extract list updates

## 7. Cleanup & Verification

- [x] 7.1 Verify keyboard shortcuts (Alt+X, Alt+Z) still work unchanged via `useInlineExtraction`
- [x] 7.2 Verify the full dialog path still works via Shift+click and extracts sidebar
- [x] 7.3 Remove any dead code paths where `CreateExtractDialog` was opened as the default highlight flow
- [x] 7.4 Test highlight creation across all four viewer types (PDF, EPUB, HTML, RSS)
