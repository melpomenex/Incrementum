## ADDED Requirements

### Requirement: Full app-state replication across devices
The system SHALL replicate the user's full reading and review state — documents, extracts, learning items, review history, review schedule, audio playback positions, and application settings — across every device joined to the same sync room, on every supported platform (web/PWA, Tauri desktop, Tauri mobile), without requiring any other device to be online at the same time.

#### Scenario: New device joins an existing room
- **WHEN** a user installs the app on a new device
- **AND** joins an existing sync room with the room secret
- **THEN** the system SHALL download the full shared document state from the sync relay
- **AND** the local database SHALL be populated from the shared state
- **AND** no other device is required to be online for this to succeed

#### Scenario: Offline edit then reconnect
- **WHEN** a device makes changes while offline (e.g. reviews cards on a phone in airplane mode)
- **AND** later reconnects to the sync relay
- **THEN** the system SHALL push the offline changes to the relay
- **AND** the relay SHALL forward them to any other devices that connect later
- **AND** no data entered while offline SHALL be lost

#### Scenario: Sync enabled on all device profiles
- **WHEN** the app runs as web/PWA, Tauri desktop, or Tauri mobile
- **THEN** the sync subsystem SHALL initialize and connect to the relay
- **AND** the sync feature SHALL NOT be gated off on Tauri targets

### Requirement: Single canonical state channel
The system SHALL use one Yjs shared document as the single source of truth for all replicated state. Local storage engines (IndexedDB on web, SQLite on Tauri) SHALL act as projections of the shared document, repopulated from it via per-entity adapters. Writes from the UI SHALL go into the Yjs document first; the local store SHALL NOT accept direct writes that bypass the Yjs document.

#### Scenario: UI writes are Yjs-first
- **WHEN** the user performs any action that mutates replicated state (creates a document, marks a review, edits an extract)
- **THEN** the change SHALL be applied to the corresponding Yjs shared type
- **AND** the local database SHALL be updated by the adapter reacting to the Yjs change
- **AND** the local database SHALL NOT be updated by a direct write that bypasses the Yjs document

#### Scenario: Two devices write the same entity before sync
- **WHEN** device A and device B both edit the same entity while offline
- **AND** they reconnect
- **THEN** the merge SHALL converge deterministically (CRDT semantics)
- **AND** no edit SHALL be silently lost
- **AND** for scalar fields the result SHALL be the value with the most recent `updatedAt`

### Requirement: Idempotent review-history replication
The system SHALL represent each review event as an entry in a `Y.Map<string, Review>` keyed by a deterministic identifier derived from `cardId`, `reviewedAt` timestamp, and `deviceId`. Replayed review events (e.g. a device re-broadcasts after reconnect) SHALL collapse to a single entry and SHALL NOT be counted more than once by any scheduling algorithm.

#### Scenario: Same review arrives twice
- **WHEN** a device pushes a review update that another device has already recorded (same `cardId`, same `reviewedAt`, same `deviceId`)
- **THEN** the shared document SHALL contain exactly one entry for that review
- **AND** recomputing a card's schedule from the review log SHALL produce the same result regardless of how many times the event was replayed

#### Scenario: Same card reviewed on two devices before sync
- **WHEN** device A reviews card C at time T1
- **AND** device B reviews card C at time T2 while offline
- **AND** both devices later sync
- **THEN** the shared document SHALL contain both review events
- **AND** the card's projected scheduling state SHALL reflect both reviews in chronological order

### Requirement: Tombstones for deletions
The system SHALL represent entity deletions as tombstone records (`_deleted: true`, `deletedAt: <timestamp>`) rather than as key removals from the shared map, so that devices joining after a deletion learn the entity is gone rather than absent. Tombstones older than 30 days SHALL be eligible for garbage collection.

#### Scenario: Device joins after a delete
- **WHEN** device A deletes an entity
- **AND** device B (which has never seen the entity) joins the room later
- **THEN** device B SHALL receive the tombstone
- **AND** device B SHALL NOT recreate the entity from stale local data

#### Scenario: Tombstone garbage collection
- **WHEN** a tombstone is older than 30 days
- **AND** all online devices have acknowledged it
- **THEN** the tombstone MAY be purged from the shared document
- **AND** purging SHALL NOT cause any device to resurrect the deleted entity

### Requirement: Honest encryption status in the UI
The system SHALL display sync encryption status that truthfully reflects the active configuration. The UI SHALL NOT display "End-to-end enabled" unless a room key is actually set and the encryption wrapper is active for both state and file paths.

#### Scenario: Encryption fully enabled
- **WHEN** the user has set a room secret
- **AND** the derived room key is in use for both Yjs state encryption and file-blob encryption
- **THEN** the sync settings UI SHALL display "Encrypted"

#### Scenario: Legacy unencrypted room
- **WHEN** a room exists but no room secret has been set
- **THEN** the sync settings UI SHALL display "TLS only — room secret"
- **AND** the UI SHALL show a warning explaining that server-side relay can read the data

#### Scenario: No room configured
- **WHEN** no sync room is configured
- **THEN** the sync settings UI SHALL display "Not syncing"

