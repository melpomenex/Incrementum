## Context

The current TTS system in incrementum-tauri processes the full document text as a single blob, chunked into ~420-char segments. Playback always starts from chunk 0 regardless of the user's position in the document. Audio is stored only in an in-memory `Map<number, BufferedAudio>` and is discarded when the component unmounts or the text changes. For Pocket TTS (local, slow), pre-buffering uses a 12-second lookahead window with EMA speed tracking, but buffer underruns still occur — showing a "Buffering next segment..." spinner.

Word-level TTS highlighting does not exist: the `onChunkStart` callback is wired in `ReaderTTSControls` but no consumer passes a handler. Scroll-based documents (Markdown, HTML) do not auto-scroll to follow TTS position.

Pocket TTS is the primary target because it is local/free and is where the latency and underrun problems are worst. However, the design generalizes to all providers (Fal.ai, Groq, Web Speech).

## Goals / Non-Goals

**Goals:**
- TTS resumes from the user's exact document position (page, scroll %, CFI) instead of chunk 0
- Zero playback stalls due to audio generation latency (disk + aggressive pre-buffer)
- Persistent on-disk audio cache so chunks are never regenerated within or across sessions
- Word-level highlighting toggleable from reader controls, synced to audio playback
- Auto-scroll for Markdown/HTML documents that follows TTS position
- EPUB chapter auto-advance with position-continuous TTS across chapter boundaries

**Non-Goals:**
- Offline-first TTS (still requires initial API call for uncached chunks)
- Real-time TTS streaming (still generates complete audio clips per chunk)
- Multi-voice TTS within a single playback session
- Highlighting granularity finer than word-level (no phoneme or sub-word)

## Decisions

1. **Disk cache via Tauri fs API** — Use `@tauri-apps/plugin-fs` to write/read WAV/MP3 files to `{appCacheDir}/tts-cache/`. Cache key is `{provider}:{voice}:{speed}:{textHash}`. Index is stored in a JSON manifest (`cache-index.json`) for O(1) lookup. This avoids bloating IndexedDB with binary data.

2. **Position-to-chunk mapping** — Add a `TextPositionIndex` that maps document positions (page numbers for PDF, CFI for EPUB, char offsets for scroll docs) to chunk indices and word offsets. Built upfront when text is loaded. This lets TTS start from any arbitrary position.

3. **Aggressive pre-buffering with waterfall** — Instead of a fixed lookahead, use a waterfall strategy: maintain a `MIN_BUFFER_SEC = 60` target across all providers (not just Pocket). Generate chunks in priority order (immediately needed > pre-buffer > far-ahead). When a chunk finishes playing, immediately queue the next one. Parallel generation limited by provider throughput.

4. **Word highlighting via DOM range tracking** — For each viewer type: PDF uses PDF.js text layer spans, EPUB uses epubjs contenteditable/cfi ranges, Markdown uses rendered DOM text nodes with known offsets, HTML uses iframe postMessage. A `WordHighlighter` class maps word offsets to DOM ranges/elements and applies a highlight class.

5. **Auto-scroll via scrollIntoView** — For scroll-based documents, calculate the DOM offset of the current TTS word and call `element.scrollIntoView({ block: 'center' })` on each word boundary. Debounced to avoid jank.

6. **EPUB chapter bridging** — When TTS reaches the end of a chapter's chunks, trigger the next chapter load via the existing EPUB viewer API, wait for content to render, then continue TTS from the new chapter's chunk 0 (the chapter itself IS the position unit for EPUB).

## Risks / Trade-offs

- **Disk cache size** — Audio files accumulate over time. Mitigation: LRU eviction policy (max 500 MB), configurable in settings, with a periodic cleanup pass.
- **Cache invalidation** — Voice/speed changes invalidate cache. Mitigation: include voice+speed in cache key; old entries are evicted by LRU.
- **Word highlighting accuracy** — PDF text layers have unpredictable spacing/ordering. Mitigation: fall back to chunk-level highlighting (highlight the sentence) when word-level is unreliable.
- **EPUB chapter load latency** — Loading a new chapter has a non-trivial async delay. Mitigation: pre-load the next chapter when TTS is within 2 chunks of chapter end.
- **Memory pressure** — Large books could produce many cached audio files. Mitigation: stream from disk rather than loading all into memory; keep only 5 chunks ahead in memory.
