## ADDED Requirements

### Requirement: Document files are included in backups
When creating a backup with `include_documents: true`, the system SHALL query all documents from the database, copy their source files into the backup's `documents/` directory, and write each document's metadata as a `metadata.json` file alongside it.

#### Scenario: Full backup includes all documents
- **WHEN** `backup_create` is called with `include_documents: true`
- **THEN** each document from the database is copied to `documents/{doc_id}/{filename}`
- **AND** a `metadata.json` is written to `documents/{doc_id}/metadata.json`
- **AND** the manifest's `files.count` reflects the total number of files

#### Scenario: Document file missing on disk
- **WHEN** a document in the database references a file that does not exist
- **THEN** the missing file is skipped
- **AND** a warning is logged with the document ID and expected path
- **AND** the backup proceeds with remaining documents

#### Scenario: Documents-only backup
- **WHEN** `backup_create` is called with `include_documents: true` and `include_database: false`
- **THEN** only document files are included in the backup
- **AND** the manifest `backup_type` is `"documents"`

### Requirement: Database is exported using SQLite VACUUM INTO
When creating a backup with `include_database: true`, the system SHALL export the live database to a file using SQLite's `VACUUM INTO` command, producing a clean, defragmented copy.

#### Scenario: Database export succeeds
- **WHEN** `backup_create` is called with `include_database: true`
- **THEN** `VACUUM INTO '{temp_dir}/incrementum.db'` is executed against the pool
- **AND** the resulting file contains a valid SQLite database

### Requirement: Database is restored using SQLite online backup API
When restoring a backup that includes a database, the system SHALL use `rusqlite::backup::Backup` to copy the backup database file into the live database, allowing concurrent readers to continue during the restore.

#### Scenario: Database restore replaces live data
- **WHEN** `backup_restore` is called with a backup containing `includes.database: true`
- **THEN** the backup's `incrementum.db` is opened as a source
- **AND** the SQLite backup API copies all pages from source to the live database
- **AND** all existing data is replaced with the backup data

#### Scenario: Restore with active readers
- **WHEN** a database restore is in progress
- **AND** other queries are reading from the database
- **THEN** the restore waits for write access
- **AND** reader queries complete normally before the restore proceeds

### Requirement: Settings are exported as JSON in backups
When creating a backup with `include_settings: true`, the system SHALL serialize the app settings (from the Zustand store's persisted state) to a `settings.json` file in the backup directory.

#### Scenario: Settings included in backup
- **WHEN** `backup_create` is called with `include_settings: true`
- **THEN** a `settings.json` file is written to the backup directory containing all user settings

#### Scenario: Settings restored from backup
- **WHEN** `backup_restore` processes a backup containing `includes.settings: true`
- **THEN** the `settings.json` is read from the backup
- **AND** each setting is applied to the app state (merging with existing settings, backup values take precedence)

### Requirement: backup_list uses the authenticated provider and database
The `backup_list` command SHALL accept `State<Repository>` and `State<CloudAuthProvider>`, use the authenticated provider for the given type, and delegate to `BackupManager::list_backups`.

#### Scenario: List backups from authenticated provider
- **WHEN** `backup_list` is called with an authenticated provider type
- **THEN** the `BackupManager::list_backups` is invoked with the authenticated provider
- **AND** a list of `BackupInfo` is returned

#### Scenario: List backups without authentication
- **WHEN** `backup_list` is called for a provider that is not authenticated
- **THEN** an error is returned indicating the provider must be authenticated first

### Requirement: All backup/restore commands use authenticated providers
The `backup_create`, `backup_restore`, `backup_delete`, `cloud_list_files`, and `cloud_import_files` commands SHALL retrieve the authenticated provider from `State<CloudAuthProvider>` instead of creating fresh unauthenticated instances.

#### Scenario: Backup create with authenticated provider
- **WHEN** `backup_create` is called for an authenticated provider
- **THEN** the stored authenticated provider instance is used for the upload

#### Scenario: Backup create without authentication
- **WHEN** `backup_create` is called for a provider that has no authenticated instance
- **THEN** an error is returned prompting the user to authenticate first

### Requirement: Scheduler uses authenticated provider
The `scheduler_trigger_backup` command SHALL retrieve the authenticated provider from `CloudAuthProvider` state and pass it to `BackupManager::create_backup`.

#### Scenario: Scheduled backup triggers successfully
- **WHEN** `scheduler_trigger_backup` is called
- **AND** a cloud provider is authenticated
- **THEN** a backup is created and uploaded using the authenticated provider

### Requirement: Duplicate sync.rs module is removed
The file `src-tauri/src/sync.rs` SHALL be deleted and all references to it removed from `lib.rs` and `mod.rs`. The `cloud_sync.rs` module is the sole sync implementation.

#### Scenario: sync.rs no longer exists
- **WHEN** the project is compiled
- **THEN** `src-tauri/src/sync.rs` does not exist
- **AND** no `mod sync` declaration for it remains in the module tree
