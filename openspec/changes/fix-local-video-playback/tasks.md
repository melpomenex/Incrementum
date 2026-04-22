## 1. Source resolution

- [ ] 1.1 Refactor `DocumentViewer.tsx` media loading so local desktop media resolves a structured source strategy instead of a bare URL string.
- [ ] 1.2 Keep `convertFileSrc(filePath)` as the preferred Tauri fast path for local media, but add a fallback source path for unreadable/rejected media.
- [ ] 1.3 Ensure fallback source creation preserves the correct MIME type for video and audio documents.

## 2. Playback probing and diagnostics

- [ ] 2.1 Add an initial media probe that validates the resolved source before treating it as ready for playback.
- [ ] 2.2 Classify load failures into source/protocol failures versus unsupported codec/container failures.
- [ ] 2.3 Update `LocalVideoPlayer.tsx` error messaging and retry behavior to use the classified failure reason and the resolved source strategy.
- [ ] 2.4 Log the chosen source strategy and fallback reason so local playback failures are diagnosable from app logs.

## 3. Regression safety

- [ ] 3.1 Verify local video progress save/restore still works after source resolution changes.
- [ ] 3.2 Verify transcript loading and transcript-driven seek still work for playable local videos.
- [ ] 3.3 Verify both video and audio documents still load through the shared media path.

## 4. Validation

- [ ] 4.1 Test a known-good local MP4/WebM file in Tauri and confirm the fast path still plays without fallback.
- [ ] 4.2 Test a file that reproduces `MediaError.code === 4` and confirm the app either falls back to a working source or shows a more specific unsupported-format/source-access error.
- [ ] 4.3 Run OpenSpec validation for `fix-local-video-playback`.
