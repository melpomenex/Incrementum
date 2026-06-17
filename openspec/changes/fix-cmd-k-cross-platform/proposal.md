# Proposal: Fix Cmd+K / Ctrl+K on macOS and Windows

## Intent

Cmd+K (macOS) and Ctrl+K (Windows) do not open the command palette, despite working on Linux AppImage. Three previous fix attempts (`fix-command-palette-open-shortcut`, `fix-platform-keyboard-shortcuts`, `fix-packaged-command-palette-shortcut`) added overlapping delivery paths (JS capture, Tauri global-shortcut plugin, menu accelerators) but macOS and Windows remain broken. This change diagnoses the root cause per-platform and implements a reliable, unified fix.

## Scope

**In scope:**
- Cmd+K / Ctrl+K opening the Command Palette on macOS and Windows (release builds)
- Ensuring the fix doesn't regress Linux
- Removing dead/redundant shortcut delivery paths that have accumulated from previous fix attempts

**Out of scope:**
- Other shortcuts (Ctrl+Q, Ctrl+D, etc.) — fix is scoped to command palette open trigger only
- Custom shortcut key remapping
- CI smoke tests for shortcuts (separate effort)

## Approach

### Root Cause Analysis

The app has **three overlapping paths** for Ctrl/Cmd+K:

1. **JS capture-phase handler** (`App.tsx` line ~265): `document.addEventListener("keydown", handleKeyDown, true)` — calls `isCommandPaletteOpenShortcut(e)` then `dispatchCommandPaletteOpen()`
2. **Tauri global-shortcut plugin** (`lib.rs` line ~294): Registers `Modifiers::SUPER + KeyK` / `Modifiers::CONTROL + KeyK` via `on_shortcuts`, emits `"global-shortcut"` event to `"main"` window
3. **Native menu accelerator** (`lib.rs` line ~197): Menu items with `Cmd+K`/`Control+k` accelerators, `on_menu_event` handler emits same `"global-shortcut"` event

**Linux works** because all three paths fire. **macOS and Windows break** because:

- **macOS**: WKWebView intercepts `Cmd+K` before the JS keydown event reaches the capture handler. The global-shortcut plugin uses `Modifiers::SUPER` but macOS global shortcuts require the app to be active AND the shortcut must not conflict with system-level handlers. The menu accelerator for Cmd+K IS registered in the "Commands" submenu, but `on_menu_event` may not fire if WKWebView's first responder consumes the key event first. Additionally, macOS menu accelerators are only checked when the app is **frontmost** and the menu bar is visible — but the Rust code hides the menu bar on Linux/Windows only, not macOS, which is correct.

- **Windows**: WebView2 (Chromium-based) intercepts `Ctrl+K` for its own internal command (focus address bar equivalent). WebView2's input routing means the JS `keydown` event for `Ctrl+K` may never fire. The global-shortcut plugin registration may conflict with WebView2's accelerator table.

### Fix Strategy

The fix must work at the **native/menu level** since the JS and global-shortcut paths are bypassed by the webview engine on macOS and Windows:

1. **macOS**: Move Cmd+K and Cmd+P from the "Commands" submenu to the **main menu bar** (not nested in a submenu). WKWebView's key handling checks the main menu bar first. Also ensure no webview-native `Cmd+K` handler overrides it. Test if `window.eval()` based JS injection from the menu event handler works as a reliable delivery mechanism.

2. **Windows**: The menu accelerator approach already exists for Windows but uses `on_menu_event`. The issue may be that `window.hide_menu()` is called (line ~465), which removes the menu AND its accelerators. We need to either:
   - Not hide the menu on Windows (use an invisible menu with accelerators only), OR
   - Use `set_menu()` with an invisible-but-functional menu, OR
   - Switch to the Tauri global-shortcut `on_shortcuts` callback which bypasses the menu system entirely

3. **Unify**: Use the Rust `on_shortcuts` callback (path 2) as the **primary** delivery mechanism on all platforms, since it fires at the app event loop level before the webview processes the key. The menu accelerators (path 3) serve as a fallback. The JS capture handler (path 1) remains as a PWA/dev-mode fallback.

4. **Debug why `on_shortcuts` doesn't fire on macOS/Windows**: The most likely issue is that the `on_shortcuts` callback fires correctly but the `emit_to("main", "global-shortcut", ...)` doesn't reach the JS listener. Check if Tauri 2.x `emit_to` for webview windows requires the window to have focus or if there's a permission issue. Also verify the JS `listen` call in App.tsx isn't silently failing on these platforms.

### Files Changed

- `src-tauri/src/lib.rs` — Restructure shortcut registration, fix menu event handling, add diagnostic logging
- `src/App.tsx` — Add error handling around the `listen` call, add fallback if `listen` fails
- `src/utils/commandPaletteShortcut.ts` — Minor: ensure metaKey (Cmd) path is not filtered
