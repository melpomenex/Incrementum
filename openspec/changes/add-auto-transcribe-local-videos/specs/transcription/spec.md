# Transcription Capabilities

## ADDED Requirements

### Requirement: Auto-transcribe local videos on import
When enabled, the system SHALL automatically enqueue background transcription jobs for newly imported local video documents.

#### Scenario: Auto-transcribe enabled
- **GIVEN** auto-transcribe local videos is enabled
- **AND** a user imports a local video
- **WHEN** the import completes
- **THEN** the system SHALL enqueue a transcription job for the video
- **AND** the import flow SHALL NOT block on transcription completion

#### Scenario: Auto-transcribe disabled
- **GIVEN** auto-transcribe local videos is disabled
- **WHEN** a user imports a local video
- **THEN** the system SHALL NOT enqueue a transcription job automatically

### Requirement: Resource-aware background transcription
The system SHALL run auto-transcription in the background with safeguards to minimize impact on typical laptop performance.

#### Scenario: Background execution
- **GIVEN** a transcription job is running
- **WHEN** the user continues normal app usage
- **THEN** the system SHALL limit transcription to a single active job
- **AND** the system SHALL apply low-priority execution hints where supported

### Requirement: Model prompt and warnings in settings
The system SHALL present model selection and clear resource-usage warnings in Audio Transcription settings when auto-transcription is enabled.

#### Scenario: No model installed
- **GIVEN** auto-transcribe local videos is enabled
- **AND** no transcription model is installed
- **WHEN** the user opens Audio Transcription settings
- **THEN** the system SHALL prompt the user to select and download a model with brief descriptions
- **AND** the system SHALL warn that background transcription can increase CPU and battery usage

### Requirement: Transcript availability on open
The system SHALL surface transcription status when a user opens a local video whose transcript is still processing.

#### Scenario: Opening before completion
- **GIVEN** a local video transcription job is in progress
- **WHEN** the user opens the video
- **THEN** the transcript panel SHALL show an in-progress state
- **AND** the transcript SHALL appear automatically once the job completes
