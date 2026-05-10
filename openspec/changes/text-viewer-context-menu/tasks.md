## 1. Context menu state and rendering in DocumentViewer

- [x] 1.1 Add context menu state to DocumentViewer: `contextMenuState: { visible, x, y, selectedText, selectionContext } | null` and `setContextMenuState`
- [x] 1.2 Import `ContextMenu`, `useContextMenu`, and `ContextMenuItemType` from `src/components/common/ContextMenu.tsx` into DocumentViewer
- [x] 1.3 Create a `buildContextMenuItems` function that returns `ContextMenuItem[]` based on selectedText and selectionContext, with actions: Create Extract (instant), Create Extract (with dialog), Highlight (submenu with 5 colors), separator, Copy, Dictionary Lookup, Create Flashcard
- [x] 1.4 Render the `ContextMenu` component in DocumentViewer's JSX, wired to the context menu state and items, positioned at the stored x/y coordinates

## 2. Wire context menu actions to existing handlers

- [x] 2.1 Wire "Create Extract" to `createInstantExtract` with the stored selectedText and selectionContext
- [x] 2.2 Wire "Create Extract (with dialog)" to `openExtractDialog` with the stored selectedText and selectionContext
- [x] 2.3 Wire "Highlight" submenu color items to `createInstantExtract` with the corresponding highlight color
- [x] 2.4 Wire "Copy" to `navigator.clipboard.writeText` with the stored selectedText
- [x] 2.5 Wire "Dictionary Lookup" to `handleDictionaryLookup` with the stored selectedText
- [x] 2.6 Wire "Create Flashcard" to `setFlashcardStudioSeed` with the selected text as excerpt, draftCardType "qa"

## 3. MarkdownViewer integration

- [x] 3.1 Replace MarkdownViewer's existing `handleContextMenu` (single "Create Flashcard" popup) with a new handler that calls `onContextMenu?.({ x, y, selectedText })` prop
- [x] 3.2 Add `onContextMenu` prop to MarkdownViewer's interface
- [x] 3.3 In DocumentViewer, pass the `onContextMenu` handler to MarkdownViewer that sets `contextMenuState` with the click coordinates and selected text

## 4. EPUBViewer integration

- [x] 4.1 Add `onContextMenu` prop to EPUBViewer's interface
- [x] 4.2 Add a `contextmenu` event listener inside the EPUB iframe (in `handleSelectionChange` or similar initialization), reading `window.getSelection()` from the iframe's document and converting coordinates to parent frame coordinates
- [x] 4.3 In DocumentViewer, pass the `onContextMenu` handler to EPUBViewer that sets `contextMenuState` with the click coordinates and selected text

## 5. Cleanup and edge cases

- [x] 5.1 Clear context menu state when document changes or selection is cleared
- [x] 5.2 Ensure context menu does not appear for PDF documents (guard on `docType !== "pdf"`)
- [x] 5.3 Verify context menu dismisses properly on action click, click-outside, and Escape key (inherited from ContextMenu component)

## 6. Testing

- [ ] 6.1 Manual test: open a markdown document, select text, right-click, verify all menu items appear and work
- [ ] 6.2 Manual test: open an epub document, select text, right-click, verify menu appears and all items work
- [ ] 6.3 Manual test: right-click without text selected — verify no custom menu appears
- [ ] 6.4 Manual test: open a PDF, select text, right-click — verify custom menu does NOT appear (SelectionPopup handles PDF)
