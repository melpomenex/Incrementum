## Why

Pocket TTS does not respect the user's reading position, has no audio caching causing playback interruptions (loading spinners), and lacks word-level highlighting. These gaps break the core promise of a seamless read-aloud experience — especially for long documents like books where users expect to resume from where they left off without buffering delays.

## What Changes

- TTS starts reading from the user's current position in the document (page, scroll %, or CFI) instead of always starting from the beginning
- Smart audio caching system that pre-buffers enough audio so playback never stalls (no loading spinners)
- Persistent disk-backed audio cache to avoid regenerating already-synthesized chunks across sessions
- Word-level highlighting synchronized with TTS playback, toggleable from the reader controls
- TTS auto-scroll for scroll-based documents (Markdown, HTML) so the visible area follows the spoken text
- EPUB chapter auto-advance with position-aware TTS continuation across chapter boundaries

## Capabilities

### New Capabilities
- `position-aware-tts`: TTS starts reading from the user's current document position instead of the beginning
- `tts-audio-cache`: Persistent disk-backed audio cache with smart pre-buffering that prevents playback interruptions
- `word-highlighting`: Real-time word-level highlighting synchronized with TTS audio, toggleable from reader controls
- `tts-auto-scroll`: Automatic scrolling of scroll-based documents (Markdown, HTML) to follow TTS playback position

### Modified Capabilities
<!-- No existing specs to modify -->
- *(none)*

## Impact

- **src/components/common/ReaderTTSControls.tsx**: Core rewrite to integrate position-aware start, pre-buffering, and word-highlighting callbacks
- **src/api/tts.ts / src/api/pocketTts.ts**: Add cache-aware generation (check cache before API call)
- **src/utils/ttsTextExtraction.ts**: Add position-to-chunk mapping, scroll position tracking, word-offset calculation
- **src/hooks/useTTS.ts**: Minor updates for word-highlighting integration
- **src/components/viewer/DocumentViewer.tsx**: Wire position state to TTS, add auto-scroll for Markdown/HTML
- **src/components/viewer/PDFViewer.tsx**: Expose per-page text for position-aware TTS
- **src/components/viewer/EPUBViewer.tsx**: Expose CFI-to-chapter mapping for cross-chapter TTS continuation
- **src/types/position.ts**: May need extended position types for word-offset tracking
- **New file: src/utils/ttsCache.ts**: Disk-backed audio cache using Tauri filesystem APIs
- **New file: src/utils/wordHighlighter.ts**: Word-level highlight synchronization logic
- **New file: src/components/common/WordHighlightLayer.tsx**: Overlay component for word highlighting in reader views
- **Dependencies**: May require Tauri `fs` permission for disk cache; no new external libraries
