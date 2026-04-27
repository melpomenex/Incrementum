## Context

The app currently has multiple command palette activation paths:

1. A capture-phase JavaScript keydown fallback in `src/App.tsx`.
2. Store-driven/global JavaScript shortcut handling in `src/App.tsx`.
3. Tauri `tauri-plugin-global-shortcut` registrations in `src-tauri/src/lib.rs`.
4. Native menu accelerator fallbacks in `src-tauri/src/lib.rs`.
5. Viewer/iframe bridges that may forward keydown events when focus is inside rendered document content.

The failure is specifically that dev mode works while a CI-built release artifact does not. That points to a packaged-runtime difference: WebView accelerator handling, global shortcut registration timing, menu construction, frontend listener readiness, or packaging scripts stripping or changing something needed by the native fallback.

## Decisions

### Treat packaged artifacts as acceptance criteria

The implementation is not complete until the shortcut is verified in release artifacts, not only `npm run tauri dev`. For Linux this means the CI-built AppImage. For Windows/macOS this means the produced desktop artifact or the closest CI artifact available in the release workflow.

### Keep one frontend open event

All successful shortcut paths SHALL dispatch or result in `command-palette-open`. The command palette component remains responsible for updating its open state. This avoids separate native and JavaScript paths drifting over time.

### Instrument each layer before changing behavior

Add durable debug-level diagnostics around:

- native shortcut registration success/failure;
- native shortcut callback execution;
- menu accelerator callback execution;
- frontend `"global-shortcut"` event receipt;
- frontend `command-palette-open` event handling.

Diagnostics should be quiet in normal use but available in release artifact logs so failures can be localized without guessing.

### Prefer native delivery for packaged builds

JavaScript capture-phase handling is useful when keydown events reach the WebView, but packaged WebViews can consume accelerator keys before JavaScript receives them. Packaged builds should have a native delivery path for `Ctrl/Cmd+K` that works even when the WebView consumes the keydown.

### Preserve editable-field behavior

The frontend path must continue to ignore editable targets. Native paths cannot always know the focused DOM node, so native shortcut delivery must either ask the frontend to decide or emit through a frontend handler that checks focus before opening.

## Risks

- Native global shortcuts can conflict with OS or desktop environment reservations. `Ctrl+K` and `Cmd+K` are not normally system-reserved, but platform-specific behavior must be verified.
- Linux AppImage runtime differences can hide errors that are not visible in dev mode. Release verification needs to exercise the actual AppImage, not just `tauri build`.
- Some CI environments may not support real key injection into GUI apps. In that case the smoke test should at minimum assert registration/event-path health and leave a documented manual artifact test.
