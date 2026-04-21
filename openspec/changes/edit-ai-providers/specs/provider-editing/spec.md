## ADDED Requirements

### Requirement: Edit button on provider cards
Each provider card in the settings list SHALL display an edit button that opens the provider form pre-populated with that provider's current configuration.

#### Scenario: User clicks edit on a provider
- **WHEN** user clicks the edit button on a provider card
- **THEN** the provider form SHALL open with all fields pre-filled from the existing provider configuration
- **THEN** the provider type selector SHALL be disabled (read-only) to prevent type changes

#### Scenario: User cancels edit mode
- **WHEN** user clicks cancel while editing a provider
- **THEN** the form SHALL close and revert to the provider list view
- **THEN** no changes SHALL be saved

### Requirement: Save edits to existing provider
When in edit mode, submitting the form SHALL update the existing provider record in the store rather than creating a new one.

#### Scenario: User modifies and saves a provider
- **WHEN** user modifies one or more fields (name, API key, base URL, or model) and clicks save
- **THEN** the system SHALL call `updateProvider` with the changed fields
- **THEN** the form SHALL close and the provider list SHALL reflect the updated values

#### Scenario: User edits API key
- **WHEN** user clears and enters a new API key in the edit form
- **THEN** the system SHALL save the new API key to the provider configuration
- **THEN** the masked display in the provider list SHALL reflect the new key

#### Scenario: User switches between editing different providers
- **WHEN** user has one provider open in edit mode and clicks edit on a different provider
- **THEN** the form SHALL reload with the newly selected provider's values
