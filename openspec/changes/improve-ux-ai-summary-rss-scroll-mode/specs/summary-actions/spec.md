## ADDED Requirements

### Requirement: Copy summary to clipboard

The system SHALL provide a one-click button to copy the summary content to clipboard.

#### Scenario: User clicks copy button

- **GIVEN** a summary is displayed in the panel
- **WHEN** the user clicks the copy button in the panel footer
- **THEN** the full summary text SHALL be copied to the system clipboard
- **AND** a success toast notification SHALL appear

#### Scenario: Copy with fallback for older browsers

- **GIVEN** the modern clipboard API is unavailable
- **WHEN** the user clicks copy
- **THEN** the system SHALL fall back to `document.execCommand('copy')`
- **AND** if both methods fail, an error toast SHALL appear

#### Scenario: Copy button visual feedback

- **WHEN** the copy action succeeds
- **THEN** the copy button SHALL show a checkmark icon temporarily (2 seconds)
- **AND** then SHALL revert to the copy icon

### Requirement: Save summary as extract

The system SHALL provide a button to save the summary as an extract in the knowledge base.

#### Scenario: User clicks save as extract

- **GIVEN** a summary is displayed
- **WHEN** the user clicks "Save as Extract" button
- **THEN** the system SHALL create a new extract with:
  - Content: the summary text
  - Tags: ["ai-summary", "rss"]
  - Source: reference to the RSS article
  - Title: derived from article title + " (AI Summary)"

#### Scenario: Extract creation success

- **WHEN** the extract is successfully created
- **THEN** a success toast SHALL appear with "Summary saved as extract"
- **AND** the extract SHALL be available in the user's extract list

#### Scenario: Extract creation failure

- **GIVEN** extract creation fails (e.g., network error)
- **WHEN** the save action fails
- **THEN** an error toast SHALL appear with the failure reason
- **AND** the user SHALL be able to retry

### Requirement: Share summary via system share dialog

The system SHALL provide a share button that opens the system share dialog on supported platforms.

#### Scenario: User clicks share on mobile/PWA

- **GIVEN** the device supports the Web Share API
- **WHEN** the user clicks the share button
- **THEN** the system share dialog SHALL open
- **AND** it SHALL be pre-populated with:
  - Title: Article title + " - Summary"
  - Text: The summary content
  - URL: The original article link (if available)

#### Scenario: Share on desktop without Web Share API

- **GIVEN** the device does not support Web Share API
- **WHEN** the user clicks share
- **THEN** the summary text and article URL SHALL be copied to clipboard
- **AND** a toast SHALL indicate "Copied for sharing"

#### Scenario: Share button availability

- **WHEN** the summary panel is open with content
- **THEN** the share button SHALL be visible in the footer
- **AND** it SHALL be disabled while summary is generating

### Requirement: Summary export to document

The system SHALL allow exporting the summary as a new document.

#### Scenario: User clicks export to document

- **GIVEN** a summary is displayed
- **WHEN** the user clicks "Export to Document" from the actions menu
- **THEN** a new document SHALL be created with:
  - Title: Article title + " (Summary)"
  - Content: Full article content + "---\n\nAI Summary:\n\n" + summary text
  - Source: Article URL
  - Tags: ["rss", "summary", "ai-generated"]

#### Scenario: Export with existing document check

- **GIVEN** a document already exists for this article
- **WHEN** the user clicks export
- **THEN** a dialog SHALL ask whether to:
  - Update the existing document with the summary
  - Create a new separate document
  - Cancel the operation
