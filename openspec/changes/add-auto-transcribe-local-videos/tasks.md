## 1. Implementation
- [ ] 1.1 Add settings flag `auto_transcribe_local_videos` (default ON) under Audio Transcription settings, with warning copy about CPU/battery usage.
- [ ] 1.2 Add model selection/download prompt flow when auto-transcription is enabled but no model is installed.
- [ ] 1.3 On local video import, enqueue transcription job if setting is enabled and model is available.
- [ ] 1.4 Ensure transcription queue runs background-safe (single job, low priority where supported) and persists status for UI.
- [ ] 1.5 Update transcript viewer to show in-progress state if opened before completion.
- [ ] 1.6 Add tests/validation for settings default, import trigger, and disabled behavior.

## 2. Validation
- [ ] 2.1 Manual test: import local video with auto-transcription ON, confirm transcript appears after completion.
- [ ] 2.2 Manual test: disable auto-transcription, import local video, confirm no job is queued.
- [ ] 2.3 Manual test: enable auto-transcription without model, confirm prompt appears and no silent download occurs.
