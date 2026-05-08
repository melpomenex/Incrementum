## Context

The Incremental Reading (IR) system is the core of the application, using FSRS to schedule documents and learning items. Podcasts are currently siloed in a separate manager. While they can be automatically included in the scroll mode queue via settings, users lack the granular control to promote specific episodes into the IR workflow as managed documents.

## Goals / Non-Goals

**Goals:**
- Provide a "surgical" way to add specific podcast episodes to the IR queue.
- Leverage the existing `Document` model and FSRS scheduling for promoted podcasts.
- Ensure a seamless transition from the Podcast Manager to Scroll Mode.

**Non-Goals:**
- Automatically transcribing every promoted episode (transcription remains a separate manual or auto-feed process).
- Changing the existing `podcast_episodes` table structure.

## Decisions

### 1. New Backend Command: `import_podcast_episode_as_document`
- **Location**: `src-tauri/src/commands/podcast.rs`
- **Logic**:
    - Lookup `PodcastEpisode` by ID.
    - Instantiate a new `Document` object.
    - Map `PodcastEpisode.title` -> `Document.title`.
    - Map `PodcastEpisode.audio_url` -> `Document.file_path`.
    - Set `Document.file_type` to `FileType::Audio`.
    - Set `Document.next_reading_date` to `Utc::now()` to make it immediately due.
    - Set a default `priority_rating` (e.g., 8) to ensure it appears near the top of the queue.
    - Copy tags from the feed if applicable.
- **Rationale**: Reusing the `Document` model is the most consistent way to integrate with the existing queue and FSRS logic.

### 2. Context Menu Integration
- **Location**: `src/components/media/PodcastManager.tsx`
- **Action**: Add "Insert into Queue" to the `episodeContextMenu`.
- **Feedback**: Use a toast notification to confirm the item was added and provide a link/button to "View in Queue" (optional).

### 3. Queue Rendering
- **Location**: `src/pages/QueueScrollPage.tsx` and `src/components/viewer/DocumentViewer.tsx`.
- **Status**: No changes required. `DocumentViewer` already detects `FileType::Audio` and delegates to `AudiobookViewer`. `QueueScrollPage` already fetches all non-archived, non-dismissed documents.

## Risks / Trade-offs

- **[Risk] Multiple Imports**: A user might click "Insert into Queue" multiple times for the same episode.
- **[Mitigation]**: The backend command should check if a document with the same `file_path` (audio URL) already exists before creating a new one, or simply allow duplicates if the user explicitly requests it (Incremental Reading sometimes benefits from multiple "instances" of an item, though rare). We will opt for a check based on `file_path` to avoid clutter.
- **[Risk] Offline Playback**: Podcasting often involves offline use. Documents with remote URLs might fail if the user goes offline.
- **[Mitigation]**: This is an existing limitation of remote media in the app. Future work could involve downloading the audio file, but it's out of scope for this task.
