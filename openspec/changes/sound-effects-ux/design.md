## Context

Incrementum is a Tauri v2 desktop app + PWA for spaced repetition. The sound system (`soundService.ts`) uses the Web Audio API with a singleton `AudioContext` and has two modes:

1. **Synthesized oscillator tones** for UI feedback (9 types: success, error, warning, complete, click, delete, review-complete, streak, milestone)
2. **File-based MP3 sounds** for notifications (bell, chime, ding, complete — generated via `scripts/generate-sounds.mjs` using ffmpeg)

A `useHapticFeedback` hook wraps sound + visual feedback with convenience methods, but **no component currently imports it**. The only active sound in the app is the notification sound triggered by `notificationService.ts` and the focus timer's `playTimerComplete()`.

The synthesized tones use raw oscillator waveforms (`square`, `sawtooth`) that sound harsh. The harmonic scheduling has a bug: `setTimeout` uses `cfg.duration * 500` which produces millisecond values that are too short (e.g., `0.2 * 500 = 100ms` instead of a proper delay).

Both Tauri (WebView) and PWA (browser) share the same frontend code and Web Audio API path, so a single implementation serves both platforms.

## Goals / Non-Goals

**Goals:**
- Wire sound feedback into the most impactful user interactions (review completion, card rating, streaks, milestones, deletions)
- Replace crude oscillator tones with pleasant, professionally designed MP3 sound effects
- Fix the audio scheduling bugs (harmonic timing, use `AudioContext.currentTime` instead of `setTimeout`)
- Let users control feedback sound volume independently from notification volume
- Sound effects are **opt-in** (off by default) — users must explicitly enable them in settings
- Add Vibration API haptic feedback for mobile PWA users alongside audio and visual feedback
- Ensure reliable playback on both Tauri desktop and PWA (handle autoplay policy)

**Non-Goals:**
- Custom sound packs or user-uploaded sounds (future enhancement)
- Spatial audio or advanced audio effects
- TTS or media playback changes (separate concerns)
- Custom vibration patterns beyond simple duration-based patterns
- Changing notification sounds (already working, keep as-is)

## Decisions

### 1. Use MP3 files for all feedback sounds instead of synthesized oscillators

**Choice:** Generate 9 MP3 files (one per `FeedbackType`) using ffmpeg, similar to the existing notification sounds.

**Rationale:** Oscillator tones with `square` and `sawtooth` waveforms sound harsh and unpolished. MP3 files give us precise control over timbre, envelope, and harmonic content. The existing `scripts/generate-sounds.mjs` already demonstrates the pattern — we extend it.

**Alternative considered:** Using a Web Audio API graph with multiple oscillators + filters to create richer synthesized sounds. Rejected because: (a) more complex to maintain, (b) harder to get professional-sounding results, (c) MP3 generation with ffmpeg is already proven in the project.

### 2. Fix audio scheduling to use `AudioContext.currentTime` instead of `setTimeout`

**Choice:** Schedule harmonics and multi-tone sequences using `osc.start(ctx.currentTime + delay)` and `osc.stop(ctx.currentTime + delay + duration)`.

**Rationale:** `setTimeout` is unreliable for audio timing — it's subject to event loop jitter and doesn't account for the audio clock. Using `AudioContext.currentTime` gives sample-accurate scheduling. This also fixes the existing bug where `cfg.duration * 500` produces incorrect delays.

### 3. Integrate via `useHapticFeedback` hook — not direct `playTone` calls

**Choice:** Components import and call `useHapticFeedback` (which already exists), rather than importing `soundService` directly.

**Rationale:** The hook already encapsulates sound + visual feedback, respects the `soundEnabled` setting, and provides named methods (`success()`, `complete()`, `streak()`, etc.). No need to duplicate that logic. We just need to actually use it.

### 4. Opt-in defaults for feedback sounds

**Choice:** `feedbackSoundsEnabled` defaults to `false`. Users must explicitly enable UI sound effects in settings.

**Rationale:** Sound effects are subjective — some users find them annoying or distracting, especially in quiet environments. Shipping them off by default respects user preferences and avoids negative first impressions. The notification sound system remains independent and unaffected.

### 5. Separate volume controls for feedback vs notification sounds

**Choice:** Add a `feedbackVolume` field to settings (alongside existing `soundVolume` for notifications), with its own slider in the settings UI.

**Rationale:** Feedback sounds happen frequently during a review session. Users may want quiet feedback but louder notifications (or vice versa). A single volume control forces a compromise.

### 6. Vibration API for PWA haptic feedback

**Choice:** Call `navigator.vibrate(pattern)` inside `useHapticFeedback` when available, with duration patterns mapped to feedback types (e.g., 10ms for click, 50ms for success, [100, 50, 100] for milestone).

**Rationale:** Mobile PWA users benefit from physical vibration feedback, which is standard in native mobile apps. The Vibration API is widely supported on mobile browsers and is a no-op on desktop/Tauri where it's unavailable. No polyfill needed — just a feature check: `if ('vibrate' in navigator)`.

**Alternative considered:** Using the Generic Sensor API or experimental haptic feedback APIs. Rejected due to poor browser support. Vibration API is the only well-supported option.

### 7. Sound design philosophy: subtle, non-intrusive, rewarding

**Choice:** Feedback sounds should be short (100-400ms), use sine waves with gentle envelopes, and avoid jarring frequencies below 200Hz. Success sounds ascend, error sounds are neutral (not punishing), milestones are celebratory.

**Rationale:** A spaced-repetition app demands positive reinforcement. Harsh error sounds feel punishing and reduce motivation. Sounds should complement the UI, not compete with it.

### 8. Lazy AudioContext initialization with user-gesture resume

**Choice:** Keep the existing pattern of creating `AudioContext` lazily and calling `resume()` on user interaction. Ensure the first call always happens within a user gesture handler (click, tap, keydown).

**Rationale:** Both Tauri WebView and PWA browsers require user gesture for `AudioContext` to start. The current lazy singleton pattern handles this correctly — we just need to ensure all initial calls happen within user gestures (which they will, since feedback sounds are triggered by user actions).

## Risks / Trade-offs

- **[Sound fatigue]** → Short durations (100-300ms for most) and low default volume (0.15-0.25) minimize fatigue. Users can disable entirely.
- **[PWA autoplay policy]** → First sound must happen after user interaction. Since all feedback sounds are triggered by user actions (button clicks, card swipes), this is naturally satisfied.
- **[Audio file size]** → 9 MP3 files at ~2-5KB each = ~30KB total. Negligible impact on bundle size.
- **[AudioContext state on tab switch]** → Browsers may suspend `AudioContext` when tab is in background. The existing `resume()` call in `getAudioContext()` handles this. No action needed.
- **[Visual feedback CSS not loaded]** → The `useHapticFeedback` hook's visual effects depend on `HAPTIC_FEEDBACK_CSS` being injected. Currently no component injects it. We need to ensure this CSS is added (likely via a global style import or inline in the hook).
- **[Vibration API not available]** → Feature-checked at runtime. Falls back to audio-only feedback on desktop/Tauri. No error thrown.
- **[Default-off means low adoption]** → Consider adding a one-time prompt after the user's first review session completes, inviting them to enable sounds. (Optional future enhancement, not in scope for this change.)
