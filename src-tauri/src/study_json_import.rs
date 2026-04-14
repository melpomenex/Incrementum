//! Study JSON deck import functionality
//!
//! Parses flat-map JSON files where the top-level is {question: card_object}.
//! Each file represents one deck. Creates one Document per file, one LearningItem per card.

use std::collections::HashMap;
use std::fs;
use std::path::Path;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::State;

use crate::database::Repository;
use crate::error::{IncrementumError, Result};
use crate::models::{Document, FileType, ItemState, ItemType, LearningItem};

// ---------------------------------------------------------------------------
// Data structures matching the Study JSON format
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct StudyJsonCard {
    pub answer: String,
    pub subject: String,
    pub deck_name: String,
    #[serde(default)]
    pub difficulty: Option<String>,
    #[serde(default)]
    pub difficulty_score: Option<f64>,
    #[serde(default)]
    pub correct_count: i32,
    #[serde(default)]
    pub missed_count: i32,
    #[serde(default)]
    pub review_count: i32,
    #[serde(default = "default_ease_factor")]
    pub ease_factor: f64,
    #[serde(default)]
    pub interval_days: i32,
    #[serde(default)]
    pub repetitions: i32,
    #[serde(default)]
    pub lapse_count: i32,
    #[serde(default)]
    pub retention_rate: f64,
    #[serde(default)]
    pub lapse_rate: f64,
    #[serde(default)]
    pub due_at: Option<String>,
    #[serde(default)]
    pub last_reviewed: Option<String>,
    #[serde(default)]
    pub manual_review: bool,
    #[serde(default)]
    pub save_for_later: bool,
    #[serde(default)]
    pub known_pile: bool,
}

fn default_ease_factor() -> f64 {
    2.5
}

#[derive(Debug, Serialize)]
pub struct StudyJsonDeck {
    pub deck_name: String,
    pub subject: String,
    pub cards: Vec<(String, StudyJsonCard)>, // (question, card)
}

#[derive(Debug, Serialize)]
pub struct StudyJsonValidation {
    pub deck_name: String,
    pub subject: String,
    pub total_cards: usize,
    pub new_cards: usize,
    pub review_cards: usize,
}

