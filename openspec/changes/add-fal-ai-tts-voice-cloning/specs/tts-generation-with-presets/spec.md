## ADDED Requirements

### Requirement: TTS generation uses Fal.ai Qwen 3 TTS with voice and preset selection
The system SHALL generate speech from user text through Fal.ai Qwen 3 TTS and SHALL include selected voice and preset parameters in the request payload.

#### Scenario: Generate speech with selected defaults
- **WHEN** a user triggers TTS generation without manual overrides
- **THEN** the request uses the saved default voice and default preset parameters

### Requirement: Users can override defaults per generation request
The system SHALL allow users to override voice and preset for an individual generation request without mutating saved defaults.

#### Scenario: Per-request override
- **WHEN** a user selects a non-default voice or preset for one generation request
- **THEN** that request uses the override while persisted defaults remain unchanged

### Requirement: Generation lifecycle state is visible to users
The system SHALL present explicit lifecycle states for generation requests, including in-progress, success, and error states.

#### Scenario: Generation succeeds
- **WHEN** Fal.ai returns audio output successfully
- **THEN** the system marks the request successful and makes the generated audio available for playback

### Requirement: Generation errors are reported with actionable detail
The system SHALL display actionable error messaging for failed generation requests and SHALL allow users to retry with revised inputs.

#### Scenario: Generation fails
- **WHEN** Fal.ai responds with an error or request timeout occurs
- **THEN** the system shows an error state with retry action and does not corrupt saved voice or preset settings
