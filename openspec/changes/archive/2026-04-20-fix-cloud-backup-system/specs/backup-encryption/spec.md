## ADDED Requirements

### Requirement: Backup archives are encrypted with AES-256-GCM
When a backup is created with `encrypt: true`, the system SHALL encrypt the backup archive using AES-256-GCM. A unique 256-bit encryption key SHALL be derived from the user-provided password using PBKDF2-HMAC-SHA256 with a random 16-byte salt and 100,000 iterations.

#### Scenario: Encrypted backup creation
- **WHEN** `backup_create` is called with `encrypt: true` and a user password
- **THEN** a 16-byte random salt is generated
- **AND** a 256-bit key is derived via PBKDF2-HMAC-SHA256(salt, password, 100000 iterations)
- **AND** a random 12-byte nonce is generated
- **AND** the backup zip archive is encrypted using AES-256-GCM with the derived key and nonce
- **AND** the salt and nonce are stored in the manifest under `encryption.salt` and `encryption.nonce`

#### Scenario: Unencrypted backup creation
- **WHEN** `backup_create` is called with `encrypt: false`
- **THEN** no encryption is applied to the backup archive
- **AND** the manifest's `encryption.enabled` is `false`

### Requirement: Encrypted backups can be decrypted and restored
When restoring an encrypted backup, the system SHALL prompt the user for the password, derive the key using the salt from the manifest, and decrypt the archive before extraction.

#### Scenario: Successful decryption with correct password
- **WHEN** `backup_restore` is called on an encrypted backup
- **AND** the user provides the correct password
- **THEN** the system reads the salt and nonce from the manifest
- **AND** derives the decryption key via PBKDF2
- **AND** decrypts the archive
- **AND** proceeds with the normal restore flow

#### Scenario: Wrong password
- **WHEN** `backup_restore` is called on an encrypted backup
- **AND** the user provides an incorrect password
- **THEN** AES-256-GCM authentication fails
- **AND** an error is returned indicating the password is incorrect
- **AND** no data is modified

### Requirement: Password is never persisted
The encryption password SHALL be held only in memory during the backup or restore operation and MUST NOT be written to disk, keychain, or logs.

#### Scenario: Password not stored
- **WHEN** a backup is created or restored with encryption
- **THEN** the password exists only as a function parameter
- **AND** the derived key is zeroed from memory after the operation completes
