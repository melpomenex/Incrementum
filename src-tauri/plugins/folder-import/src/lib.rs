//! Tauri plugin for importing documents from a folder recursively.
//!
//! On desktop this opens a native folder picker and walks the tree with
//! `walkdir`, returning each supported file's real filesystem path. The caller
//! (the existing `importDocument` path-based pipeline) then reads those files.
//!
//! On Android/iOS the WebViews do not support directory file-choosers, and
//! Tauri's native folder picker is not yet available on Android
//! (tauri-apps/tauri#14587). So on mobile the work is delegated to native
//! code (`android/` Kotlin + `ios/` Swift) via Tauri's mobile plugin IPC:
//!   1. the native side shows the system folder picker
//!      (Android `ACTION_OPEN_DOCUMENT_TREE`, iOS `UIDocumentPickerViewController`
//!      in folder mode),
//!   2. recursively lists supported files,
//!   3. copies each into the app's private storage under
//!      `<app_data>/imports/<relative-subpath>`,
//!   4. returns the staged filesystem paths back here.
//!
//! Because the staged files live in app-private storage, the Rust
//! `std::fs::canonicalize` in `import_document` can read them, so the mobile
//! folder import lands in the same SQLite store as every other import.
//!
//! The plugin targets the concrete `tauri::Wry` runtime (the only runtime the
//! Incrementum app uses), which keeps `generate_handler!` monomorphization
//! simple and avoids thread-safety bounds issues with a generic `R` (the
//! `Runtime` trait is not `Send + Sync` as a supertrait, so a generic `R` +
//! `PhantomData<R>` state type fails to satisfy `State`/`manage` bounds).

use serde::{de::DeserializeOwned, Deserialize, Serialize};
#[cfg(any(target_os = "android", target_os = "ios"))]
use tauri::plugin::PluginHandle;
use tauri::{
    plugin::{PluginApi, TauriPlugin},
    AppHandle, Manager, State, Wry,
};
use thiserror::Error;

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "com.incrementum.folderimport";

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_incrementum_folder_import);

/// Errors surfaced to the frontend over IPC.
#[derive(Debug, Error)]
pub enum Error {
    #[error("{0}")]
    Message(String),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
}

impl From<Error> for String {
    fn from(e: Error) -> Self {
        e.to_string()
    }
}

impl serde::Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

/// One staged file produced by the folder picker, ready to feed into the
/// path-based import pipeline.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StagedFile {
    /// Absolute filesystem path to a readable copy of the file (real path on
    /// desktop; staged copy under app-private storage on mobile).
    pub path: String,
    /// Path relative to the picked folder root (e.g. `Sci-Fi/Dune.epub`).
    pub relative_path: String,
    /// Bare file name (e.g. `Dune.epub`).
    pub file_name: String,
}

/// Managed plugin state.
///
/// On mobile this holds the native plugin handle used to invoke the SAF /
/// document-picker. On desktop there is no mobile handle, so the struct is a
/// zero-sized placeholder — the desktop folder pick happens entirely in-process
/// via `pick_desktop_app`.
///
/// Concrete over `Wry` (see the module docs): `PluginHandle<Wry>` is
/// `Send + Sync`, so this type satisfies the `State`/`manage` bounds.
#[allow(dead_code)]
#[derive(Clone)]
pub struct FolderImport {
    #[cfg(any(target_os = "android", target_os = "ios"))]
    handle: PluginHandle<Wry>,
}

// ──────────────────────────────────────────────────────────────────────────
// Mobile registration
// ──────────────────────────────────────────────────────────────────────────

#[allow(unused_variables)]
fn init_mobile<C: DeserializeOwned>(
    app: &AppHandle<Wry>,
    api: PluginApi<Wry, C>,
) -> Result<FolderImport, Error> {
    #[cfg(target_os = "android")]
    {
        let _ = app;
        let handle = api
            .register_android_plugin(PLUGIN_IDENTIFIER, "FolderImportPlugin")
            .map_err(|e| Error::Message(e.to_string()))?;
        return Ok(FolderImport { handle });
    }
    #[cfg(target_os = "ios")]
    {
        let _ = app;
        let handle = api
            .register_ios_plugin(init_plugin_incrementum_folder_import)
            .map_err(|e| Error::Message(e.to_string()))?;
        return Ok(FolderImport { handle });
    }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        let _ = (app, api);
        Ok(FolderImport {})
    }
}

