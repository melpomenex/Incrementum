## ADDED Requirements

### Requirement: Blocked items show prerequisite badge in queue sidebar
When TAS is enabled and an item is prerequisite-blocked, the queue sidebar SHALL display a badge on that item. The badge SHALL indicate which prerequisite tag is blocking the item and the tag's current maturity ratio as a percentage.

#### Scenario: Blocked item badge shows prerequisite info
- **WHEN** an item is blocked by `calculus.limits` at 45% maturity with `maturityRatio` set to 0.7
- **THEN** the badge SHALL read "Waiting on `calculus.limits` maturity (45%)"

#### Scenario: No badge on unblocked items
- **WHEN** an item has no blocking prerequisites
- **THEN** the item SHALL NOT display a blocking badge

### Requirement: Delayed items show interference badge
When TAS is enabled and an item is delayed by interference jitter, the queue sidebar SHALL display a badge indicating the delay reason and duration.

#### Scenario: Interference delay badge
- **WHEN** an item is delayed 2 hours to avoid interference with `cs.algorithms.sorting`
- **THEN** the badge SHALL read "Delayed 2h to avoid interference with `cs.algorithms.sorting`"

### Requirement: User can force-show a blocked or delayed item
Each blocked or delayed item in the queue sidebar SHALL have a "Force show" action. When activated, the item SHALL be immediately added to the eligible queue for this session, bypassing TAS restrictions. This override SHALL only apply to the current session.

#### Scenario: Force show adds blocked item to queue
- **WHEN** the user clicks "Force show" on a prerequisite-blocked item
- **THEN** the item SHALL immediately appear in the review queue for this session

#### Scenario: Force show is one-time per session
- **WHEN** the user force-shows an item, completes the session, and opens a new session
- **THEN** the item SHALL be re-evaluated against TAS rules and may be blocked again

### Requirement: TAS configuration settings panel
The system SHALL provide a settings panel for TAS configuration accessible from the queue view. The panel SHALL include:
- A toggle to enable or disable TAS entirely.
- A slider for `minSeparationHours` (range 0–24, default 4).
- A slider for `coherenceThreshold` (range 0.5–1.0, step 0.05, default 0.75).
- A slider for `maturityRatio` (range 0.5–1.0, step 0.05, default 0.7).
- Independent toggles to enable or disable the interference and prerequisite subsystems.

#### Scenario: TAS toggle disables all TAS processing
- **WHEN** the user turns TAS off
- **THEN** the queue SHALL be built without prerequisite gating or interference jitter, and all TAS badges SHALL be hidden

#### Scenario: Interference toggle disables only jitter
- **WHEN** the user disables the interference subsystem but leaves TAS enabled
- **THEN** prerequisite gating SHALL still apply, but interference jitter SHALL NOT

#### Scenario: Settings persist across sessions
- **WHEN** the user changes `minSeparationHours` to 6 and restarts the app
- **THEN** `minSeparationHours` SHALL remain 6

### Requirement: Queue view indicates TAS status
When TAS is enabled, the queue view SHALL display an indicator showing that TAS filtering is active. When TAS is disabled, the indicator SHALL be absent.

#### Scenario: TAS active indicator shown
- **WHEN** TAS is enabled and the user views the queue
- **THEN** a "TAS Active" indicator or badge SHALL be visible in the queue header
