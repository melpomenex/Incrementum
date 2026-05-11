//! SuperMemo import functionality
//!
//! SuperMemo exports are typically ZIP archives containing:
//! - XML files with items, topics, and learning data
//! - Media files (images, audio, video)
//! - Registry files with metadata

use std::io::Read;
use std::fs::File;
use zip::ZipArchive;
use quick_xml::events::Event;
use quick_xml::Reader;
use crate::error::{Result, IncrementumError};

#[derive(Debug, serde::Serialize)]
pub struct SuperMemoItem {
    pub id: String,
    pub title: String,
    pub content: String,
    pub question: Option<String>,
    pub answer: Option<String>,
    pub topic: Option<String>,
    pub interval: Option<i32>,
    pub repetitions: Option<i32>,
    pub easiness: Option<f64>,
    pub timestamp: i64,
}

#[derive(Debug, serde::Serialize)]
pub struct SuperMemoCollection {
    pub name: String,
    pub items: Vec<SuperMemoItem>,
    pub topics: Vec<String>,
    pub media: Vec<String>,
}

/// Convert a &[u8] local name to a String.
#[inline]
fn name_str(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).into_owned()
}

/// Parse a SuperMemo export (ZIP archive)
pub async fn parse_supermemo_export(zip_path: &str) -> Result<SuperMemoCollection> {
    let file = File::open(zip_path)
        .map_err(|e| IncrementumError::NotFound(format!("Cannot open SuperMemo export: {}", e)))?;

    let mut archive = ZipArchive::new(file)
        .map_err(|e| IncrementumError::NotFound(format!("Cannot unzip export: {}", e)))?;

    let mut collection = SuperMemoCollection {
        name: "SuperMemo Collection".to_string(),
        items: Vec::new(),
        topics: Vec::new(),
        media: Vec::new(),
    };

    // Process all files in the archive
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| IncrementumError::NotFound(format!("Cannot read file: {}", e)))?;

        let file_name = file.name().to_string();

        // Skip media files for now
        if file_name.ends_with(".png") ||
           file_name.ends_with(".jpg") ||
           file_name.ends_with(".jpeg") ||
           file_name.ends_with(".gif") ||
           file_name.ends_with(".mp3") ||
           file_name.ends_with(".wav") ||
           file_name.ends_with(".mp4") {
            collection.media.push(file_name);
            continue;
        }

        // Process XML files
        if file_name.ends_with(".xml") {
            // Zip bomb protection
            const MAX_XML_SIZE: u64 = 100 * 1024 * 1024;
            if file.size() > MAX_XML_SIZE {
                continue;
            }

            let mut content = String::new();
            file.read_to_string(&mut content)
                .map_err(|e| IncrementumError::NotFound(format!("Cannot read XML: {}", e)))?;

            // Parse SuperMemo XML format
            if let Ok(items) = parse_supermemo_xml(&content, &file_name) {
                collection.items.extend(items);
            }
        }
    }

    // Extract unique topics
    let mut topics_set = std::collections::HashSet::new();
    for item in &collection.items {
        if let Some(topic) = &item.topic {
            topics_set.insert(topic.clone());
        }
    }
    collection.topics = topics_set.into_iter().collect();

    Ok(collection)
}

/// Detect SuperMemo XML format and dispatch to appropriate parser
fn parse_supermemo_xml(content: &str, source_file: &str) -> Result<Vec<SuperMemoItem>> {
    let mut reader = Reader::from_str(content);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    let mut seen_roots: Vec<String> = Vec::new();

    // Scan top-level elements to detect format
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                if seen_roots.len() < 5 {
                    seen_roots.push(name_str(e.local_name().as_ref()));
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
    }

    let roots_joined = seen_roots.join(" ");

    if roots_joined.contains("SuperMemo") || roots_joined.contains("Element") || roots_joined.contains("Question") {
        return parse_supermemo_qa_xml(content);
    }

    if roots_joined.contains("Topic") || roots_joined.contains("Content") {
        return parse_supermemo_topic_xml(content);
    }

    parse_generic_supermemo_xml(content, source_file)
}

