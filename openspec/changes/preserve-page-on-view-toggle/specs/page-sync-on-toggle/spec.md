## ADDED Requirements

### Requirement: Page preserved on toggle from HTML to PDF
When a user is viewing a PDF document in HTML (OCR) mode and toggles back to PDF mode, the system SHALL navigate the PDF viewer to the same page number that was visible in HTML view.

#### Scenario: Toggle from HTML page 14 to PDF
- **WHEN** a user is viewing page 14 of a PDF in HTML (OCR) mode
- **AND** the user clicks the "PDF" toggle button
- **THEN** the PDF viewer SHALL render and scroll to page 14

#### Scenario: Toggle from HTML page 1 to PDF
- **WHEN** a user is viewing page 1 of a PDF in HTML (OCR) mode
- **AND** the user clicks the "PDF" toggle button
- **THEN** the PDF viewer SHALL render and scroll to page 1

#### Scenario: Toggle from HTML last page to PDF
- **WHEN** a user is viewing the last page of a PDF in HTML (OCR) mode
- **AND** the user clicks the "PDF" toggle button
- **THEN** the PDF viewer SHALL render and scroll to that last page

### Requirement: Normal position restoration unaffected
When a PDF document is opened fresh (not from a toggle), the system SHALL restore the last-saved scroll position from localStorage, independent of the page-sync-on-toggle mechanism.

#### Scenario: Opening a PDF document directly
- **WHEN** a user opens a PDF document that has a previously saved scroll position at page 5
- **THEN** the PDF viewer SHALL restore to page 5 as normal

### Requirement: Toggle from PDF to HTML preserves page
When a user toggles from PDF view to HTML view, the system SHALL maintain the current page number state so it is available if the user toggles back.

#### Scenario: Toggle PDF to HTML and back
- **WHEN** a user is on page 7 in PDF view
- **AND** toggles to HTML view (which scrolls to show page 7 content)
- **AND** then toggles back to PDF view
- **THEN** the PDF viewer SHALL render page 7