// ──────────────────────────────────────────────────────────────────────────
// IPC command (in its own module so generate_handler! can reference it via a
// qualified path — mirroring how tauri-plugin-dialog registers its commands).
// ──────────────────────────────────────────────────────────────────────────

mod commands {
    use super::*;

    /// Pick a folder and return all supported files inside it (recursively).
    ///
    /// Returns an empty Vec if the user cancels.
    #[tauri::command]
    pub async fn pick_folder_documents(
        app: AppHandle<Wry>,
        state: State<'_, FolderImport>,
        extensions: Option<Vec<String>>,
    ) -> Result<Vec<StagedFile>, Error> {
        let ext_set = normalize_extension_set(extensions);

        // Mobile: ask the native plugin to do the SAF/document-picker work.
        #[cfg(any(target_os = "android", target_os = "ios"))]
        {
            let _ = app;
            // Clone the state out so the 'static spawn_blocking closure owns it.
            let import_state = state.inner().clone();
            let result = tauri::async_runtime::spawn_blocking(move || {
                let exts: Vec<String> = ext_set.into_iter().collect();
                pick_mobile(&import_state, exts)
            })
            .await
            .map_err(|e| Error::Message(format!("folder pick join error: {e}")))??;
            return Ok(result);
        }

        // Desktop: native folder dialog + walkdir.
        #[cfg(not(any(target_os = "android", target_os = "ios")))]
        {
            let _ = &state; // no mobile handle needed on desktop
            let result = tauri::async_runtime::spawn_blocking(move || {
                pick_desktop_app(&app, ext_set)
            })
            .await
            .map_err(|e| Error::Message(format!("folder pick join error: {e}")))??;
            Ok(result)
        }
    }

    /// Pick one or more FILES (not a folder) and return them staged into app-
    /// private storage with readable filesystem paths. On mobile this delegates
    /// to the native SAF picker (ACTION_OPEN_DOCUMENT) which copies each file
    /// natively — no bytes cross the JSON IPC (the fast path, like native apps).
    /// On desktop it falls back to the Tauri dialog plugin's file open.
    ///
    /// Returns an empty Vec if the user cancels.
    #[tauri::command]
    pub async fn pick_files(
        state: State<'_, FolderImport>,
        extensions: Option<Vec<String>>,
        multiple: Option<bool>,
    ) -> Result<Vec<StagedFile>, Error> {
        let ext_set = normalize_extension_set(extensions);

        // Mobile: native SAF file picker + native copy.
        #[cfg(any(target_os = "android", target_os = "ios"))]
        {
            let import_state = state.inner().clone();
            let mult = multiple.unwrap_or(false);
            let result = tauri::async_runtime::spawn_blocking(move || {
                let exts: Vec<String> = ext_set.into_iter().collect();
                pick_files_mobile(&import_state, exts, mult)
            })
            .await
            .map_err(|e| Error::Message(format!("file pick join error: {e}")))??;
            return Ok(result);
        }

        // Desktop: no native handle available here; callers use openFilePicker.
        #[cfg(not(any(target_os = "android", target_os = "ios")))]
        {
            let _ = (state, ext_set, multiple);
            Err(Error::Message(
                "pick_files is only supported on mobile; use the dialog plugin on desktop".to_string(),
            ))
        }
    }

    #[tauri::command]
    pub async fn install_apk(
        state: State<'_, FolderImport>,
        file_path: String,
    ) -> Result<(), Error> {
        #[cfg(target_os = "android")]
        {
            let payload = serde_json::json!({ "filePath": file_path });
            state
                .handle
                .run_mobile_plugin::<()>("installApk", payload)
                .map_err(|e| Error::Message(e.to_string()))?;
            Ok(())
        }
        #[cfg(not(target_os = "android"))]
        {
            let _ = (state, file_path);
            Err(Error::Message("install_apk is only supported on Android".to_string()))
        }
    }

