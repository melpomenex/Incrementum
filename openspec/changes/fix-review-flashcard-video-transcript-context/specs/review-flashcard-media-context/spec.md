## ADDED Requirements

### Requirement: Media documents SHALL provide transcript-backed flashcard context
When a user selects a media document in Review flashcard generation, the system SHALL resolve context text from transcript sources when direct document content is missing.

#### Scenario: Local video transcript is used for context
- **WHEN** a selected Review document is a local `video` and `document.content` is empty
- **THEN** the system SHALL resolve flashcard context from the stored video transcript
- **AND** use that resolved text for generation context and token estimation

#### Scenario: Local audio transcript is used for context
- **WHEN** a selected Review document is `audio` and `document.content` is empty
- **THEN** the system SHALL resolve flashcard context from the stored audio transcript
- **AND** use that resolved text for generation context and token estimation

#### Scenario: YouTube transcript is used for context
- **WHEN** a selected Review document is `youtube` and `document.content` is empty
- **THEN** the system SHALL resolve flashcard context from transcript segments associated with the video ID
- **AND** use that resolved text for generation context and token estimation

### Requirement: Token estimates SHALL reflect effective context text
The Context Control token estimate and cost estimate SHALL be computed from the effective context text used for generation.

#### Scenario: Transcript-backed token estimate is non-zero
- **WHEN** transcript text exists for a selected media document
- **THEN** the estimated token count SHALL be based on transcript text length
- **AND** SHALL not report zero tokens solely because `document.content` is empty

#### Scenario: No transcript available falls back gracefully
- **WHEN** transcript retrieval fails or no transcript text exists
- **THEN** the modal SHALL remain usable
- **AND** the system SHALL fall back to available document content behavior without crashing
