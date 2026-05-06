## 1. Add WebArticleImportDialog to Toolbar

- [x] 1.1 Import `WebArticleImportDialog` component in `Toolbar.tsx`
- [x] 1.2 Add `showUrlImportDialog` state to `Toolbar.tsx`
- [x] 1.3 Replace `handleImportUrl` body — remove `prompt()`/`alert()` logic, set `showUrlImportDialog` to `true`
- [x] 1.4 Render `<WebArticleImportDialog>` at the end of the Toolbar component with `isOpen`, `onClose`, and `onOpenDocument` props

## 2. Wire document open behavior

- [x] 2.1 Pass `addTab()`-based callback as `onOpenDocument` to `WebArticleImportDialog` so imported documents open in a new tab

## 3. Cleanup

- [x] 3.1 Remove unused imports and variables left from the old `prompt()`/`alert()` flow
- [x] 3.2 Verify `Ctrl+Shift+O` shortcut still triggers the new modal
