## ADDED Requirements

### Requirement: Horizontal split command
The system SHALL provide a `:split` (aliases: `:sp`, `:spl`) colon command that splits the current pane horizontally (side-by-side), duplicating the current tab's content in the new pane.

#### Scenario: Split with no arguments
- **WHEN** user types `:sp` or `:split` and presses Enter
- **THEN** the current pane is split horizontally with the current tab duplicated in the right pane

#### Scenario: Split with tab type argument
- **WHEN** user types `:split documents` or `:sp queue`
- **THEN** a new pane is opened to the right containing the specified tab type

#### Scenario: No active tab
- **WHEN** user types `:sp` with no active tab
- **THEN** the dashboard tab is opened in the new pane

### Requirement: Vertical split command
The system SHALL provide a `:vsplit` (aliases: `:vsp`, `:vs`) colon command that splits the current pane vertically (top-bottom), duplicating the current tab's content in the new pane.

#### Scenario: Vertical split with no arguments
- **WHEN** user types `:vsp` or `:vsplit` and presses Enter
- **THEN** the current pane is split vertically with the current tab duplicated in the bottom pane

#### Scenario: Vertical split with tab type argument
- **WHEN** user types `:vsp documents`
- **THEN** a new pane is opened below containing the specified tab type

### Requirement: Close other panes command
The system SHALL provide a `:only` (alias: `:on`) colon command that collapses all split panes, keeping only the current pane.

#### Scenario: Multiple panes open
- **WHEN** user types `:only` with multiple panes open
- **THEN** all other panes are closed, keeping only the currently focused pane with its tabs intact

#### Scenario: Single pane already
- **WHEN** user types `:only` with only one pane
- **THEN** no action is taken (no error)

### Requirement: Swap pane command
The system SHALL provide a `:swap` (alias: `:sw`) colon command that swaps the content of the current pane with the adjacent pane.

#### Scenario: Swap with adjacent pane
- **WHEN** user types `:swap` in a horizontally split layout
- **THEN** the left and right pane contents are swapped

#### Scenario: No adjacent pane
- **WHEN** user types `:swap` with only one pane
- **THEN** no action is taken (no error)
