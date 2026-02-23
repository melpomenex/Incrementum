## ADDED Requirements

### Requirement: NotebookLM Research Mode Toggle
The system SHALL provide a NotebookLM toggle in the Document Q&A tab that explicitly enables or disables NotebookLM-assisted research for the active user session.

#### Scenario: Enable NotebookLM mode
- **WHEN** the user turns on the NotebookLM toggle in Document Q&A
- **THEN** the system enables NotebookLM research actions and marks the session as NotebookLM-active

#### Scenario: Disable NotebookLM mode
- **WHEN** the user turns off the NotebookLM toggle in Document Q&A
- **THEN** the system stops new NotebookLM requests and keeps baseline Document Q&A functionality available

### Requirement: NotebookLM Request Orchestration
The system SHALL route NotebookLM research requests through a backend orchestration layer that applies validation, throttling, retry policy, and structured error responses.

#### Scenario: Successful research request
- **WHEN** a NotebookLM-active user submits a valid research prompt
- **THEN** the system returns a structured research response containing generated content and source provenance metadata

#### Scenario: Throttled research request
- **WHEN** a user exceeds configured request limits for NotebookLM research
- **THEN** the system rejects the request with a rate-limit error and user-actionable retry guidance

### Requirement: Research Session Persistence
The system SHALL persist NotebookLM research session state per document and user, including prompts, responses, and timestamps.

#### Scenario: Resume research session
- **WHEN** a user reopens a document with an existing NotebookLM research session
- **THEN** the system restores the prior research timeline and current draft state
