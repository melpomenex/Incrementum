## ADDED Requirements

### Requirement: Insert Podcast into Queue Context Menu
The Podcast Manager SHALL provide a context menu option for podcast episodes to insert them into the incremental reading queue.

#### Scenario: User right-clicks a podcast episode
- **WHEN** the user right-clicks on a podcast episode in the Podcast Manager
- **THEN** a context menu appears containing an "Insert into Queue" option

### Requirement: Podcast Promotion to Document
The system SHALL support promoting a podcast episode to a first-class `Document` record to enable incremental reading management.

#### Scenario: User promotes podcast episode
- **WHEN** the user selects "Insert into Queue" for a podcast episode
- **THEN** the system creates a new `Document` record with the episode's title, audio URL as file path, and "audio" as file type
- **AND** the system sets the document's next reading date to the current time to ensure immediate appearance in the queue

### Requirement: Podcast Document Visibility in Scroll Mode
Promoted podcast episodes SHALL be visible and playable within the "Optimal Queue" (Scroll Mode) viewer.

#### Scenario: User views promoted podcast in Scroll Mode
- **WHEN** the user navigates to the Queue Scroll Page (Scroll Mode)
- **THEN** the promoted podcast episode appears in the sequence of items to review
- **AND** the `AudiobookViewer` is utilized to render the episode content
