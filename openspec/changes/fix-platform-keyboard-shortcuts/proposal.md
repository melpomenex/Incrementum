## Why

Keyboard shortcuts (Ctrl+K, Ctrl+Q, Ctrl+D, etc.) don't work on Windows and macOS despite previous fixes targeting Linux. The Tauri global shortcut plugin registers `Modifiers::CONTROL` + key for Windows and `Modifiers::SUPER` + key for macOS, but on both platforms the native WebView engines (WebView2 on Windows, WKWebView on macOS) intercept modifier+key combos before they reach either the Rust global shortcut handler or the JS keydown listener. Only modifier-less keys (1-4 for flashcard ratings) work because they bypass the interception entirely.

## What Changes

- Investigate and fix why `tauri-plugin-global-shortcut` registrations fail to fire on Windows (WebView2) and macOS (WKWebView)
- Ensure Ctrl+K/Cmd+K opens the Command Palette on all platforms
- Ensure all navigation shortcuts (Ctrl+Q, Ctrl+D, Ctrl+R, Ctrl+,, Ctrl+O, Ctrl+N, Ctrl+/) work on Windows and macOS
- Add Windows-specific (Ctrl) and macOS-specific (Cmd) shortcut variants that avoid conflicting with WebView reserved accelerators
- Remove any remaining duplicate/conflicting shortcut listeners

## Capabilities

### New Capabilities

- `cross-platform-shortcuts`: Reliable keyboard shortcuts that work on Windows, macOS, and Linux by handling platform-specific WebView interception differences

### Modified Capabilities

## Impact

- **Backend/Rust**: `src-tauri/src/lib.rs` — may need to adjust shortcut registration strategy (modifier keys, registration timing, or use of `on_shortcuts` vs individual `register`)
- **Frontend**: `src/App.tsx` — JS-level shortcut handler and Tauri event listener may need adjustments
- **Tauri config**: `src-tauri/capabilities/default.json` — may need additional permissions
- **All platforms**: Windows (WebView2), macOS (WKWebView), and Linux (webkit2gtk) have different shortcut interception behaviors
