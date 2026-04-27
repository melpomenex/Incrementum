## MODIFIED Requirements

### Requirement: Document Review and Navigation
The system SHALL support rating documents during reading, which triggers rescheduling and navigation. When DocumentViewer is rendered inside QueueScrollPage (Scroll Mode), the orb rating buttons inside DocumentViewer SHALL be hidden; rating is handled exclusively by QueueScrollPage's side rating controls.

#### Scenario: User rates a document in standalone Document view
- **WHEN** the user is viewing a document in the "Document" view mode (not in Scroll Mode)
- **THEN** DocumentViewer SHALL display its orb rating buttons
- **AND** the rating flow proceeds as before (submit, reschedule, navigate)

#### Scenario: User views a document in Scroll Mode
- **WHEN** the user is in QueueScrollPage viewing a document
- **THEN** DocumentViewer SHALL NOT display its orb rating buttons
- **AND** QueueScrollPage's side rating controls SHALL be the only visible rating UI for that document
