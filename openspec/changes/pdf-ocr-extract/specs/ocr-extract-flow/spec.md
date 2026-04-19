## ADDED Requirements

### Requirement: OCR processing with progress feedback
The system SHALL run OCR on the captured canvas region using Tesseract.js and display processing progress to the user.

#### Scenario: OCR processing starts
- **WHEN** the user confirms the region selection for OCR
- **THEN** a progress indicator is displayed over the selected region showing the current OCR processing stage and percentage

#### Scenario: OCR completes successfully
- **WHEN** Tesseract.js finishes processing the captured image
- **THEN** the progress indicator is replaced by a text preview panel displaying the recognized text with OCR confidence score

#### Scenario: OCR fails or returns no text
- **WHEN** OCR processing encounters an error or returns empty text
- **THEN** an error message is displayed to the user explaining the failure, with a "Retry" option and the ability to try a different region

### Requirement: Editable text preview before extract
The system SHALL present an editable text preview of the OCR result before opening the Extract Modal.

#### Scenario: User reviews OCR text
- **WHEN** OCR completes successfully
- **THEN** an editable textarea is displayed below the selected region containing the recognized text, along with the confidence score and a "Create Extract" button

#### Scenario: User edits OCR text
- **WHEN** the user modifies text in the preview textarea
- **THEN** the edited text SHALL be used when creating the extract (not the raw OCR output)

#### Scenario: User retries OCR on same region
- **WHEN** the user clicks "Retry"
- **THEN** the system re-runs OCR on the same captured region image

### Requirement: Extract creation from OCR text
The system SHALL open the existing CreateExtractDialog pre-populated with the OCR'd text (or user-edited version) and the current page number.

#### Scenario: User creates extract from OCR result
- **WHEN** the user clicks "Create Extract" in the preview panel
- **THEN** the CreateExtractDialog opens with `selectedText` set to the preview text, `pageNumber` set to the current PDF page, and `selectionContext` set to null (no PDF text coordinates since this is OCR)

#### Scenario: Extract is created successfully
- **WHEN** the user submits the CreateExtractDialog
- **THEN** the extract is created with the OCR text as content, the region preview is dismissed, and the user exits OCR mode

### Requirement: Multi-language OCR support
The system SHALL allow the user to select an OCR language before or during region selection.

#### Scenario: User selects OCR language
- **WHEN** the user clicks the language selector in the OCR toolbar or preview panel
- **THEN** a dropdown of available languages (from the existing OCRLanguage enum) is shown, and the selected language is used for subsequent OCR operations
