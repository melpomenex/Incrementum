## Why

Only 8 of the 30 keyboard shortcuts defined and displayed in Settings > Shortcuts have actual handler implementations. Pressing shortcuts like `Ctrl+Shift+F` (New Flashcard) does nothing, despite being shown in the UI as available. Users see shortcuts that don't work, which erodes trust and creates a broken UX.

## What Changes

- Audit all 30 shortcuts defined in `KeyboardShortcuts.tsx` against the dispatch mechanism in `App.tsx`
- Add missing handlers in `SHORTCUT_ACTION_HANDLERS` for every shortcut that lacks one
- Fix `Ctrl+Shift+F` (New Flashcard) to open the Flashcard Studio modal
- Fix `Ctrl+Shift+S` (Screenshot) and `Ctrl+B` (Sidebar toggle) — present in the customizable store but not in the central dispatch
- Wire nav.forward/back/up shortcuts to the active view's navigation
- Ensure review.skip (S key) is handled by the review session
- Ensure doc.next/doc.prev (Ctrl+]/Ctrl+[) navigate document tabs
- Fix KeyboardShortcutsHelp overlay to read live shortcuts from the store instead of displaying a hardcoded list
- Register missing native global shortcuts in the Tauri Rust backend where needed to prevent webview interception
- Resolve the conflict where `doc.search` (Ctrl/Cmd+F) is handled both by the customizable system and the DocumentViewer, causing potential double-fire

## Capabilities

### New Capabilities

- `shortcut-handler-audit`: Complete handler coverage for all 30 shortcuts defined in the centralized customizable shortcut system, with every shortcut ID in `DEFAULT_SHORTCUTS` having a corresponding entry in `SHORTCUT_ACTION_HANDLERS`
- `shortcut-display-sync`: The KeyboardShortcutsHelp overlay dynamically reads shortcuts from the Zustand store so it stays in sync with user customizations
- `native-shortcut-registration`: Tauri Rust backend registers all top-level global shortcuts so they are not intercepted by the webview on Linux/Windows

### Modified Capabilities

<!-- None — no existing shortcut specs exist in openspec/specs/ -->

## Impact

- **Primary files**: `src/App.tsx` (SHORTCUT_ACTION_HANDLERS map), `src/components/common/KeyboardShortcuts.tsx` (DEFAULT_SHORTCUTS, useShortcut hook), `src/components/common/KeyboardShortcutsHelp.tsx` (help overlay)
- **Component-level fix**: `src/components/review/ReviewHome.tsx` or `FlashcardStudioModal.tsx` (flashcard shortcut listener)
- **Rust backend**: `src-tauri/src/lib.rs` (global shortcut registration)
- **No breaking changes**: All changes are additive — adding missing handlers, no shortcut bindings are removed or renamed
