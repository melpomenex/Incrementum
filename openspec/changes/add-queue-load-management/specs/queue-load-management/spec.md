## ADDED Requirements

### Requirement: Advance item pulls a future-due item forward
The system SHALL expose an `advance_item(item_id, days, item_type)` command that decreases a learning item's or document's scheduled date by `days`, bringing it closer to (or onto) today. This is the inverse of `postpone_item`. The shift SHALL be additive to `due_date` only and SHALL NOT mutate FSRS memory state, stability, or difficulty.

#### Scenario: Future-due learning item advanced to today
- **WHEN** an item is due in 5 days and `advance_item` is called with `days = 5`
- **THEN** the item's `due_date` SHALL become today and its memory state SHALL be unchanged

#### Scenario: Advancing a document pulls its next reading forward
- **WHEN** `advance_item` is called with `item_type = "document"` and `days = 3`
- **THEN** the document's `next_reading_date` SHALL decrease by 3 days

### Requirement: Bulk advance pulls all soon-due items to today
The system SHALL expose `advance_due_queue(days)` which moves every learning item due within the next `days` onto today's queue (sets `due_date` to today). Useful for "I have time now, let me get ahead" cramming.

#### Scenario: Advance the next 7 days of reviews
- **WHEN** `advance_due_queue(7)` is called and 42 items are due in the next 7 days
- **THEN** all 42 items SHALL have `due_date` set to today

### Requirement: Load balancing redistributes the due pile
The system SHALL expose `load_balance_queue(window_days, target_per_day)` which redistributes learning items due within the next `window_days` (default 14) so that no single day exceeds `target_per_day`. When `target_per_day` is null, the system SHALL compute it as `ceil(total_due / window_days * 1.25)` (average plus 25% headroom). The redistribution SHALL preserve each item's interval relative to its last review (additive shift only).

#### Scenario: Spiky queue gets flattened
- **WHEN** 100 items are due today and 0 are due tomorrow through day 14, and `load_balance_queue(14, null)` is called
- **THEN** the target per day SHALL be `ceil(100/14*1.25) = 9`, and items SHALL be spread so no day exceeds 9

#### Scenario: Load balancing preserves memory state
- **WHEN** load balancing shifts an item's `due_date` by 4 days
- **THEN** the item's `memory_state_stability`, `memory_state_difficulty`, `interval`, `ease_factor`, and `review_count` SHALL all be unchanged

### Requirement: Easy Days suppress reviews on chosen weekdays
The system SHALL expose `apply_easy_days(window_days, easy_days)` where `easy_days` is a list of weekday indices (0=Sun..6=Sat). For each learning item whose `due_date` within the next `window_days` falls on an easy day, the system SHALL shift its `due_date` forward to the next non-easy day. The shift SHALL preserve interval relative to last review (additive only).

#### Scenario: Saturday reviews pushed to Monday
- **WHEN** `easy_days = [6, 0]` (Sat, Sun) and an item is due on Saturday within the window
- **THEN** the item's `due_date` SHALL be shifted to the following Monday

#### Scenario: Easy days respects user settings when no overrides passed
- **WHEN** `apply_easy_days` is called without an explicit `easy_days` argument
- **THEN** the system SHALL read `easyDays` from persisted learning settings
