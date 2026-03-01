## ADDED Requirements
### Requirement: Podcast and Audio File Import
The system SHALL support `.mp3` and `.m4a` import workflows that transcribe audio locally and integrate transcripts into document/extract pipelines.

#### Scenario: User imports podcast audio
- **WHEN** a user imports an `.mp3` or `.m4a` file
- **THEN** the system transcribes the file locally
- **AND** creates a document entity with transcript-backed reading/extract context

### Requirement: Pre-Highlighted PDF Extraction
The system SHALL detect and import existing PDF highlights/annotations as extract candidates during PDF import.

#### Scenario: User imports PDF with existing highlights
- **WHEN** a PDF containing embedded highlight annotations is imported
- **THEN** the system extracts highlights as candidate extracts/cards

### Requirement: Clipboard Watcher Quick Add
The system SHALL offer a quick-add capture flow when system clipboard text changes and the watcher is enabled.

#### Scenario: User copies text outside the app
- **WHEN** clipboard watcher is enabled and copied text is detected
- **THEN** the system offers a quick-add option to create a card or extract

### Requirement: Inline Dictionary and Thesaurus Lookup
The system SHALL provide inline dictionary/thesaurus lookup in reading contexts and allow direct vocabulary-card creation from lookup results.

#### Scenario: User looks up a word while reading
- **WHEN** a user requests lookup for a selected word
- **THEN** the system displays definition/synonym information
- **AND** the user can create a vocabulary card from that result

### Requirement: Zotero and Mendeley Integration
The system SHALL support importing documents and metadata from Zotero and Mendeley libraries.

#### Scenario: User imports a paper from reference manager
- **WHEN** a user connects a Zotero or Mendeley source and imports an item
- **THEN** the system stores author, year, venue, and citation metadata with the document

### Requirement: Bidirectional Logseq Integration
The system SHALL support bidirectional synchronization with Logseq for linked notes and study artifacts.

#### Scenario: User syncs with Logseq
- **WHEN** the user runs sync for an existing Logseq connection
- **THEN** Incrementum exports eligible notes/cards and imports remote changes without duplicating linked entities
