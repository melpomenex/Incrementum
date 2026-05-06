## Context

Queue Scroll Mode renders documents one at a time in a vertical swipe/scroll interface. When a document's type is `"audio"`, `DocumentViewer` mounts and calls `resolveLocalMediaSource()` in `loadDocumentData()`. This function uses `probeMediaSource()`, which creates a real `<audio preload="auto">` DOM element, calls `.play()`, and blocks the main thread for up to 8 seconds waiting for a playable signal. For large audiobook files (100MB+), this causes the entire app to freeze.

The fallback strategy reads the entire file into memory as base64, decodes to bytes, creates a blob URL, and probes again — doubling the freeze time and memory usage.

Additionally, the scroll mode's wheel handler only exempts EPUB and PDF from auto-advance. Audio documents have no scrollable content area, so any wheel event immediately navigates away — potentially triggering the same loading cascade on the next document.

## Goals / Non-Goals

**Goals:**
- Eliminate main-thread blocking when queue scroll mode encounters an audiobook
- Allow audiobook playback to begin asynchronously without freezing the UI
- Prevent accidental auto-advance away from an audiobook that is still loading

**Non-Goals:**
- Changing how audiobooks play outside of scroll mode (standalone DocumentViewer)
- Changing the audiobook player UI or feature set
- Optimizing audiobook file sizes or streaming protocols

## Decisions

### 1. Add non-blocking `resolveMediaSourceAsync()` alongside existing `resolveLocalMediaSource()`

The existing function uses a polling loop with `setInterval` to check if a source is playable. The new async variant will use `Promise`-based detection instead of synchronous probing — it creates the `<audio>` element, attaches event listeners for `canplay`/`error`, and resolves/rejects without blocking. This keeps the existing sync path untouched for non-scroll-mode usage.

**Alternative considered**: Modify `probeMediaSource()` to accept a timeout of 0. Rejected because the fundamental issue is synchronous DOM probing, not just the timeout length.

### 2. `DocumentViewer` detects audio type and uses async loading path

When `inferredType === "audio"`, skip `resolveLocalMediaSource()` entirely and pass the file path directly to `AudiobookViewer`. The AudiobookViewer already has its own media initialization logic (including `convertFileSrc` and `prepareAudiobookPlayback`). The probe was redundant for audio files since the player itself will handle source resolution.

**Alternative considered**: Add a `skipProbe` parameter to `resolveLocalMediaSource()`. Rejected because it adds complexity to a function that doesn't need it — the audiobook player can manage its own source.

### 3. Exempt audio from scroll-mode auto-advance

Add `"audio"` to the set of types exempt from auto-advance in the wheel handler (alongside `"epub"` and `"pdf"`). This prevents the scroll handler from navigating away from an audiobook before it has loaded.

### 4. Show loading skeleton for audiobook in scroll mode

While the audiobook initializes asynchronously, show a loading placeholder so the user sees feedback instead of a blank screen.

## Risks / Trade-offs

- **AudiobookViewer may still be slow to initialize**: Cover art fetching and metadata parsing run on mount, but these are async and won't block the main thread. Acceptable tradeoff — the UI remains responsive while loading.
- **`prepareAudiobookPlayback()` IPC call**: This Tauri backend call could be slow for large files, but it runs off the main thread via IPC. No freeze risk.
- **Direct file path to AudiobookViewer**: Skipping the probe means we lose the source-validation step. If the file path is invalid, the error surfaces in the player instead of during document load. Acceptable — the player already has error handling UI.
