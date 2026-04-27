## 1. Register the shortcut in the store

- [x] 1.1 Add `edit.extract-text` to `DEFAULT_SHORTCUTS` in `src/components/common/KeyboardShortcuts.tsx` with default combo `{ key: "e", ctrl: true }`, name "Extract Text", description "Create extract from selected text", category `ShortcutCategory.Editing`

## 2. Wire the shortcut handler in App.tsx

- [x] 2.1 Add `"edit.extract-text"` entry to `SHORTCUT_ACTION_HANDLERS` in `src/App.tsx` that dispatches `window.dispatchEvent(new CustomEvent("extract-text"))`

## 3. Add DocumentViewer event listener

- [x] 3.1 In `src/components/viewer/DocumentViewer.tsx`, add a `useEffect` that listens for the `extract-text` custom event and calls the existing `handleInlineExtract` function with current `selectedText` and `selectionContext` state
- [x] 3.2 Guard against no-selection (skip if `selectedText` is empty or `documentId` is missing)

## 4. Add YouTubeViewer event listener

- [x] 4.1 In `src/components/viewer/YouTubeViewer.tsx`, add a `useEffect` that listens for the `extract-text` custom event and calls the existing `handleOpenCreateExtract` function (opens the `CreateVideoExtractDialog` with current playback time)
- [x] 4.2 Guard against duplicate dialog opens if listener fires while dialog is already open

## 5. Add settings labels

- [x] 5.1 Add `edit.extract-text` entry to the `shortcutLabels` record in `src/components/settings/KeyboardShortcutsSettings.tsx` with i18n keys `settings.shortcuts.edit.extractText.name` and `settings.shortcuts.edit.extractText.description`

## 6. Verify

- [x] 6.1 Run `npm run tsc` (or equivalent typecheck) to verify no type errors
- [x] 6.2 Run `npm run build` to verify the build succeeds
- [x] 6.3 Manual smoke test: open a document, select text, press Ctrl+E, confirm extract is created with toast
