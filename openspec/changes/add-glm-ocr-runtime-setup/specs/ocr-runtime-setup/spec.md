## ADDED Requirements
### Requirement: GLM-OCR Setup Wizard
The system SHALL provide an in-app setup wizard for GLM-OCR that can install a local runtime and configure the OCR provider.

#### Scenario: User starts setup from OCR settings
- **WHEN** the user selects GLM-OCR in OCR settings and chooses to set it up
- **THEN** the system guides them through runtime selection, installation, and model setup

### Requirement: Runtime Backend Selection
The system SHALL allow users to select an Ollama (CPU-friendly) or vLLM (GPU) backend for GLM-OCR.

#### Scenario: CPU path selected
- **WHEN** the user selects the CPU-friendly setup
- **THEN** the system configures GLM-OCR to use an Ollama backend

#### Scenario: GPU path selected
- **WHEN** the user selects the GPU-accelerated setup
- **THEN** the system configures GLM-OCR to use a vLLM backend

### Requirement: App Data Install Location
The system SHALL install runtime binaries and downloaded models under the app data directory.

#### Scenario: Installation completes
- **WHEN** the setup finishes downloading required runtime files and models
- **THEN** the files are stored within the app data directory

### Requirement: On-Demand Runtime Lifecycle
The system SHALL start and stop the GLM-OCR runtime on demand, without requiring a persistent background service.

#### Scenario: OCR requested with GLM-OCR selected
- **WHEN** the user runs OCR with GLM-OCR selected and the runtime is not running
- **THEN** the system starts the runtime automatically and continues OCR after it becomes healthy

#### Scenario: User stops runtime
- **WHEN** the user stops the GLM-OCR runtime from settings
- **THEN** the system shuts down the backend process and reports the stopped state

### Requirement: Setup Status and Errors
The system SHALL surface setup progress, disk usage, and actionable errors during installation.

#### Scenario: Download fails
- **WHEN** a runtime or model download fails
- **THEN** the UI displays the failure reason and offers retry or cancel

### Requirement: Cloud OCR Remains Manual
The system SHALL keep cloud OCR providers as manual API-key configurations and exclude them from the GLM-OCR setup wizard.

#### Scenario: User opens OCR providers
- **WHEN** the user views cloud OCR providers
- **THEN** the UI still presents manual API-key configuration without prompting setup
