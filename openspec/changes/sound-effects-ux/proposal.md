## Why

The codebase has a fully functional sound service (`soundService.ts`) with synthesized feedback tones for 9 event types and 4 notification MP3 files, plus a `useHapticFeedback` hook that combines audio with visual effects. However, **no component in the app actually uses the haptic feedback hook or plays any feedback sounds during user interactions**. The only sound that fires is the notification sound when a timer or reminder triggers. This means users get no audio feedback for everyday actions — completing a review session, rating a card, navigating, etc. — which is a missed opportunity for a spaced-repetition app where positive reinforcement matters.

## What Changes

- Wire the existing `useHapticFeedback` hook into key user interactions across the app (review session completion, card rating, study streaks, milestones, delete actions, navigation taps)
- Replace the crude synthesized oscillator tones with high-quality, carefully designed MP3 sound effects — the current `square` and `sawtooth` waveforms for error/delete sound harsh and unprofessional
- Add a new **opt-in** "UI Sound Effects" toggle in notification settings (off by default) with independent feedback volume control, separate from notification sounds
- Add Vibration API support for haptic feedback on mobile PWA devices, triggered alongside audio/visual feedback
- Ensure sounds and haptics work reliably on both Tauri desktop and PWA/webapp (Web Audio API is shared, but AudioContext initialization timing and autoplay policies differ)
- Fix the `harmonic` timing bug in `playTone` where `setTimeout` uses `cfg.duration * 500` (producing milliseconds like 100ms) instead of a proper delay like `cfg.duration * 400` with `ctx.currentTime` scheduling

## Capabilities

### New Capabilities
- `ui-sound-feedback`: Wiring sound and haptic feedback into user interactions — which events get sounds, how they trigger, opt-in defaults, and the hook integration pattern
- `pwa-haptic-feedback`: Vibration API integration for mobile PWA — device vibration patterns mapped to feedback types
- `sound-quality-upgrade`: Replacing synthesized tones with high-quality MP3 assets and proper audio scheduling (fixing timing bugs)

### Modified Capabilities
_None — no existing specs are being changed at the requirement level._

## Impact

- **Frontend components**: Review session screens, card rating buttons, deck list views, delete confirmation dialogs, navigation elements will import and call `useHapticFeedback`
- **`soundService.ts`**: Will be updated to use file-based sounds instead of raw oscillators for feedback types, and fix the harmonic timing bug
- **`scripts/generate-sounds.mjs`**: Will be extended to generate all 9 feedback sound MP3s (currently only generates notification sounds)
- **Settings UI**: New sound feedback controls (volume slider, theme picker) added to the notification settings tab
- **i18n**: New translation keys for the sound feedback settings
- **Platform compatibility**: No new dependencies — Web Audio API works on both Tauri WebView and PWA browsers. Vibration API (`navigator.vibrate`) is used on mobile PWA for haptic feedback, gracefully degrading on desktop/Tauri where it's unsupported.
