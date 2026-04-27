## ADDED Requirements

### Requirement: TTS starts from document position
The system SHALL start TTS playback from the user's current reading position in the document rather than from the beginning.

#### Scenario: PDF page-based resume
- **WHEN** user is viewing PDF page 146 and taps Play on the TTS controls
- **THEN** TTS begins reading from the first chunk of page 146's text content

#### Scenario: EPUB CFI-based resume
- **WHEN** user has an EPUB open at CFI `/6/4[chap01ref]!/4/2/1:0` and taps Play
- **THEN** TTS begins reading from the text corresponding to that CFI position

#### Scenario: Scroll-based document resume
- **WHEN** user has scrolled to 42% in a Markdown document and taps Play
- **THEN** TTS begins reading from the text at approximately 42% of the document content

#### Scenario: Position-aware play from controls
- **WHEN** user changes position (page/scroll/CFI) while TTS is stopped, then taps Play
- **THEN** TTS resets its start position to the new document position

### Requirement: TextPositionIndex maps positions to chunks
The system SHALL build a `TextPositionIndex` that maps document positions to chunk indices and word offsets for all document types.

#### Scenario: PDF position index built from page text
- **WHEN** a PDF document is loaded for TTS
- **THEN** the system creates a mapping from each page number to the chunk indices containing that page's text

#### Scenario: EPUB position index built from CFI
- **WHEN** an EPUB chapter is loaded for TTS
- **THEN** the system creates a mapping from CFI ranges to chunk indices within that chapter

#### Scenario: Scroll position index from character offsets
- **WHEN** a Markdown or HTML document is loaded for TTS
- **THEN** the system creates a mapping from cumulative character offsets (0-100%) to chunk indices

### Requirement: Chapter auto-advance for EPUB
The system SHALL automatically advance to the next chapter when TTS finishes reading all chunks of an EPUB chapter.

#### Scenario: Auto-advance to next chapter
- **WHEN** TTS completes the last chunk of the current EPUB chapter
- **THEN** the next chapter is loaded and TTS continues reading from its first chunk

#### Scenario: Pre-load next chapter
- **WHEN** TTS is within 2 chunks of the end of an EPUB chapter
- **THEN** the system begins loading the next chapter in the background

### Requirement: Audio generation respects document position
The system SHALL only generate audio chunks from the current position forward, avoiding generation of content the user has already read.

#### Scenario: No generation before position
- **WHEN** TTS starts at chunk index 5 of 20
- **THEN** chunks 0-4 are never generated or cached
