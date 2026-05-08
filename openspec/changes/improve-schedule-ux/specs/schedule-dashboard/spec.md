## ADDED Requirements

### Requirement: Unified Schedule Dashboard
The system SHALL provide a unified dashboard component that integrates workload forecasting and summary statistics into a single visual area.

#### Scenario: Dashboard displays combined data
- **WHEN** the Schedule view is loaded
- **THEN** a single dashboard area shows both the 14-day workload timeline and the key summary metrics (Total, Due Today, Overdue, Avg).

### Requirement: Interactive Workload Selection
The dashboard SHALL allow users to select specific days from the workload timeline to filter the schedule items list.

#### Scenario: Selecting a day filters the list
- **WHEN** a user clicks on a date cell in the workload timeline
- **THEN** the schedule items list is filtered to show only items due on that specific date.
- **AND** the date cell is visually highlighted.

### Requirement: Collapsible Dashboard
The dashboard area SHALL be collapsible to allow users to hide analytics and focus on the item list/table.

#### Scenario: Toggling dashboard visibility
- **WHEN** the user clicks the collapse toggle button
- **THEN** the dashboard area is hidden, and the item list/table expands to fill the available vertical space.
- **AND** the toggle state is persisted.
