## Why

YouTube video playback fails in the AppImage build with the error "Unable to post message to https://www.youtube.com. Recipient has origin http://localhost:9527." On Linux, WebKitGTK serves the Tauri frontend from `http://localhost:<random-port>` instead of a custom protocol like macOS/Windows use. YouTube's iframe API uses `postMessage` for cross-origin communication, and the dynamic `http://localhost` origin causes WebKit to block the message exchange between the parent page and the YouTube iframe.

## What Changes

- The `origin` playerVar passed to YouTube's iframe API will be overridden to use a stable, accepted origin value instead of `window.location.origin` when running in a Tauri production build on Linux
- The CSP `frame-src` directive in `tauri.conf.json` may need adjustment to allow the production origin to communicate with YouTube iframes

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `youtube-playback`: The origin parameter sent to YouTube's iframe API must be deterministic and compatible with cross-origin postMessage in Tauri production builds on Linux/WebKitGTK

## Impact

- `src/components/viewer/YouTubeViewer.tsx` — origin parameter logic
- `src-tauri/tauri.conf.json` — CSP frame-src directive (potentially)
