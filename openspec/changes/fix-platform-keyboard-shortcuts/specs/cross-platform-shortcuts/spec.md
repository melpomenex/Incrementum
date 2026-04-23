## ADDED Requirements

### Requirement: Global shortcuts fire on all platforms
The Tauri `global-shortcut` plugin SHALL successfully register and fire callbacks for all 9 defined shortcuts (Ctrl/Cmd+K, P, comma, D, Q, R, O, N, slash) on Windows, macOS, and Linux. Registration failures SHALL be logged at `warn` level with the specific error message.

#### Scenario: Ctrl+K fires on Windows
- **WHEN** user presses Ctrl+K on Windows with the app focused
- **THEN** the Rust `on_shortcuts` callback SHALL fire with `Code::KeyK`
- **THEN** a `"global-shortcut"` event SHALL be emitted to the frontend
- **THEN** the Command Palette SHALL open

#### Scenario: Cmd+K fires on macOS
- **WHEN** user presses Cmd+K on macOS with the app focused
- **THEN** the Rust `on_shortcuts` callback SHALL fire with `Code::KeyK`
- **THEN** a `"global-shortcut"` event SHALL be emitted to the frontend
- **THEN** the Command Palette SHALL open

#### Scenario: Ctrl+K fires on Linux
- **WHEN** user presses Ctrl+K on Linux with the app focused
- **THEN** the Rust `on_shortcuts` callback SHALL fire with `Code::KeyK`
- **THEN** the Command Palette SHALL open

### Requirement: All navigation shortcuts work on Windows and macOS
All 9 keyboard shortcuts SHALL trigger their associated actions on Windows (Ctrl+key) and macOS (Cmd+key): K/P open command palette, comma opens settings, D opens dashboard, Q opens queue, R starts review, O/N open document import, slash shows shortcuts help.

#### Scenario: All shortcuts work on Windows
- **WHEN** user presses each of Ctrl+K, Ctrl+P, Ctrl+,, Ctrl+D, Ctrl+Q, Ctrl+R, Ctrl+O, Ctrl+N, Ctrl+/ on Windows
- **THEN** each shortcut SHALL trigger its corresponding action

#### Scenario: All shortcuts work on macOS
- **WHEN** user presses each of Cmd+K, Cmd+P, Cmd+,, Cmd+D, Cmd+Q, Cmd+R, Cmd+O, Cmd+N, Cmd+/ on macOS
- **THEN** each shortcut SHALL trigger its corresponding action

### Requirement: Event delivery from Rust to JavaScript is reliable
When the Rust global-shortcut callback fires, the emitted `"global-shortcut"` event SHALL reach the JavaScript event listener in `App.tsx` within the same event loop tick. The event payload SHALL contain the `Code` enum string (e.g., `"KeyK"`, `"KeyQ"`).

#### Scenario: Event payload format
- **WHEN** the global shortcut for Ctrl+K fires
- **THEN** the JS listener SHALL receive `event.payload` equal to `"KeyK"`

### Requirement: Shortcuts do not interfere with text input
Keyboard shortcuts SHALL NOT fire when the user is typing in an input field, textarea, select element, or contentEditable element.

#### Scenario: Shortcuts ignored in input fields
- **WHEN** user presses Ctrl+K while focused on a text input
- **THEN** the shortcut SHALL NOT trigger
- **THEN** the text input SHALL behave normally
