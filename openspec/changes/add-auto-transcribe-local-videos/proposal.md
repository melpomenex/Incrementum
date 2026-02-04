# Change: Auto-transcribe local video on import

## Why
Users want transcripts available automatically for local video content without manual steps, while ensuring background processing does not overwhelm typical laptop resources.

## What Changes
- Add an **Auto-transcribe local videos** setting (default on) under Audio Transcription settings.
- On local video import, enqueue background transcription when enabled.
- Surface clear resource-usage warnings and model selection/download prompts in settings.
- Ensure transcripts are available on open if background transcription finished; otherwise show status.

## Impact
- Affected specs: transcription (new delta)
- Affected code: import pipeline, transcription queue/worker, settings UI, model management
