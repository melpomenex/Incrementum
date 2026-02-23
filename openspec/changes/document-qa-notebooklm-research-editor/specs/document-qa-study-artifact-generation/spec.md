## ADDED Requirements

### Requirement: Cloze Deletion Generation from Selection
The system SHALL allow users to create cloze deletions from selected inline research text and preview the cloze before commit.

#### Scenario: Create cloze from selected text
- **WHEN** the user selects text and chooses the cloze creation action
- **THEN** the system generates a cloze draft with the selected span masked and displays a preview for confirmation

### Requirement: Q&A Card Generation from Selection
The system SHALL allow users to generate a Q&A card from selected research text, including editable question and answer fields before save.

#### Scenario: Create Q&A card from selected text
- **WHEN** the user selects text and chooses the Q&A creation action
- **THEN** the system generates a Q&A draft and allows user edits before the card is saved

### Requirement: Brainstorm Prompt Helpers
The system SHALL provide brainstorming prompt helpers in Document Q&A that seed research prompts for common intents.

#### Scenario: Use brainstorming helper
- **WHEN** the user selects a brainstorming helper such as summarize, compare, timeline, or key concepts
- **THEN** the system inserts a corresponding editable prompt template and allows the user to submit it to NotebookLM

### Requirement: Artifact Provenance Tracking
The system SHALL store provenance metadata linking each generated artifact to source document identifier, research session, and selected text range.

#### Scenario: Save artifact with provenance metadata
- **WHEN** a user saves a generated cloze or Q&A artifact
- **THEN** the system persists the artifact with source linkage metadata sufficient for traceability
