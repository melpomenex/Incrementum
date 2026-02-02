# Design: Local Transcription Service

## Architecture

The local transcription service is designed to be offline-first, privacy-focused, and CPU-efficient. It leverages `whisper.cpp` for high-performance inference without requiring a Python environment.

### Components

#### 1. Transcription Engine (Sidecar)
*   **Implementation**: `whisper.cpp` (compiled binary).
*   **Integration**: Bundled as a Tauri [sidecar](https://tauri.app/v1/guides/building/sidecar/).
*   **Input**: PCM audio file path (converted from MP3/M4B if necessary).
*   **Output**: JSON format segments streamed to stdout or written to a file.
*   **Why Bundle?**: Ensures compatibility and avoids "downloading executable" security/permission issues. The binary is small (~5MB).
*   **Why Download Models?**: Models are large (75MB - 1.5GB). We download them on demand to keep the installer size small.

#### 2. Model Manager (Rust)
*   **Responsibility**: manages the lifecycle of Whisper models.
*   **Storage**: `AppLocalData/models/whisper/`
*   **Manifest**:
    *   `distil-small.en` (Default English)
    *   `base` (Fast Multilingual)
    *   `small` (Balanced Multilingual)
*   **Verification**: SHA256 checksums before enabling a model.

#### 3. Job Coordinator (Rust)
*   **Queue**: Manages transcription requests.
*   **Concurrency**: Limits to 1 active transcription job to preserve system responsiveness.
*   **State Machine**: `Pending` -> `Processing` -> `Completed` | `Failed`.
*   **Resume**: Checks for partially transcribed chapters on startup.

#### 4. Database (SQLite)
New tables to store transcriptions.

```sql
CREATE TABLE transcripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    model_used TEXT NOT NULL,
    language TEXT NOT NULL,
    status TEXT NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(book_id, chapter_id)
);

CREATE TABLE transcript_segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transcript_id INTEGER NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    text TEXT NOT NULL,
    confidence REAL,
    FOREIGN KEY(transcript_id) REFERENCES transcripts(id) ON DELETE CASCADE
);
CREATE INDEX idx_transcript_segments_time ON transcript_segments(transcript_id, start_ms);
```

### Data Flow

1.  **User Action**: "Enable Transcripts" in UI.
2.  **Setup**:
    *   Frontend calls `download_model(profile)`.
    *   Rust backend downloads `ggml-*.bin` to app data.
    *   Rust backend runs `whisper --version` or similar smoke test.
3.  **Transcription**:
    *   User plays a chapter or clicks "Transcribe".
    *   Rust `JobCoordinator` checks queue.
    *   If slot free, spawns `whisper` sidecar with path to audio.
    *   **Audio Conversion**: If audio is MP3/M4B, `ffmpeg` (also sidecar/bundled) converts to 16kHz WAV temporary file.
    *   Sidecar emits JSON lines.
    *   Rust parses JSON, inserts into `transcript_segments`.
    *   Rust emits event `transcript://update` to Frontend.
4.  **Playback**:
    *   Frontend queries `transcript_segments` by `transcript_id`.
    *   During playback, binary search `start_ms` to highlight current segment.

### User Interface

*   **Settings**: New section "Transcription".
*   **Reader**:
    *   New "Transcript" tab/panel.
    *   Shows loading state if transcribing.
    *   Virtual scroller for long lists of segments.
    *   Auto-scroll toggle (follow playback).

### Cross-Platform Considerations
*   **Windows**: Bundle `whisper.exe` and `ffmpeg.exe`.
*   **macOS**: Bundle `whisper` and `ffmpeg` (universal/arm64).
*   **Linux**: Bundle `whisper` and `ffmpeg` (or rely on system ffmpeg, but bundling is safer).

## Open Questions
*   **FFmpeg**: Is it already available in the app? If not, we need to add it to convert audio formats to the 16kHz WAV required by `whisper.cpp`.
*   **Answer**: We will treat FFmpeg as a dependency to be bundled or detected.
