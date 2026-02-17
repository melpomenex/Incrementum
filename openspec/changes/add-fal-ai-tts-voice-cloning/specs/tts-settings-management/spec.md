## ADDED Requirements

### Requirement: TTS settings section is available across supported app targets
The system SHALL provide a TTS section within Settings in the Tauri Desktop App, Web App, and PWA using a shared feature flow and platform-consistent behavior.

#### Scenario: Open TTS settings on each platform
- **WHEN** a user navigates to Settings in Desktop, Web, or PWA builds
- **THEN** the TTS section is visible and interactive with equivalent controls and labels

### Requirement: TTS configuration persists across sessions
The system SHALL persist provider configuration, available voice profiles metadata, preset catalog state, and selected default voice/preset so values are restored after restart or reload.

#### Scenario: Persisted settings are restored
- **WHEN** a user saves TTS defaults and reopens the app
- **THEN** the previously saved defaults and TTS metadata are restored without re-entry

### Requirement: Curated presets are available with editable default selection
The system SHALL expose a curated preset list (for example balanced, expressive, and fast) and allow users to set one as the default for TTS generation.

#### Scenario: Change default preset
- **WHEN** a user selects a different preset as default in Settings
- **THEN** future TTS generation requests use that preset unless explicitly overridden

### Requirement: Settings validation errors are actionable
The system SHALL validate required TTS settings fields and present actionable error messages that identify the invalid field and corrective action.

#### Scenario: Missing required provider configuration
- **WHEN** a user attempts to save TTS settings without required provider configuration
- **THEN** the save is rejected and the UI highlights the missing field with an actionable message
