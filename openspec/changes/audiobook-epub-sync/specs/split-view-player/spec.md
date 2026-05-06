## ADDED Requirements

### Requirement: Side-by-side audiobook and EPUB layout
The system SHALL display a split-screen view with the audiobook player on the left and the EPUB viewer on the right, separated by a draggable resize handle.

#### Scenario: User opens split view
- **WHEN** user clicks "Read Along" on an audiobook with a linked EPUB
- **THEN** the system opens a split-screen view: audiobook player (left) and EPUB viewer (right)

#### Scenario: User resizes the split
- **WHEN** user drags the resize handle between the two panels
- **THEN** both panels adjust their widths proportionally
- **AND** the minimum width of each panel SHALL be 320px

### Requirement: Audiobook controls remain functional in split view
The system SHALL provide full audiobook playback controls (play/pause, seek, skip, speed, volume) within the split view's audio panel.

#### Scenario: User controls playback in split view
- **WHEN** user interacts with play/pause, seek bar, or speed controls in the split view
- **THEN** the audiobook responds identically to the standalone audiobook viewer

### Requirement: EPUB navigation remains functional in split view
The system SHALL allow standard EPUB interactions (scrolling, TOC navigation, font size adjustment, text selection) within the split view's EPUB panel.

#### Scenario: User scrolls or navigates EPUB in split view
- **WHEN** user scrolls or uses the TOC in the EPUB panel
- **THEN** the EPUB responds normally and auto-sync pauses until playback catches up

### Requirement: Exit split view
The system SHALL provide a way to exit the split view and return to the standalone audiobook viewer.

#### Scenario: User exits split view
- **WHEN** user clicks the close/exit button in the split view
- **THEN** the system returns to the standalone audiobook viewer
- **AND** playback continues without interruption
