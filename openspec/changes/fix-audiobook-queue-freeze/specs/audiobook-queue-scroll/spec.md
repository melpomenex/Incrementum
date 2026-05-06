## ADDED Requirements

### Requirement: Audio documents skip synchronous media probing in scroll mode
When a document with `documentFileType === "audio"` is loaded in queue scroll mode, the system SHALL NOT call `probeMediaSource()` or `resolveLocalMediaSource()`. Instead, it SHALL pass the file path directly to the audiobook viewer for self-initialization.

#### Scenario: Audiobook encountered in queue scroll mode
- **WHEN** queue scroll mode renders a document with type "audio"
- **THEN** the DocumentViewer SHALL skip `resolveLocalMediaSource()` and pass the file path to AudiobookViewer without synchronous DOM probing

#### Scenario: Non-audio document in queue scroll mode
- **WHEN** queue scroll mode renders a non-audio document (PDF, EPUB, etc.)
- **THEN** the existing document loading flow SHALL remain unchanged

### Requirement: Audio documents exempt from scroll-mode auto-advance
The queue scroll mode wheel handler SHALL treat audio documents the same as EPUB and PDF — wheel events SHALL NOT trigger auto-advance to the next queue item.

#### Scenario: User scrolls wheel on audiobook in queue scroll mode
- **WHEN** the current queue scroll item is an audio document and the user triggers a mouse wheel event
- **THEN** the system SHALL NOT auto-advance to the next item

#### Scenario: User explicitly navigates away from audiobook
- **WHEN** the current queue scroll item is an audio document and the user presses the keyboard navigation key (Down/Up) or uses the navigation buttons
- **THEN** the system SHALL navigate to the next/previous item normally

### Requirement: Loading indicator for audiobook initialization
When an audiobook is loading in queue scroll mode, the system SHALL display a loading state until the audio player is ready for interaction.

#### Scenario: Audiobook loading in scroll mode
- **WHEN** queue scroll mode renders an audio document and the AudiobookViewer has not yet finished initializing
- **THEN** a loading placeholder or skeleton SHALL be visible

#### Scenario: Audiobook finished loading
- **WHEN** the AudiobookViewer has completed initialization
- **THEN** the full audiobook player SHALL be displayed
