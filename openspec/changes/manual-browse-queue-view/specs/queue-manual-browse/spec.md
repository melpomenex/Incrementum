## ADDED Requirements

### Requirement: Manual Queue Browsing in Queue View
The system SHALL provide explicit manual browsing of queue items in the Queue View tab, including persistent selection state for the currently browsed item.

#### Scenario: Initial selection on populated queue
- **WHEN** Queue View loads with one or more queue items
- **THEN** the system SHALL show a deterministic selected item for browsing
- **AND** the selection SHALL be represented in the UI using the app's existing selected/focused visual language

#### Scenario: Empty queue state
- **WHEN** Queue View loads with no queue items
- **THEN** the system SHALL render an empty-state message and controls consistent with app UX/UI
- **AND** no browse selection SHALL be active

### Requirement: Keyboard and Pointer Browse Navigation
The system SHALL allow users to move queue selection manually using both pointer interactions and keyboard navigation in Queue View.

#### Scenario: Pointer-driven browse selection
- **WHEN** the user selects a queue item via pointer interaction in Queue View
- **THEN** the selected item SHALL become the active browse selection
- **AND** previously selected item state SHALL be cleared

#### Scenario: Keyboard-driven browse selection
- **WHEN** Queue View has focus and the user issues supported browse navigation keystrokes
- **THEN** the system SHALL move active selection to the adjacent valid queue item
- **AND** the UI SHALL update immediately to reflect the new selected item

#### Scenario: Selection bounds handling
- **WHEN** the user attempts to navigate past the first or last queue item
- **THEN** the system SHALL keep selection within valid queue bounds
- **AND** the system SHALL NOT throw errors or clear selection unexpectedly

### Requirement: Activate Selected Queue Item
The system SHALL allow the user to open or play the currently selected queue item from manual browse selection using existing activation pathways.

#### Scenario: Activation from selected item
- **WHEN** the user activates the selected queue item from Queue View
- **THEN** the system SHALL open or play that specific item using the existing queue activation behavior
- **AND** the activated item SHALL match the current manual browse selection

### Requirement: Selection Continuity During Queue Updates
The system SHALL preserve manual browse context as queue data updates whenever a valid selected item still exists.

#### Scenario: Queue refresh with selected item still present
- **WHEN** queue data refreshes and the selected item is still present
- **THEN** the system SHALL keep that item selected

#### Scenario: Queue refresh removes selected item
- **WHEN** queue data refreshes and the selected item is no longer present
- **THEN** the system SHALL select the nearest valid item by position
- **AND** if no items remain, the system SHALL transition to no-selection empty behavior
