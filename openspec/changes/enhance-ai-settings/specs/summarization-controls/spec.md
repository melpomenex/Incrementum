## ADDED Requirements

### Requirement: Auto-summarize long extracts toggle
The system SHALL provide a toggle to enable or disable automatic summarization of long extracts.
When enabled, extracts exceeding the configured length threshold SHALL be automatically summarized.
Default: disabled.

#### Scenario: Enable auto-summarize
- **WHEN** user enables "Auto-summarize long extracts"
- **THEN** new extracts exceeding the length threshold SHALL be auto-summarized

#### Scenario: Disable auto-summarize
- **WHEN** user disables "Auto-summarize long extracts"
- **THEN** no automatic summarization SHALL occur

### Requirement: Summary length configuration
The system SHALL allow the user to select summary length as "short", "medium", or "long".
Each maps to a word count passed to the summarizer: short ≤ 100 words, medium ≤ 250 words, long ≤ 500 words.
Default: "medium".

#### Scenario: User selects summary length
- **WHEN** user selects "short" summary length
- **THEN** auto-generated summaries SHALL be limited to approximately 100 words

#### Scenario: User selects long summary
- **WHEN** user selects "long" summary length
- **THEN** auto-generated summaries SHALL be limited to approximately 500 words

### Requirement: Include summary in card content toggle
When enabled, the summary SHALL be prepended to generated flashcard content as context.
Default: disabled.

#### Scenario: Summary included in card content
- **WHEN** "Include summary in card content" is enabled
- **AND** flashcards are generated from a summarized extract
- **THEN** the summary text SHALL be included as context in the flashcard generation prompt

#### Scenario: Summary excluded from card content
- **WHEN** "Include summary in card content" is disabled
- **THEN** generated flashcards SHALL NOT include summary context

### Requirement: Summarization settings UI
The settings page SHALL include a "Summarization" sub-section with: auto-summarize toggle (on/off), summary length dropdown (short/medium/long), and include-in-card-content toggle.
The summary length dropdown and include toggle SHALL be disabled when auto-summarize is off.

#### Scenario: Summarization section renders
- **WHEN** user navigates to AI Settings
- **THEN** SHALL see a "Summarization" sub-section with all three controls
