//! Backup Scheduler
//!
//! Handles automatic scheduled backups to cloud storage

use chrono::{DateTime, Datelike, Utc, Timelike, Weekday};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{Mutex, RwLock};
use tokio::time::interval;

use crate::backup::BackupManager;
use crate::cloud::{BackupOptions, CloudProvider, CloudProviderType};
use crate::database::Database;
use crate::error::AppError;

/// Backup scheduler configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchedulerConfig {
    pub enabled: bool,
    pub schedule: BackupSchedule,
    pub backup_options: BackupOptions,
    pub max_backups: usize,
    pub retry_on_failure: bool,
    pub max_retries: usize,
    /// Which cloud provider to back up to. When None, the scheduler ticks but
    /// performs no backup (mirrors the old behavior without the dangling TODO).
    pub provider_type: Option<CloudProviderType>,
}

impl Default for SchedulerConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            schedule: BackupSchedule::Daily { hour: 2, minute: 0 },
            backup_options: BackupOptions::default(),
            max_backups: 10,
            retry_on_failure: true,
            max_retries: 3,
            provider_type: None,
        }
    }
}

/// Backup schedule
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum BackupSchedule {
    Daily { hour: u32, minute: u32 },
    Weekly { weekday: u32, hour: u32, minute: u32 },
    Monthly { day: u32, hour: u32, minute: u32 },
    Interval { minutes: u64 },
}

impl BackupSchedule {
    /// Calculate the duration until the next scheduled backup
    pub fn next_duration(&self) -> Duration {
        let now = Utc::now();

        match self {
            BackupSchedule::Daily { hour, minute } => {
                let scheduled = now
                    .with_hour(*hour)
                    .and_then(|t| t.with_minute(*minute))
                    .and_then(|t| t.with_second(0))
                    .expect("valid daily schedule time");

                let scheduled = if scheduled > now {
                    scheduled
                } else {
                    scheduled + chrono::Duration::days(1)
                };

                (scheduled - now).to_std().unwrap_or(Duration::ZERO)
            }
            BackupSchedule::Weekly { weekday, hour, minute } => {
                let target_weekday = match *weekday {
                    0 => Weekday::Sun,
                    1 => Weekday::Mon,
                    2 => Weekday::Tue,
                    3 => Weekday::Wed,
                    4 => Weekday::Thu,
                    5 => Weekday::Fri,
                    6 => Weekday::Sat,
                    _ => Weekday::Mon,
                };

                let scheduled = now
                    .with_hour(*hour)
                    .and_then(|t| t.with_minute(*minute))
                    .and_then(|t| t.with_second(0))
                    .expect("valid weekly schedule time");

                let days_until = (target_weekday.number_from_monday() as i32 -
                    now.weekday().number_from_monday() as i32 + 7) % 7;

                let scheduled = if days_until == 0 && scheduled > now {
                    scheduled
                } else {
                    scheduled + chrono::Duration::days(days_until as i64)
                };

                (scheduled - now).to_std().unwrap_or(Duration::ZERO)
            }
            BackupSchedule::Monthly { day, hour, minute } => {
                let scheduled = now
                    .with_day(*day)
                    .and_then(|t| t.with_hour(*hour))
                    .and_then(|t| t.with_minute(*minute))
                    .and_then(|t| t.with_second(0))
                    .expect("valid monthly schedule time");

                let scheduled = if scheduled > now {
                    scheduled
                } else {
                    // Add a month (approximately)
                    scheduled + chrono::Duration::days(30)
                };

                (scheduled - now).to_std().unwrap_or(Duration::ZERO)
            }
            BackupSchedule::Interval { minutes } => {
                Duration::from_secs(*minutes * 60)
            }
        }
    }

    /// Get a human-readable description of the schedule
    pub fn description(&self) -> String {
        match self {
            BackupSchedule::Daily { hour, minute } => {
                format!("Daily at {:02}:{:02}", hour, minute)
            }
            BackupSchedule::Weekly { weekday, hour, minute } => {
                let days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                format!("{}s at {:02}:{:02}", days[*weekday as usize % 7], hour, minute)
            }
            BackupSchedule::Monthly { day, hour, minute } => {
                format!("Monthly on day {} at {:02}:{:02}", day, hour, minute)
            }
            BackupSchedule::Interval { minutes } => {
                format!("Every {} minutes", minutes)
            }
        }
    }
}

/// Backup scheduler result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchedulerResult {
    pub success: bool,
    pub backup_id: Option<String>,
    pub error: Option<String>,
    pub scheduled_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

/// Backup scheduler
pub struct BackupScheduler {
    db: Database,
    db_path: PathBuf,
    config: SchedulerConfig,
    running: Arc<Mutex<bool>>,
    next_scheduled: Arc<Mutex<Option<DateTime<Utc>>>>,
    /// Resolved cloud provider used by the scheduler tick. Populated from the
    /// auth store at init time so the detached tick task can run backups.
    provider: Arc<Mutex<Option<Arc<RwLock<Box<dyn CloudProvider>>>>>>,
}

