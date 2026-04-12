## ADDED Requirements

### Requirement: Postpone computes algorithm-aware interval increase
The system SHALL compute a new interval for a postponed element using priority-weighted formulas. For items, the ratio SHALL be `itemIncrease / 100 + 1`, the raw increase SHALL be `round(minInterval * ratio) - minInterval`, and the final increase SHALL be scaled by `floor(priority / 100) * 2`. The result SHALL be clamped to `[minIncrease, maxIncrease]` and then `[floor, cap]`.

#### Scenario: Item with high priority gets significant interval increase
- **WHEN** an item has priority 85, current interval 30 days, itemIncrease 50, minIncrease 1, maxIncrease 365, floor 1, cap 365
- **THEN** the ratio is 1.5, raw increase is 15, priority factor is 1, final increase is 30, and the new interval is 60 days

#### Scenario: Item with low priority gets minimal interval increase
- **WHEN** an item has priority 30, current interval 10 days, itemIncrease 50, minIncrease 1, maxIncrease 365, floor 1, cap 365
- **THEN** the priority factor is 0, raw increase is 5, final increase is 0 which is clamped to minIncrease of 1, and the new interval is 11 days

### Requirement: Document postponement uses topic parameters
Documents SHALL be treated as topics in the postpone algorithm. The system SHALL use `topicIncrease`, `topicMinIncrease`, `topicMaxIncrease`, `topicCap`, and `topicFloor` parameters instead of item parameters when computing the interval increase for documents.

#### Scenario: Document postponed with topic parameters
- **WHEN** a document has priority 70, days since review 14, topicIncrease 40, topicMinIncrease 1, topicMaxIncrease 200, topicCap 180, topicFloor 1
- **THEN** the ratio is 1.4, raw increase is `round(14 * 1.4) - 14 = 6`, priority factor is 1, final increase is 12, and the new reading date is shifted by 12 days

### Requirement: Postpone eligibility gates filter items
The system SHALL evaluate item eligibility before postponing. An item SHALL be skipped (not postponed) when ALL of the following are true: `elapsedDays >= minElapsed`, `priority >= minPriority`, AND (`priority >= minPriority2` OR `stability >= minStability` OR `repetitionCount >= minInterval`). Items that fail the checks SHALL have their intervals increased.

#### Scenario: Well-established item is skipped
- **WHEN** an item has elapsed 60 days, priority 90, stability 50, repetition count 30, with thresholds minElapsed=30, minPriority=50, minPriority2=60, minStability=30
- **THEN** the item passes all eligibility checks and is skipped (not postponed)

#### Scenario: Struggling item is postponed
- **WHEN** an item has elapsed 10 days, priority 25, stability 5, repetition count 2, with thresholds minElapsed=30, minPriority=50
- **THEN** the item fails the elapsed and priority checks and SHALL have its interval increased

### Requirement: Topic eligibility gates filter documents
For documents (topics), the system SHALL skip postponement when `priority >= topicPriorityMin` AND (`repetitionCount >= topicRepMin` OR `daysSinceLastReview >= topicElapsedMin`). Documents failing these checks SHALL be postponed.

#### Scenario: Recently reviewed topic is skipped
- **WHEN** a document has priority 80, repetition count 15, days since last review 5, with topicPriorityMin=60, topicRepMin=10
- **THEN** the document passes eligibility and is skipped

### Requirement: Interval randomization prevents date clustering
When randomization is enabled, the system SHALL add noise to the computed interval increase using the formula: `RoundWithNoise(increase, increase * 0.5)`. The noise distribution SHALL use the SM-20 randomization formula with `sqrt(1 - random01 * 1.97979) * -10.8578`, scaled by 50, with a 50% sign flip. The result SHALL be clamped to a minimum of 1 day.

#### Scenario: Randomization spreads postponed items
- **WHEN** 100 items are postponed with the same base increase of 30 days and randomization enabled
- **THEN** the resulting increases SHALL vary within approximately ±15 days of 30 (i.e., 15–45 days)

### Requirement: Priority is derived from existing item state
The system SHALL compute a priority value in the range [0, 100] from the item's existing fields. Priority SHALL be calculated as `clamp(100 - stability * difficultyFactor, 0, 100)` where `difficultyFactor` scales difficulty (1–5) to a weight. Higher stability and lower difficulty SHALL yield lower priority (well-established items).

#### Scenario: Mature easy item has low priority
- **WHEN** an item has stability 100, difficulty 1 (easy)
- **THEN** the priority is low (well-established, does not urgently need review)

#### Scenario: Young hard item has high priority
- **WHEN** an item has stability 3, difficulty 5 (hard)
- **THEN** the priority is high (struggling item, should not be heavily postponed)

### Requirement: Simple postpone mode uses linear interpolation
When simple mode is enabled, the system SHALL compute interval increases using direct linear interpolation: for items `increase = round((itemMax - itemMin) * priority / 100)` and `newInterval = itemBase + increase`. For documents, topic equivalents SHALL be used. No eligibility checks SHALL be applied in simple mode.

#### Scenario: Simple postpone with medium priority
- **WHEN** simple mode is enabled, an item has priority 50, itemMin=1, itemMax=100, itemBase=1
- **THEN** increase is `round(99 * 50 / 100) = 50` and new interval is 51
