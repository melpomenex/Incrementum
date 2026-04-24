## Context

The current app contains several command-palette activation paths:

- `App.tsx` capture-phase keydown prevention for global shortcuts.
- `App.tsx` Tauri `"global-shortcut"` listener mapping `KeyK`/`KeyP` to `command-palette-open`.
- `App.tsx` direct capture-phase fallback for `Ctrl/Cmd+K` and `Ctrl/Cmd+P`.
- `App.tsx` broader global shortcut handler that also opens the palette.
- `CommandCenter.tsx` listens for `command-palette-open` and sets `commandPaletteOpen` in the UI store.
- Some viewers add iframe/window-specific bridges so `Ctrl/Cmd+K` can work while reading.

That redundancy makes the desired behavior fragile. The fix should not add another unrelated listener unless it covers a proven delivery gap. The acceptance target is narrow and explicit: `Ctrl+K` opens the command palette on Linux and Windows, and `Cmd+K` opens it on macOS.

## Goals / Non-Goals

Goals:

- `Ctrl+K` opens the command palette on Linux and Windows.
- `Cmd+K` opens the command palette on macOS.
- The shortcut works in both dev and packaged Tauri builds, or the packaged-build exception is documented with a native fallback task.
- `Ctrl/Cmd+P` remains an alternate command-palette shortcut if currently supported.
- All activation paths converge on the same custom event and store mutation.
- Shortcuts are ignored while the user is typing in editable fields.
- The failure mode is observable through debug logs during manual packaged-app testing on each desktop platform.

Non-Goals:

- Redesigning the command palette UI or search behavior.
- Changing command-palette result ranking, navigation, or document-hit behavior.
- Reworking unrelated navigation shortcuts like queue/dashboard/review unless required by shared infrastructure.
- Adding user-customizable shortcut settings.

## Proposed Approach

1. Introduce or identify one small shared helper for detecting the command-palette open shortcut from a `KeyboardEvent`.
2. Use the helper from the app-shell handler and any viewer/iframe bridge handlers to avoid divergent `Ctrl`, `Meta`, `Shift`, and editable-target logic.
3. Keep `CommandCenter.tsx` as the only component that mutates `commandPaletteOpen` in response to `command-palette-open`.
4. Remove duplicate raw `Ctrl/Cmd+K` handlers that directly toggle palette state, or convert them to dispatch the shared event.
5. For packaged Tauri builds on Linux, Windows, and macOS, verify whether JavaScript receives the platform shortcut; if not, route the native Tauri global shortcut/menu accelerator path to the same event payload.

## Risks / Trade-offs

- **Risk: WebView interception differs by package/runtime.** A dev browser can pass `Ctrl/Cmd+K` while Linux WebKitGTK, Windows WebView2, or macOS WKWebView may intercept it in packaged builds. Mitigation: include packaged verification for each desktop OS and keep the Tauri native fallback if JS delivery is unreliable.
- **Risk: iframes do not bubble keydown events to the parent document.** Mitigation: keep viewer-specific iframe bridges, but require them to dispatch the same shared event instead of opening palette state directly.
- **Risk: duplicate handlers could open and immediately close the palette if one toggles and another opens.** Mitigation: use an idempotent open event for the shortcut, not a toggle event.
