# Change: Add Pocket TTS Integration for Local CPU-based Text-to-Speech

## Why

Users want a privacy-focused, offline-capable TTS solution that doesn't require cloud API keys or external services. Pocket TTS from Kyutai Labs provides high-quality speech synthesis that runs entirely on CPU with low latency (~200ms to first audio), making it ideal for desktop use. Current TTS options (Fal.ai, Groq) require internet connectivity and paid API usage.

## What Changes

- Add "Pocket TTS" as a new local TTS provider option alongside Fal.ai and Groq
- Bundle Pocket TTS as a Tauri sidecar binary for seamless desktop integration
- Integrate 8 pre-built voices (alba, marius, javert, jean, fantine, cosette, eponine, azelma)
- Add voice selection UI in Settings > Text To Speech
- Extend TTS controls in document viewers (PDF, EPUB, Markdown) for Pocket TTS
- Implement audio streaming for low-latency playback of long documents
- Add automatic text chunking optimized for Pocket TTS streaming

## Impact

- Affected specs:
  - `tts` (new capability spec)
  - `settings` (modify for new provider)
- Affected code:
  - `src/api/tts.ts` - Add Pocket TTS provider integration
  - `src/components/settings/TTSSettings.tsx` - UI for voice selection
  - `src/hooks/useTTS.ts` - Hook support for streaming audio
  - `src/components/common/ReaderTTSControls.tsx` - Pocket TTS controls
  - `src-tauri/src/` - Sidecar integration and IPC
  - `src/types/settings.ts` - TTSSettings type updates
  - `src/utils/ttsSettings.ts` - Voice profiles for Pocket TTS
