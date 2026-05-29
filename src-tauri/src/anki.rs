//! Anki package import functionality
//!
//! .apkg files are ZIP archives containing:
//! - collection.anki2 (SQLite database with notes, cards, revlog)
//! - media (JSON file mapping filenames to content)
//! - Actual media files

use std::collections::HashMap;
use std::io::{Cursor, Read, Seek, Write};
use std::fs::File;
use std::path::Path;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use base64::{engine::general_purpose, Engine as _};
use image::GenericImageView;
use regex::Regex;
use sha2::{Digest, Sha256};
use zip::ZipArchive;
use rusqlite::Connection;
use serde_json::Value;
use crate::error::{Result, IncrementumError};
use crate::database::Repository;
use crate::models::{LearningItem, ItemType, ItemState, MemoryState};
use chrono::{Duration, Utc};
use tauri::State;

#[derive(Debug, Clone, serde::Serialize)]
pub struct AnkiNote {
    pub id: i64,
    pub guid: String,
    pub mid: i64,
    pub model_name: String,
    pub tags: Vec<String>,
    pub fields: Vec<AnkiField>,
    pub timestamp: i64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct AnkiField {
    pub name: String,
    pub value: String,
}

#[derive(Debug, serde::Serialize)]
pub struct AnkiCard {
    pub id: i64,
    pub note_id: i64,
    pub ord: i64,
    pub interval: i32,
    pub ease: f64,
    pub due: i32,
    pub data: Option<String>,
    pub reps: i32,
    pub lapses: i32,
}

#[derive(Debug, serde::Serialize)]
pub struct AnkiDeck {
    pub id: i64,
    pub name: String,
    pub notes: Vec<AnkiNote>,
    pub cards: Vec<AnkiCard>,
    pub revlog: Vec<AnkiRevLogEntry>,
}

#[derive(Debug, Clone)]
struct AnkiMediaFile {
    file_name: String,
    mime_type: String,
    bytes: Arc<Vec<u8>>,
}

/// A single entry from Anki's revlog table
#[derive(Debug, Clone, serde::Serialize)]
pub struct AnkiRevLogEntry {
    pub id: i64,
    pub cid: i64,
    pub ease: i32,
    pub ivl: i32,
    pub last_ivl: i32,
    pub factor: i32,
    pub time_ms: i32,
    pub rev_type: i32,
    pub timestamp: i64,
}

/// A row from our review_log table (used for export)
#[derive(Debug, Clone, serde::Serialize)]
pub struct ReviewLogRow {
    pub id: String,
    pub item_id: String,
    pub rating: i32,
    pub interval_days: f64,
    pub last_interval_days: Option<f64>,
    pub ease_factor: f64,
    pub time_ms: i32,
    pub review_type: i32,
    pub anki_revlog_id: Option<i64>,
    pub timestamp: String,
}

/// Convert Incrementum cloze ranges to Anki `{{c1::text}}` syntax.
/// Returns None if ranges are missing or invalid (caller should fall back to Basic model).
fn cloze_text_to_anki(cloze_text: &str, cloze_ranges: &[(usize, usize)]) -> Option<String> {
    if cloze_ranges.is_empty() || cloze_text.is_empty() {
        return None;
    }
    let chars: Vec<char> = cloze_text.chars().collect();
    let byte_ranges: Vec<(usize, usize)> = cloze_ranges
        .iter()
        .filter_map(|(s, e)| {
            if *e > chars.len() || *s >= *e {
                return None;
            }
            let byte_start = chars[..*s].iter().collect::<String>().len();
            let byte_end = chars[..*e].iter().collect::<String>().len();
            Some((byte_start, byte_end))
        })
        .collect();
    let mut result = String::with_capacity(cloze_text.len() + 32);
    let mut last_end = 0;
    for (cloze_idx, (start, end)) in byte_ranges.iter().enumerate() {
        if *start >= *end || *end > cloze_text.len() || *start < last_end {
            continue;
        }
        result.push_str(&cloze_text[last_end..*start]);
        result.push_str(&format!("{{{{c{}::", cloze_idx + 1));
        result.push_str(&cloze_text[*start..*end]);
        result.push_str("}}");
        last_end = *end;
    }
    result.push_str(&cloze_text[last_end..]);
    if result == cloze_text {
        return None;
    }
    Some(result)
}

/// Parse an .apkg file and extract deck data
pub async fn parse_apkg(apkg_path: &str) -> Result<Vec<AnkiDeck>> {
    let file = File::open(apkg_path)
        .map_err(|e| IncrementumError::NotFound(format!("Cannot open .apkg file: {}", e)))?;

    let mut archive = ZipArchive::new(file)
        .map_err(|e| IncrementumError::NotFound(format!("Cannot unzip .apkg file: {}", e)))?;

    parse_apkg_from_archive(&mut archive)
}

fn parse_apkg_from_archive<R: Read + Seek>(
    archive: &mut ZipArchive<R>,
) -> Result<Vec<AnkiDeck>> {
    let mut best_decks: Option<Vec<AnkiDeck>> = None;
    let mut best_notes = 0usize;

    for name in ["collection.anki2", "collection.anki21"] {
        if let Ok(decks) = parse_collection_from_archive(archive, name) {
            let total_notes: usize = decks.iter().map(|deck| deck.notes.len()).sum();
            if total_notes > best_notes {
                best_notes = total_notes;
                best_decks = Some(decks);
            }
        }
    }

    best_decks.ok_or_else(|| {
        IncrementumError::NotFound("No valid collection.anki2 or collection.anki21 found in archive".to_string())
    })
}

fn parse_apkg_with_media_from_archive<R: Read + Seek>(
    archive: &mut ZipArchive<R>,
) -> Result<(Vec<AnkiDeck>, HashMap<String, AnkiMediaFile>)> {
    let decks = parse_apkg_from_archive(archive)?;
    let media = extract_media_map_from_archive(archive);
    Ok((decks, media))
}

fn extract_media_map_from_archive<R: Read + Seek>(
    archive: &mut ZipArchive<R>,
) -> HashMap<String, AnkiMediaFile> {
    let mut media_map = HashMap::new();
    let mut media_manifest = String::new();

    let mut media_file = match archive.by_name("media") {
        Ok(file) => file,
        Err(_) => return media_map,
    };

    if media_file.read_to_string(&mut media_manifest).is_err() {
        return media_map;
    }
    drop(media_file);

    let manifest_json = match serde_json::from_str::<Value>(&media_manifest) {
        Ok(value) => value,
        Err(_) => return media_map,
    };

    let Some(manifest) = manifest_json.as_object() else {
        return media_map;
    };

    for (archive_key, file_name_value) in manifest {
        let Some(file_name) = file_name_value.as_str() else {
            continue;
        };
        let trimmed = file_name.trim();
        if trimmed.is_empty() {
            continue;
        }

        let mut zipped = match archive.by_name(archive_key) {
            Ok(file) => file,
            Err(_) => continue,
        };

        // Zip bomb protection
        const MAX_MEDIA_SIZE: u64 = 100 * 1024 * 1024;
        if zipped.size() > MAX_MEDIA_SIZE {
            continue;
        }

        let mut bytes = Vec::new();
        if zipped.read_to_end(&mut bytes).is_err() || bytes.is_empty() {
            continue;
        }
        drop(zipped);

        let media = AnkiMediaFile {
            file_name: trimmed.to_string(),
            mime_type: infer_media_mime(trimmed, &bytes),
            bytes: Arc::new(bytes),
        };

        for key in media_lookup_keys(trimmed) {
            media_map.insert(key, media.clone());
        }
    }

    media_map
}

fn parse_collection_from_archive<R: Read + Seek>(
    archive: &mut ZipArchive<R>,
    name: &str,
) -> Result<Vec<AnkiDeck>> {
    let mut collection_file = archive.by_name(name)
        .map_err(|e| IncrementumError::NotFound(format!("{} not found in archive: {}", name, e)))?;

    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let temp_db_path = std::env::temp_dir().join(format!("anki_collection_{}_{}.db", name.replace('.', "_"), nanos));
    let mut temp_file = File::create(&temp_db_path)
        .map_err(|e| IncrementumError::NotFound(format!("Cannot create temp file: {}", e)))?;

    // Zip bomb protection
    const MAX_COLLECTION_SIZE: u64 = 500 * 1024 * 1024;
    if collection_file.size() > MAX_COLLECTION_SIZE {
        return Err(IncrementumError::NotFound(format!(
            "Collection file too large ({} bytes)", collection_file.size()
        )));
    }

    let mut buffer = Vec::new();
    collection_file.read_to_end(&mut buffer)
        .map_err(|e| IncrementumError::NotFound(format!("Cannot read collection: {}", e)))?;
    temp_file.write_all(&buffer)
        .map_err(|e| IncrementumError::NotFound(format!("Cannot write temp file: {}", e)))?;
    drop(temp_file);

    // Open SQLite database
    let conn = Connection::open(&temp_db_path)
        .map_err(|e| IncrementumError::NotFound(format!("Cannot open database: {}", e)))?;

    // Extract models (note types)
    let mut models_stmt = conn.prepare("SELECT models FROM col")
        .map_err(|e| IncrementumError::NotFound(format!("Cannot prepare models query: {}", e)))?;
    let models_json: String = models_stmt.query_row([], |row| row.get(0))
        .map_err(|e| IncrementumError::NotFound(format!("Cannot get models: {}", e)))?;

    let mut decks_stmt = conn.prepare("SELECT decks FROM col")
        .map_err(|e| IncrementumError::NotFound(format!("Cannot prepare decks query: {}", e)))?;
    let decks_json: String = decks_stmt.query_row([], |row| row.get(0))
        .map_err(|e| IncrementumError::NotFound(format!("Cannot get decks: {}", e)))?;

    let decks_value: Value = serde_json::from_str(&decks_json)
        .map_err(|e| IncrementumError::NotFound(format!("Cannot parse decks JSON: {}", e)))?;

    let models_value: Value = serde_json::from_str(&models_json)
        .map_err(|e| IncrementumError::NotFound(format!("Cannot parse models JSON: {}", e)))?;

    let mut anki_decks = Vec::new();

    if let Some(decks_obj) = decks_value.as_object() {
        for (deck_id, deck_data) in decks_obj {
            if let Some(deck_obj) = deck_data.as_object() {
                let deck_name = deck_obj.get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown Deck");

                let id = deck_id.parse::<i64>()
                    .unwrap_or(0);

                let notes = extract_notes_from_deck(&conn, id, &models_value)?;

                let cards = extract_cards_from_deck(&conn, id)?;

                let revlog = extract_revlog_from_deck(&conn, id).unwrap_or_default();

                anki_decks.push(AnkiDeck {
                    id,
                    name: deck_name.to_string(),
                    notes,
                    cards,
                    revlog,
                });
            }
        }
    }

    let _ = std::fs::remove_file(&temp_db_path);

    Ok(anki_decks)
}

pub async fn parse_apkg_from_bytes(apkg_bytes: Vec<u8>) -> Result<Vec<AnkiDeck>> {
    let cursor = Cursor::new(apkg_bytes);
    let mut archive = ZipArchive::new(cursor)
        .map_err(|e| IncrementumError::NotFound(format!("Cannot unzip .apkg file: {}", e)))?;

    parse_apkg_from_archive(&mut archive)
}

async fn parse_apkg_from_bytes_with_media(
    apkg_bytes: Vec<u8>,
) -> Result<(Vec<AnkiDeck>, HashMap<String, AnkiMediaFile>)> {
    let cursor = Cursor::new(apkg_bytes);
    let mut archive = ZipArchive::new(cursor)
        .map_err(|e| IncrementumError::NotFound(format!("Cannot unzip .apkg file: {}", e)))?;
    parse_apkg_with_media_from_archive(&mut archive)
}

fn extract_notes_from_deck(
    conn: &Connection,
    deck_id: i64,
    models: &Value,
) -> Result<Vec<AnkiNote>> {
    let mut notes = Vec::new();

    let mut stmt = conn.prepare(
        "SELECT id, guid, mid, tags, flds, mod FROM notes WHERE id IN (SELECT DISTINCT nid FROM cards WHERE did = ?1)"
    )
        .map_err(|e| IncrementumError::NotFound(format!("Cannot prepare notes query: {}", e)))?;

    let note_rows = stmt.query_map([deck_id], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i64>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, i64>(5)?,
        ))
    })
    .map_err(|e| IncrementumError::NotFound(format!("Cannot query notes: {}", e)))?;

    for note_row in note_rows {
        let (id, guid, mid, tags_str, fields_str, timestamp) = note_row
            .map_err(|e| IncrementumError::NotFound(format!("Cannot parse note row: {}", e)))?;

        // Skip notes that contain the upgrade error message
        // This happens when .apkg files are exported from older Anki versions
        // and the notes weren't properly upgraded
        const UPGRADE_ERROR_MARKER: &str = "Please update to the latest Anki version";
        if fields_str.contains(UPGRADE_ERROR_MARKER) {
            eprintln!("[Anki Import] Skipping note {} with upgrade error marker", id);
            continue;
        }

        let model_name = models
            .get(mid.to_string())
            .and_then(|v| v.as_object())
            .and_then(|o| o.get("name"))
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown")
            .to_string();

        let tags: Vec<String> = tags_str
            .split(' ')
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .collect();

        // Parse fields (separated by \x1f)
        let field_values: Vec<String> = fields_str
            .split('\x1f')
            .map(|s| s.to_string())
            .collect();

        let field_names = get_model_field_names(models, mid);

        let fields: Vec<AnkiField> = field_names
            .into_iter()
            .enumerate()
            .map(|(idx, name)| AnkiField {
                name,
                value: field_values.get(idx).cloned().unwrap_or_default(),
            })
            .collect();

        notes.push(AnkiNote {
            id,
            guid,
            mid,
            model_name,
            tags,
            fields,
            timestamp,
        });
    }

    Ok(notes)
}

