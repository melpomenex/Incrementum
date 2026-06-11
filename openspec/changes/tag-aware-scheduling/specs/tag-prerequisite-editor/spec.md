## ADDED Requirements

### Requirement: Tag management view includes prerequisite editor
The tag management view SHALL provide a multi-select component that allows users to pick prerequisite tags for the currently selected tag. The list SHALL include all other tags in the system and SHALL exclude the current tag itself. Prerequisites SHALL be saved via the `set_tag_prerequisites` Tauri command.

#### Scenario: User adds a prerequisite to a tag
- **WHEN** the user selects tag `calculus.derivatives`, opens the prerequisite picker, selects `calculus.limits`, and confirms
- **THEN** `calculus.derivatives`'s prerequisites SHALL be updated to include `calculus.limits`

#### Scenario: User removes a prerequisite
- **WHEN** the user deselects a currently-set prerequisite tag and confirms
- **THEN** the prerequisite SHALL be removed from the tag

#### Scenario: Current tag excluded from prerequisite options
- **WHEN** the user opens the prerequisite picker for tag `calculus.limits`
- **THEN** `calculus.limits` SHALL NOT appear in the list of selectable prerequisites

#### Scenario: Circular dependency rejected with feedback
- **WHEN** the user attempts to set tag `A` as prerequisite of tag `B`, and tag `B` is already a prerequisite of tag `A`
- **THEN** the system SHALL display an error message explaining the circular dependency and SHALL NOT save

### Requirement: Prerequisite dependency graph is visualized
The system SHALL render a directed graph of tag prerequisite relationships in the tag management view. Tags SHALL be displayed as nodes and prerequisites as directed edges. The visualization SHALL reuse the existing graph renderer with a filtered view. The graph SHALL update when prerequisites are modified.

#### Scenario: Graph shows directed edges
- **WHEN** tag `B` has prerequisite `A`, and tag `C` has prerequisite `B`
- **THEN** the graph SHALL show directed edges from `A` → `B` and `B` → `C`

#### Scenario: Graph updates after prerequisite change
- **WHEN** the user adds a new prerequisite and saves
- **THEN** the graph SHALL immediately reflect the new edge

### Requirement: Tag maturity progress is displayed per tag
Each tag in the management view SHALL display a maturity progress indicator showing the ratio of mature items. The indicator SHALL include a progress bar and a text label showing `matureCount / itemCount`. A tag with zero items SHALL display "N/A".

#### Scenario: Progress bar shows maturity ratio
- **WHEN** a tag has 7 mature items out of 10 total
- **THEN** the progress bar SHALL be filled at 70% and the label SHALL show "7 / 10"

#### Scenario: Empty tag shows N/A
- **WHEN** a tag has 0 items
- **THEN** the maturity indicator SHALL display "N/A"
