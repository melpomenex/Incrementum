## ADDED Requirements

### Requirement: Server-side durable file storage
The system SHALL store file blobs on the existing file-service (`sync.readsync.org/files`) as the canonical durable home. Files SHALL remain available for download by any device joined to the room at any time, regardless of whether any other device is online.

#### Scenario: File uploaded, source device goes offline
- **WHEN** device A imports and uploads a file
- **AND** device A goes offline before any other device sees the file
- **AND** device B comes online later
- **THEN** device B SHALL be able to download the file from the file-service
- **AND** the file SHALL be available indefinitely (subject to per-room quota)

#### Scenario: New device joins and fetches all files
- **WHEN** a new device joins a room with existing files
- **AND** the device's auto-download mode allows it
- **THEN** the device SHALL download the files it does not yet have from the file-service
- **AND** no other device is required to be online

### Requirement: Single unified file pipeline
The system SHALL provide exactly one file upload/download pipeline. The previous P2P streaming path (`file-transfer.ts`) SHALL be removed. The Yjs file manifest SHALL be the single source of truth for which files exist in the room; the file-service SHALL be the single source of truth for file bytes.

#### Scenario: File import
- **WHEN** a user imports a file on any device profile
- **THEN** the file SHALL be uploaded (encrypted) to the file-service
- **AND** a manifest entry SHALL be added to the shared Yjs document
- **AND** no separate P2P transfer path SHALL exist

#### Scenario: Manifest entry exists but file bytes missing from server
- **WHEN** a manifest entry references file chunks that have been evicted from the file-service
- **AND** at least one device in the room has a local copy of the file
- **THEN** the requesting device SHALL be able to request a re-upload from that device
- **AND** once re-uploaded, the requesting device SHALL download normally
- **AND** if no device has a local copy, the manifest entry SHALL be marked `unrecoverable` and surfaced to the user

### Requirement: Content-defined chunking
The system SHALL split files into content-defined chunks (rolling-hash boundaries, target average size 64 KB) rather than fixed-size offsets. Two devices that independently import the same file SHALL produce identical chunk boundaries and identical chunk hashes, enabling server-side deduplication.

#### Scenario: Same file imported on two devices
- **WHEN** device A imports file F
- **AND** device B independently imports the same file F
- **THEN** both devices SHALL compute the same set of chunk hashes
- **AND** the file-service SHALL store each unique chunk exactly once
- **AND** the manifest entries SHALL reference the same chunk hashes

#### Scenario: Small file
- **WHEN** a file is smaller than the target chunk size
- **THEN** the file SHALL be stored as a single chunk
- **AND** the chunk hash SHALL equal the file's content hash

### Requirement: Per-chunk integrity
The system SHALL compute and store a SHA-256 hash for each chunk's plaintext. The manifest SHALL store the ordered list of chunk hashes for each file. On download, the system SHALL verify each decrypted chunk against its recorded hash before assembling the file.

#### Scenario: Chunk corrupted in transit or at rest
- **WHEN** a downloaded chunk's plaintext hash does not match the manifest
- **THEN** the system SHALL discard the chunk
- **AND** SHALL re-download that specific chunk
- **AND** SHALL NOT assemble the file until all chunks verify

### Requirement: Resumable uploads and downloads
The system SHALL support resuming interrupted file uploads and downloads. The client SHALL persist transfer progress per `(fileId, chunkHash)` in local storage. On reconnect after an interruption, the client SHALL query the file-service for which chunk hashes it already has and SHALL transfer only the missing chunks.

#### Scenario: Upload interrupted and resumed
- **WHEN** a file upload is interrupted partway through
- **AND** the device reconnects
- **THEN** the client SHALL query the file-service for which chunks of that file already exist
- **AND** SHALL upload only the missing chunks
- **AND** SHALL NOT re-upload chunks that are already present

#### Scenario: Download interrupted and resumed
- **WHEN** a file download is interrupted partway through
- **AND** the device reconnects
- **THEN** the client SHALL resume from the last persisted chunk
- **AND** SHALL NOT re-download chunks it already has
- **AND** SHALL surface progress to the user

### Requirement: Client-side file encryption
The system SHALL encrypt every file chunk with AES-GCM under the file sub-key derived from the room key (per the `cross-device-sync` capability). The file-service SHALL receive and store ciphertext only. The plaintext SHA-256 (used for chunk identity and manifest integrity) SHALL be computed before encryption; the manifest SHALL store plaintext hashes, not ciphertext hashes.

#### Scenario: Encrypted upload
- **WHEN** a device uploads a file chunk
- **THEN** the chunk SHALL be encrypted with a fresh random 96-bit AES-GCM nonce
- **AND** the nonce SHALL be stored alongside the ciphertext on the file-service
- **AND** the file-service SHALL receive only ciphertext

#### Scenario: Encrypted download
- **WHEN** a device downloads a file chunk
- **THEN** the device SHALL decrypt the ciphertext using the file sub-key
- **AND** SHALL verify the plaintext hash matches the manifest entry
- **AND** SHALL persist the encrypted chunk locally and decrypt on first read to avoid storing plaintext at rest unnecessarily

### Requirement: Manifest authenticity
The system SHALL authenticate every file manifest entry with an HMAC under the manifest-auth sub-key derived from the room key. A manifest entry whose HMAC does not verify SHALL be rejected by the client, preventing a tampering relay or a client-without-key from injecting entries that decrypt to garbage.

