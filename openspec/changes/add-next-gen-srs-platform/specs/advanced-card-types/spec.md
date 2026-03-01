## ADDED Requirements
### Requirement: Typed Answer Evaluation Modes
The system SHALL support typed-answer cards with exact-match, fuzzy-match, and AI semantic grading modes.

#### Scenario: User submits a typed answer with fuzzy grading
- **WHEN** a typed-answer card is configured for fuzzy grading
- **THEN** the system evaluates tolerance-aware correctness and shows grading feedback

### Requirement: Progressive Hint Reveals
The system SHALL support staged hint reveals before answer reveal and SHALL track hint usage per review event.

#### Scenario: User reveals hints progressively
- **WHEN** a user requests hint 1 then hint 2 on the same card
- **THEN** the system reveals hints in configured order
- **AND** records hint usage metadata for that review event

### Requirement: Audio Cards and Text-to-Speech Playback
The system SHALL support cards with audio prompts/answers and SHALL provide text-to-speech playback for card text.

#### Scenario: User reviews an audio-forward card
- **WHEN** a card includes audio prompt media
- **THEN** playback controls are available in review
- **AND** the user can invoke TTS to read associated card text

### Requirement: Ordering Interaction Cards
The system SHALL support ordering card interactions where users arrange items into a correct sequence.

#### Scenario: User completes an ordering card
- **WHEN** a user submits an ordered sequence
- **THEN** the system evaluates order correctness and returns targeted feedback

### Requirement: Matching Interaction Cards
The system SHALL support matching card interactions where users pair terms and definitions.

#### Scenario: User completes a matching card
- **WHEN** a user submits left-right pairings
- **THEN** the system evaluates each pairing and returns correctness feedback

### Requirement: Handwriting/Canvas Answer Capture
The system SHALL support handwriting/stylus canvas input for answer attempts before reveal.

#### Scenario: Tablet user writes answer on canvas
- **WHEN** a user draws or writes an answer on a supported device
- **THEN** the canvas attempt is captured and persisted with the review event metadata

### Requirement: Sibling Burying During Session
The system SHALL automatically bury sibling cards from the same source note/extract for the remainder of the active review session when sibling burying is enabled.

#### Scenario: One sibling appears during review
- **WHEN** a card from a source note is shown and rated
- **THEN** other sibling cards from that source are deferred for the current session
