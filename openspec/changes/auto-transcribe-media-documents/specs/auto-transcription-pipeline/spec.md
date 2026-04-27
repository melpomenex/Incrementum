## ADDED Requirements

### Requirement: Automatic transcription on media document import
When `autoTranscription` is enabled in settings and a media document (audio, video, or podcast episode) is imported, the system SHALL automatically enqueue the document for background transcription without user intervention.

#### Scenario: Audio file imported with auto-transcription enabled
- **WHEN** a user imports an audio file (MP3, M4A, M4B, WAV, FLAC, OGG, OPUS, AAC)
- **AND** `audioTranscription.autoTranscription` is `true`
- **THEN** the system creates a transcription queue entry with status `pending`
- **AND** begins processing the queue in the background

#### Scenario: Video file imported with auto-transcription enabled
- **WHEN** a user imports a video file (MP4, WebM, MOV, MKV, AVI, M4V)
- **AND** `audioTranscription.autoTranscription` is `true`
- **AND** `audioTranscription.autoTranscribeLocalVideos` is `true`
- **THEN** the system creates a transcription queue entry with status `pending`

#### Scenario: Auto-transcription disabled
- **WHEN** a user imports a media document
- **AND** `audioTranscription.autoTranscription` is `false`
- **THEN** the system does NOT enqueue any transcription job
- **AND** the document is imported without transcription

#### Scenario: YouTube document imported
- **WHEN** a YouTube video is imported as a document
- **THEN** the system does NOT enqueue for auto-transcription (YouTube transcript API is used instead)

### Requirement: Persistent transcription queue
The system SHALL maintain a persistent `transcription_queue` table that tracks all auto-transcription jobs across app restarts.

#### Scenario: Queue entry fields
- **WHEN** a transcription job is created
- **THEN** the queue entry contains: `id`, `document_id`, `audio_path`, `provider`, `model_id`, `language`, `status`, `error_message`, `priority`, `created_at`, `started_at`, `completed_at`, `retry_count`

#### Scenario: Queue survives app restart
- **WHEN** the app is closed while transcription jobs are pending or processing
- **AND** the app is reopened
- **THEN** pending jobs resume processing
- **AND** processing jobs that were interrupted are reset to pending and retried

#### Scenario: Queue processing order
- **WHEN** multiple jobs are in the queue
- **THEN** jobs are processed in priority order (higher priority first), then by creation time (FIFO within same priority)

### Requirement: Background queue processing
The system SHALL process the transcription queue in the background without blocking the UI.

#### Scenario: Sequential processing
- **WHEN** multiple jobs are queued
- **THEN** the system processes one job at a time using the configured provider (local Whisper or Groq)

#### Scenario: Provider selection
- **WHEN** a job is processed
- **THEN** the system uses the provider configured in `audioTranscription.provider`
- **AND** the model configured in `audioTranscription.preferredModelId` (for local) or `audioTranscription.groq.model` (for Groq)

#### Scenario: Job status transitions
- **WHEN** a job transitions between states
- **THEN** the status follows: `pending` → `processing` → `completed` or `failed`
- **AND** the system emits a `transcription://queue-updated` Tauri event

#### Scenario: Failed job retry
- **WHEN** a transcription job fails
- **AND** `retry_count` is less than 3
- **THEN** the job is reset to `pending` with incremented `retry_count`
- **WHEN** `retry_count` reaches 3
- **THEN** the job status is set to `failed` permanently

### Requirement: Idle-time backfill for untranscribed documents
The system SHALL scan for untranscribed media documents during idle periods and enqueue them for transcription.

#### Scenario: Idle scan trigger
- **WHEN** the app has been idle for the configured threshold (default 5 minutes)
- **AND** no transcription job is currently processing
- **AND** `audioTranscription.autoTranscription` is `true`
- **THEN** the system scans for media documents where `content` is empty and no queue entry exists
- **AND** enqueues found documents with low priority

#### Scenario: Idle scan disabled
- **WHEN** the user disables idle-time transcription in settings
- **THEN** the system does NOT scan for untranscribed documents during idle periods

### Requirement: Transcription status visibility
The system SHALL display the transcription status on media document cards and in the document viewer.

#### Scenario: Status badges on document cards
- **WHEN** a media document has a transcription queue entry
- **THEN** the document card displays a status badge: "Transcribing..." (processing), "Pending" (pending), "Transcription failed" (failed), or no badge (completed or no entry)

#### Scenario: Progress in document viewer
- **WHEN** a user opens a media document that is currently being transcribed
- **THEN** the viewer shows a progress bar with percentage and current segment count
- **AND** completed transcript segments appear in real-time as they are processed

#### Scenario: Completed transcript in viewer
- **WHEN** a user opens a media document with a completed transcript
- **THEN** the transcript is displayed in the viewer and is available for text extraction

### Requirement: Queue management UI
The system SHALL provide a transcription queue management view accessible from settings.

#### Scenario: View queue
- **WHEN** a user navigates to the transcription queue management view
- **THEN** the system displays all queue entries with document title, status, progress, provider, and timestamps

#### Scenario: Cancel a job
- **WHEN** a user cancels a pending or processing job
- **THEN** the job status is set to `cancelled`
- **AND** if processing, the current transcription is stopped

#### Scenario: Retry a failed job
- **WHEN** a user retries a failed job
- **THEN** the job is reset to `pending` with `retry_count` set to 0

#### Scenario: Prioritize a job
- **WHEN** a user promotes a pending job to high priority
- **THEN** the job is processed before other pending jobs

### Requirement: Transcript content storage
When transcription completes, the system SHALL store the full transcript text in the document's `content` field.

#### Scenario: Content field populated on completion
- **WHEN** a transcription job completes successfully
- **THEN** the full transcript text is written to the `documents.content` column for that document
- **AND** the existing FTS5 triggers automatically index the content for search

#### Scenario: Segments stored with timestamps
- **WHEN** a transcription job completes successfully
- **THEN** individual segments with timestamps are stored in `transcript_segments`
- **AND** segments are linked to the transcript record via `transcript_id`
