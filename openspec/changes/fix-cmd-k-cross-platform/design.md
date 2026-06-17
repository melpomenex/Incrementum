# Design: Fix Cmd+K / Ctrl+K on macOS and Windows

## Architecture

The app has three shortcut delivery paths:
1. **Rust `on_shortcuts`** → `emit_to("main", "global-shortcut")` → JS `listen("global-shortcut")`
2. **Rust menu `on_menu_event`** → same `emit_to` → same JS `listen`
3. **JS capture-phase `keydown`** → `dispatchCommandPaletteOpen()`

Path 1 is platform-native (fires before webview processes keys). Path 2 is menu-bar level. Path 3 is webview-level and fails when the webview engine intercepts the combo.

## Root Cause

### Windows
- `hide_menu()` (line 479) removes the menu bar, **killing the accelerator table** on Windows. The comment claims "accelerators still work" but this is false for Windows/WebView2 — the menu IS the accelerator table.
- Path 3 (JS capture) fails because WebView2 intercepts `Ctrl+K` at the native input level (Chromium reserves this for address bar focus).
- Path 1 (`on_shortcuts`) should still fire since it's at the app event loop level, not the menu level. If it doesn't, the issue is in the `on_shortcuts` registration or the `emit_to` delivery.

### macOS
- Menu is visible. Cmd+K is in "Commands" submenu. The submenu accelerator should fire, but nested submenu accelerators on macOS may not be checked if WKWebView's first responder intercepts first.
- Path 3 (JS capture) fails because WKWebView intercepts Cmd+K natively.
- Path 1 (`on_shortcuts`) should fire similarly to Windows. If it doesn't, same investigation needed.

### Linux ✅
- All three paths work because webkit2gtk doesn't aggressively intercept Ctrl+key combos.

## Fix

### Step 1: Add diagnostic logging to `on_shortcuts` callback
Add a `tracing::info!` at the very start of the `on_shortcuts` callback (before any state check) to confirm whether the callback fires on macOS/Windows. Also log whether `emit_to` succeeds.

### Step 2: Add diagnostic logging to JS `listen` handler
Log when the listener is registered AND when it receives an event. Add a startup log to confirm the listener is active.

### Step 3: Fix Windows menu hide
On Windows, instead of `hide_menu()`, call `set_menu()` with an **invisible menu** that still has accelerators. Or, better: remove `hide_menu()` on Windows and instead use `setup_menu()` or just don't hide — the window is already `decorations: true` so a menu bar is expected on Windows anyway.

Actually, the better fix: **don't hide the menu on Windows at all**. Windows apps commonly have a menu bar. The current hide was cosmetic. Or if the user doesn't want a visible menu bar, we can create a minimal "File" menu that's invisible-looking but keeps the accelerators alive.

### Step 4: If `on_shortcuts` fires but `emit_to` doesn't reach JS
Use `window.eval()` as a direct delivery mechanism from the Rust callback. Instead of `emit_to`, call `window.eval("window.dispatchEvent(new CustomEvent('global-shortcut', {detail: 'KeyK'}))")` which bypasses the Tauri event system entirely.

### Step 5: Remove macOS submenu nesting
Move Cmd+K and Cmd+P from the "Commands" submenu to the top-level "Incrementum" submenu (alongside "About", "Hide", "Quit"). This ensures macOS's NSApplication key equivalent handling finds the accelerator without needing to traverse submenus.

## File Changes

### `src-tauri/src/lib.rs`
1. Move macOS Cmd+K/Cmd+P into the "Incrementum" app submenu (not "Commands" submenu)
2. Replace `window.hide_menu()` on Windows with keeping the menu visible (or use a transparent menu bar approach)
3. Add `tracing::info!` to `on_shortcuts` callback for diagnostics
4. Add fallback `window.eval()` delivery in `on_shortcuts` if `emit_to` is unreliable

### `src/App.tsx`
1. Add console.log to confirm `listen("global-shortcut")` registration succeeds
2. Add console.log when event is received
3. Add a `window.addEventListener("global-shortcut", ...)` as a second JS-level listener that catches both `eval`-dispatched events and Tauri-emitted events

## Testing
- Build on macOS: `npm run tauri build` → test Cmd+K in the .app
- Build on Windows (via CI or cross-compile): test Ctrl+K
- Verify Linux AppImage still works
