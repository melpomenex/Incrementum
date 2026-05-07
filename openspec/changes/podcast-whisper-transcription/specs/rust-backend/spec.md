# Spec: Rust Backend — Transcription Commands

## Command: transcribe_podcast_episode

```rust
#[tauri::command]
pub async fn transcribe_podcast_episode(
    episode_id: String,
    model: Option<String>,
    language: Option<String>,
    app_handle: AppHandle,
    repo: State<'_, Repository>,
) -> Result<()>
```

### Flow
1. Look up episode by ID → get `audio_url`
2. Set `transcript_status = 'downloading'` in DB
3. Emit `podcast://transcription-progress { episode_id, status: "downloading", progress: 0 }`
4. Download audio from `audio_url` via reqwest to temp file
   - Stream download, emit progress events (0-30% of total)
   - Support MP3, M4A, OGG, WAV, FLAC
   - Timeout: 5 minutes for download
5. Set `transcript_status = 'transcribing'`
6. Emit progress events (30-100% during transcription)
7. Use existing `TranscriptionEngine::transcribe()` on downloaded file
8. Concatenate all segments into full transcript text
9. Store `transcript_text` in DB, set `transcript_status = 'done'`, `transcribed_at = now()`
10. Create Extract records for notable segments (key phrases, topic boundaries)
11. Clean up temp file
12. Emit `podcast://transcription-complete { episode_id, segment_count, duration }`

### Error handling
- Download fails → set `transcript_status = 'error'`, store error message
- Transcription fails → same
- Cleanup temp file on any failure

## Command: get_podcast_transcript

```rust
#[tauri::command]
pub async fn get_podcast_transcript(
    episode_id: String,
    repo: State<'_, Repository>,
) -> Result<PodcastTranscriptResponse>
```

Returns: `{ text: String, segments: Vec<TranscriptSegment>, status: String, duration: Option<f64> }`

## Command: cancel_podcast_transcription

```rust
#[tauri::command]
pub async fn cancel_podcast_transcription(
    episode_id: String,
) -> Result<()>
```

Uses a `CancellationToken` (Arc<AtomicBool>) stored in a state map keyed by episode_id.

## Command: set_feed_auto_transcribe

```rust
#[tauri::command]
pub async fn set_feed_auto_transcribe(
    feed_id: String,
    enabled: bool,
    language: Option<String>,
    repo: State<'_, Repository>,
) -> Result<()>
```

## Cancellation
- Global `HashMap<String, Arc<AtomicBool>>` for cancellation tokens
- Managed state in Tauri
- Check token between segments during transcription
- Check token during download (per chunk)
