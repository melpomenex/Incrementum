# Project Context

## Purpose
Incrementum is a Tauri 2.0 / React 19 desktop application for spaced repetition learning, document reading, and knowledge management. It supports PDF, EPUB, web articles, Kindle clippings, video transcripts, and more. Users create flashcards (extracts) from reading material and review them using FSRS/SM-18/SM-20 algorithms.

## Tech Stack
- **Backend:** Rust (Tauri 2.0), SQLite via rusqlite, Whisper for local transcription, FSRS algorithm
- **Frontend:** React 19, TypeScript, TailwindCSS, Vite
- **Key Libraries:** Three.js (Knowledge Sphere), PDF.js, epub.js, Yjs (real-time sync), Tesseract.js (OCR), Recharts (analytics)
- **Platforms:** macOS (ARM64), Windows (x86_64, WebView2), Linux (WebKitGTK)
- **Build:** Tauri CLI, Vite with `inlineDynamicImports: true`

## Project Conventions

### Code Style
- TypeScript strict mode
- TailwindCSS utility classes
- Components in `src/components/`, pages in `src/pages/`, hooks in `src/hooks/`, contexts in `src/contexts/`
- Rust commands in `src-tauri/src/`, models in `src-tauri/src/models/`

### Architecture Patterns
- Tauri commands for native operations (invoke from frontend)
- React contexts for global state (settings, theme, battery)
- Feature-based folder organization under components/
- Yjs for real-time sync with WebSocket provider
- SQLite for all persistent data

### Testing Strategy
- Vitest for frontend unit tests
- Rust tests for backend logic
- Manual testing on all 3 platforms for UI changes

### Git Workflow
- Main branch for stable releases
- Version bumps in package.json, tauri.conf.json, and Cargo.toml
- OpenSpec for spec-driven development (proposal → apply → archive)

## Domain Context
- Spaced repetition: FSRS (free), SM-18, SM-20 algorithms
- Document types: PDF, EPUB, web articles, Kindle clippings, video transcripts, images
- Extracts: highlighted text snippets turned into flashcards
- Queue: review queue with priority-based ordering
- Knowledge Sphere: 3D graph visualization of document relationships

## Important Constraints
- Tauri v2 uses `inlineDynamicImports: true` — all code in one bundle
- WebView2 on Windows, WKWebView on macOS, WebKitGTK on Linux
- Linux requires GPU workaround for some drivers (software rendering fallback)
- Rust release builds have had LLVM stability issues (documented in Cargo.toml comments)
- 65 @fontsource font packages currently bundled

## External Dependencies
- Yjs sync server: wss://sync.readsync.org
- Whisper: local transcription via whisper.cpp bindings
- OpenRouter: AI providers for summaries, flashcard generation
- Pocket TTS: text-to-speech
- fal.ai: image generation
- NewsBlur: RSS feed reading
