## Context

Incrementum needs a cross-platform TTS feature that works in Tauri Desktop, Web, and PWA with one coherent settings workflow. The change introduces Fal.ai Qwen 3 TTS integration, user voice cloning from uploaded clips, reusable presets, and persistent defaults across app surfaces. Existing architecture already supports shared frontend modules and platform-aware persistence, but there is no current TTS domain model, no settings UI for voice assets, and no Fal.ai integration path.

## Goals / Non-Goals

**Goals:**
- Provide a Settings-based TTS workflow for API configuration, voice cloning, and preset management.
- Enable users to upload voice clips and create reusable cloned voices backed by Fal.ai.
- Enable TTS generation using cloned voices or built-in presets with robust UX feedback.
- Persist TTS settings, voices metadata, and defaults consistently across Desktop/Web/PWA.
- Keep integration adaptable for either direct Fal.ai calls or backend-proxy routing.

**Non-Goals:**
- Building a full audio editor, waveform manipulation tools, or pronunciation dictionary UI.
- Supporting multiple TTS vendors in this change.
- Defining pricing/billing flows for Fal.ai usage.
- Implementing server-side user/team sharing of cloned voices beyond local account context.

## Decisions

### 1) Introduce a dedicated TTS settings domain model
Decision: Add a typed TTS configuration model containing provider config, voice profiles, system presets, user presets, and selected defaults.
Rationale: A single domain model ensures deterministic persistence and avoids ad-hoc state spread across UI components.
Alternatives considered:
- Store each setting independently in component-local storage: rejected due to drift and migration risk.
- Add only minimal flags first: rejected because voice and preset metadata must be first-class entities for stable UX.

### 2) Use a service abstraction around Fal.ai APIs
Decision: Implement a `ttsService` layer with explicit methods for clip upload, voice clone creation, and speech generation.
Rationale: Encapsulates API contracts, error mapping, retries, and future provider/proxy switching.
Alternatives considered:
- Call Fal.ai directly from UI components: rejected due to duplication and poor testability.
- Build backend-only integration now: deferred because current scope targets cross-platform client readiness while preserving proxy option.

### 3) Persist settings via existing cross-platform persistence adapters
Decision: Reuse current platform-aware storage abstraction for Desktop/Web/PWA with schema versioning for TTS settings.
Rationale: Ensures parity across app targets and lowers migration complexity.
Alternatives considered:
- Separate per-platform storage implementations in feature module: rejected due to divergence risk.
- Server-only persistence: out of scope and incompatible with offline/PWA expectations.

### 4) Ship curated presets plus user-selectable defaults
Decision: Include pre-defined quality/speed/style presets and allow user default selection and override per generation.
Rationale: Users can get useful output quickly while still enabling tailored behavior.
Alternatives considered:
- No presets, raw parameters only: rejected due to poor usability.
- Presets only, no override: rejected because advanced users need control.

### 5) Add explicit request lifecycle states in UI
Decision: Model async states (`idle`, `uploading`, `cloning`, `generating`, `success`, `error`) for each TTS operation.
Rationale: Prevents ambiguous UX and supports clear recovery actions.
Alternatives considered:
- Single global loading flag: rejected; insufficient for concurrent operations and granular feedback.

## Risks / Trade-offs

- [Fal.ai API limits, latency, or transient failures] -> Mitigation: add retries with bounded backoff, user-facing error messages, and cancel/retry controls.
- [Handling provider credentials in client contexts] -> Mitigation: centralize credential access and support proxy mode to avoid exposing sensitive keys.
- [Large or invalid audio uploads causing failure churn] -> Mitigation: enforce client-side validation for size, format, and duration before upload.
- [Cross-platform persistence incompatibilities] -> Mitigation: versioned schema with migration guards and startup validation.
- [Preset drift from upstream model parameter changes] -> Mitigation: preserve preset metadata with model version and include fallback defaults.

## Migration Plan

1. Add TTS domain schema and persistence migration with a default empty settings payload.
2. Introduce Fal.ai service abstraction and wire it behind existing networking utilities.
3. Add Settings UI section for provider config, voice cloning, and preset/default management.
4. Add TTS generation integration points where text playback is initiated.
5. Validate parity in Desktop/Web/PWA and verify persisted settings are read and written correctly.
6. Rollback strategy: gate new UI with feature flag and ignore TTS persisted payload if migration/version check fails.

## Open Questions

- Should production environments mandate backend proxy mode for Fal.ai requests, or allow direct client calls in all targets?
- What clip duration/file-size bounds best balance cloning quality and latency for first release?
- Should generated audio be cached locally by hash to reduce repeated generation costs?
