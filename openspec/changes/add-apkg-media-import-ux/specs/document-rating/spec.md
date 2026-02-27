## MODIFIED Requirements

### Requirement: Document Review and Navigation
The system SHALL support rating documents during reading, which triggers rescheduling and navigation, and SHALL render APKG-imported media attached to learning items with stable visual behavior.

#### Scenario: User rates a document after reading
- **Given** the user is viewing a document in the "Document" view mode
- **When** the user selects a rating (Again, Hard, Good, Easy) via the `HoverRatingControls` or keyboard shortcuts
- **Then** the application should submit the rating to the backend with the time spent
- **And** the backend should reschedule the document using FSRS
- **And** the application should automatically navigate to the next document in the queue

#### Scenario: APKG-imported card displays attached media during review
- **Given** a learning item created from APKG import includes attached media references
- **When** the user reviews that learning item
- **Then** the review UI MUST render attached media in a consistent layout
- **And** media rendering MUST NOT alter rating controls or scheduling behavior
