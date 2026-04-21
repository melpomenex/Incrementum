## Why

Keyboard shortcuts documented in the User Handbook (Ctrl+Q for Queue, Ctrl+D for Dashboard, Ctrl+R for Review, etc.) are unreliable on Linux. Ctrl+K works but others like Ctrl+Q fail silently. The codebase has 5+ overlapping shortcut registration systems that may conflict, and no Tauri-level shortcut registration exists to guarantee platform-level delivery.

## What Changes

- Consolidate the 5+ overlapping keyboard shortcut systems into a single, authoritative source of truth
- Fix the cross-platform matching bug in `KeyboardShortcuts.tsx`'s `eventMatchesCombo()` that prevents shortcuts from firing on Linux
- Register critical navigation shortcuts at the Tauri/Rust level using `tauri-plugin-global-shortcut` to bypass webkit2gtk accelerator interception on Linux
- Ensure all 8 documented handbook shortcuts work reliably on all platforms (Linux, macOS, Windows)
- Remove dead/duplicate shortcut listeners that add complexity without value

## Capabilities

### New Capabilities
- `global-shortcuts`: A unified, platform-reliable keyboard shortcut system that works across Linux (webkit2gtk), macOS (WKWebView), and Windows (WebView2), with Tauri-level registration for critical shortcuts and a single consolidated web-layer handler for everything else.

### Modified Capabilities
<!-- No existing specs require requirement changes -->

## Impact

- **Frontend**: `App.tsx` (primary shortcut handler), `KeyboardShortcuts.tsx` (store-based system), `useKeyboardShortcuts.ts` (hook-based system), `useKeyboardNavigation.ts` (vim-style nav), `CommandPalette.tsx` (its own Ctrl+K listener), `KeyboardShortcutsHelp.tsx` (help overlay), `NewMainLayout.tsx` (sidebar shortcut)
- **Backend/Rust**: `lib.rs` (add global shortcut plugin registration), `Cargo.toml` (add `tauri-plugin-global-shortcut` dependency)
- **Configuration**: `tauri.conf.json` (may need capability updates for global shortcut permissions)
- **User-facing**: All documented shortcuts will work reliably; no behavior change for existing working shortcuts
