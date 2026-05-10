## ADDED Requirements

### Requirement: Per-page selection fallback
The system SHALL only disable native text selection on pages where the custom geometric selection engine has successfully extracted and indexed text tokens. Pages that have not been indexed or where extraction failed SHALL retain native DOM text selection capability.

#### Scenario: Page with successful token extraction
- **WHEN** the custom selection engine successfully extracts tokens for a page
- **THEN** native text selection SHALL be disabled for that page and the custom selection engine SHALL handle pointer events

#### Scenario: Page with failed token extraction
- **WHEN** the custom selection engine fails to extract tokens for a page (empty text content, viewport not ready, or error)
- **THEN** native text selection SHALL remain active for that page via the PDF.js text layer

### Requirement: Queued selection retry on unindexed pages
When a user initiates a selection on a page that hasn't been indexed yet, the system SHALL trigger token extraction and retry the selection within a timeout window rather than silently dropping the interaction.

#### Scenario: Selection on page not yet indexed
- **WHEN** a user clicks on a page where the custom engine has not yet extracted tokens
- **THEN** the system SHALL trigger token extraction and complete the selection once tokens are available
- **AND** if extraction fails or times out (2 seconds), native text selection SHALL be re-enabled for that page

### Requirement: Extraction failure diagnostics
The system SHALL log clear diagnostic messages when text extraction fails for a page, including the page number and failure reason.

#### Scenario: Token extraction error
- **WHEN** `page.getTextContent()` throws an error or returns no text items
- **THEN** the system SHALL log a warning with the page number and error details