fn extract_cards_from_deck(conn: &Connection, deck_id: i64) -> Result<Vec<AnkiCard>> {
    let mut cards = Vec::new();

    let mut stmt = conn.prepare("SELECT id, nid, ord, ivl, factor, due, data, reps, lapses FROM cards WHERE did = ?1")
        .map_err(|e| IncrementumError::NotFound(format!("Cannot prepare cards query: {}", e)))?;

    let card_rows = stmt.query_map([deck_id], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, i64>(2)?,
            row.get::<_, i32>(3)?,
            row.get::<_, i32>(4)?,
            row.get::<_, i32>(5)?,
            row.get::<_, Option<String>>(6)?,
            row.get::<_, i32>(7)?,
            row.get::<_, i32>(8)?,
        ))
    })
    .map_err(|e| IncrementumError::NotFound(format!("Cannot query cards: {}", e)))?;

    for card_row in card_rows {
        let (id, note_id, ord, interval, factor, due, data, reps, lapses) = card_row
            .map_err(|e| IncrementumError::NotFound(format!("Cannot parse card row: {}", e)))?;

        cards.push(AnkiCard {
            id,
            note_id,
            ord,
            interval,
            ease: factor as f64 / 1000.0,
            due,
            data,
            reps,
            lapses,
        });
    }

    Ok(cards)
}

fn get_model_field_names(models: &Value, model_id: i64) -> Vec<String> {
    models
        .get(model_id.to_string())
        .and_then(|v| v.as_object())
        .and_then(|o| o.get("flds"))
        .and_then(|v| v.as_array())
        .map(|fields| {
            fields.iter()
                .filter_map(|f| f.as_object())
                .filter_map(|o| o.get("name"))
                .filter_map(|v| v.as_str())
                .map(|s| s.to_string())
                .collect()
        })
        .unwrap_or_default()
}

fn extract_revlog_from_deck(conn: &Connection, deck_id: i64) -> Result<Vec<AnkiRevLogEntry>> {
    let mut revlog = Vec::new();

    let sql = "SELECT id, cid, ease, ivl, last_ivl, factor, time, type \
              FROM revlog WHERE cid IN (SELECT id FROM cards WHERE did = ?1) \
              ORDER BY id";
    let mut stmt = conn.prepare(sql)
        .map_err(|e| IncrementumError::NotFound(format!("Cannot prepare revlog query: {}", e)))?;

    let rows = stmt.query_map([deck_id], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, i32>(2)?,
            row.get::<_, i32>(3)?,
            row.get::<_, i32>(4)?,
            row.get::<_, i32>(5)?,
            row.get::<_, i32>(6)?,
            row.get::<_, i32>(7)?,
        ))
    })
    .map_err(|e| IncrementumError::NotFound(format!("Cannot query revlog: {}", e)))?;

    for rev_row in rows {
        let (id, cid, ease, ivl, last_ivl, factor, time_ms, rev_type) = rev_row
            .map_err(|e| IncrementumError::NotFound(format!("Cannot parse revlog row: {}", e)))?;

        // The revlog id is a millisecond timestamp
        revlog.push(AnkiRevLogEntry {
            id,
            cid,
            ease,
            ivl,
            last_ivl,
            factor,
            time_ms,
            rev_type,
            timestamp: id,
        });
    }

    Ok(revlog)
}

