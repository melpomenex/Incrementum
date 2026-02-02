//! Video Extract model
//!
//! VideoExtract represents a timestamp-linked segment from a video
//! that can be scheduled for spaced repetition review.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// Re-export the shared MemoryState and ReviewRating types
pub use super::learning_item::MemoryState;
pub use super::learning_item::ReviewRating;

/// A timestamp-linked extract from a video with FSRS scheduling support
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoExtract {
    pub id: String,
    pub document_id: String,
    /// Start time of the segment in seconds
    pub start_time: f64,
    /// End time of the segment in seconds
    pub end_time: f64,
    /// User-provided or auto-generated title
    pub title: String,
    /// Transcript text for the segment (auto-populated from transcript segments)
    pub transcript_text: Option<String>,
    /// User notes on the extract
    pub notes: Option<String>,
    /// Tags for categorization
    pub tags: Vec<String>,
    /// Optional thumbnail URL
    pub thumbnail_url: Option<String>,
    /// FSRS Memory State (stability and difficulty)
    pub memory_state: Option<MemoryState>,
    /// Next scheduled review date for this extract
    pub next_review_date: Option<DateTime<Utc>>,
    /// Last review date
    pub last_review_date: Option<DateTime<Utc>>,
    /// Number of times this extract has been reviewed
    pub review_count: i32,
    /// Total repetitions/reviews
    pub reps: i32,
    /// When the extract was created
    pub date_created: DateTime<Utc>,
    /// When the extract was last modified
    pub date_modified: DateTime<Utc>,
}

impl VideoExtract {
    /// Create a new video extract with minimal required fields
    pub fn new(document_id: String, start_time: f64, end_time: f64, title: String) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            document_id,
            start_time,
            end_time,
            title,
            transcript_text: None,
            notes: None,
            tags: Vec::new(),
            thumbnail_url: None,
            memory_state: None,
            next_review_date: None,
            last_review_date: None,
            review_count: 0,
            reps: 0,
            date_created: now,
            date_modified: now,
        }
    }

    /// Create a new video extract with transcript text
    pub fn with_transcript(
        document_id: String,
        start_time: f64,
        end_time: f64,
        title: String,
        transcript_text: String,
    ) -> Self {
        let mut extract = Self::new(document_id, start_time, end_time, title);
        extract.transcript_text = Some(transcript_text);
        extract
    }

    /// Create a new video extract scheduled for review
    pub fn with_scheduling(
        document_id: String,
        start_time: f64,
        end_time: f64,
        title: String,
        next_review_date: DateTime<Utc>,
    ) -> Self {
        let mut extract = Self::new(document_id, start_time, end_time, title);
        extract.next_review_date = Some(next_review_date);
        extract
    }

    /// Get the duration of the video extract in seconds
    pub fn duration(&self) -> f64 {
        self.end_time - self.start_time
    }

    /// Check if the extract is valid (end_time > start_time and both are non-negative)
    pub fn is_valid(&self) -> bool {
        self.start_time >= 0.0 && self.end_time > self.start_time
    }

    /// Check if the duration exceeds the recommended maximum (5 minutes = 300 seconds)
    pub fn exceeds_recommendation(&self) -> bool {
        self.duration() > 300.0
    }

    /// Check if the duration exceeds the hard maximum (10 minutes = 600 seconds)
    pub fn exceeds_maximum(&self) -> bool {
        self.duration() > 600.0
    }

    /// Format the time range as a string (e.g., "5:30-7:15")
    pub fn format_time_range(&self) -> String {
        format!("{}-{}", format_seconds(self.start_time), format_seconds(self.end_time))
    }

    /// Get a preview of the transcript text (first 200 characters)
    pub fn transcript_preview(&self) -> Option<String> {
        self.transcript_text.as_ref().map(|text| {
            if text.len() <= 200 {
                text.clone()
            } else {
                format!("{}...", &text[..200])
            }
        })
    }
}

/// Format seconds as MM:SS or HH:MM:SS
fn format_seconds(seconds: f64) -> String {
    let total_seconds = seconds as i64;
    let hours = total_seconds / 3600;
    let minutes = (total_seconds % 3600) / 60;
    let secs = total_seconds % 60;

    if hours > 0 {
        format!("{}:{:02}:{:02}", hours, minutes, secs)
    } else {
        format!("{}:{:02}", minutes, secs)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_video_extract_creation() {
        let extract = VideoExtract::new(
            "doc123".to_string(),
            30.0,
            90.0,
            "Introduction".to_string(),
        );

        assert_eq!(extract.document_id, "doc123");
        assert_eq!(extract.start_time, 30.0);
        assert_eq!(extract.end_time, 90.0);
        assert_eq!(extract.title, "Introduction");
        assert_eq!(extract.duration(), 60.0);
    }

    #[test]
    fn test_video_extract_validation() {
        let valid = VideoExtract::new("doc123".to_string(), 30.0, 90.0, "Valid".to_string());
        assert!(valid.is_valid());

        let invalid_start = VideoExtract::new("doc123".to_string(), -10.0, 90.0, "Invalid".to_string());
        assert!(!invalid_start.is_valid());

        let invalid_end = VideoExtract::new("doc123".to_string(), 90.0, 30.0, "Invalid".to_string());
        assert!(!invalid_end.is_valid());
    }

    #[test]
    fn test_duration_checks() {
        let short = VideoExtract::new("doc123".to_string(), 0.0, 120.0, "Short".to_string());
        assert!(!short.exceeds_recommendation());
        assert!(!short.exceeds_maximum());

        let recommended = VideoExtract::new("doc123".to_string(), 0.0, 400.0, "Recommended".to_string());
        assert!(recommended.exceeds_recommendation());
        assert!(!recommended.exceeds_maximum());

        let too_long = VideoExtract::new("doc123".to_string(), 0.0, 700.0, "TooLong".to_string());
        assert!(too_long.exceeds_recommendation());
        assert!(too_long.exceeds_maximum());
    }

    #[test]
    fn test_time_range_formatting() {
        let extract = VideoExtract::new("doc123".to_string(), 330.0, 435.0, "Test".to_string());
        assert_eq!(extract.format_time_range(), "5:30-7:15");
    }

    #[test]
    fn test_transcript_preview() {
        let long_text = "a".repeat(300);
        let extract = VideoExtract::with_transcript(
            "doc123".to_string(),
            0.0,
            60.0,
            "Test".to_string(),
            long_text.clone(),
        );

        let preview = extract.transcript_preview().unwrap();
        assert!(preview.len() <= 203); // 200 + "..."
        assert!(preview.ends_with("..."));
    }
}
