# Design: Pocket TTS Integration

## Context

Pocket TTS is a lightweight text-to-speech library from Kyutai Labs that runs efficiently on CPUs. It offers:
- 100M parameter model (small footprint)
- ~200ms latency to first audio chunk
- ~6x real-time synthesis speed on modern CPUs
- 8 pre-built voices with voice cloning support
- Python API and CLI with optional HTTP server mode
- Streaming audio output for long texts

This integration targets Tauri desktop users who want offline TTS without GPU requirements or cloud API costs.

## Platform Support

| Platform | Support | TTS Provider |
|----------|---------|--------------|
| Tauri Desktop (Linux) | ✅ Full | Pocket TTS (Local) |
| Tauri Desktop (macOS) | ✅ Full | Pocket TTS (Local) |
| Tauri Desktop (Windows) | ✅ Full | Pocket TTS (Local) |
| PWA / Vercel | ❌ Not supported | Fal.ai, Groq, Web Speech API fallback |

**Rationale**: Vercel cannot run native binaries, has 50MB bundle limits, and serverless timeouts make real-time TTS impractical. PWA users continue to use cloud providers (Fal/Groq) or Web Speech API fallback.

## Goals / Non-Goals

### Goals
- Provide a fully offline TTS option for **desktop users only**
- Achieve low-latency streaming playback for documents
- Offer 8 high-quality pre-built voices
- Maintain consistent UI/UX with existing TTS providers
- Support all document types (PDF, EPUB, Markdown)

### Non-Goals
- PWA/Vercel support (use Fal/Groq/Web Speech API on these platforms)
- Mobile support (Tauri mobile builds would need separate evaluation)
- Voice cloning in initial release (can be added later)
- Browser-based WASM implementation (future consideration)

## Decisions

### 1. Sidecar Binary Distribution

**Decision**: Bundle Pocket TTS as a Tauri sidecar binary compiled from Rust port (wasm-pocket-tts or pocket-tts-candle).

**Rationale**:
- Eliminates Python dependency for end users
- Single executable with no external requirements
- Consistent with existing sidecar pattern (whisper, ffmpeg, notebooklm)
- Rust port offers better performance and smaller binary size

**Alternatives considered**:
- Python AppImage: Requires Python runtime, larger distribution
- HTTP server mode: Additional process management complexity
- Direct Python integration: Requires users to have Python installed

### 2. Audio Streaming Architecture

**Decision**: Use chunked streaming with WebSocket from Tauri backend.

**Rationale**:
- Pocket TTS supports streaming output
- WebSocket provides real-time audio chunks to frontend
- Reduces perceived latency for long documents
- Consistent with existing audio playback patterns

**Implementation**:
1. Frontend sends text chunks via IPC
2. Backend invokes Pocket TTS sidecar
3. Audio chunks stream back via WebSocket
4. Frontend buffers and plays audio seamlessly

### 3. Text Extraction Strategy

**Decision**: Extract plain text from document viewers using existing content pipelines.

**Rationale**:
- EPUB: epubjs provides `book.spine.items` text extraction
- PDF: PDF.js provides `page.getTextContent()`
- Markdown: Direct content available
- Reuses existing document processing logic

### 4. Voice Storage

**Decision**: Store Pocket TTS voices as voice profiles with provider="pocket".

**Rationale**:
- Consistent with existing Fal/Groq voice profile pattern
- No schema migration required
- Voice embeddings pre-bundled with sidecar

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Large sidecar binary (~200MB) | Download on-demand; show progress in settings |
| First-run model download | Lazy load on first TTS use; cache locally |
| CPU usage during synthesis | Run on background thread; show progress indicator |
| Limited to English initially | Document limitation in UI; track multilingual roadmap |

## Migration Plan

1. **Phase 1**: Add Pocket TTS as optional provider (disabled by default)
2. **Phase 2**: Download sidecar binary on first enable
3. **Phase 3**: Migrate voice profiles to include Pocket voices
4. **Rollback**: Users can switch back to Fal/Groq anytime via settings

## Open Questions

1. ~~Should we pre-bundle the model or download on first use?~~
   - **Decision**: Download on first use to keep initial install small

2. ~~Voice cloning support in v1 or future release?~~
   - **Decision**: Future release to keep initial scope manageable

3. ~~Integration with existing `ReaderTTSControls` or new component?~~
   - **Decision**: Extend existing component with Pocket-specific streaming logic

4. ~~Should we support PWA/Vercel deployment?~~
   - **Decision**: No - Tauri desktop only. PWA uses existing cloud providers.

5. ~~How to distribute the sidecar binary?~~
   - **Decision**: Wrapper script that checks for system-installed `pocket-tts` first, then falls back to bundled binary. Users can build from source at https://github.com/kyutai-labs/pocket-tts or the Rust port at https://github.com/LaurentMazare/wasm-pocket-tts
