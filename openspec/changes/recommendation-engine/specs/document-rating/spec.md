## MODIFIED Requirements

### Requirement: Document Review and Navigation
The system SHALL support rating documents during reading, which triggers rescheduling, navigation, and relevance score recalculation for the rated document and related items.

#### Scenario: User rates a document after reading
- **Given** the user is viewing a document in the "Document" view mode
- **When** the user selects a rating (Again, Hard, Good, Easy) via the `HoverRatingControls` or keyboard shortcuts
- **Then** the application should submit the rating to the backend with the time spent
- **And** the backend should reschedule the document using FSRS
- **And** the backend should recompute the relevance score for the rated document
- **And** the backend should schedule lazy recalculation of relevance for items sharing the same tags or source
- **And** the application should automatically navigate to the next document in the queue

### Requirement: Persistence of Scheduling Data
Document scheduling data MUST be persisted to the database, including relevance score and computation timestamp.

#### Scenario: Document scheduling persistence
- **Given** a document is rated
- **When** the rating is processed
- **Then** the document's `next_reading_date`, `stability`, `difficulty`, `reps`, `total_time_spent`, `relevance_score`, and `relevance_computed_at` should be updated in the database
- **And** the new schedule and relevance score should be reflected in the Queue view

## ADDED Requirements

### Requirement: Rating-triggered relevance propagation
The system SHALL propagate relevance score updates to related items when a document is rated, ensuring the recommendation model reflects the latest user preferences.

#### Scenario: Good/Easy rating boosts similar items
- **WHEN** a user rates a document as Good (3) or Easy (4)
- **THEN** the system SHALL incrementally boost the relevance score of items sharing tags with the rated document
- **AND** the boost SHALL be proportional to the tag overlap (Jaccard similarity)

#### Scenario: Again/Hard rating reduces similar items
- **WHEN** a user rates a document as Again (1) or Hard (2)
- **THEN** the system SHALL incrementally reduce the relevance score of items sharing tags with the rated document
- **AND** the reduction SHALL be proportional to the tag overlap (Jaccard similarity)

#### Scenario: Rating updates tag affinity cache
- **WHEN** a user rates any item
- **THEN** the system SHALL update the in-memory tag affinity cache with the new rating
- **AND** the cache SHALL reflect the last 100 ratings for tag frequency computation