impl BackupScheduler {
    /// Create a new backup scheduler
    pub fn new(db: Database, db_path: PathBuf, config: SchedulerConfig) -> Self {
        Self {
            db,
            db_path,
            config,
            running: Arc::new(Mutex::new(false)),
            next_scheduled: Arc::new(Mutex::new(None)),
            provider: Arc::new(Mutex::new(None)),
        }
    }

    /// Attach a resolved cloud provider (cloned from the auth store) so the
    /// scheduler tick can actually perform backups instead of just logging.
    pub async fn set_provider(
        &self,
        provider: Option<Arc<RwLock<Box<dyn CloudProvider>>>>,
    ) {
        *self.provider.lock().await = provider;
    }

    /// Update the scheduler configuration
    pub async fn update_config(&mut self, config: SchedulerConfig) {
        // Clone the values we need before moving config
        let enabled = config.enabled;
        let duration = config.schedule.next_duration();

        self.config = config;

        if enabled {
            let next = Utc::now() + chrono::Duration::seconds(
                duration.as_secs() as i64
            );
            *self.next_scheduled.lock().await = Some(next);
        } else {
            *self.next_scheduled.lock().await = None;
        }
    }

    /// Start the scheduler
    pub async fn start(&self) -> Result<(), AppError> {
        let mut running = self.running.lock().await;
        if *running {
            return Err(AppError::Internal("Scheduler already running".to_string()));
        }
        *running = true;
        drop(running);

        let db = self.db.clone();
        let db_path = self.db_path.clone();
        let config = self.config.clone();
        let running_flag = self.running.clone();
        let next_scheduled = self.next_scheduled.clone();
        let provider_holder = self.provider.clone();

        tokio::spawn(async move {
            let mut interval = interval(config.schedule.next_duration());

            // Set initial next scheduled time
            let next = Utc::now() + chrono::Duration::seconds(
                config.schedule.next_duration().as_secs() as i64
            );
            *next_scheduled.lock().await = Some(next);

            loop {
                interval.tick().await;

                {
                    let running = running_flag.lock().await;
                    if !*running {
                        break;
                    }
                }

                if config.enabled {
                    let manager = BackupManager::new(db.clone(), db_path.clone());
                    if let Ok(manager) = manager {
                        let provider_opt = provider_holder.lock().await.clone();
                        match provider_opt {
                            Some(provider) => {
                                let guard = provider.read().await;
                                match manager.create_backup(guard.as_ref(), config.backup_options.clone()).await {
                                    Ok(info) => tracing::info!("Scheduled backup completed: {}", info.id),
                                    Err(e) => tracing::warn!("Scheduled backup failed: {}", e),
                                }
                            }
                            None => {
                                tracing::info!("Scheduled backup skipped — no cloud provider attached");
                            }
                        }

                        let next = Utc::now() + chrono::Duration::seconds(
                            config.schedule.next_duration().as_secs() as i64
                        );
                        *next_scheduled.lock().await = Some(next);
                    }
                }
            }
        });

        Ok(())
    }

    /// Stop the scheduler
    pub async fn stop(&self) -> Result<(), AppError> {
        let mut running = self.running.lock().await;
        *running = false;
        *self.next_scheduled.lock().await = None;
        Ok(())
    }

    /// Get the next scheduled backup time
    pub async fn next_scheduled_time(&self) -> Option<DateTime<Utc>> {
        *self.next_scheduled.lock().await
    }

    /// Check if the scheduler is running
    pub async fn is_running(&self) -> bool {
        *self.running.lock().await
    }

    /// Trigger a manual backup (doesn't affect the schedule)
    pub async fn trigger_backup_now(
        &self,
        provider: &dyn CloudProvider,
    ) -> Result<SchedulerResult, AppError> {
        let scheduled_at = Utc::now();

        let manager = BackupManager::new(self.db.clone(), self.db_path.clone())?;

        let backup_info = manager
            .create_backup(provider, self.config.backup_options.clone())
            .await?;

        Ok(SchedulerResult {
            success: true,
            backup_id: Some(backup_info.id),
            error: None,
            scheduled_at,
            completed_at: Some(Utc::now()),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_schedule_description() {
        let schedule = BackupSchedule::Daily { hour: 2, minute: 30 };
        assert_eq!(schedule.description(), "Daily at 02:30");

        let schedule = BackupSchedule::Weekly { weekday: 1, hour: 9, minute: 0 };
        assert_eq!(schedule.description(), "Mondays at 09:00");
    }

    #[test]
    fn test_next_duration() {
        let schedule = BackupSchedule::Interval { minutes: 5 };
        let duration = schedule.next_duration();
        assert!(duration.as_secs() <= 300); // Should be <= 5 minutes
    }
}