fn normalize_cloze_text(text: &str) -> String {
    text.replace("{{c", "[[c").replace("}}", "]]")
}

fn find_question_field(note: &AnkiNote) -> Option<&AnkiField> {
    note.fields.iter().find(|field| {
        let name = field.name.to_lowercase();
        name.contains("front") || name.contains("question") || name.contains("text")
    })
}

fn find_answer_field(note: &AnkiNote) -> Option<&AnkiField> {
    note.fields.iter().find(|field| {
        let name = field.name.to_lowercase();
        name.contains("back") || name.contains("answer")
    })
}

fn find_cloze_field(note: &AnkiNote) -> Option<&AnkiField> {
    note.fields.iter().find(|field| field.value.contains("{{c"))
}

async fn build_learning_item(
    note: &AnkiNote,
    card: &AnkiCard,
    document_id: Option<&str>,
    deck_name: &str,
    repo: &Repository,
    media_map: &HashMap<String, AnkiMediaFile>,
) -> Option<LearningItem> {
    let cloze_field = find_cloze_field(note);
    let mut image_asset_ids = Vec::new();
    let (item_type, question, answer, cloze_text) = if let Some(field) = cloze_field {
        let cloze = normalize_cloze_text(&field.value);
        let rendered = rewrite_field_with_media(&cloze, repo, media_map, &mut image_asset_ids).await;
        let question = fallback_question_text(rendered.trim(), &image_asset_ids);
        (ItemType::Cloze, question.clone(), None, Some(question))
    } else {
        let question_field = find_question_field(note)
            .or_else(|| note.fields.first());
        let answer_field = find_answer_field(note)
            .or_else(|| note.fields.get(1));

        let raw_question = question_field?.value.trim().to_string();
        let rendered_question = rewrite_field_with_media(&raw_question, repo, media_map, &mut image_asset_ids).await;
        let question = fallback_question_text(rendered_question.trim(), &image_asset_ids);

        let answer = answer_field
            .map(|field| field.value.trim().to_string());
        let answer = if let Some(raw_answer) = answer {
            let rendered_answer = rewrite_field_with_media(&raw_answer, repo, media_map, &mut image_asset_ids).await;
            if rendered_answer.trim().is_empty() {
                None
            } else {
                Some(rendered_answer.trim().to_string())
            }
        } else {
            None
        };

        (ItemType::Flashcard, question, answer, None)
    };

    if question.trim().is_empty() {
        return None;
    }

    let mut item = LearningItem::new(item_type, question);
    if let Some(doc_id) = document_id {
        item.document_id = Some(doc_id.to_string());
    }
    item.answer = answer;
    item.cloze_text = cloze_text;
    item.interval = card.interval as f64;
    item.ease_factor = card.ease;
    item.review_count = card.reps;
    item.lapses = card.lapses;

    if let Some(ref card_data) = card.data {
        if let Ok(json) = serde_json::from_str::<Value>(card_data) {
            let stability = json.get("s").and_then(|v| v.as_f64());
            let difficulty = json.get("d").and_then(|v| v.as_f64());
            if let (Some(s), Some(d)) = (stability, difficulty) {
                item.memory_state = Some(MemoryState { stability: s, difficulty: d });
                item.algorithm_type = "fsrs".to_string();
            }
        }
    }

    if card.interval > 0 {
        item.due_date = Utc::now() + Duration::days(card.interval as i64);
        item.state = ItemState::Review;
    }

    let mut tags = note.tags.clone();
    tags.push("anki-import".to_string());
    tags.push(note.model_name.clone());
    tags.push(deck_name.to_string());
    item.tags = tags;
    item.image_asset_ids = image_asset_ids;

    Some(item)
}

fn fallback_question_text(text: &str, image_asset_ids: &[String]) -> String {
    if !text.is_empty() {
        return text.to_string();
    }
    if !image_asset_ids.is_empty() {
        return "Image card".to_string();
    }
    String::new()
}

