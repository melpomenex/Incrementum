## ADDED Requirements

### Requirement: Daily workload aggregation query
The system SHALL provide a `get_workload_data` command that accepts a start date and end date, and returns an array of daily workload entries. Each entry SHALL contain: `date` (ISO string), `due_count` (number of learning items due on that date), `reviewed_count` (number of items actually reviewed on that date), and `new_count` (number of new items learned on that date).

#### Scenario: Query for a single month
- **WHEN** `get_workload_data` is called with start_date="2026-04-01" and end_date="2026-04-30"
- **THEN** the response contains exactly 30 entries, one per day
- **AND** each entry has the fields `date`, `due_count`, `reviewed_count`, and `new_count`

#### Scenario: Day with no activity
- **WHEN** a day in the range has no due items and no reviews
- **THEN** the entry for that day has `due_count: 0`, `reviewed_count: 0`, `new_count: 0`

#### Scenario: Past day with reviews
- **WHEN** querying a date range that includes past days where reviews occurred
- **THEN** those days have `reviewed_count` > 0 reflecting actual completed reviews

#### Scenario: Future day with scheduled items
- **WHEN** querying a date range that includes future days with items scheduled
- **THEN** those days have `due_count` > 0 reflecting items with `due_date` on that day

### Requirement: Day detail items query
The system SHALL provide a `get_workload_day_details` command that accepts a date and returns the list of individual learning items due on that date (future) or reviewed on that date (past). Each item SHALL include: `item_id`, `question`, `answer`, `document_title`, `item_type`, `state`, and (for past days) `review_rating`.

#### Scenario: Future day items
- **WHEN** `get_workload_day_details` is called with a future date
- **THEN** the response contains all learning items with `due_date` matching that date
- **AND** each item includes `question`, `document_title`, `item_type`, and `state`

#### Scenario: Past day items
- **WHEN** `get_workload_day_details` is called with a past date
- **THEN** the response contains all learning items that were reviewed on that date
- **AND** each item includes `review_rating` indicating the result

#### Scenario: Empty day
- **WHEN** `get_workload_day_details` is called with a date that has no items
- **THEN** the response contains an empty array

### Requirement: Browser backend fallback
The `browser-backend.ts` SHALL implement equivalent IndexedDB queries for `get_workload_data` and `get_workload_day_details`, returning data in the same format as the Tauri commands.

#### Scenario: Browser mode workload data
- **WHEN** the app runs in browser mode and `get_workload_data` is invoked
- **THEN** the IndexedDB query returns the same array structure as the Tauri command

#### Scenario: Browser mode day details
- **WHEN** the app runs in browser mode and `get_workload_day_details` is invoked
- **THEN** the IndexedDB query returns the same item list structure as the Tauri command

### Requirement: Month summary statistics
The system SHALL compute month summary statistics from the daily workload data: `total_reviews` (sum of reviewed_count), `total_due` (sum of due_count), `daily_average` (mean of reviewed_count for past days, mean of due_count for future days), and `peak_day` (date with the highest count).

#### Scenario: Month summary computation
- **WHEN** workload data is loaded for a month
- **THEN** the summary statistics are computed client-side from the daily entries
- **AND** `daily_average` is rounded to 1 decimal place
