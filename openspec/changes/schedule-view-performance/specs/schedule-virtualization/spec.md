## ADDED Requirements

### Requirement: Schedule item list SHALL use windowed virtualization
The Schedule view SHALL render items using a windowed virtualizer (`@tanstack/react-virtual`) so that only items within or near the viewport are mounted as DOM nodes. This SHALL apply to both the table view mode and the cards view mode.

#### Scenario: Schedule view with 1000+ items renders without lag
- **WHEN** the Schedule view loads with 1000 or more items
- **THEN** the initial render SHALL complete within 200ms and the view SHALL remain responsive (no jank >16ms frames) during scroll

#### Scenario: Scrolling through schedule items
- **WHEN** the user scrolls through the Schedule item list
- **THEN** only visible items (plus a small overscan buffer) SHALL be rendered as DOM nodes

### Requirement: Virtualized list SHALL preserve date section grouping
The virtualized list SHALL interleave date section headers with item rows so that date grouping is visually preserved during scrolling.

#### Scenario: Date headers appear at correct positions during scroll
- **WHEN** the user scrolls past items from one date group into the next
- **THEN** the next date section header SHALL appear at the top of its items, maintaining the grouped layout

### Requirement: Table header SHALL remain fixed
In table view mode, the column headers (`<thead>`) SHALL remain fixed at the top of the table area and not scroll with the virtualized rows.

#### Scenario: Table header stays visible while scrolling
- **WHEN** the user scrolls through table rows
- **THEN** the column header row SHALL remain fixed at the top of the table container

### Requirement: Expanded row state SHALL be preserved during virtualization
When a user expands a row to view algorithm stats, that row's expanded state SHALL be preserved as the virtualizer scrolls it out of and back into view.

#### Scenario: Expanded row remains expanded after scrolling away and back
- **WHEN** a user expands an item row, scrolls it out of view, then scrolls it back into view
- **THEN** the row SHALL still be expanded showing the algorithm stats detail

### Requirement: Actions after single-item mutations SHALL skip forecast re-fetch
Postpone, suspend, unsuspend, delete, and dismiss actions SHALL only re-fetch the queue data, NOT the workload forecast. Only the spread action SHALL re-fetch both.

#### Scenario: Postpone action does not re-fetch forecast
- **WHEN** a user postpones a schedule item
- **THEN** the system SHALL call `reloadItems()` (queue only) and NOT call `loadData()` (queue + forecast)
