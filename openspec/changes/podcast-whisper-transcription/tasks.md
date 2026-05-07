# Tasks: Podcast Whisper Transcription

## Phase 1: Backend (Rust)
- [ ] **Task 1**: DB migration — add transcript columns to podcast_episodes, auto_transcribe + transcribe_language to podcast_feeds
- [ ] **Task 2**: Update PodcastEpisode/PodcastFeed models and response types with new fields
- [ ] **Task 3**: `transcribe_podcast_episode` command — download audio via reqwest, run TranscriptionEngine, store transcript, create extracts, emit progress events
- [ ] **Task 4**: `get_podcast_transcript` command — return transcript text + segments
- [ ] **Task 5**: `cancel_podcast_transcription` command — cancellation token map
- [ ] **Task 6**: `set_feed_auto_transcribe` command — update feed settings
- [ ] **Task 7**: Auto-transcribe hook — after `refresh_podcast_feed`, check auto_transcribe and queue transcription for new unplayed episodes

## Phase 2: Frontend
- [ ] **Task 8**: Add transcript API functions to `src/api/podcast.ts` (transcribe, getTranscript, cancelTranscription, setAutoTranscribe)
- [ ] **Task 9**: Browser sync endpoints for new commands
- [ ] **Task 10**: Transcribe button + progress bar + status states on episode cards in PodcastManager
- [ ] **Task 11**: Transcript viewer panel (slide-in with full text, timestamps, search, copy)
- [ ] **Task 12**: "Chat About This" button — create transcript document, open Assistant with context
- [ ] **Task 13**: Feed context menu additions — auto-transcribe toggle, language setting
- [ ] **Task 14**: Error/retry states for failed transcriptions

## Phase 3: Polish
- [ ] **Task 15**: Auto-transcribe new episodes (background job after feed refresh)
- [ ] **Task 16**: Extract generation from transcript segments
- [ ] **Task 17**: Update CHANGELOG and cut release
