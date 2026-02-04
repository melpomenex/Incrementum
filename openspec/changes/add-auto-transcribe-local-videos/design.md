## Context
Auto-transcription must start on import for local video files, run in the background, and avoid heavy resource usage on typical laptops. The system already has a local transcription proposal and queue concept, but auto-triggering and resource safety are not defined.

## Goals / Non-Goals
- Goals:
  - Auto-enqueue transcription for local video imports when enabled.
  - Keep CPU usage modest (single-job queue, background priority) to reduce user impact.
  - Prompt for model selection/download when auto-transcription is enabled but no model exists.
  - Provide clear settings warnings about resource impact.
- Non-Goals:
  - Auto-transcription for YouTube videos.
  - Multi-language detection or diarization beyond selected model behavior.

## Decisions
- Decision: Trigger auto-transcription at import time for local video documents.
  - Why: Ensures transcript availability before first open when possible.
- Decision: Enforce a single active transcription job and apply low-priority execution hints when available.
  - Why: Minimizes system impact and aligns with laptop constraint.
- Decision: Model download is user-initiated via a prompt in settings with model descriptions.
  - Why: Avoids silent large downloads and clarifies trade-offs.

## Risks / Trade-offs
- Risk: Background transcription could still impact battery and thermals on low-end devices.
  - Mitigation: Warnings in settings and ability to disable auto-transcription.
- Risk: Import workflows slow if transcription starts immediately.
  - Mitigation: Queue runs asynchronously; import completes without waiting.

## Migration Plan
- Add new setting with default ON in settings store/migration.
- Add import hook that enqueues transcription only for local video and only when model is installed.
- If model not installed, set a pending state and prompt user on next settings visit.

## Open Questions
- Should there be a per-document opt-out toggle, or only global?
- What specific model options/descriptions should be shown (matching existing Whisper profiles)?
