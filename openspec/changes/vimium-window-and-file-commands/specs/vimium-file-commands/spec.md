## ADDED Requirements

### Requirement: Edit/open document command
The system SHALL provide a `:edit` (aliases: `:e`, `:open`) colon command that opens the document search with a pre-filled query. When a document is selected from search results, it opens in a new tab.

#### Scenario: Search and open document
- **WHEN** user types `:edit machine learning` and presses Enter
- **THEN** the command center opens with "machine learning" as the search query, filtered to documents

#### Scenario: No query provided
- **WHEN** user types `:e` with no arguments and presses Enter
- **THEN** the command center opens in general search mode (same as Ctrl+K)

#### Scenario: Exact match found
- **WHEN** user types `:e` with a query that exactly matches a single document title
- **THEN** that document opens directly in a new tab without showing the command center

### Requirement: Close buffer command
The system SHALL provide a `:bdelete` (aliases: `:bd`, `:bclose`) colon command that closes the current tab/viewer, analogous to Vim's buffer close.

#### Scenario: Close current buffer
- **WHEN** user types `:bd` and presses Enter
- **THEN** the currently active tab is closed (same behavior as `:tabclose`)

#### Scenario: Close specific buffer by name
- **WHEN** user types `:bdelete documents` or `:bd analytics`
- **THEN** the first tab matching the given type name is closed

### Requirement: List open buffers command
The system SHALL provide a `:buffers` (aliases: `:ls`, `:files`) colon command that displays a list of all open tabs in the current pane.

#### Scenario: List buffers
- **WHEN** user types `:ls` and presses Enter
- **THEN** a list of open tabs is displayed in the command bar dropdown, showing tab index, type, and title
