## Why

Users import audio/video documents (podcasts, audiobooks, lectures, videos) expecting full-text search and extraction capabilities. Currently, transcription must be triggered manually per-document, meaning users discover the transcript is missing only when they try to search or extract. This breaks the seamless reading workflow that text documents enjoy. Auto-transcription in the background ensures media documents are fully indexed by the time the user next opens them.

## What Changes

- When `autoTranscription` is enabled in settings, newly imported media documents (audio, video, podcast episodes) are enqueued for background transcription automatically
- Existing untranscribed media documents are transcribed on a background pass when the app is idle
- Completed transcripts are stored in the existing `transcripts` / `transcript_segments` tables and indexed into FTS5 for full-text search
- The document `content` field is populated with the transcript text, making media documents searchable and extractable via the existing extraction flow
- Users see transcription status (pending, in-progress, completed, failed) on media documents in the library
- A transcription queue management view allows users to monitor, prioritize, cancel, or retry transcriptions

## Capabilities

### New Capabilities
- `auto-transcription-pipeline`: Background transcription pipeline that automatically transcribes media documents using the existing Whisper/Groq engines, with queue management, progress tracking, and idle-time scheduling
- `transcript-search-integration`: Integration of completed transcripts into the existing FTS5 search index and document content field, making transcripts searchable and extractable

### Modified Capabilities

## Impact

- **Settings**: Extends `audioTranscription` settings block with auto-transcription behavior controls (idle threshold, concurrency, retry policy)
- **Database**: Uses existing `transcripts`, `transcript_segments`, `video_transcripts`, and `youtube_transcripts` tables; adds a `transcription_queue` table for tracking pending/retrying jobs
- **Document import flow**: `documentStore` triggers auto-transcription enqueue on media document creation
- **Search**: FTS5 indexing hooks into transcription completion to index new transcripts
- **Frontend**: Media document cards and viewer show transcription status; new queue management panel in settings
- **Tauri commands**: New commands for queue management (list, cancel, retry, prioritize)
- **Existing transcription engine**: No changes to `transcription/engine.rs` or Groq transcription — this is a scheduling/coordination layer on top
