## ADDED Requirements

### Requirement: Postpone settings are stored in LearningSettings
The system SHALL add a `postpone` field of type `PostponeSettings` to the `LearningSettings` interface. The settings SHALL persist via the existing Zustand persist middleware alongside other learning settings.

#### Scenario: Postpone settings persist across sessions
- **WHEN** a user configures postpone settings and reloads the app
- **THEN** the postpone settings SHALL be restored from localStorage with all values preserved

### Requirement: Postpone settings include item increase parameters
`PostponeSettings` SHALL include `itemIncrease` (percentage, default 50), `itemMinIncrease` (days, default 1), `itemMaxIncrease` (days, default 365), `itemCap` (days, default 365), and `itemFloor` (days, default 1). These control the interval increase computation for learning items.

#### Scenario: Default item increase parameters
- **WHEN** a new user installs the app
- **THEN** itemIncrease defaults to 50, itemMinIncrease to 1, itemMaxIncrease to 365, itemCap to 365, itemFloor to 1

### Requirement: Postpone settings include topic increase parameters
`PostponeSettings` SHALL include `topicIncrease` (percentage, default 40), `topicMinIncrease` (days, default 1), `topicMaxIncrease` (days, default 200), `topicCap` (days, default 180), and `topicFloor` (days, default 1). These control the interval increase computation for documents.

#### Scenario: Default topic increase parameters
- **WHEN** a new user installs the app
- **THEN** topicIncrease defaults to 40, topicMinIncrease to 1, topicMaxIncrease to 200, topicCap to 180, topicFloor to 1

### Requirement: Postpone settings include eligibility thresholds
`PostponeSettings` SHALL include `minElapsed` (days, default 30), `minPriority` (0–100, default 50), `minPriority2` (0–100, default 60), and `minStability` (default 30). Items passing all thresholds SHALL be skipped during postponement.

#### Scenario: Tighter eligibility skips more items
- **WHEN** a user sets minPriority to 30 (lower threshold)
- **THEN** more items pass the eligibility check and are skipped, resulting in fewer items being postponed

### Requirement: Postpone settings include topic eligibility thresholds
`PostponeSettings` SHALL include `topicPriorityMin` (0–100, default 60), `topicRepMin` (repetitions, default 10), and `topicElapsedMin` (days, default 14). Documents passing these thresholds SHALL be skipped during postponement.

#### Scenario: Topic eligibility thresholds work independently
- **WHEN** a document has priority 50, rep count 5, and days since review 20 with topicPriorityMin=60, topicRepMin=10, topicElapsedMin=14
- **THEN** the document fails priority check but passes elapsed check; since it fails the AND condition, it SHALL be postponed

### Requirement: Postpone settings include randomization toggle
`PostponeSettings` SHALL include `randomize` (boolean, default true). When true, interval increases SHALL have noise applied. When false, increases SHALL be deterministic.

#### Scenario: Disabling randomization produces repeatable results
- **WHEN** randomize is false and the same item is postponed twice
- **THEN** the computed interval increase SHALL be identical both times

### Requirement: Postpone settings include auto-postpone toggle
`PostponeSettings` SHALL include `autoPostponeEnabled` (boolean, default false). When enabled, the system SHALL offer to postpone outstanding items at the start of each session.

#### Scenario: Auto-postpone prompt on session start
- **WHEN** autoPostponeEnabled is true and the user starts a review session with overdue items
- **THEN** the system SHALL prompt the user to postpone outstanding items before reviewing

### Requirement: Postpone settings include simple mode toggle
`PostponeSettings` SHALL include `simpleMode` (boolean, default false). When enabled, simple postpone (linear interpolation by priority) SHALL be used instead of the standard algorithm. No eligibility checks SHALL apply in simple mode.

#### Scenario: Simple mode bypasses eligibility
- **WHEN** simpleMode is true and an item has priority 10 with high stability
- **THEN** the item SHALL be postponed using linear interpolation despite having high stability
