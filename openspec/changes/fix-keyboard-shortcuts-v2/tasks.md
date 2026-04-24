## 1. Fix eventMatchesCombo cross-platform matching

- [x] 1.1 Fix `eventMatchesCombo()` in `src/components/common/KeyboardShortcuts.tsx`: when `usesPrimaryModifier` is true (`ctrl && meta`), match `event.ctrlKey` on Linux/Windows and `event.metaKey` on macOS — remove the incorrect `event.ctrlKey === !isMac` check that currently rejects Ctrl on Linux
- [x] 1.2 Verify the fix doesn't break `useShortcut("gen.screenshot")` in `src/components/layout/MainLayout.tsx` — the only active consumer of the per-shortcut hook from the store

## 2. Consolidate App.tsx global shortcut handlers

- [x] 2.1 Create a `ShortcutActionHandler` map that associates each customizable shortcut ID (from `DEFAULT_SHORTCUTS`) with its corresponding action function (navigate to page, dispatch custom event, toggle state)
- [x] 2.2 Replace App.tsx's broader hardcoded shortcut handler with a consolidated handler that iterates over store shortcuts, calls `eventMatchesCombo()`, and dispatches via the action handler map
- [x] 2.3 Keep the capture-phase `preventDefault()` logic as the first useEffect to protect against webkit2gtk/GTK interception
- [x] 2.4 Keep a narrow direct capture-phase `Ctrl/Cmd+K` and `Ctrl/Cmd+P` command-palette bridge for AppImage/WebKit/native-menu reliability while letting customized palette shortcuts flow through the consolidated handler
- [x] 2.5 Verify that isEditableShortcutTarget() is called early in the consolidated handler to suppress shortcuts while typing in inputs/textareas

## 3. Wire customizable store to global dispatch

- [x] 3.1 Import `useShortcutStore.getState()` in App.tsx and read `shortcuts` array — the consolidated handler iterates over these shortcuts (with their custom combos) instead of using hardcoded key checks
- [x] 3.2 Subscribe App.tsx's handler to store changes so that when a user customizes a shortcut in Settings, the handler picks up the new combo without requiring a page reload
- [x] 3.3 Ensure the `formatKeyCombo` and `eventMatchesCombo` utilities use the same `usesPrimaryModifier` semantics so display and matching are consistent

## 4. Fix ShortcutRecorder in KeyboardShortcutsSettings

- [x] 4.1 Handle Escape key in ShortcutRecorder: when user presses Escape during recording, cancel and restore the previous combo
- [x] 4.2 Reject modifier-only combos (pressing just Ctrl, Alt, Shift, or Meta without a key) — the recording should continue until a non-modifier key is pressed
- [x] 4.3 Ensure `event.stopPropagation()` and `event.preventDefault()` in the recorder handler prevent the recorded keydown from also triggering the global shortcut action
- [x] 4.4 Add visual feedback that recording is active (button pulse animation already exists — verify it works consistently)

## 5. Add conflict detection in Settings shortcuts

- [x] 5.1 Add a `findConflicts(combo, excludeId)` utility in `KeyboardShortcuts.tsx` that checks all other shortcuts for matching combos
- [x] 5.2 In `KeyboardShortcutsSettings.tsx`, after a shortcut is updated, check for conflicts and display a warning inline next to the conflicting shortcut(s)
- [x] 5.3 Ensure the conflict check catches both default and customized combos

## 6. Verify and fix macOS Meta+K delivery

- [x] 6.1 Verify the Rust lib.rs global-shortcut registration includes `Cmd+K` on macOS — confirm the `(Modifiers::SUPER, Code::KeyK)` entry is present
- [x] 6.2 Verify the macOS menu accelerator for `Cmd+K` (`accel-k` with `"Cmd+K"`) is registered and fires the `"global-shortcut"` event
- [x] 6.3 Add console.debug tracing in the App.tsx `"global-shortcut"` listener to log received key events for debugging macOS delivery
- [x] 6.4 If the native path fails, ensure the consolidated JS handler catches `Cmd+K` as a fallback

## 7. Remove dead code

- [x] 7.1 Verify `src/hooks/useKeyboardNavigation.ts` has no imports and remove it
- [x] 7.2 Verify `src/hooks/useKeyboardShortcuts.ts` `useGlobalShortcuts()` is only used by the tabbed layout (MainLayout.tsx) and ensure it does not conflict with the consolidated handler when present

## 8. Test and verify

- [x] 8.1 Run existing unit tests for `commandPaletteShortcut.ts` and `commandPaletteEvents.ts` — update if needed
- [x] 8.2 Verify Ctrl+K/Ctrl+P command-palette matching and early dispatch path via unit tests and App.tsx capture bridge
- [x] 8.3 Verify Ctrl+Q/D/R/O/N/, dispatch paths are represented in the store-backed App.tsx action map
- [x] 8.4 Verify Cmd+K command-palette paths via unit tests, Rust `SUPER+KeyK` registration, and macOS menu accelerator inspection
- [x] 8.5 Verify customized shortcuts are read live from `useShortcutStore.getState().shortcuts` on each keydown
- [x] 8.6 Verify conflict detection catches default and customized combos via unit tests
- [x] 8.7 Verify Escape cancels shortcut recording in both recorder implementations
- [x] 8.8 Verify shortcuts are suppressed while typing in INPUT/TEXTAREA/SELECT/contentEditable via shared matcher tests and App.tsx early target checks
