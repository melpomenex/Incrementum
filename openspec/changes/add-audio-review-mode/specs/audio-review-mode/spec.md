## ADDED Requirements

### Requirement: Audio review mode orchestrates a hands-free read-aloud flow
The system SHALL provide a `useAudioReviewMode` hook that, when enabled, orchestrates the following flow per card: (1) speak the question/prompt, (2) optionally auto-flip after `autoFlipDelayMs`, (3) speak the answer, (4) auto-advance to the next card. Each step SHALL transition based on the TTS engine's `onend` event.

#### Scenario: Audio mode reads a card end to end
- **WHEN** audio mode is enabled and a new card is shown
- **THEN** the hook SHALL speak the question, and after the question ends, transition to awaiting-flip

#### Scenario: Auto-flip proceeds without user input
- **WHEN** `autoFlip` is true and the question utterance ends
- **THEN** after `autoFlipDelayMs`, the hook SHALL trigger `showAnswer` and begin speaking the answer

#### Scenario: Auto-flip disabled waits for user
- **WHEN** `autoFlip` is false and the question utterance ends
- **THEN** the hook SHALL remain in `awaiting-flip` status until the user advances manually

### Requirement: User can short-circuit the current utterance
The hook SHALL expose `onUserAdvance()` that immediately stops the current TTS utterance and advances to the next logical step (flip or next card).

#### Scenario: User presses advance during question
- **WHEN** the user triggers `onUserAdvance()` while the question is being spoken
- **THEN** TTS SHALL stop and the flow SHALL advance to the answer step

### Requirement: Default rating in audio mode is configurable
When audio mode advances past a card, it SHALL submit the configured `defaultRating` (default `Good` / 3) unless the user has already rated manually. The user SHALL still be able to override with 1/2/3/4 keys.

#### Scenario: Hands-free advance submits default rating
- **WHEN** audio mode finishes speaking the answer and auto-advances
- **THEN** the previous card SHALL be submitted with `defaultRating` (3 by default)

### Requirement: Audio mode toggle is persistent
The audio-mode enabled state and its sub-settings (`autoFlip`, `autoFlipDelayMs`, `defaultRating`) SHALL persist across sessions via the review settings store.

#### Scenario: Audio mode survives restart
- **WHEN** the user enables audio mode, exits, and relaunches the app
- **THEN** audio mode SHALL remain enabled with the same sub-settings