#[derive(Debug, Serialize)]
pub struct StudyJsonImportResult {
    pub deck_name: String,
    pub document_id: String,
    pub cards_imported: usize,
    pub cards_skipped: usize,
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/// Parse a Study JSON file into a `StudyJsonDeck`.
///
/// The file must be a flat JSON object where every key is a question string and
/// every value is an object containing at least `answer`, `subject`, and
/// `deck_name`.
pub fn parse_study_json_file(path: &str) -> Result<StudyJsonDeck> {
    let content = fs::read_to_string(path).map_err(|e| {
        IncrementumError::NotFound(format!("Cannot read file: {}", e))
    })?;

    let raw: serde_json::Value = serde_json::from_str(&content).map_err(|e| {
        IncrementumError::InvalidInput(format!("Invalid JSON: {}", e))
    })?;

    let obj = raw.as_object().ok_or_else(|| {
        IncrementumError::InvalidInput(
            "Expected a JSON object (flat map of question -> card)".to_string(),
        )
    })?;

    if obj.is_empty() {
        return Err(IncrementumError::InvalidInput(
            "Deck file is empty (no cards found)".to_string(),
        ));
    }

    let mut cards = Vec::new();
    let mut deck_name = String::from("Unknown Deck");
    let mut subject = String::from("Unknown");

    for (question, value) in obj {
        let card: StudyJsonCard = serde_json::from_value(value.clone())
            .map_err(|e| {
                IncrementumError::InvalidInput(format!(
                    "Card for question \"{}\" is invalid: {}",
                    question.chars().take(60).collect::<String>(),
                    e
                ))
            })?;

        // Validate required fields
        if card.answer.is_empty() && card.deck_name.is_empty() {
            return Err(IncrementumError::InvalidInput(format!(
                "Card for question \"{}\" is missing required fields (answer, deck_name, subject)",
                question.chars().take(60).collect::<String>()
            )));
        }

        if deck_name == "Unknown Deck" && !card.deck_name.is_empty() {
            deck_name = card.deck_name.clone();
        }
        if subject == "Unknown" && !card.subject.is_empty() {
            subject = card.subject.clone();
        }

        cards.push((question.clone(), card));
    }

    Ok(StudyJsonDeck {
        deck_name,
        subject,
        cards,
    })
}

/// Validate a Study JSON file and return a summary without modifying the database.
pub fn validate_study_json(path: &str) -> Result<StudyJsonValidation> {
    let deck = parse_study_json_file(path)?;

    let total = deck.cards.len();
    let review_cards = deck
        .cards
        .iter()
        .filter(|(_, c)| c.review_count > 0)
        .count();
    let new_cards = total - review_cards;

    Ok(StudyJsonValidation {
        deck_name: deck.deck_name,
        subject: deck.subject,
        total_cards: total,
        new_cards,
        review_cards,
    })
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

fn hex_sha256(text: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn parse_datetime(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.with_timezone(&Utc))
        .ok()
}

/// Build a `LearningItem` from a question + card pair.
fn build_learning_item(
    question: &str,
    card: &StudyJsonCard,
    document_id: &str,
) -> LearningItem {
    let mut item = LearningItem::new(ItemType::Flashcard, question.to_string());

    // Deterministic ID from question text
    item.id = hex_sha256(question);
    item.document_id = Some(document_id.to_string());
    item.answer = Some(card.answer.clone());

    // Scheduling fields
    item.ease_factor = card.ease_factor;
    item.interval = card.interval_days as f64;
    item.review_count = card.repetitions;
    item.lapses = card.lapse_count;
    item.algorithm_type = "sm2".to_string();

    // State derivation
    if card.known_pile {
        item.is_suspended = true;
        item.state = ItemState::Review;
    } else if card.review_count > 0 {
        item.state = ItemState::Review;
        if let Some(ref due_str) = card.due_at {
            if let Some(dt) = parse_datetime(due_str) {
                item.due_date = dt;
            }
        }
        if let Some(ref reviewed_str) = card.last_reviewed {
            if let Some(dt) = parse_datetime(reviewed_str) {
                item.last_review_date = Some(dt);
            }
        }
    }

    // Store fields without direct LearningItem equivalents
    let mut metadata = serde_json::Map::new();
    metadata.insert("correct_count".to_string(), serde_json::json!(card.correct_count));
    metadata.insert("missed_count".to_string(), serde_json::json!(card.missed_count));
    metadata.insert("retention_rate".to_string(), serde_json::json!(card.retention_rate));
    metadata.insert("manual_review".to_string(), serde_json::json!(card.manual_review));
    metadata.insert("save_for_later".to_string(), serde_json::json!(card.save_for_later));
    if let Some(d) = card.difficulty.as_deref() {
        metadata.insert("difficulty_label".to_string(), serde_json::json!(d));
    }
    if let Some(ds) = card.difficulty_score {
        metadata.insert("difficulty_score".to_string(), serde_json::json!(ds));
    }
    item.interaction_metadata = Some(serde_json::Value::Object(metadata));

    // Tags
    item.tags = vec![
        "study-json-import".to_string(),
        card.subject.clone(),
        card.deck_name.clone(),
    ];

    item
}

/// Import a Study JSON file: creates one Document + N LearningItems.
///
/// Skips cards that already exist (deduplication by document_id + question text).
#[tauri::command]
pub async fn import_study_json_file(
    file_path: String,
    repo: State<'_, Repository>,
) -> Result<StudyJsonImportResult> {
    let deck = parse_study_json_file(&file_path)?;

    // Create the parent Document
    let filename = Path::new(&file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown.json");
    let mut doc = Document::new(
        deck.deck_name.clone(),
        format!("study-json://{}", filename),
        FileType::Other,
    );
    doc.category = Some(deck.subject.clone());
    doc.tags = vec![
        "study-json-import".to_string(),
        deck.subject.clone(),
        deck.deck_name.clone(),
    ];

    let doc = repo.create_document(&doc).await?;
    let document_id = doc.id.clone();

    // Collect existing question hashes for this document to deduplicate
    let existing_items = repo.get_learning_items_by_document(&document_id).await?;
    let existing_ids: std::collections::HashSet<String> = existing_items
        .iter()
        .map(|item| item.id.clone())
        .collect();

    let mut imported = 0usize;
    let mut skipped = 0usize;

    for (question, card) in &deck.cards {
        let item_id = hex_sha256(question);

        if existing_ids.contains(&item_id) {
            skipped += 1;
            continue;
        }

        let item = build_learning_item(question, card, &document_id);
        repo.create_learning_item(&item).await?;
        imported += 1;
    }

    Ok(StudyJsonImportResult {
        deck_name: deck.deck_name,
        document_id,
        cards_imported: imported,
        cards_skipped: skipped,
    })
}

/// Validate a Study JSON file (no database writes).
#[tauri::command]
pub fn validate_study_json_file(file_path: String) -> Result<StudyJsonValidation> {
    validate_study_json(&file_path)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    fn write_temp_json(content: &str) -> NamedTempFile {
        let mut f = NamedTempFile::new().expect("temp file");
        write!(f, "{}", content).expect("write");
        f
    }

    fn sample_card() -> serde_json::Value {
        serde_json::json!({
            "answer": "5' to 3'.",
            "subject": "Biochemistry",
            "deck_name": "Test Deck",
            "difficulty": "Easy",
            "difficulty_score": 8.0,
            "correct_count": 3,
            "missed_count": 1,
            "review_count": 2,
            "ease_factor": 2.6,
            "interval_days": 4,
            "repetitions": 2,
            "lapse_count": 0,
            "retention_rate": 0.75,
            "lapse_rate": 0.25,
            "due_at": "2026-04-20T12:00:00Z",
            "last_reviewed": "2026-04-16T12:00:00Z",
            "manual_review": false,
            "save_for_later": false,
            "known_pile": false
        })
    }

    fn new_card() -> serde_json::Value {
        serde_json::json!({
            "answer": "Because of the O-H group.",
            "subject": "Organic Chemistry",
            "deck_name": "Test Deck",
            "correct_count": 0,
            "missed_count": 0,
            "review_count": 0,
            "ease_factor": 2.5,
            "interval_days": 0,
            "repetitions": 0,
            "lapse_count": 0,
            "retention_rate": 0.0,
            "lapse_rate": 0.0,
            "due_at": null,
            "last_reviewed": null,
            "manual_review": false,
            "save_for_later": false,
            "known_pile": false
        })
    }

    #[test]
    fn test_parse_valid_file() {
        let json = serde_json::json!({
            "What is DNA synthesis?": sample_card(),
            "Why do alcohols H-bond?": new_card()
        });
        let f = write_temp_json(&json.to_string());
        let deck = parse_study_json_file(f.path().to_str().unwrap()).unwrap();

        assert_eq!(deck.deck_name, "Test Deck");
        assert_eq!(deck.cards.len(), 2);
        assert_eq!(deck.cards[0].0, "What is DNA synthesis?");
        assert_eq!(deck.cards[0].1.answer, "5' to 3'.");
        assert_eq!(deck.cards[1].1.review_count, 0);
    }

    #[test]
    fn test_parse_invalid_json() {
        let f = write_temp_json("not json {{{");
        let result = parse_study_json_file(f.path().to_str().unwrap());
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Invalid JSON"));
    }

    #[test]
    fn test_parse_not_object() {
        let f = write_temp_json("[1,2,3]");
        let result = parse_study_json_file(f.path().to_str().unwrap());
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Expected a JSON object"));
    }

    #[test]
    fn test_parse_empty_deck() {
        let f = write_temp_json("{}");
        let result = parse_study_json_file(f.path().to_str().unwrap());
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("empty"));
    }

    #[test]
    fn test_validate() {
        let json = serde_json::json!({
            "Q1?": sample_card(),
            "Q2?": new_card()
        });
        let f = write_temp_json(&json.to_string());
        let v = validate_study_json(f.path().to_str().unwrap()).unwrap();

        assert_eq!(v.deck_name, "Test Deck");
        assert_eq!(v.subject, "Biochemistry");
        assert_eq!(v.total_cards, 2);
        assert_eq!(v.review_cards, 1); // only sample_card has review_count > 0
        assert_eq!(v.new_cards, 1);
    }

    #[test]
    fn test_build_learning_item_review() {
        let card: StudyJsonCard = serde_json::from_value(sample_card()).unwrap();
        let item = build_learning_item("What is DNA synthesis?", &card, "doc-123");

        assert_eq!(item.item_type, ItemType::Flashcard);
        assert_eq!(item.document_id.as_deref(), Some("doc-123"));
        assert_eq!(item.answer.as_deref(), Some("5' to 3'."));
        assert_eq!(item.ease_factor, 2.6);
        assert_eq!(item.interval, 4.0);
        assert_eq!(item.review_count, 2);
        assert_eq!(item.lapses, 0);
        assert!(matches!(item.state, ItemState::Review));
        assert!(!item.is_suspended);
        assert_eq!(item.algorithm_type, "sm2");
        assert!(item.last_review_date.is_some());

        // Check deterministic ID
        assert_eq!(item.id, hex_sha256("What is DNA synthesis?"));

        // Check interaction_metadata
        let meta = item.interaction_metadata.unwrap();
        assert_eq!(meta["correct_count"], 3);
        assert_eq!(meta["missed_count"], 1);
        assert_eq!(meta["retention_rate"], 0.75);
    }

    #[test]
    fn test_build_learning_item_new() {
        let card: StudyJsonCard = serde_json::from_value(new_card()).unwrap();
        let item = build_learning_item("Why do alcohols H-bond?", &card, "doc-123");

        assert!(matches!(item.state, ItemState::New));
        assert_eq!(item.interval, 0.0);
        assert_eq!(item.ease_factor, 2.5);
        assert_eq!(item.review_count, 0);
        assert!(item.last_review_date.is_none());
    }

    #[test]
    fn test_build_learning_item_known_pile() {
        let mut json = sample_card();
        json["known_pile"] = serde_json::json!(true);
        let card: StudyJsonCard = serde_json::from_value(json).unwrap();
        let item = build_learning_item("Known thing?", &card, "doc-123");

        assert!(item.is_suspended);
        assert!(matches!(item.state, ItemState::Review));
    }

    #[test]
    fn test_deterministic_id() {
        let q = "In which direction does DNA synthesis occur?";
        let id1 = hex_sha256(q);
        let id2 = hex_sha256(q);
        assert_eq!(id1, id2);
        // Different question → different id
        assert_ne!(id1, hex_sha256("Other question"));
    }
}