#### Scenario: Tampered manifest entry
- **WHEN** a manifest entry arrives with an invalid HMAC
- **THEN** the client SHALL reject the entry
- **AND** SHALL NOT display the file as available
- **AND** SHALL log a security warning visible to the user in sync diagnostics

#### Scenario: Relay injects a manifest entry without the key
- **WHEN** the sync relay attempts to inject a manifest entry it constructed itself
- **THEN** the entry SHALL fail HMAC verification on every client
- **AND** no client SHALL treat the file as part of the room

### Requirement: Per-room storage quota
The system SHALL enforce a per-room storage quota on the file-service (default 2 GB, configurable). The client SHALL surface quota usage and remaining capacity in the sync settings UI. When the quota is exceeded, the system SHALL refuse new uploads and SHALL surface a clear error to the user.

#### Scenario: Approaching quota
- **WHEN** a room's storage usage exceeds 80% of quota
- **THEN** the sync UI SHALL display a warning with current usage and remaining capacity
- **AND** SHALL NOT block uploads yet

#### Scenario: Quota exceeded on upload
- **WHEN** a user attempts to upload a file that would exceed the room quota
- **THEN** the file-service SHALL reject the upload with a quota-exceeded error
- **AND** the client SHALL surface the error with options (delete files, request quota increase)

### Requirement: Server-side eviction under quota pressure
The system SHALL evict file chunks from the file-service only when at least N (default 2) devices in the room have a local copy of the corresponding file, ensuring no data is lost. Evicted chunks SHALL remain referenced by the manifest; the manifest entry SHALL be marked `bytes-evicted`. A device that later requests an evicted file SHALL trigger a re-upload from a device that has it locally.

#### Scenario: Quota pressure with redundancy
- **WHEN** the file-service needs to reclaim space
- **AND** file F has 3 devices with local copies
- **THEN** the oldest least-recently-fetched chunks of F SHALL be eligible for eviction
- **AND** the manifest entry SHALL be updated to `bytes-evicted`
- **AND** the file SHALL still appear in the manifest

#### Scenario: Evicted file requested
- **WHEN** a device requests download of a file marked `bytes-evicted`
- **THEN** the system SHALL identify a device with a local copy
- **AND** SHALL request that device re-upload the file
- **AND** SHALL then complete the download on the requesting device
- **AND** if no device has a local copy, SHALL mark the file `unrecoverable`

### Requirement: Auto-download configuration
The system SHALL honor the user's auto-download setting (`always`, `wifi-only`, `manual`) when new files appear in the manifest. Auto-download SHALL trigger off the manifest update, not off peer-device presence.

#### Scenario: Auto-download always
- **WHEN** the user's auto-download mode is `always`
- **AND** a new file appears in the manifest
- **THEN** the system SHALL begin downloading the file immediately
- **AND** SHALL surface progress in the UI

#### Scenario: Auto-download wifi-only on cellular
- **WHEN** the user's auto-download mode is `wifi-only`
- **AND** the device is on a cellular connection
- **AND** a new file appears in the manifest
- **THEN** the system SHALL NOT begin downloading
- **AND** SHALL queue the file for download when the device returns to WiFi
- **AND** SHALL surface the queued file as "waiting for WiFi" in the UI

#### Scenario: Manual download
- **WHEN** the user's auto-download mode is `manual`
- **AND** a new file appears in the manifest
- **THEN** the system SHALL NOT download automatically
- **AND** SHALL surface the file as "available for download"

### Requirement: File sync status display
The system SHALL display the sync status of each file to the user. Status SHALL reflect the actual state of the file on both the local device and the file-service, derived from the manifest and local cache.

#### Scenario: File fully synced locally
- **WHEN** a file's chunks are all present in the local cache and verified
- **THEN** the UI SHALL show a "synced" indicator

#### Scenario: File available on server, not local
- **WHEN** a file is in the manifest and its chunks are present on the file-service
- **AND** the device does not have the file locally
- **THEN** the UI SHALL show an "available" indicator with a download action

#### Scenario: File upload in progress
- **WHEN** a file is being uploaded
- **THEN** the UI SHALL show a progress indicator with the percentage of chunks uploaded

#### Scenario: File download in progress
- **WHEN** a file is being downloaded
- **THEN** the UI SHALL show a progress indicator with the percentage of chunks downloaded

#### Scenario: File marked unrecoverable
- **WHEN** a manifest entry is marked `unrecoverable`
- **THEN** the UI SHALL show an "unrecoverable" indicator
- **AND** SHALL offer the user the option to remove the manifest entry

### Requirement: Consolidated local file cache
The system SHALL maintain exactly one local IndexedDB cache for file chunks (`incrementum-file-cache`). The previous duplicate cache paths are consolidated. Chunk entries SHALL be reference-counted against manifest entries so that deleting a file from the manifest frees its chunks from the cache.

#### Scenario: File removed from manifest
- **WHEN** a file entry is removed from the manifest (e.g. user deletes the document)
- **AND** no other manifest entry references the same chunks
- **THEN** the local cache SHALL delete those chunks
- **AND** local storage usage SHALL be reclaimed

#### Scenario: Two files share chunks (deduplication)
- **WHEN** two files in the manifest reference the same chunk hash (because content-defined chunking produced identical boundaries)
- **THEN** the local cache SHALL store the chunk exactly once
- **AND** deleting one file SHALL NOT remove the chunk while the other file still references it
