## Context

The app has a centralized customizable shortcut system in `KeyboardShortcuts.tsx` that defines 30 shortcuts across 7 categories, persisted via Zustand to localStorage. Shortcuts are displayed in Settings > Keyboard Shortcuts (editable) and in a help overlay. However, the central dispatch map `SHORTCUT_ACTION_HANDLERS` in `App.tsx` only has 8 entries. The remaining 22 shortcuts either have no handler at all (silently ignored), or are handled independently by components via hardcoded keydown listeners — bypassing the customizable system entirely (so user rebinds in Settings have no effect).

Additionally, the `KeyboardShortcutsHelp` overlay uses a separate hardcoded shortcut list (`getShortcutGroups()`) that does not read from the store, so it shows stale defaults even after customization.

The Tauri Rust backend registers 9 global shortcuts to prevent webview interception, but matches only the 8 handled shortcuts.

## Goals / Non-Goals

**Goals:**
- Every shortcut ID in `DEFAULT_SHORTCUTS` has a corresponding entry in `SHORTCUT_ACTION_HANDLERS`
- Pressing `Ctrl+Shift+F` opens the Flashcard Studio modal
- Pressing `Ctrl+B` toggles the sidebar (if not already handled by a component-level listener)
- Pressing `Ctrl+Shift+S` triggers screenshot capture
- `KeyboardShortcutsHelp` reads the live customized shortcuts from the Zustand store
- Native global shortcuts in Rust cover all top-level combos that could be intercepted by the webview
- `doc.search` conflict resolved: DocumentViewer respects the customizable store binding

**Non-Goals:**
- Rewriting component-level shortcuts (review 1-4, epub zoom, etc.) to use the centralized dispatch — those are intentionally context-scoped
- Changing the shortcut definition or storage format
- Adding new shortcuts beyond the existing 30
- Unifying the RSS keyboard shortcut store with the main store

## Decisions

### 1. Event-based dispatch for component-scoped actions

**Decision**: Use `window.dispatchEvent(new CustomEvent(...))` for shortcuts whose action target is a child component (flashcard, screenshot, sidebar, review skip, document tab navigation).

**Rationale**: This pattern is already used for `start-review-session`, `import-document`, and `extract-text`. It decouples the App-level dispatch from component internals without requiring complex ref passing or global state. Components that handle these events already have `useEffect` listeners.

**Alternatives considered**:
- React context with callbacks: would require threading a large callback bag through the component tree
- Direct Zustand dispatch: adds side-effect logic to stores that should stay pure
- URL-based navigation: overkill for actions that don't represent a page change

### 2. KeyboardShortcutsHelp reads from store

**Decision**: Replace the hardcoded `getShortcutGroups()` with a function that reads `useShortcutStore.getState().shortcuts` and formats them identically to the current output using `KeyCombo` to string conversion.

**Rationale**: The store is already the source of truth for shortcut bindings. Reading it in the help overlay keeps it synchronized with user customizations without any new wiring. The `formatCombo()` function already exists in `KeyboardShortcuts.tsx`.

### 3. Native shortcut registration coverage

**Decision**: Add the following combos to the Rust `shortcut_defs` array: `Ctrl+Shift+F`, `Ctrl+Shift+S`, `Ctrl+B`, `Ctrl+F`, `Ctrl+]`, `Ctrl+[`, `Alt+ArrowRight`, `Alt+ArrowLeft`, `Alt+ArrowUp`. Emit them as `global-shortcut` events the same way existing shortcuts do. Add corresponding `case` branches in the Tauri event listener in `App.tsx`.

**Rationale**: webkit2gtk on Linux intercepts many Ctrl+key combos before the JavaScript can handle them. Registering them at the native level ensures the webview does not consume them silently. The JS handler already has a `global-shortcut` event listener that dispatches to the same `SHORTCUT_ACTION_HANDLERS`.

**Alternative**: Only register those where user reports of interception exist. Rejected because it would require per-platform testing and result in future bug reports.

### 4. doc.search conflict resolution

**Decision**: In the DocumentViewer, check if the `doc.search` shortcut has been customized in the store before handling Ctrl+F. If it has a different binding, allow the browser default (or the customized binding). If it's still Ctrl+F, prevent default and trigger the viewer's search.

**Rationale**: The DocumentViewer currently hardcodes Ctrl+F. The customizable system also matches Ctrl+F. This causes a double-fire. The viewer should defer to the store to decide whether to act.

### 5. Review skip and document tab navigation

**Decision**: Review skip (`S` key) fires a `CustomEvent("review-skip")`. Document tab navigation (`Ctrl+]`/`Ctrl+[`) fires `CustomEvent("document-next")`/`CustomEvent("document-prev")`. Existing components listen for these events.

**Rationale**: Same fire-and-forget CustomEvent pattern as other component-scoped shortcuts.

## Risks / Trade-offs

- **[Risk] Flaky CustomEvent delivery**: If the target component is not mounted when the event fires, nothing happens. → **Mitigation**: Document which pages/components must be mounted for each shortcut. Flashcard shortcut only works when a review/home view is active, which is acceptable.
- **[Risk] Native shortcut registration on Tauri v2 may have OS-specific quirks**: Some modifier+key combos may not be registrable on all platforms (especially Wayland). → **Mitigation**: Wrap registration in `if let Err(e)` and log the error; JS handler is the fallback path.
- **[Risk] KeyboardShortcutsHelp now depends on store import**: Adds a runtime dependency but no new network or async concern. → **Mitigation**: Already in the same component tree; negligible impact.

## Open Questions

- Should `edit.save` (Ctrl+S) be handled, or left to browser-native save behavior? Currently the browser handles Ctrl+S; adding a handler could conflict.
- Should `Ctrl+E` dispatch `edit.new-extract` or `edit.extract-text`? Currently both have default combos with `Ctrl+E` (new-extract has Ctrl+E+meta, extract-text has Ctrl+E only). This is a latent conflict in the defaults.
