# local-media-playback Specification Delta

## Purpose
Ensure local video and audio documents open reliably in the desktop app by resolving a playable media source, falling back when the first source is rejected, and surfacing actionable playback errors.

## ADDED Requirements

### Requirement: Desktop local media source resolution
The system SHALL resolve local desktop video and audio documents through a media-source strategy rather than assuming a single resolved asset URL is always playable.

#### Scenario: Preferred desktop media source is playable
- **GIVEN** a user opens a local video or audio document in the Tauri desktop app
- **WHEN** the preferred source strategy resolves to a playable source
- **THEN** the system SHALL use that source without materializing an unnecessary fallback copy
- **AND** the media player SHALL load normally

#### Scenario: Preferred desktop media source is rejected
- **GIVEN** a user opens a local video or audio document in the Tauri desktop app
- **AND** the preferred source resolves to a URL that the webview rejects for playback
- **WHEN** the system detects that rejection during initial media probing
- **THEN** the system SHALL attempt an eligible fallback source before declaring playback failure

### Requirement: Actionable local playback failure classification
The system SHALL classify local media playback failures closely enough to distinguish source-access failures from unsupported media format failures.

#### Scenario: Source access failure
- **GIVEN** a local media source cannot be opened or read by the current desktop webview
- **WHEN** playback probing fails
- **THEN** the system SHALL classify the failure as a source-access problem
- **AND** the UI SHALL avoid presenting codec guidance as the primary explanation

#### Scenario: Unsupported container or codec
- **GIVEN** a local media source is reachable but the embedded browser engine cannot decode the file
- **WHEN** playback probing or the media element reports an unsupported-source failure
- **THEN** the system SHALL classify the failure as an unsupported format problem
- **AND** the UI SHALL provide guidance that the file may need conversion to a supported browser format

### Requirement: Existing local media integrations remain intact
The system SHALL preserve existing local media integrations once a playable source has been resolved.

#### Scenario: Progress tracking after source fallback
- **GIVEN** a local video uses a fallback source strategy
- **WHEN** playback starts and the user pauses, seeks, or closes the document
- **THEN** playback position SHALL still be saved and restored through the existing video progress flow

#### Scenario: Transcript sync after source fallback
- **GIVEN** a local video uses a fallback source strategy
- **AND** a transcript exists for that document
- **WHEN** the user plays the video or seeks from the transcript panel
- **THEN** transcript synchronization SHALL continue to work with the resolved playable source

### Requirement: Playback diagnostics are logged
The system SHALL emit enough structured logging to identify which source strategy was used and why fallback or failure occurred.

#### Scenario: Source strategy logged on success
- **GIVEN** a local media document loads successfully
- **WHEN** the final playable source is selected
- **THEN** the application logs SHALL record the resolved source strategy

#### Scenario: Fallback reason logged on failure
- **GIVEN** a local media document fails initial source probing
- **WHEN** the system attempts fallback or reports failure
- **THEN** the application logs SHALL record the rejection reason and the fallback decision
