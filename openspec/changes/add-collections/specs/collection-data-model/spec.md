## ADDED Requirements

### Requirement: Collections table
The system SHALL maintain a `collections` table with columns: `id` (TEXT PK, UUID), `name` (TEXT NOT NULL), `icon` (TEXT, nullable), `color` (TEXT, nullable), `created_at` (TEXT, ISO 8601), `updated_at` (TEXT, ISO 8601).

#### Scenario: Create a new collection
- **WHEN** the system creates a new collection with name "School"
- **THEN** a row is inserted into `collections` with a generated UUID, the provided name, and current timestamps

#### Scenario: Collection name is required
- **WHEN** a collection is created without a name
- **THEN** the system SHALL reject the operation with a validation error

### Requirement: Collection ID on core tables
The system SHALL add a `collection_id` column (TEXT NOT NULL, FK to `collections.id`) to the following tables: `documents`, `extracts`, `learning_items`, `review_sessions`, `review_results`, `annotations`, `categories`, `transcripts`, `transcript_segments`. Each column SHALL have an index for query performance.

#### Scenario: New document is assigned to collection
- **WHEN** a document is created while collection "Work" is active
- **THEN** the document row SHALL have `collection_id` set to the "Work" collection's ID

#### Scenario: Existing data migration
- **WHEN** the migration runs on an existing database
- **THEN** all existing rows in core tables SHALL have `collection_id` set to the default "Personal" collection ID

### Requirement: Default personal collection
The system SHALL create a default collection named "Personal" during migration. This collection SHALL NOT be deletable.

#### Scenario: Fresh install
- **WHEN** the app starts for the first time
- **THEN** a "Personal" collection SHALL exist and be the active collection

#### Scenario: Default collection deletion prevention
- **WHEN** a user attempts to delete the "Personal" collection
- **THEN** the system SHALL reject the deletion and display an error

### Requirement: Collection CRUD operations
The system SHALL support creating, reading, updating (rename, icon, color), and deleting collections via Tauri commands. All operations SHALL be exposed as IPC commands callable from the frontend.

#### Scenario: List all collections
- **WHEN** the frontend requests all collections
- **THEN** the system SHALL return an ordered list of all collections including the default "Personal" collection

#### Scenario: Rename a collection
- **WHEN** the user renames collection "Work" to "Professional"
- **THEN** the collection's `name` and `updated_at` fields SHALL be updated

#### Scenario: Delete a non-default collection
- **WHEN** the user deletes a collection that is not "Personal"
- **THEN** all associated data (documents, extracts, learning items, etc.) SHALL be reassigned to the "Personal" collection, and the collection row SHALL be removed

### Requirement: Collection-aware repository queries
The repository layer SHALL accept a `collection_id` parameter on all queries that read from or write to core tables. Queries that do not specify a `collection_id` SHALL use the currently active collection.

#### Scenario: Get due learning items for active collection
- **WHEN** due items are requested with collection "School" active
- **THEN** only learning items with `collection_id` matching "School" SHALL be returned

#### Scenario: Create extract in active collection
- **WHEN** an extract is created without specifying a collection
- **THEN** the extract SHALL be assigned to the currently active collection