### Requirement: Real end-to-end encryption of state and files
The system SHALL derive a 256-bit room key from a user-held room secret using Argon2id. The relay SHALL receive only ciphertext for both Yjs state updates and file-blob content. The room secret SHALL never be transmitted to the relay in any form.

#### Scenario: User creates a new room with a passphrase
- **WHEN** the user creates a new sync room and provides a passphrase
- **THEN** the system SHALL derive a room key via Argon2id (memory cost ≥ 32 MB)
- **AND** SHALL derive separate sub-keys for state, files, and manifest authentication via HKDF-SHA256
- **AND** SHALL NOT transmit the passphrase or derived room key to the relay

#### Scenario: Encrypted state on the wire
- **WHEN** a device sends a Yjs update to the relay
- **THEN** the payload SHALL be AES-GCM ciphertext under the state sub-key
- **AND** the relay SHALL receive opaque bytes it cannot decrypt

#### Scenario: Per-device room-key caching
- **WHEN** a device has successfully joined a room
- **THEN** the device SHALL cache the derived room key in OS-provided secure storage (Keychain / DPAPI / Keystore / browser IndexedDB encrypted under a per-device secret)
- **AND** subsequent launches of the same device SHALL NOT require the user to re-enter the passphrase

#### Scenario: User rotates the room key
- **WHEN** the user initiates a room-key reset
- **THEN** the system SHALL generate a new room secret
- **AND** SHALL re-encrypt the file manifest under the new key
- **AND** SHALL broadcast the re-key to all online devices via the existing shared document
- **AND** devices that are offline at reset time SHALL re-sync when they next connect

### Requirement: Room join via shared secret
The system SHALL allow a user to join an existing sync room by entering or scanning a room secret (passphrase or QR-encoded 256-bit key). The system SHALL NOT allow joining by room ID alone if a room key is configured for that room.

#### Scenario: Join via QR code
- **WHEN** device A displays its room secret as a QR code
- **AND** device B scans the QR code
- **THEN** device B SHALL derive the same room key
- **AND** SHALL connect to the relay using the existing room ID
- **AND** SHALL begin receiving and decrypting shared state

#### Scenario: Join with wrong secret
- **WHEN** a user enters an incorrect passphrase for a room
- **THEN** the system SHALL fail to decrypt inbound state updates
- **AND** SHALL surface a clear error ("incorrect room secret") to the user
- **AND** SHALL NOT corrupt local state

### Requirement: Migration from legacy local data
The system SHALL migrate a user's existing local data (IndexedDB on web/PWA, SQLite on Tauri desktop) into the shared Yjs document on first launch of the new client. The migration SHALL preserve all entities. On conflicts where the room already contains data, the merge SHALL be deterministic (last-writer-wins by `updatedAt` for scalar fields; deterministic-ID dedup for reviews).

#### Scenario: First launch with existing local data and no room
- **WHEN** a user launches the new client for the first time
- **AND** they have local data from the previous client version
- **AND** they create a new room
- **THEN** all existing local entities SHALL be written into the shared Yjs document
- **AND** local data SHALL remain intact as a projection

#### Scenario: First launch joining an existing room with local data
- **WHEN** a user joins an existing room
- **AND** the device has local data not yet in the room
- **THEN** each local entity SHALL be merged into the shared document by `updatedAt`
- **AND** the user SHALL be notified of the merge outcome (items synced, conflicts merged)

#### Scenario: Migration is idempotent
- **WHEN** migration has already completed on a device
- **AND** the user launches the app again
- **THEN** migration SHALL NOT re-run
- **AND** the device SHALL connect to the relay normally

### Requirement: Recovery from sync corruption without data loss
The system SHALL recover from Yjs decode/persistence corruption without bulk-deleting the local database. Corruption detection SHALL target the specific failure signature and reset only the affected shared-document state, preserving local data so it can be re-uploaded on the next successful connection.

#### Scenario: Yjs decode failure
- **WHEN** the Yjs document fails to decode on load
- **THEN** the system SHALL reset only the shared-document persistence layer
- **AND** SHALL preserve the local database
- **AND** SHALL re-bootstrap the shared document from local data on next connection
- **AND** SHALL rate-limit the reset to once per session to prevent reload loops

### Requirement: Deprecated state-sync paths are removed
The system SHALL retire the JWT/Postgres REST sync server (`server/src/routes/sync.ts`) and the Rust `cloud_sync.rs` provider trait as state-replication paths. After a deprecation window, the code SHALL be removed. The Yjs relay SHALL be the only state-replication channel.

#### Scenario: User on a build that still has the old REST sync path
- **WHEN** a user runs a build that predates the deprecation
- **THEN** that build SHALL continue to function against the existing REST server
- **AND** SHALL receive a UI notice that the sync method is deprecated
- **AND** the user SHALL be prompted to update

#### Scenario: Post-deprecation removal
- **WHEN** the deprecation window has elapsed
- **THEN** the REST sync server code SHALL be removed from the repo
- **AND** the Rust `cloud_sync.rs` module SHALL be removed
- **AND** any user still on a build relying on either path SHALL receive a clear upgrade-required message
