## ADDED Requirements

### Requirement: PDF OCR Auto-Extract
System SHALL immediately create an extract from OCR text when a user completes an OCR region selection on a PDF, without presenting an editing modal.

#### Scenario: User OCRs a region with successful text detection
- GIVEN a user selects a region in a PDF viewer and OCR completes with non-empty text
- WHEN the OCR result is received
- THEN the system SHALL create a new extract with the OCR text as content
- AND the system SHALL exit OCR mode
- AND the system SHALL display a confirmation toast

#### Scenario: User OCRs a region with empty/failed text detection
- GIVEN a user selects a region in a PDF viewer and OCR completes with empty text
- WHEN the OCR result is received
- THEN the system SHALL show the OcrTextPreview panel with retry controls
- AND the system SHALL NOT create an extract

### Requirement: OCR Extract Edit Action
System SHALL provide an "Edit" action on the OCR extraction toast that opens the CreateExtractDialog pre-filled with the newly created extract's data.

#### Scenario: User clicks Edit on the OCR toast
- GIVEN an extract was auto-created from OCR and a confirmation toast is displayed
- WHEN the user clicks the "Edit" button on the toast
- THEN the system SHALL open the CreateExtractDialog
- AND the dialog SHALL be pre-filled with the OCR text as content
- AND the dialog SHALL reference the just-created extract for editing

### Requirement: OCR Extract Confirmation Toast
System SHALL display a confirmation toast after auto-creating an extract from OCR, including the extract's content preview and an Edit action.

#### Scenario: Toast content
- GIVEN an extract was auto-created from OCR
- WHEN the toast is displayed
- THEN the toast SHALL show a brief preview of the extracted text (truncated)
- AND the toast SHALL include an "Edit" button
- AND the toast SHALL auto-dismiss after a reasonable timeout

## MODIFIED Requirements

### Requirement: OCR Result Flow (was: OcrTextPreview mandatory)
- PREVIOUSLY: System showed OcrTextPreview edit panel after every successful OCR
- NOW: System SHALL skip the OcrTextPreview panel on successful OCR and auto-create the extract
- OcrTextPreview SHALL only appear in error/retry scenarios
