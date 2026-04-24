## 1. Diagnose the current failure

- [ ] 1.1 Reproduce on Linux with the same runtime where `Ctrl+K` fails (dev Tauri and packaged AppImage if available).
- [ ] 1.2 Reproduce or manually verify on Windows that `Ctrl+K` opens the command palette in a packaged Tauri build.
- [ ] 1.3 Reproduce or manually verify on macOS that `Cmd+K` opens the command palette in a packaged Tauri build.
- [x] 1.4 Add temporary or debug-level tracing to identify whether the failure is keydown delivery, native shortcut delivery, custom event dispatch, or store state update.
- [ ] 1.5 Confirm whether `Ctrl/Cmd+P` still opens the command palette on affected builds.

## 2. Consolidate shortcut detection

- [x] 2.1 Add a shared command-palette shortcut matcher that recognizes `Ctrl+K`/`Ctrl+P` on Linux/Windows and `Cmd+K`/`Cmd+P` on macOS.
- [x] 2.2 Ensure the matcher rejects modified variants like `Ctrl+Shift+K` unless explicitly supported.
- [x] 2.3 Ensure the matcher rejects events from `input`, `textarea`, `select`, and contenteditable targets.

## 3. Route all open paths through one event

- [x] 3.1 Update app-shell shortcut handling to dispatch `command-palette-open` for command-palette shortcuts.
- [x] 3.2 Update native Tauri global shortcut/menu accelerator handling, if needed, to dispatch the same frontend event path.
- [x] 3.3 Update viewer and iframe shortcut bridges to use the shared matcher and dispatch `command-palette-open`.
- [x] 3.4 Confirm `CommandCenter.tsx` remains the only owner that sets `commandPaletteOpen` in response to the open event.
- [x] 3.5 Remove or neutralize duplicate raw keydown handlers that can conflict with the idempotent open event.

## 4. Test and verify

- [x] 4.1 Add unit tests for the shortcut matcher across Linux/Windows `Ctrl+K`, macOS `Cmd+K`, alternate `Ctrl/Cmd+P`, shifted variants, and editable targets.
- [x] 4.2 Add a frontend test or integration-style test that dispatching `command-palette-open` sets `commandPaletteOpen` to true.
- [ ] 4.3 Manually verify `Ctrl+K` opens the command palette on Linux from the app shell.
- [ ] 4.4 Manually verify `Ctrl+K` opens the command palette on Linux while a document viewer is focused.
- [ ] 4.5 Manually verify `Ctrl+K` opens the command palette on Windows from the app shell and while a document viewer is focused.
- [ ] 4.6 Manually verify `Cmd+K` opens the command palette on macOS from the app shell and while a document viewer is focused.
- [ ] 4.7 Verify the shortcut does not fire while typing in editable fields on Linux, Windows, and macOS.
