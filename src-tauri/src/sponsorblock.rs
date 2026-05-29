//! SponsorBlock API integration and audio cutting
//! Documentation: https://wiki.sponsor.ajay.app/w/API_Docs

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::fs;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::CommandEvent;
use crate::utils::ffmpeg::ffmpeg_command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SponsorBlockCut {
    pub category: String,
    pub original_start: f64,
    pub original_end: f64,
    pub cut_start: f64,
    pub uuid: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SponsorBlockSegmentObject {
    pub category: String,
    pub segment: Vec<f64>,
    pub uuid: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SponsorBlockTimesObject {
    pub sponsor_times: Vec<(f64, f64)>,
    pub uuid: Vec<String>,
    pub category: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(untagged)]
enum SponsorBlockApiResponse {
    Segments(Vec<SponsorBlockSegmentObject>),
    Times(Vec<SponsorBlockTimesObject>),
}

/// Fetch SponsorBlock segments for a YouTube video ID
pub async fn fetch_sponsorblock_segments(video_id: &str) -> Result<Vec<(String, f64, f64, String)>, String> {
    let categories = "sponsor,intro,outro,selfpromo,interaction,music_offtopic,preview";
    let url = format!(
        "https://sponsor.ajay.app/api/skipSegments/{}?categories={}&actionTypes=skip,mute",
        video_id, categories
    );
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to build client: {}", e))?;
        
    let response = client.get(&url).send().await.map_err(|e| format!("Request failed: {}", e))?;
    
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(Vec::new()); // No segments found
    }
    
    if !response.status().is_success() {
        return Err(format!("SponsorBlock API returned HTTP {}", response.status()));
    }
    
    let body = response.text().await.map_err(|e| format!("Failed to read body: {}", e))?;
    
    let parsed: SponsorBlockApiResponse = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse response: {}", e))?;
        
    let mut segments = Vec::new();
    match parsed {
        SponsorBlockApiResponse::Segments(segs) => {
            for s in segs {
                if s.segment.len() == 2 {
                    segments.push((
                        s.category,
                        s.segment[0],
                        s.segment[1],
                        s.uuid.unwrap_or_default(),
                    ));
                }
            }
        }
        SponsorBlockApiResponse::Times(times_list) => {
            for t in times_list {
                for i in 0..t.sponsor_times.len() {
                    if i < t.category.len() {
                        let cat = t.category[i].clone();
                        let uuid = t.uuid.get(i).cloned().unwrap_or_default();
                        let time_range = t.sponsor_times[i];
                        segments.push((cat, time_range.0, time_range.1, uuid));
                    }
                }
            }
        }
    }
    
    Ok(segments)
}

/// Cuts out SponsorBlock segments from an audio file using ffmpeg
pub async fn cut_audio_file(
    app_handle: &AppHandle,
    input_path: &Path,
    output_path: &Path,
    segments: &[(String, f64, f64, String)],
) -> Result<Vec<SponsorBlockCut>, String> {
    if segments.is_empty() {
        // Just copy/move to dest
        fs::copy(input_path, output_path)
            .map_err(|e| format!("Failed to copy audio: {}", e))?;
        return Ok(Vec::new());
    }

    // Sort segments by start time to handle math and ffmpeg filter sequence
    let mut sorted_segs = segments.to_vec();
    sorted_segs.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

    // Construct select filter: not(between(t,s1_start,s1_end) + between(t,s2_start,s2_end))
    let mut conditions = Vec::new();
    for (_, start, end, _) in &sorted_segs {
        conditions.push(format!("between(t,{},{})", start, end));
    }
    let filter_expr = format!("not({})", conditions.join("+"));

    let (mut rx, _) = ffmpeg_command(app_handle)
        .map_err(|e| format!("Failed to get ffmpeg command: {}", e))?
        .args([
            "-i", input_path.to_str().expect("input path is valid UTF-8"),
            "-af", &format!("aselect='{}',asetpts=N/SR/TB", filter_expr),
            "-y",
            output_path.to_str().expect("output path is valid UTF-8")
        ])
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;

    let mut success = false;
    while let Some(event) = rx.recv().await {
        if let CommandEvent::Terminated(payload) = event {
            success = payload.code == Some(0);
            break;
        }
    }

    if !success {
        return Err("ffmpeg cut operation failed".to_string());
    }

    // Compute shifted cuts for output file playback triggering
    let mut cuts = Vec::new();
    let mut total_cut_duration = 0.0;
    for (category, start, end, uuid) in sorted_segs {
        let duration = end - start;
        let cut_start = start - total_cut_duration;
        cuts.push(SponsorBlockCut {
            category,
            original_start: start,
            original_end: end,
            cut_start,
            uuid,
        });
        total_cut_duration += duration;
    }

    Ok(cuts)
}

/// Helper to get the centralized cuts metadata directory
pub fn cuts_dir() -> Result<PathBuf, String> {
    let dir = dirs::data_dir()
        .ok_or_else(|| "Could not determine data directory".to_string())?
        .join("incrementum")
        .join("cuts");
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create cuts directory: {}", e))?;
    Ok(dir)
}

/// Save cut metadata for a document/episode ID
pub fn save_cuts_metadata(id: &str, cuts: &[SponsorBlockCut]) -> Result<(), String> {
    let path = cuts_dir()?.join(format!("{}.json", id));
    let json = serde_json::to_string(cuts)
        .map_err(|e| format!("Failed to serialize cuts: {}", e))?;
    fs::write(&path, json)
        .map_err(|e| format!("Failed to write cuts metadata: {}", e))?;
    Ok(())
}

/// Load cut metadata for a document/episode ID
pub fn load_cuts_metadata(id: &str) -> Result<Option<Vec<SponsorBlockCut>>, String> {
    let path = cuts_dir()?.join(format!("{}.json", id));
    if !path.exists() {
        return Ok(None);
    }
    let json = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read cuts metadata: {}", e))?;
    let cuts: Vec<SponsorBlockCut> = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse cuts: {}", e))?;
    Ok(Some(cuts))
}

/// Expose Tauri command to retrieve cuts metadata for a played file
#[tauri::command]
pub async fn get_sponsorblock_cuts(id: String) -> Result<Option<Vec<SponsorBlockCut>>, String> {
    load_cuts_metadata(&id)
}
