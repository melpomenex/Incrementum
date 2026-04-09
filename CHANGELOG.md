# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.18.0] - 2026-04-09

### Changed
- Bumped app, package, Tauri, and Rust crate version metadata to `1.18.0`.

## [1.17.0] - 2026-04-08

### Added
- Imported the full legacy `index.html` theme catalog into the app, including more than a hundred built-in themes and lightweight animated backdrop variants for the legacy animated themes.
- Added theme backdrop rendering infrastructure so animated themes can show motion without relying on expensive full-screen effects.

### Changed
- Browser-imported web content now opens in an editable article workspace instead of being treated as a mostly static HTML snapshot.
- Browser extension captures and AI summaries now queue locally when the desktop app is offline and sync automatically when the app becomes reachable again.

### Fixed
- Browser extension extract flows now cache offline, sync on reconnect, and show clearer toast/status feedback.
- Browser extension AI summary saves now persist the generated summary itself as an extract through the same online/offline sync path.
- Browser extension shortcut registration, extension icons, and popup/runtime invalidation handling were cleaned up.
- Theme animation visibility was reworked so animated themes render motion through a lightweight backdrop layer instead of collapsing into static solid-color shells.

## [1.16.0] - 2026-04-07

### Added
- **Shared sound service** - Consolidated three separate AudioContext implementations (notification beep, focus timer, haptic feedback) into a single shared `soundService.ts` with singleton AudioContext management, eliminating duplicate code and resource leaks
- **Notification sound picker** - Users can now choose from multiple notification sounds (default tone, bell, chime, ding, complete) with a volume slider and preview button in Settings > Notifications
- **Bundled audio files** - Added 4 synthesized audio files (bell, chime, ding, complete) in `public/sounds/` for richer notification sounds beyond the basic oscillator beep
- **Background reminders** - Periodic Background Sync API integration for PWA: the service worker wakes up periodically to check for due review cards and shows local notifications, with no server or database required
- **PWA icon generation** - Script to generate all required PWA icon sizes from the source SVG

### Changed
- `useHapticFeedback` now reads sound toggle from `notifications.soundEnabled` instead of the non-existent `appearance.soundEnabled` field, so haptic sounds actually respect the notification settings toggle
- Focus timer uses the shared sound service instead of creating its own AudioContext on each timer completion
- Notification service delegates sound playback to the shared sound service

