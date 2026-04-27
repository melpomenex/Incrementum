## ADDED Requirements

### Requirement: All top-level shortcut combos registered natively

The Rust backend (`src-tauri/src/lib.rs`) SHALL register every top-level keyboard shortcut combo from `DEFAULT_SHORTCUTS` that uses `Ctrl` or `Cmd` as a modifier, so the webview does not intercept them before JavaScript receives the event.

#### Scenario: Native registration for Ctrl+Shift+F
- **WHEN** the Tauri application starts
- **THEN** `Ctrl+Shift+F` and `Cmd+Shift+F` are registered as native global shortcuts in addition to the existing 9 combos

#### Scenario: Native registration for Ctrl+B
- **WHEN** the Tauri application starts
- **THEN** `Ctrl+B` and `Cmd+B` are registered as native global shortcuts

#### Scenario: Native registration for Ctrl+Shift+S
- **WHEN** the Tauri application starts
- **THEN** `Ctrl+Shift+S` and `Cmd+Shift+S` are registered as native global shortcuts

### Requirement: Native shortcut events handled in App.tsx

The Tauri `global-shortcut` event listener in `App.tsx` SHALL handle all newly registered native shortcut keys by dispatching the same action as the JavaScript `SHORTCUT_ACTION_HANDLERS` map.

#### Scenario: Native Ctrl+Shift+F triggers flashcard studio
- **WHEN** the Tauri backend emits `global-shortcut` with key `"KeyF"` (and the event was triggered by a Ctrl+Shift+F combo)
- **THEN** the App.tsx listener dispatches the same action as the JS handler for `edit.new-flashcard`

#### Scenario: Native Ctrl+B triggers sidebar toggle
- **WHEN** the Tauri backend emits `global-shortcut` with key `"KeyB"`
- **THEN** the App.tsx listener dispatches the same action as the JS handler for `view.sidebar`

#### Scenario: Native Ctrl+Shift+S triggers screenshot
- **WHEN** the Tauri backend emits `global-shortcut` with key `"KeyS"` (with Ctrl+Shift or Cmd+Shift modifiers)
- **THEN** the App.tsx listener dispatches the same action as the JS handler for `gen.screenshot`

### Requirement: Graceful fallback when native registration fails

If a native shortcut cannot be registered (platform limitation), the system SHALL log a warning and fall back to the JavaScript-level handler.

#### Scenario: Registration failure logged
- **WHEN** `gs.on_shortcuts()` returns an error for a particular combo
- **THEN** the error is logged via `tracing::warn!` and the application continues with JavaScript-only handling for that shortcut

### Requirement: Native shortcuts use the main window target

All native global shortcut emissions SHALL target the `"main"` window specifically (consistent with existing patterns).

#### Scenario: Event targets main window
- **WHEN** native global shortcut fires
- **THEN** the event is emitted via `app_handle.emit_to("main", "global-shortcut", ...)` (not broadcast)
