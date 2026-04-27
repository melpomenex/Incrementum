## MODIFIED Requirements

### Requirement: Document Review and Navigation
The system SHALL support rating documents during reading, which triggers rescheduling and navigation via orb-style rating buttons positioned on the right side of the document viewer.

#### Scenario: User rates a document using orb buttons
- **WHEN** the user is viewing a document in the "Document" view mode
- **AND** the document is not a PDF, YouTube, or audio type
- **AND** the document has been previously reviewed (has document history)
- **AND** the queue has more than 0 documents
- **THEN** the system SHALL display color-coded circular rating buttons (orb buttons) on the right side of the viewer
- **AND** clicking an orb button SHALL submit the rating to the backend with the time spent
- **AND** the backend SHALL reschedule the document using FSRS-6 engagement-aware scheduling
- **AND** the application SHALL automatically navigate to the next document in the queue

#### Scenario: User rates a document using keyboard shortcuts
- **WHEN** the user is viewing a document in the "Document" view mode
- **AND** the document meets the criteria for showing rating controls
- **THEN** pressing keys 1-4 SHALL submit the corresponding rating (Again/Hard/Good/Easy)
- **AND** the rating SHALL be processed identically to clicking an orb button

#### Scenario: New document shows simplified rating
- **WHEN** the user is viewing a document that has never been reviewed
- **THEN** the system SHALL display a single "Mark as Read" orb button (rating=Good)
- **AND** a Dismiss orb button

## REMOVED Requirements

### Requirement: Hover-based rating controls
**Reason**: Replaced by always-visible orb buttons on the right side of the viewer
**Migration**: Rating is now performed via orb buttons or keyboard shortcuts 1-4. The invisible bottom-of-screen hover zone and the compact floating "Rate" pill button are removed entirely.
