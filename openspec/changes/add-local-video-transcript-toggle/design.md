## Context
Local video playback already has a “Panels” slide-over (VideoFeatures) and a background transcription queue, but transcript viewing is buried inside the panels UI rather than a YouTube-style transcript toggle. Auto-transcription on import exists, yet the playback UI does not make transcript availability or status obvious.

## Goals / Non-Goals
- Goals:
  - Mirror the YouTube viewer layout for local videos: transcript toggle + optional side/below layout.
  - Preserve the existing Panels slide-over behavior and controls.
  - Use existing transcription settings (model/profile + language) as defaults for auto-transcription.
  - Keep transcription in the background with best-effort CPU usage so playback does not stutter.
- Non-Goals:
  - Introducing new transcription engines or model formats.
  - GPU scheduling or advanced system-level CPU throttling beyond current queue controls.

## Decisions
- Decision: Reuse `TranscriptSync` to render local video transcripts in the main viewer area.
  - Why: keeps UI consistency with YouTube and leverages existing seek/highlight interactions.
- Decision: Keep `VideoFeatures` as the Panels slide-over content for local videos, matching YouTube’s “Panels” button behavior.
  - Why: it already hosts bookmarks, chapters, transcript, and extracts.
- Decision: Use the existing transcription queue (`videoTranscriptionQueue`) for auto-transcribe jobs, but schedule as idle/low-priority and single-threaded.
  - Why: minimizes CPU contention and reduces playback stutter risk.
- Decision: Seed transcript generation defaults from Audio Transcription settings (model/profile + language) and use those settings for auto-transcribe.
  - Why: aligns with user’s expectation that their chosen Whisper model is used consistently.

## Risks / Trade-offs
- Risk: Background transcription can still cause CPU spikes on low-end hardware.
  - Mitigation: keep queue serialized, prefer idle callbacks, and allow auto-transcribe to pause/slow while playback is active.
- Risk: UI complexity increases in LocalVideoPlayer due to transcript layout options.
  - Mitigation: mirror YouTube viewer UI patterns to keep controls familiar.

## Migration Plan
- No data migrations required.
- Existing transcripts continue to render via existing storage/commands.

## Open Questions
- None.