async fn rewrite_field_with_media(
    value: &str,
    repo: &Repository,
    media_map: &HashMap<String, AnkiMediaFile>,
    image_asset_ids: &mut Vec<String>,
) -> String {
    let img_regex = Regex::new(r#"(?is)<img[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>"#).expect("valid img regex");
    let mut transformed = String::with_capacity(value.len());
    let mut last = 0usize;

    for capture in img_regex.captures_iter(value) {
        let Some(full) = capture.get(0) else {
            continue;
        };
        let src = capture.get(1).map(|m| m.as_str()).unwrap_or_default();
        transformed.push_str(&value[last..full.start()]);
        if let Some(media) = find_media_entry(media_map, src) {
            if media.mime_type.starts_with("image/") {
                if let Ok(Some(asset_id)) = persist_media_image_asset(repo, media).await {
                    if !image_asset_ids.iter().any(|id| id == &asset_id) {
                        image_asset_ids.push(asset_id);
                    }
                } else {
                    transformed.push_str(&replace_src_value(full.as_str(), &media_data_url(media)));
                }
            } else {
                transformed.push_str(full.as_str());
            }
        } else {
            transformed.push_str(full.as_str());
        }
        last = full.end();
    }
    transformed.push_str(&value[last..]);

    let sound_regex = Regex::new(r#"(?i)\[sound:([^\]]+)\]"#).expect("valid sound regex");
    let with_audio = sound_regex
        .replace_all(&transformed, |caps: &regex::Captures| {
            let src = caps.get(1).map(|m| m.as_str()).unwrap_or_default();
            if let Some(media) = find_media_entry(media_map, src) {
                format!(
                    "<audio controls preload=\"none\" src=\"{}\"></audio>",
                    media_data_url(media)
                )
            } else {
                caps.get(0).map(|m| m.as_str()).unwrap_or_default().to_string()
            }
        })
        .to_string();

    rewrite_media_src_attributes(&with_audio, media_map)
}

fn rewrite_media_src_attributes(
    value: &str,
    media_map: &HashMap<String, AnkiMediaFile>,
) -> String {
    let src_regex = Regex::new(r#"(?is)\bsrc\s*=\s*["']([^"']+)["']"#).expect("valid src regex");
    src_regex
        .replace_all(value, |caps: &regex::Captures| {
            let src = caps.get(1).map(|m| m.as_str()).unwrap_or_default();
            if let Some(media) = find_media_entry(media_map, src) {
                format!("src=\"{}\"", media_data_url(media))
            } else {
                caps.get(0).map(|m| m.as_str()).unwrap_or_default().to_string()
            }
        })
        .to_string()
}

fn replace_src_value(tag: &str, new_src: &str) -> String {
    let src_regex = Regex::new(r#"(?is)\bsrc\s*=\s*["'][^"']+["']"#).expect("valid src replace regex");
    src_regex
        .replace(tag, format!("src=\"{}\"", new_src))
        .to_string()
}

async fn persist_media_image_asset(repo: &Repository, media: &AnkiMediaFile) -> Result<Option<String>> {
    let guessed = match image::guess_format(media.bytes.as_slice()) {
        Ok(format) => format,
        Err(_) => return Ok(None),
    };
    let mime_type = normalize_image_mime(&media.mime_type, guessed)?;
    let dimensions = image::load_from_memory(media.bytes.as_slice())
        .map_err(|e| IncrementumError::InvalidInput(format!("Unable to decode image dimensions: {}", e)))?
        .dimensions();
    let sha256 = hex_sha256(media.bytes.as_slice());
    let asset = repo
        .create_or_get_image_asset(
            &mime_type,
            Some(&media.file_name),
            media.bytes.as_slice(),
            &sha256,
            i32::try_from(dimensions.0).ok(),
            i32::try_from(dimensions.1).ok(),
        )
        .await?;
    Ok(Some(asset.id))
}

fn normalize_image_mime(existing: &str, guessed: image::ImageFormat) -> Result<String> {
    if existing.starts_with("image/") {
        return Ok(existing.to_string());
    }
    let mime = match guessed {
        image::ImageFormat::Png => "image/png",
        image::ImageFormat::Jpeg => "image/jpeg",
        image::ImageFormat::Gif => "image/gif",
        image::ImageFormat::WebP => "image/webp",
        _ => return Err(IncrementumError::InvalidInput("Unsupported image format".to_string())),
    };
    Ok(mime.to_string())
}

fn media_data_url(media: &AnkiMediaFile) -> String {
    let encoded = general_purpose::STANDARD.encode(media.bytes.as_slice());
    format!("data:{};base64,{}", media.mime_type, encoded)
}

fn find_media_entry<'a>(
    media_map: &'a HashMap<String, AnkiMediaFile>,
    reference: &str,
) -> Option<&'a AnkiMediaFile> {
    for key in media_lookup_keys(reference) {
        if let Some(media) = media_map.get(&key) {
            return Some(media);
        }
    }
    None
}

fn media_lookup_keys(input: &str) -> Vec<String> {
    let mut keys = Vec::new();
    let decoded = urlencoding::decode(input).map(|cow| cow.into_owned()).unwrap_or_else(|_| input.to_string());
    let without_fragment = decoded.split('#').next().unwrap_or(decoded.as_str());
    let without_query = without_fragment.split('?').next().unwrap_or(without_fragment);
    let sanitized = without_query.trim().trim_start_matches("./").trim_start_matches('/');
    if sanitized.is_empty() {
        return keys;
    }

    keys.push(sanitized.to_string());
    keys.push(sanitized.to_lowercase());
    if let Some(base) = Path::new(sanitized).file_name().and_then(|s| s.to_str()) {
        keys.push(base.to_string());
        keys.push(base.to_lowercase());
    }
    keys.sort();
    keys.dedup();
    keys
}

fn infer_media_mime(file_name: &str, bytes: &[u8]) -> String {
    let ext = Path::new(file_name)
        .extension()
        .and_then(|v| v.to_str())
        .map(|v| v.to_lowercase())
        .unwrap_or_default();
    match ext.as_str() {
        "png" => "image/png".to_string(),
        "jpg" | "jpeg" => "image/jpeg".to_string(),
        "gif" => "image/gif".to_string(),
        "webp" => "image/webp".to_string(),
        "svg" => "image/svg+xml".to_string(),
        "mp3" => "audio/mpeg".to_string(),
        "wav" => "audio/wav".to_string(),
        "ogg" => "audio/ogg".to_string(),
        "m4a" => "audio/mp4".to_string(),
        "mp4" => "video/mp4".to_string(),
        "webm" => "video/webm".to_string(),
        _ => {
            if let Ok(format) = image::guess_format(bytes) {
                match format {
                    image::ImageFormat::Png => "image/png".to_string(),
                    image::ImageFormat::Jpeg => "image/jpeg".to_string(),
                    image::ImageFormat::Gif => "image/gif".to_string(),
                    image::ImageFormat::WebP => "image/webp".to_string(),
                    _ => "application/octet-stream".to_string(),
                }
            } else {
                "application/octet-stream".to_string()
            }
        }
    }
}

fn hex_sha256(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

#[tauri::command]
pub async fn import_anki_package(apkg_path: String) -> Result<String> {
    let decks = parse_apkg(&apkg_path).await?;

    let result = serde_json::to_value(&decks)
        .map_err(|e| IncrementumError::NotFound(format!("Cannot serialize decks: {}", e)))?;

    Ok(result.to_string())
}

#[tauri::command]
pub async fn import_anki_package_to_learning_items(
    apkg_path: String,
    repo: State<'_, Repository>,
) -> Result<Vec<LearningItem>> {
    let file = File::open(&apkg_path)
        .map_err(|e| IncrementumError::NotFound(format!("Cannot open .apkg file: {}", e)))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| IncrementumError::NotFound(format!("Cannot unzip .apkg file: {}", e)))?;
    let (decks, media_map) = parse_apkg_with_media_from_archive(&mut archive)?;
    import_decks_to_learning_items(decks, media_map, &repo).await
}

#[tauri::command]
pub async fn import_anki_package_bytes_to_learning_items(
    apkg_bytes: Vec<u8>,
    repo: State<'_, Repository>,
) -> Result<Vec<LearningItem>> {
    let (decks, media_map) = parse_apkg_from_bytes_with_media(apkg_bytes).await?;
    import_decks_to_learning_items(decks, media_map, &repo).await
}

/// Shared import logic for both file and bytes imports
async fn import_decks_to_learning_items(
    decks: Vec<AnkiDeck>,
    media_map: HashMap<String, AnkiMediaFile>,
    repo: &Repository,
) -> Result<Vec<LearningItem>> {
    let mut created_items = Vec::new();
    let mut imported_note_guids = std::collections::HashSet::new();
    let mut skipped_count = 0usize;

    for deck in &decks {
        eprintln!("DEBUG: Processing deck '{}' with {} notes, {} cards, {} revlog entries",
                  deck.name, deck.notes.len(), deck.cards.len(), deck.revlog.len());
    }

    // Since decks are processed sequentially, we can build per-deck
    for deck in decks {
        // Map card_id -> revlog entries for this deck
        let mut card_revlog: std::collections::HashMap<i64, Vec<AnkiRevLogEntry>> = std::collections::HashMap::new();
        for entry in &deck.revlog {
            card_revlog.entry(entry.cid).or_default().push(entry.clone());
        }

        for card in &deck.cards {
            if let Some(note) = deck.notes.iter().find(|note| note.id == card.note_id).cloned() {
                // Skip if we've already imported this note (by GUID)
                if !imported_note_guids.insert(note.guid.clone()) {
                    skipped_count += 1;
                    eprintln!("DEBUG: Skipping duplicate note GUID: {}", note.guid);
                    continue;
                }
                if let Some(item) = build_learning_item(
                    &note,
                    card,
                    None,
                    &deck.name,
                    &repo,
                    &media_map,
                ).await {
                    let created = repo.create_learning_item(&item).await?;

                    // Store revlog entries for this card
                    if let Some(revlog_entries) = card_revlog.get(&card.id) {
                        if let Err(e) = repo.batch_insert_review_log(revlog_entries, &created.id).await {
                            eprintln!("DEBUG: Failed to import revlog for card {}: {}", card.id, e);
                        }
                    }

                    created_items.push(created);
                }
            }
        }
    }

    eprintln!("DEBUG: Import complete - created {} items, skipped {} duplicates",
              created_items.len(), skipped_count);

    Ok(created_items)
}

#[tauri::command]
pub fn validate_anki_package(path: String) -> Result<bool> {
    let file = File::open(&path)
        .map_err(|e| IncrementumError::NotFound(format!("Cannot open file: {}", e)))?;

    let archive = ZipArchive::new(file)
        .map_err(|e| IncrementumError::NotFound(format!("Not a valid .apkg file: {}", e)))?;

    let has_collection = archive.file_names().any(|name| name == "collection.anki2" || name == "collection.anki21");

    if !has_collection {
        return Err(IncrementumError::NotFound("collection.anki2 not found in package".to_string()));
    }

    Ok(true)
}

/// Export learning items matching a deck tag as an .apkg file
#[tauri::command]
pub async fn export_deck_as_apkg(
    deck_name: String,
    output_path: String,
    repo: State<'_, Repository>,
) -> Result<String> {
    let all_items = repo.get_all_learning_items().await?;
    let deck_items: Vec<_> = all_items
        .into_iter()
        .filter(|item| item.tags.iter().any(|t| t == &deck_name))
        .collect();

    if deck_items.is_empty() {
        return Err(IncrementumError::NotFound(format!(
            "No cards found for deck '{}'",
            deck_name
        )));
    }

    let item_ids: Vec<String> = deck_items.iter().map(|i| i.id.clone()).collect();
    let review_log = repo.get_review_log_for_items(&item_ids).await?;

    // Group review log entries by item_id
    let mut revlog_by_item: std::collections::HashMap<String, Vec<&ReviewLogRow>> =
        std::collections::HashMap::new();
    for entry in &review_log {
        revlog_by_item.entry(entry.item_id.clone()).or_default().push(entry);
    }

    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let temp_db_path = std::env::temp_dir().join(format!("anki_export_{}.db", nanos));

    let mut media_entries: Vec<(String, Vec<u8>)> = Vec::new();
    let mut asset_id_to_media_idx: HashMap<String, usize> = HashMap::new();

    {
        let conn = Connection::open(&temp_db_path)
            .map_err(|e| IncrementumError::Internal(format!("Cannot create export database: {}", e)))?;

        // Create Anki tables (canonical schema from anki/rslib/src/storage/schema11.sql)
        conn.execute_batch(
            r#"
            CREATE TABLE notes (
                id integer PRIMARY KEY,
                guid text NOT NULL,
                mid integer NOT NULL,
                mod integer NOT NULL,
                usn integer NOT NULL,
                tags text NOT NULL,
                flds text NOT NULL,
                sfld integer NOT NULL,
                csum integer NOT NULL,
                flags integer NOT NULL,
                data text NOT NULL
            );
            CREATE TABLE cards (
                id integer PRIMARY KEY,
                nid integer NOT NULL,
                did integer NOT NULL,
                ord integer NOT NULL,
                mod integer NOT NULL,
                usn integer NOT NULL,
                type integer NOT NULL,
                queue integer NOT NULL,
                due integer NOT NULL,
                ivl integer NOT NULL,
                factor integer NOT NULL,
                reps integer NOT NULL,
                lapses integer NOT NULL,
                left integer NOT NULL,
                odue integer NOT NULL,
                odid integer NOT NULL,
                flags integer NOT NULL,
                data text NOT NULL
            );
            CREATE TABLE revlog (
                id integer PRIMARY KEY,
                cid integer NOT NULL,
                usn integer NOT NULL,
                ease integer NOT NULL,
                ivl integer NOT NULL,
                lastIvl integer NOT NULL,
                factor integer NOT NULL,
                time integer NOT NULL,
                type integer NOT NULL
            );
            CREATE TABLE graves (
                usn integer NOT NULL,
                oid integer NOT NULL,
                type integer NOT NULL
            );
            CREATE TABLE col (
                id integer PRIMARY KEY,
                crt integer NOT NULL,
                mod integer NOT NULL,
                scm integer NOT NULL,
                ver integer NOT NULL,
                dty integer NOT NULL,
                usn integer NOT NULL,
                ls integer NOT NULL,
                conf text NOT NULL,
                models text NOT NULL,
                decks text NOT NULL,
                dconf text NOT NULL,
                tags text NOT NULL
            );
            CREATE INDEX ix_notes_usn ON notes (usn);
            CREATE INDEX ix_cards_usn ON cards (usn);
            CREATE INDEX ix_revlog_usn ON revlog (usn);
            CREATE INDEX ix_cards_nid ON cards (nid);
            CREATE INDEX ix_cards_sched ON cards (did, queue, due);
            CREATE INDEX ix_revlog_cid ON revlog (cid);
            CREATE INDEX ix_notes_csum ON notes (csum);
            "#,
        )
        .map_err(|e| IncrementumError::Internal(format!("Cannot create tables: {}", e)))?;

        let now_ts = Utc::now().timestamp();

        let basic_model_id: i64 = 1;
        let cloze_model_id: i64 = 2;
        let deck_id: i64 = 1;
        let models_json = serde_json::json!({
            basic_model_id.to_string(): {
                "id": basic_model_id,
                "name": "Incrementum Basic",
                "type": 0,
                "mod": now_ts,
                "usn": -1,
                "sortf": 0,
                "did": deck_id,
                "tmpls": [{
                    "name": "Card 1",
                    "ord": 0,
                    "qfmt": "{{Front}}",
                    "afmt": "{{FrontSide}}<hr id=answer>{{Back}}",
                    "bqfmt": "",
                    "bafmt": "",
                    "bfont": "Arial",
                    "bsize": 20,
                }],
                "flds": [
                    {"name": "Front", "ord": 0, "sticky": false, "rtl": false, "font": "Arial", "size": 20},
                    {"name": "Back", "ord": 1, "sticky": false, "rtl": false, "font": "Arial", "size": 20},
                ],
                "css": ".card { font-family: arial; font-size: 20px; text-align: left; color: #2c2c2c; background: #ffffff; }",
                "latexPre": "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0pt}\n\\begin{document}",
                "latexPost": "\\end{document}",
                "req": [[0, "any", [0, 1]]],
            },
            cloze_model_id.to_string(): {
                "id": cloze_model_id,
                "name": "Incrementum Cloze",
                "type": 1,
                "mod": now_ts,
                "usn": -1,
                "sortf": 0,
                "did": deck_id,
                "tmpls": [{
                    "name": "Cloze",
                    "ord": 0,
                    "qfmt": "{{cloze:Text}}",
                    "afmt": "{{cloze:Text}}<br>\n{{Back}}",
                    "bqfmt": "",
                    "bafmt": "",
                    "bfont": "Arial",
                    "bsize": 20,
                }],
                "flds": [
                    {"name": "Text", "ord": 0, "sticky": false, "rtl": false, "font": "Arial", "size": 20},
                    {"name": "Back", "ord": 1, "sticky": false, "rtl": false, "font": "Arial", "size": 20},
                ],
                "css": ".card { font-family: arial; font-size: 20px; text-align: left; color: #2c2c2c; background: #ffffff; }",
                "latexPre": "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0pt}\n\\begin{document}",
                "latexPost": "\\end{document}",
                "req": [[0, "any", [0]]],
            }
        }).to_string();

        let decks_json = serde_json::json!({
            deck_id.to_string(): {
                "id": deck_id,
                "name": &deck_name,
                "mod": now_ts,
                "usn": -1,
                "lr": now_ts,
                "desc": "",
                "dyn": 0,
                "conf": 1,
                "extendNew": 0,
                "extendRev": 0,
                "lrnToday": [0, 0],
                "newToday": [0, 0],
                "revToday": [0, 0],
                "timeToday": [0, 0],
                "collapsed": false,
            }
        }).to_string();

        let conf_json = serde_json::json!({
            "nextPos": deck_items.len() as i64 + 1,
            "estTimes": true,
            "activeDecks": [deck_id],
            "sortType": "noteFld",
            "timeLim": 0,
            "sortBackwards": false,
            "addToCur": true,
            "curDeck": deck_id,
            "newSpread": 0,
            "dueCounts": true,
        }).to_string();

        let dconf_json = serde_json::json!({
            "1": {
                "id": 1,
                "name": "Default",
                "mod": now_ts,
                "usn": -1,
                "maxTaken": 60,
                "autoplay": true,
                "timer": 0,
                "new": {"perDay": 20, "ints": [1, 10], "initialFactor": 2500, "bury": true, "order": 1},
                "rev": {"perDay": 200, "ease4": 1.3, "ivlFct": 1, "maxIvl": 36500, "bury": true, "hardFactor": 1.2},
                "lapse": {"mins": [10], "leechFails": 8, "leechAction": 0, "mult": 0},
                "replayq": true,
            }
        }).to_string();

        // Insert col metadata
        conn.execute(
            "INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags) \
             VALUES (1, ?1, ?2, ?3, 11, 0, 0, 0, ?4, ?5, ?6, ?7, '{}')",
            rusqlite::params![now_ts, now_ts, now_ts, &conf_json, &models_json, &decks_json, &dconf_json],
        )
        .map_err(|e| IncrementumError::Internal(format!("Cannot insert col: {}", e)))?;

        // Insert notes and cards
        let mut card_counter: i64 = 1;
        for item in &deck_items {
            let note_id = card_counter * 10000;
            let card_id = note_id + 1;
            let guid = uuid::Uuid::new_v4().to_string().replace("-", "")[..10].to_string();

            let tags_str = item
                .tags
                .iter()
                .filter(|t| !t.starts_with("anki-import"))
                .map(|t| format!(" {}", t))
                .collect::<Vec<_>>()
                .join("");

            // Determine note model and fields based on card type
            let (model_id, flds) = match item.item_type {
                ItemType::Cloze => {
                    if let Some(ref cloze_text) = item.cloze_text {
                        if let Some(ref ranges) = item.cloze_ranges {
                            if let Some(anki_cloze) = cloze_text_to_anki(cloze_text, ranges) {
                                let back = item.answer.as_deref().unwrap_or("")
                                    .replace('\x1f', " ").replace('\\', "\\\\");
                                (cloze_model_id, format!("{}\x1f{}", anki_cloze, back))
                            } else {
                                let front = item.question.replace('\x1f', " ").replace('\\', "\\\\");
                                let back = item.answer.as_deref().unwrap_or("")
                                    .replace('\x1f', " ").replace('\\', "\\\\");
                                (basic_model_id, format!("{}\x1f{}", front, back))
                            }
                        } else {
                            let front = item.question.replace('\x1f', " ").replace('\\', "\\\\");
                            let back = item.answer.as_deref().unwrap_or("")
                                .replace('\x1f', " ").replace('\\', "\\\\");
                            (basic_model_id, format!("{}\x1f{}", front, back))
                        }
                    } else {
                        let front = item.question.replace('\x1f', " ").replace('\\', "\\\\");
                        let back = item.answer.as_deref().unwrap_or("")
                            .replace('\x1f', " ").replace('\\', "\\\\");
                        (basic_model_id, format!("{}\x1f{}", front, back))
                    }
                }
                _ => {
                    let front = item.question.replace('\x1f', " ").replace('\\', "\\\\");
                    let back = item.answer.as_deref().unwrap_or("")
                        .replace('\x1f', " ").replace('\\', "\\\\");
                    (basic_model_id, format!("{}\x1f{}", front, back))
                }
            };

            // Collect image assets for this card and build <img> HTML
            let mut img_html = String::new();
            for asset_id in &item.image_asset_ids {
                if !asset_id_to_media_idx.contains_key(asset_id) {
                    if let Ok(Some(asset)) = repo.get_image_asset(asset_id).await {
                        let ext = match asset.mime_type.as_str() {
                            "image/png" => "png",
                            "image/jpeg" | "image/jpg" => "jpg",
                            "image/gif" => "gif",
                            "image/webp" => "webp",
                            "image/svg+xml" => "svg",
                            _ => "png",
                        };
                        let filename = format!("{}.{}", asset_id, ext);
                        let idx = media_entries.len();
                        asset_id_to_media_idx.insert(asset_id.clone(), idx);
                        media_entries.push((filename, asset.content.clone()));
                    }
                }
                if let Some(&idx) = asset_id_to_media_idx.get(asset_id) {
                    img_html.push_str(&format!("<br><img src=\"{}\">", idx));
                }
            }

            // Append images to the back field (before the \x1f separator)
            let flds = if img_html.is_empty() {
                flds
            } else if let Some(pos) = flds.rfind('\x1f') {
                format!("{}{}{}", &flds[..pos], img_html, &flds[pos..])
            } else {
                format!("{}{}", flds, img_html)
            };

            conn.execute(
                "INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data) \
                 VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, '', 0, 0, '')",
                rusqlite::params![note_id, &guid, model_id, now_ts, &tags_str, &flds],
            )
            .map_err(|e| IncrementumError::Internal(format!("Cannot insert note: {}", e)))?;

            let card_data = if let Some(ref ms) = item.memory_state {
                serde_json::json!({"d": ms.difficulty, "s": ms.stability, "v": "3"}).to_string()
            } else {
                String::new()
            };

            let interval = item.interval.round() as i32;
            let factor = (item.ease_factor * 1000.0).round() as i32;
            let due = if interval > 0 {
                // Convert due_date to days since epoch
                let due_date = item.due_date;
                let epoch = chrono::NaiveDate::from_ymd_opt(1970, 1, 1).unwrap();
                let due_naive = due_date.date_naive();
                (due_naive - epoch).num_days() as i32
            } else {
                0
            };

            // Determine card type: 0=new, 1=learning, 2=review, 3=relearning
            let card_type = match item.state {
                ItemState::New => 0,
                ItemState::Learning => 1,
                ItemState::Review => 2,
                ItemState::Relearning => 3,
            };

            conn.execute(
                "INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data) \
                 VALUES (?1, ?2, ?3, 0, ?4, 0, ?5, 0, ?6, ?7, ?8, ?9, ?10, 0, 0, 0, 0, ?11)",
                rusqlite::params![
                    card_id,
                    note_id,
                    deck_id,
                    now_ts,
                    card_type,
                    due,
                    interval,
                    factor,
                    item.review_count,
                    item.lapses,
                    &card_data,
                ],
            )
            .map_err(|e| IncrementumError::Internal(format!("Cannot insert card: {}", e)))?;

            // Insert revlog entries for this item
            if let Some(entries) = revlog_by_item.get(&item.id) {
                for entry in entries {
                    // Use the original Anki revlog id if available
                    let revlog_id = entry.anki_revlog_id.unwrap_or_else(|| {
                        // Generate a unique timestamp-based id
                        Utc::now().timestamp_millis()
                    });
                    let ivl = entry.interval_days.round() as i32;
                    let last_ivl = entry.last_interval_days.map(|l| l.round() as i32).unwrap_or(0);
                    let factor = (entry.ease_factor * 1000.0).round() as i32;

                    conn.execute(
                        "INSERT OR IGNORE INTO revlog (id, cid, usn, ease, ivl, lastIvl, factor, time, type) \
                         VALUES (?1, ?2, 0, ?3, ?4, ?5, ?6, ?7, ?8)",
                        rusqlite::params![
                            revlog_id,
                            card_id,
                            entry.rating,
                            ivl,
                            last_ivl,
                            factor,
                            entry.time_ms,
                            entry.review_type,
                        ],
                    )
                    .map_err(|e| IncrementumError::Internal(format!("Cannot insert revlog: {}", e)))?;
                }
            }

            card_counter += 1;
        }
    }

    // Read the database file and create the .apkg ZIP
    let db_bytes = std::fs::read(&temp_db_path)
        .map_err(|e| IncrementumError::Internal(format!("Cannot read export database: {}", e)))?;
    let _ = std::fs::remove_file(&temp_db_path);

    let output_file = File::create(&output_path)
        .map_err(|e| IncrementumError::Internal(format!("Cannot create output file: {}", e)))?;
    let mut zip = zip::ZipWriter::new(output_file);
    let options = zip::write::FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    zip.start_file("collection.anki2", options)
        .map_err(|e| IncrementumError::Internal(format!("Cannot write collection: {}", e)))?;
    zip.write_all(&db_bytes)
        .map_err(|e| IncrementumError::Internal(format!("Cannot write collection data: {}", e)))?;

    let media_json = if media_entries.is_empty() {
        "{}".to_string()
    } else {
        let map: std::collections::HashMap<String, &str> = media_entries
            .iter()
            .enumerate()
            .map(|(i, (name, _))| (i.to_string(), name.as_str()))
            .collect();
        serde_json::to_string(&map).unwrap_or_else(|_| "{}".to_string())
    };
    zip.start_file("media", options)
        .map_err(|e| IncrementumError::Internal(format!("Cannot write media: {}", e)))?;
    zip.write_all(media_json.as_bytes())
        .map_err(|e| IncrementumError::Internal(format!("Cannot write media data: {}", e)))?;

    for (idx, (_name, bytes)) in media_entries.iter().enumerate() {
        zip.start_file(idx.to_string(), options)
            .map_err(|e| IncrementumError::Internal(format!("Cannot write media file {}: {}", idx, e)))?;
        zip.write_all(bytes)
            .map_err(|e| IncrementumError::Internal(format!("Cannot write media file data {}: {}", idx, e)))?;
    }

    zip.finish()
        .map_err(|e| IncrementumError::Internal(format!("Cannot finalize zip: {}", e)))?;

    Ok(format!("Exported {} cards to {}", deck_items.len(), output_path))
}

/// Export learning items matching a deck tag as a tab-separated text file for Anki import
#[tauri::command]
pub async fn export_deck_as_csv(
    deck_name: String,
    output_path: String,
    repo: State<'_, Repository>,
) -> Result<String> {
    let all_items = repo.get_all_learning_items().await?;
    let deck_items: Vec<_> = all_items
        .into_iter()
        .filter(|item| item.tags.iter().any(|t| t == &deck_name))
        .collect();

    if deck_items.is_empty() {
        return Err(IncrementumError::NotFound(format!(
            "No cards found for deck '{}'",
            deck_name
        )));
    }

    let mut lines = Vec::with_capacity(deck_items.len());
    for item in &deck_items {
        let front = match item.item_type {
            ItemType::Cloze => {
                if let (Some(ref cloze_text), Some(ref ranges)) =
                    (&item.cloze_text, &item.cloze_ranges)
                {
                    cloze_text_to_anki(cloze_text, ranges)
                        .unwrap_or_else(|| item.question.clone())
                } else {
                    item.question.clone()
                }
            }
            _ => item.question.clone(),
        };
        let back = item.answer.as_deref().unwrap_or("").to_string();
        let tags = item.tags.join(" ");
        // Tab-separated: Front\tBack\tTags
        lines.push(format!(
            "{}\t{}\t{}",
            front.replace('\t', " ").replace('\n', "<br>"),
            back.replace('\t', " ").replace('\n', "<br>"),
            tags.replace('\t', " "),
        ));
    }

    let content = lines.join("\n");
    std::fs::write(&output_path, content)
        .map_err(|e| IncrementumError::Internal(format!("Cannot write CSV file: {}", e)))?;

    Ok(format!("Exported {} cards to {}", deck_items.len(), output_path))
}

/// Export all learning items grouped by deck tags as a single .apkg with multiple Anki decks
#[tauri::command]
pub async fn export_all_decks_as_apkg(
    output_path: String,
    repo: State<'_, Repository>,
) -> Result<String> {
    let all_items = repo.get_all_learning_items().await?;
    if all_items.is_empty() {
        return Err(IncrementumError::NotFound("No learning items found".to_string()));
    }

    // Group items by their first non-system tag (simple heuristic for deck membership)
    let mut tag_groups: HashMap<String, Vec<&LearningItem>> = HashMap::new();
    for item in &all_items {
        for tag in &item.tags {
            if tag.starts_with("anki-import") || tag.starts_with("incrementum-") {
                continue;
            }
            tag_groups.entry(tag.clone()).or_default().push(item);
        }
    }
    // Also put items with no usable tag into a default group
    let untagged: Vec<&LearningItem> = all_items
        .iter()
        .filter(|item| {
            item.tags
                .iter()
                .all(|t| t.starts_with("anki-import") || t.starts_with("incrementum-"))
        })
        .collect();
    if !untagged.is_empty() {
        tag_groups.insert("Uncategorized".to_string(), untagged);
    }

    // Filter out empty groups
    let groups: Vec<_> = tag_groups.into_iter().filter(|(_, items)| !items.is_empty()).collect();
    let total_cards: usize = groups.iter().map(|(_, items)| items.len()).sum();

    let all_item_ids: Vec<String> = all_items.iter().map(|i| i.id.clone()).collect();
    let review_log = repo.get_review_log_for_items(&all_item_ids).await?;
    let revlog_by_item: HashMap<String, Vec<&ReviewLogRow>> = {
        let mut map: HashMap<String, Vec<&ReviewLogRow>> = HashMap::new();
        for entry in &review_log {
            map.entry(entry.item_id.clone()).or_default().push(entry);
        }
        map
    };

    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let temp_db_path = std::env::temp_dir().join(format!("anki_bulk_export_{}.db", nanos));

    let mut media_entries: Vec<(String, Vec<u8>)> = Vec::new();
    let mut asset_id_to_media_idx: HashMap<String, usize> = HashMap::new();

    {
        let conn = Connection::open(&temp_db_path)
            .map_err(|e| IncrementumError::Internal(format!("Cannot create export database: {}", e)))?;

        // Create tables (canonical schema from anki/rslib/src/storage/schema11.sql)
        conn.execute_batch(
            r#"
            CREATE TABLE notes (
                id integer PRIMARY KEY, guid text NOT NULL, mid integer NOT NULL,
                mod integer NOT NULL, usn integer NOT NULL, tags text NOT NULL,
                flds text NOT NULL, sfld integer NOT NULL, csum integer NOT NULL,
                flags integer NOT NULL, data text NOT NULL
            );
            CREATE TABLE cards (
                id integer PRIMARY KEY, nid integer NOT NULL, did integer NOT NULL,
                ord integer NOT NULL, mod integer NOT NULL, usn integer NOT NULL,
                type integer NOT NULL, queue integer NOT NULL, due integer NOT NULL,
                ivl integer NOT NULL, factor integer NOT NULL, reps integer NOT NULL,
                lapses integer NOT NULL, left integer NOT NULL, odue integer NOT NULL,
                odid integer NOT NULL, flags integer NOT NULL, data text NOT NULL
            );
            CREATE TABLE revlog (
                id integer PRIMARY KEY, cid integer NOT NULL, usn integer NOT NULL,
                ease integer NOT NULL, ivl integer NOT NULL, lastIvl integer NOT NULL,
                factor integer NOT NULL, time integer NOT NULL, type integer NOT NULL
            );
            CREATE TABLE graves (
                usn integer NOT NULL, oid integer NOT NULL, type integer NOT NULL
            );
            CREATE TABLE col (
                id integer PRIMARY KEY, crt integer NOT NULL,
                mod integer NOT NULL, scm integer NOT NULL,
                ver integer NOT NULL, dty integer NOT NULL,
                usn integer NOT NULL, ls integer NOT NULL,
                conf text NOT NULL, models text NOT NULL,
                decks text NOT NULL, dconf text NOT NULL,
                tags text NOT NULL
            );
            CREATE INDEX ix_notes_usn ON notes (usn);
            CREATE INDEX ix_cards_usn ON cards (usn);
            CREATE INDEX ix_revlog_usn ON revlog (usn);
            CREATE INDEX ix_cards_nid ON cards (nid);
            CREATE INDEX ix_cards_sched ON cards (did, queue, due);
            CREATE INDEX ix_revlog_cid ON revlog (cid);
            CREATE INDEX ix_notes_csum ON notes (csum);
            "#,
        )
        .map_err(|e| IncrementumError::Internal(format!("Cannot create tables: {}", e)))?;

        let now_ts = Utc::now().timestamp();
        let basic_model_id: i64 = 1;
        let cloze_model_id: i64 = 2;

        let models_json = serde_json::json!({
            basic_model_id.to_string(): {
                "id": basic_model_id, "name": "Incrementum Basic", "type": 0,
                "mod": now_ts, "usn": -1, "sortf": 0, "did": 1,
                "tmpls": [{"name": "Card 1", "ord": 0, "qfmt": "{{Front}}", "afmt": "{{FrontSide}}<hr id=answer>{{Back}}", "bqfmt": "", "bafmt": "", "bfont": "Arial", "bsize": 20}],
                "flds": [
                    {"name": "Front", "ord": 0, "sticky": false, "rtl": false, "font": "Arial", "size": 20},
                    {"name": "Back", "ord": 1, "sticky": false, "rtl": false, "font": "Arial", "size": 20},
                ],
                "css": ".card { font-family: arial; font-size: 20px; text-align: left; color: #2c2c2c; background: #ffffff; }",
                "latexPre": "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0pt}\n\\begin{document}",
                "latexPost": "\\end{document}",
                "req": [[0, "any", [0, 1]]],
            },
            cloze_model_id.to_string(): {
                "id": cloze_model_id, "name": "Incrementum Cloze", "type": 1,
                "mod": now_ts, "usn": -1, "sortf": 0, "did": 1,
                "tmpls": [{"name": "Cloze", "ord": 0, "qfmt": "{{cloze:Text}}", "afmt": "{{cloze:Text}}<br>\n{{Back}}", "bqfmt": "", "bafmt": "", "bfont": "Arial", "bsize": 20}],
                "flds": [
                    {"name": "Text", "ord": 0, "sticky": false, "rtl": false, "font": "Arial", "size": 20},
                    {"name": "Back", "ord": 1, "sticky": false, "rtl": false, "font": "Arial", "size": 20},
                ],
                "css": ".card { font-family: arial; font-size: 20px; text-align: left; color: #2c2c2c; background: #ffffff; }",
                "latexPre": "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0pt}\n\\begin{document}",
                "latexPost": "\\end{document}",
                "req": [[0, "any", [0]]],
            }
        }).to_string();

        let mut decks_json = serde_json::Map::new();
        for (i, (tag_name, _)) in groups.iter().enumerate() {
            let deck_id = (i + 1) as i64;
            decks_json.insert(
                deck_id.to_string(),
                serde_json::json!({
                    "id": deck_id, "name": tag_name, "mod": now_ts, "usn": -1,
                    "lr": now_ts, "desc": "", "dyn": 0, "conf": 1,
                    "extendNew": 0, "extendRev": 0,
                    "lrnToday": [0, 0], "newToday": [0, 0],
                    "revToday": [0, 0], "timeToday": [0, 0],
                    "collapsed": false,
                }),
            );
        }
        let decks_json_str = serde_json::Value::Object(decks_json).to_string();

        let total_items: usize = groups.iter().map(|(_, items)| items.len()).sum();
        let conf_json = serde_json::json!({
            "nextPos": total_items as i64 + 1,
            "estTimes": true,
            "activeDecks": groups.iter().enumerate().map(|(i, _)| (i + 1) as i64).collect::<Vec<_>>(),
            "sortType": "noteFld",
            "timeLim": 0,
            "sortBackwards": false,
            "addToCur": true,
            "curDeck": 1,
            "newSpread": 0,
            "dueCounts": true,
        }).to_string();

        let dconf_json = serde_json::json!({
            "1": {
                "id": 1,
                "name": "Default",
                "mod": now_ts,
                "usn": -1,
                "maxTaken": 60,
                "autoplay": true,
                "timer": 0,
                "new": {"perDay": 20, "ints": [1, 10], "initialFactor": 2500, "bury": true, "order": 1},
                "rev": {"perDay": 200, "ease4": 1.3, "ivlFct": 1, "maxIvl": 36500, "bury": true, "hardFactor": 1.2},
                "lapse": {"mins": [10], "leechFails": 8, "leechAction": 0, "mult": 0},
                "replayq": true,
            }
        }).to_string();

        conn.execute(
            "INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags) \
             VALUES (1, ?1, ?2, ?3, 11, 0, 0, 0, ?4, ?5, ?6, ?7, '{}')",
            rusqlite::params![now_ts, now_ts, now_ts, &conf_json, &models_json, &decks_json_str, &dconf_json],
        )
        .map_err(|e| IncrementumError::Internal(format!("Cannot insert col: {}", e)))?;

        let mut card_counter: i64 = 1;
        let mut seen_ids: std::collections::HashSet<String> = std::collections::HashSet::new();

        for (group_idx, (_tag_name, items)) in groups.iter().enumerate() {
            let deck_id = (group_idx + 1) as i64;
            for item in items {
                // Skip duplicates (items with multiple tags may appear in multiple groups)
                if !seen_ids.insert(item.id.clone()) {
                    continue;
                }

                let note_id = card_counter * 10000;
                let card_id = note_id + 1;
                let guid = uuid::Uuid::new_v4().to_string().replace("-", "")[..10].to_string();

                let tags_str = item.tags.iter()
                    .filter(|t| !t.starts_with("anki-import"))
                    .map(|t| format!(" {}", t))
                    .collect::<Vec<_>>()
                    .join("");

                let (model_id, flds) = match item.item_type {
                    ItemType::Cloze => {
                        if let (Some(ref ct), Some(ref ranges)) = (&item.cloze_text, &item.cloze_ranges) {
                            if let Some(anki_cloze) = cloze_text_to_anki(ct, ranges) {
                                let back = item.answer.as_deref().unwrap_or("")
                                    .replace('\x1f', " ").replace('\\', "\\\\");
                                (cloze_model_id, format!("{}\x1f{}", anki_cloze, back))
                            } else {
                                let front = item.question.replace('\x1f', " ").replace('\\', "\\\\");
                                let back = item.answer.as_deref().unwrap_or("")
                                    .replace('\x1f', " ").replace('\\', "\\\\");
                                (basic_model_id, format!("{}\x1f{}", front, back))
                            }
                        } else {
                            let front = item.question.replace('\x1f', " ").replace('\\', "\\\\");
                            let back = item.answer.as_deref().unwrap_or("")
                                .replace('\x1f', " ").replace('\\', "\\\\");
                            (basic_model_id, format!("{}\x1f{}", front, back))
                        }
                    }
                    _ => {
                        let front = item.question.replace('\x1f', " ").replace('\\', "\\\\");
                        let back = item.answer.as_deref().unwrap_or("")
                            .replace('\x1f', " ").replace('\\', "\\\\");
                        (basic_model_id, format!("{}\x1f{}", front, back))
                    }
                };

                // Image handling
                let mut img_html = String::new();
                for asset_id in &item.image_asset_ids {
                    if !asset_id_to_media_idx.contains_key(asset_id) {
                        if let Ok(Some(asset)) = repo.get_image_asset(asset_id).await {
                            let ext = match asset.mime_type.as_str() {
                                "image/png" => "png", "image/jpeg" | "image/jpg" => "jpg",
                                "image/gif" => "gif", "image/webp" => "webp",
                                "image/svg+xml" => "svg", _ => "png",
                            };
                            let filename = format!("{}.{}", asset_id, ext);
                            let idx = media_entries.len();
                            asset_id_to_media_idx.insert(asset_id.clone(), idx);
                            media_entries.push((filename, asset.content.clone()));
                        }
                    }
                    if let Some(&idx) = asset_id_to_media_idx.get(asset_id) {
                        img_html.push_str(&format!("<br><img src=\"{}\">", idx));
                    }
                }
                let flds = if img_html.is_empty() { flds }
                    else if let Some(pos) = flds.rfind('\x1f') { format!("{}{}{}", &flds[..pos], img_html, &flds[pos..]) }
                    else { format!("{}{}", flds, img_html) };

                conn.execute(
                    "INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data) \
                     VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, '', 0, 0, '')",
                    rusqlite::params![note_id, &guid, model_id, now_ts, &tags_str, &flds],
                ).map_err(|e| IncrementumError::Internal(format!("Cannot insert note: {}", e)))?;

                let card_data = if let Some(ref ms) = item.memory_state {
                    serde_json::json!({"d": ms.difficulty, "s": ms.stability, "v": "3"}).to_string()
                } else { String::new() };
                let interval = item.interval.round() as i32;
                let factor = (item.ease_factor * 1000.0).round() as i32;
                let due = if interval > 0 {
                    let due_date = item.due_date;
                    let epoch = chrono::NaiveDate::from_ymd_opt(1970, 1, 1).expect("valid epoch date");
                    (due_date.date_naive() - epoch).num_days() as i32
                } else { 0 };

                let card_type = match item.state {
                    ItemState::New => 0,
                    ItemState::Learning => 1,
                    ItemState::Review => 2,
                    ItemState::Relearning => 3,
                };

                conn.execute(
                    "INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data) \
                     VALUES (?1, ?2, ?3, 0, ?4, 0, ?5, 0, ?6, ?7, ?8, ?9, ?10, 0, 0, 0, 0, ?11)",
                    rusqlite::params![card_id, note_id, deck_id, now_ts, card_type,
                        due, interval, factor, item.review_count, item.lapses, &card_data],
                ).map_err(|e| IncrementumError::Internal(format!("Cannot insert card: {}", e)))?;

                if let Some(entries) = revlog_by_item.get(&item.id) {
                    for entry in entries {
                        let revlog_id = entry.anki_revlog_id.unwrap_or_else(|| Utc::now().timestamp_millis());
                        conn.execute(
                            "INSERT OR IGNORE INTO revlog (id, cid, usn, ease, ivl, lastIvl, factor, time, type) \
                             VALUES (?1, ?2, 0, ?3, ?4, ?5, ?6, ?7, ?8)",
                            rusqlite::params![revlog_id, card_id, entry.rating,
                                entry.interval_days.round() as i32,
                                entry.last_interval_days.map(|l| l.round() as i32).unwrap_or(0),
                                (entry.ease_factor * 1000.0).round() as i32,
                                entry.time_ms, entry.review_type],
                        ).map_err(|e| IncrementumError::Internal(format!("Cannot insert revlog: {}", e)))?;
                    }
                }

                card_counter += 1;
            }
        }
    }

    let db_bytes = std::fs::read(&temp_db_path)
        .map_err(|e| IncrementumError::Internal(format!("Cannot read export database: {}", e)))?;
    let _ = std::fs::remove_file(&temp_db_path);

    let output_file = File::create(&output_path)
        .map_err(|e| IncrementumError::Internal(format!("Cannot create output file: {}", e)))?;
    let mut zip = zip::ZipWriter::new(output_file);
    let options = zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    zip.start_file("collection.anki2", options)
        .map_err(|e| IncrementumError::Internal(format!("Cannot write collection: {}", e)))?;
    zip.write_all(&db_bytes)
        .map_err(|e| IncrementumError::Internal(format!("Cannot write collection data: {}", e)))?;

    let media_json = if media_entries.is_empty() { "{}".to_string() } else {
        let map: HashMap<String, &str> = media_entries.iter().enumerate()
            .map(|(i, (name, _))| (i.to_string(), name.as_str())).collect();
        serde_json::to_string(&map).unwrap_or_else(|_| "{}".to_string())
    };
    zip.start_file("media", options)
        .map_err(|e| IncrementumError::Internal(format!("Cannot write media: {}", e)))?;
    zip.write_all(media_json.as_bytes())
        .map_err(|e| IncrementumError::Internal(format!("Cannot write media data: {}", e)))?;

    for (idx, (_name, bytes)) in media_entries.iter().enumerate() {
        zip.start_file(idx.to_string(), options)
            .map_err(|e| IncrementumError::Internal(format!("Cannot write media file {}: {}", idx, e)))?;
        zip.write_all(bytes)
            .map_err(|e| IncrementumError::Internal(format!("Cannot write media file data {}: {}", idx, e)))?;
    }

    zip.finish()
        .map_err(|e| IncrementumError::Internal(format!("Cannot finalize zip: {}", e)))?;

    Ok(format!("Exported {} cards across {} decks to {}", total_cards, groups.len(), output_path))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cloze_single_range() {
        let result = cloze_text_to_anki("The capital of France is Paris", &[(25, 30)]);
        assert_eq!(result, Some("The capital of France is {{c1::Paris}}".to_string()));
    }

    #[test]
    fn cloze_multiple_ranges() {
        let result = cloze_text_to_anki("A and B and C", &[(0, 1), (6, 7), (12, 13)]);
        assert_eq!(result, Some("{{c1::A}} and {{c2::B}} and {{c3::C}}".to_string()));
    }

    #[test]
    fn cloze_empty_text() {
        let result = cloze_text_to_anki("", &[(0, 5)]);
        assert_eq!(result, None);
    }

    #[test]
    fn cloze_empty_ranges() {
        let result = cloze_text_to_anki("some text", &[]);
        assert_eq!(result, None);
    }

    #[test]
    fn cloze_invalid_range_start_ge_end() {
        let result = cloze_text_to_anki("hello", &[(3, 2)]);
        assert_eq!(result, None);
    }

    #[test]
    fn cloze_range_past_end() {
        let result = cloze_text_to_anki("hi", &[(0, 10)]);
        assert_eq!(result, None);
    }

    #[test]
    fn cloze_unicode_text() {
        let result = cloze_text_to_anki("日本の首都は東京です", &[(6, 8)]);
        assert_eq!(result, Some("日本の首都は{{c1::東京}}です".to_string()));
    }
}
