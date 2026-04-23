## Context

The app has three layers of keyboard shortcut handling:

1. **Tauri/Rust global shortcuts** (`lib.rs:206-248`): Registers shortcuts via `tauri-plugin-global-shortcut` using `Modifiers::CONTROL` (Windows/Linux) and `Modifiers::SUPER` (macOS). Emits `"global-shortcut"` events to the frontend.
2. **Capture-phase preventDefault** (`App.tsx:188-211`): Intercepts keydown events in the capture phase and calls `preventDefault()` on Ctrl+key combos to stop the WebView from handling them first.
3. **Bubble-phase JS handler** (`App.tsx:261-334`): Handles the actual shortcut logic by listening for keydown events and checking modifier + key combinations.

Previous work (`fix-keyboard-shortcuts` change) fixed Linux (webkit2gtk) interception issues. But Windows and macOS remain broken.

**Root cause analysis for Windows (WebView2)**:
- WebView2 reserves Ctrl+K (opens Edge sidebar), Ctrl+N (new window), Ctrl+P (print dialog), Ctrl+R (refresh), Ctrl+T (new tab), etc. These are intercepted by the WebView2 chrome before JavaScript or the Tauri global shortcut plugin can handle them.
- The Tauri `global-shortcut` plugin registers OS-level shortcuts, which *should* fire before WebView2. However, there may be a registration order issue: if the WebView2 window is focused and has already processed the accelerator, the global shortcut may not fire, or the WebView2 may re-intercept after the global shortcut fires.
- The `Modifiers::CONTROL` registrations should work for Ctrl+key combos on Windows. If they don't, the issue is likely that WebView2 is eating the events before the global shortcut plugin processes them, or the plugin's `on_shortcuts` callback is firing but the JS listener isn't receiving the emitted event.

**Root cause analysis for macOS (WKWebView)**:
- `Modifiers::SUPER` maps to the Cmd key on macOS. WKWebView also reserves many Cmd+key combos (Cmd+K for search in many contexts, Cmd+N, Cmd+P, etc.).
- macOS has an additional complication: the app's `Info.plist` or menu bar can register accelerators that intercept before both JS and global shortcuts.

**Key insight**: The existing code registers shortcuts correctly at the Tauri level, and the JS fallback handler is also correct. The most likely failure modes are:
1. The global shortcut plugin's `on_shortcuts` is silently failing on Windows/macOS (error is logged but not surfaced)
2. The emitted `"global-shortcut"` event isn't reaching the JS listener (app handle vs. window scope)
3. WebView2/WKWebView is intercepting events after the global shortcut fires but re-triggering default behavior

## Goals / Non-Goals

**Goals:**
- All 9 shortcuts (K, P, comma, D, Q, R, O, N, slash) work on Windows, macOS, and Linux
- Command Palette opens with Ctrl+K (Windows/Linux) and Cmd+K (macOS)
- Fix is minimal and doesn't break existing Linux functionality

**Non-Goals:**
- Redesigning the shortcut system architecture
- Adding new shortcuts
- Making shortcuts customizable per-platform
- Handling shortcuts while focused in input fields (already correctly excluded)

## Decisions

### 1. Add diagnostic logging to determine actual failure mode

**Decision**: Before making changes, add `tracing::info!` logging in the `on_shortcuts` callback on Rust side and `console.log` in the JS `global-shortcut` listener to confirm whether:
- Rust global shortcuts are actually being registered (no error from `on_shortcuts`)
- The callback fires when keys are pressed
- The emitted event reaches the JS listener

**Rationale**: Without knowing whether the failure is at the Rust registration, event emission, or JS reception layer, any fix would be a guess. A minimal diagnostic step saves time.

### 2. If global shortcuts don't fire: add `app.on_menu_event` or window-level accelerator as alternative

**Decision**: If diagnostics confirm the `tauri-plugin-global-shortcut` doesn't fire on Windows/macOS, use Tauri's built-in menu accelerator system or window-level `on_menu_event` as an alternative path. Tauri menus can register accelerators that fire before WebView processes events.

**Rationale**: Tauri's menu system has tighter integration with the native window event loop than the global-shortcut plugin, which may bypass WebView interception.

### 3. If global shortcuts fire but JS doesn't receive the event: use `app.emit_to` targeting specific windows

**Decision**: If the Rust callback fires but the JS listener doesn't receive the `"global-shortcut"` event, switch from `app_handle.emit()` (broadcasts to all windows including non-webview) to `window.emit()` or `app_handle.emit_to("main", ...)` to target the main webview window specifically.

**Rationale**: `app_handle.emit()` sends to all listeners. On some platforms, the event may be consumed by a non-webview listener or lost. Targeting the specific window ensures delivery.

### 4. Keep the capture-phase preventDefault as defense in depth

**Decision**: The existing capture-phase `preventDefault()` in App.tsx (lines 188-211) remains as-is. It's correct and helps prevent the WebView from processing intercepted shortcuts.

**Rationale**: No change needed. This layer works correctly for shortcuts that do reach JavaScript.

## Risks / Trade-offs

- **[Risk: WebView2 may not allow any override of Ctrl+K]** → If WebView2 truly blocks Ctrl+K at the native level before Tauri's global shortcut plugin, we may need to use a different shortcut (e.g., Ctrl+Shift+K) on Windows. This would be a user-facing change.
- **[Risk: macOS Cmd+key conflicts with system-wide shortcuts]** → Cmd+Q (quit) and Cmd+W (close window) are system-reserved on macOS. Our shortcuts don't use these, so this should be fine.
- **[Risk: Diagnostic logging in production]** → Use `tracing::debug!` or `tracing::info!` at appropriate levels. The logging should be lightweight and not affect performance.
