## Why

Users generating flashcards from video or audio documents in Review can see "0 tokens" and receive weak/no source grounding, even when transcripts exist. This causes low-quality flashcards and makes the context controls misleading.

## What Changes

- Resolve effective flashcard context text for media documents (video/audio/YouTube) using transcript sources when `document.content` is empty.
- Use resolved context text consistently for:
  - Context Control token estimates
  - Prompt context sent to generation providers
  - Chapter/search/excerpt context workflows in the modal
- Preserve current behavior for text-first documents (PDF/EPUB/HTML/Markdown).
- Add graceful fallback and user-visible behavior when transcript content is unavailable.

## Capabilities

### New Capabilities
- `review-flashcard-media-context`: Ensure flashcard generation in Review uses transcript-backed context for media documents and reports accurate token estimates.

### Modified Capabilities
- None.

## Impact

- Affected UI: Review View flashcard generation modal and context panel.
- Affected integrations: media transcript retrieval paths (local video/audio transcript API, YouTube transcript fetch path).
- No breaking API changes expected.
- Improves reliability and trust in token/cost estimation and generated-card quality for media sources.
