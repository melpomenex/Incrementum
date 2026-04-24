## Why

Keyboard shortcuts are unreliable across platforms and customizable shortcuts configured in Settings don't actually work. App.tsx has 3+ overlapping keydown handlers that conflict with the store-based shortcut system. Users can customize shortcuts in Settings but those customizations are never read by the global handler. Meta+K (Cmd+K on macOS) inconsistently opens the command palette due to competing handler paths.

## What Changes

- Wire the customizable shortcut store (`KeyboardShortcuts.tsx`) into App.tsx's global handler so user-configured shortcuts from Settings actually fire
- Fix `eventMatchesCombo()` cross-platform matching that incorrectly rejects Ctrl on Linux
- Consolidate App.tsx's 3+ keydown handlers into a single authoritative handler that reads from the store
- Fix ShortcutRecorder in Settings to prevent recording conflicts (Escape handling, empty combos)
- Add conflict detection UI when users assign a shortcut already in use
- Ensure Meta+K/Cmd+K reliably opens command palette on macOS via both native (Rust) and JS paths
- Use the existing `eventMatchesCombo`-based dispatch as the unified routing mechanism for all customizable shortcuts
- Remove dead code (`useKeyboardNavigation.ts`)

## Capabilities

### New Capabilities

- `customizable-shortcuts`: Users can customize keyboard shortcuts in Settings and those customizations actually take effect application-wide, with conflict detection and immediate feedback.

### Modified Capabilities

- `global-shortcuts`: Existing global shortcut spec from fix-keyboard-shortcuts change is partially implemented — needs full wiring of store to App.tsx handler, handler consolidation, and macOS Meta+K verification.

## Impact

- **Frontend**: `App.tsx` (consolidate handlers, wire to store), `KeyboardShortcuts.tsx` (fix eventMatchesCombo, connect store to dispatch), `KeyboardShortcutsSettings.tsx` (fix ShortcutRecorder, add conflict detection), `useKeyboardShortcuts.ts` (reconcile with store-based system)
- **Backend/Rust**: `lib.rs` (verify macOS Meta+K accelerator/global-shortcut delivery)
- **Tests**: `commandPaletteShortcut.test.ts` and `commandPaletteEvents.test.ts` (update for new wiring)
- **User-facing**: Settings → Shortcuts tab becomes fully functional — customized shortcuts work immediately
