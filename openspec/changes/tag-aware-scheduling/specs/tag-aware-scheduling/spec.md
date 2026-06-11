## ADDED Requirements

### Requirement: Daily TAS pre-computation runs on queue build
The system SHALL run Tag-Aware Scheduling pre-computation once per review session when the user builds the daily queue. The computation SHALL execute prerequisite gating before interference jitter, and interference jitter SHALL only consider items not blocked by prerequisites.

#### Scenario: Queue built with TAS enabled
- **WHEN** the user opens a review session and TAS is enabled
- **THEN** the system SHALL compute prerequisite blocking and interference delays for all due items before presenting the queue

#### Scenario: Queue built with TAS disabled
- **WHEN** the user opens a review session and TAS is disabled
- **THEN** the system SHALL present the default SM-20/FSRS queue without any TAS processing

### Requirement: Prerequisite gating blocks items below maturity ratio
For each due item, the system SHALL evaluate all tags on the item and all prerequisites of those tags. The item SHALL be blocked if any prerequisite tag's mature item ratio (`matureCount / itemCount`) falls below the configured `maturityRatio`. An item with multiple tags SHALL be blocked if any single tag's prerequisite is unmet.

#### Scenario: Item blocked by immature prerequisite
- **WHEN** an item has tag `calculus.derivatives`, which requires `calculus.limits`, and `calculus.limits` has 3 of 10 items mature (ratio 0.3) with `maturityRatio` set to 0.7
- **THEN** the item SHALL be marked as prerequisite-blocked

#### Scenario: Item passes when prerequisite is mature
- **WHEN** an item has tag `calculus.derivatives`, which requires `calculus.limits`, and `calculus.limits` has 8 of 10 items mature (ratio 0.8) with `maturityRatio` set to 0.7
- **THEN** the item SHALL NOT be blocked by prerequisites

#### Scenario: Untagged item exempt from gating
- **WHEN** an item has no tags
- **THEN** the item SHALL NOT be blocked by prerequisite gating and SHALL be scheduled normally

#### Scenario: Item with multiple prerequisites where any is unmet
- **WHEN** an item has tag `advanced-topic`, which requires both `foundation-a` (ratio 0.9, mature) and `foundation-b` (ratio 0.3, immature) with `maturityRatio` 0.7
- **THEN** the item SHALL be blocked because `foundation-b` is below threshold

### Requirement: Interference jitter separates similar items in the queue
The system SHALL evaluate interference between consecutively scheduled items. When an item shares a tag with any of the last 10 scheduled items, and the shared tag's coherence exceeds `coherenceThreshold`, the item's availability SHALL be delayed by `minSeparationHours` from the conflicting item's scheduled time.

#### Scenario: High-coherence items separated
- **WHEN** item A (tagged `cs.algorithms.sorting`, coherence 0.85) is scheduled at 09:00, and item B (tagged `cs.algorithms.sorting`) is due at 09:15, with `coherenceThreshold` 0.75 and `minSeparationHours` 4
- **THEN** item B's `interferenceDelayUntil` SHALL be set to 13:00 (09:00 + 4 hours)

#### Scenario: Low-coherence items not separated
- **WHEN** item A (tagged `biology.cells`) has coherence 0.4 with item B's tags, and `coherenceThreshold` is 0.75
- **THEN** item B SHALL NOT receive an interference delay from item A

#### Scenario: Coherence not yet calculated treated as zero
- **WHEN** a tag has no coherence value computed
- **THEN** the system SHALL treat its coherence as 0, producing no interference delay

### Requirement: Queue assembly sorts eligible items by priority, due time, and stability
The system SHALL assemble the final queue from items that are not prerequisite-blocked and whose interference delay has elapsed. Items SHALL be sorted by: (1) user priority flag, (2) original due time, (3) stability ascending (lower stability items first, to catch fragile items early).

#### Scenario: Eligible queue excludes blocked items
- **WHEN** 10 items are due, and 2 are prerequisite-blocked, 1 is interference-delayed until later today
- **THEN** the assembled queue SHALL contain 7 items ordered by priority, due time, and stability

#### Scenario: All items blocked yields empty queue
- **WHEN** all due items are either prerequisite-blocked or interference-delayed
- **THEN** the assembled queue SHALL be empty and the UI SHALL indicate why

### Requirement: Tag maturity computed on review completion
The system SHALL recompute tag stability statistics when a review is completed. An item SHALL be considered mature when its SM-20/FSRS stability metric meets or exceeds the tag's `maturityThreshold`. The system SHALL increment `matureCount` when an item crosses the threshold and decrement when it drops below.

#### Scenario: Item matures after review
- **WHEN** an item with stability 0.7 is reviewed and its stability increases to 0.85, and its tag has `maturityThreshold` 0.8
- **THEN** the tag's `matureCount` SHALL increase by 1

#### Scenario: Item drops below maturity after reschedule
- **WHEN** an item with stability 0.9 is manually rescheduled and its stability drops to 0.6, and its tag has `maturityThreshold` 0.8
- **THEN** the tag's `matureCount` SHALL decrease by 1

### Requirement: Tauri command exposes TAS queue
The system SHALL provide a `build_tas_queue` Tauri command that accepts a date and returns the TAS-processed queue as a list of scheduled items, each annotated with `prerequisiteBlocked` and `interferenceDelayUntil` fields.

#### Scenario: Queue returned with TAS annotations
- **WHEN** `build_tas_queue` is called for today's date with TAS enabled
- **THEN** the returned list SHALL include every due item with its blocking and delay status

### Requirement: Tauri command manages tag prerequisites
The system SHALL provide a `set_tag_prerequisites` Tauri command that accepts a tag ID and a list of prerequisite tag IDs. The command SHALL validate that no circular dependency exists before saving. On circular detection, the command SHALL return an error.

#### Scenario: Valid prerequisites saved
- **WHEN** `set_tag_prerequisites` is called for tag `B` with prerequisite `[A]`
- **THEN** tag B's prerequisites SHALL be updated to `[A]`

#### Scenario: Circular dependency rejected
- **WHEN** `set_tag_prerequisites` is called for tag `A` with prerequisite `[B]`, and tag `B` already has prerequisite `[A]`
- **THEN** the command SHALL return an error and SHALL NOT save the change

### Requirement: Tauri command exposes tag maturity stats
The system SHALL provide a `get_tag_maturity_stats` Tauri command that returns a tag's `itemCount`, `avgStability`, `matureCount`, and computed maturity ratio.

#### Scenario: Maturity stats returned
- **WHEN** `get_tag_maturity_stats` is called for a tag with 10 items, average stability 0.6, 3 mature items
- **THEN** the response SHALL include `itemCount: 10`, `avgStability: 0.6`, `matureCount: 3`

### Requirement: TAS preserves underlying scheduler integrity
TAS SHALL operate as a post-processing layer over the existing SM-20/FSRS scheduler. It SHALL NOT modify item intervals, due dates, or stability values. Blocked or delayed items SHALL retain their original SM-20/FSRS state.

#### Scenario: Blocked item retains interval
- **WHEN** an item with a 7-day SM-20 interval is prerequisite-blocked for 3 days
- **THEN** when unblocked, the item SHALL still have its 7-day interval intact
