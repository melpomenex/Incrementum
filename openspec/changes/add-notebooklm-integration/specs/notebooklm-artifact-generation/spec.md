## ADDED Requirements

### Requirement: User can generate NotebookLM artifacts from Incrementum
The system SHALL allow users to request NotebookLM artifact generation for supported artifact types from the active notebook.

#### Scenario: Generate flashcards
- **WHEN** the user requests flashcard generation with optional difficulty and quantity settings
- **THEN** the system submits a generation task and returns a tracked job identifier

#### Scenario: Generate study guide report
- **WHEN** the user requests a report with format `study-guide`
- **THEN** the system submits the generation task and surfaces completion state in Incrementum

### Requirement: Artifact jobs are tracked with resilient status handling
The system SHALL track long-running generation jobs and expose clear terminal states for success and failure.

#### Scenario: Successful job completion
- **WHEN** a generation job reaches a successful terminal state
- **THEN** the system marks the job complete and enables artifact preview/download/import actions

#### Scenario: Authentication expires during job
- **WHEN** a generation poll detects authentication failure
- **THEN** the system marks the job as `expired-auth` and prompts the user to reconnect before retry

### Requirement: Users can access exported artifact data formats needed for study workflows
The system SHALL support retrieval of structured artifact outputs required for Incrementum ingestion.

#### Scenario: Download flashcards as JSON
- **WHEN** a generated flashcard artifact is selected for sync
- **THEN** the system retrieves a JSON representation suitable for card mapping

#### Scenario: Download quiz in markdown or JSON
- **WHEN** a generated quiz artifact is selected for sync
- **THEN** the system retrieves the selected export format and preserves question-answer structure
