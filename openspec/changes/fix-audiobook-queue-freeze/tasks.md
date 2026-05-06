## 1. Skip synchronous media probing for audio documents

- [x] 1.1 In `DocumentViewer.loadDocumentData()`, add a check: if `inferredType === "audio"`, skip the `resolveLocalMediaSource()` call and instead set the media source directly using `convertFileSrc(filePath)` (the same approach AudiobookViewer already uses internally)
- [x] 1.2 Verify the audio file path is passed to AudiobookViewer's `filePath` prop correctly and that the viewer initializes its own source without relying on a pre-resolved URL from DocumentViewer

## 2. Exempt audio from scroll-mode auto-advance

- [x] 2.1 In `QueueScrollPage.tsx` wheel handler (around line 1096-1107), add `docType === "audio"` to the condition that currently exempts `"epub"` and `"pdf"` from auto-advance
- [x] 2.2 Verify that keyboard navigation (Up/Down) and navigation buttons still work to move away from an audio document

## 3. Loading state for audiobook in scroll mode

- [x] 3.1 Add a loading placeholder in the audiobook rendering path within QueueScrollPage that shows while AudiobookViewer is initializing
- [x] 3.2 Ensure the loading state resolves once the audiobook player reports readiness (or after a reasonable timeout)

## 4. Verify and test

- [x] 4.1 Test queue scroll mode with a mix of document types (PDF, EPUB, audio, RSS, flashcards) to confirm no freezes
- [x] 4.2 Test that audiobooks still play correctly when opened directly (not via scroll mode)
- [x] 4.3 Test that the AppImage build on Linux no longer freezes on audiobook queue items
