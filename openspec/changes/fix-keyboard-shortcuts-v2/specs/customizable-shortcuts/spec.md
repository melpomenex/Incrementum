## ADDED Requirements

### Requirement: Users can customize keyboard shortcuts

The system SHALL allow users to view and modify keyboard shortcut key combinations for all 25 predefined actions through the Settings → Shortcuts UI. Customizations SHALL persist across app restarts via localStorage.

#### Scenario: View all customizable shortcuts in Settings

- **WHEN** user navigates to Settings → Shortcuts
- **THEN** all 25 shortcuts are displayed grouped by category (Navigation, Editing, View, Review, Documents, Flashcards, General) with their current key combo shown

#### Scenario: Customize a shortcut

- **WHEN** user clicks the shortcut recording button for a shortcut and presses a new key combination
- **THEN** the shortcut's combo updates immediately and the new combo is displayed

#### Scenario: Customized shortcut persists after restart

- **WHEN** user customizes a shortcut and restarts the app
- **THEN** the customized shortcut combo is still active

#### Scenario: Reset a single shortcut to default

- **WHEN** user clicks the reset button on a customized shortcut
- **THEN** the shortcut reverts to its default key combination

#### Scenario: Reset all shortcuts to defaults

- **WHEN** user clicks "Reset All to Defaults" in Settings → Shortcuts
- **THEN** all shortcuts revert to their default key combinations

### Requirement: Customized shortcuts fire application-wide

The system SHALL dispatch the correct action when a user presses a customized shortcut key combination from any view in the app.

#### Scenario: Customized shortcut navigates to correct page

- **WHEN** user changes the Queue shortcut to Ctrl+Shift+Q and presses Ctrl+Shift+Q
- **THEN** the app navigates to the Queue page

#### Scenario: Default shortcut still works if not customized

- **WHEN** user has not customized the Dashboard shortcut and presses Ctrl/Cmd+D
- **THEN** the app navigates to the Dashboard page

#### Scenario: Customized command palette shortcut opens palette

- **WHEN** user changes the command palette shortcut to Ctrl+Shift+Space and presses Ctrl+Shift+Space
- **THEN** the command palette opens

### Requirement: Shortcut recording handles edge cases

The ShortcutRecorder component SHALL properly handle Escape to cancel recording, reject modifier-only combos, and provide visual feedback during recording.

#### Scenario: Escape cancels recording

- **WHEN** user clicks the recording button, then presses Escape
- **THEN** recording is cancelled and the previous combo is preserved

#### Scenario: Visual feedback during recording

- **WHEN** user clicks the recording button
- **THEN** the button shows a pulsing animation and "Press keys..." text

### Requirement: Conflict detection on shortcut assignment

The system SHALL detect when a user assigns a shortcut combo that is already in use by another action and display a warning.

#### Scenario: Conflict warning when assigning duplicate combo

- **WHEN** user assigns Ctrl+D to the Queue shortcut and Ctrl+D is already used by Dashboard
- **THEN** a warning message is displayed indicating the conflict

### Requirement: Shortcut recorder prevents invalid combos

The system SHALL prevent recording shortcuts that consist only of modifier keys (Ctrl alone, Alt alone, etc.) with no non-modifier key.

#### Scenario: Modifier-only combo is rejected

- **WHEN** user presses only the Ctrl key during recording
- **THEN** the recording continues (combo is not accepted)
