## ADDED Requirements

### Requirement: Feedback sounds are opt-in and disabled by default
The `feedbackSoundsEnabled` setting SHALL default to `false`. No feedback sounds SHALL play until the user explicitly enables them in settings.

#### Scenario: Fresh install behavior
- **WHEN** a user installs the app and has not changed any settings
- **THEN** no UI feedback sounds play for any interaction
- **AND** notification sounds still play as configured

#### Scenario: User enables feedback sounds
- **WHEN** the user toggles on "UI Sound Effects" in settings
- **THEN** feedback sounds begin playing for user interactions going forward
- **AND** the setting persists across app restarts

### Requirement: Review session completion triggers sound feedback
When a user completes a review session (all cards reviewed), the system SHALL play the `complete` feedback sound and show the completion visual effect.

#### Scenario: User finishes all cards in a session
- **WHEN** the user rates the last card in a review session and feedback sounds are enabled
- **THEN** the system plays the `complete` feedback sound at the configured feedback volume
- **AND** shows the completion visual feedback animation

#### Scenario: Sound disabled in settings
- **WHEN** the user completes a review session and feedback sounds are disabled
- **THEN** no sound plays, but visual feedback still appears if visual feedback is enabled

### Requirement: Card rating triggers subtle click feedback
When a user rates a card (Again/Hard/Good/Easy), the system SHALL play a subtle `click` feedback sound.

#### Scenario: User taps a rating button
- **WHEN** the user taps any card rating button and feedback sounds are enabled
- **THEN** the system plays a short, quiet `click` feedback sound

#### Scenario: Rapid card ratings
- **WHEN** the user rates multiple cards in quick succession (under 300ms apart)
- **THEN** each rating plays its own click sound without clipping or overlap issues

### Requirement: Review session summary shows streak feedback
When the user views the review session complete screen and has a streak, the system SHALL play the `streak` feedback sound.

#### Scenario: User completes a session with an active streak
- **WHEN** the review session completes, feedback sounds are enabled, and the user has a study streak of 2+ days
- **THEN** the system plays the `streak` feedback sound with its fire visual effect

### Requirement: Milestone achievements trigger celebratory feedback
When the user reaches a milestone (e.g., cards reviewed count, study streak, level up), the system SHALL play the `milestone` feedback sound with confetti.

#### Scenario: User reaches a review count milestone
- **WHEN** the user's total cards reviewed crosses a milestone threshold and feedback sounds are enabled
- **THEN** the system plays the `milestone` feedback sound and confetti visual effect

### Requirement: Delete confirmation triggers delete feedback
When the user confirms a destructive action (delete card, delete deck, delete extract), the system SHALL play the `delete` feedback sound.

#### Scenario: User confirms deletion of a card
- **WHEN** the user clicks "Delete" on a card delete confirmation dialog and feedback sounds are enabled
- **THEN** the system plays the `delete` feedback sound

### Requirement: Error states trigger error feedback
When a user action results in an error (failed save, network error on sync), the system SHALL play the `error` feedback sound.

#### Scenario: Sync fails due to network error
- **WHEN** a sync operation fails, an error toast is displayed, and feedback sounds are enabled
- **THEN** the system plays the `error` feedback sound

### Requirement: Feedback sounds respect volume setting
The system SHALL use a dedicated `feedbackVolume` setting (0-1, default 0.3) for UI feedback sounds, independent of notification sound volume.

#### Scenario: User adjusts feedback volume
- **WHEN** the user changes the feedback volume slider in settings
- **THEN** all subsequent feedback sounds play at the new volume level

#### Scenario: Notification volume changed independently
- **WHEN** the user changes the notification volume but not feedback volume
- **THEN** notification sounds change volume but feedback sounds remain at their configured level

### Requirement: Feedback sounds can be independently toggled
The system SHALL allow users to toggle feedback sounds on/off independently from notification sounds.

#### Scenario: User disables feedback sounds
- **WHEN** the user toggles off "UI Sound Effects" in settings
- **THEN** no feedback sounds play for any user interaction
- **AND** notification sounds still play as configured

#### Scenario: User enables feedback sounds
- **WHEN** the user toggles on "UI Sound Effects" in settings
- **THEN** feedback sounds play for user interactions at the configured feedback volume
- **AND** notification sounds remain independently configured

### Requirement: Sounds work on both Tauri and PWA platforms
Feedback sounds SHALL play identically on Tauri desktop (WebView) and PWA (browser) using the shared Web Audio API.

#### Scenario: PWA user interacts with UI
- **WHEN** a PWA user clicks a rating button and feedback sounds are enabled
- **THEN** the click feedback sound plays via Web Audio API

#### Scenario: Tauri desktop user interacts with UI
- **WHEN** a Tauri desktop user clicks a rating button and feedback sounds are enabled
- **THEN** the click feedback sound plays via Web Audio API

### Requirement: Haptic feedback CSS is loaded globally
The `HAPTIC_FEEDBACK_CSS` animations SHALL be injected into the application so visual feedback effects render correctly.

#### Scenario: Visual feedback renders with animation
- **WHEN** a feedback event triggers with visual feedback enabled
- **THEN** the visual feedback element appears with the correct CSS animation
