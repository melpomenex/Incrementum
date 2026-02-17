## Why

Incrementum currently has no built-in text-to-speech workflow, which blocks users who want audio-first review and accessibility support. Adding Fal.ai-powered TTS now enables a unified, cross-platform experience where users can generate speech with cloned voices and reusable presets directly from app settings.

## What Changes

- Add a TTS settings section where users can configure Fal.ai access, create and manage voice profiles, and manage generation presets.
- Add voice cloning support by allowing users to upload a sample clip and create a reusable cloned voice profile.
- Add text-to-speech generation using Fal.ai Qwen 3 TTS with selectable voices and presets.
- Persist TTS configuration and selected defaults across Tauri Desktop App, Web App, and PWA.
- Add validation, error handling, and status feedback for upload, clone creation, and TTS generation operations.

## Capabilities

### New Capabilities
- `tts-settings-management`: Manage TTS provider settings, voice profiles, and default preset selection in Settings UI with cross-platform persistence.
- `tts-voice-cloning`: Upload user audio clips to create and store cloned voices for later TTS use.
- `tts-generation-with-presets`: Generate speech using Fal.ai Qwen 3 TTS with system presets and user-selected voice/preset combinations.

### Modified Capabilities
- None.

## Impact

- Frontend settings surfaces in `src/` for TTS management UX across desktop/web/PWA.
- Shared client-side state/persistence layer for TTS configuration defaults and cloned voice metadata.
- API/service integration layer for Fal.ai upload, cloning, and synthesis calls, including credential handling and retries.
- Potential backend proxy or secure token flow updates if direct client Fal.ai access is restricted by environment policy.
