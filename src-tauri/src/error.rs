//! Error types for Incrementum
use thiserror::Error;

#[derive(Error, Debug)]
pub enum IncrementumError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("FSRS error: {0}")]
    Fsrs(#[from] fsrs::FSRSError),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Integration error: {0}")]
    IntegrationError(String),

    #[error("Sync error: {0}")]
    SyncError(String),

    #[error("Shell error: {0}")]
    ShellError(String),
}

// Implement From<String> for IncrementumError
impl From<String> for IncrementumError {
    fn from(s: String) -> Self {
        IncrementumError::Internal(s)
    }
}

// Implement From<tauri_plugin_shell::Error> for IncrementumError
impl From<tauri_plugin_shell::Error> for IncrementumError {
    fn from(e: tauri_plugin_shell::Error) -> Self {
        IncrementumError::ShellError(e.to_string())
    }
}

// Implement From<anyhow::Error> for IncrementumError
impl From<anyhow::Error> for IncrementumError {
    fn from(e: anyhow::Error) -> Self {
        IncrementumError::Internal(e.to_string())
    }
}

impl serde::Serialize for IncrementumError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        use serde::ser::SerializeMap;

        let (type_name, message) = match self {
            Self::Database(e) => ("database", e.to_string()),
            Self::Io(e) => ("io", e.to_string()),
            Self::Serialization(e) => ("serialization", e.to_string()),
            Self::Fsrs(e) => ("fsrs", e.to_string()),
            Self::NotFound(msg) => ("not_found", msg.clone()),
            Self::InvalidInput(msg) => ("invalid_input", msg.clone()),
            Self::Validation(msg) => ("validation", msg.clone()),
            Self::Internal(msg) => ("internal", msg.clone()),
            Self::IntegrationError(msg) => ("integration_error", msg.clone()),
            Self::SyncError(msg) => ("sync_error", msg.clone()),
            Self::ShellError(msg) => ("shell_error", msg.clone()),
        };

        let mut map = serializer.serialize_map(Some(2))?;
        map.serialize_entry("type", type_name)?;
        map.serialize_entry("message", &message)?;
        map.end()
    }
}

pub type Result<T> = std::result::Result<T, IncrementumError>;

// Type alias for backwards compatibility
pub use IncrementumError as AppError;
