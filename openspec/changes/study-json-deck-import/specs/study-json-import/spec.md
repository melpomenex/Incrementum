## ADDED Requirements

### Requirement: Parse Study JSON deck files
The system SHALL parse Study JSON files where the top-level structure is a flat object mapping question strings to card objects. Each card object SHALL contain at minimum: `answer` (string), `deck_name` (string), `subject` (string).

#### Scenario: Valid Study JSON file
- **WHEN** a Study JSON file is parsed with the expected flat-map structure
- **THEN** the system extracts all question-card pairs and returns a structured deck representation with deck_name, subject, and card count

#### Scenario: Invalid JSON format
- **WHEN** a file contains invalid JSON or does not match the expected flat-map structure
- **THEN** the system returns a validation error describing the issue

#### Scenario: Empty deck file
- **WHEN** a valid JSON file contains zero card entries
- **THEN** the system returns a validation warning indicating the deck is empty

### Requirement: Validate Study JSON files before import
The system SHALL validate a Study JSON file and return a summary (deck name, subject, card count, new vs review counts) before committing the import.

#### Scenario: Validation summary
- **WHEN** a valid Study JSON file is validated
- **THEN** the system returns deck_name, subject, total card count, count of cards with review history (review_count > 0), and count of new cards

#### Scenario: Validation failure
- **WHEN** an invalid file is validated
- **THEN** the system returns an error with a human-readable message without performing any database writes

### Requirement: Import cards as LearningItems
The system SHALL create one Document per deck file and one LearningItem per card in the file. LearningItems SHALL preserve scheduling data from the source JSON.

#### Scenario: Import with review history
- **WHEN** a card has `review_count > 0` and valid `due_at`
- **THEN** the LearningItem is created with state=Review, due_date from due_at, interval from interval_days, ease_factor from ease_factor, review_count from repetitions, and lapses from lapse_count

#### Scenario: Import new card
- **WHEN** a card has `review_count == 0` and no due_at
- **THEN** the LearningItem is created with state=New, interval=0, ease_factor=2.5, review_count=0, lapses=0

#### Scenario: Known pile cards
- **WHEN** a card has `known_pile == true`
- **THEN** the LearningItem is created with `is_suspended = true`

### Requirement: Deduplicate on re-import
The system SHALL NOT create duplicate LearningItems when the same file is imported multiple times.

#### Scenario: Re-import of same file
- **WHEN** a Study JSON file that was previously imported is imported again
- **THEN** existing LearningItems for that deck are identified by matching document_id and question text, and no duplicates are created

### Requirement: Preserve unmapable metadata in interaction_metadata
The system SHALL store fields that have no direct LearningItem equivalent (`correct_count`, `missed_count`, `retention_rate`, `manual_review`, `save_for_later`) in the `interaction_metadata` JSON field.

#### Scenario: Metadata preservation
- **WHEN** a card is imported with `correct_count: 5`, `missed_count: 2`, `retention_rate: 0.71`
- **THEN** these values are stored in `interaction_metadata` as a JSON object accessible after import

### Requirement: Expose Tauri commands for import
The system SHALL expose `validate_study_json_file` and `import_study_json_file` Tauri commands following the same patterns as existing import commands (path-based, matching Anki/SuperMemo patterns).

#### Scenario: Validate command
- **WHEN** the frontend calls `validate_study_json_file` with a file path
- **THEN** the system returns a validation result with deck info and card counts without modifying the database

#### Scenario: Import command
- **WHEN** the frontend calls `import_study_json_file` with a file path
- **THEN** the system creates the Document and all LearningItems, returning counts of created items

### Requirement: Accept files via drag-and-drop
The system SHALL accept `.json` files dropped anywhere on the app window. Dropped files SHALL be validated as Study JSON format before importing.

#### Scenario: Valid Study JSON dropped
- **WHEN** a user drops a `.json` file that matches the Study JSON flat-map structure onto the app window
- **THEN** the system validates the file, shows the deck summary, and proceeds with import

#### Scenario: Non-deck JSON dropped
- **WHEN** a user drops a `.json` file that does not match the Study JSON structure (e.g. settings export, collection archive)
- **THEN** the system returns a validation error and does not attempt import

### Requirement: Accept files via file picker
The system SHALL provide a "Study JSON" tab in the EnhancedFilePicker dialog with a file picker filtered to `.json` files.

#### Scenario: File picker import
- **WHEN** a user selects the "Study JSON" tab and picks a `.json` file
- **THEN** the system validates the file, shows the deck summary, and proceeds with import
