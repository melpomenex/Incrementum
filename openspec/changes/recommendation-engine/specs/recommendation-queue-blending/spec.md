## ADDED Requirements

### Requirement: Relevance-priority blending in queue assembly
The system SHALL blend relevance scores with FSRS priority during queue assembly to produce a final ordering that balances scheduling urgency with user interest.

#### Scenario: Blending with default relevance weight
- **WHEN** the queue is assembled and items have both FSRS priority and relevance scores
- **THEN** the system SHALL compute `final_score = fsrs_priority * (1 - relevance_weight) + relevance_score * 10 * relevance_weight`
- **AND** the default `relevance_weight` SHALL be 0.3

#### Scenario: Items sorted by blended score
- **WHEN** all queue items have computed final scores
- **THEN** items SHALL be sorted by `final_score` descending (higher scores first)
- **AND** items with the same score SHALL be sorted by `due_date` ascending as a tiebreaker

#### Scenario: Relevance weight is zero
- **WHEN** the user sets `relevance_weight` to 0.0
- **THEN** the queue SHALL be ordered purely by FSRS priority (current behavior)

#### Scenario: Relevance weight is one
- **WHEN** the user sets `relevance_weight` to 1.0
- **THEN** the queue SHALL be ordered purely by relevance score (FSRS priority ignored)

### Requirement: Integration with engaging scheduler
The blended relevance score SHALL be factored into the `score_queue_items()` engagement priority calculation in the engaging FSRS-6 scheduler.

#### Scenario: Relevance boosts engagement priority
- **WHEN** an item has a high relevance score (>0.7)
- **THEN** the item's engagement priority SHALL receive a relevance bonus proportional to its relevance score

#### Scenario: Low relevance reduces engagement priority
- **WHEN** an item has a low relevance score (<0.3)
- **THEN** the item's engagement priority SHALL receive a relevance penalty proportional to (0.3 - relevance_score)

#### Scenario: Neutral relevance has no effect
- **WHEN** an item has a relevance score of 0.5 (neutral)
- **THEN** the item's engagement priority SHALL receive no relevance bonus or penalty

### Requirement: Frontend engagement score integration
The frontend scroll mode engagement scoring SHALL incorporate the backend-provided relevance score.

#### Scenario: QueueScrollPage uses relevance in engagement scoring
- **WHEN** the frontend receives queue items with relevance scores
- **THEN** the engagement score calculation in `QueueScrollPage.tsx` SHALL include the relevance score as a factor
- **AND** the relevance contribution SHALL be: `relevance_score * relevance_weight * 5` (contributing up to 5 points to the engagement score)

#### Scenario: RSSScrollMode uses relevance in engagement scoring
- **WHEN** RSS articles have computed relevance scores
- **THEN** the `calculateEngagementScore()` in `RSSScrollMode.tsx` SHALL include the relevance score as a factor
- **AND** the relevance contribution SHALL replace the current random variety component for items with computed scores

### Requirement: Relevance weight configurability
The system SHALL allow users to configure the relevance weight that controls how much personalization influences queue ordering.

#### Scenario: User adjusts relevance weight
- **WHEN** the user changes the relevance weight setting (0.0 to 1.0)
- **THEN** the new weight SHALL be applied to all subsequent queue assemblies
- **AND** the queue SHALL be re-sorted immediately with the new weight

#### Scenario: Default relevance weight
- **WHEN** the user has not configured a relevance weight
- **THEN** the default value SHALL be 0.3 (30% relevance, 70% FSRS priority)

### Requirement: Relevance visual indicator
The system SHALL display a visual indicator on queue items showing their relevance score, similar to the existing intelligence indicator for RSS articles.

#### Scenario: High relevance item indicator
- **WHEN** a queue item has a relevance score above 0.7
- **THEN** the system SHALL display a green indicator dot next to the item in scroll mode

#### Scenario: Low relevance item indicator
- **WHEN** a queue item has a relevance score below 0.3
- **THEN** the system SHALL display a red indicator dot next to the item in scroll mode

#### Scenario: Neutral relevance item indicator
- **WHEN** a queue item has a relevance score between 0.3 and 0.7
- **THEN** the system SHALL display a gray indicator dot next to the item in scroll mode

#### Scenario: No relevance score computed
- **WHEN** a queue item has no computed relevance score
- **THEN** the system SHALL not display any relevance indicator
