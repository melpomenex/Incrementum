## Why

The cloud backup and sync system has substantial structural code (3 cloud providers, backup manager, sync manager, scheduler, frontend UI) but the critical integration layer is entirely stubbed out. The system cannot perform a single end-to-end backup or restore operation. OAuth tokens are lost after authentication, backup listing is hardcoded to error, document copying returns empty, database restore is a no-op, and the scheduler cannot reach any authenticated provider. This means users who configure cloud backup in Settings will see it "work" during OAuth but no data will ever actually be backed up or restored.

## What Changes

- **Implement OAuth token persistence**: Store tokens (access token, refresh token, expiry) to the app's keychain/data directory after successful OAuth callback, and retrieve them in subsequent commands (`oauth_get_account`, `oauth_is_authenticated`, `backup_create`, etc.)
- **Implement `backup_list` command**: Wire the existing `BackupManager::list_backups` through the command layer by accepting a `State<Repository>` parameter
- **Implement `copy_documents`**: Query documents from the database and copy their actual files into the backup directory
- **Implement `restore_database`**: Close connections, swap the database file, and reopen (or use SQLite backup API)
- **Implement settings export/import in backups**: Export Zustand settings to a JSON file and restore them
- **Replace system `zip`/`unzip` calls with the `zip` Rust crate** for cross-platform reliability
- **Fix provider instantiation**: All commands currently create fresh providers with `Config::default()` — they must use the persisted authenticated provider instead
- **Fix `cloud_list_files` and `cloud_import_files` stubs**: Wire to the authenticated provider
- **Remove `icloud` and `webdav` from frontend provider options** (no backend implementation)
- **Implement backup encryption** when `encrypt: true` is set (using the `aes-gcm` crate already in deps)
- **Consolidate sync systems**: Remove the duplicate standalone `sync.rs` (blocking reqwest) since `cloud_sync.rs` is the active async implementation
- **Fix the scheduler** to use the persisted authenticated provider

## Capabilities

### New Capabilities
- `oauth-token-persistence`: Secure storage and retrieval of OAuth tokens across app sessions, enabling authenticated cloud operations without re-authentication
- `backup-core-operations`: Working database export, document collection, settings export, database restore, and document restore in the backup manager
- `backup-encryption`: AES-256-GCM encryption/decryption of backup archives
- `backup-compression`: In-process ZIP creation and extraction using the Rust `zip` crate

### Modified Capabilities
- (none — no existing specs cover cloud backup)

## Impact

**Rust backend** (`src-tauri/src/`):
- `commands/cloud/oauth.rs` — token persistence integration
- `commands/cloud/backup.rs` — wire all commands to real implementations
- `commands/cloud/sync.rs` — wire list_files and import_files to authenticated provider
- `commands/scheduler.rs` — use persisted provider
- `backup/manager.rs` — implement document copy, database restore, settings export, encryption, Rust-native compression
- `cloud_sync.rs` — remove dead sync.rs, fix conflict resolution stubs
- `sync.rs` — remove (redundant blocking implementation)
- New: `cloud/auth_store.rs` — token persistence module
- `Cargo.toml` — add `keyring` crate for secure token storage

**Frontend** (`src/`):
- `stores/settingsStore.ts` — remove `icloud` and `webdav` from provider union
- `types/cloud.ts` — update provider types if needed
- `components/settings/CloudStorageSettings.tsx` — may need minor adjustments for provider list
- `components/settings/BackupRestorePanel.tsx` — minor type alignment

**Dependencies**:
- `keyring` crate (secure token storage, OS keychain integration)
- Existing `zip`, `aes-gcm`, `sha2` crates (already in Cargo.toml but unused for this purpose)
