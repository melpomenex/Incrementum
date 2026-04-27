## ADDED Requirements

### Requirement: Word-level highlighting synced to TTS playback
The system SHALL highlight each word in the document as it is spoken by TTS.

#### Scenario: Word highlighted during playback
- **WHEN** TTS is playing and reaches word position n in the chunk
- **THEN** word n receives a visible highlight class while the previous word's highlight is removed

#### Scenario: Highlight follows pause and resume
- **WHEN** user pauses TTS then resumes
- **THEN** the highlight resumes from the word that was playing when paused

#### Scenario: Highlight updated on chunk boundary
- **WHEN** TTS advances from chunk n to chunk n+1
- **THEN** the highlight moves to the first word of chunk n+1

### Requirement: Toggleable highlighting from reader controls
The system SHALL provide a toggle button in the reader TTS controls to enable or disable word highlighting.

#### Scenario: Highlight toggle default state
- **WHEN** user opens the TTS controls
- **THEN** word highlighting is off by default

#### Scenario: Toggle on enables highlighting
- **WHEN** user taps the highlight toggle button
- **THEN** word highlighting is enabled for all subsequent TTS playback

#### Scenario: Toggle off disables highlighting
- **WHEN** user taps the highlight toggle button while highlighting is active
- **THEN** all highlights are removed and no new highlights are applied

### Requirement: WordHighlighter maps word offsets to DOM elements
The system SHALL provide a `WordHighlighter` utility that maps word-level character offsets to DOM ranges for each viewer type.

#### Scenario: PDF word mapping from text layer spans
- **WHEN** TTS plays a PDF document with a text layer
- **THEN** the WordHighlighter maps word offsets to `<span>` elements in the PDF.js text layer

#### Scenario: EPUB word mapping from contenteditable ranges
- **WHEN** TTS plays an EPUB document
- **THEN** the WordHighlighter maps word offsets to CFI ranges via the epubjs API

#### Scenario: Markdown word mapping from rendered DOM
- **WHEN** TTS plays a Markdown document
- **THEN** the WordHighlighter maps word offsets to text node ranges in the rendered Markdown

### Requirement: Graceful fallback to chunk-level highlighting
The system SHALL fall back to highlighting the entire current chunk when word-level mapping is unreliable.

#### Scenario: PDF without text layer falls back to chunk
- **WHEN** PDF has no extractable text layer (OCR-only or scanned)
- **THEN** the entire chunk's text area is highlighted instead of individual words

#### Scenario: Unparseable DOM structure falls back to chunk
- **WHEN** the rendered document's DOM structure prevents word-to-element mapping
- **THEN** chunk-level highlighting is used as a fallback
