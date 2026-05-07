## MODIFIED Requirements

### Requirement: Database is restored using SQLite online backup API
When restoring a backup that includes a database, the system SHALL first close the sqlx connection pool, then use `rusqlite::backup::Backup` to copy the backup database file into the live database. After the restore completes, the pool SHALL be reopened. Before the restore begins, a pre-restore snapshot SHALL be created using `VACUUM INTO`.

#### Scenario: Database restore replaces live data
- **WHEN** `backup_restore` is called with a backup containing `includes.database: true`
- **THEN** the sqlx connection pool SHALL be closed
- **AND** a pre-restore snapshot SHALL be created via `VACUUM INTO`
- **AND** the backup's `incrementum.db` is opened as a source
- **AND** the SQLite backup API copies all pages from source to the live database
- **AND** the sqlx connection pool is reopened
- **AND** all existing data is replaced with the backup data

#### Scenario: Restore with active readers
- **WHEN** a database restore is initiated
- **THEN** the pool close SHALL wait for all active queries to complete
- **AND** no new queries SHALL be accepted until the pool is reopened

#### Scenario: Restore failure preserves pre-restore snapshot
- **WHEN** the restore operation fails (e.g., corrupted backup)
- **THEN** the pre-restore snapshot SHALL still exist
- **AND** the user SHALL be informed of the snapshot location for manual recovery

## ADDED Requirements

### Requirement: Backup creation MUST verify output integrity
After creating a backup with `VACUUM INTO`, the system SHALL open the backup file and run `PRAGMA integrity_check`. If the check fails, the backup file SHALL be deleted and an error SHALL be returned.

#### Scenario: Backup integrity verified
- **WHEN** a database backup is created
- **THEN** `PRAGMA integrity_check` is run on the backup file
- **AND** the backup is only returned as successful if the check passes

#### Scenario: Backup integrity check fails
- **WHEN** `PRAGMA integrity_check` on the backup file returns a non-ok result
- **THEN** the backup file SHALL be deleted
- **AND** an error SHALL be returned indicating backup corruption

### Requirement: Document restore MUST create database records
When restoring documents from a backup, the system SHALL not only extract document files to disk but also create corresponding database records so the documents appear in the app.

#### Scenario: Complete document restore
- **WHEN** a backup containing documents is restored
- **THEN** document files are extracted to the documents directory
- **AND** database records are created for each restored document
- **AND** the documents appear in the documents list
