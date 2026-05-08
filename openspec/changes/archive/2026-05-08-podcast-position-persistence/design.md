## Context

The `AudiobookViewer` is a shared component used for playing local audiobooks (IR documents) and remote podcast episodes. It currently uses two parallel systems for position tracking:
1.  **Document System**: Uses `document.id` to save/load from the `position` table.
2.  **Podcast System**: Uses `episodeId` to save/load from the `playback_position` column in the `podcast_episodes` table.

The implementation in `AudiobookViewer.tsx` has race conditions during initialization and lacks consistency in saving during component lifecycle events (unmount, pause).

## Goals / Non-Goals

**Goals:**
- Eliminate race conditions during playback initialization.
- Ensure 100% reliable position saving on pause and navigation.
- Synchronize document and podcast positions for promoted content.

**Non-Goals:**
- Merging the two backend database tables (this is a frontend-driven synchronization).

## Decisions

### 1. Unified `persistPosition` Function
Create a unified internal function in `AudiobookViewer` that handles saving to both document and podcast systems if the corresponding IDs are present. This avoids code duplication and ensures consistency.

### 2. Immediate Seek on Data Fetch
Refactor the async position fetch to check if the audio is already loaded (`readyState >= 1`). If it is, apply the seek immediately. If not, set the `pendingSeekTimeRef` as before. This solves the race condition where metadata loads faster than the DB query returns.

### 3. Comprehensive Lifecycle Saving
- Call `persistPosition` in `handlePause`.
- Use a `useEffect` cleanup function to call `persistPosition` on unmount.
- Ensure the heartbeat (5s) continues to provide safety against crashes.

### 4. Logic for Promoted Podcasts
When a podcast is promoted to a document, `document.id` and `episodeId` may both be present in the props. The viewer should update both, as they might be accessed from different parts of the app (e.g., the Podcast section vs. the Queue).

## Risks / Trade-offs

- **[Risk] Redundant API Calls**: Saving to two systems simultaneously for promoted podcasts.
- **[Mitigation]**: This is a very low-bandwidth call (one number to SQLite). The benefit of consistency across the app outweighs the minor overhead.
- **[Risk] State Desync**: If one save fails and the other succeeds.
- **[Mitigation]**: The IR system (document position) should be treated as the primary source of truth for items in the queue, while the podcast table is the source of truth for the podcast manager. Synchronizing both ensures the user sees the same progress everywhere.
