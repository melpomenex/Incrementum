## ADDED Requirements

### Requirement: Unified Schedule Toolbar
The system SHALL provide a unified toolbar that consolidates all schedule-related actions and view toggles.

#### Scenario: Toolbar layout
- **WHEN** viewing the Schedule page
- **THEN** a single toolbar row contains the view mode toggle (Cards/Table), the "Spread Overloaded" action, and active filters.

### Requirement: Integrated Spreading Action
The "Spread Overloaded" action SHALL be easily accessible from the primary toolbar and context-aware.

#### Scenario: Triggering spread from toolbar
- **WHEN** the user clicks "Spread Overloaded" in the toolbar
- **THEN** the spread modal opens targeting the most overloaded day in the upcoming forecast.

### Requirement: Integrated View Toggle
The toggle between "Card" and "Table" view modes SHALL be located in the primary schedule toolbar.

#### Scenario: Switching view modes
- **WHEN** the user clicks "Table" in the toolbar view toggle
- **THEN** the schedule list immediately switches to the dense table view.
