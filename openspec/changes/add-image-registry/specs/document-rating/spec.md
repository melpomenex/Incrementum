## MODIFIED Requirements

### Requirement: Document Review and Navigation
The system SHALL support rating documents during reading, which triggers rescheduling and navigation, and SHALL allow image-backed flashcard creation from reviewed content using image registry asset references.

#### Scenario: User rates a document after reading
- **Given** the user is viewing a document in the "Document" view mode
- **When** the user selects a rating (Again, Hard, Good, Easy) via the `HoverRatingControls` or keyboard shortcuts
- **Then** the application should submit the rating to the backend with the time spent
- **And** the backend should reschedule the document using FSRS
- **And** the application should automatically navigate to the next document in the queue

#### Scenario: User creates a flashcard with registry images from reviewed content
- **Given** the user is in a flashcard creation flow from reviewed content
- **When** the user selects one or more images from the image registry
- **Then** the flashcard payload MUST include image asset references
- **And** rating/review behavior MUST remain unchanged for FSRS scheduling and navigation
