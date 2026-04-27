## MODIFIED Requirements

### Requirement: Toast confirmation with edit action
The system SHALL show a toast notification when an extract is successfully created via the instant highlight action, containing a success message and an optional "Edit" action button that opens the full extract editing dialog pre-filled with the created extract's data. The toast SHALL be visible regardless of the active view mode (document view, palette mode, or any other mode).

#### Scenario: Successful highlight shows toast
- **WHEN** an extract is successfully created via the instant highlight action
- **THEN** a success toast appears with the message confirming the highlight was saved and an "Edit" action button

#### Scenario: Toast visible in palette mode
- **WHEN** an extract is created while the user is in palette mode
- **THEN** the success toast is visible above the palette editor

#### Scenario: Toast visible in document view
- **WHEN** an extract is created while the user is in normal document view (PDF, EPUB, HTML, or Markdown)
- **THEN** the success toast is visible above the document content

#### Scenario: Edit action opens pre-filled dialog
- **WHEN** user clicks the "Edit" action button on the highlight toast
- **THEN** the `CreateExtractDialog` opens pre-filled with the extract's content, color, and metadata for editing

#### Scenario: Toast auto-dismisses
- **WHEN** the highlight toast is shown and the user does not interact with it
- **THEN** the toast auto-dismisses after the default timeout (5 seconds)
