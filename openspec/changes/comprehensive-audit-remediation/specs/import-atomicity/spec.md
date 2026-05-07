## ADDED Requirements

### Requirement: Legacy import MUST be transactional
The `merge_legacy_database` function SHALL wrap all database writes in a single transaction. If any write fails, all writes SHALL be rolled back.

#### Scenario: Successful legacy import
- **WHEN** a legacy database is imported and all records are valid
- **THEN** all documents, extracts, learning items, review sessions, and review results SHALL be committed together

#### Scenario: Legacy import failure at record N
- **WHEN** the import fails on learning item #500 of 1000 due to a malformed record
- **THEN** none of the 1000 learning items SHALL be in the database (full rollback)

### Requirement: Anki import MUST be transactional
The `import_decks_to_learning_items` function SHALL wrap all card imports and review log entries in a single transaction.

#### Scenario: Anki import failure
- **WHEN** an Anki package import fails on card N
- **THEN** no cards from the package SHALL be present in the database

### Requirement: StudyJSON import MUST be transactional
The `import_study_json_file` function SHALL wrap all database writes in a single transaction.

#### Scenario: StudyJSON import failure
- **WHEN** a StudyJSON import encounters invalid data at any point
- **THEN** all previously-inserted records SHALL be rolled back

### Requirement: Archive import filenames MUST be sanitized
Import functions that extract files from ZIP or 7z archives SHALL sanitize filenames by stripping directory components and rejecting paths containing `..`.

#### Scenario: ZIP archive with path traversal
- **WHEN** a ZIP archive contains an entry with filename `../../.bashrc`
- **THEN** the filename SHALL be sanitized to `.bashrc` or rejected entirely
