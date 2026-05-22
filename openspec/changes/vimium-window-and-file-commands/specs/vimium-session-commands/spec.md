## ADDED Requirements

### Requirement: Close all tabs command
The system SHALL provide a `:qall` (aliases: `:qa`, `:q`) colon command that closes all open tabs across all panes.

#### Scenario: Close all tabs
- **WHEN** user types `:qa` and presses Enter
- **THEN** all tabs in all panes are closed, returning to a single dashboard tab

#### Scenario: Modified documents
- **WHEN** user types `:qa` with unsaved changes in any tab
- **THEN** a confirmation dialog appears asking the user to confirm closing all tabs

### Requirement: Save and close all command
The system SHALL provide a `:wqall` (aliases: `:wqa`, `:xall`, `:xa`) colon command that saves the current session state and closes all tabs.

#### Scenario: Save and close
- **WHEN** user types `:wqa` and presses Enter
- **THEN** the current session state is persisted to localStorage and all tabs are closed, returning to a clean dashboard

### Requirement: Reload app command
The system SHALL provide a `:reload` (aliases: `:rld`) colon command that reloads the entire application.

#### Scenario: Reload application
- **WHEN** user types `:reload` and presses Enter
- **THEN** the webview is reloaded (equivalent to Ctrl+R but accessible from command bar)

### Requirement: Toggle theme command
The system SHALL provide a `:theme` (aliases: `:th`) colon command that toggles between light and dark mode.

#### Scenario: Toggle theme
- **WHEN** user types `:theme` and presses Enter
- **THEN** the app switches between light and dark mode

#### Scenario: Set specific theme
- **WHEN** user types `:theme dark` or `:theme light`
- **THEN** the app switches to the specified theme
