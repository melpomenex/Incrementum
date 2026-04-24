## Context

The current keyboard shortcut architecture has three independent systems:

1. **App.tsx (global handler)**: 3+ `useEffect`-based keydown listeners that hardcode shortcut keys. Handles Ctrl/Cmd+K, P, comma, D, Q, R, O, N, /, ? directly with `setCurrentPage()` calls and custom event dispatch. Does NOT consult the customizable shortcut store.

2. **KeyboardShortcuts.tsx (customizable store)**: A zustand+persist store with 25 predefined shortcuts across 7 categories. Provides `useKeyboardShortcuts()` hook (registers its own keydown listener) and `useShortcut(id, handler)` hook (registers per-shortcut listeners). Its `eventMatchesCombo()` has a cross-platform bug where `{ctrl: true, meta: true}` fails to match Ctrl on Linux.

3. **useKeyboardShortcuts.ts (hook-based)**: Provides `useGlobalShortcuts()` used only by the tabbed layout (MainLayout.tsx, not the default layout). Registers its own capture-phase keydown listener. Has its own matching logic that may conflict.

**Key problem**: The customizable store (system 2) stores user preferences, but App.tsx (system 1) never reads from it. Users who customize shortcuts in Settings get no effect because App.tsx uses hardcoded key checks.

**macOS Meta+K**: The Rust layer (lib.rs) registers both global shortcuts (via `tauri-plugin-global-shortcut`) and menu accelerators. On macOS, only menu accelerators for K and P are registered (not the full set of 9). The frontend has a Tauri event listener for "global-shortcut", but delivery may fail if the webview intercepts the event first.

## Goals / Non-Goals

**Goals:**

- Customizable shortcuts configured in Settings actually work application-wide
- Consolidated store-backed keydown handler in App.tsx as the authoritative dispatch point for customizable shortcuts
- Dedicated capture-phase command-palette bridge for the default `Ctrl/Cmd+K` and `Ctrl/Cmd+P` shortcuts so AppImage/WebKit/native-menu interception cannot block palette opening
- Fix `eventMatchesCombo()` cross-platform matching (Ctrl on Linux, Cmd on macOS)
- Fix ShortcutRecorder component to properly handle Escape and prevent recording invalid combos
- Add conflict detection when user assigns a shortcut already in use by another action
- Meta+K/Cmd+K reliably opens command palette on macOS
- All 25 customizable shortcuts from the store dispatch through the consolidated handler
- Remove `useKeyboardNavigation.ts` (dead code)

**Non-Goals:**

- Redesigning the Settings shortcuts UI layout or adding new shortcut categories
- Adding new shortcuts beyond the 25 already defined in DEFAULT_SHORTCUTS
- Changing the Vimium navigation system or the RSS reader shortcut system
- Redesigning the native Rust-level shortcut registration (only verify and fix macOS Meta+K delivery)

## Decisions

### 1. Wire store to App.tsx handler (preferred over duplicating store logic)

**Decision**: Refactor App.tsx's global handler to read shortcut combos from `useShortcutStore.getState().shortcuts` and dispatch via `eventMatchesCombo()`. Remove the hardcoded key-by-key matching.

**Rationale**: The store already has all 25 shortcut definitions with their current (possibly customized) combos. Using `eventMatchesCombo()` as the single matching function means customizations take effect immediately. The existing 5-line `eventMatchesCombo()` per-shortcut check replaces the current 50+ line switch/match chain in App.tsx.

**Alternative considered**: Keep App.tsx hardcoded and have the store dispatch custom events that App.tsx listens to. Rejected because it adds indirection without value — the store already has the authoritative combo data.

### 2. Consolidate customizable shortcuts and keep command-palette capture fallback

**Decision**: Replace the broad hardcoded shortcut handler in App.tsx with a store-backed handler that:

- Has capture-phase pre-emption (preventDefault for webkit2gtk)
- Iterates over all store shortcuts
- Calls `eventMatchesCombo()` for each
- Dispatches via the shortcut's mapped action

Keep a narrow direct capture-phase command-palette bridge for the default `Ctrl/Cmd+K` and `Ctrl/Cmd+P` combos. It dispatches `command-palette-open` before later bubbling handlers and native/webview layers can consume the event.

**Rationale**: Store-backed dispatch makes customization work immediately, while the narrow command-palette bridge preserves the AppImage/WebKit fallback that fixed prior `Ctrl+K` regressions. The bridge only covers the documented default palette combos; customized palette shortcuts still flow through the store-backed handler.

### 3. Fix eventMatchesCombo for `{ctrl: true, meta: true}` semantics

**Decision**: When `ctrl && meta` are both true, interpret as "primary platform modifier" — match `ctrlKey` on Linux/Windows, `metaKey` on macOS. The current code checks `event.ctrlKey === !isMac` which is incorrect (requires `ctrlKey === false` on macOS, but `event.ctrlKey` is false on macOS when Cmd is pressed).

### 4. Create a ShortcutAction → handler mapping in App.tsx

**Decision**: Define a `ShortcutActionHandler` map outside the component that maps each shortcut ID to its action function (navigate, dispatch event, toggle state). The consolidated handler iterates store shortcuts, matches via `eventMatchesCombo()`, and calls the mapped handler.

**Rationale**: This decouples "which key combo" (from the store) from "what to do" (the action). Users can rebind any shortcut to any key without touching the action logic.

### 5. Fix ShortcutRecorder in Settings

**Decision**:

- Handle Escape key to cancel recording
- Prevent recording a combo with no modifiers (except for a few safe keys like `?`, `1-4`, `s` which are valid unmodified shortcuts)
- Show visual feedback when recording is active (already partially done with pulse animation)
- Add conflict detection: if the recorded combo matches another shortcut's combo, show a warning

### 6. macOS Meta+K verification

**Decision**: The Rust lib.rs already registers `Cmd+K` as both a global shortcut and a menu accelerator on macOS. The frontend listens for "global-shortcut" events. If Meta+K doesn't work on macOS, the likely cause is the menu accelerator not firing or the frontend listener not receiving the event. Add tracing/debug logging and verify the delivery chain. If the accelerator path is unreliable, rely on the global-shortcut plugin path or the JS direct handler.

## Risks / Trade-offs

- **[Risk: Refactoring App.tsx handler may break edge cases]** → The current 3-handler setup has grown organically with workarounds for specific platforms. Test on all 3 platforms after consolidation. Keep the capture-phase pre-emption which is the most critical piece.
- **[Risk: eventMatchesComo change affects existing consumers]** → `useShortcut()` in MainLayout.tsx and `useKeyboardShortcuts()` in KeyboardShortcuts.tsx both call `eventMatchesCombo()`. The fix only changes behavior when `ctrl=true, meta=true`, which is the intended "primary modifier" case. Test `gen.screenshot` in MainLayout.
- **[Risk: Store customization breaks if persist middleware fails]** → If localStorage is corrupted or unavailable, the store falls back to DEFAULT_SHORTCUTS. This is acceptable — the app remains functional with defaults.
- **[Risk: Shortcut conflicts after user customization]** → Users could assign the same combo to multiple actions. The conflict detection in Settings reduces this risk but doesn't prevent it entirely. The first matching shortcut in the iteration order wins.
