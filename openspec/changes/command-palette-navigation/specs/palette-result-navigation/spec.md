## ADDED Requirements

### Requirement: Command results navigate via addTab
When a user selects a command-type result in the command palette, the system SHALL call `addTab()` to open the target feature as a tab. Every in-app navigation command registered in CommandCenter MUST have an `action` function that calls `addTab()` with the appropriate tab configuration.

#### Scenario: Selecting a navigation command opens a tab
- **WHEN** user types "dashboard" in the command palette and presses Enter on the "Go to Dashboard" result
- **THEN** a new dashboard tab is opened and becomes active, and the command palette closes

#### Scenario: Selecting image registry from command palette
- **WHEN** user types "image" in the command palette and presses Enter on the Image Registry result
- **THEN** a new image registry tab is opened and becomes active, and the command palette closes

#### Scenario: Selecting review from command palette
- **WHEN** user types "review" in the command palette and presses Enter on the Start Review result
- **THEN** a new review tab is opened and becomes active, and the command palette closes

### Requirement: All navigation commands appear in search results
Navigation commands (dashboard, documents, queue, analytics, settings, image registry, review) SHALL appear as searchable results in the command palette. No navigation command SHALL be excluded from the search matching phase.

#### Scenario: Navigation commands are findable
- **WHEN** user types any of "dashboard", "documents", "queue", "analytics", "settings", "image", or "review" into the command palette
- **THEN** at least one matching navigation command appears in the results

### Requirement: Document and extract results open in viewer tab
When a user selects a document or extract result, the system SHALL open it in a document viewer tab with the document loaded and any search highlight applied.

#### Scenario: Selecting a document result
- **WHEN** user searches for a document title and presses Enter on the matching document result
- **THEN** the document opens in a viewer tab with the title shown, and the command palette closes

### Requirement: Section results navigate to their target
When a user selects a section-type result (matched from sectionRegistry), the system SHALL navigate to the corresponding page or tab.

#### Scenario: Selecting a section result
- **WHEN** user types a section name and presses Enter on the matching section result
- **THEN** the corresponding page/tab opens and the command palette closes

### Requirement: Keyboard Enter triggers result action
Pressing the Enter key while a result is selected (highlighted) in the command palette SHALL trigger the same action as clicking the result with the mouse.

#### Scenario: Enter key on selected result
- **WHEN** user navigates with arrow keys to highlight a result and presses Enter
- **THEN** the highlighted result's action fires (navigation, tab open, or document view)
