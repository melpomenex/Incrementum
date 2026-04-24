## Why

The command palette is documented as opening with `Ctrl+K` on Linux/Windows and `Cmd+K` on macOS. That shortcut used to be reliable, but it now fails in at least some app states and platform/runtime combinations. The regression breaks a core navigation affordance and is especially painful because the command palette is the intended fast path to search, import, navigation, and app commands.

The codebase has multiple overlapping shortcut handlers and native/WebView fallback paths, so a failure can occur at several points: native shortcut registration, WebView keydown delivery, custom event dispatch, or the palette open listener. The fix needs to restore the old invariant: pressing the platform command-palette shortcut opens the command palette on every supported desktop OS.

## What Changes

- Make the command palette open shortcut a first-class, end-to-end contract: `Ctrl+K` on Linux and Windows, and `Cmd+K` on macOS, SHALL open the palette.
- Consolidate the command-palette open path so all fallback mechanisms dispatch the same `command-palette-open` event and only the palette owner mutates `commandPaletteOpen`.
- Ensure the shortcut works from the app shell, tabbed layout, document viewers, same-origin EPUB/HTML iframe focus contexts where the app can bridge keydown events, and non-text focused controls.
- Preserve text-entry behavior: the shortcut SHALL NOT hijack typing in inputs, textareas, selects, or contenteditable elements.
- Add regression coverage for the key matching and event dispatch path, plus a manual verification checklist for Linux, Windows, and macOS Tauri builds.
- Keep `Ctrl/Cmd+P` as an alternate command-palette shortcut only where already supported, while making `Ctrl/Cmd+K` the required primary behavior.

## Capabilities

### New Capabilities

- `command-palette-shortcut`: Reliable cross-platform keyboard activation for the command palette.

### Modified Capabilities

_None._

## Impact

- **Frontend**: `src/App.tsx`, `src/components/search/CommandCenter.tsx`, `src/components/search/GlobalSearch.tsx`, viewer-specific iframe shortcut bridges if needed.
- **Shortcut systems**: any duplicate `Ctrl/Cmd+K` listeners must either be removed or reduced to dispatching the shared `command-palette-open` event.
- **Tauri/Rust**: `src-tauri/src/lib.rs` if any supported WebView runtime intercepts the shortcut before JavaScript sees it in packaged builds.
- **Testing**: unit tests for shortcut matching/open event dispatch and manual Linux/macOS/Windows verification.
