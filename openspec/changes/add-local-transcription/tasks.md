# Tasks: Add Local Transcription

## Environment & Assets
- [ ] **Asset Acquisition**: detailed script/instructions to download `whisper.cpp` and `ffmpeg` binaries for target platforms and place them in `src-tauri/bin`. <!-- id: assets -->
- [ ] **Tauri Config**: Update `tauri.conf.json` to register `whisper` and `ffmpeg` as external binaries (sidecars). <!-- id: config -->

## Backend (Rust)
- [ ] **Database Migration**: Create SQL migration for `transcripts` and `transcript_segments` tables. <!-- id: db-migration -->
- [ ] **Model Manager**: Implement `ModelManager` struct to handle downloading, verifying, and listing Whisper models (`ggml`). <!-- id: model-manager -->
- [ ] **FFmpeg Wrapper**: Implement helper to convert input audio (mp3/m4b) to 16kHz WAV using the `ffmpeg` sidecar. <!-- id: ffmpeg -->
- [ ] **Transcription Engine**: Implement `TranscriptionEngine` to spawn `whisper` sidecar, parse streaming JSON output, and handle errors. <!-- id: engine -->
- [ ] **Job Queue**: Implement a queue system to manage transcription tasks (one at a time) and persist status to DB. <!-- id: queue -->
- [ ] **Tauri Commands**: Expose commands: `get_transcript`, `start_transcription`, `cancel_transcription`, `get_model_status`, `download_model`. <!-- id: commands -->

## Frontend (React)
- [ ] **API Layer**: Add `invoke` wrappers in `src/api/transcription.ts`. <!-- id: api -->
- [ ] **Settings UI**: Add "Transcription" section in Settings to manage models (download/delete) and preferences (language/profile). <!-- id: settings-ui -->
- [ ] **Transcript Store**: Create `useTranscriptStore` to manage active transcripts and real-time updates. <!-- id: store -->
- [ ] **Transcript View**: Create `TranscriptPanel` component to display segments. <!-- id: view -->
- [ ] **Sync Logic**: Implement auto-scrolling and highlighting based on current audio playback time. <!-- id: sync -->
- [ ] **Integration**: Add "Transcript" button to the Reader interface and connect to the new panel. <!-- id: integration -->
