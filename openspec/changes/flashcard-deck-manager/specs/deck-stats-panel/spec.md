## ADDED Requirements

### Requirement: Per-deck statistics summary
The system SHALL display a statistics panel for the currently selected/expanded deck showing: total cards, cards due today, retention rate, average difficulty, and study streak contribution.

#### Scenario: Viewing deck stats for a selected deck
- **WHEN** user expands a deck in the Deck Manager
- **THEN** a stats panel shows total cards count, due-today count, retention rate percentage, average difficulty value, and current streak days

### Requirement: Maturity breakdown visualization
The system SHALL display a maturity breakdown for the selected deck showing card counts by state: new, learning, review (young), and review (mature, interval >= 21 days).

#### Scenario: Viewing maturity breakdown
- **WHEN** user views the stats panel for a deck
- **THEN** a visual breakdown shows counts for new, learning, young (interval < 21 days), and mature (interval >= 21 days) cards, rendered as a stacked bar or progress ring

### Requirement: Workload forecast sparkline
The system SHALL display a 7-day workload forecast for the selected deck, showing projected due counts per day as a sparkline or mini chart.

#### Scenario: Viewing workload forecast
- **WHEN** user views the stats panel for a deck
- **THEN** a sparkline shows the next 7 days with each day's projected due card count, with today highlighted

### Requirement: Leech detection and display
The system SHALL identify and display "leech" cards within the deck — cards with lapses >= 5 — showing their count and allowing quick navigation to them.

#### Scenario: Leech count shown in stats
- **WHEN** a deck contains 3 cards with lapses >= 5
- **THEN** the stats panel shows "3 Leeches" with a warning indicator

#### Scenario: Clicking leech count filters to leeches
- **WHEN** user clicks the leech count indicator in the stats panel
- **THEN** the card list filters to show only leech cards (lapses >= 5) in that deck

### Requirement: FSRS memory state indicators
The system SHALL display aggregate FSRS memory state information for the selected deck: average stability (in days) and average difficulty, with a visual representation of overall deck health.

#### Scenario: Viewing aggregate memory state
- **WHEN** user views the stats panel for a deck
- **THEN** average stability and average difficulty values are shown, with a color indicator (green for healthy retention, yellow for moderate, red for poor)
