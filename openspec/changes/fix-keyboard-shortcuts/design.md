## Context

The app has 5+ overlapping keyboard shortcut registration systems, all operating at the web/JavaScript layer:

1. **`App.tsx`** (lines 184-256): Primary global handler using `window.addEventListener("keydown")`. Handles all 8 handbook shortcuts via direct `setCurrentPage()` calls. Works via `(e.metaKey || e.ctrlKey)` check.
2. **`useKeyboardShortcuts.ts`**: Hook used only by `MainLayout.tsx` (tabbed layout, not currently active). Registers `Cmd+1-4`, `Cmd+,`, `Cmd+K`, `Cmd+Shift+P` with strict exact-match logic (`ctrlKey must === shortcut.ctrlKey`).
3. **`KeyboardShortcuts.tsx`**: Store-based customizable shortcut system with `useShortcut()` hook. Defines shortcuts with `{ctrl: true, meta: true}` (both keys) and `eventMatchesCombo()` for cross-platform matching.
4. **`useKeyboardNavigation.ts`**: Vim-style navigation hook — defined but not imported anywhere (dead code).
5. **`CommandPalette.tsx`**: Has its own `Ctrl+K` listener in its provider context.
6. **`NewMainLayout.tsx`**: Registers only `Ctrl+B` for sidebar toggle.

The active layout is `NewMainLayout` (sidebar-based). The tabbed `MainLayout` is only used via `main.tsx` routing.

**Key bug**: `eventMatchesCombo()` in `KeyboardShortcuts.tsx` has broken cross-platform logic. When shortcuts use `{ctrl: true, meta: true}` (intended as "either Ctrl or Meta"), the function checks `event.ctrlKey === false` when `usesPrimaryModifier` is true. On Linux where Ctrl is the primary modifier and `event.ctrlKey === true`, this check fails, so store-based shortcuts never fire on Linux.

**Platform issue**: On Linux with webkit2gtk, GTK accelerator keys (Ctrl+Q quit, Ctrl+N new window, Ctrl+P print) may intercept events before they reach JavaScript. No Tauri-level shortcut registration exists.

## Goals / Non-Goals

**Goals:**
- All 8 documented handbook shortcuts work reliably on Linux, macOS, and Windows
- Single consolidated shortcut handler as the source of truth for global shortcuts
- Fix the cross-platform matching bug in `eventMatchesCombo()`
- Keep the customizable shortcut system functional but fix its matching logic
- Remove dead code (`useKeyboardNavigation.ts` is unused)

**Non-Goals:**
- Redesigning the shortcut customization UI
- Adding new shortcuts beyond what's documented in the handbook
- Changing the vim-style navigation system
- Registering shortcuts at the Tauri level (overkill for this fix — the App.tsx handler is the right layer, the real bugs are in matching logic and event conflicts)

## Decisions

### 1. Fix `eventMatchesCombo()` cross-platform logic (preferred over Tauri-level registration)

**Decision**: Fix the matching function so `{ctrl: true, meta: true}` means "Ctrl on Linux/Windows, Meta on macOS" — i.e., the primary platform modifier.

**Rationale**: The App.tsx handler works correctly with `(e.metaKey || e.ctrlKey)`. The store-based system should match this semantics. The current `eventMatchesCombo()` logic inverts the check — it requires `event.ctrlKey === false` on Linux when `usesPrimaryModifier` is true, which is wrong.

**Alternative considered**: Register shortcuts at Tauri/Rust level via `tauri-plugin-global-shortcut`. Rejected because it adds complexity (Rust↔JS bridge, new dependency) when the real issue is a matching logic bug, not event delivery. If GTK interception proves to be the actual cause after fixing the logic, we can escalate to Tauri-level registration.

### 2. Consolidate to App.tsx as single global handler

**Decision**: Keep `App.tsx` as the authoritative global shortcut handler. Remove duplicate registrations from other systems for the same shortcuts.

**Rationale**: App.tsx's handler is simple, correct, and always active. Other systems add complexity without value for the global shortcuts. The `CommandPalette.tsx` Ctrl+K listener can remain as a fallback since it dispatches the same event.

### 3. Keep the customizable shortcut store but fix its role

**Decision**: The `KeyboardShortcuts.tsx` store defines customizable shortcuts for the settings UI, but its `useShortcut()` hook should NOT duplicate the global handler's work. Instead, it should be used for context-specific shortcuts (like document viewer shortcuts), while App.tsx remains the global authority.

**Rationale**: The store-based system provides value for the settings UI where users can view and customize shortcuts. But its hook-based listeners create duplicate registrations that conflict with App.tsx.

## Risks / Trade-offs

- **[Risk: webkit2gtk may still intercept Ctrl+Q/Ctrl+N]** → If fixing the matching logic doesn't resolve the issue, we'll need to investigate Tauri-level registration as a follow-up. The `e.preventDefault()` in App.tsx should tell webkit2gtk that the event was handled, but this depends on whether the event reaches JavaScript at all.
- **[Risk: Removing duplicate handlers may break edge cases]** → The duplicate handlers in `CommandPalette.tsx` and `useKeyboardShortcuts.ts` might be working around edge cases. Test thoroughly on all platforms after consolidation.
- **[Risk: Changing `eventMatchesCombo()` may affect other users of the function]** → The function is only used by `KeyboardShortcuts.tsx` internals (`useKeyboardShortcuts()` and `useShortcut()` hooks), and the only active consumer is `MainLayout.tsx`'s `useShortcut("gen.screenshot")`. Low blast radius.
