## ADDED Requirements

### Requirement: Persist selected queue strategy preset
The system SHALL persist the user's selected queue strategy preset (`maximize-retention`, `minimize-time`, `aggressive-catchup`, `exploratory`, `project-focused`) in the settings store. The persisted value SHALL survive page navigation and app restarts.

#### Scenario: Preset persists across navigation
- **WHEN** the user selects "Minimize Daily Time" in the Queue view dropdown and navigates away then returns
- **THEN** the dropdown SHALL show "Minimize Daily Time" as the active selection

#### Scenario: Preset persists across app restart
- **WHEN** the user selects "Project-Focused", closes the app, and reopens it
- **THEN** the Queue view dropdown SHALL show "Project-Focused" as the active selection

#### Scenario: Default preset for new users
- **WHEN** a user has no previously saved preset preference
- **THEN** the system SHALL default to "maximize-retention"

### Requirement: Show preset description below dropdown
The system SHALL display a one-line description below the preset dropdown that explains what the currently selected strategy optimizes for. The description SHALL update when the user changes the selection.

#### Scenario: Description updates on selection change
- **WHEN** the user changes the preset from "Maximize Retention" to "Aggressive Catch-Up"
- **THEN** the description line SHALL update to describe the aggressive catch-up strategy

#### Scenario: Description is visible without interaction
- **WHEN** the user views the Queue view
- **THEN** the description for the current preset SHALL be visible without requiring hover or click
