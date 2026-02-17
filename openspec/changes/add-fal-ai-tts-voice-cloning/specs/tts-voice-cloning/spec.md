## ADDED Requirements

### Requirement: Users can upload a reference clip for voice cloning
The system SHALL allow users to upload an audio reference clip from the TTS settings section and SHALL validate supported format, duration, and file size before submission.

#### Scenario: Valid clip upload
- **WHEN** a user selects a supported audio file that meets validation constraints
- **THEN** the system accepts the file and starts the voice cloning submission flow

### Requirement: System creates reusable cloned voice profiles via Fal.ai
The system SHALL submit validated reference clips to Fal.ai cloning endpoints and SHALL store clone metadata required for later TTS generation.

#### Scenario: Clone creation succeeds
- **WHEN** Fal.ai returns a successful clone response
- **THEN** the system stores the cloned voice profile metadata and shows it in the user voice list

### Requirement: Voice cloning failures expose recovery paths
The system SHALL surface cloning errors with explicit failure context and SHALL provide retry or corrective guidance without losing previously saved voices.

#### Scenario: Clone request fails
- **WHEN** a clone request fails due to provider or network error
- **THEN** the system displays the failure state and offers retry guidance while preserving existing voice profiles

### Requirement: Cloned voices can be selected as TTS defaults
The system SHALL allow any successfully cloned voice profile to be selected as the default voice for future generation requests.

#### Scenario: Select cloned voice as default
- **WHEN** a user sets a cloned voice as default in TTS settings
- **THEN** subsequent generation uses that voice unless the request explicitly selects a different one
