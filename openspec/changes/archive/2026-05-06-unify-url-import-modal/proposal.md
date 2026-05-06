## Why

The toolbar "Import URL" button (`Ctrl+Shift+O`) opens a bare browser `prompt()` dialog, while the documents view offers a rich modal with URL preview, metadata display, tag selection, and content preview. Users coming from the toolbar get a degraded experience with no preview, no tagging, and no metadata enrichment — yet both flows import the same kind of content.

## What Changes

- Replace the toolbar's `prompt()`-based URL import with the existing `WebArticleImportDialog` component, reusing it as a shared modal.
- Remove the inline `handleImportUrl` logic from `Toolbar.tsx` that manually calls `documentStore.importFromUrl()` and manages success/failure with `alert()`.
- Add state management to `Toolbar.tsx` to control the `WebArticleImportDialog` open/close state.
- Wire the `onOpenDocument` callback from the dialog to the toolbar's `addTab()` flow so imported documents open in a new tab.

## Capabilities

### New Capabilities
- `toolbar-url-import-modal`: Unify the toolbar URL import to use the same rich modal (preview, tags, metadata) as the documents view.

### Modified Capabilities

## Impact

- `src/components/Toolbar.tsx` — remove `prompt()`/`alert()` flow, add `WebArticleImportDialog` modal
- `src/components/import/WebArticleImportDialog.tsx` — may need minor adjustments to support being opened from toolbar context (e.g., optional `onOpenDocument` callback behavior)
