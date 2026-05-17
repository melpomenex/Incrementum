## ADDED Requirements

### Requirement: Document creation SHALL assign the active collection ID
When a user creates or imports a document while a non-default collection is active, the system SHALL assign that document's `collection_id` to the active collection's ID.

#### Scenario: User adds a document while a non-default collection is active
- **WHEN** user has collection "Work" (non-default) active and adds a new document
- **THEN** the document's `collection_id` SHALL be set to the "Work" collection's ID
- **THEN** the document SHALL appear in the "Work" collection's document list
- **THEN** the document SHALL NOT appear in the default collection's document list

#### Scenario: User imports a document while a non-default collection is active
- **WHEN** user has collection "Work" active and imports a file (PDF, URL, etc.)
- **THEN** the imported document's `collection_id` SHALL be set to the "Work" collection's ID

#### Scenario: User adds a document while the default collection is active
- **WHEN** user has the default collection active and adds a document
- **THEN** the document's `collection_id` SHALL be set to `DEFAULT_COLLECTION_ID` (existing behavior preserved)

### Requirement: Collection switching SHALL scope all data views
When the user switches to a different collection, the system SHALL reload and display only data belonging to that collection across all views: documents, queue, extracts, learning items, and analytics.

#### Scenario: User switches from default to a non-default collection
- **WHEN** user switches from the default collection to "Work"
- **THEN** the document list SHALL show only documents with `collection_id` matching "Work"
- **THEN** the queue SHALL show only due items with `collection_id` matching "Work"
- **THEN** analytics/dashboard SHALL reflect only data from the "Work" collection

#### Scenario: User switches from a non-default collection back to default
- **WHEN** user switches from "Work" back to the default collection
- **THEN** all views SHALL show only data from the default collection

### Requirement: User can export a single collection as a portable archive
The system SHALL allow exporting a single collection as a ZIP archive containing all associated data: collection metadata, documents, files, extracts, learning items (with full FSRS scheduling state), review sessions, review results, and categories.

#### Scenario: User exports a collection
- **WHEN** user selects a collection and chooses "Export Collection"
- **THEN** the system SHALL produce a ZIP file containing:
  - `manifest.json` with archive type `collection`, version, and collection metadata
  - `data/payload.json` with documents, extracts, learning items (including FSRS fields: due_date, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review), review_sessions, review_results, and categories
  - `files/` directory with all document source files
- **THEN** the export SHALL report progress to the user

#### Scenario: Exported collection archive is self-contained
- **WHEN** a collection archive is exported
- **THEN** the archive SHALL contain all data needed to recreate the collection on another machine without access to the original database

### Requirement: User can import a collection archive from another machine
The system SHALL allow importing a collection archive, creating a new collection with all associated data. All entity IDs SHALL be remapped to new UUIDs to prevent collisions with existing data.

#### Scenario: User imports a collection archive on a different machine
- **WHEN** user imports a collection archive ZIP file
- **THEN** the system SHALL create a new collection with a generated UUID
- **THEN** all documents, extracts, learning items, review sessions, review results, and categories SHALL be imported with remapped IDs
- **THEN** all foreign key references between imported entities SHALL be preserved via ID remapping
- **THEN** the document source files SHALL be written to the local file system
- **THEN** the import SHALL NOT affect any existing collections or data

#### Scenario: Imported FSRS scheduling state is preserved
- **WHEN** a collection archive is imported
- **THEN** all learning items SHALL retain their FSRS scheduling state (due_date, stability, difficulty, reps, lapses, state)
- **THEN** the review history SHALL be accessible for the imported collection

#### Scenario: Import handles duplicate collection names
- **WHEN** user imports a collection with a name that already exists
- **THEN** the system SHALL import the collection with a suffixed name (e.g., "Work (imported)")
- **THEN** the import SHALL succeed without overwriting existing data

### Requirement: Dead migration 023 artifacts SHALL be removed
The system SHALL remove the unused `document_collections` junction table and unused columns (`parent_id`, `collection_type`, `filter_query`) from the `collections` table if they exist.

#### Scenario: Migration cleanup runs on app startup
- **WHEN** the app starts and the cleanup migration has not yet run
- **THEN** the `document_collections` table SHALL be dropped if it exists
- **THEN** unused columns from migration 023 SHALL be removed from the `collections` table if they exist
- **THEN** the migration SHALL be idempotent (safe to run multiple times)
