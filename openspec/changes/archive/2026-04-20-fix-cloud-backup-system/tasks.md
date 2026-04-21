## 1. OAuth Token Persistence

- [x] 1.1 Add `keyring` crate to `Cargo.toml` dependencies
- [x] 1.2 Create `src-tauri/src/cloud/auth_store.rs` with `AuthStore` struct that stores/retrieves/removes `AuthToken` via OS keychain (service: `com.incrementum.app`, username: provider type string)
- [x] 1.3 Implement encrypted fallback in `AuthStore` for Linux systems without Secret Service (write AES-256-GCM encrypted token file to `{app_data_dir}/tokens/{provider_type}.enc`)
- [x] 1.4 Create `CloudAuthProvider` struct holding `HashMap<CloudProviderType, Arc<RwLock<Box<dyn CloudProvider>>>>` with methods: `get_provider`, `set_provider`, `remove_provider`, `is_authenticated`
- [x] 1.5 Implement app startup token loading: in `lib.rs` setup hook, read tokens from `AuthStore` for each provider type, construct authenticated providers, populate `CloudAuthProvider`
- [x] 1.6 Register `CloudAuthProvider` as Tauri managed state in `lib.rs`
- [x] 1.7 Update `oauth_callback` in `commands/cloud/oauth.rs` to store tokens via `AuthStore` and add provider to `CloudAuthProvider` state after successful exchange
- [x] 1.8 Update `oauth_get_account` to retrieve provider from `State<CloudAuthProvider>` and call `get_account_info`
- [x] 1.9 Update `oauth_is_authenticated` to check `CloudAuthProvider` for the given provider type
- [x] 1.10 Update `oauth_disconnect` to remove tokens from `AuthStore` and provider from `CloudAuthProvider`
- [ ] 1.11 Implement auto token refresh: in the `CloudProvider` implementations, detect 401/expired token, call `refresh_token`, update `AuthStore`, and retry

## 2. Backup Core Operations

- [x] 2.1 Implement `copy_documents` in `backup/manager.rs`: query all documents from the database, copy each file to `documents/{doc_id}/{filename}`, write `metadata.json` alongside
- [x] 2.2 Implement `restore_database` in `backup/manager.rs`: use SQLite online backup API (`Backup::new`) to copy backup DB into live DB
- [x] 2.3 Implement `export_settings` in `backup/manager.rs`: accept settings JSON from the frontend (passed via `BackupOptions` or a new field), write to `settings.json`
- [x] 2.4 Implement settings restore: read `settings.json` from backup, return contents to frontend for merging into Zustand store
- [x] 2.5 Wire `backup_list` command: accept `State<Repository>` and `State<CloudAuthProvider>`, get authenticated provider, create `BackupManager`, call `list_backups`
- [x] 2.6 Update all backup/restore commands (`backup_create`, `backup_restore`, `backup_delete`) to retrieve provider from `State<CloudAuthProvider>` instead of creating fresh instances
- [x] 2.7 Wire `cloud_list_files` and `cloud_import_files` in `commands/cloud/sync.rs` to use `State<CloudAuthProvider>`
- [x] 2.8 Wire `scheduler_trigger_backup` in `commands/scheduler.rs` to use `State<CloudAuthProvider>`

## 3. Backup Encryption

- [x] 3.1 Add encryption fields to `BackupOptions` (or a new `EncryptionOptions`): `password: Option<String>` passed from frontend
- [x] 3.2 Implement `encrypt_backup` method in `backup/manager.rs`: derive key via PBKDF2-HMAC-SHA256 (100k iterations, random 16-byte salt), encrypt with AES-256-GCM (random 12-byte nonce)
- [x] 3.3 Implement `decrypt_backup` method in `backup/manager.rs`: read salt and nonce from manifest, derive key, decrypt
- [x] 3.4 Integrate encryption into `create_backup`: if `encrypt: true` and password provided, encrypt the zip archive after compression
- [x] 3.5 Integrate decryption into `restore_backup`: if manifest indicates encryption, prompt for password, decrypt before extraction
- [x] 3.6 Update `BackupManifest` to include `encryption.salt` and `encryption.nonce` fields
- [x] 3.7 Zero derived key from memory after encryption/decryption operations

## 4. Backup Compression (Rust Native)

- [x] 4.1 Replace `compress_backup` in `backup/manager.rs`: use `zip::ZipWriter` with `FileOptions` to recursively add all backup directory files to a ZIP archive
- [x] 4.2 Replace `extract_backup` in `backup/manager.rs`: use `zip::ZipArchive::new(File)` to read and extract all entries to destination directory
- [x] 4.3 Update `list_backups` to read `manifest.json` from inside ZIP archives using `ZipArchive` without full extraction
- [x] 4.4 Remove `zip`/`unzip` system command dependencies from documentation/code

## 5. Frontend Cleanup

- [x] 5.1 Update `SyncSettings.provider` type in `settingsStore.ts` to `"onedrive" | "google-drive" | "dropbox"` (remove `icloud` and `webdav`)
- [x] 5.2 Update `types/cloud.ts` provider types if they reference `icloud` or `webdav` — already correct, no change needed
- [x] 5.3 Update `CloudStorageSettings.tsx` to remove iCloud and WebDAV options from the provider selector — already correct, no change needed
- [x] 5.4 Update `BackupRestorePanel.tsx` to pass encryption password to `backup_create` command when encryption is enabled

## 6. Dead Code Cleanup

- [ ] 6.1 Delete `src-tauri/src/sync.rs` — BLOCKED: sync.rs exports server-based sync commands (`sync_now`, `get_sync_status`, `resolve_sync_conflict`, `get_sync_log`) actively used by frontend (`src/api/sync.ts`, `SyncSettings.tsx`). This is a separate system from cloud_sync.
- [ ] 6.2 Remove `mod sync` declaration — BLOCKED: same reason as 6.1
- [ ] 6.3 Verify the project compiles successfully with `cargo build`

## 7. Validation

- [x] 7.1 Run `cargo build` to verify no compilation errors
- [x] 7.2 Run `cargo test` to verify existing tests still pass — 217 pass, 8 pre-existing SM20/SuperMemo failures unchanged
- [x] 7.3 Run `npm run build` to verify frontend compiles