/// Collect text content (including CDATA) for a named child element within the given content.
fn extract_child_text(content: &str, parent_tag: &str, child_tag: &str) -> Option<String> {
    let mut reader = Reader::from_str(content);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    let mut in_parent = false;
    let mut in_child = false;
    let mut child_text = String::new();
    let mut parent_depth = 0i32;
    let mut child_depth = 0i32;

    // If no parent_tag, treat entire content as the parent scope
    let scanning_parent = !parent_tag.is_empty();
    if !scanning_parent {
        in_parent = true;
        parent_depth = 1;
    }

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let name = name_str(e.local_name().as_ref());
                if scanning_parent && name == parent_tag {
                    in_parent = true;
                    parent_depth += 1;
                } else if in_parent && name == child_tag {
                    in_child = true;
                    child_depth += 1;
                    child_text.clear();
                } else if in_parent {
                    parent_depth += 1;
                }
            }
            Ok(Event::End(ref e)) => {
                let name = name_str(e.local_name().as_ref());
                if name == child_tag && in_child {
                    child_depth -= 1;
                    if child_depth == 0 {
                        in_child = false;
                    }
                } else if in_parent && !in_child {
                    parent_depth -= 1;
                    if parent_depth == 0 {
                        let text = child_text.trim().to_string();
                        return if text.is_empty() { None } else { Some(text) };
                    }
                }
            }
            Ok(Event::Text(ref e)) => {
                if in_child {
                    if let Ok(t) = e.unescape() {
                        child_text.push_str(&t);
                    }
                }
            }
            Ok(Event::CData(ref e)) => {
                if in_child {
                    child_text.push_str(&String::from_utf8_lossy(e.as_ref()));
                }
            }
            Ok(Event::Empty(ref e)) => {
                let name = name_str(e.local_name().as_ref());
                if in_parent && name == child_tag && child_text.is_empty() {
                    child_text.clear();
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
    }

    let text = child_text.trim().to_string();
    if text.is_empty() { None } else { Some(text) }
}

/// Parse SuperMemo Q&A XML format using quick-xml
fn parse_supermemo_qa_xml(content: &str) -> Result<Vec<SuperMemoItem>> {
    let mut items = Vec::new();
    let mut reader = Reader::from_str(content);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    let mut item_count = 0u32;
    let mut element_buf = String::new();
    let mut in_element = false;
    let mut element_depth = 0i32;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let name = name_str(e.local_name().as_ref());
                if name == "Element" {
                    in_element = true;
                    element_depth = 1;
                    element_buf.clear();
                } else if in_element {
                    element_depth += 1;
                }

                if in_element {
                    element_buf.push('<');
                    element_buf.push_str(&name);
                    for attr in e.attributes().flatten() {
                        element_buf.push(' ');
                        element_buf.push_str(&String::from_utf8_lossy(attr.key.as_ref()));
                        element_buf.push_str("=\"");
                        element_buf.push_str(&String::from_utf8_lossy(&attr.value));
                        element_buf.push('"');
                    }
                    element_buf.push('>');
                }
            }
            Ok(Event::Empty(ref e)) => {
                let name = name_str(e.local_name().as_ref());
                if in_element {
                    element_buf.push('<');
                    element_buf.push_str(&name);
                    for attr in e.attributes().flatten() {
                        element_buf.push(' ');
                        element_buf.push_str(&String::from_utf8_lossy(attr.key.as_ref()));
                        element_buf.push_str("=\"");
                        element_buf.push_str(&String::from_utf8_lossy(&attr.value));
                        element_buf.push('"');
                    }
                    element_buf.push_str("/>");
                }
            }
            Ok(Event::End(ref e)) => {
                let name = name_str(e.local_name().as_ref());
                if in_element {
                    element_buf.push_str(&format!("</{}>", name));

                    if name == "Element" {
                        element_depth -= 1;
                        if element_depth == 0 {
                            in_element = false;

                            let question = extract_child_text(&element_buf, "", "Question");
                            let answer = extract_child_text(&element_buf, "", "Answer");
                            let title = extract_child_text(&element_buf, "", "Title");
                            let interval = extract_child_text(&element_buf, "", "Interval")
                                .and_then(|s| s.parse::<i32>().ok());
                            let repetitions = extract_child_text(&element_buf, "", "Repetitions")
                                .and_then(|s| s.parse::<i32>().ok());
                            let easiness = extract_child_text(&element_buf, "", "Easiness")
                                .and_then(|s| s.parse::<f64>().ok());

                            items.push(SuperMemoItem {
                                id: format!("sm-{}", item_count),
                                title: title.unwrap_or_else(|| {
                                    question.as_ref()
                                        .unwrap_or(&"Untitled".to_string())
                                        .chars()
                                        .take(50)
                                        .collect()
                                }),
                                content: format!(
                                    "{}\n\n{}",
                                    question.as_deref().unwrap_or(""),
                                    answer.as_deref().unwrap_or("")
                                ),
                                question,
                                answer,
                                topic: None,
                                interval,
                                repetitions,
                                easiness,
                                timestamp: chrono::Utc::now().timestamp(),
                            });

                            item_count += 1;
                        }
                    } else {
                        element_depth -= 1;
                    }
                }
            }
            Ok(Event::Text(ref e)) => {
                if in_element {
                    if let Ok(t) = e.unescape() {
                        element_buf.push_str(&t);
                    }
                }
            }
            Ok(Event::CData(ref e)) => {
                if in_element {
                    element_buf.push_str(&String::from_utf8_lossy(e.as_ref()));
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
    }

    Ok(items)
}

