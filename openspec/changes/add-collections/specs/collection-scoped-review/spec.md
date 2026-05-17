## ADDED Requirements

### Requirement: Review queue scoped to active collection
The review queue SHALL only include learning items and documents that belong to the active collection. Switching collections SHALL immediately recompute the review queue.

#### Scenario: Review items from active collection
- **WHEN** the user opens the review page with "School" collection active
- **THEN** only learning items and documents with `collection_id` matching "School" SHALL appear in the review queue

#### Scenario: Switching collections during review
- **WHEN** the user switches from "School" to "Work" mid-review
- **THEN** the review queue SHALL reset and load only items belonging to "Work". Any in-progress review session for "School" SHALL be preserved for when the user switches back.

### Requirement: Review session collection tracking
Each review session SHALL be tagged with the `collection_id` of the active collection at session creation time.

#### Scenario: Review session records collection
- **WHEN** a review session is started while "Work" is active
- **THEN** the `review_sessions` row SHALL have `collection_id` set to the "Work" collection's ID

### Requirement: Collection-scoped statistics
The dashboard, analytics page, and any statistics displays SHALL only count data from the active collection.

#### Scenario: Document count on dashboard
- **WHEN** "School" is the active collection and it has 15 documents
- **THEN** the dashboard SHALL display "15 documents", not the total across all collections

#### Scenario: Review statistics on analytics page
- **WHEN** the user views analytics with "Work" active
- **THEN** all charts, retention rates, and review counts SHALL reflect only "Work" collection data

### Requirement: Due count badges per collection
The system SHALL be able to compute the number of due items per collection, enabling the UI to show due counts even for inactive collections.

#### Scenario: Badge shows due count for inactive collection
- **WHEN** "School" is inactive and has 12 due items, and "Work" is active
- **THEN** the collection switcher MAY display a "12" badge next to "School" to indicate pending reviews
