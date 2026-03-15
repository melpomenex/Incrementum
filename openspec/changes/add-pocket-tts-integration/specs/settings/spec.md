## MODIFIED Requirements

### Requirement: TTS Provider Selection
The system SHALL allow users to select from multiple TTS providers including Fal.ai, Groq, and Pocket TTS (Local).

#### Scenario: Provider dropdown displays all options
- **WHEN** user views TTS settings page
- **THEN** the provider dropdown shows:
  - "Fal.ai" (cloud)
  - "Groq" (cloud)
  - "Pocket TTS (Local)" (offline)
- **AND** each option indicates its type (cloud/offline)

#### Scenario: Switching to Pocket TTS provider
- **WHEN** user selects "Pocket TTS (Local)" from provider dropdown
- **THEN** the system checks for Pocket TTS availability
- **AND** if available, shows voice selection for Pocket voices
- **AND** hides API key and proxy settings (not needed for local)
- **AND** saves the provider selection

#### Scenario: Switching from Pocket TTS to cloud provider
- **WHEN** user switches from Pocket TTS to Fal.ai or Groq
- **THEN** the system saves the new provider selection
- **AND** shows API key input for the selected provider
- **AND** loads voice profiles for the selected provider

### Requirement: TTS Settings Schema
The system SHALL maintain backward-compatible TTS settings schema supporting all providers.

#### Scenario: Settings schema includes Pocket TTS
- **WHEN** TTS settings are loaded from storage
- **THEN** the schema includes:
  - `provider`: "fal" | "groq" | "pocket"
  - `pocketVoices`: array of available Pocket voices
  - `pocketSpeed`: playback speed multiplier (0.5-2.0)
- **AND** settings migrate gracefully from older schema versions

#### Scenario: Default settings include Pocket TTS
- **WHEN** user first enables TTS features
- **THEN** default settings include Pocket TTS as an option
- **AND** Pocket TTS is not auto-selected (user must opt-in)
- **AND** cloud providers remain available as alternatives
