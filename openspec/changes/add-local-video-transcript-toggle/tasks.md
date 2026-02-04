## 1. Implementation
- [ ] 1.1 Mirror YouTube viewer controls in `LocalVideoPlayer`: add transcript toggle and layout switch (side/below) in the header controls.
- [ ] 1.2 Render a transcript panel for local videos using `TranscriptSync`, bound to local transcript segments and current playback time.
- [ ] 1.3 Ensure the “Panels” button in local video mirrors YouTube behavior (same label, placement, slide-over width persistence).
- [ ] 1.4 Align transcript status messaging in local video UI with `VideoFeatures`/queue status (queued/processing/completed/failed/needs-model).
- [ ] 1.5 Use Audio Transcription settings for auto-transcribe defaults (model/profile + language) and pass them into queued jobs.
- [ ] 1.6 Ensure background transcription is best-effort (idle scheduling, serialized jobs; pause/slow when playback is active if needed).
- [ ] 1.7 Add lightweight UI/flow validation steps for local video transcript toggle + auto-transcribe.

## 2. Validation
- [ ] 2.1 Import a local video with auto-transcribe enabled; confirm transcription is queued and playback remains smooth.
- [ ] 2.2 Toggle transcript panel on/off and switch layout modes while playing; confirm no stutter and seek works from transcript.
- [ ] 2.3 Open Panels and confirm bookmarks/chapters/transcript/extracts match YouTube viewer behavior.
