//! Cloud storage provider implementations
//!
//! This module provides support for various cloud storage providers
//! including OneDrive, Google Drive, and Dropbox.

pub mod provider;
pub mod onedrive;
pub mod googledrive;
pub mod dropbox;
pub mod auth_store;

// Re-export commonly used types
pub use provider::{
    AccountInfo,
    AuthToken,
    AuthResult,
    BackupIncludes,
    BackupInfo,
    BackupOptions,
    CloudProvider,
    CloudProviderType,
    ConflictResolution,
    FileInfo,
    RestoreConflict,
    RestoreResult,
    SyncConflict,
    SyncResult,
};

// Re-export auth store types
pub use auth_store::{AuthStore, CloudAuthProvider};

// Re-export provider configurations and implementations
pub use onedrive::{OneDriveConfig, OneDriveProvider};
pub use googledrive::{GoogleDriveConfig, GoogleDriveProvider};
pub use dropbox::{DropboxConfig, DropboxProvider};
