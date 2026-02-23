## 1. Context Resolution

- [ ] 1.1 Add effective media context resolution in Review flashcard modal (`document.content` first, then transcript fallback for video/audio/YouTube).
- [ ] 1.2 Wire transcript resolution to existing media APIs (`getVideoTranscript`, YouTube transcript fetch by video ID) with non-blocking error handling.
- [ ] 1.3 Persist and update resolved context state when selected document changes.

## 2. Token + Generation Integration

- [ ] 2.1 Refactor context derivation and context control inputs to use effective resolved text instead of raw `document.content`.
- [ ] 2.2 Ensure token/cost estimators read the same effective context text used by generation.
- [ ] 2.3 Keep non-media document behavior unchanged and preserve existing generation/save workflows.

## 3. Verification

- [ ] 3.1 Validate video/audio/YouTube selection paths produce non-zero estimates when transcript exists.
- [ ] 3.2 Validate graceful fallback behavior when transcript is unavailable or fetch fails.
- [ ] 3.3 Run targeted lint/type checks for updated Review modal and related imports.
