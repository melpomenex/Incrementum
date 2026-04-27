## ADDED Requirements

### Requirement: Auto-generate flashcards toggle
The system SHALL provide a toggle to enable or disable automatic flashcard generation when new extracts are created.
When disabled, no automatic generation SHALL occur. Default: disabled.

#### Scenario: Enable auto-generation
- **WHEN** user enables the "Auto-generate flashcards from extracts" toggle
- **THEN** the system SHALL store this preference as enabled
- **AND** new extracts SHALL trigger flashcard generation

#### Scenario: Disable auto-generation
- **WHEN** user disables the "Auto-generate flashcards from extracts" toggle
- **THEN** new extracts SHALL NOT trigger flashcard generation

### Requirement: Cards per extract configuration
When auto-generation is enabled, the system SHALL allow the user to configure the number of flashcards generated per extract.
The range SHALL be 1–20. Default: 5.

#### Scenario: User sets cards per extract
- **WHEN** user sets "Cards per extract" to 10
- **THEN** auto-generation SHALL produce up to 10 flashcards per extract

### Requirement: Quality threshold configuration
The system SHALL provide a quality threshold setting (0.0–1.0, step 0.05) that filters generated flashcards.
Flashcards with a confidence score below this threshold SHALL be discarded. Default: 0.0 (no filtering).

#### Scenario: User sets quality threshold
- **WHEN** user sets quality threshold to 0.7
- **THEN** generated flashcards with confidence below 0.7 SHALL be discarded
- **AND** only flashcards meeting or exceeding the threshold SHALL be shown

### Requirement: Manual approval workflow
When "Require manual approval" is enabled, auto-generated flashcards SHALL be held in a pending state for user review before being committed.
When disabled, approved-quality flashcards SHALL be saved automatically. Default: disabled.

#### Scenario: Auto-generated cards held for approval
- **WHEN** "Require manual approval" is enabled
- **AND** new extract triggers auto-generation
- **THEN** generated flashcards SHALL appear in a pending review list
- **AND** SHALL NOT be saved to the database until user approves

#### Scenario: Auto-generated cards saved immediately
- **WHEN** "Require manual approval" is disabled
- **AND** new extract triggers auto-generation
- **THEN** generated flashcards SHALL be saved immediately to the database

### Requirement: Auto-generation settings UI
The settings page SHALL include an "Auto-Generation" section with: enable toggle (on/off), cards-per-extract number input (1–20), quality threshold slider (0.0–1.0), and require-manual-approval toggle.
The cards-per-extract, quality threshold, and approval toggle SHALL be disabled when auto-generation is off.

#### Scenario: Auto-generation settings section renders
- **WHEN** user navigates to AI Settings
- **THEN** SHALL see an "Auto-Generation" sub-section with all four controls

### Requirement: Auto-generation on extract creation
When auto-generation is enabled and a new extract is created (via any method), the system SHALL asynchronously call the flashcard generation engine with the configured parameters.

#### Scenario: Extract created triggers generation
- **WHEN** a new extract is created
- **AND** auto-generation is enabled
- **THEN** the system SHALL invoke `generate_flashcards_from_extract` with the configured count and difficulty settings
