## Spec: Podcast Playback via AudiobookViewer

### Integration Point

Podcast episodes use the existing `AudiobookViewer` component for audio playback. The component already handles:
- Audio playback with play/pause/seek
- Playback position tracking
- Variable speed
- Whisper transcription triggers

### Changes to AudiobookViewer

1. **Accept remote audio URL** — currently expects local file content. Add a `remoteAudioUrl?: string` prop that skips file loading and sets the `<audio>` src directly.
2. **Persist position to podcast_episodes table** — on timeupdate (debounced), call `update_episode_position`. On load, call `get_episode_position` to restore.
3. **Episode metadata header** — show podcast title, episode title, and formatted duration above the player controls.

### DocumentViewer Integration

- In `DocumentViewer`, detect when the document is a podcast episode (via `source` field or `item_type`).
- Route to `AudiobookViewer` with `remoteAudioUrl` set to `episode.audio_url`.
- When an episode finishes playing (or user navigates away), save position and optionally mark as played.

### Scroll Queue Integration

- In `QueueScrollPage.tsx`, add a "podcast" type to `ScrollItem`.
- Load unplayed podcast episodes (via `get_podcast_episodes` with `include_played: false`).
- When user swipes to a podcast item, render `AudiobookViewer` with the episode's audio URL.
- Respect `rssQueue` settings pattern — add parallel `podcastQueue` settings for inclusion/exclusion/limits.
