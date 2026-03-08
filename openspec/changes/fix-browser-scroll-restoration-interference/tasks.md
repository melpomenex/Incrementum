## 1. Core Implementation

- [x] 1.1 Add `useEffect` to set `history.scrollRestoration = 'manual'` on PDF viewer mount with cleanup to restore previous value on unmount
- [x] 1.2 Add verification logging to confirm scroll restoration is app-controlled
- [x] 1.3 Verify existing `attemptRestore` retry logic waits adequately for page render completion

## 2. Testing & Verification

- [ ] 2.1 Manual test: Load a PDF, scroll to page 10, refresh - verify no bounce
- [ ] 2.2 Manual test: Navigate away from PDF, return via browser back button - verify correct position
- [ ] 2.3 Manual test: Test on Tauri/WebKitGTK to ensure no platform-specific issues
- [ ] 2.4 Verify console logs show `scrollRestoration: 'manual'` and correct restoration sequence

## 3. Cleanup

- [x] 3.1 Convert verification logging to debug-only (respects `pdfNavStabilityDebugRef`)
- [x] 3.2 Update any relevant code comments to document the scroll restoration flow
