## 1. Extend SHORTCUT_ACTION_HANDLERS in App.tsx

- [x] 1.1 Add handler for `edit.new-flashcard` — dispatch `CustomEvent("open-flashcard-studio")`
- [x] 1.2 Add handler for `edit.new-extract` — dispatch `CustomEvent("new-extract")`
- [x] 1.3 Add handler for `edit.save` — dispatch `CustomEvent("save-current")`
- [x] 1.4 Add handler for `view.sidebar` — dispatch `CustomEvent("toggle-sidebar")`
- [x] 1.5 Add handler for `gen.screenshot` — dispatch `CustomEvent("capture-screenshot")`
- [x] 1.6 Add handler for `review.skip` — dispatch `CustomEvent("review-skip")`
- [x] 1.7 Add handler for `doc.next` — dispatch `CustomEvent("document-next")`
- [x] 1.8 Add handler for `doc.prev` — dispatch `CustomEvent("document-prev")`
- [x] 1.9 Add handler for `doc.search` — dispatch `CustomEvent("document-search")`
- [x] 1.10 Add handler for `nav.forward` — dispatch `CustomEvent("navigate", { detail: "forward" })`
- [x] 1.11 Add handler for `nav.back` — dispatch `CustomEvent("navigate", { detail: "back" })`
- [x] 1.12 Add handler for `nav.up` — dispatch `CustomEvent("navigate", { detail: "up" })`

## 2. Wire flashcard studio modal to shortcut event

- [x] 2.1 Add `useEffect` in `FlashcardStudioModal.tsx` or `ReviewHome.tsx` to listen for `CustomEvent("open-flashcard-studio")` and open the modal
- [x] 2.2 Clean up the listener on unmount

## 3. Fix KeyboardShortcutsHelp to read from Zustand store

- [x] 3.1 Import `useShortcutStore` from `KeyboardShortcuts.tsx` in `KeyboardShortcutsHelp.tsx`
- [x] 3.2 Replace the hardcoded `getShortcutGroups()` function body with logic that reads `useShortcutStore.getState().shortcuts`
- [x] 3.3 Group shortcuts by `ShortcutCategory` enum in the same category order used by Settings
- [x] 3.4 Use the existing `formatCombo()` function (or equivalent) to render each shortcut's keybinding string
- [x] 3.5 Remove the hardcoded shortcut arrays from the old `getShortcutGroups()`

## 4. Register additional native global shortcuts in Rust

- [x] 4.1 Add `Ctrl+Shift+F` / `Cmd+Shift+F` to `shortcut_defs` in `src-tauri/src/lib.rs`
- [x] 4.2 Add `Ctrl+Shift+S` / `Cmd+Shift+S` to `shortcut_defs`
- [x] 4.3 Add `Ctrl+B` / `Cmd+B` to `shortcut_defs`
- [x] 4.4 Add `Ctrl+F` / `Cmd+F` to `shortcut_defs`
- [x] 4.5 Add `Ctrl+]` / `Cmd+]` to `shortcut_defs`
- [x] 4.6 Add `Ctrl+[` / `Cmd+[` to `shortcut_defs`
- [x] 4.7 Wrap the new shortcuts in error handling (log warning on registration failure, continue)

## 5. Handle new native shortcut events in App.tsx

- [x] 5.1 Add `case` branches in the Tauri `global-shortcut` event listener for `"KeyF"` (with modifiers check), `"KeyB"`, `"KeyS"` (with modifier check), `"KeyE"`, `"BracketRight"`, `"BracketLeft"`
- [x] 5.2 Each case SHALL call the same handler as the corresponding SHORTCUT_ACTION_HANDLERS entry

## 6. Resolve doc.search conflict in DocumentViewer

- [x] 6.1 In the DocumentViewer keydown handler, before handling Ctrl+F, check `useShortcutStore.getState().shortcuts` for the current `doc.search` binding
- [x] 6.2 If the binding differs from the current event combo, let the event propagate (do not preventDefault)
- [x] 6.3 If the binding matches, call `e.preventDefault()` and trigger the viewer's search UI

## 7. Verification

- [x] 7.1 Verify `Ctrl+Shift+F` opens the flashcard studio modal
- [x] 7.2 Verify `Ctrl+B` toggles the sidebar
- [x] 7.3 Verify `Ctrl+Shift+S` triggers screenshot
- [x] 7.4 Verify `Ctrl+]` and `Ctrl+[` navigate document tabs
- [x] 7.5 Verify `S` skips card during active review
- [x] 7.6 Verify Alt+ArrowRight/Left/Up fire navigation events
- [x] 7.7 Verify KeyboardShortcutsHelp shows live customized bindings
- [x] 7.8 Verify customized `doc.search` binding is respected in DocumentViewer
- [x] 7.9 Run existing build/lint to ensure no regressions