    #[tauri::command]
    pub async fn backup_db_to_downloads(
        state: State<'_, FolderImport>,
    ) -> Result<String, Error> {
        #[cfg(target_os = "android")]
        {
            let res: serde_json::Value = state
                .handle
                .run_mobile_plugin("backupDbToDownloads", serde_json::json!({}))
                .map_err(|e| Error::Message(e.to_string()))?;
            let path = res.get("path")
                .and_then(|v| v.as_str())
                .unwrap_or("/sdcard/Download/Incrementum/Incrementum_Backup_Auto.db")
                .to_string();
            Ok(path)
        }
        #[cfg(not(target_os = "android"))]
        {
            let _ = state;
            Err(Error::Message("backup_db_to_downloads is only supported on Android".to_string()))
        }
    }

    #[allow(dead_code)]
    #[derive(Debug, Deserialize)]
    struct ShareListenerResponse {
        url: Option<String>,
    }

    #[tauri::command]
    pub async fn register_share_listener(
        state: State<'_, FolderImport>,
    ) -> Result<Option<String>, Error> {
        #[cfg(target_os = "android")]
        {
            let res: ShareListenerResponse = state
                .handle
                .run_mobile_plugin("registerShareListener", serde_json::json!({}))
                .map_err(|e| Error::Message(e.to_string()))?;
            Ok(res.url)
        }
        #[cfg(not(target_os = "android"))]
        {
            let _ = state;
            Ok(None)
        }
    }
}


// ──────────────────────────────────────────────────────────────────────────
// Default supported extensions. Mirrors the document/media types the rest of
// the app accepts (see src/api/documents.ts openFilePicker default filters).
// ──────────────────────────────────────────────────────────────────────────

pub const DEFAULT_EXTENSIONS: &[&str] = &[
    // documents
    "pdf", "epub", "md", "markdown", "txt", "html", "htm", "json",
    // audio
    "mp3", "wav", "m4a", "m4b", "aac", "ogg", "flac", "opus", "wma",
    // video
    "mp4", "webm", "mov", "mkv", "avi", "m4v",
];

fn normalize_extension_set(extensions: Option<Vec<String>>) -> std::collections::HashSet<String> {
    let mut set = std::collections::HashSet::new();
    if let Some(list) = extensions {
        for e in list {
            let cleaned = e.trim_start_matches('.').to_lowercase();
            if !cleaned.is_empty() {
                set.insert(cleaned);
            }
        }
    }
    if set.is_empty() {
        set.extend(DEFAULT_EXTENSIONS.iter().map(|s| s.to_string()));
    }
    set
}

// ──────────────────────────────────────────────────────────────────────────
// Desktop implementation: native folder dialog + walkdir
// ──────────────────────────────────────────────────────────────────────────

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn pick_desktop_app(
    app: &AppHandle<Wry>,
    extensions: std::collections::HashSet<String>,
) -> Result<Vec<StagedFile>, Error> {
    use std::path::Path;
    use tauri_plugin_dialog::DialogExt;

    // `blocking_pick_folder` must run off the main thread (it panics on the
    // main thread). We're already on a blocking worker (see the command body),
    // so spawn a plain OS thread to be safe.
    let handle = app.clone();
    let folder = std::thread::scope(|s| {
        s.spawn(move || {
            handle
                .dialog()
                .file()
                .set_title("Select Folder to Import")
                .blocking_pick_folder()
        })
        .join()
        .unwrap_or(None)
    });

    let Some(folder_path) = folder else {
        // User cancelled.
        return Ok(Vec::new());
    };

    let folder_path = match folder_path {
        tauri_plugin_fs::FilePath::Path(p) => p,
        tauri_plugin_fs::FilePath::Url(u) => {
            // file:// URL → local path. `u` is already a `tauri::Url`; parse
            // its string form so `to_file_path()` resolves the host.
            let s = u.to_string();
            tauri::Url::parse(&s)
                .ok()
                .and_then(|parsed| parsed.to_file_path().ok())
                .unwrap_or_else(|| Path::new(&s).to_path_buf())
        }
    };

    let root = folder_path.canonicalize().unwrap_or(folder_path.clone());
    scan_directory(&root, &extensions)
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn scan_directory(
    root: &std::path::Path,
    extensions: &std::collections::HashSet<String>,
) -> Result<Vec<StagedFile>, Error> {
    let mut files = Vec::new();
    for entry in walkdir::WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|s| s.to_lowercase());
        let Some(ext) = ext else { continue };
        if !extensions.contains(&ext) {
            continue;
        }
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default()
            .to_string();
        let relative_path = path
            .strip_prefix(root)
            .ok()
            .and_then(|p| p.to_str())
            .map(|s| s.replace('\\', "/"))
            .unwrap_or_else(|| file_name.clone());
        files.push(StagedFile {
            path: path.to_string_lossy().to_string(),
            relative_path,
            file_name,
        });
    }
    // Stable order regardless of OS directory traversal order.
    files.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    Ok(files)
}

