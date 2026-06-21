## ADDED Requirements

### Requirement: Extracts carry a dismissed flag
The system SHALL maintain an `is_dismissed` column (BOOLEAN NOT NULL, default 0) on the `extracts` table. The `Extract` model SHALL expose this field.

#### Scenario: Existing extracts default to not dismissed on migration
- **WHEN** the migration runs on an existing database
- **THEN** every existing extract SHALL have `is_dismissed = 0`

### Requirement: Dismissed extracts are excluded from the review queue
The due-extract and new-extract queries (`get_due_extracts`, `get_new_extracts`, `get_due_video_extracts`, `get_new_video_extracts`) SHALL filter out dismissed extracts (`WHERE is_dismissed = 0`). Dismissed extracts SHALL remain in the library and still appear in document extract listings.

#### Scenario: Dismissed extract disappears from queue
- **WHEN** an extract is dismissed and the queue is assembled
- **THEN** the extract SHALL NOT appear in due or new extract results

#### Scenario: Dismissed extract stays in library
- **WHEN** an extract is dismissed and the user views the parent document's extract list
- **THEN** the extract SHALL still be listed (with a dismissed indicator)

### Requirement: Forget resets memory state
The `forget_extract(id)` command SHALL reset the extract's FSRS memory state to initial values (stability → 0.5, difficulty → 5.0, reps → 0, review_count → 0), clear `next_review_date`, and clear `last_review_date`. The extract SHALL return to the new-extract queue on its next assembly.

#### Scenario: Forget returns an extract to the new queue
- **WHEN** `forget_extract` is called on a reviewed extract
- **THEN** its memory state SHALL reset to initial values and `next_review_date` SHALL be NULL

### Requirement: Dismiss toggles queue membership
The `dismiss_extract(id, dismissed)` command SHALL set `is_dismissed` to the provided boolean. When `true`, the extract leaves the review queue; when `false`, it re-enters.

#### Scenario: Dismiss then undismiss restores queue membership
- **WHEN** an extract is dismissed (true) then undismissed (false)
- **THEN** the extract SHALL reappear in due/new extract queries

### Requirement: Graduate schedules far in the future
The `graduate_extract(id)` command SHALL set `next_review_date` to approximately 5 years in the future and set stability to a high value (1825 days), signaling mastered material that has left active rotation. The extract SHALL NOT be marked dismissed (it remains in the queue, just far out).

#### Scenario: Graduate pushes the extract far out
- **WHEN** `graduate_extract` is called on an extract
- **THEN** its `next_review_date` SHALL be roughly 5 years from now and its stability SHALL be 1825
