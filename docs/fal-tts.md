# Fal.ai TTS Configuration

## Modes

- Direct mode: The client calls Fal.ai endpoints directly (`https://fal.run/...`) using a user-provided API key.
- Proxy mode: The client sends requests to a configured proxy URL. Use this in production if you do not want to expose provider credentials to clients.

## Required Settings

- TTS model ID: default `fal-ai/qwen-3-tts/text-to-speech/1.7b`
- Clone model ID: default `fal-ai/qwen-3-tts/clone-voice/1.7b`
- API key for direct mode, or proxy URL for proxy mode

## Voice Cloning Limits (first release)

- Supported sample formats: MP3, WAV, M4A, OGG, FLAC, WebM
- Maximum sample size: 12 MB
- Maximum sample duration: 45 seconds

## Operational Notes

- Generated audio and cloning calls can fail due to network/provider limits; the UI supports retry after transient errors.
- Presets are persisted in app settings and can be overridden per generation request without changing defaults.
- If persisted TTS settings are invalid, the app falls back to safe defaults during rehydration.
