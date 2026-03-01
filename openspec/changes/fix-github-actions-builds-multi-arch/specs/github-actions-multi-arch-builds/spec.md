## ADDED Requirements

### Requirement: GitHub Actions Failure Triage with GH CLI
The system SHALL define and support a repeatable GitHub CLI triage workflow that identifies the workflow run, job, and step that caused a build failure.

#### Scenario: Locate latest failed run
- **WHEN** an operator investigates build instability
- **THEN** they MUST be able to retrieve the latest failed run metadata using GitHub CLI without relying on the web UI

#### Scenario: Identify failing job and step
- **WHEN** a failed run is inspected
- **THEN** the workflow diagnostics MUST expose which architecture job failed and which step produced the blocking error

### Requirement: Multi-Architecture Build Coverage
The system SHALL build release artifacts for all architectures defined in the workflow matrix.

#### Scenario: Matrix defines multiple architectures
- **WHEN** a build workflow is triggered
- **THEN** the workflow MUST execute build jobs for each configured architecture target

#### Scenario: Artifact output is architecture-specific
- **WHEN** matrix jobs complete successfully
- **THEN** each architecture job MUST publish artifacts with clear architecture labels

### Requirement: Architecture-Aware Failure Visibility
The system SHALL provide run summaries that map failures to architecture, job, and reason.

#### Scenario: Failed matrix job appears in summary
- **WHEN** any architecture job fails
- **THEN** the workflow summary MUST include that architecture and the failed job/step context

#### Scenario: Successful run confirms full architecture coverage
- **WHEN** all matrix jobs pass
- **THEN** the run summary MUST indicate all configured architectures completed successfully

### Requirement: Release Readiness Uses Architecture Outcomes
The system SHALL define release readiness based on required architecture build outcomes.

#### Scenario: Required architecture fails
- **WHEN** a required architecture job fails
- **THEN** the release workflow MUST mark the build as not ready for distribution

#### Scenario: Required architectures pass
- **WHEN** all required architecture jobs pass
- **THEN** the release workflow MUST mark the build as ready for implementation/release progression
