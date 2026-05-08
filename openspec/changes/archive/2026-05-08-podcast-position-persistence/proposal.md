## Why

The podcast player (AudiobookViewer) currently fails to reliably persist and restore playback position. When a user closes a podcast, rates it, or navigates away, returning to it often resets the playback to the beginning. This creates a frustrating user experience, especially for long-form content.

The primary issues are:
1.  **Race Conditions**: The initial position is fetched asynchronously but only applied if it finishes before metadata is loaded.
2.  **Missing Save Points**: Position is only saved every 5 seconds while playing, but not consistently on pause or component unmount (navigation).
3.  **Inconsistent Tracking**: Podcasts promoted to documents use a different persistence system than regular podcasts, leading to confusion in shared components like `AudiobookViewer`.

## What Changes

- **Reliable Position Restoration**: Ensure saved position is applied regardless of when it is fetched relative to media metadata loading.
- **Robust Position Saving**: Implement immediate position saving on pause and component unmount.
- **Unified Persistence Logic**: Standardize how `AudiobookViewer` handles document-based and episode-based position tracking.
- **Aggressive Auto-save**: Maintain the 5-second auto-save heartbeat but ensure it captures the final state before termination.

## Capabilities

### New Capabilities
- `podcast-position-persistence`: Ensures reliable playback position tracking for all audio content in the AudiobookViewer.

### Modified Capabilities
- None

## Impact

- **UI**: `AudiobookViewer.tsx` will have significant internal refactoring of position loading and saving logic.
- **API**: No changes required to existing APIs (`update_episode_position`, `save_document_position`, etc.).
- **User Experience**: Users will seamlessly resume audio from where they left off across different parts of the app (Podcast section and IR Queue).
