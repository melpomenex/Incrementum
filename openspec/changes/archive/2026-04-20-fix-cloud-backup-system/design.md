## Context

Incrementum is a Tauri v2 desktop app (Rust backend, React/TypeScript frontend) with SQLite storage. The cloud backup system has three implemented cloud provider integrations (OneDrive, Google Drive, Dropbox) with full OAuth flows at the HTTP level, a BackupManager with create/restore/list/delete, a CloudSyncManager for two-way sync, and a polished frontend UI. However, the integration layer is entirely stubbed — OAuth tokens are never persisted, backup commands create fresh unauthenticated providers, and core backup operations (document copy, database restore, encryption) are TODOs.

The current architecture has two overlapping sync implementations: `cloud_sync.rs` (async, uses `CloudProvider` trait — the intended one) and `sync.rs` (blocking reqwest, standalone — legacy). Only `cloud_sync.rs` is wired into commands.

## Goals / Non-Goals

**Goals:**
- Make the end-to-end backup flow work: authenticate → create backup → upload → list → download → restore
- Persist OAuth tokens securely so users authenticate once per provider
- Implement all stubbed backup operations (document copy, database restore, settings export)
- Add AES-256-GCM encryption to backups when enabled
- Replace fragile system `zip`/`unzip` calls with the `zip` Rust crate
- Wire the scheduler to authenticated providers
- Clean up the dead `sync.rs` module

**Non-Goals:**
- Implementing iCloud or WebDAV providers (no API access/docs available)
- Building a real-time sync engine (two-way sync improvements are future work)
- Changing the frontend UI layout or UX flow
- Server-side sync (`server/src/routes/sync.ts`) is a separate system — leave as-is
- Migration of existing users (no one has working backups yet, so no migration needed)

## Decisions

### 1. Token storage: `keyring` crate → OS keychain

**Choice**: Use the `keyring` crate to store OAuth tokens in the OS-native keychain (Keychain on macOS, Credential Manager on Windows, Secret Service on Linux).

**Alternatives considered**:
- *Encrypted JSON file on disk*: Simpler but less secure, requires managing encryption keys ourselves
- *SQLite table with encrypted tokens*: Would work but leaks tokens if database is copied/backed up
- *Tauri plugin keyring*: Currently the `tauri-plugin-keyring` is less mature; raw `keyring` crate is more battle-tested

**Rationale**: OS keychain is the standard for desktop app credential storage. Tokens are accessible across app restarts, protected by the OS, and cleared when the user explicitly disconnects. Service name: `com.incrementum.app`, username: `<provider_type>` (e.g., `onedrive`, `google-drive`, `dropbox`).

### 2. Database restore: SQLite online backup API

**Choice**: Use SQLite's `backup` API (available via `rusqlite::backup::Backup`) to perform an online backup from the downloaded database file into the live database. This avoids closing all connections.

**Alternatives considered**:
- *Close pool, swap file, reopen*: Requires coordination with all query paths and risks panics
- *SQL dump + replay*: Slow for large databases, error-prone with binary data

**Rationale**: The online backup API is designed exactly for this use case. It handles concurrent readers and replaces pages atomically.

### 3. Compression: `zip` Rust crate

**Choice**: Use the `zip` crate (already in `Cargo.toml`) with `ZipWriter` and `ZipArchive` for compression and extraction.

**Rationale**: The current system shells out to `zip`/`unzip` commands which don't exist on Windows by default and fail silently in minimal environments. The `zip` crate is a well-maintained pure-Rust solution already in the dependency tree.

### 4. Encryption: AES-256-GCM with user-provided password

**Choice**: When `encrypt: true`, prompt the user for a password (stored only in memory during the backup session, never persisted). Derive a 256-bit key using PBKDF2 with a random salt stored in the backup manifest. Encrypt the zip archive with AES-256-GCM.

**Alternatives considered**:
- *Derive key from device ID*: Less secure, can't restore on a different device
- *Store encryption key in keychain*: Defeats the purpose of encryption (key is on the same machine)

**Rationale**: A user-provided password is the only scheme where the encryption key isn't co-located with the data. This is important for cloud backups where the provider could be compromised.

### 5. Authenticated provider: Global `OnceLock` with `Arc<RwLock<>>`

**Choice**: Create a `CloudAuthProvider` struct that holds `HashMap<CloudProviderType, Arc<RwLock<Box<dyn CloudProvider>>>>`. Initialize from Tauri `manage()` state. Commands access via `State<CloudAuthProvider>`.

**Rationale**: Tauri State is the idiomatic way to share state across commands. `Arc<RwLock<>>` allows concurrent reads (multiple backup list queries) while serializing writes (token refresh). The provider map is populated on app startup from persisted keychain tokens.

### 6. Remove `sync.rs`, keep `cloud_sync.rs`

**Choice**: Delete `src-tauri/src/sync.rs` entirely. It uses `reqwest::blocking` (incompatible with async Tauri runtime), duplicates `cloud_sync.rs` functionality, and is not referenced by any command.

**Rationale**: Having two sync implementations creates confusion. `cloud_sync.rs` is the active, async, command-wired implementation.

## Risks / Trade-offs

- **[OS keychain availability]** → On some Linux distros, Secret Service may not be configured. Mitigation: Fall back to an encrypted file in the app data directory with a warning.
- **[Large backup uploads]** → No chunked progress reporting to the frontend yet. Mitigation: The providers already implement chunked uploads internally; add a progress callback in a follow-up.
- **[Database restore during active queries]** → The SQLite backup API handles this safely, but long-running write transactions could delay the restore. Mitigation: Show a "restoring" UI state that discourages other operations.
- **[Encryption password forgotten]** → Encrypted backups become permanently unrecoverable. Mitigation: Show a clear warning in the UI when encryption is enabled, suggesting the user store the password safely.
- **[Token refresh race conditions]** → Multiple concurrent commands might all try to refresh an expired token. Mitigation: The `RwLock` serializes write access, so at most one refresh happens at a time.

## Open Questions

- Should we store the last-known-good backup metadata locally so `backup_list` can work offline? (Decide during implementation — probably yes, as a fast path)
- Should the encryption password be required on backup creation, or can we generate and store it in the keychain? (User-provided is more secure but worse UX)
