## ADDED Requirements

### Requirement: User can sync NotebookLM flashcards into Incrementum study decks
The system SHALL map NotebookLM flashcard outputs into Incrementum card entities and place them in a user-selected deck.

#### Scenario: Import generated flashcards to deck
- **WHEN** the user selects a flashcard artifact and chooses a destination deck
- **THEN** the system creates Incrementum cards with source attribution to the originating notebook and artifact

#### Scenario: Duplicate card handling during sync
- **WHEN** imported flashcards match existing cards by configured dedupe rules
- **THEN** the system prevents duplicate creation and reports merge/skip outcomes

### Requirement: User can convert quiz outcomes into incremental review items
The system SHALL allow quiz-derived sync modes that prioritize missed or incorrect items for scheduling.

#### Scenario: Sync incorrect quiz answers as cards
- **WHEN** the user imports a quiz and selects "missed items only"
- **THEN** the system creates or updates cards only for incorrect or missed questions

#### Scenario: Schedule imported quiz cards
- **WHEN** quiz-derived cards are created
- **THEN** the system assigns initial scheduling state consistent with Incrementum review rules

### Requirement: User can run curated NotebookLM-to-Incrementum study workflows
The system SHALL provide predefined workflow actions that combine research/generation with incremental sync.

#### Scenario: Research to study guide to deck workflow
- **WHEN** the user runs the "Research topic -> study guide -> incremental deck" action
- **THEN** the system executes each step in order and surfaces checkpoints before final import

#### Scenario: Audio or video overview attachment workflow
- **WHEN** the user runs the "Generate audio/video overview -> attach to study item" action
- **THEN** the system links the generated media artifact to the selected Incrementum study item metadata
