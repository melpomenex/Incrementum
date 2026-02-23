## ADDED Requirements

### Requirement: User can connect a NotebookLM account in Incrementum
The system SHALL allow a user to connect and validate a NotebookLM account session from within Incrementum before NotebookLM actions are enabled.

#### Scenario: Successful account connection
- **WHEN** the user completes NotebookLM authentication in Incrementum
- **THEN** the system stores the session securely and marks NotebookLM as connected

#### Scenario: Session validation failure
- **WHEN** NotebookLM session validation fails due to expiration or invalid credentials
- **THEN** the system marks the integration as disconnected and provides a reconnect action

### Requirement: User can manage notebooks and sources from Incrementum
The system SHALL provide in-app actions to list/create/select notebooks and add/manage sources using NotebookLM-supported source types.

#### Scenario: Create and select notebook
- **WHEN** the user creates a notebook from Incrementum and selects it as active
- **THEN** subsequent NotebookLM actions run against that notebook

#### Scenario: Add a source URL
- **WHEN** the user submits a URL source to the active notebook
- **THEN** the system queues source ingestion and shows source status to the user

### Requirement: User can run NotebookLM chat and research workflows in-app
The system SHALL support asking questions and triggering research workflows from Incrementum using the selected notebook context.

#### Scenario: Ask a question in notebook context
- **WHEN** the user submits a question in the NotebookLM panel
- **THEN** the system shows the response and associated source references in the conversation view

#### Scenario: Start research workflow
- **WHEN** the user starts a web or drive research workflow with a query
- **THEN** the system tracks progress and shows import results when the research run completes
