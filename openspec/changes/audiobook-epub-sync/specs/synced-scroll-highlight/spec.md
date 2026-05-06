## ADDED Requirements

### Requirement: Auto-scroll EPUB to current audiobook position
The system SHALL automatically scroll the EPUB to the text passage corresponding to the current audiobook playback time, using the aligned transcript-to-EPUB mapping.

#### Scenario: Playback advances to new segment
- **WHEN** audiobook playback time crosses into a new transcript segment's `startTime`
- **THEN** the EPUB scrolls to bring the corresponding CFI position into view

#### Scenario: User is manually scrolling the EPUB
- **WHEN** the user is actively scrolling or interacting with the EPUB panel
- **THEN** auto-scroll SHALL pause to avoid fighting the user's input
- **AND** auto-scroll resumes after 5 seconds of no user interaction

### Requirement: Highlight current passage in EPUB
The system SHALL highlight the EPUB text passage currently being narrated using epubjs annotations.

#### Scenario: Segment changes during playback
- **WHEN** the active transcript segment changes during playback
- **THEN** the previous highlight is removed and a new highlight appears at the new segment's CFI position

#### Scenario: Playback pauses
- **WHEN** audiobook playback is paused
- **THEN** the current highlight remains visible at the paused position

### Requirement: Click EPUB text to seek audiobook
The system SHALL allow the user to click on text in the EPUB panel to seek the audiobook to the corresponding playback position.

#### Scenario: User clicks highlighted text
- **WHEN** user clicks on the currently highlighted passage
- **THEN** the audiobook seeks to the start time of the corresponding transcript segment

#### Scenario: User clicks non-highlighted text
- **WHEN** user clicks on any text in the EPUB
- **THEN** the system finds the closest transcript segment whose CFI range includes or is nearest to the clicked position
- **AND** seeks the audiobook to that segment's `startTime`

### Requirement: Seek bar updates EPUB position
The system SHALL update the EPUB scroll and highlight when the user seeks the audiobook via the seek bar or chapter navigation.

#### Scenario: User seeks via seek bar
- **WHEN** user drags the audiobook seek bar to a new position
- **THEN** the EPUB scrolls to and highlights the passage at the new time

#### Scenario: User navigates to a different chapter
- **WHEN** user selects a chapter in the audiobook player
- **THEN** the EPUB navigates to the corresponding chapter and highlights the first passage