// ──────────────────────────────────────────────────────────────────────────
// Mobile implementation: delegate to the native plugin
// ──────────────────────────────────────────────────────────────────────────

#[cfg(any(target_os = "android", target_os = "ios"))]
fn pick_mobile(
    state: &FolderImport,
    extensions: Vec<String>,
) -> Result<Vec<StagedFile>, Error> {
    // run_mobile_plugin blocks until the native side resolves the Invoke; it
    // must be called off the main thread (the command body runs on a worker).
    let payload = serde_json::json!({ "extensions": extensions });
    let response = state
        .handle
        .run_mobile_plugin::<MobilePickResponse>("pickFolderDocuments", payload)
        .map_err(|e| Error::Message(e.to_string()))?;
    Ok(response.files)
}

#[cfg(any(target_os = "android", target_os = "ios"))]
fn pick_files_mobile(
    state: &FolderImport,
    extensions: Vec<String>,
    multiple: bool,
) -> Result<Vec<StagedFile>, Error> {
    let payload = serde_json::json!({ "extensions": extensions, "multiple": multiple });
    let response = state
        .handle
        .run_mobile_plugin::<MobilePickResponse>("pickFiles", payload)
        .map_err(|e| Error::Message(e.to_string()))?;
    Ok(response.files)
}

#[cfg(any(target_os = "android", target_os = "ios"))]
#[derive(Debug, Deserialize)]
struct MobilePickResponse {
    files: Vec<StagedFile>,
}

// ──────────────────────────────────────────────────────────────────────────
// IPC command
// ──────────────────────────────────────────────────────────────────────────

/// Pick a folder and return all supported files inside it (recursively).
/// See `commands::pick_folder_documents` for the implementation.
pub use commands::pick_folder_documents;
/// Pick one or more files and return them staged into app-private storage.
/// See `commands::pick_files` for the implementation.
pub use commands::pick_files;
pub use commands::install_apk;
pub use commands::backup_db_to_downloads;
pub use commands::register_share_listener;

/// Initializes the plugin.
pub fn init() -> TauriPlugin<Wry> {
    // NOTE: the builder name MUST match the crate name (`incrementum-folder-import`),
    // because tauri-plugin's ACL manifest codegen keys the plugin's permissions
    // under the crate name. The runtime ACL lookup on `plugin:<name>|<cmd>` uses
    // this builder name, so a mismatch (e.g. "folder-import") makes every
    // command fail with "not allowed by ACL" even when the capability grants it.
    tauri::plugin::Builder::<Wry>::new("incrementum-folder-import")
        .invoke_handler(tauri::generate_handler![
            commands::pick_folder_documents,
            commands::pick_files,
            commands::install_apk,
            commands::backup_db_to_downloads,
            commands::register_share_listener
        ])
        .setup(|app, api| {
            let folder_import = init_mobile(app.app_handle(), api)?;
            app.manage(folder_import);
            Ok(())
        })
        .build()
}
