//! Database connection management

use sqlx::{Sqlite, SqlitePool, sqlite::SqliteConnectOptions, pool::PoolOptions};
use std::path::PathBuf;
use std::str::FromStr;
use std::time::Duration;

use crate::error::{IncrementumError, Result};

#[derive(Clone)]
pub struct Database {
    pool: SqlitePool,
}

impl Database {
    /// Create a new database connection pool
    pub async fn new(path: PathBuf) -> Result<Self> {
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        // Create connection options with proper concurrency settings
        let options = SqliteConnectOptions::from_str(&format!("sqlite:{}", path.display()))
            .map_err(|e| IncrementumError::Internal(format!("Invalid database path: {}", e)))?
            .create_if_missing(true)
            // Set busy timeout to wait for locks instead of failing immediately
            .busy_timeout(Duration::from_secs(30))
            // Enable foreign keys
            .pragma("foreign_keys", "ON")
            // WAL mode for better concurrency (set per-connection so every pool
            // connection inherits it, rather than a one-shot PRAGMA on the first)
            .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
            // NORMAL synchronous with WAL gives good durability/performance trade-off
            .synchronous(sqlx::sqlite::SqliteSynchronous::Normal);

        // Create connection pool with increased limits for heavy workloads
        let pool = PoolOptions::<Sqlite>::new()
            .max_connections(20)
            .acquire_timeout(Duration::from_secs(30))
            .connect_with(options)
            .await?;

        // Run an integrity check on startup to detect corruption early
        let result: (String,) = sqlx::query_as("PRAGMA integrity_check")
            .fetch_one(&pool)
            .await
            .map_err(|e| IncrementumError::Internal(format!("Database integrity check failed: {}", e)))?;
        if result.0 != "ok" {
            tracing::error!("Database integrity check failed: {}", result.0);
            return Err(IncrementumError::Internal(format!(
                "Database integrity check failed: {}", result.0
            )));
        }

        Ok(Self { pool })
    }

    /// Get a reference to the connection pool
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    /// Create a Database wrapper from an existing pool
    pub fn from_pool(pool: SqlitePool) -> Self {
        Self { pool }
    }

    /// Run migrations on the database
    pub async fn migrate(&self) -> Result<()> {
        crate::database::migrations::run_migrations(self.pool()).await
    }

    /// Close the database connection
    pub async fn close(self) {
        self.pool.close().await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_database_creation() {
        let db = Database::new(PathBuf::from(":memory:")).await;
        assert!(db.is_ok());
    }

    #[tokio::test]
    async fn test_synchronous_mode_is_normal() {
        let db = Database::new(PathBuf::from(":memory:")).await.unwrap();

        let row: (String,) = sqlx::query_as("PRAGMA synchronous")
            .fetch_one(db.pool())
            .await
            .unwrap();

        // NORMAL is encoded as 1 by SQLite
        assert_eq!(row.0, "1", "PRAGMA synchronous should be NORMAL (1)");
    }

    #[tokio::test]
    async fn test_journal_mode_is_wal() {
        let db = Database::new(PathBuf::from(":memory:")).await.unwrap();

        let row: (String,) = sqlx::query_as("PRAGMA journal_mode")
            .fetch_one(db.pool())
            .await
            .unwrap();

        // WAL mode may not persist in :memory: databases; just verify the query works
        // and the journal_mode is set (could be "memory" or "wal" for in-memory DBs).
        // For file-backed databases this should be "wal".
        assert!(
            ["wal", "memory"].contains(&row.0.to_lowercase().as_str()),
            "PRAGMA journal_mode should be wal or memory, got: {}",
            row.0,
        );
    }
}
