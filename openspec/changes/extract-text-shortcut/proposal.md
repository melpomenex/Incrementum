## Why

Users need a single, intuitive, app-wide keyboard shortcut (`Ctrl+E`) to extract selected text from any document type — PDF, EPUB, HTML, Markdown, YouTube transcripts — without memorizing different shortcuts per viewer. The current `Alt+X` is hardcoded in `useInlineExtraction.ts` and not customizable, while `edit.new-extract` (`Ctrl+Meta+E`) is registered in the shortcut store but has no handler wired. Consolidating on `Ctrl+E` as the default, configurable extract shortcut reduces friction and matches user expectations set by text-focused apps (think "E for Extract").

## What Changes

- Add a new customizable shortcut `edit.extract-text` with default combo `Ctrl+E` for creating extracts from the current text selection
- Wire the shortcut handler to invoke the extraction flow across all document viewer types (PDF, EPUB, HTML, Markdown, YouTube transcripts)
- Make the shortcut visible and configurable in the Keyboard Shortcuts settings panel
- Keep existing `Alt+X` inline extraction as a secondary path (preserve backward compatibility)
- The shortcut dispatches a `extract-text` custom event that each viewer responds to, decoupling the global shortcut from viewer-specific selection logic

## Capabilities

### New Capabilities
- `extract-text-shortcut`: App-wide customizable `Ctrl+E` shortcut that extracts selected text from any document viewer and creates an extract entity

### Modified Capabilities
<!-- None -->

## Impact

- **KeyboardShortcuts.tsx**: Add `edit.extract-text` to `DEFAULT_SHORTCUTS` with default `{ key: "e", ctrl: true }`
- **App.tsx**: Add handler for `edit.extract-text` in `SHORTCUT_ACTION_HANDLERS` dispatching a custom event
- **DOCUMENT VIEWERS** (PDF, EPUB, HTML, Markdown, YouTube): Each viewer component needs to listen for the `extract-text` event and invoke its existing selection-to-extract pipeline
- **KeyboardShortcutsSettings.tsx**: Add labels for the new shortcut
- **useInlineExtraction.ts**: No changes needed (preserved as secondary path)
