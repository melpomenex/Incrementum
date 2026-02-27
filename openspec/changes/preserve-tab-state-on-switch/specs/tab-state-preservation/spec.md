## ADDED Requirements

### Requirement: Restore exact tab view state after tab switches
The system SHALL restore the user's last in-progress view for a tab when the user returns to that tab within the same app session.

#### Scenario: Return to in-progress review flow
- **WHEN** the user leaves the Review tab while actively reviewing and later switches back to Review
- **THEN** the system restores the same in-progress review view without requiring the user to start review again

#### Scenario: Return to nested settings location
- **WHEN** the user leaves Settings from a nested menu or subpage and later switches back to Settings
- **THEN** the system restores the same nested settings location

### Requirement: Preserve state independently per tab
The system SHALL maintain independent restorable state for each primary tab so switching among tabs does not overwrite other tabs' in-progress context.

#### Scenario: Multiple tabs keep separate contexts
- **WHEN** the user visits deep views in two or more tabs and alternates between them
- **THEN** each tab restores its own last saved view state when reselected

### Requirement: Validate restore targets and fallback safely
The system SHALL validate saved restore targets before applying them and MUST fallback to a valid tab entry point if the saved target is unavailable.

#### Scenario: Saved target becomes invalid
- **WHEN** the user returns to a tab whose saved view references content or routes that no longer exist
- **THEN** the system navigates to the nearest valid fallback location for that tab without crashing
