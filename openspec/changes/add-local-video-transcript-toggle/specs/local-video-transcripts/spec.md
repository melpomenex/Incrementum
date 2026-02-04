## ADDED Requirements
### Requirement: YouTube-Style Transcript Controls for Local Video
The system SHALL provide a transcript toggle and layout control in the local video viewer that mirrors the YouTube viewer UI.

#### Scenario: Show or hide transcript
- **GIVEN** a user is viewing a local video
- **WHEN** the user toggles the transcript control
- **THEN** the transcript panel SHALL appear or hide without interrupting playback

#### Scenario: Switch transcript layout
- **GIVEN** the transcript panel is visible for a local video
- **WHEN** the user switches the layout control
- **THEN** the transcript panel SHALL move between side-by-side and stacked layouts

### Requirement: Local Video Transcript Panel Behavior
The system SHALL render local video transcripts in a synchronized panel that supports seeking and status messaging.

#### Scenario: Seek from transcript segment
- **GIVEN** a local video transcript is available
- **WHEN** the user clicks a transcript segment
- **THEN** playback SHALL seek to the corresponding timestamp

#### Scenario: Transcript not yet available
- **GIVEN** a local video has no transcript segments
- **WHEN** the transcript panel is opened
- **THEN** the system SHALL show the current transcription status (queued, processing, failed, needs-model, or empty)

### Requirement: Auto-Transcribe Local Videos Using Existing Settings
The system SHALL auto-transcribe local videos on import when enabled, using the user’s current transcription model/profile and language settings, and SHALL run background transcription in a best-effort mode that avoids playback stutter.

#### Scenario: Auto-transcribe on import
- **GIVEN** auto-transcribe local videos is enabled and a compatible model is installed
- **WHEN** the user imports a local video
- **THEN** the system SHALL enqueue background transcription with the configured model and language
- **AND** the transcript SHALL appear once processing completes

#### Scenario: Auto-transcribe without installed model
- **GIVEN** auto-transcribe local videos is enabled and no compatible model is installed
- **WHEN** the user imports a local video
- **THEN** the system SHALL indicate that a model is required and point to transcription settings

#### Scenario: Playback while transcribing
- **GIVEN** a local video is playing
- **WHEN** background transcription is running
- **THEN** playback SHALL remain responsive and the transcription process SHALL yield or slow as needed to avoid stutter

### Requirement: Panels Button Parity for Local Videos
The system SHALL provide a Panels button in the local video viewer that matches the YouTube viewer behavior and exposes bookmarks, chapters, transcript, and extracts.

#### Scenario: Toggle panels
- **GIVEN** a user is viewing a local video
- **WHEN** the user clicks the Panels button
- **THEN** a slide-over panel with video features SHALL open or close
