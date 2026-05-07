## ADDED Requirements

### Requirement: Backup restore MUST close pool before restore
The `restore_database` function SHALL close the sqlx connection pool before opening the database with rusqlite for page-level restore. After restore completes, the pool SHALL be reopened.

#### Scenario: Restore while app is active
- **WHEN** a user initiates a database restore
- **THEN** the sqlx pool SHALL be closed before the rusqlite backup begins
- **AND** the pool SHALL be reopened after the backup completes

### Requirement: Backup restore MUST create pre-restore snapshot
Before overwriting the live database, the restore function SHALL create a snapshot of the current database using `VACUUM INTO '<db>.pre-restore-<timestamp>'`.

#### Scenario: Restore from backup
- **WHEN** a user restores from a backup file
- **THEN** a pre-restore snapshot SHALL be created before the restore begins

#### Scenario: Restore failure
- **WHEN** the restore operation fails (e.g., corrupted backup file)
- **THEN** the pre-restore snapshot SHALL still exist and the user SHALL be informed of its location

### Requirement: Backup creation MUST verify integrity
After creating a backup with `VACUUM INTO`, the system SHALL open the backup file and run `PRAGMA integrity_check` to verify the backup is valid.

#### Scenario: Successful backup
- **WHEN** a backup is created
- **THEN** `PRAGMA integrity_check` SHALL be run on the backup file
- **AND** if the check fails, the backup SHALL be deleted and an error SHALL be returned

### Requirement: Document restore MUST complete database records
The `restore_documents` function SHALL create database records for each restored document file, not just extract files to disk.

#### Scenario: Complete restore with documents
- **WHEN** a backup containing documents is restored
- **THEN** both the database records AND the document files SHALL be present after restore
