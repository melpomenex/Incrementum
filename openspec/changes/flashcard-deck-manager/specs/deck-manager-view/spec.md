## ADDED Requirements

### Requirement: Deck list with expandable card browser
The system SHALL display all user decks in a scrollable list. Each deck entry SHALL show the deck name, total card count, and due-today count. When a user clicks or expands a deck, the system SHALL reveal a virtualized list of all cards belonging to that deck, filtered by the deck's tag filters.

#### Scenario: Viewing the deck list
- **WHEN** user navigates to the Deck Manager view
- **THEN** all decks are displayed as expandable sections, each showing name, total card count, and due-today count

#### Scenario: Expanding a deck to see cards
- **WHEN** user clicks on a deck section
- **THEN** the deck expands to reveal a scrollable, virtualized list of cards matching the deck's tag filters

#### Scenario: Only one deck expanded at a time
- **WHEN** user expands deck B while deck A is already expanded
- **THEN** deck A collapses and deck B expands, lazy-loading its card list

### Requirement: Compact card rows with stat indicators
Each card in the deck SHALL be displayed as a compact single-line row showing: a color-coded state badge (blue=new, orange=learning, green=review, red=relearning), a truncated question preview (up to 80 characters), the card's current interval, difficulty level, due date, review count, and lapses count.

#### Scenario: Card row displays all key stats
- **WHEN** a card is rendered in the expanded deck list
- **THEN** the row shows state badge, question preview, interval, difficulty, due date, review count, and lapses — all visible without scrolling horizontally

#### Scenario: State badge color coding
- **WHEN** a card has state "new"
- **THEN** the state badge is blue
- **WHEN** a card has state "learning"
- **THEN** the state badge is orange
- **WHEN** a card has state "review"
- **THEN** the state badge is green
- **WHEN** a card has state "relearning"
- **THEN** the state badge is red

### Requirement: Sorting cards within a deck
The system SHALL allow users to sort cards within an expanded deck by: due date (ascending/descending), state, difficulty (ascending/descending), interval (ascending/descending), review count, and lapses.

#### Scenario: Sorting by due date
- **WHEN** user selects "Due Date" sort option
- **THEN** cards are reordered with the earliest due date first (ascending) or latest first (descending)

#### Scenario: Sorting by difficulty
- **WHEN** user selects "Difficulty" sort option
- **THEN** cards are reordered from easiest to hardest (ascending) or hardest to easiest (descending)

### Requirement: Filtering cards within a deck
The system SHALL allow users to filter cards within an expanded deck by: state (new/learning/review/relearning), tag, and due-status (due today, overdue, not due).

#### Scenario: Filtering by state
- **WHEN** user selects the "Review" state filter
- **THEN** only cards with state "review" are shown in the card list

#### Scenario: Filtering by due status
- **WHEN** user selects "Due Today" filter
- **THEN** only cards whose due date is today or earlier are shown

### Requirement: Bulk card operations
The system SHALL allow users to select multiple cards via checkboxes and perform bulk operations: suspend, unsuspend, delete, and retag.

#### Scenario: Bulk suspending cards
- **WHEN** user selects 5 cards via checkboxes and clicks "Suspend"
- **THEN** all 5 cards' `is_suspended` field is set to true and they show a suspended indicator in the list

#### Scenario: Bulk deleting cards
- **WHEN** user selects 3 cards and clicks "Delete" and confirms
- **THEN** all 3 cards are removed from the database and disappear from the list

#### Scenario: Bulk retagging cards
- **WHEN** user selects cards and adds a tag via bulk retag
- **THEN** the specified tag is added to all selected cards' tag arrays

### Requirement: Navigation from ReviewHome
The system SHALL provide a "Manage Decks" entry point from the ReviewHome page that navigates to the Deck Manager view.

#### Scenario: Opening Deck Manager from ReviewHome
- **WHEN** user clicks the "Manage Decks" button on ReviewHome
- **THEN** the Deck Manager view opens as a full-screen view replacing the current content
