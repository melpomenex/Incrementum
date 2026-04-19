## ADDED Requirements

### Requirement: Dashboard quick-action buttons always navigate to target tab
When a user clicks a dashboard quick-action button (e.g., Settings, Review, Queue), the system SHALL always activate the corresponding tab, regardless of whether it is already open.

#### Scenario: Clicking settings when settings tab already exists and is inactive
- **WHEN** the user clicks the "Settings" quick-action button on the dashboard and a Settings tab already exists in another pane or is inactive
- **THEN** the system SHALL activate the existing Settings tab and navigate the user to it

#### Scenario: Clicking settings when settings tab is already active
- **WHEN** the user clicks the "Settings" quick-action button and the Settings tab is already the active tab
- **THEN** the system SHALL keep the Settings tab active (no-op visually, but the navigation request is fulfilled)

#### Scenario: Clicking settings when no settings tab exists
- **WHEN** the user clicks the "Settings" quick-action button and no Settings tab exists
- **THEN** the system SHALL create a new Settings tab and activate it

#### Scenario: Clicking "Set up Sync" when settings tab already exists
- **WHEN** the user clicks the "Set up Sync" button on the dashboard and a Settings tab already exists
- **THEN** the system SHALL activate the existing Settings tab and navigate to it
