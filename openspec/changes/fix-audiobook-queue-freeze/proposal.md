## Why

When using Queue Scroll Mode (Optimal Queue), encountering an audiobook document causes the entire app to freeze/become unresponsive. This happens because audiobook files (often hundreds of MB) are probed synchronously on the main thread — the media source resolver creates an `<audio preload="auto">` element, attempts playback, and blocks for up to 8 seconds per strategy. On fallback, the entire file is read into memory as base64. This makes the app unusable on the AppImage build on Arch Linux (and likely all platforms).

## What Changes

- Audio files in queue scroll mode will skip the synchronous `probeMediaSource()` blocking pattern and use a deferred/lazy loading approach
- `resolveLocalMediaSource()` will offer an async, non-blocking mode that doesn't create `<audio>` elements synchronously on the main thread
- Queue scroll mode will exempt audio documents from auto-advance on wheel events (like EPUB/PDF already are), preventing rapid navigation away from and back to audiobook items
- `DocumentViewer.loadDocumentData()` will handle audio documents without calling the blocking probe
- AudiobookViewer's mount-time operations (cover art fetch, metadata parse, m4b playback prep) will be debounced or deferred so they don't all fire simultaneously when first rendered in scroll mode

## Capabilities

### New Capabilities
- `audiobook-queue-scroll`: Ensures audiobook documents load correctly in queue scroll mode without blocking the main thread, including non-blocking media source resolution, scroll-mode exemption from auto-advance, and deferred audiobook initialization

### Modified Capabilities

## Impact

- **`src/components/viewer/localMediaSource.ts`**: Add non-blocking media resolution path
- **`src/components/viewer/DocumentViewer.tsx`**: Route audio documents through async loading path
- **`src/pages/QueueScrollPage.tsx`**: Exempt audio from auto-advance wheel handler
- **`src/components/viewer/AudiobookViewer.tsx`**: Defer heavy mount-time operations when in scroll mode context
