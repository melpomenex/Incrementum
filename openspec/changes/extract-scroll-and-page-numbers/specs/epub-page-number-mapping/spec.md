## ADDED Requirements

### Requirement: EPUB extracts store approximate page number
When a user creates an extract from an EPUB document, the system SHALL calculate and store an approximate page number derived from the current reading progress percentage and the document's total page count (spine/chapter count). This page number SHALL be persisted in the extract's `page_number` field.

#### Scenario: Creating extract at 25% through a 20-chapter EPUB
- **WHEN** a user selects text in an EPUB document
- **AND** the current reading progress is 25%
- **AND** the EPUB has 20 spine items (total_pages = 20)
- **THEN** the extract's page_number SHALL be set to `Math.ceil(0.25 * 20)` = 5

#### Scenario: Creating extract at beginning of EPUB
- **WHEN** a user selects text at the very start of an EPUB
- **AND** the reading progress is 0%
- **THEN** the extract's page_number SHALL be set to 1 (minimum value)

#### Scenario: Creating extract at end of EPUB
- **WHEN** a user selects text at the very end of an EPUB
- **AND** the reading progress is 100%
- **AND** the EPUB has 15 spine items
- **THEN** the extract's page_number SHALL be set to 15

### Requirement: PDF extracts use selection context page number
When a user creates an extract from a PDF document, the system SHALL use the page number from the PDF selection context (`PdfSelectionContext.pages[0].pageNumber`) as the extract's page number. The system SHALL NOT fall back to the viewer's current page state when the selection context contains page information.

#### Scenario: PDF extract with selection context page number
- **WHEN** a user selects text on page 42 of a PDF document
- **AND** the selection context contains `pages[0].pageNumber = 42`
- **THEN** the extract's page_number SHALL be 42

#### Scenario: PDF extract without selection context page number
- **WHEN** a user creates a PDF extract where the selection context has no page number
- **THEN** the system MAY fall back to the viewer's current page number state

### Requirement: Extract cards display EPUB approximate page number
Extract cards in both scroll mode (ExtractScrollItem) and the extracts list (ExtractsList) SHALL display the page number for EPUB extracts identically to PDF extracts, using the same "Pg. N" / "Page N" format.

#### Scenario: EPUB extract card shows page number in scroll mode
- **WHEN** an EPUB extract with page_number = 7 is displayed in ExtractScrollItem
- **THEN** the card SHALL display "Pg. 7" in the header area

#### Scenario: EPUB extract card shows page number in extracts list
- **WHEN** an EPUB extract with page_number = 7 is displayed in ExtractsList
- **THEN** the card footer SHALL display "Page 7"
