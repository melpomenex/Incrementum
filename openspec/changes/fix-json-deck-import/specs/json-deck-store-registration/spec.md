## ADDED Requirements

### Requirement: Documents-view JSON import registers study deck
After a successful JSON deck import from any Documents-view entry point, the system SHALL register the imported deck in the `studyDeckStore` so it appears in the Decks list.

#### Scenario: Import via drag-and-drop on DocumentsView
- **WHEN** a user drops a `.json` file onto the DocumentsView
- **THEN** the system imports the deck (backend) AND registers a `StudyDeck` in `studyDeckStore` with the returned deck name

#### Scenario: Import via EnhancedFilePicker JSON source
- **WHEN** a user selects the "JSON" source in the EnhancedFilePicker and picks a `.json` file
- **THEN** the system imports the deck (backend) AND registers a `StudyDeck` in `studyDeckStore` with the returned deck name

#### Scenario: Import via local file picker with mixed JSON and regular files
- **WHEN** a user imports files via the local file picker and the selection includes `.json` files
- **THEN** the system imports each JSON deck (backend) AND registers a `StudyDeck` for each in `studyDeckStore`

### Requirement: seedFromDocuments discovers study-json-import documents
The `seedFromDocuments` function SHALL recognize documents tagged with `"study-json-import"` in addition to `"anki-import"`, and seed decks from them when the deck list is empty.

#### Scenario: First load after JSON import with empty deck list
- **WHEN** the app loads with an empty deck list and documents exist with `"study-json-import"` tags
- **THEN** `seedFromDocuments` creates decks from the tag candidates of those documents
