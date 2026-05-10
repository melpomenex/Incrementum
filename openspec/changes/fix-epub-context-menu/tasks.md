## 1. Fix `updateSelection` to preserve context on undefined

- [x] 1.1 In `DocumentViewer.tsx` `updateSelection`, change the `else if (context === undefined)` branch (line 936) from `setSelectionContext(null)` to a no-op — preserve the existing `selectionContext` when `handleSelectionChange` fires without context

## 2. Store and pass EPUB selection context via context menu callback

- [x] 2.1 In `EPUBViewer.tsx`, add a `lastEpubSelectionContextRef` ref that captures the `EpubSelectionContext` from `rendition.on("selected")` (line 801)
- [x] 2.2 Update the `onContextMenu` callback type/interface to include an optional `selectionContext` field
- [x] 2.3 In the `contextmenu` event handler (line 638), include `selectionContext: lastEpubSelectionContextRef.current` in the callback payload

## 3. Use context menu's selection context in DocumentViewer

- [x] 3.1 Update `contextMenuState` type to include optional `selectionContext` field
- [x] 3.2 In the EPUBViewer `onContextMenu` handler in DocumentViewer (line 4884), pass the incoming `selectionContext` into `contextMenuState`
- [x] 3.3 In `buildContextMenuItems`, use `contextMenuState.selectionContext` as a fallback when the React state `selectionContext` is null — prefer the context that arrived with the right-click event

## 4. Verify and test

- [ ] 4.1 Select text in an EPUB, right-click, and verify Extract creates an extract with correct page/location metadata
- [ ] 4.2 Select text in an EPUB, right-click, and verify Highlight creates a colored extract with correct context
- [ ] 4.3 Verify Copy, Dictionary, and Flashcard actions still work from context menu
- [ ] 4.4 Verify PDF and MarkdownViewer context menus are unaffected
