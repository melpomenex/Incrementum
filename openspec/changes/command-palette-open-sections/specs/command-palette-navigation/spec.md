## ADDED Requirements

### Requirement: Command Palette Surfaces App Sections
The command palette SHALL return app section entries as searchable results alongside document results.

#### Scenario: Query matches a section label
- **WHEN** the user types a query that matches a configured app section label (for example, "settings")
- **THEN** the command palette includes that app section in the result list

#### Scenario: Query matches a section alias
- **WHEN** the user types a query that matches a configured app section alias
- **THEN** the command palette includes the mapped app section in the result list

### Requirement: Unified Keyboard Selection Across Result Types
The command palette SHALL support arrow-key navigation and Enter activation across a mixed result list containing documents and app sections.

#### Scenario: Move highlight through mixed results
- **WHEN** the result list contains both document and app section entries and the user presses ArrowUp or ArrowDown
- **THEN** the highlighted selection moves predictably through the unified list without skipping valid entries

#### Scenario: Activate highlighted section result
- **WHEN** an app section entry is highlighted and the user presses Enter
- **THEN** the command palette activates that app section entry

### Requirement: Selecting a Section Opens Its Target App Area
Selecting an app section result from the command palette MUST navigate the user to that section's target area in the app.

#### Scenario: Open section from mouse selection
- **WHEN** the user clicks an app section result in the command palette
- **THEN** the app navigates to the target section associated with that result

#### Scenario: Open section from keyboard selection
- **WHEN** the user activates a highlighted app section result using Enter
- **THEN** the app navigates to the same target section associated with that result

### Requirement: Existing Document Open Behavior Is Preserved
Adding app section results MUST NOT change existing document selection and open behavior.

#### Scenario: Open document with keyboard after feature addition
- **WHEN** the user highlights a document result and presses Enter
- **THEN** the app opens that document using the existing document-open flow

#### Scenario: Open document with pointer after feature addition
- **WHEN** the user selects a document result with the pointer
- **THEN** the app opens that document exactly as before section support was added
