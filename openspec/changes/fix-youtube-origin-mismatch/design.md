## Context

The app uses `react-youtube` to embed YouTube videos via an iframe. The YouTube IFrame API communicates with the parent page using `postMessage`, which requires origin matching. In `YouTubeViewer.tsx:948`, the `origin` playerVar is set to `window.location.origin`.

On macOS/Windows Tauri builds, `window.location.origin` returns `tauri://localhost` (custom protocol). On Linux AppImage builds with WebKitGTK, it returns `http://localhost:<random-port>` (e.g., `http://localhost:9527`). This dynamic HTTP origin causes WebKit to block postMessage exchanges between the parent page and the YouTube iframe, producing the error: "Unable to post message to https://www.youtube.com. Recipient has origin http://localhost:9527."

## Goals / Non-Goals

**Goals:**
- YouTube iframe API postMessage communication works correctly in AppImage builds on Linux
- Maintain existing YouTube playback behavior on all other platforms (dev, macOS, Windows)

**Non-Goals:**
- Changing the Tauri custom protocol configuration
- Modifying CSP beyond what's needed for this fix
- Changing the YouTube embed host selection logic (youtube.com vs youtube-nocookie.com)

## Decisions

### 1. Override `origin` playerVar for Tauri production builds

**Decision**: Detect when running in Tauri production (not dev server) and pass a stable origin to YouTube's iframe API instead of `window.location.origin`.

**Rationale**: `window.location.origin` returns a random `http://localhost:<port>` in AppImage builds. YouTube's iframe API validates the origin parameter for postMessage security. A consistent origin ensures YouTube can correctly target postMessage responses.

**Implementation**: Use `tauri://localhost` as the origin when running in Tauri production on Linux. This matches the custom protocol origin used on macOS/Windows and is what YouTube expects for Tauri apps. Detect production via `isTauri()` check combined with checking if the protocol is not `http:` (dev mode).

**Alternative considered**: Remove the `origin` parameter entirely — rejected because YouTube's iframe API may not send postMessage responses without it, breaking the JS API (playback tracking, state changes).

**Alternative considered**: Use `*` as the origin — rejected as insecure and may not be accepted by YouTube.

### 2. Keep CSP `frame-src` as-is

**Decision**: No changes to CSP `frame-src` directive.

**Rationale**: The current CSP already allows `https://*.youtube.com` and `https://*.youtube-nocookie.com` in `frame-src`. The issue is postMessage origin matching, not iframe loading. The CSP is not the bottleneck.

## Risks / Trade-offs

- **Risk**: `tauri://localhost` origin may not match WebKitGTK's actual origin for postMessage validation → Mitigation: Test in AppImage build; if it doesn't work, fall back to using `window.location.origin` with a `postMessage` event listener that doesn't filter by origin
- **Risk**: Future Tauri/WebKitGTK versions may change origin behavior → Mitigation: The fix is localized to one line and easy to adjust
