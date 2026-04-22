## Context

Local video/audio documents are loaded in `DocumentViewer.tsx` through a simple split:

- Browser/PWA `browser-file://` imports use an object URL from the in-memory `File`
- Tauri desktop imports always prefer `convertFileSrc(filePath)`
- Web/PWA fallback decodes the file payload into a blob URL

That desktop path is too optimistic for media. A resolved asset URL is not enough to guarantee playback. The current viewer does not distinguish between:

- asset-protocol access failures
- unsupported browser/webview container support
- unsupported codecs inside an otherwise valid container
- corrupt or empty local files

The result is the observed runtime failure:

- `LocalVideoPlayer` renders a `<video src="...">`
- the media element emits `error`
- `video.error.code === 4`
- the UI only reports a generic load failure after the fact

This is especially brittle because local transcript, progress save/restore, and extract features all assume the media element itself can be created successfully.

## Goals / Non-Goals

**Goals**

- Make local desktop video/audio playback resilient when the first resolved source is unreadable by the current webview
- Keep the current fast path for sources and formats that already work
- Distinguish transport/protocol failures from unsupported codec/container failures
- Surface actionable diagnostics in logs and user-visible errors
- Preserve existing document progress, transcript, and extract integrations once playback starts

**Non-Goals**

- Adding application-level transcoding
- Guaranteeing playback for codecs the embedded browser engine does not support
- Redesigning the local video player UI beyond the error and retry states needed for this fix
- Reworking transcript generation or storage

## Decisions

### 1. Introduce a source-resolution strategy instead of a single desktop source

**Decision**: Desktop local media loading should resolve a source strategy object, not just a string URL. The strategy should identify:

- source kind (`asset-url`, `blob-url`, or backend-served equivalent)
- MIME type
- whether the source has already been probed for playability
- fallback eligibility

**Rationale**: The current `mediaSrc: string | null` state is too weak to drive fallback and diagnostics. The viewer needs enough metadata to decide when to retry with a different source and what to log.

### 2. Keep `convertFileSrc()` as the preferred fast path, but not the only path

**Decision**: On Tauri, continue trying `convertFileSrc(filePath)` first for local media, because it avoids loading large files into memory unnecessarily. If the media element rejects that source during initial probe/load, fall back to a blob or backend-served source.

**Rationale**: The asset protocol is still the cheapest path when it works. Removing it entirely would regress large-file behavior and duplicate bytes in memory for every local video.

### 3. Probe playability before committing the source to the main player state

**Decision**: Media source resolution should include a lightweight playability probe before the UI considers the source settled. The probe should use the same `<video>`/`<audio>` capability surface that the real player relies on and classify failure reason where possible.

**Rationale**: Today the app only learns the source is broken after rendering the full player. Probing early makes fallback deterministic and keeps the eventual player UI simpler.

### 4. Classify `MediaError.code === 4` into source-access vs format support buckets

**Decision**: Error handling should treat code `4` as a bucket that needs extra classification:

- if the primary source URL is unreadable or fetch/open fails, report a source-access failure and try fallback
- if the source is readable but `canPlayType`/probe still rejects it, report unsupported codec/container guidance

**Rationale**: Users need different guidance for “the asset URL cannot be read by the webview” versus “this file uses HEVC/H.265 in an MP4 container.”

### 5. Preserve existing player integrations behind a stable resolved source

**Decision**: `LocalVideoPlayer` should continue receiving a normal playable source and keep its current progress saving, transcript syncing, and extract behavior. The new resolution/fallback logic should sit before or at the player boundary, not inside those unrelated features.

**Rationale**: This isolates the fix to source acquisition and playback diagnostics, minimizing regression risk in the rest of the media workflow.

## Risks / Trade-offs

- **Memory pressure**: Blob fallback for large files duplicates file bytes in memory. Mitigation: use it only as a fallback, not the default desktop path.
- **Probe complexity**: Media probing can add asynchronous state transitions before playback UI appears. Mitigation: keep the probe scoped to initial source selection and log the chosen strategy.
- **Browser capability ambiguity**: `canPlayType()` is imperfect and cannot fully predict decode success for every file. Mitigation: combine capability hints with real load/error probing rather than relying on one signal.
- **Platform variance**: Tauri desktop uses different webview engines across platforms. Mitigation: keep the strategy generic and platform-agnostic, but log the chosen path and failure bucket so platform-specific follow-up is possible.
