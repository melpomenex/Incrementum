# Proposal: One-click local transcription for audiobooks (CPU-first)

## Goals

*   Add a **Transcript** feature that works fully offline after setup.
*   Make setup **one click**: download models + runtime, configure defaults, verify with a quick self-test.
*   Keep it **CPU-first** (most users), with optional GPU acceleration when available.
*   Provide clear choices:
    *   **English-only** → fast, light default (Distil-Whisper).
    *   **Multilingual** → reliable multilingual model on CPU (Whisper small/base via an efficient runtime).

## User experience

### Entry points

1.  **Transcript menu** on a book:
    *   If ASR not installed: show a setup card with a single **“Enable Transcripts”** button.
    *   If installed: show transcript view and progress.

2.  **Settings → Transcription**
    *   Toggle: **Enable local transcription**
    *   Dropdown: **Language mode**
        *   English-only (recommended)
        *   Multilingual
        *   Auto-detect (multilingual models only; slower)
    *   Dropdown: **Speed vs accuracy**
        *   Fast (default)
        *   Balanced
        *   Accurate
    *   Controls:
        *   “Download / Update models”
        *   “Clear models & data”
        *   “Run test transcription”

### One-click setup flow

*   User clicks **Enable Transcripts**
*   App:
    1.  Detects platform + CPU capabilities (AVX2/AVX512 on x86, Apple Silicon, etc.)
    2.  Picks recommended backend + model based on language selection
    3.  Downloads required assets (runtime + model) with progress bar
    4.  Runs a 10–20 second self-test on a bundled audio sample
    5.  Marks ASR as ready

## Architecture

### High-level components

1.  **Model Manager**
    *   Knows available model “profiles” (english-only fast, multilingual balanced, etc.)
    *   Downloads assets, verifies SHA256, stores in app-managed directory
    *   Handles updates and rollback (keep previous working version)

2.  **Transcription Engine Adapter**
    *   Unified interface:
        *   `transcribe_chunk(audio, start_time)`
        *   `finalize()`
        *   emits segments `{start_ms, end_ms, text, confidence?}`
    *   Backends:
        *   **Native backend (preferred)**: `whisper.cpp` binary + quantized model files
        *   **Optional Python backend**: `faster-whisper` (only if you already ship Python)

3.  **Job Queue**
    *   Background tasks per audiobook/chapter
    *   Priority: current chapter first, next chapters queued
    *   Pauses/resumes; respects CPU limits; “Only when plugged in” option

4.  **Transcript Store**
    *   SQLite tables:
        *   `transcripts(book_id, chapter_id, model_id, created_at, ...)`
        *   `segments(transcript_id, start_ms, end_ms, text, ...)`
    *   Fast seek: use timestamp indexes for “highlight as audio plays”

5.  **UI Binding**
    *   Transcript view shows partial results as they arrive
    *   Optional karaoke highlighting: find nearest segment by playback time

## Model options (CPU-first)

### Default recommendation

#### English-only (fast/light): Distil-Whisper `distil-small.en`

*   Good speed/size tradeoff for clean audiobook narration.
*   Ship choice: **distil-small.en** as the default English profile.

**Profile: English Fast (default)**

*   Backend: `whisper.cpp` (preferred for desktop distribution)
*   Model: distil-small.en (or base.en fallback if distil isn’t compatible in your chosen backend)
*   Quantization: Q5/Q4 (depending on quality goals; Q5 typically safer for accuracy)

### Multilingual (CPU-friendly and reliable)

**Recommendation: Whisper small (multilingual)**

*   Backend: `whisper.cpp`
*   Model: Whisper small (multilingual)
*   Quantization: Q5/Q4

**Profile: Multilingual Balanced**

*   Target: good accuracy for many languages, still reasonable on CPU
*   Model: Whisper small (multilingual), quantized

**Profile: Multilingual Fast**

*   Model: Whisper base (multilingual), quantized
*   Better speed, less accuracy than small

**Profile: Multilingual Accurate**

*   Model: Whisper medium (multilingual), quantized
*   Heavier CPU hit; keep it as an explicit option, not default

## Backend choice: ship a native runtime by default

### Preferred: `whisper.cpp` as the embedded engine

Why:

*   Easy to ship as a platform-specific binary
*   Strong CPU performance
*   Quantized models make it practical on typical machines
*   Avoid bundling Python

Implementation plan:

*   Bundle a small launcher/wrapper that:
    *   Feeds PCM audio
    *   Requests timestamps
    *   Parses JSON output
*   Or run the binary as a subprocess and stream chunks (stdin/stdout)

## “On the fly” transcription strategy (works well for audiobooks)

*   Transcribe by **chapter** in the background.
*   Chunking:
    *   20–30s chunks with 1–2s overlap
    *   VAD optional (audiobooks are usually continuous speech, VAD not strictly required)
*   Context stitching:
    *   Provide previous segment text as context to improve punctuation/continuity
*   Store incrementally:
    *   Commit segments to DB as they arrive so the Transcript menu populates immediately

## Failure handling (important for one-click UX)

*   If download fails: retry + resume partial download
*   If model load fails: auto-fallback to the next supported profile (e.g., distil → base.en)
*   If transcription errors: show a non-blocking warning and provide “Re-run with different profile”

## Recommendation summary

*   If user selects **English-only**:
    *   Install **English Fast** profile (Distil-Whisper small.en if supported; else Whisper base.en), quantized, via whisper.cpp.
*   If user selects **Multilingual**:
    *   Install **Multilingual Balanced** (Whisper small multilingual), quantized, via whisper.cpp.
