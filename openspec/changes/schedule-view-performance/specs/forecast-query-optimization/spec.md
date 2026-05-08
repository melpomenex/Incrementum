## ADDED Requirements

### Requirement: Workload forecast SHALL use a single GROUP BY query
The `get_due_workload_forecast` command SHALL execute exactly two SQL queries (one for learning items, one for documents) using `GROUP BY DATE(column)` aggregation, instead of running 2 queries per forecast day.

#### Scenario: Forecast returns identical results with fewer queries
- **WHEN** `get_due_workload_forecast` is called with `{days: 90}`
- **THEN** the system SHALL execute exactly 2 SQL queries (one for learning_items, one for documents) and return a `Vec<ForecastPoint>` with 90 entries matching the current output format

#### Scenario: Zero-count days are filled correctly
- **WHEN** the GROUP BY result has no entries for certain dates within the forecast range
- **THEN** those dates SHALL be filled with count values of 0 in the returned `Vec<ForecastPoint>`

### Requirement: Playlist intersperse SHALL use batch queries
The `get_queue_with_playlist_intersperse` function SHALL batch-fetch all playlist document metadata and subscription info with a single `WHERE id IN (?)` query per entity type, instead of issuing individual queries per playlist item.

#### Scenario: Queue with playlist items loads without N+1 queries
- **WHEN** the queue contains 10 playlist video items
- **THEN** the system SHALL execute exactly 1 batch query for document metadata and 1 batch query for subscriptions, totaling 2 queries (not 20)

### Requirement: Video extract filters SHALL be applied server-side
The `get_all_video_extracts` query or its caller SHALL apply the `review_count == 0 AND next_review_date IS NULL` filter in SQL, rather than fetching all video extracts and filtering in Rust.

#### Scenario: New video extracts fetched with SQL filter
- **WHEN** `get_queue_items_from_repo` retrieves new video extracts
- **THEN** the SQL query SHALL include `WHERE review_count = 0 AND next_review_date IS NULL` conditions, returning only matching rows
