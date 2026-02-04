# Change: YouTube-style transcript and panels for local videos

## Why
Local videos already support background transcription, but the playback UI does not mirror the YouTube viewer. Users want a familiar transcript toggle and a Panels button with the same functionality, plus automatic background transcription that uses their existing Whisper settings without stuttering playback.

## What Changes
- Add a YouTube-style transcript toggle and transcript panel layout controls to the local video player.
- Mirror the YouTube “Panels” button behavior for local videos (video features panel with bookmarks, chapters, transcript, extracts).
- Ensure auto-transcription on import uses the user’s existing transcription settings and runs in a best-effort background mode to avoid playback stutter.
- Surface transcription status consistently in the local video transcript UI.

## Impact
- Affected specs: local-video-transcripts (new)
- Related changes: add-local-transcription, add-auto-transcribe-local-videos (builds on existing work)
- Affected code: local video player UI, video transcription queue/status, import flow, audio transcription settings
