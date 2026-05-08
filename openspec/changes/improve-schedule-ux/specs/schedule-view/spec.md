## MODIFIED Requirements

### Requirement: Schedule View Layout (MODIFIED)
The Schedule view SHALL use a consolidated layout that minimizes vertical "scatter". The workload timeline and summary statistics SHALL be integrated into a single, cohesive dashboard area. Action buttons for spreading and view toggling SHALL be unified into a primary toolbar located at the top of the view.

#### Scenario: Unified header layout
- **WHEN** the Schedule view loads
- **THEN** the title, spread action, and view toggle are all visible in a single header/toolbar row.
- **AND** the dashboard (timeline + stats) is positioned directly below this toolbar.

### Requirement: Schedule Summary Stats (MODIFIED)
System SHALL display summary statistics integrated into the Schedule Dashboard. These stats SHALL be presented in a compact format that complements the workload timeline.

#### Scenario: Compact stats in dashboard
- **WHEN** the dashboard is expanded
- **THEN** it shows "Total", "Due Today", "Overdue", and "7d Avg" in a compact grid alongside the workload timeline.

### Requirement: Schedule Timeline (MODIFIED)
System SHALL display the workload timeline as part of the unified Schedule Dashboard. The timeline SHALL support date selection to filter the item list.

#### Scenario: Timeline in dashboard
- **WHEN** the dashboard is expanded
- **THEN** the 14-day workload intensity cells are visible and interactive.
