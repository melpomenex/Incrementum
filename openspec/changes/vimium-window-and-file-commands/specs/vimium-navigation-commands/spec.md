## ADDED Requirements

### Requirement: Jump to section command
The system SHALL provide a `:jump` (aliases: `:j`, `:cd`) colon command that navigates to a named app section by opening the corresponding tab type.

#### Scenario: Jump to known section
- **WHEN** user types `:jump documents` or `:j queue`
- **THEN** a tab of the specified type is opened and focused; if one already exists in the current pane, it is activated instead of creating a duplicate

#### Scenario: Invalid section name
- **WHEN** user types `:j foobar`
- **THEN** a toast message lists valid section names (dashboard, documents, queue, review, analytics, settings, etc.)

#### Scenario: Section aliases
- **WHEN** user types `:j dash` or `:j docs`
- **THEN** common aliases resolve correctly (dash → dashboard, docs → documents, rev → review, set → settings, anal → analytics)

### Requirement: Recently viewed documents command
The system SHALL provide a `:recent` (aliases: `:r`, `:history`) colon command that shows recently viewed documents and allows opening one.

#### Scenario: Show recent documents
- **WHEN** user types `:recent` with no arguments
- **THEN** the command bar shows a dropdown list of recently viewed documents (title + type), most recent first

#### Scenario: Open recent by index
- **WHEN** user types `:recent 3`
- **THEN** the 3rd most recently viewed document opens in a new tab

### Requirement: Focus pane command
The system SHALL provide a `:focus` (aliases: `:fo`) colon command that moves focus between split panes.

#### Scenario: Cycle focus
- **WHEN** user types `:focus` with no arguments
- **THEN** focus moves to the next pane (cycles through panes)

#### Scenario: Focus specific pane
- **WHEN** user types `:focus left` or `:focus right` or `:focus up` or `:focus down`
- **THEN** focus moves to the pane in the specified direction

### Requirement: Zoom/focus mode command
The system SHALL provide a `:zen` (alias: `:z`) colon command that toggles a distraction-free mode hiding all chrome except the content area.

#### Scenario: Enter zen mode
- **WHEN** user types `:zen` and zen mode is off
- **THEN** the sidebar, tab bar, and status bar are hidden; only the content area remains visible

#### Scenario: Exit zen mode
- **WHEN** user types `:zen` and zen mode is on
- **THEN** the normal UI layout is restored
