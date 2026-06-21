# Implementation Tasks

## 1. Hook
- [ ] 1.1 Create `src/hooks/useAudioReviewMode.ts`
- [ ] 1.2 Orchestrate question → flip → answer → advance flow using `useTTS`
- [ ] 1.3 Expose `isEnabled`, `enable`, `disable`, `status`, `onUserAdvance`, `lastError`

## 2. Settings
- [ ] 2.1 Add `AudioReviewModeSettings` type + defaults (`autoFlip`, `autoFlipDelayMs`, `defaultRating`)

## 3. ReviewSession integration
- [ ] 3.1 Add audio-mode toggle button to review header
- [ ] 3.2 Wire hook into `showAnswer` / `nextCard` / `submitRating`
- [ ] 3.3 Floating status pill showing current state

## 4. Spec
- [ ] 4.1 Write `specs/audio-review-mode/spec.md`
