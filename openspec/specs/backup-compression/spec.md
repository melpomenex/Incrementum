## ADDED Requirements

### Requirement: Backups are compressed using the Rust zip crate
When a backup is created with `compress: true`, the system SHALL create a ZIP archive using the `zip` Rust crate's `ZipWriter`, recursively adding all files from the backup directory. The system SHALL NOT shell out to the system `zip` command.

#### Scenario: Compressed backup creation
- **WHEN** `backup_create` is called with `compress: true`
- **THEN** a ZIP file is created using `zip::ZipWriter`
- **AND** all files in the backup directory (database, documents, manifest, settings) are added
- **AND** the manifest is included at the root of the archive
- **AND** the uncompressed directory is removed after successful compression

#### Scenario: Compression on Windows
- **WHEN** `backup_create` is called with `compress: true` on Windows
- **THEN** compression succeeds using the Rust `zip` crate without requiring any external tools

### Requirement: Compressed backups are extracted using the Rust zip crate
When restoring a compressed backup (filename ends with `.zip`), the system SHALL extract the archive using `zip::ZipArchive` without shelling out to the system `unzip` command.

#### Scenario: Extraction of compressed backup
- **WHEN** `backup_restore` downloads a file ending with `.zip`
- **THEN** the archive is extracted using `zip::ZipArchive::new`
- **AND** all files are written to the extraction directory preserving relative paths
- **AND** the ZIP file is removed after successful extraction

#### Scenario: Extraction on Windows
- **WHEN** a compressed backup is restored on Windows
- **THEN** extraction succeeds using the Rust `zip` crate without requiring any external tools

### Requirement: Backup manifest is readable from compressed archives
The `list_backups` operation SHALL be able to read the `manifest.json` from compressed backup files without fully extracting the archive.

#### Scenario: Read manifest from ZIP
- **WHEN** `list_backups` encounters a `.zip` backup file
- **THEN** it opens the ZIP archive and reads only `manifest.json`
- **AND** parses the manifest to return `BackupInfo` metadata
- **AND** does not extract the entire archive
