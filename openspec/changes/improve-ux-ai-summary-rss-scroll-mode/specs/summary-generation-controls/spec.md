## ADDED Requirements

### Requirement: Summary generation length control

The system SHALL provide UI controls for selecting summary length (Brief, Medium, Detailed).

#### Scenario: User selects brief summary

- **WHEN** the user selects "Brief" from the length dropdown
- **AND** clicks generate
- **THEN** the AI SHALL generate a summary limited to approximately 100 tokens (~75 words)

#### Scenario: User selects medium summary

- **WHEN** the user selects "Medium" from the length dropdown
- **AND** clicks generate
- **THEN** the AI SHALL generate a summary limited to approximately 200 tokens (~150 words)

#### Scenario: User selects detailed summary

- **WHEN** the user selects "Detailed" from the length dropdown
- **AND** clicks generate
- **THEN** the AI SHALL generate a summary limited to approximately 400 tokens (~300 words)

#### Scenario: Length preference persistence

- **WHEN** the user changes the summary length setting
- **THEN** the preference SHALL persist in settings store and localStorage
- **AND** subsequent summaries SHALL use the saved length by default

### Requirement: Summary generation focus area control

The system SHALL provide a dropdown for selecting the summary focus area (Key Points, Actionable Items, or Background Context).

#### Scenario: User selects key points focus

- **WHEN** the user selects "Key Points" from the focus dropdown
- **AND** clicks generate
- **THEN** the AI SHALL emphasize the main arguments and conclusions in the summary

#### Scenario: User selects actionable items focus

- **WHEN** the user selects "Actionable Items" from the focus dropdown
- **AND** clicks generate
- **THEN** the AI SHALL emphasize practical steps, recommendations, and actionable insights

#### Scenario: User selects background context focus

- **WHEN** the user selects "Background Context" from the focus dropdown
- **AND** clicks generate
- **THEN** the AI SHALL emphasize historical context, definitions, and foundational information

#### Scenario: Focus preference persistence

- **WHEN** the user changes the focus area setting
- **THEN** the preference SHALL persist in settings store and localStorage
- **AND** subsequent summaries SHALL use the saved focus by default

### Requirement: Summary generation controls are collapsible

The generation controls SHALL be hidden by default and revealed on user interaction.

#### Scenario: Controls collapsed by default

- **WHEN** the summary panel opens
- **THEN** the generation controls SHALL be collapsed
- **AND** only the generate/regenerate button and close button SHALL be visible in the header

#### Scenario: User expands controls

- **WHEN** the user clicks the gear/settings icon
- **THEN** the generation controls (length and focus dropdowns) SHALL expand below the header
- **AND** the controls SHALL animate in with a 200ms slide-down animation

#### Scenario: User collapses controls

- **WHEN** the user clicks the gear icon again or clicks outside the controls
- **THEN** the generation controls SHALL collapse
- **AND** the controls SHALL animate out with a 150ms slide-up animation

### Requirement: Regenerate with new parameters

The system SHALL allow regenerating a summary with different parameters.

#### Scenario: User regenerates with different length

- **WHEN** a summary is already generated and displayed
- **AND** the user changes the length setting
- **AND** clicks regenerate
- **THEN** the system SHALL generate a new summary with the updated length
- **AND** the previous summary SHALL be replaced

#### Scenario: Cached summary invalidated on parameter change

- **WHEN** the user changes length or focus parameters
- **THEN** any cached summary for the current article with different parameters SHALL be ignored
- **AND** the next generation SHALL use the new parameters
