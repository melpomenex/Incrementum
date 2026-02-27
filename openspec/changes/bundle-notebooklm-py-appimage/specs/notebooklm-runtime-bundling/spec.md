## ADDED Requirements

### Requirement: Packaged NotebookLM Runtime Availability
The system SHALL include a runnable NotebookLM Python runtime in Linux AppImage distributions so NotebookLM commands can execute without an external venv or system Python installation.

#### Scenario: Bundled runtime present in packaged app
- **WHEN** a Linux AppImage build is produced
- **THEN** the build output MUST contain the expected NotebookLM runtime layout including Python executable and NotebookLM site-packages

#### Scenario: Runtime selected in packaged environment
- **WHEN** the application is launched from an AppImage and NotebookLM integration is invoked
- **THEN** the backend MUST resolve and use the bundled runtime before attempting system CLI or managed bootstrap fallbacks

### Requirement: Deterministic NotebookLM Command Environment
The system SHALL construct NotebookLM process environment variables from bundled runtime metadata so command execution is consistent between health checks and feature commands.

#### Scenario: Python module resolution is configured
- **WHEN** the backend launches a NotebookLM command using bundled runtime
- **THEN** it MUST set runtime environment values required to import and execute `notebooklm` modules successfully

#### Scenario: Browser dependency path is configured
- **WHEN** bundled Playwright/browser assets are present
- **THEN** the backend MUST expose the configured browser path to NotebookLM command execution

### Requirement: Runtime Integrity Diagnostics
The system SHALL validate required NotebookLM runtime components and return actionable errors when runtime artifacts are missing, unreadable, or incomplete.

#### Scenario: Missing runtime artifact detected
- **WHEN** a required runtime file or directory is absent at invocation time
- **THEN** the backend MUST fail fast with an explicit error identifying the missing component and remediation guidance

#### Scenario: Runtime validation passes
- **WHEN** all required runtime artifacts are available
- **THEN** NotebookLM commands MUST proceed without triggering runtime bootstrap solely due to packaging resolution issues

### Requirement: AppImage Release Validation for NotebookLM
The system SHALL include release validation that proves NotebookLM integration works in packaged Linux artifacts.

#### Scenario: Packaged smoke test
- **WHEN** a release candidate AppImage is built
- **THEN** the validation workflow MUST execute NotebookLM health and at least one NotebookLM command path successfully in packaged context

#### Scenario: Validation failure blocks release readiness
- **WHEN** NotebookLM packaged validation fails
- **THEN** the release process MUST mark the build as not ready for distribution until resolved
