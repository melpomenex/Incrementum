# Change: Fix local video playback source resolution

## Why
Local video playback currently fails in the desktop viewer with a browser media error:

`[LocalVideoPlayer] Video error: Error code 4`

`MediaError.code === 4` means the browser refused the media source rather than failing normal playback controls. The current `DocumentViewer` media path prefers `convertFileSrc(filePath)` for every Tauri video/audio document and hands that URL directly to `<video>`. When the webview cannot read that asset URL, or the file container/codec is unsupported, the player only reports a generic runtime error after render time and offers no fallback path.

This makes local playback brittle for desktop-imported files and obscures the real failure mode.

## What Changes
- Add a dedicated local media source resolution flow for video/audio documents instead of treating `convertFileSrc()` as the only desktop playback path.
- Probe media playability before rendering the player and fall back when the primary asset URL is unreadable or unsupported by the current webview.
- Distinguish transport failures from codec/container failures so `LocalVideoPlayer` can show actionable errors instead of a generic "could not be loaded" message.
- Preserve the current fast path for formats that already play correctly, while allowing a blob or backend-served fallback for files that fail asset-protocol playback.
- Log the resolved source strategy and failure reason so playback bugs can be diagnosed from app logs.

## Impact
- Affected specs: new `local-media-playback`
- Related specs: `local-video-transcripts` (playback must remain compatible with transcript loading and time sync)
- Affected code:
  - `src/components/viewer/DocumentViewer.tsx` - media source selection and fallback orchestration
  - `src/components/viewer/LocalVideoPlayer.tsx` - playback probing, error classification, and retry behavior
  - `src/lib/tauri.ts` and any Tauri media-serving/config layer needed to expose a reliable fallback URL
  - `src-tauri/src/commands/video.rs` or related backend file access commands if a streamed desktop fallback is required
- Risk: Medium - touches desktop media loading paths and must avoid regressions for existing working MP4/WebM playback and transcript/progress integrations
