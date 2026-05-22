## ADDED Requirements

### Requirement: New tab command
The system SHALL provide a `:tabnew` (aliases: `:tabn`, `:tn`) colon command that opens a new dashboard tab in the current pane.

#### Scenario: Open new tab
- **WHEN** user types `:tabnew` and presses Enter
- **THEN** a new dashboard tab is created and focused in the current pane

#### Scenario: New tab with optional type
- **WHEN** user types `:tabnew documents`
- **THEN** a new tab of the specified type is created instead of dashboard

### Requirement: Close tab command
The system SHALL provide a `:tabclose` (aliases: `:tabc`, `:tc`) colon command that closes the currently active tab.

#### Scenario: Close active tab
- **WHEN** user types `:tabc` and presses Enter
- **THEN** the currently active tab is closed

#### Scenario: No tabs open
- **WHEN** user types `:tabc` with no tabs
- **THEN** no action is taken (no error)

### Requirement: Close other tabs command
The system SHALL provide a `:tabonly` (aliases: `:tabo`, `:to`) colon command that closes all tabs except the currently active one.

#### Scenario: Multiple tabs open
- **WHEN** user types `:tabonly` with 5 tabs open
- **THEN** all tabs except the active one are closed

#### Scenario: Single tab already
- **WHEN** user types `:tabonly` with only one tab
- **THEN** no action is taken

### Requirement: Move tab command
The system SHALL provide a `:tabmove` (aliases: `:tabm`, `:tm`) colon command that moves the current tab to a specified position (0-indexed).

#### Scenario: Move to first position
- **WHEN** user types `:tabmove 0`
- **THEN** the active tab moves to the first position in the tab bar

#### Scenario: Move to last position
- **WHEN** user types `:tabmove $` or `:tabmove -1`
- **THEN** the active tab moves to the last position

#### Scenario: Move to middle position
- **WHEN** user types `:tabmove 3`
- **THEN** the active tab moves to index 3 (0-based)

#### Scenario: No argument
- **WHEN** user types `:tabmove` with no argument
- **THEN** the active tab moves one position to the right (wraps)

### Requirement: Close tabs to right command
The system SHALL provide a `:tabclose-right` (alias: `:tcr`) colon command that closes all tabs to the right of the active tab.

#### Scenario: Tabs to the right exist
- **WHEN** user types `:tcr` with tabs on both sides of the active tab
- **THEN** only tabs to the right are closed

### Requirement: Reopen last closed tab command
The system SHALL provide a `:tabreopen` (alias: `:topen`) colon command that reopens the most recently closed tab.

#### Scenario: Reopen after close
- **WHEN** user types `:topen` after closing a tab
- **THEN** the previously closed tab is restored with its content intact

#### Scenario: No closed tab history
- **WHEN** user types `:topen` with no closed tab history
- **THEN** no action is taken
