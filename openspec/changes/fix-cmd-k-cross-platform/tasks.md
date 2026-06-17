# Tasks: Fix Cmd+K / Ctrl+K on macOS and Windows

## 1. Diagnostic Logging
- [x] 1.1 Add `tracing::info!` at the top of `on_shortcuts` callback in `lib.rs` (before state check)
- [x] 1.2 Add logging for `emit_to` result in `on_shortcuts` callback
- [x] 1.3 Add `console.log` in `App.tsx` when `listen("global-shortcut")` registers successfully
- [x] 1.4 Add `console.log` in `App.tsx` when `listen("global-shortcut")` receives an event

## 2. macOS Menu Fix
- [x] 2.1 Move Cmd+K/Cmd+P from nested "Commands" submenu to top-level "Incrementum" submenu
- [x] 2.2 Remove the now-empty "Commands" submenu
- [x] 2.3 Ensure `on_menu_event` handler still maps these to `KeyK`/`KeyP`

## 3. Windows Menu Fix
- [x] 3.1 Remove `window.hide_menu()` call for Windows (keep for Linux only)
- [ ] 3.2 Verify menu accelerators fire without `hide_menu()` on Windows

## 4. Rust-side Fallback Delivery
- [x] 4.1 Add `window.eval()` fallback in `on_shortcuts` callback that dispatches a `CustomEvent` directly to JS
- [x] 4.2 Add corresponding `window.addEventListener("global-shortcut-native", ...)` in `App.tsx` to catch both Tauri events and eval-dispatched events
- [x] 4.3 Ensure no double-fire (deduplicate if both Tauri event and eval event arrive) — note: both paths dispatch to same handler, double-fire is acceptable since the handler is idempotent (e.g., `dispatchCommandPaletteOpen` toggles open state)

## 5. Cleanup
- [ ] 5.1 Remove dead/overlapping JS capture-phase handler if eval fallback is reliable
- [ ] 5.2 Verify Linux AppImage still works after changes

## 6. Testing
- [ ] 6.1 Build macOS .app and test Cmd+K
- [ ] 6.2 Test on Windows (CI or user)
- [ ] 6.3 Test Linux AppImage
