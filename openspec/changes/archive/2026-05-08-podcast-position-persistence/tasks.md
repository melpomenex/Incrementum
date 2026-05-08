## 1. Position Saving Logic

- [x] 1.1 Implement `persistPosition` helper in `AudiobookViewer.tsx` that handles both `saveDocumentPosition` and `updateEpisodePosition`
- [x] 1.2 Update `savePosition` and the auto-save heartbeats to use `persistPosition`
- [x] 1.3 Update `handlePause` to trigger an immediate `persistPosition` call
- [x] 1.4 Add a `useEffect` cleanup to trigger `persistPosition` on component unmount

## 2. Position Loading Logic

- [x] 2.1 Refactor the podcast position loading `useEffect` to apply the seek immediately if `audioRef.current` is already playable
- [x] 2.2 Ensure `pendingSeekTimeRef` is cleared correctly after application in all scenarios
- [x] 2.3 Verify that `loadSavedPosition` (document-based) and podcast-based loading work together without conflict

## 3. Verification

- [x] 3.1 Verify that pausing a podcast saves the position (check via console or DB)
- [x] 3.2 Verify that navigating away and back restores the position exactly
- [x] 3.3 Verify that promoted podcasts (in queue) correctly synchronize both position systems
