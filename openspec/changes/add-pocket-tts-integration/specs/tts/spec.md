## ADDED Requirements

### Requirement: Pocket TTS Provider Support
The system SHALL provide Pocket TTS as a local, offline-capable text-to-speech provider that runs on CPU without requiring GPU or internet connectivity.

#### Scenario: User enables Pocket TTS provider
- **WHEN** user selects "Pocket TTS (Local)" in TTS settings
- **THEN** the system initializes the Pocket TTS sidecar binary
- **AND** enables voice selection from 8 pre-built voices
- **AND** TTS controls become available in document viewers

#### Scenario: Pocket TTS unavailable on platform
- **WHEN** Pocket TTS binary is not available for the current platform
- **THEN** the system displays "Pocket TTS unavailable" in settings
- **AND** disables the provider option with explanatory message

### Requirement: Pocket TTS Voice Selection
The system SHALL allow users to select from 8 pre-built Pocket TTS voices: alba, marius, javert, jean, fantine, cosette, eponine, and azelma.

#### Scenario: User selects a Pocket TTS voice
- **WHEN** user selects a voice from the dropdown in TTS settings
- **THEN** the system saves the voice selection to settings
- **AND** subsequent TTS operations use the selected voice
- **AND** the voice persists across app restarts

#### Scenario: Voice preview playback
- **WHEN** user clicks "Preview" button next to a voice
- **THEN** the system plays a short sample audio using that voice
- **AND** shows playback controls during preview

### Requirement: Pocket TTS Audio Streaming
The system SHALL stream synthesized audio from Pocket TTS with low latency, providing the first audio chunk within 500ms of synthesis request.

#### Scenario: User initiates TTS playback for document
- **WHEN** user clicks play in ReaderTTSControls with Pocket TTS enabled
- **THEN** the system extracts text from the current document
- **AND** sends text to Pocket TTS sidecar via IPC
- **AND** begins streaming audio output within 500ms
- **AND** plays audio with smooth chunk buffering

#### Scenario: Long document streaming
- **WHEN** user plays TTS for a document exceeding 5000 characters
- **THEN** the system chunks text into manageable segments
- **AND** streams each segment sequentially
- **AND** provides seamless audio transitions between chunks

### Requirement: Document Text Extraction for TTS
The system SHALL extract plain text content from PDF, EPUB, and Markdown documents for TTS synthesis.

#### Scenario: PDF text extraction
- **WHEN** user initiates TTS playback on a PDF document
- **THEN** the system extracts text from visible pages using PDF.js
- **AND** cleans text of formatting artifacts
- **AND** sends cleaned text to the TTS provider

#### Scenario: EPUB text extraction
- **WHEN** user initiates TTS playback on an EPUB document
- **THEN** the system extracts text from current chapter via epubjs
- **AND** preserves reading order from spine items
- **AND** handles chapter transitions during playback

#### Scenario: Markdown text extraction
- **WHEN** user initiates TTS playback on a Markdown document
- **THEN** the system strips markdown formatting
- **AND** preserves natural reading flow
- **AND** sends plain text to TTS provider

### Requirement: TTS Playback Controls
The system SHALL provide intuitive playback controls for Pocket TTS including play, pause, resume, stop, skip forward, and skip backward.

#### Scenario: Play/pause toggle
- **WHEN** user clicks the play/pause button in TTS controls
- **THEN** if not playing, synthesis begins from current position
- **AND** if playing, audio pauses at current position
- **AND** UI updates to reflect current state

#### Scenario: Skip navigation
- **WHEN** user clicks skip forward/backward buttons
- **THEN** the system advances or rewinds to the next/previous text chunk
- **AND** resumes playback from the new position
- **AND** updates chunk indicator display

### Requirement: TTS Settings Persistence
The system SHALL persist Pocket TTS configuration including selected voice, playback speed, and enabled state.

#### Scenario: Settings persistence across sessions
- **WHEN** user configures Pocket TTS settings
- **THEN** settings are saved to local storage immediately
- **AND** settings are restored on next app launch
- **AND** selected voice remains the default

### Requirement: TTS Error Handling
The system SHALL gracefully handle Pocket TTS errors and provide fallback options.

#### Scenario: Synthesis failure
- **WHEN** Pocket TTS synthesis fails due to error
- **THEN** the system displays an error message in TTS controls
- **AND** offers retry option
- **AND** optionally falls back to Web Speech API if configured

#### Scenario: Sidecar crash recovery
- **WHEN** Pocket TTS sidecar process crashes
- **THEN** the system detects the crash
- **AND** stops current playback
- **AND** displays "TTS service unavailable" message
- **AND** offers restart option in settings
