# Change: Audio Read-Aloud Review Mode

## Why

Readwise Reader shipped "Audio Reviews" in July 2025 — a hands-free playlist of highlights read aloud via TTS. It is the killer feature for commute / cooking / exercise scenarios where you can review passively but not tap a screen. Incrementum already has substantial TTS infrastructure (fal/groq/pocket providers, voice profiles, presets, per-card TTS buttons on `ReviewCard.tsx`), but no **hands-free review mode** that auto-speaks the front, flips, speaks the back, and advances to the next card. Autoplay exists only in `QuickReviewWidget.tsx` — not the main review session.

This change adds a toggleable audio mode to the main review session.

## What Changes

### 1. `useAudioReviewMode` hook
- New hook wrapping `useTTS`, exposing `isEnabled`, `enable()`, `disable()`, and `status` (`'idle' | 'speaking-question' | 'awaiting-flip' | 'speaking-answer' | 'advancing'`).
- When enabled, the hook orchestrates the read-aloud flow:
  1. On each new card: speak the question (or cloze prompt).
  2. After question ends: optionally auto-flip after a short delay (configurable, default 1.5s), or wait for a manual advance key.
  3. After flip: speak the answer.
  4. After answer ends: auto-advance to the next card and repeat.
- Provides `onUserAdvance()` so a key/gesture can short-circuit the current utterance and move on immediately.
- Surfaces a `lastError` so the UI can fall back to manual review if TTS fails.

### 2. `ReviewSession` integration
- New "Audio Mode" toggle button (speaker icon) in the review header.
- When enabled, wires the hook into the existing `showAnswer`/`nextCard`/`submitRating` flow.
- A floating status pill ("🔊 Reading question… / Reading answer…") shows current state.
- Default rating in audio mode is `Good` (3) — hands-free users can still override with 1/2/3/4 keys.

### 3. Settings
- Add `audioReviewMode` review preference: `{ enabled: boolean; autoFlip: boolean; autoFlipDelayMs: number; defaultRating: 1|2|3|4 }`.
- Persisted so the mode survives session restarts.

## Impact

### Affected Specs
- **audio-review-mode** — New spec for the read-aloud flow contract.

### Affected Code Areas
- `src/hooks/useAudioReviewMode.ts` — New hook.
- `src/components/review/ReviewSession.tsx` — Toggle + wire-up + status pill.
- `src/types/settings.ts` — `AudioReviewModeSettings`.
- `src/config/defaultSettings.ts` — Defaults.

### Non-goals
- No background-audio playback when the app is minimized (WebView audio-focus caveats; future work).
- No TTS-provider configuration inside the mode (uses the user's existing TTS settings).
- No per-card language detection (uses the configured TTS lang for the whole session).
