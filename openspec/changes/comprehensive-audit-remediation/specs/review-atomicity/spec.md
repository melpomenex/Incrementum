## ADDED Requirements

### Requirement: Review submissions MUST be atomic
The `apply_review` function SHALL wrap all database writes (`update_learning_item`, `create_review_result`, `update_study_statistics`, `update_review_session`) in a single database transaction. Either all writes succeed or none do.

#### Scenario: Successful review submission
- **WHEN** a user submits a review with a valid rating
- **THEN** the learning item scheduling state, review result, study statistics, and review session SHALL all be updated atomically

#### Scenario: Review submission with database error
- **WHEN** a database error occurs during review submission (e.g., disk full on the 3rd write)
- **THEN** all 4 writes SHALL be rolled back, leaving the database in its pre-submission state

#### Scenario: Process crash during review submission
- **WHEN** the app crashes between the transaction begin and commit
- **THEN** SQLite WAL mode SHALL ensure the transaction is rolled back on recovery, leaving scheduling state and audit trail consistent

### Requirement: Study statistics update MUST use upsert
The `update_study_statistics` function SHALL use `INSERT ... ON CONFLICT DO UPDATE` instead of the current read-then-conditional-write pattern to prevent TOCTOU race conditions.

#### Scenario: Concurrent review statistics updates
- **WHEN** two review submissions for the same date occur concurrently
- **THEN** both statistics updates SHALL be applied correctly without lost updates or duplicate key errors
