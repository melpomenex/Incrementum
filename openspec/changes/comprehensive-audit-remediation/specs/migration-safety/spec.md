## ADDED Requirements

### Requirement: Pending migrations MUST trigger pre-migration backup
Before applying any pending database migrations, the system SHALL create a backup using `VACUUM INTO '<db_path>.pre-migration-<timestamp>'`. The backup SHALL be verified with `PRAGMA integrity_check` after creation.

#### Scenario: First-time startup with all migrations pending
- **WHEN** the app starts and there are 40+ pending migrations
- **THEN** a backup SHALL be created before the first migration runs
- **AND** the backup SHALL be verified as valid

#### Scenario: Subsequent startup with no pending migrations
- **WHEN** the app starts and no migrations are pending
- **THEN** no backup SHALL be created (avoiding unnecessary I/O)

#### Scenario: Migration failure after backup
- **WHEN** a migration fails after the pre-migration backup was created
- **THEN** the system SHALL log the backup file path for manual recovery
- **AND** the error message SHALL include recovery instructions

### Requirement: Database connection MUST run startup integrity check
On database initialization, the system SHALL run `PRAGMA integrity_check` and log the result. If the check fails, the system SHALL show a user-facing error dialog with recovery options rather than crashing.

#### Scenario: Clean database startup
- **WHEN** the database opens and passes integrity check
- **THEN** the app SHALL start normally

#### Scenario: Corrupted database detected
- **WHEN** `PRAGMA integrity_check` returns a non-"ok" result
- **THEN** the app SHALL show a dialog explaining the corruption
- **AND** the dialog SHALL offer options: restore from backup, attempt repair, or quit

### Requirement: synchronous=NORMAL MUST apply to all pool connections
The `synchronous = NORMAL` PRAGMA SHALL be set via `SqliteConnectOptions` so it applies to every connection in the pool, not just the first.

#### Scenario: Verify synchronous setting on pool connection
- **WHEN** a connection is acquired from the pool
- **THEN** `PRAGMA synchronous` SHALL return `NORMAL`