### Fixed
- **PWA installability** - Generated all 8 missing PNG icon files referenced by manifest.json (only `icon.svg` and `sprout.png` existed before, causing 404s and Lighthouse failures)
- **Manifest display mode** - Changed from `fullscreen` to `standalone` for proper Lighthouse compliance and better UX (users get standard navigation controls)
- **Maskable icons** - Split 192x192 and 512x512 icons into separate `any` and `maskable` entries for correct Lighthouse validation
- **Missing screenshots** - Removed screenshot references from manifest (files didn't exist, not required for installability)
- **Offline fallback status** - Service worker offline page now returns HTTP 200 instead of 503, matching Lighthouse requirements

## [1.14.2] - 2026-03-16

### Fixed
- **Vercel deployment fixes** - Resolved build failures on Vercel platform
  - Fixed `.vercelignore` to allow source files needed for the build
  - Fixed `index.html` to use relative paths for Vite build compatibility
  - Resolved Python function packaging issues with proper `pyproject.toml` configuration
- Minor import ordering cleanup in PWA module

## [1.14.0] - 2026-03-15

### Added
- **Pocket TTS Integration** - Local CPU-based text-to-speech for offline, privacy-focused audio playback
  - New "Pocket TTS" provider option alongside Fal.ai and Groq cloud TTS
  - 8 pre-built voices: alba, marius, javert, jean, fantine, cosette, eponine, azelma
  - Bundled as a Tauri sidecar binary for seamless desktop integration
  - Low-latency synthesis (~200ms to first audio) running entirely on CPU
  - Automatic text chunking optimized for streaming long documents
  - Voice selection UI in Settings > Text To Speech
  - Integrated TTS controls in document viewers (PDF, EPUB, Markdown)

### Changed
- Extended TTS settings schema to support Pocket TTS provider configuration
- Updated TTS hook and controls for streaming audio playback support

## [1.13.0] - 2026-03-01

### Added
- Next-gen SRS scheduling controls, including desired-retention targeting, scoped FSRS policies (global/deck/tag), one-step review undo, and non-mutating cram sessions.
- Advanced review interactions: typed answers with fuzzy grading, progressive hints, ordering/matching flows, conversational review, accessibility helpers, and clipboard quick-add capture.
- New analytics surfaces for workload forecasting and memory decay, including retention-aware heatmap overlays and a dedicated forgetting-curve panel.
- Content and integration expansion: podcast/audio import transcription, PDF highlight extraction, inline dictionary lookup, reference-import helpers, printable flashcard export, and plugin host lifecycle support.
- Wave 4 study tooling, including social/collaboration helpers, energy tracking, and reading-speed/ETA support.

### Changed
- Expanded Rust command/API plumbing, repository/migration schema, and frontend store/API wiring to support the new SRS platform capabilities end to end.
- Updated review, analytics, learning, and settings UI flows to expose new controls and telemetry-backed behavior in both desktop and browser-backed paths.

### Fixed
- Strengthened review interaction correctness and regression coverage across scope resolution, semantic grading, accessibility, reference import, collaboration helpers, and performance-sensitive paths.

## [1.12.11] - 2026-02-27

### Fixed
- Android Gradle `BuildTask` cargo resolution now prefers hosted toolcache cargo binaries (including `RUST_TOOLCHAIN`-pinned paths) before falling back to `~/.cargo/bin/cargo`, avoiding CI runner proxy layout issues during `rustBuildArm64Release`.

## [1.12.10] - 2026-02-27

### Fixed
- Android mobile CI now writes a stable `~/.cargo/bin/cargo` wrapper that delegates to the resolved real cargo binary, preventing Gradle `:app:rustBuildArm64Release` spawn failures on ephemeral runner cargo/rustup layouts.

## [1.12.9] - 2026-02-27

### Fixed
- Android mobile CI now exports `CARGO` as the discovered real cargo binary path (instead of forcing `~/.cargo/bin/cargo` symlink), preventing Gradle `rustBuildArm64Release` failures when spawning cargo.

## [1.12.8] - 2026-02-27

### Fixed
- Windows CI prebuild no longer hard-requires `notebooklm-<target>.exe` when NotebookLM runtime bundling is disabled, preventing `npm run build` failures in `build (windows-latest)` before Tauri packaging.

## [1.12.7] - 2026-02-27

### Fixed
- Mobile CI `prebuild` now correctly honors `SKIP_NOTEBOOKLM_SIDECAR=1`, so iOS/Android validation jobs can build frontend assets without failing on missing `notebooklm-<target>` sidecar binaries.

## [1.12.6] - 2026-02-27

### Fixed
- CI sidecar provisioning now always materializes a NotebookLM sidecar launcher when missing, preventing macOS/release bundle failures on missing `bin/notebooklm-<target>`.
- AppImage CI now bootstraps the bundled NotebookLM portable runtime when source runtime assets are incomplete before runtime injection/verification.
- Arch release packaging no longer forces `RUSTFLAGS=-Clink-arg=-lsqlite3`, avoiding linker failures (`DSO missing from command line`) in Arch container builds.

## [1.12.5] - 2026-02-27

### Fixed
- Fixed Android mobile CI Cargo bootstrap to prevent a self-referential `cargo` symlink (`Too many levels of symbolic links`) that stopped Android builds before compilation.

## [1.12.4] - 2026-02-27

### Fixed
- Hardened Android mobile CI cargo discovery to avoid brittle PATH/sudo assumptions on GitHub runners.

## [1.12.3] - 2026-02-27

### Fixed
- Android mobile CI now resolves `cargo` deterministically for Gradle Rust build tasks by hardening workflow symlink setup and using explicit cargo path fallbacks in Android `BuildTask.kt`.

## [1.12.1] - 2026-02-26

### Fixed
- Flashcard review math rendering now supports raw LaTeX without delimiters in imported card content.
- Linux `.deb` bundle verification now detects the whisper sidecar regardless of install path inside the package layout.
- AppImage CI repack flow now extracts and invokes `appimagetool` from the correct location in CI.
- Arch Linux CI/package build now links SQLite explicitly during Rust linking to avoid `sqlite3_*` unresolved symbol failures.
- Android mobile CI now ensures `cargo` is discoverable by Gradle/Tauri mobile build tasks.

## [1.12.0] - 2026-02-26

### Added
- NotebookLM sidecar/runtime packaging updates for desktop bundles, including external binary configuration and improved sidecar download/build flow.
- Regression coverage to ensure tab content state is preserved when switching between tabs.

### Changed
- Expanded NotebookLM backend artifact generation and provider handling to execute real generation flows and return richer artifact payloads.
- Updated AppImage build script usage in npm scripts to align local and CI packaging behavior.

### Fixed
- Fixed tab switching behavior that reset in-progress views (for example, Review sessions and nested Settings views) by keeping inactive tab content mounted instead of unmounting on every switch.
- Fixed NotebookLM integration UX and login/document entry points for better runtime behavior in packaged builds.
- Fixed release/build workflow regressions for `v1.12.0` by removing hard NotebookLM sidecar bundling requirements, skipping desktop sidecar builds on mobile targets, hardening AppImage runtime checks, and correcting Arch release toolchain dependencies.

## [1.11.0] - 2026-02-23

### Added
- NotebookLM integration workspace in Integrations with notebook management, source workflows, chat/research, and artifact generation surfaces.
- NotebookLM chat extraction flow to save assistant responses (including selected text) directly into Incrementum extracts with thread/context metadata.
- Saved-state affordances in NotebookLM chat (toast feedback + already-saved indicator) for extraction actions.
- In-app NotebookLM media artifact preview behavior for audio/video with loading states while generation is in progress.
- NotebookLM CLI sidecar/runtime bundling checks for desktop targets, with mobile-target bypass behavior and stricter sidecar presence validation.
- New NotebookLM rollout/integration docs:
  - `docs/notebooklm-integration.md`
  - `docs/notebooklm-document-qa-rollout.md`

### Changed
- Implemented CLI provider artifact generation in backend (`src-tauri/src/notebooklm.rs`) so audio/video/report/mind-map/data-table/flashcards/quiz flows produce usable payloads.
- Updated NotebookLM artifact handling to recover/parse structured payloads more robustly and avoid false “legacy format” messaging when recoverable content exists.
- NotebookLM browser sync persistence now stores richer extract metadata (selection context, analysis context, FSRS memory state mapping).
- NotebookLM-extracted document typing now prefers previewable markdown paths and upgrades legacy `other` notebook documents automatically.

### Fixed
- Fixed `CLI provider scaffold pending` failures in NotebookLM artifact generation by replacing scaffold behavior with real CLI command execution + download/parsing paths.
- Fixed NotebookLM audio/video preview UX to show player-ready media (or explicit generation progress) instead of forcing export-first flows.
- Fixed NotebookLM extract preview regression where notebook-backed extracts were saved as non-previewable `other` document types.
- Fixed NotebookLM markdown viewer empty-state regression by mirroring saved NotebookLM chat extracts into document markdown content.

## [1.10.9] - 2026-02-21

### Fixed
- Restored `Read Next` and `Random Item` toolbar actions so they reliably open queue items again.
- Added fallback queue selection logic so toolbar actions still work when active filters temporarily produce an empty `filteredItems` list.
- Added user-facing toast feedback for empty queue states and action failures, replacing silent no-op behavior.
- Added safe fallback opening for unhandled queue item variants with a `documentId` (for example, interspersed playlist queue items).

## [1.10.8] - 2026-02-21

### Fixed
- Resolved Review View startup/runtime crash in Vimium navigation caused by invalid hook return aliases (`_showHints` / `_findText`) in `VimiumNavigation`.
- Restored valid handler references so the app boots correctly in web/PWA builds and GitHub Actions release builds can complete.

## [1.10.7] - 2026-02-21

### Added
- Review deck browsing in Review View via a dedicated decks modal, including deck-level preview flow improvements.
- Image registry plumbing across Tauri + web API paths for richer media handling in review/content workflows.
- OpenSpec change package for image-registry work: `openspec/changes/add-image-registry/`.

### Changed
- Completed project linting setup migration to flat ESLint config (`eslint.config.js`) and normalized lint scripts/workflow.
- Broad frontend/backend cleanup pass across review, viewer, import, graph, RSS, queue, settings, sync, and assistant modules.
- Improved browser/PWA/Tauri compatibility and type-safety hardening in shared runtime utilities.

### Fixed
- Fixed multiple review UX edge cases in scroll/preview/feedback/rating flows.
- Fixed numerous document/media handling issues across PDF/EPUB/video/transcript and import pipelines.
- Resolved large sets of lint defects and removed stale suppressions; lint now runs clean with current configured rules.
- Updated release/version metadata to `1.10.7` across package and Tauri manifests.

## [1.10.4] - 2026-02-20

### Fixed
- Resolved Linux PDF freeze regression by restoring worker-first PDF loading in Tauri with safe fallback behavior.
- Prevented runtime panics when reading malformed non-UTF8 `content` values from SQLite rows by adding tolerant decoding fallbacks.
- Fixed Windows desktop import dialog failures (`Tauri dialog API not available`) by adding a direct invoke fallback for dialog open operations.
- Updated desktop app version metadata to `1.10.4` across manifests for release workflow validation.

## [1.10.3] - 2026-02-19

### Added
- Duration-aware long-form scheduling safety cap for videos/articles on positive ratings (`Good`/`Easy`):
  - `<25%` coverage of estimated content duration: cap next interval to `1 day`
  - `<50%` coverage: cap to `2 days`
  - `<75%` coverage: cap to `4 days`
  - Scheduler reason now appends a `Duration-aware cap` transparency note when applied
- User-facing documentation for long-form safety caps in:
  - `docs/USER_HANDBOOK.md`
  - `docs/FEATURES_IMPLEMENTED.md`
- Lightweight LaTeX expression rendering in markdown content paths:
  - Display delimiters: `$$...$$`, `\[...\]`
  - Inline delimiters: `$...$`, `\(...\)`
  - Inline/fenced code protections so code blocks are not math-rendered
- Math presentation styles for rendered expressions (`.math-expression`, fraction/sqrt formatting)
- OpenSpec change package for these updates:
  - `add-latex-rendering-and-duration-aware-scheduling`

### Changed
- Improved PDF loading strategy in Tauri/WebKitGTK environments:
  - Added source fallback behavior (`fileUrl`/`fileData`) and safer worker handling
  - Added large-document page virtualization windowing and spacer-based layout for better performance
- Improved EPUB loading flexibility with URL-or-buffer source support
- Document viewer loading flow now separates PDF/EPUB source handling more explicitly (including Tauri-specific paths)
- RSS Scroll Mode enhancements for filtered navigation:
  - Added favorites-only projection and index synchronization against visible items

### Fixed
- Restored ability to open external links via shell capability (`shell:allow-open`)
- Removed aggressive webview force-close behavior in tab content switching path to reduce tab-switch instability
- Aligned `src-tauri/Cargo.toml` version with `1.10.3` to satisfy tag/version validation in CI release workflows
- Mobile CI now also triggers on `v*` tag pushes so release tags run desktop and mobile validation together

## [1.10.2] - 2026-02-18

### Added
- New reusable transcription UI module (`TranscriptionButton`, queue actions, provider-key dialog, and shared service hook) for local video workflows
- GPU capability guidance in Audio Transcription settings, including platform-specific acceleration notes

### Changed
- Refactored video transcript generation flow to use the shared transcription queue service and centralized error/status handling
- Updated sidecar download/build pipeline to improve Whisper portability:
  - Build with static-linking flags across Linux/macOS/Windows paths
  - Copy discovered platform shared libraries (`.so`, `.dylib`, `.dll`) into sidecar bin output when present
  - Auto-configure Linux Whisper binary RPATH via `patchelf` when available
  - Enable Metal acceleration on Apple Silicon builds and keep CPU fallback on unsupported targets

### Fixed
- Improved local Whisper runtime failure messaging with explicit guidance when shared-library dependencies are missing
- Updated bundled Linux Whisper binary used by the desktop app

## [1.9.2] - 2026-02-17

### Added
- Assistant conversation persistence in the Assistant window:
  - Messages and unsent input are now restored after reloading or switching documents
  - Conversation storage is scoped by context (document, web page, video, general)

### Changed
- Release metadata alignment for desktop builds:
  - Updated app version to `1.9.2` across Tauri and package manifests so Settings shows the correct version

### Fixed
- Prevent duplicate context system messages when restoring persisted assistant conversations
- Correct release/version drift that previously caused builds to report/tag the wrong app version

## [1.9.1] - 2026-02-16

### Changed
- Prepared release pipeline alignment for the 1.9.x line

### Fixed
- Addressed packaging/version inconsistencies that caused 1.9.1 release metadata to remain on the prior 1.8.1 version in some artifacts

## [1.9.0] - 2026-02-15

### Added
- Document Minimap with scroll tracking and section highlights
- Inline extraction directly within DocumentViewer
- Focus Theme for distraction-free reading
- Zen Mode review interface with FSRS Inspector
- Modernized tab icons
- Markdown drag and drop support with image bundling
- Windows 95 theme
- Markdown bundle import with image path resolution

### Fixed
- Prevent ResizeObserver loop crash from minimap scroll updates
- Resolve circular dependency in FocusTheme
- Hide rating buttons popover when not in queue
- Fix URL import and PDF selection issues
- Improve extracts on mobile/PWA
- Fix rating popup when viewing PDFs

## [1.8.0] - 2026-02-12

### Added
- New review and analytics components, including progress rings, review heatmap, quick review widget, and review preview modal
- Smart productivity and guidance UX: interactive tutorial, FSRS explanation modal, break reminder, keyboard shortcuts panel, and shortcut tooltips
- New smart content helpers: AI tag suggestions, smart collections, and similar content recommendations
- Mobile/PWA improvements with install/offline indicators and touch-friendly interaction hooks

### Changed
- Refreshed app shell and review/document views with improved loading skeletons, empty states, and onboarding polish

### Fixed
- Improved sync resilience across local storage, file sync, and Yjs sync flows

## [1.7.5] - 2026-02-09

### Added
- **Continue Reading tab** - New dedicated tab for resuming recently read documents
  - Accessible via toolbar button (Ctrl+2) or middle-click on icon
  - Lists documents with progress for quick continuation

### Fixed
- **Tauri v2 compatibility fixes**
  - Fixed `beforeDevCommand` to properly run `npm run dev` instead of `true`
  - Fixed API parameter serialization: Tauri v2 expects camelCase for snake_case Rust parameters
  - Fixed `isWebMode()` check to use `isTauri()` helper instead of unreliable `window.__TAURI__`

- **YouTube viewer improvements**
  - Fixed video position restoration with unified position API (fallback to localStorage, then legacy fields)
  - Added error handling for missing H.264/MP4 codecs in WebKitGTK (Linux)
  - Added resume button in player controls to jump to saved position
  - Improved inline playback detection with clear fallback to browser option
  - Better SponsorBlock integration that doesn't override pending resume seeks

- **Browser/PWA backend improvements**
  - Time-based media (YouTube, audio, video) now correctly saves position as time type instead of page

## [1.7.4] - 2026-02-06

### Fixed
- **Anki import fixes for browser/PWA mode**
  - Fixed "Please update to the latest Anki version" error causing 0 cards to import
  - Fixed type mismatch when matching note IDs to card IDs (strict vs loose equality)
  - Added debug logging throughout Anki import flow for better troubleshooting
- **Cloze deletion display in browser/PWA mode**
  - Fixed Anki cloze format `{{c1::text}}` not being converted to internal format `[[c1::text]]`
  - Added cloze ranges calculation for proper blank rendering
  - Fixed ReviewCard component to handle both snake_case and camelCase item_type fields
  - Added optional chaining for safer item type handling

## [1.6.3] - 2026-02-06

### Fixed
- **Audiobook rating controls** - Changed to floating circular bubbles on right side
  - Circular buttons (12x12) stacked vertically on right edge
  - Color-coded: Red (Again), Orange (Hard), Blue (Good), Green (Easy)
  - Single letter labels: A, H, G, E
  - Hover scale effect and colored shadows
  - Positioned fixed at vertical center of screen

## [1.6.2] - 2026-02-06

### Fixed
- **Audiobook rating controls** - Moved from bottom popup to side panel
  - Removed HoverRatingControls popup for audiobooks (was blocking play button)
  - Added new side-positioned rating controls (top-right, vertical layout)
  - Compact design with Again/Hard/Good/Easy buttons
  - Matches the pattern used in Scroll Mode

## [1.6.1] - 2026-02-06

### Fixed
- **Linux .deb package ffmpeg conflict** - The .deb package was bundling ffmpeg which conflicted with system ffmpeg installations
  - Removed ffmpeg from bundled external binaries
  - Added ffmpeg as a package dependency for Linux .deb
  - Created new `utils::ffmpeg` helper module that uses system ffmpeg from PATH
  - Updated all ffmpeg call sites to use the new helper

### Added
- New `utils` module with ffmpeg helper for cross-platform ffmpeg execution
- Better error handling for missing document files in backup/export
- Error coercion utilities in tauri.ts

## [1.6.0] - 2026-02-06

### Added
- **Complete App State Backup & Restore System**
  - Export all application state to `.incrementum` backup files
  - Export includes: settings, documents (metadata), extracts, learning items, collections, and optional document files
  - Import with progress tracking and validation
  - Selective import options (choose what to restore)
  - Duplicate handling strategies (skip, replace, merge)
  - Full UI dialog for backup/restore with export preview
  - Cross-platform support (Tauri desktop and browser)
- **Drag & Drop Upload Component** - New reusable component for file uploads
- **Tab System Improvements** - Enhanced SplitPaneContainer, TabBar, and Tabs components

### Fixed
- Priority control visibility in dark mode - replaced transparent backgrounds with solid colors, improved text contrast

## [1.5.0] - 2026-02-06

### Added
- Fullscreen support for mobile PWA
- Floating voice document assistant button with microphone permission preflight
- Speech recognition started within user gesture for better browser compatibility
- Mobile-friendly Documents tab header for PWA

### Changed
- Mobile menus repositioned to top right next to title for better accessibility

### Fixed
- Cmd/Ctrl+K hotkeys now work while viewing items

## [1.4.0] - 2026-02-06

### Fixed
- Persistent PDF reading position: restore to the same page + within-page offset across tab switches and app restarts
- Prevent PDF scroll "snap back" by avoiding auto-scroll on scroll-driven page updates and canceling restore retries once the user scrolls

### Changed
- Reader-position persistence now prefers stable, user-namespaced document identity keys (content hash / PDF fingerprint) and flushes debounced writes on unload

## [1.3.0]

### Added
- Toolbar position settings - move toolbar to top, left, or right side of the screen
- Obsidian two-way sync (sync from Obsidian into Incrementum)
- Obsidian delete command for notes by Incrementum ID
- Groq cloud transcription support with automatic file chunking
- Web article import via URL
- TikTok-style scroll mode for document queue
- FSRS-first document scheduling system
- RSS feed tab with NewsBlur-inspired UX and queue integration
- Comprehensive delete functionality for learning items and flashcards
- Floating extract button for web browser text selection
- 6 new colorful themes
- App version display in settings
- Proper sprout logo icons for all platforms

### Changed
- Obsidian export now reuses existing files by matching `incrementum-id`
- Obsidian sync exports all documents and extracts
- Obsidian settings UI includes a "Sync From Obsidian" action

### Fixed
- Tauri Obsidian integration now accepts camelCase config fields (`vaultPath`, `notesFolder`, etc.)
- LocalVideoPlayer seeking and duplicate panels
- Windows startup crash and build errors
- NotReadableError from corrupted IndexedDB blobs
- Foreign key constraint on extracts.category
- YouTube iframe API loading on Windows (CSP fix)
- Database locking issues
- YouTube import foreign key constraint error
- Transcription variable error in TranscriptView
- RSS Feed button not opening RSS tab
- Frontend loading with Tauri v2 API usage

## [1.2.0] - 2026-02-04

### Added
- Local video transcription using Whisper
  - Generate transcripts for local video files using Whisper models
  - Selectable transcription models and languages
  - Real-time progress updates via Tauri events
  - Automatic transcript saving to database
- YouTube-style transcript toggle and layout controls for local videos
- Preferred Whisper model selection for auto-transcribe and quick actions
- Playback-aware background transcription queue to reduce stutter during video playback
- YouTube chapter fetching
  - Fetch chapters directly from YouTube videos
  - Auto-fetch chapters on YouTube video import
  - Parse chapters from video description (timestamp format)
  - Improved chapter parsing with duration and end time handling
- Video extracts feature for YouTube videos
  - Create extracts from specific time ranges in YouTube videos
  - Loop playback for extract regions
  - Resizable video features panel in YouTube viewer
  - Video extracts list with editing and deletion
- Audiobook improvements
  - Fallback audio loading for unsupported formats
  - Auto-load transcript for current chapter
  - Better error handling and user feedback
  - New audiobook command module with metadata parsing
- AI context window configuration
  - Configurable max tokens setting for document content sent to AI
  - Range: 1000-32000 tokens (default: 4000)
- New audiobook commands (Tauri only)
  - `parse_audiobook_metadata`: Extract metadata from audiobook files
  - `scan_directory_for_audiobooks`: Scan directories for audiobook files
  - `generate_audiobook_transcript`: Generate transcripts using Whisper
- Video transcription commands (Tauri only)
  - `generate_video_transcript`: Generate transcripts for local videos
  - `get_youtube_chapters`: Fetch chapters from YouTube videos
- GLM OCR provider with runtime setup and expanded OCR settings
- Semantic transcript search support (embeddings + backend commands)
- Improved error messages and user feedback
  - Better error handling in transcription engine
  - Informative toasts for transcription status
- Database migration for video transcript storage
- Video features panel integration in LocalVideoPlayer
- PWA swipe gestures for mobile items
  - Horizontal swipe actions with visual feedback and undo toasts
  - RSS Scroll Mode: swipe right to mark as read (green), swipe left to favorite (yellow)
  - Mobile Queue: swipe right to suspend, swipe left to postpone by 1 day
  - Vertical swipe navigation (TikTok-style) for browsing between items
  - Progressive background fill animation based on swipe distance
  - Snap-back animation for cancelled swipes
  - Haptic feedback support on compatible devices
  - 3-second undo toast with progress bar for all swipe actions
  - Velocity threshold (0.3 px/ms) to prevent accidental swipes
  - Touch target sizes meet WCAG 2.1 AAA standards (44px minimum)
  - Content scroll priority - gestures only trigger when content boundaries are reached
  - Reduced motion support for accessibility
- New reusable swipe gesture hook (`useSwipeGestures.ts`)
  - Touch event handlers with configurable threshold and velocity
  - Support for horizontal and vertical swipe detection
  - Snap-back animation using cubic-bezier easing
- New SwipeableItem component for mobile touch interactions
  - Configurable left/right actions with custom icons, colors, and labels
  - Predefined action templates (markRead, favorite, archive, delete)
- YouTube playlist support (models, API commands, and UI components)
- YouTube cookies option for accessing restricted transcripts
- Reading progress indicator to Documents Inspector
- Lemon slice theme
- Drag-to-split pane layout for tabs
- Tap-to-collapse EPUB chrome with floating buttons on mobile
- PWA fullscreen support

### Changed
- Updated to FSRS v6 (fsrs v5.2) and latest stable Rust

### Fixed
- Scroll mode split screen scaling
- YouTube transcript handling and parsing
- OCR HTML extraction for full PDFs
- Mobile EPUB toolbar hiding - now allows scrolling when toolbars are hidden
- PWA rating buttons position
- Tab drop detection - prevents collapsing the last pane
- Tab dragging after file drop fix
- Tab scaling in narrow split panes
- File drop glitches when dragging tabs
- Audio position tracking
- FLAC file import
- Review queue search functionality

### Performance
- Documents now open immediately after upload
- YouTube URL imports now maintain timestamps

## [1.0.0] - 2026

### Added
- Initial release of Incrementum
- Multi-format document import (PDF, EPUB, Markdown, HTML, TXT, JSON)
- URL scraping and content extraction
- Screenshot capture
- Arxiv research paper import
- Anki package (.apkg) import
- SuperMemo ZIP export import
- FSRS-5 spaced repetition algorithm
- SM-2 alternative algorithm
- Multiple card types (Flashcards, Cloze, Q&A, Basic)
- Full keyboard shortcuts (Space, 1-4)
- Session statistics tracking
- Virtual scrolling for 10,000+ cards
- Advanced queue filtering (type, state, tags, category)
- Smart sorting (due date, priority, difficulty)
- Bulk operations (suspend, delete, postpone)
- Export to CSV/JSON
- Dashboard with cards due, total learned, retention rate
- Memory statistics (mature, young, new card breakdown)
- FSRS metrics (stability and difficulty tracking)
- Activity charts (30-day review history)
- Study streaks tracking
- Goals progress monitoring
- Category breakdown performance
- 17 built-in themes (6 dark, 11 light)
- Live theme preview
- Custom theme creation & editing
- Import/export themes
- Cloud sync integrations (Dropbox, Google Drive, OneDrive)
- Browser extension support
- RSS reader integration
- YouTube video import with transcripts
- Podcast support with transcripts
- Backup & restore functionality
- OCR support for text extraction from images

[Unreleased]: https://github.com/melpomenex/incrementum-tauri/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/melpomenex/incrementum-tauri/compare/v1.0.0...v1.2.0
[1.0.0]: https://github.com/melpomenex/incrementum-tauri/releases/tag/v1.0.0
