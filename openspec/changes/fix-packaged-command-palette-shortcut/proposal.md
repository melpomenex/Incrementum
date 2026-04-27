## Why

The command palette opens with `Ctrl+K` when running `npm run tauri dev`, but the same shortcut does not open the palette in CI-built release artifacts. The reported failure is in Linux AppImages, and the behavior used to work, which means users can no longer rely on the primary navigation/search shortcut after installing a released build.

Previous shortcut fixes added JavaScript capture handlers, Tauri global shortcuts, and native menu accelerator fallbacks, but the release artifact still regressed for at least several versions. The fix needs to treat packaged builds as the source of truth, not just dev mode.

## What Changes

- Make command palette activation a cross-platform packaged-build contract:
  - Linux: `Ctrl+K`
  - Windows: `Ctrl+K`
  - macOS: `Cmd+K`
- Diagnose why CI-built artifacts diverge from `tauri dev`, including native shortcut registration, menu accelerators, event emission to the frontend, and packaging/runtime differences.
- Ensure every delivery path routes through the shared `command-palette-open` event so the command palette owner remains the single source of state changes.
- Add automated regression coverage where feasible for shortcut matching, event dispatch, and packaged-build smoke verification.
- Add release verification steps for GitHub Actions artifacts so `Ctrl/Cmd+K` is tested in the same artifact type users download.
- Preserve text-entry behavior: the shortcut must not fire while focus is inside editable fields.

## Capabilities

### New Capabilities

- `packaged-command-palette-shortcut`: Reliable command palette keyboard activation in dev and packaged desktop builds on Linux, Windows, and macOS.

### Modified Capabilities

<!-- None. Existing shortcut changes are incomplete or broader than this packaged-build regression. -->

## Impact

- **Frontend**: `src/App.tsx`, `src/utils/commandPaletteShortcut.ts`, command palette event wiring/tests.
- **Tauri/Rust**: `src-tauri/src/lib.rs` native shortcut, menu accelerator, and event delivery paths.
- **Packaging/CI**: GitHub Actions desktop build workflows and AppImage/Windows/macOS artifact smoke checks.
- **Tests**: unit tests for shortcut matching and event dispatch; CI or scripted smoke checks for packaged artifacts where available.
- **User-facing**: Pressing the platform command palette shortcut opens the palette consistently in installed/released apps, matching dev mode.
