## ADDED Requirements

### Requirement: Remove inert smartQueue.mode setting
The system SHALL remove the `smartQueue.mode` field ("normal"/"filtered"/"intelligent") from the settings type definition, default settings, settings store, and the SmartQueuesSettings UI component. The queue mode selection UI SHALL be removed entirely.

#### Scenario: Queue mode setting no longer exists in settings
- **WHEN** the app loads settings
- **THEN** `smartQueue.mode` SHALL NOT be present in the settings object

#### Scenario: Queue mode UI removed from settings page
- **WHEN** the user navigates to the Smart Queues settings section
- **THEN** the queue mode radio button group SHALL NOT be rendered

### Requirement: Remove inert useFsrsScheduling setting
The system SHALL remove the `useFsrsScheduling` toggle from the settings type, store, and UI. The FSRS scheduling info panel that appears when the toggle is enabled SHALL also be removed.

#### Scenario: FSRS scheduling toggle no longer exists
- **WHEN** the app loads settings
- **THEN** `useFsrsScheduling` SHALL NOT be present in the settings object

#### Scenario: FSRS info panel removed from settings page
- **WHEN** the user views the Smart Queues settings section
- **THEN** the FSRS scheduling toggle and the conditional FSRS info panel SHALL NOT be rendered

### Requirement: Preserve functional autoRefresh settings
The system SHALL keep the `autoRefresh` toggle and `refreshInterval` slider settings, which are functional and consumed by the queue's auto-refresh logic. These SHALL remain in the settings and UI unchanged.

#### Scenario: Auto-refresh settings still work
- **WHEN** the user toggles auto-refresh on and sets an interval
- **THEN** the queue SHALL continue to auto-refresh at the specified interval
