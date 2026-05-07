## ADDED Requirements

### Requirement: Scheduling algorithm benchmarks MUST exist
A benchmark harness SHALL measure the performance of SM-2, SM-18, and SM-20 scheduling computations. Benchmarks SHALL cover: single review submission, batch review of 1000 items, queue generation with 5000 items, and priority score calculation.

#### Scenario: Benchmark execution
- **WHEN** `cargo bench` is run
- **THEN** benchmarks for scheduling computation, queue generation, and priority scoring SHALL execute and report timing

### Requirement: Review submission integration test MUST exist
An integration test SHALL verify that review submissions are atomic by simulating a failure after the first write and confirming the database is in its pre-submission state.

#### Scenario: Atomic review test
- **WHEN** the integration test runs
- **THEN** it SHALL verify that a partial review submission (interrupted between writes) leaves the database consistent

### Requirement: Import round-trip test MUST exist
Integration tests SHALL verify that exporting data and re-importing it produces identical results. This SHALL cover: Anki export/import, StudyJSON export/import, and queue export/import.

#### Scenario: Anki round-trip test
- **WHEN** a deck is exported as APKG and re-imported
- **THEN** the learning items, scheduling data, and review history SHALL match the original

### Requirement: Migration correctness test MUST exist
An integration test SHALL verify that migrations produce the expected schema and that pre-migration backups are valid.

#### Scenario: Migration test
- **WHEN** the migration test runs against a database at version N-1
- **THEN** all pending migrations SHALL apply successfully
- **AND** the pre-migration backup SHALL pass `PRAGMA integrity_check`

### Requirement: Security regression tests MUST exist
Tests SHALL verify that: parameterized queries reject injection payloads, file path validation blocks traversal, and API key authentication rejects unauthenticated requests.

#### Scenario: SQL injection regression test
- **WHEN** a test sends `'; DROP TABLE learning_items; --` as a feed_id parameter
- **THEN** the query SHALL return an empty result (no rows matching the literal injection string)

#### Scenario: Path traversal regression test
- **WHEN** `read_document_file` is called with `../../etc/passwd`
- **THEN** the function SHALL return an error
