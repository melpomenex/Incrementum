## 1. Diagnose failure mode on Windows and macOS

- [x] 1.1 Add `tracing::debug!` log in the `on_shortcuts` callback in `src-tauri/src/lib.rs` to log each shortcut key when the callback fires, confirming registration and execution
- [x] 1.2 Add `console.debug` in the `App.tsx` `"global-shortcut"` event listener to log received events, confirming JS reception
- [ ] 1.3 Build and test on Windows: check logs to determine if (a) Rust callback fires, (b) JS listener receives event, or (c) neither happens
- [ ] 1.4 Build and test on macOS: same diagnostic check as 1.3

## 2. Fix Rust-side shortcut registration

- [x] 2.1 Changed `app_handle.emit()` to `app_handle.emit_to("main", ...)` targeting the main window label — this ensures events reach the webview reliably on all platforms
- [x] 2.2 Verified the main window label matches `"main"` in `tauri.conf.json` — confirmed at line 17
- [x] 2.3 Diagnostic logging is at `tracing::debug!` and `console.debug` level — appropriate for production

## 3. Add fallback: Tauri menu accelerators

- [x] 3.1 Added menu items with accelerators for all 9 shortcuts using `builder.menu()` in `lib.rs` — platform-specific: `Control+` on Windows/Linux, `Cmd+` on macOS
- [x] 3.2 Added `on_menu_event` handler that maps menu item IDs to `"global-shortcut"` events with the same payload format (e.g., `"KeyK"`, `"KeyQ"`, `"Comma"`, `"Slash"`)
- [x] 3.3 On macOS, added a minimal app submenu (About, Hide, Quit) to satisfy macOS menu bar requirements — accelerator shortcuts are added as top-level menu items alongside the app submenu

## 4. Test all shortcuts on all platforms

- [ ] 4.1 Test Ctrl+K opens Command Palette on Windows
- [ ] 4.2 Test Cmd+K opens Command Palette on macOS
- [ ] 4.3 Test all 9 shortcuts on Windows (Ctrl+K, Ctrl+P, Ctrl+,, Ctrl+D, Ctrl+Q, Ctrl+R, Ctrl+O, Ctrl+N, Ctrl+/)
- [ ] 4.4 Test all 9 shortcuts on macOS (Cmd+K, Cmd+P, Ctrl+,, Ctrl+D, Cmd+Q, Cmd+R, Cmd+O, Cmd+N, Cmd+/)
- [ ] 4.5 Test that shortcuts do NOT fire when typing in input fields, textareas, or contentEditable elements on all platforms
- [ ] 4.6 Verify Linux shortcuts still work (no regression from previous fix)
