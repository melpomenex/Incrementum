## ADDED Requirements

### Requirement: Tokens persisted after OAuth callback
After a successful OAuth callback (`oauth_callback` command), the system SHALL store the `access_token`, `refresh_token`, `expires_at`, and `token_type` in the OS keychain using the `keyring` crate with service name `com.incrementum.app` and username equal to the provider type (e.g., `onedrive`, `google-drive`, `dropbox`).

#### Scenario: Successful OAuth callback persists tokens
- **WHEN** `oauth_callback` is called with a valid authorization code
- **THEN** the exchanged tokens are stored in the OS keychain
- **AND** the returned `AuthResult` contains `success: true` with account info

#### Scenario: Failed OAuth callback does not persist
- **WHEN** `oauth_callback` fails (invalid code, network error)
- **THEN** no tokens are stored in the keychain
- **AND** the returned `AuthResult` contains `success: false` with an error message

### Requirement: Tokens loaded on app startup
On app startup, the system SHALL read stored tokens from the OS keychain for each provider type and construct authenticated `CloudProvider` instances. These SHALL be available via Tauri `State<CloudAuthProvider>`.

#### Scenario: Provider has stored tokens
- **WHEN** the app starts and tokens exist in the keychain for a provider
- **THEN** an authenticated `CloudProvider` instance is created and available in state
- **AND** `oauth_is_authenticated` returns `true` for that provider

#### Scenario: Provider has no stored tokens
- **WHEN** the app starts and no tokens exist for a provider
- **THEN** no provider instance is created for that type
- **AND** `oauth_is_authenticated` returns `false`

### Requirement: Token refresh on expiry
When a cloud operation encounters an expired access token, the system SHALL automatically refresh the token using the stored refresh token, update the keychain entry, and retry the operation.

#### Scenario: Expired token auto-refreshed
- **WHEN** a cloud operation fails with an authentication error
- **AND** a refresh token is available in the keychain
- **THEN** the system refreshes the access token
- **AND** updates the keychain with the new tokens
- **AND** retries the original operation

#### Scenario: Refresh token also expired
- **WHEN** a token refresh fails (refresh token revoked)
- **THEN** the stored tokens are cleared from the keychain
- **AND** the provider is removed from the auth provider state
- **AND** an error is returned indicating re-authentication is required

### Requirement: Token storage uses encrypted fallback on Linux
If the OS keychain is unavailable (e.g., no Secret Service D-Bus), the system SHALL fall back to storing an AES-256-GCM encrypted token file in the app data directory, using a machine-specific key derived from hostname and user ID.

#### Scenario: Keychain unavailable on Linux
- **WHEN** the `keyring` crate fails to access the OS keychain
- **THEN** tokens are stored in `{app_data_dir}/tokens/{provider_type}.enc`
- **AND** a warning is logged about the fallback

### Requirement: Disconnect clears persisted tokens
When `oauth_disconnect` is called, the system SHALL remove all stored tokens for that provider from the keychain and drop the provider instance from state.

#### Scenario: User disconnects provider
- **WHEN** `oauth_disconnect` is called for `google-drive`
- **THEN** the keyring entry for `com.incrementum.app` / `google-drive` is deleted
- **AND** the Google Drive provider instance is removed from `CloudAuthProvider`
- **AND** `oauth_is_authenticated` returns `false` for `google-drive`

### Requirement: Frontend provider list matches backend
The `SyncSettings.provider` type in `settingsStore.ts` SHALL only include `"onedrive" | "google-drive" | "dropbox"`. The `icloud` and `webdav` options SHALL be removed.

#### Scenario: Provider list in settings
- **WHEN** the cloud storage settings UI renders
- **THEN** only OneDrive, Google Drive, and Dropbox are shown as options
