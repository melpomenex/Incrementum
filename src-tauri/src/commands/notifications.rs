//! Notification commands
//!
//! Tauri commands for desktop notification management
//! Uses tauri-plugin-notification for actual macOS/desktop notifications

use serde::Serialize;
use tauri::{AppHandle, State};
use tauri_plugin_notification::NotificationExt;
use crate::database::Repository;
use crate::error::Result;
use crate::notifications::{
    NotificationManager, Notification, NotificationPriority, NotificationType
};

/// Result of a permission check/request, returned to frontend as { granted: boolean }
#[derive(Serialize)]
pub struct PermissionResult {
    granted: bool,
}

/// Check notification permission status
#[tauri::command]
pub async fn check_notification_permission(app: AppHandle) -> Result<PermissionResult> {
    match app.notification().permission_state() {
        Ok(state) => Ok(PermissionResult {
            granted: matches!(state, tauri_plugin_notification::PermissionState::Granted),
        }),
        Err(_) => Ok(PermissionResult { granted: false }),
    }
}

/// Request notification permission
#[tauri::command]
pub async fn request_notification_permission(app: AppHandle) -> Result<PermissionResult> {
    match app.notification().request_permission() {
        Ok(state) => Ok(PermissionResult {
            granted: matches!(state, tauri_plugin_notification::PermissionState::Granted),
        }),
        Err(_) => Ok(PermissionResult { granted: false }),
    }
}

/// Helper: send a project Notification struct via the tauri-plugin-notification builder
async fn send_via_plugin(app: &AppHandle, notification: &Notification) -> Result<()> {
    let mut builder = app
        .notification()
        .builder()
        .title(&notification.title)
        .body(&notification.body);
    if let Some(icon) = &notification.icon {
        builder = builder.icon(icon);
    }
    builder.show()?;
    Ok(())
}

/// Send a notification
#[tauri::command]
pub async fn send_notification(app: AppHandle, notification: Notification) -> Result<()> {
    send_via_plugin(&app, &notification).await
}

/// Create and send a study reminder notification
#[tauri::command]
pub async fn send_study_reminder(app: AppHandle, due_count: usize, new_count: usize) -> Result<()> {
    let notification = NotificationManager::create_study_reminder(due_count, new_count);
    send_via_plugin(&app, &notification).await
}

/// Create and send a cards due notification
#[tauri::command]
pub async fn send_cards_due_notification(app: AppHandle, count: usize, overdue: usize) -> Result<()> {
    let notification = NotificationManager::create_cards_due(count, overdue);
    send_via_plugin(&app, &notification).await
}

/// Create and send a review completed notification
#[tauri::command]
pub async fn send_review_completed_notification(
    app: AppHandle,
    cards_reviewed: usize,
    time_spent: u32,
    retention: f64,
) -> Result<()> {
    let notification = NotificationManager::create_review_completed(cards_reviewed, time_spent, retention);
    send_via_plugin(&app, &notification).await
}

/// Create and send a document imported notification
#[tauri::command]
pub async fn send_document_imported_notification(
    app: AppHandle,
    title: String,
    extract_count: usize,
) -> Result<()> {
    let notification = NotificationManager::create_document_imported(title, extract_count);
    send_via_plugin(&app, &notification).await
}

/// Schedule study reminders at a specific time
#[tauri::command]
pub async fn schedule_study_reminders(hour: u8, minute: u8) -> Result<()> {
    let manager = NotificationManager::new(true);
    manager.schedule_study_reminders(hour, minute).await
}

/// Get notification settings from database
#[tauri::command]
pub async fn get_notification_settings(repo: State<'_, Repository>) -> Result<NotificationSettings> {
    let pool = repo.pool();
    let settings = sqlx::query_as::<_, (bool, bool, bool, bool, bool, u8, u8)>(
        r#"
        SELECT study_reminders, cards_due, review_completed, document_imported, sound_enabled,
               reminder_hour, reminder_minute
        FROM notification_settings
        LIMIT 1
        "#
    )
    .fetch_optional(pool)
    .await?;

    match settings {
        Some((study_reminders, cards_due, review_completed, document_imported, sound_enabled, reminder_hour, reminder_minute)) => {
            Ok(NotificationSettings {
                study_reminders,
                cards_due,
                review_completed,
                document_imported,
                sound_enabled,
                reminder_hour,
                reminder_minute,
            })
        }
        None => Ok(NotificationSettings::default()),
    }
}

/// Update notification settings
#[tauri::command]
pub async fn update_notification_settings(
    settings: NotificationSettings,
    repo: State<'_, Repository>,
) -> Result<()> {
    sqlx::query("DELETE FROM notification_settings")
        .execute(repo.pool())
        .await?;

    // Insert new settings
    sqlx::query(
        r#"
        INSERT INTO notification_settings (
            id, study_reminders, cards_due, review_completed, document_imported, sound_enabled,
            reminder_hour, reminder_minute
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        "#
    )
    .bind("default") // Use a default ID
    .bind(settings.study_reminders)
    .bind(settings.cards_due)
    .bind(settings.review_completed)
    .bind(settings.document_imported)
    .bind(settings.sound_enabled)
    .bind(settings.reminder_hour)
    .bind(settings.reminder_minute)
    .execute(repo.pool())
    .await?;

    // If study reminders are enabled, schedule them
    if settings.study_reminders {
        let manager = NotificationManager::new(true);
        manager.schedule_study_reminders(settings.reminder_hour, settings.reminder_minute).await?;
    }

    Ok(())
}

/// Notification settings
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct NotificationSettings {
    pub study_reminders: bool,
    pub cards_due: bool,
    pub review_completed: bool,
    pub document_imported: bool,
    pub sound_enabled: bool,
    pub reminder_hour: u8,
    pub reminder_minute: u8,
}

impl Default for NotificationSettings {
    fn default() -> Self {
        Self {
            study_reminders: true,
            cards_due: true,
            review_completed: true,
            document_imported: true,
            sound_enabled: true,
            reminder_hour: 9,
            reminder_minute: 0,
        }
    }
}

/// Create a custom notification
#[tauri::command]
pub async fn create_custom_notification(
    app: AppHandle,
    title: String,
    body: String,
    priority: String,
) -> Result<()> {
    let priority = match priority.as_str() {
        "low" => NotificationPriority::Low,
        "normal" => NotificationPriority::Normal,
        "high" => NotificationPriority::High,
        "critical" => NotificationPriority::Critical,
        _ => NotificationPriority::Normal,
    };

    let notification = Notification {
        id: uuid::Uuid::new_v4().to_string(),
        notification_type: NotificationType::Custom,
        title,
        body,
        priority,
        icon: Some("🔔".to_string()),
        image: None,
        action: None,
        created_at: chrono::Utc::now().to_rfc3339(),
        read: false,
        ttl: Some(3600),
    };

    send_via_plugin(&app, &notification).await
}
