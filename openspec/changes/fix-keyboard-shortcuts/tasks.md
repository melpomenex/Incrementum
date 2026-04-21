## 1. Fix cross-platform matching bug

- [x] 1.1 Fix `eventMatchesCombo()` in `src/components/common/KeyboardShortcuts.tsx` (line 366-389): when `usesPrimaryModifier` is true (`ctrl && meta`), the function must match Ctrl on Linux/Windows and Meta/Cmd on macOS — currently it incorrectly requires `event.ctrlKey === false` on Linux
- [x] 1.2 Verify the fix doesn't break `useShortcut("gen.screenshot")` in `src/components/layout/MainLayout.tsx` (line 63) — the only active consumer of the store-based shortcut hook

## 2. Consolidate global shortcut handlers

- [x] 2.1 Remove the duplicate Ctrl+K/Cmd+K listener from `src/components/common/CommandPalette.tsx` (lines 283-296 in `CommandPaletteProvider`) — it should listen for the `"command-palette-open"` custom event dispatched by App.tsx, not register its own raw keydown listener
- [x] 2.2 Audit and confirm `src/hooks/useKeyboardShortcuts.ts` `useGlobalShortcuts()` is only called from `src/components/layout/MainLayout.tsx` (the tabbed layout, currently not the default) and does not conflict when both layouts coexist in the codebase
- [x] 2.3 Verify `src/hooks/useKeyboardNavigation.ts` is dead code (no imports found) and remove it

## 3. Verify all handbook shortcuts work

- [ ] 3.1 Test Ctrl+K opens command palette on Linux
- [ ] 3.2 Test Ctrl+P opens command palette on Linux
- [ ] 3.3 Test Ctrl+, navigates to settings on Linux
- [ ] 3.4 Test Ctrl+D navigates to dashboard on Linux
- [ ] 3.5 Test Ctrl+Q navigates to queue on Linux
- [ ] 3.6 Test Ctrl+R starts review session on Linux
- [ ] 3.7 Test Ctrl+O opens document import on Linux
- [ ] 3.8 Test Ctrl+N imports document on Linux
- [ ] 3.9 Test Ctrl+/ shows shortcuts help on Linux
- [ ] 3.10 Test ? shows shortcuts help when not in an input field

## 4. Handle platform interception edge cases

- [x] 4.1 Add capture-phase `preventDefault()` on `document` in App.tsx as first line of defense
- [x] 4.2 Add `tauri-plugin-global-shortcut` to register all 9 shortcuts at the native/Rust level (bypasses webkit2gtk entirely), emitting `"global-shortcut"` events to the frontend
- [x] 4.3 Add Tauri event listener in App.tsx that maps native shortcut events to navigation actions
