## 1. Origin Detection and Override

- [x] 1.1 In `YouTubeViewer.tsx`, add a helper that computes the correct YouTube iframe API origin: if running in Tauri production (protocol is not `http:`), return `https://www.youtube.com` as the origin; otherwise return `window.location.origin`
- [x] 1.2 Replace the hardcoded `origin: window.location.origin` in the `youtubeOpts.playerVars` object (line 948) with a call to the new helper

## 2. Verification

- [x] 2.1 Verify the change doesn't break dev mode playback (origin should remain `window.location.origin` when protocol is `http:`)
- [x] 2.2 Test or verify the logic handles the AppImage case where `window.location.origin` returns `http://localhost:<port>` — the origin should be overridden to a stable value that YouTube accepts for postMessage communication
