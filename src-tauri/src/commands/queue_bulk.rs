//! Advanced queue management commands

use tauri::State;
use crate::database::Repository;
use crate::error::Result;
use crate::models::{LearningItem, Document};
use chrono::{Utc, Duration, Datelike, TimeZone};
use serde::{Deserialize, Serialize};
use sqlx::Row;

#[derive(Debug, Serialize, Deserialize)]
pub struct QueueStats {
    pub total_items: i32,
    pub due_today: i32,
    pub overdue: i32,
    pub new_items: i32,
    pub learning_items: i32,
    pub review_items: i32,
    pub total_estimated_time: i32, // in minutes
    pub suspended: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BulkOperationResult {
    pub succeeded: Vec<String>,
    pub failed: Vec<String>,
    pub errors: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QueueExportItem {
    pub id: String,
    pub document_title: String,
    pub item_type: String,
    pub question: String,
    pub answer: Option<String>,
    pub due_date: String,
    pub state: String,
    pub interval: f64,
    pub tags: Vec<String>,
    pub category: Option<String>,
}

/// Get queue statistics
#[tauri::command]
pub async fn get_queue_stats(
    repo: State<'_, Repository>,
) -> Result<QueueStats> {
    let all_items = repo.get_all_learning_items().await?;
    let now = Utc::now();

    let mut stats = QueueStats {
        total_items: all_items.len() as i32,
        due_today: 0,
        overdue: 0,
        new_items: 0,
        learning_items: 0,
        review_items: 0,
        total_estimated_time: 0,
        suspended: 0,
    };

    for item in &all_items {
        if item.is_suspended {
            stats.suspended += 1;
            continue;
        }

        match item.state {
            crate::models::ItemState::New => stats.new_items += 1,
            crate::models::ItemState::Learning | crate::models::ItemState::Relearning => {
                stats.learning_items += 1
            }
            crate::models::ItemState::Review => stats.review_items += 1,
        }

        // Count due today/overdue
        if item.due_date <= now {
            stats.due_today += 1;
            if item.due_date < now && item.review_count > 0 {
                stats.overdue += 1;
            }
        }

        // Add estimated time
        let est_time = match item.item_type {
            crate::models::ItemType::Cloze => 2,
            crate::models::ItemType::Qa => 3,
            _ => 1,
        };
        stats.total_estimated_time += est_time;
    }

    Ok(stats)
}

/// Postpone an item (reschedule for later). Handles both learning items and documents.
/// When `item_type` is "document", updates the document's `next_reading_date`.
/// Otherwise, treats it as a learning item and updates `due_date`.
#[tauri::command]
pub async fn postpone_item(
    item_id: String,
    days: i32,
    item_type: Option<String>,
    repo: State<'_, Repository>,
) -> Result<bool> {
    match item_type.as_deref() {
        Some("document") => {
            // Postpone a document by advancing next_reading_date
            let mut doc = repo.get_document(&item_id).await?
                .ok_or_else(|| crate::error::IncrementumError::NotFound(format!("Document {}", item_id)))?;

            let new_date = match doc.next_reading_date {
                Some(d) => d + Duration::days(days as i64),
                None => Utc::now() + Duration::days(days as i64),
            };
            repo.update_document_scheduling(
                &item_id,
                Some(new_date),
                doc.stability,
                doc.difficulty,
                None, // reps
                None, // total_time_spent
            ).await?;
            Ok(true)
        }
        _ => {
            // Default: postpone a learning item
            let mut item = repo.get_all_learning_items().await?
                .into_iter()
                .find(|i| i.id == item_id)
                .ok_or_else(|| crate::error::IncrementumError::NotFound(format!("Item {}", item_id)))?;

            item.due_date += Duration::days(days as i64);
            item.date_modified = Utc::now();

            repo.update_learning_item(&item).await?;
            Ok(true)
        }
    }
}

/// Bulk suspend items
#[tauri::command]
pub async fn bulk_suspend_items(
    item_ids: Vec<String>,
    repo: State<'_, Repository>,
) -> Result<BulkOperationResult> {
    let mut result = BulkOperationResult {
        succeeded: Vec::new(),
        failed: Vec::new(),
        errors: Vec::new(),
    };

    for item_id in &item_ids {
        match repo.get_all_learning_items().await {
            Ok(all_items) => {
                if let Some(mut item) = all_items.into_iter().find(|i| &i.id == item_id) {
                    item.is_suspended = true;
                    item.date_modified = Utc::now();

                    match repo.update_learning_item(&item).await {
                        Ok(_) => result.succeeded.push(item_id.clone()),
                        Err(e) => {
                            result.failed.push(item_id.clone());
                            result.errors.push(format!("{}: {}", item_id, e));
                        }
                    }
                } else {
                    result.failed.push(item_id.clone());
                    result.errors.push(format!("{}: Item not found", item_id));
                }
            }
            Err(e) => {
                result.failed.push(item_id.clone());
                result.errors.push(format!("{}: {}", item_id, e));
            }
        }
    }

    Ok(result)
}

/// Bulk unsuspend items
#[tauri::command]
pub async fn bulk_unsuspend_items(
    item_ids: Vec<String>,
    repo: State<'_, Repository>,
) -> Result<BulkOperationResult> {
    let mut result = BulkOperationResult {
        succeeded: Vec::new(),
        failed: Vec::new(),
        errors: Vec::new(),
    };

    for item_id in &item_ids {
        match repo.get_all_learning_items().await {
            Ok(all_items) => {
                if let Some(mut item) = all_items.into_iter().find(|i| &i.id == item_id) {
                    item.is_suspended = false;
                    item.date_modified = Utc::now();

                    match repo.update_learning_item(&item).await {
                        Ok(_) => result.succeeded.push(item_id.clone()),
                        Err(e) => {
                            result.failed.push(item_id.clone());
                            result.errors.push(format!("{}: {}", item_id, e));
                        }
                    }
                } else {
                    result.failed.push(item_id.clone());
                    result.errors.push(format!("{}: Item not found", item_id));
                }
            }
            Err(e) => {
                result.failed.push(item_id.clone());
                result.errors.push(format!("{}: {}", item_id, e));
            }
        }
    }

    Ok(result)
}

/// Bulk delete items
#[tauri::command]
pub async fn bulk_delete_items(
    item_ids: Vec<String>,
    repo: State<'_, Repository>,
) -> Result<BulkOperationResult> {
    let mut result = BulkOperationResult {
        succeeded: Vec::new(),
        failed: Vec::new(),
        errors: Vec::new(),
    };

    for item_id in &item_ids {
        match sqlx::query("DELETE FROM learning_items WHERE id = ?")
            .bind(item_id)
            .execute(repo.pool())
            .await
        {
            Ok(_) => result.succeeded.push(item_id.clone()),
            Err(e) => {
                result.failed.push(item_id.clone());
                result.errors.push(format!("{}: {}", item_id, e));
            }
        }
    }

    Ok(result)
}

/// Export queue data
#[tauri::command]
pub async fn export_queue(
    repo: State<'_, Repository>,
) -> Result<Vec<QueueExportItem>> {
    let all_items = repo.get_all_learning_items().await?;
    let mut export_items = Vec::new();

    for item in all_items {
        // Skip suspended items
        if item.is_suspended {
            continue;
        }

        let document_title = if let Some(doc_id) = &item.document_id {
            repo.get_document(doc_id).await?
                .map(|d| d.title)
                .unwrap_or_else(|| "Unknown Document".to_string())
        } else {
            "Unknown Document".to_string()
        };

        let category = if let Some(extract_id) = &item.extract_id {
            repo.get_extract(extract_id).await?
                .and_then(|e| e.category)
        } else {
            None
        };

        export_items.push(QueueExportItem {
            id: item.id.clone(),
            document_title,
            item_type: format!("{:?}", item.item_type),
            question: item.question,
            answer: item.answer,
            due_date: item.due_date.to_rfc3339(),
            state: format!("{:?}", item.state),
            interval: item.interval,
            tags: item.tags,
            category,
        });
    }

    Ok(export_items)
}

// ---------------------------------------------------------------------------
// Queue load management: Advance, Load Balancing, Easy Days
// (FSRS Helper add-on equivalents, natively built in)
// ---------------------------------------------------------------------------

/// Result of a bulk load-management operation.
#[derive(Debug, Serialize, Deserialize)]
pub struct LoadManagementResult {
    pub affected: u64,
    pub skipped: u64,
}

/// Advance a single item's due date closer to today (inverse of postpone).
/// Shifts `due_date` by `-days` for learning items, or `next_reading_date`
/// for documents. Memory state is never mutated.
#[tauri::command]
pub async fn advance_item(
    item_id: String,
    days: i32,
    item_type: Option<String>,
    repo: State<'_, Repository>,
) -> Result<bool> {
    let shift = Duration::days(-(days.max(0) as i64));
    match item_type.as_deref() {
        Some("document") => {
            let mut doc = repo.get_document(&item_id).await?
                .ok_or_else(|| crate::error::IncrementumError::NotFound(format!("Document {}", item_id)))?;
            let new_date = doc.next_reading_date.unwrap_or_else(Utc::now) + shift;
            // Never push a document into the past beyond today.
            let new_date = new_date.max(Utc::now());
            repo.update_document_scheduling(
                &item_id,
                Some(new_date),
                doc.stability,
                doc.difficulty,
                None,
                None,
            ).await?;
            Ok(true)
        }
        _ => {
            let mut item = repo.get_all_learning_items().await?
                .into_iter()
                .find(|i| i.id == item_id)
                .ok_or_else(|| crate::error::IncrementumError::NotFound(format!("Item {}", item_id)))?;
            item.due_date = (item.due_date + shift).max(Utc::now());
            item.date_modified = Utc::now();
            repo.update_learning_item(&item).await?;
            Ok(true)
        }
    }
}

/// Bulk-advance all items due within the next `days` onto today.
/// Useful for "I have time now, let me get ahead" cramming.
#[tauri::command]
pub async fn advance_due_queue(
    days: Option<i32>,
    repo: State<'_, Repository>,
) -> Result<LoadManagementResult> {
    let horizon_days = days.unwrap_or(7).max(1) as i64;
    let now = Utc::now();
    let horizon = now + Duration::days(horizon_days);

    let items = repo.get_all_learning_items().await?;
    let mut affected: u64 = 0;
    let mut skipped: u64 = 0;

    for mut item in items {
        if item.is_suspended {
            skipped += 1;
            continue;
        }
        // Only pull forward items that are due within the horizon but not yet due today.
        if item.due_date > now && item.due_date <= horizon {
            item.due_date = now;
            item.date_modified = now;
            repo.update_learning_item(&item).await?;
            affected += 1;
        } else {
            skipped += 1;
        }
    }

    Ok(LoadManagementResult { affected, skipped })
}

/// Redistribute the due pile across the next `window_days` so no single day
/// exceeds `target_per_day`. When `target_per_day` is None, defaults to
/// `ceil(total_due / window_days * 1.25)`. Memory state is preserved; only
/// `due_date` shifts.
#[tauri::command]
pub async fn load_balance_queue(
    window_days: Option<i32>,
    target_per_day: Option<i32>,
    repo: State<'_, Repository>,
) -> Result<LoadManagementResult> {
    use std::collections::BTreeMap;
    let window = window_days.unwrap_or(14).clamp(1, 90) as i64;
    let now = Utc::now();
    let horizon = now + Duration::days(window);

    let items = repo.get_all_learning_items().await?;
    // Bucket items by due day (date string). Only consider items due within [now, horizon].
    let mut buckets: BTreeMap<chrono::NaiveDate, Vec<LearningItem>> = BTreeMap::new();
    for item in items {
        if item.is_suspended { continue; }
        if item.due_date >= now && item.due_date <= horizon {
            buckets.entry(item.due_date.date_naive()).or_default().push(item);
        } else if item.due_date < now {
            // Overdue items are also in scope (they're the worst offenders).
            buckets.entry(now.date_naive()).or_default().push(item);
        }
    }

    let total_due: usize = buckets.values().map(|v| v.len()).sum();
    if total_due == 0 {
        return Ok(LoadManagementResult { affected: 0, skipped: 0 });
    }

    let target = target_per_day
        .map(|t| t.max(1) as usize)
        .unwrap_or_else(|| ((total_due as f64 / window as f64) * 1.25).ceil() as usize)
        .max(1);

    // Flatten all due items, then re-distribute `target` per day across the window.
    let mut all_items: Vec<LearningItem> = buckets.into_values().flatten().collect();
    // Sort by due_date so we redistribute in a stable order.
    all_items.sort_by_key(|i| i.due_date);

    let mut affected: u64 = 0;
    let mut skipped: u64 = 0;
    let mut item_idx = 0;
    'outer: for day_offset in 0..window {
        let day = now.date_naive() + Duration::days(day_offset);
        let new_due = Utc.from_utc_datetime(&day.and_hms_opt(12, 0, 0).unwrap());
        for _ in 0..target {
            if item_idx >= all_items.len() { break 'outer; }
            let mut item = all_items[item_idx].clone();
            // Skip items already correctly on this day.
            if (item.due_date.date_naive() - day).num_days().abs() == 0 {
                skipped += 1;
                item_idx += 1;
                continue;
            }
            item.due_date = new_due;
            item.date_modified = now;
            repo.update_learning_item(&item).await?;
            affected += 1;
            item_idx += 1;
        }
    }

    Ok(LoadManagementResult { affected, skipped })
}

/// Easy Days: shift any learning item whose `due_date` within the next
/// `window_days` falls on an easy weekday (0=Sun..6=Sat) forward to the next
/// non-easy day. Reads persisted `easy_days` settings when not provided.
#[tauri::command]
pub async fn apply_easy_days(
    window_days: Option<i32>,
    easy_days: Option<Vec<u8>>,
    repo: State<'_, Repository>,
) -> Result<LoadManagementResult> {
    let window = window_days.unwrap_or(30).clamp(1, 365) as i64;
    // Default to no easy days if none provided.
    let easy: std::collections::HashSet<u8> = easy_days.unwrap_or_default().into_iter().collect();
    if easy.is_empty() {
        return Ok(LoadManagementResult { affected: 0, skipped: 0 });
    }

    let now = Utc::now();
    let horizon = now + Duration::days(window);
    let items = repo.get_all_learning_items().await?;

    let mut affected: u64 = 0;
    let mut skipped: u64 = 0;

    for mut item in items {
        if item.is_suspended { skipped += 1; continue; }
        if item.due_date < now || item.due_date > horizon { skipped += 1; continue; }

        // Walk forward from the due date until we land on a non-easy weekday.
        let mut candidate = item.due_date;
        // Cap the walk to one full week so we never loop forever.
        for _ in 0..8 {
            let weekday = candidate.weekday().num_days_from_sunday() as u8;
            if !easy.contains(&weekday) { break; }
            candidate += Duration::days(1);
        }

        if candidate != item.due_date {
            item.due_date = candidate;
            item.date_modified = now;
            repo.update_learning_item(&item).await?;
            affected += 1;
        } else {
            skipped += 1;
        }
    }

    Ok(LoadManagementResult { affected, skipped })
}
