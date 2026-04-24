## ADDED Requirements

### Requirement: Command palette opens with the primary shortcut
The system SHALL open the command palette when the user presses the platform primary command-palette shortcut: `Ctrl+K` on Linux and Windows, and `Cmd+K` on macOS. This requirement applies to supported desktop Tauri builds and web/dev builds where the app shell owns keyboard handling.

#### Scenario: Ctrl+K opens the palette on Linux
- **GIVEN** the app is focused on Linux
- **AND** focus is not inside an editable text field
- **WHEN** the user presses `Ctrl+K`
- **THEN** the command palette SHALL open

#### Scenario: Ctrl+K opens the palette on Windows
- **GIVEN** the app is focused on Windows
- **AND** focus is not inside an editable text field
- **WHEN** the user presses `Ctrl+K`
- **THEN** the command palette SHALL open

#### Scenario: Cmd+K opens the palette on macOS
- **GIVEN** the app is focused on macOS
- **AND** focus is not inside an editable text field
- **WHEN** the user presses `Cmd+K`
- **THEN** the command palette SHALL open

### Requirement: Command palette open shortcut uses an idempotent open event
All command-palette keyboard shortcut paths SHALL dispatch the shared `command-palette-open` event rather than directly toggling palette state. Native shortcut, app-shell keydown, and viewer bridge paths SHALL converge on this event.

#### Scenario: Duplicate handlers do not close the palette
- **GIVEN** multiple shortcut fallback paths are registered
- **WHEN** the user presses the platform command-palette shortcut
- **THEN** the app SHALL dispatch an open action
- **AND** the command palette SHALL remain open instead of toggling closed

### Requirement: Native fallback preserves cross-platform delivery
When a supported desktop WebView runtime intercepts the platform command-palette shortcut before the JavaScript keydown handler can receive it, the native Tauri shortcut or menu accelerator path SHALL dispatch the same `command-palette-open` event to the frontend.

#### Scenario: WebView interception is bypassed by native fallback
- **GIVEN** a packaged desktop build where the WebView does not deliver the platform command-palette shortcut to JavaScript
- **WHEN** the user presses `Ctrl+K` on Linux or Windows, or `Cmd+K` on macOS
- **THEN** the native shortcut or menu accelerator path SHALL notify the frontend
- **AND** the command palette SHALL open through `command-palette-open`

### Requirement: Command palette shortcut works from reader surfaces
The command-palette keyboard shortcut SHALL work while focus is in app-controlled reader surfaces, including document viewers and same-origin embedded reader frames where the app can install a keydown bridge.

#### Scenario: Shortcut opens from a document viewer
- **GIVEN** a document viewer is focused
- **AND** focus is not inside an editable text field
- **WHEN** the user presses the platform command-palette shortcut
- **THEN** the command palette SHALL open

#### Scenario: Shortcut opens from an embedded same-origin frame
- **GIVEN** a same-origin embedded reader frame has focus
- **AND** the app has installed a shortcut bridge in that frame
- **WHEN** the user presses the platform command-palette shortcut
- **THEN** the parent app command palette SHALL open

### Requirement: Command palette shortcut does not hijack text entry
The command-palette keyboard shortcut SHALL NOT open the palette when focus is inside `input`, `textarea`, `select`, or contenteditable elements.

#### Scenario: Ctrl+K is ignored in a text input
- **GIVEN** focus is inside a text input
- **WHEN** the user presses `Ctrl+K`
- **THEN** the command palette SHALL NOT open
- **AND** the input SHALL keep normal text-editing behavior

#### Scenario: Cmd+K is ignored in a contenteditable element
- **GIVEN** focus is inside a contenteditable element on macOS
- **WHEN** the user presses `Cmd+K`
- **THEN** the command palette SHALL NOT open
