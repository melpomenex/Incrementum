## ADDED Requirements

### Requirement: Document highlights are persisted and re-rendered in supported readers
When a user highlights selected text in a supported document reader, the system SHALL persist that highlight and re-render it when the document is opened again.

#### Scenario: PDF highlight survives reload
- **GIVEN** a PDF document is open and text selection is available
- **WHEN** the user highlights a selection and closes and reopens the document
- **THEN** the same text range SHALL be highlighted again in the PDF viewer
- **AND** the persisted highlight SHALL keep the previously selected color

#### Scenario: Supported reader rehydrates persisted highlight
- **GIVEN** a persisted extract/highlight record exists with valid locator metadata for the current reader format
- **WHEN** the reader loads the document
- **THEN** the reader SHALL render an in-document highlight at the stored location

#### Scenario: EPUB highlight survives reload
- **GIVEN** an EPUB document is open
- **WHEN** the user highlights a selection and later reopens the same EPUB
- **THEN** the system SHALL restore the highlight at the persisted EPUB location
- **AND** the saved highlight color SHALL be preserved

#### Scenario: HTML or Markdown highlight survives reload
- **GIVEN** an `.html` or `.md` document is open
- **WHEN** the user highlights a selection and later reopens the same document
- **THEN** the system SHALL restore the highlight at the persisted location in that document view
- **AND** the saved highlight color SHALL be preserved

#### Scenario: Locator metadata is missing or invalid
- **GIVEN** an extract has a highlight color but no valid locator metadata for the current reader format
- **WHEN** the reader loads the document
- **THEN** the reader SHALL not crash
- **AND** the extract MAY remain visible in extract lists without an in-document overlay

### Requirement: Highlight actions persist through the extract model
The system SHALL use the persisted extract model as the source of truth for document highlights, including highlight color and categorization metadata.

#### Scenario: Highlight creates persisted extract-backed record
- **WHEN** the user highlights selected text from the document viewer
- **THEN** the system SHALL create or update a persisted extract-backed record for that selection
- **AND** the record SHALL include the selected highlight color
- **AND** the record MAY include category, tags, and notes entered by the user

#### Scenario: Highlight is visible after application restart
- **GIVEN** a highlight was previously created successfully
- **WHEN** the application restarts and the user opens the same supported document
- **THEN** the highlight SHALL be restored from persisted extract data rather than session-local viewer state

### Requirement: Extract views support persisted highlighting
The system SHALL support persistent multi-color highlighting inside extract content views.

#### Scenario: Extract highlight survives reload
- **GIVEN** an extract is open in an extract reading or editing surface
- **WHEN** the user highlights a text range inside that extract and later reloads the extract view
- **THEN** the system SHALL restore that highlight in the extract content
- **AND** the saved highlight color and categorization metadata SHALL remain attached to the extract-backed record

#### Scenario: Extract content changed after highlight creation
- **GIVEN** an extract contains a persisted highlight range
- **WHEN** the extract content is later edited so that the stored range can no longer be resolved exactly
- **THEN** the system SHALL fail gracefully without crashing
- **AND** the highlight MAY be hidden or marked stale until it is re-anchored

### Requirement: Unsupported formats are not overstated as implemented
The system SHALL only present reader-highlighting as implemented for document formats that can persist and re-render stable highlight locations.

#### Scenario: Format lacks stable persisted locator support
- **WHEN** a document format cannot round-trip highlight location data reliably
- **THEN** the product documentation and feature status SHALL NOT describe persistent reader highlighting for that format as implemented
