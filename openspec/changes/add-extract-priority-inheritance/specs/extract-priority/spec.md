## ADDED Requirements

### Requirement: Extracts carry a persisted priority score
The system SHALL maintain a `priority_score` column (REAL NOT NULL, default 0.0) on the `extracts` table. The `Extract` model SHALL expose this field to all read and write paths.

#### Scenario: Existing extracts receive a default priority on migration
- **WHEN** the migration runs on an existing database
- **THEN** every existing extract row SHALL have `priority_score` set to 0.0 unless a backfill from its parent document succeeds

### Requirement: Extracts inherit the parent document's priority on creation
When an extract is created, the system SHALL copy the parent document's current `priority_score` into the new extract's `priority_score`. If the document has no priority (NULL or 0.0), the extract SHALL default to 0.0.

#### Scenario: New extract inherits high-priority document's score
- **WHEN** an extract is created from a document with `priority_score = 80.0`
- **THEN** the extract SHALL be persisted with `priority_score = 80.0`

#### Scenario: New extract from unprioritized document defaults to zero
- **WHEN** an extract is created from a document with `priority_score = 0.0`
- **THEN** the extract SHALL be persisted with `priority_score = 0.0`

### Requirement: Document priority updates cascade to non-overridden extracts
When a document's `priority_score` is updated, the system SHALL propagate the new value to all child extracts whose `priority_score` still equals the document's *previous* score. Extracts whose priority has been individually set (and therefore differs from the previous document score) SHALL be left untouched.

#### Scenario: Document reprioritization cascades to inheriting extracts
- **WHEN** a document's priority changes from 50.0 to 90.0 and an extract still has 50.0
- **THEN** that extract's `priority_score` SHALL become 90.0

#### Scenario: Manually overridden extract is not clobbered
- **WHEN** a document's priority changes from 50.0 to 90.0 and an extract has a manually-set 20.0
- **THEN** that extract's `priority_score` SHALL remain 20.0

### Requirement: Queue ordering blends inherited priority with review state
When assembling extract queue items, the system SHALL compute extract priority as `base_weight + (priority_score / 100.0) * PRIORITY_SPAN`, where `base_weight` is `9.0` for new extracts and `7.0` for reviewed extracts, and `PRIORITY_SPAN` is `2.0`. Higher inherited priority SHALL therefore surface extracts earlier in the queue, while new extracts still receive a small boost over reviewed ones.

#### Scenario: High-priority new extract outranks low-priority new extract
- **WHEN** two new extracts have inherited priorities 80.0 and 20.0
- **THEN** the first extract's queue weight is `9.0 + 1.6 = 10.6` and the second's is `9.0 + 0.4 = 9.4`, so the first is selected first

#### Scenario: Reviewed high-priority extract outranks new low-priority extract
- **WHEN** a reviewed extract has priority 90.0 (weight `7.0 + 1.8 = 8.8`) and a new extract has priority 0.0 (weight `9.0`)
- **THEN** the new low-priority extract still wins, preserving the new-vs-reviewed boost

### Requirement: Manual extract priority override
The system SHALL expose a `set_extract_priority` command that sets an individual extract's `priority_score`. Once set, the extract SHALL no longer inherit from document priority updates (because its value will differ from the previous document score).

#### Scenario: User overrides an extract's priority
- **WHEN** the user sets an extract's priority to 30.0
- **THEN** subsequent document priority cascades SHALL leave this extract at 30.0