/// Parse SuperMemo topic XML format using quick-xml
fn parse_supermemo_topic_xml(content: &str) -> Result<Vec<SuperMemoItem>> {
    let mut items = Vec::new();
    let mut reader = Reader::from_str(content);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    let mut item_count = 0u32;
    let mut topic_buf = String::new();
    let mut in_topic = false;
    let mut topic_depth = 0i32;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let name = name_str(e.local_name().as_ref());
                if name == "Topic" {
                    in_topic = true;
                    topic_depth = 1;
                    topic_buf.clear();
                } else if in_topic {
                    topic_depth += 1;
                }

                if in_topic {
                    topic_buf.push('<');
                    topic_buf.push_str(&name);
                    for attr in e.attributes().flatten() {
                        topic_buf.push(' ');
                        topic_buf.push_str(&String::from_utf8_lossy(attr.key.as_ref()));
                        topic_buf.push_str("=\"");
                        topic_buf.push_str(&String::from_utf8_lossy(&attr.value));
                        topic_buf.push('"');
                    }
                    topic_buf.push('>');
                }
            }
            Ok(Event::Empty(ref e)) => {
                let name = name_str(e.local_name().as_ref());
                if in_topic {
                    topic_buf.push('<');
                    topic_buf.push_str(&name);
                    for attr in e.attributes().flatten() {
                        topic_buf.push(' ');
                        topic_buf.push_str(&String::from_utf8_lossy(attr.key.as_ref()));
                        topic_buf.push_str("=\"");
                        topic_buf.push_str(&String::from_utf8_lossy(&attr.value));
                        topic_buf.push('"');
                    }
                    topic_buf.push_str("/>");
                }
            }
            Ok(Event::End(ref e)) => {
                let name = name_str(e.local_name().as_ref());
                if in_topic {
                    topic_buf.push_str(&format!("</{}>", name));

                    if name == "Topic" {
                        topic_depth -= 1;
                        if topic_depth == 0 {
                            in_topic = false;

                            let title = extract_child_text(&topic_buf, "", "Title")
                                .unwrap_or_else(|| "Untitled Topic".to_string());
                            let content_text = extract_child_text(&topic_buf, "", "Content")
                                .unwrap_or_default();

                            items.push(SuperMemoItem {
                                id: format!("sm-topic-{}", item_count),
                                title: title.clone(),
                                content: content_text,
                                question: None,
                                answer: None,
                                topic: Some(title),
                                interval: None,
                                repetitions: None,
                                easiness: None,
                                timestamp: chrono::Utc::now().timestamp(),
                            });

                            item_count += 1;
                        }
                    } else {
                        topic_depth -= 1;
                    }
                }
            }
            Ok(Event::Text(ref e)) => {
                if in_topic {
                    if let Ok(t) = e.unescape() {
                        topic_buf.push_str(&t);
                    }
                }
            }
            Ok(Event::CData(ref e)) => {
                if in_topic {
                    topic_buf.push_str(&String::from_utf8_lossy(e.as_ref()));
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
    }

    Ok(items)
}

/// Parse generic SuperMemo XML — extract text content using quick-xml
fn parse_generic_supermemo_xml(content: &str, source_file: &str) -> Result<Vec<SuperMemoItem>> {
    let mut items = Vec::new();

    let mut reader = Reader::from_str(content);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    let mut text_parts: Vec<String> = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Text(ref e)) => {
                if let Ok(t) = e.unescape() {
                    let trimmed = t.trim().to_string();
                    if !trimmed.is_empty() {
                        text_parts.push(trimmed);
                    }
                }
            }
            Ok(Event::CData(ref e)) => {
                let raw = String::from_utf8_lossy(e.as_ref());
                let trimmed = raw.trim().to_string();
                if !trimmed.is_empty() {
                    text_parts.push(trimmed);
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
    }

    let text_content = text_parts.join("\n");

    if !text_content.trim().is_empty() {
        items.push(SuperMemoItem {
            id: format!("sm-generic-{}", source_file.replace("/", "-")),
            title: source_file.split('/').next_back().unwrap_or("Imported").to_string(),
            content: text_content,
            question: None,
            answer: None,
            topic: None,
            interval: None,
            repetitions: None,
            easiness: None,
            timestamp: chrono::Utc::now().timestamp(),
        });
    }

    Ok(items)
}

#[tauri::command]
pub async fn import_supermemo_package(zip_path: String) -> Result<String> {
    let collection = parse_supermemo_export(&zip_path).await?;

    let result = serde_json::to_value(&collection)
        .map_err(|e| IncrementumError::NotFound(format!("Cannot serialize collection: {}", e)))?;

    Ok(result.to_string())
}

#[tauri::command]
pub fn validate_supermemo_package(path: String) -> Result<bool> {
    let file = File::open(&path)
        .map_err(|e| IncrementumError::NotFound(format!("Cannot open file: {}", e)))?;

    let archive = ZipArchive::new(file)
        .map_err(|e| IncrementumError::NotFound(format!("Not a valid ZIP archive: {}", e)))?;

    let has_xml = archive.file_names().any(|name| name.ends_with(".xml"));

    if !has_xml {
        return Err(IncrementumError::NotFound("No XML files found in export".to_string()));
    }

    Ok(true)
}
