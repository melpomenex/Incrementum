## 1. TTS Domain And Persistence Foundation

- [x] 1.1 Define typed TTS settings models for provider config, voice profiles metadata, preset catalog, and selected defaults.
- [x] 1.2 Add TTS settings persistence adapter wiring for Desktop/Web/PWA with schema versioning and safe default initialization.
- [x] 1.3 Implement load/save validation guards so invalid persisted payloads fail safely and fall back to defaults.

## 2. Fal.ai Service Integration

- [x] 2.1 Add a `ttsService` module that wraps Fal.ai Qwen 3 TTS operations for clip upload, voice clone creation, and synthesis.
- [x] 2.2 Implement request/response mapping for Fal.ai payloads, including voice and preset parameters required by generation.
- [x] 2.3 Add retry/error mapping utilities for transient provider/network failures with actionable UI-safe error messages.

## 3. Settings UI: TTS Section

- [x] 3.1 Add a TTS section in Settings shared across Tauri Desktop, Web App, and PWA routing/layout surfaces.
- [x] 3.2 Build controls for provider configuration and default voice/preset selection bound to persisted TTS state.
- [x] 3.3 Add curated preset list rendering and allow changing the saved default preset from Settings.
- [x] 3.4 Add field validation and inline error states for required TTS settings inputs.

## 4. Voice Cloning Workflow

- [x] 4.1 Add reference clip upload UI with client-side validation for supported format, duration, and file-size constraints.
- [x] 4.2 Implement clone submission flow that calls the Fal.ai service and stores returned cloned voice metadata.
- [x] 4.3 Add cloning lifecycle states (`uploading`, `cloning`, `success`, `error`) with retry guidance in Settings.
- [x] 4.4 Allow selecting any successfully cloned voice as the persisted default TTS voice.

## 5. TTS Generation Workflow

- [x] 5.1 Integrate TTS generation trigger path with saved defaults for voice and preset when no override is provided.
- [x] 5.2 Add per-request override controls for voice/preset that do not mutate persisted defaults.
- [x] 5.3 Implement generation lifecycle states (`generating`, `success`, `error`) and expose playable audio output on success.
- [x] 5.4 Add retry flow for failed generation requests without mutating saved voice/preset data.

## 6. Quality, Compatibility, And Release Safety

- [x] 6.1 Add unit/integration tests for TTS persistence, Fal.ai service mappings, and error handling branches.
- [x] 6.2 Add cross-platform verification coverage for Desktop/Web/PWA settings parity and persistence restore behavior.
- [x] 6.3 Add migration/feature-flag safeguards and rollback behavior for invalid TTS schema or failed rollout.
- [x] 6.4 Document configuration expectations (direct vs proxy mode) and operational limits for cloning/generation.
