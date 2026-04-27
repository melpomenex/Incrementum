## ADDED Requirements

### Requirement: Instant highlight creation without dialog
When a user triggers the highlight action from any viewer (PDF selection popup, EPUB selection, HTML selection, RSS selection, or viewer toolbar), the system SHALL create the extract immediately without opening a modal dialog.

#### Scenario: PDF highlight via selection popup
- **WHEN** user selects text in a PDF and clicks the "Highlight" button in the `SelectionPopup`
- **THEN** the system creates an extract with the selected text using the default highlight color, flashes the selection, and shows a success toast notification

#### Scenario: EPUB highlight via selection
- **WHEN** user selects text in an EPUB and triggers the highlight action
- **THEN** the system creates an extract with the selected text using the default highlight color and shows a success toast notification

#### Scenario: HTML/Markdown viewer highlight
- **WHEN** user selects text in the HTML/Markdown viewer and triggers the highlight action
- **THEN** the system creates an extract with the selected text using the default highlight color and shows a success toast notification

#### Scenario: RSS article highlight
- **WHEN** user selects text in an RSS article and triggers the highlight action
- **THEN** the system creates an extract with the selected text using the default highlight color and shows a success toast notification

### Requirement: Toast confirmation with edit action
The system SHALL show a toast notification when an extract is successfully created, containing a success message and an optional "Edit" action button that opens the full extract editing dialog pre-filled with the created extract's data.

#### Scenario: Successful highlight shows toast
- **WHEN** an extract is successfully created via the instant highlight action
- **THEN** a success toast appears with the message confirming the highlight was saved and an "Edit" action button

#### Scenario: Edit action opens pre-filled dialog
- **WHEN** user clicks the "Edit" action button on the highlight toast
- **THEN** the `CreateExtractDialog` opens pre-filled with the extract's content, color, and metadata for editing

#### Scenario: Toast auto-dismisses
- **WHEN** the highlight toast is shown and the user does not interact with it
- **THEN** the toast auto-dismisses after the default timeout (5 seconds)

### Requirement: Default highlight color
The system SHALL use the user's last-selected highlight color as the default when creating extracts without the dialog. If no previous color exists, the system SHALL use yellow as the default.

#### Scenario: First highlight uses default yellow
- **WHEN** a user creates their first highlight and no previous color preference exists
- **THEN** the extract is created with yellow as the highlight color

#### Scenario: Subsequent highlights use last color
- **WHEN** a user creates a highlight and their last-used highlight color was blue
- **THEN** the extract is created with blue as the highlight color

### Requirement: Full dialog remains accessible
The `CreateExtractDialog` SHALL remain accessible via the toast "Edit" action button and the extracts sidebar. A user preference or modifier key (e.g., Shift+click) SHALL allow opening the full dialog directly instead of the instant toast flow.

#### Scenario: Shift+click opens full dialog
- **WHEN** user holds Shift and clicks the "Highlight" button in the selection popup
- **THEN** the full `CreateExtractDialog` opens with the selected text pre-filled

#### Scenario: Edit from extracts sidebar
- **WHEN** user clicks an extract in the extracts sidebar
- **THEN** the full `EditExtractDialog` opens for that extract

### Requirement: Extraction error shows error toast
If the extract creation fails, the system SHALL show an error toast notification instead of the success toast.

#### Scenario: Failed extraction shows error toast
- **WHEN** an extract creation fails due to a backend error
- **THEN** an error toast appears with a descriptive error message
