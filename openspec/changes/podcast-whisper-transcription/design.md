# Design: Podcast Whisper Transcription Pipeline

## Architecture

```
User clicks "Transcribe" on episode
  → Rust: download episode audioUrl to temp dir via reqwest
  → Rust: run existing TranscriptionEngine::transcribe() on downloaded file
  → Rust: emit progress events to frontend (percentage, segment count)
  → Rust: store transcript in podcast_episodes.transcript_text column
  → Rust: create Extract records for key segments (speaker turns, topic shifts)
  → Frontend: show progress bar in episode card
  → Frontend: "View Transcript" button appears when done
  → Frontend: "Chat About This" opens Assistant with transcript as context
```

## Data Model Changes

### podcast_episodes table — new columns
- `transcript_text TEXT` — full transcript
- `transcript_status TEXT DEFAULT 'none'` — 'none' | 'downloading' | 'transcribing' | 'done' | 'error'
- `transcript_error TEXT` — error message if failed
- `transcripted_at TEXT` — ISO timestamp when completed

### podcast_feeds table — new columns
- `auto_transcribe BOOLEAN DEFAULT false` — whether to auto-transcribe new episodes
- `transcribe_language TEXT` — language hint for Whisper

## New Rust Commands
1. `transcribe_podcast_episode(episode_id, model?, language?)` → downloads audio, transcribes, stores result, creates extracts
2. `get_podcast_transcript(episode_id)` → returns transcript text + segments
3. `set_feed_auto_transcribe(feed_id, enabled, language?)` → toggle auto-transcribe per feed
4. `cancel_podcast_transcription(episode_id)` → cancel in-progress transcription

## New Frontend
- Transcript button/progress on episode cards
- Transcript viewer (side panel or modal)
- "Chat About This" button → opens Assistant panel with transcript as document context

## Progress Events (Tauri emit)
- `podcast://transcription-progress` — `{ episodeId, status, progress: 0-100, message }`
- `podcast://transcription-complete` — `{ episodeId, segmentCount, duration }`
- `podcast://transcription-error` — `{ episodeId, error }`

## AI Chat Integration
When user clicks "Chat About This" on a transcribed episode:
1. Create a temporary document with the transcript text (or reuse existing extract docs)
2. Open the Assistant panel with that document as context
3. User can ask questions about the podcast content
