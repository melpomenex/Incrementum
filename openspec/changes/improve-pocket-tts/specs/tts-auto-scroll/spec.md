## ADDED Requirements

### Requirement: Auto-scroll for scroll-based documents
The system SHALL automatically scroll Markdown and HTML documents to keep the currently spoken text visible.

#### Scenario: Auto-scroll follows TTS position
- **WHEN** TTS is playing and reaches a word that is scrolled out of view
- **THEN** the document scrolls to bring that word into the center of the viewport

#### Scenario: Auto-scroll disabled by manual scroll
- **WHEN** user manually scrolls during TTS playback
- **THEN** auto-scroll is paused and a "Re-center" button appears in the TTS controls

#### Scenario: Re-center resumes auto-scroll
- **WHEN** user taps the "Re-center" button after manual scrolling
- **THEN** auto-scroll resumes and scrolls to the current TTS word

### Requirement: Auto-scroll only active during TTS playback
The system SHALL only auto-scroll while TTS is actively playing, not while paused or stopped.

#### Scenario: Pause stops auto-scroll
- **WHEN** user pauses TTS
- **THEN** auto-scroll stops and the viewport remains at its current position

#### Scenario: Resume restarts auto-scroll
- **WHEN** user resumes TTS after pausing
- **THEN** auto-scroll resumes from the current TTS word

### Requirement: Smooth scroll with debounced updates
The system SHALL use smooth scrolling and debounce updates to avoid visual jank during rapid word advancement.

#### Scenario: Smooth scroll animation
- **WHEN** auto-scroll activates
- **THEN** the viewport scrolls with `behavior: 'smooth'` over a maximum duration of 200ms

#### Scenario: Debounced scroll position updates
- **WHEN** words are advancing rapidly (short words at high speed)
- **THEN** scroll position updates are debounced to at most every 100ms

### Requirement: PDF page auto-advance preserves existing behavior
The system SHALL preserve the existing PDF page auto-advance behavior when TTS completes reading all text on the current page.

#### Scenario: PDF page advance triggers TTS continuation
- **WHEN** TTS completes all chunks for the current PDF page
- **THEN** the viewer advances to the next page and TTS continues from that page's first chunk
