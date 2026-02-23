## ADDED Requirements

### Requirement: Inline Editable Research Surface
The system SHALL render NotebookLM research output in an inline editor within Document Q&A where users can directly modify generated text before saving or artifact generation.

#### Scenario: Edit generated research text
- **WHEN** NotebookLM returns research content
- **THEN** the user can edit the text inline and the system tracks the updated draft as the active working version

### Requirement: Selection-Aware Editing Actions
The inline editor SHALL support precise text selection ranges that can invoke context actions for downstream study artifact generation.

#### Scenario: Selection context actions appear
- **WHEN** the user selects a non-empty text range in the inline research editor
- **THEN** the system presents valid actions for that selection including cloze creation and Q&A creation

#### Scenario: Invalid selection is rejected
- **WHEN** the selected range is empty or outside editable research content
- **THEN** the system disables selection-based artifact actions and shows a validation message

### Requirement: Draft Auto-Save and Recovery
The system SHALL auto-save inline research drafts at defined intervals and restore the latest recoverable draft after reload.

#### Scenario: Draft recovered after refresh
- **WHEN** a user refreshes the page after making unsaved inline edits
- **THEN** the system restores the most recent auto-saved draft for the same document research session
