## ADDED Requirements
### Requirement: Personal FSRS Weight Optimization
The system SHALL provide a personal FSRS optimization workflow that computes user-specific 17-parameter weight sets from historical review events after sufficient review history is available.

#### Scenario: User runs optimizer with sufficient history
- **WHEN** a user with at least the minimum optimization review history starts optimization
- **THEN** the system computes and stores a personalized FSRS weight set
- **AND** subsequent scheduling uses that personalized set unless the user reverts to defaults

### Requirement: Desired Retention Target Control
The system SHALL allow users to set a desired retention target percentage and SHALL adjust interval planning to align projected recall with the selected target.

#### Scenario: User changes desired retention target
- **WHEN** a user changes retention target from 90% to 95%
- **THEN** the scheduler applies shorter future intervals than the previous target policy
- **AND** existing historical reviews remain preserved

### Requirement: Scoped FSRS Parameters by Deck and Tag
The system SHALL support FSRS parameter sets at global, deck, and tag scopes with deterministic precedence for scheduling decisions.

#### Scenario: Deck-scoped parameters override global defaults
- **WHEN** a card belongs to a deck that has custom FSRS parameters
- **THEN** the scheduler uses deck-scoped parameters instead of global defaults

#### Scenario: Tag-scoped parameters override deck defaults
- **WHEN** a card has a tag with custom FSRS parameters and tag precedence is configured above deck scope
- **THEN** the scheduler uses tag-scoped parameters for that card

### Requirement: Workload Forecast Simulation
The system SHALL provide due workload forecasts for at least 30, 60, and 90 day horizons based on current scheduling state and selected retention policy.

#### Scenario: User views future due workload
- **WHEN** a user opens workload forecasting
- **THEN** the system displays projected due counts for the next 30, 60, and 90 days
- **AND** forecast recalculates when retention target or scoped parameters change

### Requirement: One-Step Review Undo
The system SHALL allow users to undo the most recent review action in a session and restore prior scheduling and review-state values for the affected item.

#### Scenario: User undoes an accidental rating
- **WHEN** a user triggers undo immediately after submitting a review rating
- **THEN** the prior rating outcome and scheduling state are restored
- **AND** the undoable action stack removes that restored action

### Requirement: Cram and Filtered Review Isolation
The system SHALL provide cram/custom filtered review sessions that do not mutate long-term FSRS scheduling unless the user explicitly opts in to committing results.

#### Scenario: User runs cram session before an exam
- **WHEN** a user reviews a filtered subset in cram mode
- **THEN** completion and feedback are shown within that session
- **AND** baseline FSRS due dates and stability values remain unchanged
