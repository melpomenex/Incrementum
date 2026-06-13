//! Secure storage Tauri commands.
//!
//! Backs the web/PWA-vs-Tauri split in `src/lib/sync/secureStorage.ts`. On
//! Tauri we route through the OS keychain via the `keyring` crate — the same
//! crate used by `ai_key_store.rs` and `cloud::auth_store::AuthStore`, so no
//! new dependency is required. The crate selects the right native backend per
//! platform: macOS Keychain, Windows Credential Manager, Linux Secret Service,
//! Android Keystore, iOS Keychain.
//!
//! Values are passed as base64 strings from the frontend (binary in Tauri IPC
//! has to round-trip through arrays; base64 keeps the commands trivial and
//! auditable). A missing entry returns `Ok(None)` so the TS layer can model
//! "no cached key" cleanly.

use crate::error::IncrementumError;
use crate::error::Result;

/// Store `value` (base64) under `(service, account)` in the OS keychain.
#[tauri::command]
pub async fn secure_storage_set(service: String, account: String, value: String) -> Result<()> {
    let entry = keyring::Entry::new(&service, &account)
        .map_err(|e| keyring_err("secure_storage_set", e))?;
    entry
        .set_password(&value)
        .map_err(|e| keyring_err("secure_storage_set", e))
}

/// Read the base64 value for `(service, account)` from the OS keychain.
/// Returns `Ok(None)` when no credential exists.
#[tauri::command]
pub async fn secure_storage_get(service: String, account: String) -> Result<Option<String>> {
    let entry = keyring::Entry::new(&service, &account)
        .map_err(|e| keyring_err("secure_storage_get", e))?;
    match entry.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(keyring_err("secure_storage_get", e)),
    }
}

/// Remove the `(service, account)` credential. Missing entries are not an error.
#[tauri::command]
pub async fn secure_storage_clear(service: String, account: String) -> Result<()> {
    let entry = keyring::Entry::new(&service, &account)
        .map_err(|e| keyring_err("secure_storage_clear", e))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(keyring_err("secure_storage_clear", e)),
    }
}

fn keyring_err(ctx: &str, e: keyring::Error) -> IncrementumError {
    IncrementumError::Internal(format!("{ctx}: keyring error: {e}"))
}
