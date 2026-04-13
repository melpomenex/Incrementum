## ADDED Requirements

### Requirement: All feedback sounds use MP3 files
The system SHALL play feedback sounds from pre-generated MP3 files (in `public/sounds/`) instead of synthesized oscillator tones. Each `FeedbackType` SHALL have a corresponding MP3 file.

#### Scenario: Success feedback plays MP3
- **WHEN** the `success` feedback is triggered
- **THEN** the system plays `public/sounds/success.mp3` via `AudioBufferSourceNode`

#### Scenario: Error feedback plays MP3
- **WHEN** the `error` feedback is triggered
- **THEN** the system plays `public/sounds/error.mp3` via `AudioBufferSourceNode`

#### Scenario: All 9 feedback types have MP3 files
- **WHEN** any of the 9 `FeedbackType` values is triggered (success, error, warning, complete, click, delete, review-complete, streak, milestone)
- **THEN** the corresponding MP3 file is fetched, decoded, and played

### Requirement: Feedback sound generation script produces all 9 sounds
The `scripts/generate-sounds.mjs` script SHALL generate MP3 files for all 9 feedback types, using ffmpeg with sine waves, gentle envelopes, and musically appropriate frequencies.

#### Scenario: Running the sound generation script
- **WHEN** a developer runs `node scripts/generate-sounds.mjs`
- **THEN** 13 MP3 files are created in `public/sounds/` (4 existing notification sounds + 9 new feedback sounds)

#### Scenario: Each sound has appropriate character
- **WHEN** the sounds are generated
- **THEN** success/error/warning/complete sounds are short (100-300ms) and use sine waves
- **AND** streak/milestone sounds are slightly longer (300-500ms) with ascending or celebratory character
- **AND** click/delete sounds are very short (50-150ms) and subtle

### Requirement: Audio scheduling uses AudioContext time
Multi-element sounds (harmonics, sequences) SHALL be scheduled using `AudioContext.currentTime` instead of `setTimeout` for sample-accurate timing.

#### Scenario: Harmonic plays at correct time
- **WHEN** a sound with a harmonic component is played
- **THEN** the harmonic tone starts at the correct delay using `osc.start(ctx.currentTime + delay)`
- **AND** no `setTimeout` is used for audio scheduling

#### Scenario: Focus timer complete sound uses precise timing
- **WHEN** `playTimerComplete` plays its two-tone sequence
- **THEN** both tones are scheduled using `AudioContext.currentTime` with a 250ms gap

### Requirement: Sound files are cached after first load
Each MP3 file SHALL be fetched and decoded only once, then cached in memory for subsequent plays.

#### Scenario: Second play of same sound
- **WHEN** a feedback sound is played for the second time
- **THEN** the system uses the cached `AudioBuffer` instead of fetching the file again

### Requirement: Feedback sound design is subtle and non-punishing
All feedback sounds SHALL use sine wave oscillators with gentle attack/release envelopes. Error and warning sounds SHALL be neutral (descending tone or soft buzz), not harsh or punishing.

#### Scenario: Error sound is not jarring
- **WHEN** the error feedback sound plays
- **THEN** it uses a sine wave with a gentle envelope (no square/sawtooth waveforms)
- **AND** the duration is under 300ms

#### Scenario: Success sound is ascending
- **WHEN** the success feedback sound plays
- **THEN** it uses an ascending tone pattern that feels rewarding
