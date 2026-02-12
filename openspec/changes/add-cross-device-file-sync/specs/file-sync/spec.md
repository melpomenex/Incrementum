## ADDED Requirements

### Requirement: File Manifest Synchronization
The system SHALL maintain a synchronized file manifest across all devices in a sync room using Yjs.

#### Scenario: Device announces new file
- **WHEN** a user imports a file on Device A
- **THEN** the file metadata is added to the Yjs file manifest
- **AND** all other online devices receive the manifest update in real-time

#### Scenario: Device comes online
- **WHEN** a device connects to the sync server
- **THEN** it SHALL receive the current file manifest
- **AND** identify which files are available from other online devices

### Requirement: WebSocket File Streaming
The system SHALL stream files between devices in real-time via the existing WebSocket connection.

#### Scenario: Device requests file from peer
- **WHEN** Device B requests a file that Device A has
- **AND** Device A is online
- **THEN** Device A SHALL stream the file in chunks through WebSocket
- **AND** Device B reassembles and stores the file locally

#### Scenario: File source device goes offline during transfer
- **WHEN** a file transfer is in progress
- **AND** the source device disconnects
- **THEN** the system SHALL notify the receiving device that transfer failed
- **AND** mark the file as "unavailable" until source comes back online

#### Scenario: No online device has the file
- **WHEN** a device requests a file
- **AND** no other online device has the file locally
- **THEN** the system SHALL show "file not available" status
- **AND** queue the request for when a source device comes online

### Requirement: Auto-Download Configuration
The system SHALL allow users to configure automatic file download behavior.

#### Scenario: Auto-download always enabled
- **WHEN** user sets auto-download to "always"
- **AND** another device announces a new file
- **THEN** the system SHALL automatically download the file

#### Scenario: Auto-download WiFi only
- **WHEN** user sets auto-download to "WiFi only"
- **AND** another device announces a new file
- **AND** device is on WiFi
- **THEN** the system SHALL automatically download the file
- **BUT IF** device is on cellular, wait until WiFi is available

#### Scenario: Auto-download disabled
- **WHEN** user sets auto-download to "manual"
- **AND** another device announces a new file
- **THEN** the system SHALL NOT download automatically
- **AND** show the file as "available for download"

### Requirement: File Sync Status Display
The system SHALL display the sync status of each file to the user.

#### Scenario: File available locally
- **WHEN** a file has been downloaded to the device
- **THEN** the system SHALL show a "synced" indicator

#### Scenario: File available from online peer
- **WHEN** a file exists in the manifest
- **AND** at least one online device has the file
- **THEN** the system SHALL show an "available" indicator with download action

#### Scenario: File not available (no online source)
- **WHEN** a file exists in the manifest
- **AND** no online device has the file
- **THEN** the system SHALL show a "waiting for source" indicator

#### Scenario: File transfer in progress
- **WHEN** a file is being streamed
- **THEN** the system SHALL show a progress indicator with percentage

### Requirement: Chunked Binary Transfer
The system SHALL transfer files in chunks for reliability and progress tracking.

#### Scenario: Large file transfer
- **WHEN** transferring a file larger than 64KB
- **THEN** the system SHALL split it into 64KB chunks
- **AND** send each chunk as a separate WebSocket message

#### Scenario: Chunk transfer failure
- **WHEN** a chunk fails to transfer
- **THEN** the system SHALL retry that specific chunk up to 3 times
- **AND** resume from the last successful chunk if connection recovers
