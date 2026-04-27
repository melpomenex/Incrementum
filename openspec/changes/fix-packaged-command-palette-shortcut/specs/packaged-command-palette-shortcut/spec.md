## ADDED Requirements

### Requirement: Command palette shortcut works in dev and packaged builds

The app SHALL open the command palette when the user presses the platform primary command palette shortcut in both `npm run tauri dev` and packaged desktop builds.

#### Scenario: Linux AppImage opens command palette

- **GIVEN** the user is running a CI-built Linux AppImage
- **WHEN** the user presses `Ctrl+K` outside editable text fields
- **THEN** the command palette SHALL open

#### Scenario: Windows package opens command palette

- **GIVEN** the user is running a packaged Windows desktop build
- **WHEN** the user presses `Ctrl+K` outside editable text fields
- **THEN** the command palette SHALL open

#### Scenario: macOS package opens command palette

- **GIVEN** the user is running a packaged macOS desktop build
- **WHEN** the user presses `Cmd+K` outside editable text fields
- **THEN** the command palette SHALL open

#### Scenario: Dev mode matches packaged behavior

- **GIVEN** the user is running `npm run tauri dev`
- **WHEN** the user presses the platform command palette shortcut outside editable text fields
- **THEN** the command palette SHALL open using the same frontend open event as packaged builds

### Requirement: Native packaged shortcut delivery is observable

Packaged desktop builds SHALL expose debug-level diagnostics sufficient to determine whether command palette shortcut handling reached native registration, native callback execution, frontend event receipt, and command palette open handling.

#### Scenario: Native registration failure is visible

- **WHEN** a packaged build cannot register the platform command palette shortcut
- **THEN** the failure SHALL be logged with the platform, shortcut, and error message

#### Scenario: Native shortcut reaches frontend

- **WHEN** a native packaged-build shortcut callback fires for the command palette shortcut
- **THEN** the main webview SHALL receive an event that routes to `command-palette-open`

### Requirement: Editable fields are not hijacked

The command palette shortcut SHALL NOT open the command palette while the user is typing in editable fields.

#### Scenario: Text input keeps keyboard focus behavior

- **GIVEN** focus is inside an input, textarea, select, or contenteditable element
- **WHEN** the user presses the platform command palette shortcut
- **THEN** the command palette SHALL NOT open
- **AND** the editable field SHALL retain normal keyboard behavior

### Requirement: Release verification covers packaged artifacts

The release process SHALL include verification for the platform command palette shortcut against packaged desktop artifacts or document a manual verification step when automated GUI key injection is unavailable.

#### Scenario: CI artifact verification prevents release regression

- **WHEN** a release artifact is produced for Linux, Windows, or macOS
- **THEN** the command palette shortcut behavior SHALL be verified for that artifact before the release is considered complete
