## ADDED Requirements

### Requirement: Vibration API triggers on mobile PWA for feedback events
When a feedback event fires on a mobile PWA device that supports the Vibration API, the system SHALL call `navigator.vibrate()` with a duration pattern appropriate to the feedback type.

#### Scenario: Click feedback triggers short vibration
- **WHEN** a `click` feedback event fires on a device with Vibration API support and haptic feedback is enabled
- **THEN** `navigator.vibrate(10)` is called (10ms vibration)

#### Scenario: Success feedback triggers medium vibration
- **WHEN** a `success` feedback event fires on a device with Vibration API support and haptic feedback is enabled
- **THEN** `navigator.vibrate(50)` is called (50ms vibration)

#### Scenario: Milestone feedback triggers patterned vibration
- **WHEN** a `milestone` feedback event fires on a device with Vibration API support and haptic feedback is enabled
- **THEN** `navigator.vibrate([100, 50, 100])` is called (burst pattern)

### Requirement: Vibration API degrades gracefully on unsupported platforms
When the Vibration API is not available (Tauri desktop, desktop browsers), the system SHALL silently skip vibration without errors or warnings.

#### Scenario: Tauri desktop triggers feedback
- **WHEN** a feedback event fires on Tauri desktop (no Vibration API)
- **THEN** no vibration occurs and no error is thrown
- **AND** audio and visual feedback still fire as configured

#### Scenario: Desktop browser triggers feedback
- **WHEN** a feedback event fires on a desktop browser without Vibration API
- **THEN** no vibration occurs and no error is thrown

### Requirement: Haptic vibration patterns are mapped per FeedbackType
Each `FeedbackType` SHALL have a defined vibration duration or pattern, exposed in a `VIBRATION_PATTERNS` map in the sound service.

#### Scenario: All feedback types have vibration patterns
- **WHEN** any of the 9 `FeedbackType` values triggers feedback
- **THEN** the corresponding vibration pattern from `VIBRATION_PATTERNS` is used

#### Scenario: Delete feedback has distinct pattern
- **WHEN** a `delete` feedback event fires
- **THEN** `navigator.vibrate(30)` is called (short, distinct from success)

### Requirement: Vibration respects the feedback sounds enabled setting
Haptic vibration SHALL only fire when feedback sounds are enabled in settings (same toggle controls both audio and haptic).

#### Scenario: Feedback sounds disabled
- **WHEN** the user has disabled "UI Sound Effects" in settings
- **THEN** no vibration occurs for any feedback event

#### Scenario: Feedback sounds enabled
- **WHEN** the user has enabled "UI Sound Effects" in settings
- **THEN** vibration fires alongside audio for feedback events on supported devices
