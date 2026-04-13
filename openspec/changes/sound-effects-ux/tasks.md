## 1. Sound Asset Generation

- [x] 1.1 Extend `scripts/generate-sounds.mjs` to generate 9 feedback MP3s (success, error, warning, complete, click, delete, review-complete, streak, milestone) with sine waves, gentle envelopes, and musically appropriate frequencies
- [x] 1.2 Run the script and verify all 13 MP3 files exist in `public/sounds/` with reasonable quality and short durations

## 2. Sound Service Improvements

- [x] 2.1 Update `soundService.ts` to load feedback sounds from MP3 files via the existing `getAudioBuffer`/`playFile` pattern instead of raw oscillators
- [x] 2.2 Replace all `setTimeout`-based audio scheduling in `playTone` and `playTimerComplete` with `AudioContext.currentTime` scheduling for sample-accurate timing
- [x] 2.3 Add a `FEEDBACK_SOUND_FILES` map linking each `FeedbackType` to its MP3 path (e.g., `success: '/sounds/success.mp3'`)
- [x] 2.4 Update `playFeedback()` to route through the file-based player with feedback volume from settings

## 3. PWA Haptic Vibration

- [x] 3.1 Add a `VIBRATION_PATTERNS` map in `soundService.ts` mapping each `FeedbackType` to a vibration duration/pattern (e.g., click: 10, success: 50, milestone: [100, 50, 100])
- [x] 3.2 Add a `vibrate()` function in `soundService.ts` that calls `navigator.vibrate(pattern)` with a feature check (`if ('vibrate' in navigator)`) and silent fallback
- [x] 3.3 Wire `vibrate()` calls into `useHapticFeedback` so vibration fires alongside audio on supported devices

## 4. Settings: Feedback Volume Control (Opt-In)

- [x] 4.1 Add `feedbackVolume` (default 0.3) and `feedbackSoundsEnabled` (default **false**) fields to `NotificationSettings` interface in `settingsStore.ts`
- [x] 4.2 Update `NotificationSettings.tsx` to include an "UI Sound Effects" toggle (off by default) and a feedback volume slider, independent from notification volume
- [x] 4.3 Wire the new settings into `useHapticFeedback` so it reads `feedbackVolume` and `feedbackSoundsEnabled` — both audio and haptic respect this toggle

## 5. Wire Haptic Feedback into Components

- [x] 5.1 Inject `HAPTIC_FEEDBACK_CSS` globally (import in `App.tsx` or `main.tsx` via a `<style>` tag or CSS module) so visual feedback animations work
- [x] 5.2 Wire `useHapticFeedback` into `ReviewCard.tsx` — play `click` sound on card rating button press
- [x] 5.3 Wire `useHapticFeedback` into `ReviewComplete.tsx` — play `complete` sound (and `streak` if applicable) when review session finishes
- [x] 5.4 Wire `useHapticFeedback` into delete confirmation dialogs (`DeleteConfirmDialog.tsx` and any deck/extract delete modals) — play `delete` sound on confirm
- [x] 5.5 Wire `useHapticFeedback` into error toast/display paths — play `error` sound when user-facing errors occur
- [x] 5.6 Wire `useHapticFeedback` into milestone detection (review count milestones, level-up events) — play `milestone` sound with confetti

## 6. i18n

- [x] 6.1 Add English translation keys for "UI Sound Effects" toggle label and any new settings labels
- [x] 6.2 Add translation keys for other supported locales (fr, de, es, ja, zh) — can be placeholder English initially

## 7. Testing & Verification

- [x] 7.1 Test all 9 feedback sounds play correctly on Tauri desktop
- [x] 7.2 Test all 9 feedback sounds play correctly on PWA (browser)
- [x] 7.3 Test vibration fires on mobile PWA and degrades silently on desktop/Tauri
- [x] 7.4 Test that UI Sound Effects is off by default — no sounds or vibration until user enables it
- [x] 7.5 Test that disabling UI sound effects silences feedback but keeps notifications working
- [x] 7.6 Test rapid card ratings don't cause audio clipping or overlap issues
- [x] 7.7 Verify settings persist correctly (feedback volume and toggle survive app restart)
