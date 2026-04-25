## ADDED Requirements

### Requirement: Font size controls
The HTML viewer SHALL provide font size increase (A+) and decrease (A-) controls with a range of 12px to 32px. The current font size SHALL be displayed between the controls. A reset button SHALL restore the default of 16px.

#### Scenario: Increase font size
- **WHEN** user clicks the A+ button in the HTML viewer settings panel
- **THEN** the iframe content font size increases by 1px, clamped at 32px

#### Scenario: Decrease font size
- **WHEN** user clicks the A- button in the HTML viewer settings panel
- **THEN** the iframe content font size decreases by 1px, clamped at 12px

#### Scenario: Reset font size
- **WHEN** user clicks the reset button in the settings panel
- **THEN** the iframe content font size is set to 16px

### Requirement: Font size keyboard shortcuts
The HTML viewer SHALL support Ctrl/Cmd + Plus to increase font size, Ctrl/Cmd + Minus to decrease font size, and Ctrl/Cmd + 0 to reset font size.

#### Scenario: Ctrl+Plus increases font size
- **WHEN** user presses Ctrl+Plus while the HTML viewer is active
- **THEN** font size increases by 1px

#### Scenario: Ctrl+Minus decreases font size
- **WHEN** user presses Ctrl+Minus while the HTML viewer is active
- **THEN** font size decreases by 1px

#### Scenario: Ctrl+0 resets font size
- **WHEN** user presses Ctrl+0 while the HTML viewer is active
- **THEN** font size resets to 16px

### Requirement: Ctrl+Scroll zoom
The HTML viewer SHALL support Ctrl/Cmd + mouse wheel to increase or decrease font size.

#### Scenario: Ctrl+scroll up increases font size
- **WHEN** user scrolls up while holding Ctrl
- **THEN** font size increases by 1px

#### Scenario: Ctrl+scroll down decreases font size
- **WHEN** user scrolls down while holding Ctrl
- **THEN** font size decreases by 1px

### Requirement: Line height control
The HTML viewer SHALL provide a line height adjustment control with a range of 1.2 to 2.2, defaulting to 1.6.

#### Scenario: Change line height
- **WHEN** user adjusts the line height control
- **THEN** the iframe content line height updates to the selected value

### Requirement: Font family selection
The HTML viewer SHALL provide font family selection between serif, sans-serif, and monospace, defaulting to serif.

#### Scenario: Change font family
- **WHEN** user selects a different font family
- **THEN** the iframe content font family updates immediately

### Requirement: Settings persistence
HTML viewer settings (fontSize, lineHeight, fontFamily) SHALL persist across sessions via the settings store under `documents.htmlSettings`.

#### Scenario: Settings persist after reload
- **WHEN** user sets fontSize to 20px, closes the document, and reopens it
- **THEN** the HTML viewer renders with fontSize 20px

### Requirement: Floating settings panel
The HTML viewer SHALL display a floating settings toggle button in the top-right corner. Clicking it SHALL expand a panel with font size, line height, and font family controls.

#### Scenario: Toggle settings panel
- **WHEN** user clicks the floating settings button
- **THEN** the settings panel appears with all reading controls

#### Scenario: Close settings panel
- **WHEN** user clicks the settings button again
- **THEN** the settings panel collapses

### Requirement: Text selection and extract support
The HTML viewer SHALL support text selection that produces a TextSelectionContext with anchored offsets. The "Create Extract" floating button SHALL appear on selection.

#### Scenario: Select text and create extract
- **WHEN** user selects text in the HTML iframe
- **THEN** a TextSelectionContext is created with the selected text, surface "html", and anchored offsets
- **AND** the "Create Extract" button appears

#### Scenario: Extract highlights render in iframe
- **WHEN** an extract highlight exists for the HTML document
- **THEN** the highlight is rendered at the correct anchored position inside the iframe
