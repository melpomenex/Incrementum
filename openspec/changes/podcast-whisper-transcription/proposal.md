# Podcast Whisper Transcription Pipeline

## Problem
Podcast episodes are stream-only — they play in the AudiobookViewer but there's no way to transcribe them with Whisper, create extracts from the transcript, or chat about their content with the AI assistant. The existing Whisper pipeline (`generate_audiobook_transcript`) only works on local files.

## Solution
Build a full pipeline: download remote podcast audio → transcribe with Whisper → extract key segments → attach transcript to episode → enable AI chat on the transcript content.

## Scope
- **In scope**: Download + transcribe remote podcast audio, progress tracking, transcript storage, AI chat integration
- **Out of scope**: Batch transcription of multiple episodes, automatic transcription on subscribe, cloud Whisper API (local only for now)

## Dependencies
- Existing Whisper transcription engine (`src-tauri/src/transcription/`)
- Existing ModelManager for Whisper model management
- Existing podcast DB tables and commands
- Existing assistant/AI chat infrastructure
