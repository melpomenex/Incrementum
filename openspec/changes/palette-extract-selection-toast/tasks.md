## 1. Palette Mode Selection Detection

- [x] 1.1 Add `onSelectionChange?: (text: string) => void` prop to `EditableContentPalette` component
- [x] 1.2 Add `selectionchange` event listener on the preview pane's content element (in `preview` and `split` modes) that calls `onSelectionChange` with the selected text
- [x] 1.3 Clear selection (call `onSelectionChange("")`) when the preview pane loses focus or selection is empty
- [x] 1.4 Clean up event listeners on unmount or when mode changes away from preview/split

## 2. Wire Palette Selection into DocumentViewer

- [x] 2.1 Pass `onSelectionChange` callback to `EditableContentPalette` in `DocumentViewer.tsx`, connecting it to the existing `updateSelection` handler
- [x] 2.2 Verify the floating extract button appears when text is selected in palette mode (the `activeExtractSelection && viewMode === "document"` condition should already be satisfied)

## 3. Fix Toast Notification Visibility

- [x] 3.1 Investigate why the toast doesn't appear when creating an extract via the floating extract button — check z-index stacking context, `overflow: hidden`, and toast container mount point
- [x] 3.2 Fix the toast visibility issue (likely adjust z-index or move toast mount point outside the viewer overlay container)
- [x] 3.3 Verify toast appears correctly in all view modes: PDF, EPUB, HTML, Markdown, and Palette

## 4. Testing

- [ ] 4.1 Test extract creation from palette mode preview pane — verify floating button appears and extract is created
- [ ] 4.2 Test Shift+click opens the full extract dialog with pre-filled text from palette selection
- [x] 4.3 Test toast appears after extract creation in all view modes
- [ ] 4.4 Test that writing in the raw editor (write mode) does not trigger extract selection
- [ ] 4.5 Test selection clear behavior — button disappears when selection is cleared
