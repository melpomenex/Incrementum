## ADDED Requirements

### Requirement: PDF Text Layer Selection Availability
The system SHALL expose the PDF text layer as a selectable surface when the rendered page contains accessible text, so text-backed PDFs behave like normal browser-readable documents for selection and copying.

#### Scenario: Text selection succeeds on text-based PDF pages
- **WHEN** a user drags or long-presses over text on a PDF page that has a text layer
- **THEN** the viewer SHALL preserve a browser text selection with non-empty selected text
- **THEN** the viewer SHALL keep the selection mapped to PDF selection context for downstream actions

#### Scenario: Text can be copied from a text-backed PDF page
- **WHEN** a user selects text on a PDF page that has a text layer and invokes copy using normal platform behavior
- **THEN** the copied text SHALL match the selected PDF text
- **THEN** the viewer SHALL not require a separate custom export step just to copy the selected text

#### Scenario: No selectable layer on image-only pages
- **WHEN** a user attempts to select text on a PDF page that has no text layer
- **THEN** the viewer SHALL not surface a false text selection
- **THEN** extract creation from selection SHALL remain disabled until selectable text exists

### Requirement: Selection Ergonomics in PDF Reader
The system SHALL provide stable, low-friction selection behavior across mouse and touch interactions for text-layer PDFs.

#### Scenario: Selection persists through pointer release
- **WHEN** the user completes a text selection gesture in the PDF viewer
- **THEN** the selected text SHALL remain available after pointer release long enough for extract actions
- **THEN** the selection SHALL not be immediately cleared by viewer drag/scroll handlers

#### Scenario: Selection remains constrained to PDF content
- **WHEN** a selection intersects PDF content and non-PDF UI regions
- **THEN** only text originating from the PDF text layer SHALL be used for PDF extract context
- **THEN** non-PDF UI text SHALL be excluded from the resulting PDF selection context

### Requirement: Extract Creation from PDF Selection
The system SHALL allow users to create extracts directly from selected PDF text without additional copy/paste steps.

#### Scenario: Extract dialog is prefilled from PDF selection
- **WHEN** a user selects PDF text and invokes extract creation
- **THEN** the extract creation flow SHALL open with the selected text prefilled as extract content
- **THEN** the extract metadata SHALL include current document and page context when available

#### Scenario: PDF selection can become a learning item
- **WHEN** a user selects text from a text-backed PDF and starts a learning-item or flashcard creation flow from that selection
- **THEN** the selected PDF text SHALL be available to that flow without requiring manual re-entry
- **THEN** the flow SHALL retain the PDF selection context needed to associate the learning item with the source document when available

#### Scenario: Empty or invalid selection cannot create extract
- **WHEN** the current PDF selection is empty, collapsed, or outside the PDF text layer
- **THEN** extract creation from selection SHALL not be triggered
