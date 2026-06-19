# Changelog

## [1.53.0] - 2026-06-19

### Added
- **Seamless in-app auto-updates** — Incrementum can now update itself in place. When a new version is available, you get a notification on startup and a "Check for Updates" action in Settings → General. Clicking **Update Now** downloads the new build, verifies its cryptographic signature, swaps the app in place, and relaunches — no browser, no manual installer, no re-downloading from GitHub. A progress bar tracks the download, and a manual-download fallback is offered if the in-place install ever fails. On Windows and Linux (AppImage) this works fully automatically today.
- **Background update checks** — On launch, the app quietly checks for a new version (respecting your "skip this version" choice) and surfaces a non-intrusive notification rather than interrupting you.

### Fixed & Improved
- **Release pipeline now signs every build** — All release artifacts are cryptographically signed (minisign/ed25519) and a signed `latest.json` update manifest is published with each release. This is what enables the in-app updater to verify updates are authentic before installing them. Also fixed several latent bugs in the release workflow's manifest generation: it had been emitting empty signatures, unrecognized platform keys, and incorrect artifact URLs, all of which would have silently broken updates.
- **AppImage signing after repack** — The Linux AppImage is repacked after the initial build (to bundle the NotebookLM runtime and GStreamer plugins), so the original build-time signature no longer matched the final artifact. The release pipeline now re-signs the exact bytes users download.

### Known Limitations
- **macOS auto-updates are not yet fully automatic.** Because the macOS build is not signed with an Apple Developer ID or notarized, Gatekeeper will prompt on the *first* install (System Settings → Privacy & Security → "Open Anyway") on macOS Sequoia and later. Existing installs generally update silently, but a fully clean experience on macOS requires Apple Developer ID signing, which is planned. Windows and Linux AppImage updates work seamlessly today. (`.deb`/`.rpm`/Arch packages cannot self-update on any platform — they remain manual downloads.)
- **Updates re-download the full bundle.** Because the app bundles large native AI libraries (speech models, ONNX Runtime, GGML), each update is a full re-download (hundreds of MB) — there is no delta/patching.

## [1.52.1] - 2026-06-18

### Fixed & Improved
- **Model download broken in the packaged app (v1.52.0 regression)** — In the bundled `.app`/`.exe`/AppImage, Tauri places `externalBin` sidecars next to the main executable (e.g. `Contents/MacOS/sherpa-onnx`) with no target-triple suffix, but the install-check was looking for them under `Resources/bin/<name>-<triple>`. As a result `is_model_installed` returned the wrong value for every model in the released build, so the Audio Transcription settings page showed the wrong button (or appeared to do nothing when clicked). `sidecar_path` now probes all three layouts Tauri uses — dev `bin/<name>-<triple>`, resource `bin/<name>-<triple>`, and the bundled `<exe_dir>/<name>` — so install status and the download/transcribe flow are correct in both dev and packaged builds on macOS, Linux, and Windows.

## [1.52.0] - 2026-06-18

### Added
- **Local Speech-to-Text: Parakeet & SenseVoice** — Replaced the aging Whisper-only local STT stack with two state-of-the-art models, both running on-device via the bundled `sherpa-onnx` sidecar (no Python, no cloud, no account):
  - **NVIDIA Parakeet TDT-CTC 110M** (English) — top-10 Open ASR Leaderboard accuracy at ~50× real-time on CPU. The best English local option available, clearly ahead of Whisper-large-v3.
  - **Alibaba SenseVoice Small** (Chinese / English / Japanese / Korean / Cantonese) — non-autoregressive, fast, with built-in punctuation. The recommended pick for the app's Chinese-language users; one model covers both `zh` and `en` competently.
  - Both are user-installed (explicit Download, like the existing Whisper models) and run through a single shared sidecar binary. The existing Whisper (Distil/base/small) models remain as a multilingual fallback.
- **Language picker** — The transcription language dropdown now leads with Chinese (Mandarin), Chinese (Cantonese), Japanese, and Korean, and the selected language flows through to SenseVoice (`--sense-voice-language`).

### Fixed & Improved
- **Local STT was completely broken on macOS** — The `whisper` sidecar is dynamically linked but only carried a production-only rpath, so in dev (and in some bundle layouts) dyld failed to load `libwhisper.dylib` and every local model silently failed with a bare "transcription failed". `build.rs` now adds the dev rpath (`@executable_path`) alongside the production one and re-signs the sidecar; verified transcribing on Metal with zero environment variables.
- **`build.rs` infinite rebuild loop** — The sidecar re-sign step ran unconditionally on every build, changing binary mtimes and tripping Tauri's dev file-watcher into a rebuild loop. Now idempotent: it only re-signs/re-rpaths when the rpaths or signature are actually missing.
- **Long-audio transcription no longer hangs** — sherpa-onnx processed entire multi-hour files in one encoder pass (unbounded memory, no progress, looked like a freeze at 33%). Long audio is now chunked into 30s windows with per-chunk progress, matching the legacy pattern.
- **Actionable sidecar errors** — A missing or 0-byte placeholder sidecar now returns a clear message ("sidecar not available on this platform") instead of a confusing bare failure.
- **`is_model_installed` honesty** — A model whose engine binary is missing/a placeholder is no longer advertised as "installed".
- **Cross-platform sidecar resolution** — Fixed sidecar path lookup to use the full Rust target triple (was using arch-only, which broke the Windows filename match) and corrected the sherpa-onnx Linux aarch64 and Windows asset names in the download script.
- **"MagnifyingGlass" rendered as text** — A botched find-and-replace from the icon-library swap had replaced the word "Search" with the icon component name "MagnifyingGlass" inside ~35 user-facing string literals (placeholders, error messages) across ~20 components. Reverted the strings; the 169 real icon-component usages are untouched.
- **Missing `@phosphor-icons/react` dependency** — The package was declared but never installed, blanking the whole app window in dev. Installed via `pnpm`; the lockfile is now in sync.

## [1.51.0] - 2026-06-17

### Added
- **Phosphor Icon System** — Migrated the entire icon library from `lucide-react` to `@phosphor-icons/react`, giving the design system access to six weight variants per icon (Thin, Light, Regular, Bold, Fill, Duotone) for richer active/selected and emphasis states. All ~260 icons across the app now render consistently at the `regular` weight.
- **Copy Story Link (RSS)** — Every RSS story now has a "Copy Link" button (in both the scroll feed and the focused reading view) that copies a clean article URL to the clipboard. Tracking parameters (`utm_*`, `fbclid`, `gclid`, `mc_cid`, YouTube `si`, and ~30 more) are automatically stripped, so the shared link is canonical and free of feed/marketing cruft. A toast confirms success.

### Fixed & Improved
- **Tab & Dashboard Icons** — Navigation tabs and dashboard quick-actions previously rendered inconsistent emoji glyphs (📚 🎴 📄 📊 ⚙️) depending on how the tab was opened. Tabs now derive their icon from their type via a single centralized Phosphor registry, so every navigation path — keyboard shortcuts, vimium commands, dashboard, mobile, session restore — shows a consistent, professional glyph.
- **Knowledge Graph RSS Label** — The RSS node-type label in the Knowledge Graph was leaking the raw i18n key `graph.rss`; the key is now defined in all six locales and resolves to "RSS".
- **macOS Shortcut Matching** — A keyboard-shortcut combo configured for the "primary modifier" (Cmd on macOS, Ctrl elsewhere) no longer incorrectly matches bare Ctrl on macOS.
- **Test Suite (42 fixes)** — Repaired the full test suite to green:
  - Restored a working `localStorage`/`sessionStorage` in the test environment (Node 25's native Web Storage global was shadowing jsdom's).
  - Fixed broken store mocks in `ReviewQueueView`, `LibraryDashboard`, and `DocumentsView` tests.
  - Aligned stale assertions with current component behavior (smart-sections, relative-time formatting, duplicate renders).
  - All 782 tests pass.

## [1.50.2] - 2026-06-14

### Added
- **Vim Text Objects & Operator-Pending Verbs** — Select and act on text with canonical vim motions: `aw`/`iw` (word), `as`/`is` (sentence), `ap`/`ip` (paragraph), plus `d`/`c`/`y` operators (`daw`, `cip`, `yy`, `dd`).
- **WORD vs word Motions** — Lowercase `w`/`b`/`e` now stop on punctuation; uppercase `W`/`B`/`E` skip to the next whitespace-delimited WORD.
- **Vimium `:` Command-Bar Capture** — Create extracts and flashcards without leaving the keyboard: `:extract`, `:flashcard`, `:cloze`, `:qa`, `:mchoice`, `:extract2card`, `:highlight [color]`, `:deck <name>`.
- **Extract → Flashcard Chain** — After any instant extract, press `gf` to open Flashcard Studio seeded from that extract.
- **Configurable Default Card Type** — Choose whether vim's `F` key and `:flashcard` seed Q&A, Cloze, or Multiple-choice (Settings → Keyboard Shortcuts → Vim Reading).

### Fixed & Improved
- **Vim Selection Context** — Vim-triggered captures now carry a full `SelectionContext` (page numbers, offsets) read from the live DOM selection instead of stale React state.
- **Visual-Mode Caret Visibility** — The caret overlay now survives React re-renders triggered by `selectionchange`, re-appends via `requestAnimationFrame`, and renders above the PDF text layer (z-index 9000).
- **Post-Action Cursor Reset** — After any capture action, the cursor returns to the selection start and the mode resets to normal.

## [1.50.2] - 2026-06-14

### Added
- **Vim Text Objects & Operator-Pending Verbs** — Select and act on text with canonical vim motions: `aw`/`iw` (word), `as`/`is` (sentence), `ap`/`ip` (paragraph), plus `d`/`c`/`y` operators (`daw`, `cip`, `yy`, `dd`).
- **WORD vs word Motions** — Lowercase `w`/`b`/`e` now stop on punctuation; uppercase `W`/`B`/`E` skip to the next whitespace-delimited WORD.
- **Vimium `:` Command-Bar Capture** — Create extracts and flashcards without leaving the keyboard: `:extract`, `:flashcard`, `:cloze`, `:qa`, `:mchoice`, `:extract2card`, `:highlight [color]`, `:deck <name>`.
- **Extract → Flashcard Chain** — After any instant extract, press `gf` to open Flashcard Studio seeded from that extract.
- **Configurable Default Card Type** — Choose whether vim's `F` key and `:flashcard` seed Q&A, Cloze, or Multiple-choice (Settings → Keyboard Shortcuts → Vim Reading).

### Fixed & Improved
- **Vim Selection Context** — Vim-triggered captures now carry a full `SelectionContext` (page numbers, offsets) read from the live DOM selection instead of stale React state.
- **Visual-Mode Caret Visibility** — The caret overlay now survives React re-renders triggered by `selectionchange`, re-appends via `requestAnimationFrame`, and renders above the PDF text layer (z-index 9000).
- **Post-Action Cursor Reset** — After any capture action, the cursor returns to the selection start and the mode resets to normal.

## [1.50.1] - 2026-06-13

### Fixed
- **Release Build** — Re-cut release after v1.50.0's `npm ci` failed because the lockfile did not contain entries for three dependencies that had been added to `package.json`. The three deps (`@noble/ciphers`, `@noble/hashes`, `hash-wasm`) belong to in-progress sync-encryption work and have been removed from this release's `package.json` so the lockfile and manifest stay in sync. No user-facing behavior changes since v1.50.0.

## [1.50.0] - 2026-06-13

### Added
- **Right-Click Tab Split Menu** — Added Split Right / Left / Down / Up items to the tab context menu so a tab can be split into a new pane without dragging.

### Fixed
- **Cross-Pane Drag-to-Split** — Dragging a tab onto another pane's edge now correctly moves it into a new sibling pane. The `moveTabToSplit` store action was already implemented but never wired through the React tree, so cross-pane edge drops previously called `splitPane` on the wrong pane and silently no-op'd.

## [1.49.0] - 2026-06-10

### Added
- **10 Stunning New Themes** — Added 10 brand-new user interface themes (5 dark and 5 light variants).
- **Start Optimal Session Command** — Added a new "Start Optimal Session" command to the command palette.
- **Paste Extract Command** — Added a new "Paste Extract" command to the command palette.
- **Keyboard Shortcut Propagation** — Keyboard shortcuts are now propagated directly to command palette search results.
- **Auto-Reset Playback & Tab History** — Introduced auto-resetting playback for ended/near-ended media alongside active tab history tracking.
- **RSS i18n Translation Keys** — Added i18n translation keys for the RSS dashboard, discover panel, and help overlays.

### Fixed & Improved
- **Podcast Playback Issue** — Resolved a `NotSupportedError` when attempting to play podcast audio within macOS WKWebView.
- **Document Viewer Guard** — Guarded `Node.contains` against non-Node event targets to prevent crashes in the Document Viewer.
- **RSS Performance & Navigation** — Optimized search/interaction performance and resolved arrow key navigation issues in the RSS view.
- **RSS & Web Browser Translations** — Updated translations for RSS features and web browser tab improvements.

## [1.48.0] - 2026-06-10

### Added
- **Premium RSS Dashboard** — Introduced a feature-rich, high-fidelity RSS dashboard that populates the empty workspace when no feed or folder is active.
- **Vim & Keyboard Navigation for RSS** — Added advanced keyboard shortcuts (`Shift+J` / `Shift+K`) for shifting active feeds, standard arrow key navigation, contextual command palette search integrations, and an interactive RSS keyboard shortcut help modal.
- **Close Action in RSS Reader** — Added an explicit close button inside the reader layout, allowing easy navigation back to the RSS Dashboard view.

### Fixed
- **Liquid Glass Theme HTML Readability & Centering** — Fixed text readability and centering issues for converted PDFs, HTML documents, and EPUBs in the Liquid Glass theme. Resolved by forcing absolute layout positioning of the reader container, resolving semi-transparent background colors to opaque versions for readable contrast inside the iframe, and fixing the horizontal viewport body centering constraint.
- **RSS Layout & Badge Optimizations** — Fine-tuned feed selection highlights, unread badge formatting to prevent overflow overlaps, and patched transparency backgrounds in Discover Sites, Manage Training, and Newsletter Directory modals.

## [1.47.12] - 2026-06-09

### Fixed
- **Liquid Glass Theme HTML Readability & Centering** — Fixed text readability and centering issues for converted PDFs, HTML documents, and EPUBs in the Liquid Glass theme. Resolved by forcing absolute layout positioning of the reader container, resolving semi-transparent background colors to opaque versions for readable contrast inside the iframe, and fixing the horizontal viewport body centering constraint.

## [1.47.11] - 2026-06-08

### Fixed
- **PDF Blank Page Rendering** — Fixed regression where PDFs displayed as blank pages in Tauri WebView. Resolved by fallback to main-thread rendering via clearing `workerSrc`, polyfilling the missing `Map.prototype.getOrInsertComputed` API in the main thread global Map context, and clamping rendering range window updates to chunk boundaries to prevent canvas render cancel-storms.

## [1.47.10] - 2026-06-07

### Fixed
- **Assistant Context in Scroll Mode** — Fixed a bug in Optimal Queue / Scroll Mode where the Assistant panel lacked full document text, live PDF page text layers, and prompt-time scroll/selection resolution.

## [1.47.9] - 2026-06-07

### Added
- **Hover to Save Images to Registry** — Elegantly hover over any image in EPUB, HTML, Markdown, or RSS content and save directly to your image library with a pristine, micro-animated glassmorphic overlay button.
- **Direct Image Pasting & Context Interception** — Focus the Image Registry and press Cmd+V (Mac) or Ctrl+V (Windows/Linux) to paste images directly. Pasting images in the Images tab now correctly ingests them to the Image Registry instead of importing them as documents. Adds fallback toast instructions if programmatic paste is blocked by permissions.

### Fixed
- **Standalone Document Rating Orbs** — Rating buttons and queue action "orbs" are now hidden when reading standalone files opened outside the queue, avoiding user confusion.

## [1.47.8] - 2026-06-06

### Fixed
- **Fluid TTS word-highlight auto-scrolling** — Refactored the word highlighting scroll engine to perform dynamic, layout-independent relative top calculations. The scroller now throttles scroll actions to line changes or viewport drift to prevent stuttering/jerking, and monitors mouse, wheel, keyboard, and touch events to pause auto-scrolling for 2 seconds when user manual scroll interaction is detected.

## [1.47.7] - 2026-06-04

### Added
- **YouTube video transcripts in Document Q&A** — Automatically pulls and caches transcripts and chapter headings on video import (both direct imports and playlist auto-imports). Transcripts are formatted with markdown chapter headers (`Chapter X: Title`) to integrate seamlessly with chapter-aware Q&A, and legacy imported videos auto-extract transcripts on-demand when queried.
- **Copy Response button in Document Q&A** — Added a quick copy response button to AI messages in Document Q&A, complete with a smooth hover fade-in and a checkmark status indicator upon successful copy.
- **Query history recall in Document Q&A** — Added up/down arrow key history recall inside the Q&A text input, allowing users to quickly cycle through previous queries.

## [1.47.6] - 2026-06-03

### Fixed
- **Restored IPC on Linux production builds** — Pinned `tauri = "=2.11.0"` to work around a regression introduced in Tauri 2.11.1's fix for [GHSA-7gmj-67g7-phm9](https://github.com/tauri-apps/tauri/security/advisories/GHSA-7gmj-67g7-phm9) (origin confusion in IPC). The stricter `is_local_url()` check in 2.11.1+ classifies `http://localhost` (used by `tauri-plugin-localhost` for WebKitGTK compatibility) as a remote origin and rejects all custom `#[tauri::command]` invocations with "Command X not allowed by ACL". Since Incrementum only loads its own bundled frontend assets with no remote content, the CVE's attack vector does not apply.

## [1.47.5] - 2026-06-02

### Fixed
- **Restored native title bar on Linux (.deb)** — Window decorations (minimize, maximize, close) are now visible on Linux installations again. The title text in the title bar is also restored.

## [1.48.0] - 2026-06-02

### Added
- **Vim reading mode** — Press Escape in any text document (EPUB, PDF, Markdown, HTML) to activate a Vim-like modal reading experience. Navigate word-by-word (h/l/w/b/e), line-by-line (j/k), jump to line boundaries (0/$), document boundaries (gg/G), and paragraphs ({/}). Press v for visual selection, V for visual line selection, then act on the selection: Enter to extract, y to yank (copy), H to highlight, F to create a flashcard. All keybindings are customizable in Settings > Keyboard Shortcuts > Vim Reading. Press Escape again to deactivate.

## [1.47.4] - 2026-06-01

### Fixed
- **FFmpeg detection on Windows** — FFmpeg binary lookup was using Unix-only PATH separator (`:`) and missing the `.exe` extension on Windows. Now uses `;` separator and `ffmpeg.exe` on Windows platforms.

### Added
- **Keyboard-driven shortcuts** — Premium keyboard-driven shortcuts for faster navigation and interaction
- **Escape to close importers** — Press Escape to dismiss import dialogs
- **Respect preferred transcription model in auto-queue** — Auto-queue now honors the user's preferred transcription model setting instead of always defaulting

## [1.47.1] - 2026-05-31

### Fixed
- **Moonshine build resilience** — Native Moonshine sidecar build is now non-fatal; if compilation fails (e.g. onnxruntime hash mismatch on aarch64), the build continues without the binary. Browser-native Moonshine and Groq transcription remain fully functional.
- **Dynamic onnxruntime hash verification** — Before building moonshine.cpp, the script now downloads each onnxruntime tarball and computes the real SHA256 hash, patching the cmake config to match. This prevents failures when upstream re-releases tarballs with different hashes.

## [1.47.0] - 2026-05-31

### Added
- **Moonshine STT transcription** — Browser-native speech-to-text using the Moonshine model via @huggingface/transformers
- **Native Moonshine sidecar** — Cross-platform Rust sidecar with onnxruntime for high-performance local transcription on desktop
- **Scroll-position AI context** — AI assistant now receives scroll-position-aware context slicing for more relevant responses
- **Moonshine wrapper & sidecar binaries** — Linux x86_64 moonshine binary and shell wrapper for seamless sidecar invocation
- **libonnxruntime library** — Bundled ONNX runtime shared library for Linux sidecar transcription

### Changed
- **Transcription engine** — Major refactor to support both browser-native Moonshine and Groq cloud transcription with unified job queue
- **Auto-queue transcription** — Enhanced auto-queue with Moonshine-first strategy, fallback to Groq, and improved job tracking
- **Model manager** — Expanded to handle both local (Moonshine) and remote (Groq) transcription models with download progress
- **Audiobook import dialog** — Streamlined import flow with improved transcription option handling
- **Audio transcription settings** — Redesigned settings UI with Moonshine/Groq configuration options
- **Browser extension** — Updated manifest and rebuilt extension package

## [1.46.0] - 2026-05-29

### Added
- **RSS full content reader** — Premium-mode article reader with dynamic theme matching, declutter filtering, and settings customization
- **RSS semantic study & graph** — Advanced semantic study integration with cluster search, graph-based study queue, and thematic stacking
- **RSS scroll mode enhancements** — Complete article content support in scroll mode and optimal queue
- **Assistant model switcher redesign** — Premium breathing status pill with popover selector for quick model switching
- **RSS study store** — Dedicated store for managing RSS-based study items

### Changed
- **Semantic graph panel** — Enhanced Obsidian graph view with stacking fixes and improved cluster search
- **RSS reader components** — Expanded full content view and scroll mode with rich article rendering

## [1.45.0] - 2026-05-29

### Added
- **RSS semantic graph integration** — Unread RSS articles now feed into the semantic similarity graph and thematic scroll mode queues via embedding-based similarity
- **Lexical fallback for RSS items** — Graph builder supports RSS items in lexical fallback path when embeddings are unavailable

### Fixed
- **16 failing Rust tests** — Corrected stale test assertions in FSRS/SM-20 algorithms, SuperMemo SM-18, Anki cloze unicode, ReviewRating mapping, database PRAGMA types, FK constraints, and migration table names
- **Cloze unicode indexing** — Fixed off-by-one char index for CJK cloze text and added bounds check to prevent panic on out-of-range indices
- **NotebookLM cookie profiles** — Support standard cookie profiles and auto-connect on Linux
- **Merge conflict cleanup** — Resolved stray conflict markers causing module import failures

### Changed
- **Code quality sweep** — Removed dead code, unused imports, and unreachable branches across 200+ files in Rust, TypeScript, Python, and browser extension
- **Accessibility improvements** — Added role, aria-label, and keyboard event handlers to interactive elements across viewer, media, and extract components
- **Default algorithm type** — Unknown algorithm strings now default to Fsrs instead of SM2

## [1.44.0] - 2026-05-28

### Added
- **Premium themes with animated backdrops** — 12 new themes (6 animated, 6 non-animated, light/dark variants) including 'cozy-windowpane' with canvas rain, water bead refraction, amber bokeh, and 3D frames
- **Theme backdrop system** — New `ThemeBackdrop` component supporting animated canvas backdrops with wiggle/pause physics and static droplet absorption
- **Scroll-to-zoom gestures** — PDF viewer now supports pinch-to-zoom and scroll-wheel zoom
- **Compact expandable header** — RSS feed header with configurable cover image and collapsible layout
- **Local podcast playback in queue** — Downloaded podcast episodes can now play in AudiobookViewer using local files instead of streaming
- **Configurable RSS cover image** — Cover images for RSS feeds are now user-configurable

### Changed
- **PDF text selection** — Switched from custom overlay to native browser text selection for more reliable highlighting
- **Tab rendering optimization** — Inactive tabs now freeze updates; background canvas and 3D loops are paused when not visible

### Fixed
- **Podcast player hang** — Bypassed AudioContext for Tauri asset protocol, preventing playback freezes
- **PDF scrolling glitches** — Resolved scroll jitter and whitespace click interference in text layer
- **PDF zoom controls** — Improved zoom button layout and behavior
- **OCR robustness** — Individual page failures no longer crash the entire OCR pipeline; placeholder pages preserve correct sequencing
- **AudioPlayer TypeScript error** — Fixed type error in AudioPlayer component
- **Devtools in release** — Enabled devtools access in release builds

## [1.43.1] - 2026-05-27

### Fixed
- **PDF layout and window overlap** — Resolved layout bugs in PDF split-panes, selection popups, and OCR text preview overlapping
- **Whisper model hashes** — Updated placeholder hashes and sizes for Whisper model downloads
- **Whisper download notifications** — Added toast notifications for Whisper model download progress
- **Git LFS metadata fetching** — Fetches LFS metadata dynamically at download time to prevent hash update failures

## [1.43.0] - 2026-05-25

### Added
- **Embedding-based semantic engine** — Semantic graph now uses vector embeddings (OpenAI, Cohere, OpenRouter, Ollama) instead of lexical similarity, with cosine similarity replacing the O(N²) frontend Jaccard computation
- **Queue item embeddings persistence** — New SQLite table with content-hash invalidation for cached embeddings
- **Embedding progress indicator** — SemanticGraphPanel now shows embedding generation progress with batch tracking
- **Embed queue items command** — Tauri command to batch-generate and persist embeddings for queue items
- **Compute semantic graph command** — Tauri command to build similarity graph from stored embeddings

### Changed
- **Semantic graph engine** — Replaced hardcoded TCS_LEXICON similarity scoring with hybrid orchestrator (embedding-first, lexical fallback)
- **Custom subset handling** — Moved customSubset to queueStore so both scroll and optimal review sessions respect it

## [1.42.0] - 2026-05-25

### Added
- **Dismiss buttons in scroll mode** — Flashcards and extracts now have dismiss actions that remove items from the review queue without deleting them
- **Kindle highlights to flashcards** — Scroll mode now converts Kindle highlights into flashcard candidates automatically

### Fixed
- **Dismissed items regeneration** — Prevents dismissed flashcards and extracts from being regenerated back into scrollItems
- **Flashcard button contrast** — Improved Create Flashcard button visibility on light themes
- **Podcast queue auto-loading** — Subscribed podcast episodes no longer auto-load into scroll queue, keeping only explicitly inserted ones
- **Queue progress tracking** — Progress counter and bar now dynamically increment as reviews are completed in scroll mode
- **Podcast auto-transcription** — Respects `autoProcessOnImport` setting when transcribing podcast episodes
- **HTML reader scroll position** — Fixed scroll position tracking across page reloads with percentage-based restoration
- **HTML reader styling** — Fixed initial styling and margin cutoff issue in HTML document reader
- **Podcast categorization and thumbnails** — Fixed podcast feed categorization and missing thumbnail display
- **Duplicate rating controls** — Fixed non-functional and duplicate rating controls in scroll mode

## [1.41.2] - 2026-05-24

### Fixed
- **macOS WebView module loading** — Changed dynamic imports to static imports to prevent code-split loading failures in packaged macOS WebView
- **DOMPurify bundling** — Pre-bundled DOMPurify via `optimizeDeps.include` to solve macOS module script resolution failure
- **Global shortcuts in packaged builds** — Restored native global shortcut and command palette event bridge that was broken in desktop packaging

## [1.41.1] - 2026-05-24

### Fixed
- **Linux/Windows release build failure** — `open_devtools()` call gated behind `#[cfg(feature = "devtools")]` so it's stripped from release builds where the `devtools` feature is not compiled in

## [1.41.0] - 2026-05-24

### Added
- **AI long-term memory** — Persistent MEMORY.md context that personalizes AI chat interactions with facts, preferences, and standing decisions extracted from conversations
- **AI memory settings UI** — Toggle memory on/off, view and edit MEMORY.md directly from both Tauri and PWA AI settings panels with token usage warning
- **RSS settings panel** — Full RSS configuration page with article retention, queue session rules, feed inclusion/exclusion controls, and smart queue tuning
- **Mark all feed articles read** — Bulk mark-as-read for RSS feeds with instant UI update and confirmation dialog
- **RSS article cleanup** — Background database pruning of old articles based on configurable retention period
- **Mark RSS feed read (Tauri)** — Native SQLite `mark_rss_feed_read` command for efficient bulk read marking

### Changed
- **DevTools gated behind feature flag** — `devtools` Cargo feature now opt-in via `INCREMENTUM_OPEN_DEVTOOLS` env var; dev profile enables automatically, release builds excluded for smaller binary
- **LLM base URL security** — Non-Ollama providers now validate that user-supplied base URLs don't point to private/internal addresses
- **Database connection pool reduced** — Max connections lowered from 20 to 5, appropriate for single-user desktop app
- **Global shortcut delivery** — Switched from `window.eval()` to `app.emit_to()` for more reliable keyboard shortcut dispatch, removed duplicate delivery paths
- **RSS mark-all-read** — Now works in both "all" and "unread" view modes with confirmation dialog and instant state updates
- **OpenRouter error sanitization** — Removed verbose error response body logging, replaced with generic failure message to prevent token/key leakage
- **DevTools CSP tightened** — Removed `unsafe-eval` from dev CSP to match production security posture
- **Assistant markdown sanitized** — AI responses now pass through DOMPurify with explicit tag/attribute allowlists before rendering
- **Migration debug logging removed** — Stripped verbose `eprintln!` calls from SQL statement splitter

### Fixed
- **Circular import crash in queueStore** — Added guard for `useCollectionStore` being undefined due to circular store imports (queueStore ↔ collectionStore ↔ documentStore)
- **Test mocks missing zustand store API** — LibraryDashboard and DocumentsView test mocks now include `.getState()` and `.subscribe()` on mocked stores
- **EPUB TTS word highlighting scroll** — Word-level highlighting now correctly scrolls the parent document container when reading inside EPUB iframes, using offset calculations across iframe boundaries
- **Word highlight layer cleanup** — Highlighter dependency array now includes `enabled` state to properly clear highlights when TTS is toggled off

## [1.40.0] - 2026-05-23

### Added
- **SponsorBlock integration** — Auto-skip sponsored segments in YouTube videos, local video player, and audiobook player with glassmorphic skip notification overlay and undo support
- **SponsorBlock pre-cut downloads** — YouTube and podcast downloads with SponsorBlock segments automatically cut via ffmpeg, with cut metadata saved for playback notifications
- **TTS word highlighting** — EPUB and PDF word-level highlighting during text-to-speech playback with auto-scroll to highlighted chunk
- **Podcast feed rename** — Rename subscribed podcast feeds from the feed header UI
- **EPUB iframe TTS bridge** — TTS controls now read from EPUB iframe content for accurate text and highlighting

### Changed
- **Podcast search switched to iTunes API** — Replaced RSS.com PodcastIndex with keyless iTunes Search API for more reliable podcast discovery
- **Podcast RSS parser rewritten** — Case-insensitive tag matching, proper handling of uppercase/custom feeds, standard RSS `<image>` support, separated self-closing element handling
- **Podcast manager UI redesigned** — Glassmorphic cover art backdrop glow, larger artwork, hover animations, improved feed and episode list styling
- **YouTube SponsorBlock notifications** — Replaced toast notifications with premium floating overlay with undo button and seek-aware tracking reset
- **TTS playback resumption** — When resuming paused TTS, auto-detects visible text and starts from current scroll position instead of last chunk
- **TTS audio leak fixes** — Proper cleanup of audio elements and playback tracking on unmount, voice change, and stop
- **Word highlighter iframe support** — Highlighter now operates on the correct document context for iframe-based readers (EPUB)
- **Document viewer TTS gating** — TTS controls only render when the document tab is active

## [1.39.2] - 2026-05-22

### Fixed
- **Window decorations on Windows** — Restored system window decorations for Windows and macOS by setting `decorations: true` in config; Linux still disables decorations at runtime for tiling WM compatibility

## [1.39.1] - 2026-05-21

### Fixed
- **Command palette imports** — Fixed broken imports in command palette module
- **Linux window decorations** — Disabled system window decorations on Linux for cleaner frameless UI
- **Linux native Edit menu** — Removed unwanted native Edit menu on Windows and Linux

### Changed
- **Knowledge graph performance** — Optimized rendering and physics simulation for both 2D and 3D graph modes, reducing frame drops with large graphs
- **SplitDocumentDialog** — New split document viewer component with pane management
- **Web article import** — Enhanced WebArticleImportDialog with direct PDF import support
- **EPUB viewer** — Improved EPUB rendering and navigation controls
- **PDF viewer** — Enhanced PDF viewer with new interaction features

## [1.39.0] - 2026-05-20

### Added
- **Session restore** — Persist and restore full workspace state across app restarts including open tabs, split pane layout, active documents, sidebar state, and active collection
- **Session restore setting** — New toggle in Settings > General to enable/disable session restore (on by default)
- **i18n** — Session restore labels added to all locale files (en, de, es, fr, ja, zh)

## [1.38.0] - 2026-05-16

### Added
- **Collection switching** — Switch between collections to segment your workflow via the new `CollectionSwitcher` component
- **Collection archive** — New collection archive/restore commands for managing collections
- **Collection database migrations** — New migrations (007, 008) for collections schema including default collection support
- **Linux WebKitGTK docs** — Documented known limitations for Linux WebKitGTK builds

### Changed
- **Collection API refactored** — Simplified collection types, store, and API layer with cleaner separation of concerns
- **Handbooks and docs updated** — Locale handbooks, HANDBOOK.md, and PROJECT_SUMMARY refreshed

### Fixed
- **PDF text layer TypeScript error** — Cast textLayerBuilder render to handle pdfjs-dist version differences across Node 22 (CI) and Node 25 (local)
- **KaTeX unknown command test** — Updated assertion to match actual KaTeX rendering behavior for unsupported LaTeX commands
- **Review showing previous collection cards** — Review sessions no longer show cards from the wrong collection after switching
- **YouTube iframe origin mismatch on Linux** — Omitted the origin parameter in production builds to fix playback issues
- **Helmet CSP conflict with Tauri** — Disabled Helmet CSP since Tauri already handles it via tauri.conf.json
- **FlashcardStudio modal dismiss** — Clicking outside the modal now closes it properly

## [1.37.0] - 2026-05-10

### Added
- **Extract auto-generate flashcard button** — Extract cards in scroll mode now show a prominent ✨ Create Flashcard button that auto-generates cloze cards via FlashcardStudio
- **FlashcardStudio seed auto-generation** — When opened with an extract ID seed, the studio auto-triggers card generation on mount

### Fixed
- **Extracts now appear in the Optimal Session queue** — Extracts and flashcards were pooled together and capped by the flashcard percentage, causing extracts to always be crowded out. Extracts now have their own independent budget (up to 20 per session) and are always included
- **FlashcardStudio 'Document context unavailable' error** — Chat-based generation now falls back to 'general' context type when document content isn't loaded, instead of throwing

### Security
- **Cross-user data isolation** — Hardened API routes against cross-user data access, XSS injection, SSRF, auth bypass, and weak crypto usage

## [1.36.0] - 2026-05-10

### Added
- **Browser extension theme-aware saves** — Save Link now fetches content server-side via Readability; saved articles render with your active theme instead of source inline styles
- **Browser extension v1.2.0** — Rebuilt signed .xpi with structural CSS capture and theme-aware rendering
- **OpenSpec proposals** — Added design specs for PDF text selection, Anna's Archive downloader, EPUB context menu, text viewer context menu, and theme-aware browser saves

### Changed
- **RichContentRenderer theme-aware** — Reads CSS custom properties from parent document instead of hardcoded light-theme colors
- **DocumentViewer CSS reset** — Strips cosmetic inline styles so theme tokens cascade correctly
- **Whisper model verification** — Downloaded models now verified with SHA-256 hashes
- **Browser sync auth** — All browser sync server routes now require API key authentication
- **MCP command allowlist** — Runtime enforcement with shell metacharacter rejection; removes YouTube/Google from Tauri remote capabilities

### Fixed
- **SQL injection vulnerabilities** — 13 SQL injection sites in RSS commands replaced from string interpolation to parameterized queries
- **XSS in podcast descriptions** — Episode and feed descriptions sanitized with DOMPurify instead of raw dangerouslySetInnerHTML
- **RSS content sanitization** — All 7 RSS content rendering sites (QueueScrollPage, RSSScrollMode, RSSReader, StoryView, RSSFullContentView, SiteBySiteTraining, SearchResults) and HighlightRenderer now use DOMPurify
- **PDF.js text selection** — Enabled embedded fonts for accurate text layer selection
- **Remote scope tightening** — Removed YouTube/Google domains from Tauri remote capabilities

## [1.35.0] - 2026-05-08

### Added
- **Podcast episode download** — Download episodes locally with progress tracking, playback from local file, and delete management
- **Podcast feed search** — Search feeds by title, author, or description with HTML stripping support
- **Episode search & sort** — Filter episodes by text, sort by newest/oldest/duration/title
- **Inline transcript chat** — Chat with AI about a podcast transcript directly from a slide-out panel
- **Downloaded episode indicator** — Visual status for downloaded/download-in-progress episodes
- **Player width persistence** — Podcast player resize width saved to localStorage

### Changed
- **AudiobookViewer local playback** — Non-m4b audio files (mp3, etc.) now play directly via `convertFileSrc` without transcoding
- **Episode position restore** — Simplified seek-on-load logic to always use the retry mechanism
- **Feed description rendering** — HTML descriptions rendered properly in feed header and episode list
- **Unsubscribe confirmation** — Replaced browser `confirm()` with custom `ConfirmDialog` component

### Fixed
- **ACL permissions** — Added `dialog:allow-ask` and `dialog:allow-message` to Tauri capabilities

## [1.34.0] - 2026-05-08

### Added
- **Podcast queue integration** — Insert individual podcast episodes directly into the review queue via a new Tauri command and frontend API
- **Podcast playback position persistence** — Robust save/resume of playback position for podcast episodes, surviving app restarts
- **Schedule dashboard** — New `ScheduleDashboard` component with summary views and improved layout
- **Schedule toolbar** — New `ScheduleToolbar` with filtering and view controls for the schedule page

### Changed
- **AudiobookViewer refactor** — Major cleanup and improvement of the audiobook viewer component with better state management
- **DocumentViewer** — Enhanced viewer with additional controls and improved UX
- **Schedule view restructured** — Cleaner component hierarchy with dashboard, toolbar, and view separation
- **Queue scroll page** — Minor improvements to the scroll queue flow

### Fixed
- **ExtractScrollItem** — Minor rendering fix for extract scroll items in review mode

## [1.33.1] - 2026-05-07

### Fixed
- **Podcast player controls clipped** — Increased player height so playback controls are fully visible
- **AudiobookViewer container sizing** — Viewer now properly fills its container in the podcast player

### Changed
- **Schedule view performance** — Optimized rendering for large datasets to reduce jank

## [1.33.0] - 2026-05-07

### Added
- **Whisper transcription for podcast episodes** — Transcribe any podcast episode using local Whisper models (base, small, medium, large). Download audio, run transcription in the background with progress events, and store the full transcript text. Cancellation support for in-progress jobs.
- **Auto-transcribe after feed refresh** — When a feed has `auto_transcribe = true`, up to 3 untranscribed episodes are automatically queued for background transcription after each feed refresh. Non-blocking: the refresh response returns immediately.
- **Transcript → Extract generation** — Completed transcripts automatically create a Document record (with `podcast`/`transcript` tags) and 3-5 Extract records split at sentence boundaries, making podcast content reviewable in the incremental reading system.
- **Auto-transcribe feed settings** — Per-feed toggle to automatically transcribe new episodes, with optional language override.
- **Whisper model management** — Download, install, and select Whisper models through the transcription engine's ModelManager.

### Changed
- **Refactored transcription into shared helper** — `run_transcription_job` extracted from the Tauri command so both manual and auto-transcribe paths share identical logic.
- **`refresh_podcast_feed` signature** — Now accepts `AppHandle` and transcription tokens to support auto-transcribe background spawning.

## [1.32.0] - 2026-05-07

### Added
- **Podcast subscription & playback** — Subscribe to podcast feeds via URL with server-side RSS parsing (iTunes namespace). SQLite persistence for feeds and episodes. Full PodcastManager UI with sidebar, episode list, and discovery.
- **Inline podcast player** — Stream episodes directly through AudiobookViewer with play/pause, seek, and speed controls. Playback position persists across sessions.
- **Podcast queue integration** — Optionally include unplayed podcast episodes in the scroll reading queue with configurable settings (max items, unread-only filter).
- **localStorage migration** — Existing podcast subscriptions automatically migrated from localStorage to SQLite on first launch.
- **Browser sync endpoints** — 8 HTTP routes for podcast CRUD in PWA mode.
- **Feed refresh error handling** — Graceful error toasts, per-feed retry button, and warning indicators for failed refreshes.

### Fixed
- **Schedule view crash on Windows/macOS** — `toFixed()` called on null stability/difficulty values in schedule items. Changed guards from `!== undefined` to `!= null`.
- **DeckManager stability display** — Added null fallback for stability value to prevent crash.

## [1.31.0] - 2026-05-07

### Added
- **RSS relevance scoring** — Client-side scorer ranks RSS queue items using classifier signals (author/tag/title/feed likes & dislikes), tag frequency, and recency. Higher-relevance articles surface first in scroll mode. Feed-scoped classifiers get double weight.
- **Relevance indicator** — Colored dot on RSS articles in scroll queue: green (high), gray (neutral), red (low relevance).
- **AI keychain storage** — AIKeyStore with OS keychain integration and AES-256-GCM encrypted file fallback for API key persistence
- **Scroll overlay controls** — New `ScrollOverlayControls` and `ScrollQueueSettings` components for queue scroll mode
- **CI regression gate** — Automated security tests covering SQLi, path traversal, and SSRF prevention
- **Database integrity check** — Startup validation of SQLite database integrity
- **OpenSpec proposals** — Comprehensive audit remediation, recommendation engine, audiobook queue freeze fix, and session filter fixes

### Fixed
- **Audiobook queue freeze** — Blocking 8-second `probeMediaSource()` call skipped for audio files, preventing UI freeze in scroll mode
- **Session customization filters not applied** — Customize Session modal filters (tags, categories, priority, suspended) now correctly affect the visible queue list, not just preview cards
- **API key exposure** — AI config endpoint now redacts keys, showing only the last 4 characters
- **AuthStore thread safety** — Wrapped provider fields in `Arc` for safe cloning across threads
- **WAL/synchronous PRAGMAs** — Moved to `SqliteConnectOptions` so every pool connection inherits them

### Changed
- **Code splitting** — Lazy-loaded page components (LoginModal, WelcomeScreen, etc.) with `React.lazy` + `Suspense` for smaller initial bundle
- **Vite chunking** — Configured manual chunks for better cache performance
- **Font loading** — Improved with self-hosted fallbacks and `font-display: swap`
- **Removed redundant `loadDocuments()` call** from App bootstrap

## [1.30.2] - 2026-05-06

### Fixed
- **RSS feed images blocked by CSP** — Broadened `img-src` directive to allow all HTTPS images, fixing image loading failures in RSS scroll mode for news sources like NBC, Reuters, etc.
- **PWA Card Review mobile UX** — Improved touch interaction and layout for card review on mobile PWA.
- **RSS summaries in scroll mode** — Fixed summary text rendering in scroll review for RSS feed items.
- **Vercel deployment** — Updated `pnpm-lock.yaml` to include `react-markdown@^10.1.0`, resolving frozen lockfile install failure.

### Changed
- **Removed "resumed" from position indicator** — Cleaned up reading position display.
- **Updated HANDBOOK** documentation.

## [1.30.1] - 2026-05-05

### Added
- **Deck context menu** in View Decks modal — right-click, three-dot button, or long-press on any deck to access Study Now, Rename, Duplicate, Export (.apkg/.csv), Suspend/Unsuspend All, and Delete

### Changed
- Deck items in View Decks modal now render as `div` elements to support nested context menu trigger button

## [1.30.0] - 2026-05-05

### Added
- **Audiobook-EPUB sync** — Split-view player with synced audio playback and EPUB scrolling. Text highlighting follows current transcript position, and clicking EPUB text seeks the audio player.
- **Document pairing** — Automatic and manual pairing of audiobook and EPUB files from the documents library.
- **Transcript-EPUB alignment** — Worker-based alignment engine that maps audiobook transcript segments to EPUB chapter positions for synchronized navigation.
- **Alignment caching** — Persistent alignment results cached per document pair to avoid re-computation.
- **Resizable split panes** — Draggable divider component for the audiobook-EPUB sync view.
- **Schedule item audiobook actions** — Quick audiobook playback controls directly from schedule item rows.
- **Audiobook import improvements** — Enhanced import dialog with pairing flow.

## [1.29.7] - 2026-05-05

### Fixed
- **Command palette freeze on Linux AppImage** — Removed blocking sequential work from palette open (document extraction loop, full extract DB load). Replaced `Infinity` scan caps with bounded limits (500/500/3). Moved YouTube transcript fetching from sequential await-in-loop to concurrent `Promise.allSettled`.
- **Firefox browser extension install failure** — Removed Chrome-only permissions (`printingMetrics`, `tabCapture`), added Firefox-compatible `browser_specific_settings` with gecko ID and `data_collection_permissions`, added `background.scripts` fallback, and signed the extension via AMO for permanent install.

## [1.29.6] - 2026-05-04

### Fixed
- **Study Now button in document flashcard view now works** — Clicking "Study Now" in the Learning Cards view (accessible from queue items or document viewer) now loads all cards for that document into the review queue and opens a Review tab with the session started.

## [1.29.5] - 2026-05-04

### Fixed
- **Raw `{{cN::text}}` cloze syntax now renders in review views** — AI-generated cloze cards using `{{c1::answer}}` markers now display properly as blanks/hints in ReviewCard, FlashcardScrollItem, and GeneratedCardsPopover, instead of showing raw syntax as plain text.
- **Duplicate decks from parenthetical author names** — `addDeck()` now deduplicates by name (case-insensitive), and auto-deck tags strip parenthetical author info (e.g. `Mengele (Author)` → `deck:Mengele`).
- **Cards not appearing under their deck** — When `create_deck` and card calls appear in the same batch, cards now get tagged with the plain deck name so `matchesDeckTags` finds them.
- **Unfenced nested JSON breaking tool call parser** — Brace/bracket depth matching replaces greedy regex, correctly parsing `{{"tool_calls":[...]}}`.
- **Assistant only emitting deck creation, no cards** — Rewrote system prompt tool instructions, fixed conversation history ordering, added deck-without-cards warning, and added fallback for unfenced JSON card arrays.
- **Flashcard tooling fixes** — General flashcard creation and handling improvements.
- **EPUB rendition crash on unmount** — Guarded rendition calls against destroyed iframes.
- **Devtools feature** — Enabled for `open_devtools()` on desktop.

## [1.29.4] - 2026-05-04

### Added
- **Compact table view for Schedule** — Spreadsheet-dense table with columns for #, title, type, priority, interval, reps, lapses, due date, difficulty, stability, retrievability, progress, and estimated time. Color-coded cells for quick scanning.
- **Card/table view toggle** — Switch between the original card layout and the new table view. Defaults to table on desktop; mobile stays on card view.
- **Right-click context menu on schedule items** — Full context menu with open/study, suspend/unsuspend, postpone (1–30 days), dismiss, and delete actions.
- **Schedule view** — New Schedule tab showing upcoming items grouped by date with workload forecast timeline, summary stats, and spread functionality to redistribute overloaded days.
- **Extract/Learning item type preferences** — Customize Queue modal now persists per-item-type settings.
- **Cross-platform battery optimization** — Battery-aware behavior for queue processing and background tasks.
- **Algorithm stats in queue items** — Stability, difficulty, interval, retrievability, reps, and lapses now displayed in enriched queue item rows.

### Fixed
- **NaN dates in schedule view** — Queue items with missing or invalid due dates now handled gracefully instead of rendering NaN.
- **dateModified stamp on document/extract updates** — Conditional timestamp update to avoid unnecessary modification dates.
- **DB pool exhaustion from cover resolution** — Permanent Set for tracking resolved covers prevents repeated DB lookups.
- **Grid view document cycling loop** — Fixed infinite loop when cycling through documents in grid view.
- **updateDocument overwriting dateModified** — No longer blindly resets the modification timestamp.

## [1.29.3] - 2026-05-04

### Fixed
- **Text selection broken in Scroll Mode on Windows** — Nested `overflow-auto` on the document content wrapper and MarkdownViewer created competing scroll containers. On WebView2 (Windows), the outer container captured mouse-drag selection gestures as scroll events, making text selection impossible. Now uses `overflow-hidden` on the wrapper for markdown, HTML, and EPUB viewers that manage their own scrolling.

## [1.29.2] - 2026-05-03

### Fixed
- **Escape closing queue tab when FlashcardStudioModal is open** — Escape now passes through to the modal/popup handler instead of closing the queue scroll tab.

## [1.29.1] - 2026-05-03

### Fixed
- **Kindle Clippings import creating flashcards** — Clippings now only create extracts, not flashcards/learning items.
- **Text selection vanishing in Queue document viewer** — Search highlight effect was unconditionally resetting innerHTML on every re-render, destroying the browser's text selection before right-click could fire.
- **PDF.js parentNode null error on Windows** — Moved unhandled rejection handler to module scope so it's active before any async PDF.js work begins.

## [1.29.0] - 2026-05-03

### Added
- **Kindle Clippings Import** — Parse `My Clippings.txt` with content-hash deduplication. Uses Tauri native file dialog for import, creates learning items for review queue, and stores clippings as markdown content for preview. Includes a backfill command for existing Kindle imports.
- **Right-click "Create Flashcard" in MarkdownViewer** — Select text in any markdown document, right-click → "Create Flashcard..." → opens FlashcardStudioModal pre-seeded with your selection.
- **Right-click context menu in scroll review** — Extract text in scroll review mode now supports right-click to create flashcards, cloze deletions, or Q&A cards.
- **Web article imports in DocumentViewer** — Imported web articles now open in the standard DocumentViewer queue reader instead of the split article editor view.
- **PWA assistant mobile UX improvements** — Better assistant experience on mobile/PWA.

### Fixed
- **Highlight flash on re-render** — Rewrote `applyAnchoredTextHighlights` to be incremental. No more full-DOM-swap flash when highlights re-render.
- **FlashcardStudioModal duplicate save error** — `handleSaveSelected` would throw when trying to create a card that already existed in the DB (duplicate detection). Now treats duplicates as successful saves.
- **Right-click context menu click handling** — Improved click detection for right-click context menus.
- **Mobile document toolbar overflow** — Fixed toolbar items overflowing on mobile viewports.

## [1.28.2] - 2026-05-02

### Fixed
- **PDF files failing to load on Windows with `a.toHex is not a function`** — pdfjs-dist v5.4+ calls `Uint8Array.prototype.toHex()` when computing PDF fingerprints (MD5 → hex string). This API was added in Chromium 130 / V8 13.0 (late 2024). Windows machines with an older Edge WebView2 runtime don't have this method, causing all PDF imports to crash. Added a lightweight polyfill (`uint8ArrayCompat.ts`) that installs before any PDF code runs, matching the existing `promiseCompat.ts` pattern for WebView2 compatibility.

## [1.28.1] - 2026-05-01

### Fixed
- **YouTube embeds failing with "browser can't play this video"** — `https://img.youtube.com` was missing from the CSP `img-src` directive, causing thumbnail fetches to fail. YouTube treats this as a broken embed context and refuses to initialize the player.
- **SponsorBlock segments not loading** — `https://sponsor.ajay.app` was missing from the CSP `connect-src` directive.

## [1.28.0] - 2026-05-01

### Added
- **In-app update checker** — App silently checks GitHub Releases for new versions on startup and shows a toast notification when an update is available. Settings → General now includes a "Check for Updates" button next to the App Version display. Clicking opens a dialog with release notes and a link to download. Users can skip specific versions to suppress repeat notifications.

## [1.27.2] - 2026-05-02

### Fixed
- **YouTube playback on Linux AppImage** — Videos embedded via `youtube-nocookie.com` showed "Your browser can't play this video" because the AppImage wasn't bundling GStreamer media plugins (`bundleMediaFramework: false`). Enabled media framework bundling and defaulted to `youtube.com` embed host on Linux to avoid stricter CORS handling by the nocookie domain.
- **Assistant crash on video documents** — Calling the LLM assistant on YouTube videos threw `value?.replace is not a function` when non-string values reached `normalizeWhitespace()`. Now coerces any value to string before processing.
- **Anki import creating dummy documents** — Importing `.apkg` files no longer creates empty placeholder documents for notes without media.
- **URL import failing on preview fetch errors** — Web URL imports now proceed even when the initial preview/thumbnail fetch fails, using backend fetch as a fallback.
- **Command palette result navigation** — Keyboard navigation through search results now works correctly across all document types (PDF, EPUB, audiobook, general). Results scroll into view when selected.
- **Command palette scroll** — Fixed scroll behavior in the command palette dropdown to prevent content clipping.
- **Escape key closing scroll mode unexpectedly** — Escape now properly delegates to `closeTab` logic instead of unconditionally closing scroll mode.
- **`ease_factor.toFixed` crash** — Guarded `.toFixed()` calls on potentially undefined ease factor values.
- **PWA `getCollections` crash** — Guarded the Tauri-specific `getCollections` call with an `__TAURI__` check so it doesn't throw in PWA/browser mode.

### Changed
- **Removed Reading Speed & ETA from Analytics** — The reading speed and estimated time of arrival section has been removed from the Analytics tab.
- **Updated README** — Refreshed documentation.

## [1.27.1] - 2026-05-01

### Fixed
- **macOS and Windows command palette shortcut** — `Cmd+K` on macOS and `Ctrl+K` on Windows now open the command palette reliably in Tauri builds. The native accelerator path now dispatches the palette-open event directly into the webview, macOS registers the shortcut in the Edit menu so WKWebView cannot swallow it, and Windows keeps a real native Edit menu visible so WebView2 preserves the accelerator table.
- **Tauri startup/runtime regressions found during shortcut verification** — fixed the desktop `greet` command registration, made browser sync auto-start handle an occupied port without a false running state, and made queue preview truncation Unicode-safe to avoid panics on curly quotes and other multibyte characters.

## [1.27.0] - 2026-04-30

### Added
- **Assistant image attachments** — Paste, drag-and-drop, or click to attach up to 4 images per message in the assistant chat. Images are compressed client-side (max 1280px, 5MB limit) and sent as multimodal messages to LLM providers that support vision. Heuristic detection for OpenAI, Anthropic, OpenRouter, and Ollama models. When vision isn't supported, images are stripped from the API call with a warning.
- **Horizontal scroll on document card rows** — Vertical mouse wheel events on horizontal document card grids now map to horizontal scrolling, matching native scroll behavior.

### Fixed
- **Flashcard Studio empty cloze cards** — Cloze cards generated from extracts rendered as blank because `cloze_text` was never set by the Rust backend. Frontend now converts `[answer]` format to `{{c1::answer}}` cloze syntax.
- **Flashcard Studio save button** — Save no longer tries to re-create already-persisted cards, preventing duplicate creation errors.
- **WebKitGTK crashes from console overrides** — PDFViewer's glyph warning suppression via `Object.defineProperty(console.warn/error)` crashed on WebKitGTK. Removed the overrides entirely.
- **Tab bar horizontal scroll on WebKitGTK** — Wheel events now correctly map to horizontal scrolling on the tab bar for Linux AppImage builds.
- **PDF text layer crash on scroll** — Yield to macrotask queue after cancelling textLayerBuilder to prevent stale DOM mutations.

## [1.26.10] - 2026-04-30

### Changed
- **PDF OCR auto-extract** — OCR region selection now instantly creates an extract without opening the edit modal. A toast with an "Edit" button lets users review/modify the extract afterward. Error/retry flow unchanged.

## [1.26.8] - 2026-04-29

### Fixed
- **Interface font family not applying** — changing the font in Settings → Appearance → Typography had no effect because Tailwind v4 uses `--font-sans` for the default body text, but only `--font-family` was being set (and nothing referenced it). Fixed by mapping `--font-sans` to `var(--font-family)` in the `@theme` block and adding `font-family: var(--font-family)` to the base `html, body` rule.
- **Google Fonts never loaded** — the settings dropdown offered 30+ Google Fonts (Inter, Merriweather, Poppins, etc.) but no font files were ever fetched. Added a `loadGoogleFont()` utility that dynamically injects a `<link>` for the selected font, called from both `ThemeContext` (on theme change) and `SettingsPage` (on font change). System fonts (system-ui, serif, sans-serif, monospace) are skipped.

## [1.26.7] - 2026-04-29

### Fixed
- **PDF.js text layer crash on scroll** — `renderPage()` was clearing text layer DOM (`innerHTML = ""`) without first cancelling in-flight pdfjs `TextLayer.render()` calls. This caused `this.#container.parentNode is null` crashes (and black screens) when scrolling large PDFs, because pdfjs's internal `#processItems` was still asynchronously building DOM nodes inside the now-emptied container. Fixed by cancelling pending text layer renders and tracking deferred `setTimeout` IDs so stale builds can be cancelled before their page is re-rendered.

## [1.26.6] - 2026-04-29

### Fixed
- **CSP blocking PDF.js blob styles** — added `blob:` to the `style-src` Content Security Policy directive so PDF.js can inject annotation layer and text layer styles via blob URLs without being blocked.

## [1.26.5] - 2026-04-29

### Fixed
- **PDF.js "parentNode is null" promise rejections** — wrapped all `renderPage()` calls in try/catch to swallow DOM-detachment errors that occur when PDF pages are mid-render during unmount, view mode switch, or resize. These were logged as unhandled promise rejections in the console but were harmless functionally.

## [1.26.4] - 2026-04-29

### Fixed
- **React #185 crash on toast notifications** — `useToast()` hook and `Toast` container component were calling `useToastStore()` without selectors, causing the entire store object (including progress animation updates at 20Hz) to trigger re-renders in every subscribing component. Fixed by using individual selectors (`(s) => s.addToast`, etc.) so components only re-render when their specific slice changes. This was causing "Maximum update depth exceeded" crashes in DocumentViewer (4600+ lines, 51 effects) when toasts were shown during PDF-to-HTML conversion.

## [1.26.3] - 2026-04-29

### Added
- **Card context menu** — right-click (or long-press on mobile, or the ⋯ button) on any card in Deck Manager to open a context menu with common actions:
  - Edit, Preview, Suspend/Unsuspend, Delete (with confirmation)
  - Move to Deck… (sub-menu listing all decks)
  - Set Priority (sub-menu with 1-5 stars, placeholder for future schema)
  - Duplicate, Copy Question, Copy Answer

### Fixed
- **IndexedDB connection resilience** — added `withRetry()` wrapper to all database operations. When the browser silently closes the IDB connection (tab backgrounding, memory pressure), operations now auto-reconnect and retry instead of cascading `InvalidStateError` failures. Also handles `AbortError` from aborted transactions.
- **IndexedDB backing store detection** — `openDatabase()` now logs a clear message when the backing store is corrupted, advising the user to clear site data.
- **Service Worker error handling** — wrapped all `navigator.serviceWorker` API calls in try/catch (PWA init, OfflineIndicator, visibility handlers) to prevent unhandled `InvalidStateError` rejections that caused black screens on mobile after tab backgrounding.
- **APKG import performance** — bulk Anki imports now use `bulkPutLearningItems()` instead of 432 individual IDB transactions (144 cards × 3 ops each), preventing the backing store from being overwhelmed on mobile devices.

## [1.26.2] - 2026-04-29

### Added
- **Resizable Deck Manager panels** — all three columns (deck tree, card table, card preview/stats) are now resizable by dragging the divider between them. Works with mouse and touch. Widths persist to `localStorage` across sessions. Min/max constraints prevent collapsing panels too far.

- **Global paste-to-import** — Ctrl/Cmd+V anywhere in the app (when not focused on an input) now intercepts clipboard content:
  - Text → opens a "New Card from Clipboard" editor modal
  - Files (PDF, images, EPUB, TXT, MD, HTML, JSON, APKG) → import confirmation with one-tap import to library
  - Extension-based fallback for files with generic MIME types from Tauri

- **Global drag-and-drop import** — files can now be dropped on any page, not just the Library tab. Drops are routed to the document import pipeline automatically. (Bundle preview still only works on the Library page.)

### Changed
- **Deck Manager responsive columns** — column visibility now uses CSS breakpoints instead of JS-only state, fixing mismatched layouts between the shell and Deck Manager on tablets:
  - Type column hidden below `xl` (1280px)
  - Difficulty hidden below `md` (768px)
  - Stability and Last Review hidden below `xl` (1280px)
  - Tags hidden below `lg` (1024px)
  - Left sidebar narrowed to 170px at `md`, full 220px at `lg`
  - Right panel starts at 260px at `lg`, expands to 750px at `xl`

### Fixed
- **Center column overflow on tablets** — card table headers no longer draw over the right panel. Added `overflow-hidden` on the center column container.

## [1.26.1] - 2026-04-29

### Added
- **Right-click context menus on queue items** — right-click any item in the Review Queue for quick actions:
  - Learning items: Study Now, Suspend, Postpone (+1 / +3 / +7 days), Compress Intervals, Reschedule Intelligently, Delete
  - Documents: Open, Dismiss, Delete
  - Uses the same `menuRef.contains()` pattern as library cards to prevent click-race bugs.

- **"Study Now" and "New Card" buttons in Deck Stats panel** — the quick action buttons in the Deck Manager's Stats view now actually work. "Study Now" selects the current deck and starts a review session; "New Card" creates an empty card tagged with the deck's filters and opens the preview panel for editing.

- **`crypto.randomUUID()` polyfill for non-secure contexts** — fixes errors when running over HTTP/Tailscale (not localhost/HTTPS), where `crypto.randomUUID` is unavailable. Polyfill uses `Math.random`-based RFC 4122 v4 UUID generation.

### Changed
- **Command palette feels snappier** — several optimizations to reduce perceived input lag:
  - Reduced animation durations from 200–300ms to 120ms
  - Removed expensive `backdrop-filter: blur()` from CSS keyframes (major cause of frame drops in Tauri WebView)
  - Removed `backdrop-blur-sm` from overlay backdrop
  - Removed staggered animation delays on search result rows (waterfall effect)
  - Switched focus from `setTimeout` to `requestAnimationFrame` for instant input readiness

### Fixed
- **PDF.js scroll performance** — several tuning passes to make scrolling large documents smoother:
  - Capped canvas render scale at 2× DPR (PDF.js rasterizes vector glyphs at render time, so 2× is sufficient even on 3×/4× displays)
  - Added 16 megapixel canvas cap (4096×4096) with proportional downscale for large/zoomed pages
  - Added CSS `contain` hints on page containers and scroll container to limit layout recalculation
  - Deferred text layer rendering for non-current pages by 300ms (text layer creates hundreds of `<span>` elements per page)
  - Disabled WebGL canvas rendering to avoid GPU overhead
  - Removed `transition-transform` from page containers that caused unnecessary paint on scroll

- **Tesseract.js OCR DataCloneError in PWA/browser mode** — Vite's `optimizeDeps` was transforming tesseract.js's `spawnWorker` function, making the `logger` callback non-cloneable via `postMessage`. Fixed by:
  - Excluding `tesseract.js` from Vite's optimize deps
  - Pointing worker to CDN URL directly to bypass broken blob-URL spawn path
  - Setting `workerBlobURL: false` and `logger: undefined` instead of a function

- **Vite dev server binds to all interfaces** — changed default host from `127.0.0.1` to `0.0.0.0` so the dev server is reachable over Tailscale/LAN without setting `TAURI_DEV_HOST`.

## [1.26.0] - 2026-04-29

### Added
- **Library dashboard redesign** — the Library tab grid view has been completely redesigned as a polished dashboard with:
  - Stats bar showing Total Items, In Progress, Unprocessed, Highlights, and Ready to Review counts
  - Filter chips as horizontal rounded pills (All, PDF, Epub, etc.) replacing the old dropdown
  - "Continue Where You Left Off" horizontal scrollable row for documents with progress
  - "Recently Added" horizontal scrollable row for the 12 most recent documents
  - Redesigned LibraryCards (280–320px) with cover thumbnails, type badge overlays, progress bars, timestamps, highlights/cards counts, and tag pills
  - Type-tinted gradient fallback backgrounds for cards without covers (red for PDF, blue for EPUB, etc.)
  - Scroll arrows on each horizontal section, hover effects with lift and shadow

- **Right-click context menus on library cards** — right-click any document card for quick actions: Open, Add/Remove from Favorites, Add Tag (via prompt), Transcribe (audio/video only), Archive/Unarchive, Delete. Menu properly closes on outside click.

- **Card Preview Panel** — new right panel in Deck Manager showing selected card details with three tabs:
  - Preview tab renders question/answer with full LaTeX support
  - Edit tab with save/cancel for inline card editing
  - History tab showing review stats, FSRS memory state, and scheduling info
  - Tags section always visible at the bottom

- **Deck right-click context menu** — right-click any deck in the sidebar for Study, Rename (inline), Duplicate, Export as JSON, Suspend All, Unsuspend All, or Delete

- **Anki review history (revlog) import** — when importing Anki `.apkg` packages, the app now extracts review log entries and stores them in a new `review_log` table. FSRS scheduling state (stability, difficulty) is also imported from Anki card data.

- **Export decks as `.apkg`** — export any deck back to Anki-compatible `.apkg` format from the deck context menu. Preserves FSRS state in card data and round-trips original Anki revlog IDs for lossless re-import.

- **Test coverage** — 35 new tests for LaTeX entity decoding (`ankiLatexEntities.test.ts`, 25 tests) and CardPreviewPanel (`CardPreviewPanel.test.tsx`, 10 tests).

### Changed
- **Deck Manager now responsive on mobile** — three-column layout adapts for phones and tablets:
  - Left sidebar replaced with deck picker dropdown
  - Right panel replaced with full-screen card preview overlay
  - Card table simplified to question + inline state badge on mobile
  - Action buttons show icons only on mobile
  - Filter chips and sort buttons wrap on small screens
  - First deck auto-selected on mobile when cards load

- **DeckManager text sizes normalized** — all UI text brought to consistent sizes (labels text-xs, content text-sm, headers text-base) for better readability

### Fixed
- **LaTeX rendering from Anki decks** — Anki stores HTML entities (`&nbsp;`, `&lt;`, `&gt;`, `&amp;`) and structural HTML tags (`<div>`, `<span>`, etc.) inside math delimiters. These are now properly decoded and stripped before passing to KaTeX, fixing math rendering in imported Anki decks.

## [1.25.9] - 2026-04-28

### Fixed
- **LaTeX rendering from Anki decks** — Anki stores HTML entities (`&nbsp;`, `&lt;`, `&gt;`, `&amp;`) and structural HTML tags (`<div>`, `<span>`, etc.) inside math delimiters (`$...$`, `$$...$$`). These are now properly decoded and stripped before passing to KaTeX, fixing math rendering failures in imported Anki decks. Tested against a 144-card differential equations deck — 58 previously broken cards now render correctly.

### Added
- **Cmd+K diagnostic logging** — added tracing at each step of the macOS Cmd+K accelerator chain (Rust `on_menu_event` → `emit_to` → JS `listen` handler → command palette dispatch) to help diagnose why Cmd+K sometimes fails to open the command palette on macOS.

## [1.25.8] - 2026-04-28

### Fixed
- **PDF-to-HTML viewer styling** — completely overhauled the injected iframe styles for converted PDFs. Page cards now have proper shadows, rounded corners, and hover effects. Typography improved with better heading weights, letter-spacing, list/paragraph spacing, and code block styling. All colors respect the active app theme. Removed the overly aggressive universal selector that was stripping all element backgrounds.
- **Cmd+K command palette on macOS** — moved Cmd+K and Cmd+P menu accelerators into the native app submenu (alongside About/Hide/Quit) so they fire reliably when the window is focused, instead of relying on a separate "Commands" submenu that WKWebView could swallow before the event reached the accelerator.

## [1.25.7] - 2026-04-28

### Fixed
- **PDF "Convert to HTML" crash on Linux** — fixed `TypeError: Null is not an object (evaluating 'this.#e.parentNode')` that occurred when switching from PDF to HTML view. Added unmount cleanup that cancels all in-flight pdf.js render tasks and text layer builders, and an `isConnected` guard after async text layer rendering to prevent DOM operations on detached containers.

## [1.25.6] - 2026-04-28

### Fixed

- **Deck manager font scaling** — bumped all text sizes to match app defaults (stat pills text-sm, header text-base, deck tree text-sm, chips/sort/columns text-xs, card rows text-xs with proper padding)
- **Card list scrollbar** — card list container changed from overflow-hidden to overflow-y-auto so scrollbar appears and cards are scrollable
- **Card row sizing** — increased row padding, checkbox size, difficulty bar width, and icon sizes for better readability

## [1.25.5] - 2026-04-28

### Changed

- **Deck Manager redesign** — complete rewrite to a dense, information-rich three-column layout inspired by Anki's deck browser:
  - **Left sidebar**: compact deck tree with card counts and due counts per deck
  - **Center**: inline stats row (Total, Due Today, New, Learning, Mature, Retention), filter chips with live counts (All, New, Learning, Review, Suspended, Leeches), action buttons, sort controls, and dense card table with columns for checkbox, question preview, type badge, due date, difficulty bar, stability, tags, last review, and actions
  - **Right sidebar**: deck details, stats breakdown with maturity bar, today's forecast, algorithm-specific metrics, top tags, and quick actions
  - All existing functionality preserved: search, sort, filter, bulk operations, inline card editing

- **Algorithm-aware metrics** — the right sidebar metrics section now dynamically detects which spaced repetition algorithms are used by cards in the deck and shows tailored metrics for each:
  - **FSRS-6**: retention, avg difficulty, avg stability, target retention
  - **SuperMemo 18 / 20**: retention, avg difficulty, avg stability
  - **SM-2**: retention, avg difficulty, avg ease factor, avg interval
  - Mixed-algorithm decks show a separate panel per algorithm with card counts

## [1.25.4] - 2026-04-27

### Fixed

- **Web browser tab: extract dialog hidden behind native webview** — the "Create Extract" modal now properly appears on top of the website content in the in-app browser. On Tauri, the native webview widget is temporarily hidden while the dialog is open. On web, the dialog is rendered via a React portal to break out of iframe stacking contexts.
- **Web browser tab: iframe/webview persists when switching tabs** — the native webview (Tauri) or website iframe (web) no longer stays visible when switching to a different tab. An IntersectionObserver detects tab visibility changes and hides/shows the webview accordingly.
- **Web browser tab: configurable extract shortcut now works in webview** — the user's configured extract-text shortcut (set in Settings → Keyboard Shortcuts) now works inside the in-app browser's native webview. Previously only the hardcoded Ctrl+Shift+E was recognized inside the webview. The shortcut is pushed to the injected bridge script and updates live when settings change.

## [1.25.3] - 2026-04-27

### Fixed

- **Transcription "No such file or directory" on macOS** — three fixes:
  1. The app now finds ffmpeg installed via Homebrew (`/opt/homebrew/bin` or `/usr/local/bin`). macOS GUI apps don't inherit the shell PATH, so ffmpeg was invisible.
  2. Audio files are copied to app-managed storage at import time to prevent sandbox permission errors.
  3. The whisper shared libraries (`libwhisper*.dylib`, `libggml*.dylib`) are now included in the macOS app bundle so the sidecar binary can find them at runtime.
- **Transcription queue entries cannot be removed** — the transcription queue now supports clearing entries. New "Clear Failed", "Clear Completed", and "Clear All Finished" buttons appear above the queue when relevant entries exist. Individual entries can also be removed with a per-row remove button. Previously, failed and completed entries accumulated indefinitely with no way to clean them up.

## [1.25.2] - 2026-04-27

### Added

- **Deck Manager view** — new full-screen deck browser accessible from ReviewHome. Browse all decks in a sidebar, expand one to see its cards in a virtualized list with compact stat-dense rows (color-coded state badges, difficulty bars, due dates, intervals, review counts, leech indicators). Inline card editor expands below any card row for quick question/answer/tag edits without modals. Per-deck stats sidebar shows retention rate, maturity breakdown, 7-day workload forecast sparkline, leech detection, and FSRS memory health. Sort cards by due date, state, difficulty, interval, reviews, or lapses. Filter by card state and due status. Bulk operations: select cards to suspend, unsuspend, delete, or retag. Search across cards by question text or tags. Card type-aware editing: basic/QA inline, cloze with highlighted ranges, complex types link to Flashcard Studio.

### Fixed

- **YouTube IFrame API blocked by CSP** — the YouTube inline player no longer fails to initialize due to a Content Security Policy violation. Added `http://www.youtube.com` to the `script-src` and `script-src-elem` directives to allow the IFrame Player API to load over HTTP.

## [1.25.1] - 2026-04-26

### Fixed

- **AppImage core dump on non-Ubuntu systems** — the AppImage no longer crashes at startup on Arch Linux and other distributions with newer GStreamer versions. The root cause was a broken `.desktop` symlink (absolute path to CI runner) that crashed `AppRun` in `__getdelim`, combined with a missing `libgstgl-1.0.so.0` library that caused a symbol lookup error when the system's GStreamer 1.28 clashed with the bundled 1.24.
- **Absolute symlinks in portable Python runtimes** — the NotebookLM and Pocket TTS portable Python runtimes no longer contain absolute symlinks pointing to CI runner system paths. Symlinks like `_sysconfigdata__linux_x86_64-linux-gnu.py` and `sitecustomize.py` are now dereferenced at build time.
- **AppImage GStreamer plugin discovery** — the AppImage now sets `GST_PLUGIN_PATH` at runtime so GStreamer loads bundled plugins instead of system ones, preventing version-mismatch crashes.
- **Duplicate rating orbs in scroll mode** — rating orbs no longer appear alongside the scroll mode document viewer, removing visual clutter.

## [1.25.0] - 2026-04-26

### Added

- **Auto-transcription for media documents** — audio and video files are now automatically transcribed in the background when imported. Transcripts are saved to the document and become searchable and extractable via the existing text extraction flow.
- **Transcription queue management** — new queue section in Audio Transcription settings shows all pending, active, and completed transcription jobs with real-time progress bars. Jobs can be cancelled, retried, or prioritized. A "Transcribe All" button enqueues any existing untranscribed media documents.
- **Real-time transcription progress** — document cards show a live progress percentage (e.g. "47%") during transcription. The settings queue displays a filling progress bar with percentage label, so users know exactly when a transcription is done and it's safe to close the app.
- **Idle-time backfill scanner** — when auto-transcription is enabled, a background scanner discovers untranscribed media documents during idle periods and enqueues them at low priority.
- **Persistent transcription queue** — transcription jobs survive app restarts. Interrupted processing jobs are automatically resumed on next launch.
- **Per-provider advanced settings** — each LLM provider now has configurable temperature (0.0–2.0), max tokens (1–128000), and system prompt fields in provider settings.
- **AI global controls** — new Auto-Generation, Summarization, and Context Window sub-sections in AI settings. Auto-generation controls include enable toggle, cards-per-extract (1–20), quality threshold (0.0–1.0), and optional approval workflow. Summarization controls include auto-summarize toggle, summary length (short/medium/long), and toggle to include summary in card content. Context window controls include max-tokens-per-request, include-related-cards toggle, and document-snippet-length input.
- **Auto-extract workflows** — extracts created via toast or inline actions now automatically generate flashcards and summaries based on global AI settings, with pending cards held for manual approval when enabled.
- **Global settings wired to chat** — context-from-related-cards and document-snippet-length settings are passed through to all chat completion requests (Assistant tab, PWA Assistant, Document QA, Flashcard Studio).
- **Scroll mode view toggle** — new document/extracts/cards view switcher in scroll mode. A floating toolbar with FileText, List, and Brain icons lets you switch between the document reader, an extracts list for the current document, and a learning cards list. View resets to document when scrolling to the next item. The assistant panel is now always visible (toggle button removed).
- **Extract dialog in scroll mode** — a lightbulb toolbar button in scroll mode opens the full Create Extract dialog, with a toast and "View extract" action on completion.
- **Linux command palette shortcuts via menu accelerators** — packaged Linux builds now register Ctrl+K and Ctrl+P as menu accelerators (same as Windows/macOS), fixing shortcut delivery in AppImage and other packaged artifacts. The menu bar is hidden on Linux to match Windows behavior. Native shortcut dispatch now guards against firing when an editable field is focused.
- **Vulkan GPU acceleration for local transcription** — whisper.cpp now uses Vulkan GPU backends on Linux when available (NVIDIA, AMD, Intel). Auto-detects `libggml-vulkan.so` in the sidecar directory and enables GPU automatically — no configuration needed. The transcription settings queue shows a green "GPU" badge when GPU mode is active. Falls back to CPU when no GPU is present.
- **FTS5 full-text search** — the search page now uses SQLite FTS5 for fast, relevance-ranked search across all document content including auto-generated transcripts and extracts. Results include highlighted excerpts with match context. FTS5 index is maintained automatically via triggers; a reindex command is available in case of drift.
- **Transcript phase indicators** — document cards and the settings queue now show "Preparing audio..." during the ffmpeg conversion phase before whisper starts, preventing the progress bar from appearing stuck at 0% for large files.

### Fixed

- **Pocket TTS error reporting and PATH discovery** — the TTS settings page now shows actionable install instructions (`uv tool install pocket-tts`) when pocket_tts is not found. The Linux sidecar wrapper enhances PATH to find user-local `uv tool` and `pip --user` installations, validates the module is importable before execution, and fixes a duplicate `generate` subcommand argument that caused synthesis failures.

## [1.24.2] - 2026-04-26

### Added

- **Toast-based instant extracts** — clicking the lightbulb button or selecting text now creates an extract immediately with a success toast. The toast includes an "Edit" action to open the full extract dialog. Shift+click still opens the dialog directly. Applies to PDF, HTML, OCR HTML, and RSS scroll mode. Mobile extract button also creates instantly.
- **Shift+click highlight opens dialog** — shift+clicking a highlight color dot in the selection popup opens the highlight with the full extract dialog instead of creating it silently.
- **Ctrl+E keyboard shortcut for extract text** — new customizable `Ctrl/Cmd+E` shortcut creates an extract from the current text selection. Works across PDF, HTML, EPUB, and YouTube viewers.
- **Keyboard shortcut dispatch for all actions** — shortcut handlers now dispatch events for navigation, review ratings, document search, zoom, fullscreen, sidebar toggle, flashcard studio, undo/redo, and more. All shortcuts defined in the shortcut store are now wired to real behavior.
- **Keyboard shortcuts help driven by shortcut store** — the shortcuts help overlay now reads shortcuts dynamically from the customizable shortcut store instead of using a hardcoded list, so rebindings are reflected immediately.
- **Shortcut store persistence with migration** — added version-based merge migration so newly added shortcuts (like `edit.extract-text`) appear for users with existing persisted shortcut preferences.
- **Additional Tauri-registered shortcuts** — registered `Ctrl/Cmd+B`, `F`, `S`, `E`, `[`, `]`, `Shift+F`, and `Shift+S` with the OS-level shortcut system so they aren't swallowed by the webview on all platforms.

### Fixed

- **Page lost when toggling PDF ↔ HTML** — switching between PDF and converted HTML (OCR) view now preserves the current page number in both directions. Previously the viewer reset to page 1 on each toggle.
- **Scroll position not saved for HTML documents** — scroll progress is now persisted for HTML documents (same as PDFs), so reopening a document restores the last position. Includes debounced scroll capture from the HTML iframe and position restoration on load.
- **Iframe text selection unreliable** — added a mouseup fallback handler for HTML/OCR-HTML iframes so the extract button appears even when the `selectionchange` listener misses iframe selections due to load race conditions.
- **EditableContentPalette selection in extract view** — text selection inside the extract palette's preview pane (including HTML content in iframes) now propagates back to the parent viewer, allowing re-extraction from the palette.
- **EPUB extract shortcut** — the `Ctrl/Cmd+E` shortcut now works inside EPUB iframe content by injecting the hotkey listener into the epubjs content window.

## [1.24.1] - 2026-04-25

### Fixed

- **Yellow line on extract cards** — removed the thin highlight color bar that appeared across extract cards in the document viewer.
- **Highlight rendering in themed HTML view** — extract highlights now render correctly without being stripped by the theme's background override. Removed the inset box-shadow artifact from highlight marks.

## [1.24.0] - 2026-04-25

### Added

- **PDF-to-HTML converter** — new "Convert to HTML" button in the PDF toolbar converts the full PDF to structured HTML preserving page boundaries, headings, paragraphs, tables, and images. Users can toggle between native PDF and converted HTML views. Supports both text-layer PDFs and image-only PDFs via OCR fallback.
- **HTML viewer reading controls** — font size increase/decrease (A-/A+), line height slider, and font family selection (serif/sans-serif/monospace) for the converted HTML view, matching the EPUB reader experience.
- **Keyboard shortcuts for HTML viewer** — Ctrl+/- for font size, Ctrl+0 to reset, Ctrl+scroll to zoom.
- **Persistent HTML viewer settings** — font size, line height, and font family preferences are saved across sessions.
- **Themed HTML viewer** — the converted HTML view inherits the app's active theme (dark, light, or custom), dynamically updating colors, backgrounds, code blocks, and page separators.
- **Extract creation for OCR HTML** — text selection in the PDF-to-HTML view now triggers the floating extract button and works with the lightbulb toolbar icon, with iframe selection preserved across focus changes.
- **Page tracking for OCR HTML** — scroll position in the converted HTML view updates the page number indicator at the top to match the currently visible page section.

### Fixed

- **Convert-to-HTML button produced unusable output** — rewrote the conversion pipeline to produce structured, styled HTML with page containers and reading-order blocks instead of a plain text dump.
- **Extracts broken in OCR HTML view** — text selection was silently cleared because the PDF-specific selection guard intercepted iframe selections.
- **Theme not applied to converted PDFs** — OCR HTML content now overrides its built-in light/dark styles with the app's active theme colors.

## [1.23.6] - 2026-04-24

### Fixed

- **Cross-platform command palette shortcuts** — restored an early capture-phase `Ctrl/Cmd+K` and `Ctrl/Cmd+P` bridge while keeping the native Tauri shortcut path and customizable shortcut store dispatch, so the command palette opens reliably across Linux AppImage, Windows, macOS, and reader/search surfaces.
- **Custom shortcut matching** — hardened primary-modifier matching for shortcuts displayed as `Ctrl` on Linux/Windows and `Cmd` on macOS, and added regression coverage for platform-specific command palette matching and shortcut conflict detection.

## [1.23.5] - 2026-04-24

### Fixed

- **macOS command palette accelerator reliability** — moved the native `Cmd+K` and `Cmd+P` accelerators into a dedicated macOS Commands submenu and made the shared shortcut matcher accept either primary modifier, avoiding platform-detection misses while keeping editable-field safeguards.

## [1.23.4] - 2026-04-24

### Fixed

- **Command palette hotkey regression** — restored reliable command palette activation with `Ctrl+K` on Linux and Windows and `Cmd+K` on macOS by routing app-shell, native shortcut, search, and reader-surface handlers through the shared `command-palette-open` event.
- **Reader-focused command palette shortcuts** — document and EPUB viewer shortcut bridges now use the same cross-platform matcher as the app shell, including `Ctrl/Cmd+P` as the existing alternate palette shortcut and editable-field safeguards.

## [1.23.3] - 2026-04-24

### Fixed

- **Windows PDF loading retry crash** — PDF.js now receives a freshly copied `Uint8Array` for each load attempt, including the `disableWorker` fallback. This prevents Windows 11 WebView2 from reusing a buffer that PDF.js detached during the first worker transfer and fixes `Failed to execute 'structuredClone' on 'Window': ArrayBuffer at index 0 is already detached` when opening PDFs.

## [1.23.2] - 2026-04-23

### Fixed

- **Windows menu bar clutter** — the native menu bar (showing keyboard shortcuts) is now hidden on Windows; all shortcuts still work via the registered accelerators and global-shortcut plugin.
- **Pocket TTS "Argument list too long"** — long text passed to the Pocket TTS sidecar exceeded OS ARG_MAX limits, especially inside AppImages; text is now written to a temp file and read by the wrapper script to avoid shell argument limits.
- **PWA maskable icon background** — maskable icons had transparent backgrounds causing Android to fill with a default purple; regenerated with solid dark background matching the manifest's `background_color`.

## [1.23.1] - 2026-04-23

### Added

- **Unified `DocumentSearchState` type** — shared interface for search state across all document viewers, replacing the local-only `ViewerSearchState` in `DocumentViewer`.
- **HTML text-quote highlighting on initial jump** — command-palette hits for HTML documents now search the iframe DOM for the exact text quote, wrap it in a visible highlight, and scroll to it (previously only reused existing search marks).
- **EPUB DOM-based fallback for command-palette highlights** — when `book.search()` returns no results for an initial-jump highlight query, the EPUB viewer now falls back to `searchVisibleContents()` to find and highlight the match in rendered content.

### Changed

- **EPUB initial-jump resolution** — `applySearchHighlights()` now uses the DOM-based visible-content search as a fallback when `book.search()` fails, and has a 3-second timeout to avoid hanging on slow EPUBs.
- **PDF highlight page window** — PDF initial-jump highlights now search a ±3 page window around the estimated page instead of only the exact estimated page, making navigation resilient to page-estimation errors.
- **HTML initial-jump timing** — increased retry delay from 150ms to 300ms alongside the existing `onLoad` handler for more reliable iframe content resolution.

### Fixed

- **EPUB command-palette hits with empty CFI** — opening an EPUB from a command-palette sub-hit now resolves the match even when the CFI is empty, by searching rendered content for the text quote at the specified match index.
- **PDF page-estimation misses** — PDF highlights that missed the correct page due to linear percentage estimation now work because the viewer searches adjacent pages.
- **HTML command-palette hits with no prior search marks** — HTML viewer now independently locates and highlights the text quote instead of depending on pre-existing search marks from the in-document search flow.
- **Command-palette sub-hit navigation** — clicking a secondary match under a search result now opens the chosen occurrence instead of falling back to the document’s primary match or top position.
- **EPUB visible-word search misses** — searching from the document viewer on an EPUB now finds words that are plainly visible on screen even when the book-wide EPUB search API fails to return them.
- **PDF in-document search** — PDF search now scans extracted page text, highlights active matches in the text layer, moves across pages correctly, and reports when a PDF has no searchable text layer instead of silently failing.
- **HTML and markdown result jumps** — document search hits for rendered text surfaces now preserve text quotes and scroll targets so opening a match lands closer to the exact selected occurrence.
- **Chrome-installed PWA icon caching** — versioned manifest/icon links, sprout-specific manifest entries, and updated service-worker icon references now force Chrome and related install surfaces to pick up the new sprout icon instead of stale launcher artwork.
- **Linux desktop launcher icon** — the local `incrementum.desktop` entry now points directly at the regenerated sprout-based desktop icon so the application launcher no longer resolves an older themed icon.

## [1.23.0] - 2026-04-23

### Added

- **Extract-to-document navigation** — extracts created from the queue scroll page now carry source context, so jumping back to the source document lands on the exact extract. The extracts list highlights the focused extract and offers a "back to source" button.
- **Text highlight persistence** — anchored text highlights can be rendered inside extract cards and the document viewer using character-offset positions, with a new `textHighlights` utility that walks text nodes, wraps ranges in `<mark>` elements, and avoids re-highlighting already-wrapped content.
- **Extract color highlighting** — extracts now display their highlight color inline, and a unified `highlightColors` utility normalizes named colors (yellow, green, blue, pink, purple) across PDF, EPUB, and text surfaces.
- **Source-aware extract creation from queue** — creating an extract in queue scroll mode records the document, queue type, and source kind, enabling round-trip navigation between queue items and their extracts.
- **Image registry library** — new library page for browsing, searching, and filtering uploaded images with grid and list views, accessible from the command palette and main navigation.
- **AI image occlusion flashcards** — flashcard studio now supports an image occlusion mode that sends uploaded images to a vision-capable model to auto-generate cloze-deletion flashcards, with model-agnostic prompt messaging.

### Changed

- **Document viewer refactored for extract navigation** — `DocumentViewer` accepts `focusedExtractId`, `extractSourceContext`, and `extractPostCreateBehavior` props, enabling external callers (queue, extracts list) to drive extract-focused workflows without embedding application logic in the viewer.
- **Local video player media source abstraction** — the video and audio player now resolves local media through a new `localMediaSources` module that classifies errors (access denied, unsupported format, decode failure) and supports multi-source fallback, replacing the previous single-string `src` prop.

### Fixed

- **Queue performance** — the queue command now batch-fetches all document titles in a single query instead of issuing per-item lookups, reducing N+1 database round-trips when the queue contains many items with extracts.
- **Source context lost after extract creation** — creating extracts from the queue previously discarded the source navigation context; the full document/queue/scroll state is now preserved so the "return to source" flow works correctly.
- **Toast notification on segment action** — clicking the segment button now shows a toast confirming the action was triggered.

## [1.22.1] - 2026-04-22

### Fixed

- **Windows PDF loading crash** — PDF.js `structuredClone` failed on Windows 11 WebView2 with "ArrayBuffer at index 0 is already detached" because the `Uint8Array` passed to `pdfjsLib.getDocument()` could share a detached backing buffer. Fixed by ensuring a fully independent `ArrayBuffer` copy at both the base64 decode stage and the PDF.js data source construction.

## [1.22.0] - 2026-04-21

### Added

- **Automatic document segmentation on import** — the existing Rust segmentation engine is now wired into the document import flow, so imported documents can automatically be split into extracts using the user’s configured segmentation method, target length, and overlap settings.
- **Manual "Segment" action for documents** — documents with no extracts now expose a one-click segmentation action in the Documents view, making it easy to create extracts later for items imported without auto-processing.
- **Tauri-level global shortcut registration** — critical navigation shortcuts are now registered at the native layer with `tauri-plugin-global-shortcut`, preventing webview-level interception on Linux and making the documented shortcuts reliable across platforms.

### Fixed

- **Cross-platform keyboard shortcuts** — consolidated overlapping shortcut handlers, fixed primary-modifier matching on Linux/macOS, and restored reliable behavior for the handbook shortcuts such as Queue, Review, Dashboard, Command Palette, Import, Settings, and shortcut help.
- **Document import segmentation gap** — the existing `autoProcessOnImport` setting now actually triggers segmentation after import instead of being stored but ignored.
- **Segmentation settings propagation** — frontend segmentation calls now pass the selected segmentation method, target length, and overlap through to the backend instead of always using default smart segmentation.
- **RSS reader runtime crash** — restored the missing `Eye` icon/API imports in the RSS feed settings flow so the RSS reader no longer crashes at runtime with `ReferenceError: Eye is not defined`.
- **RSS feed refresh SQL escaping** — replaced interpolated `UPDATE rss_feeds` statements in the Tauri and browser-sync HTTP RSS update paths with bound SQL parameters, fixing feed refresh failures caused by apostrophes or other quoted text in feed metadata.
- **Windows PDF import crash** — added a startup compatibility shim for `Promise.try` and `Promise.withResolvers` so PDF import and PDF.js loading no longer fail on older Windows 11 WebView2 runtimes with `TypeError: Promise.try is not a function`.
- **Local `llama.cpp` model support** — local OpenAI-compatible endpoints on `localhost` can now be added without a fake API key, custom model IDs can be entered manually, and model discovery now reads `/v1/models` so local models such as `Qwopus3.5-27B-v3.5` can be selected reliably.
- **Dynamic OpenAI and Anthropic model discovery** — provider settings now prefer each vendor’s live `/v1/models` endpoint instead of relying on stale hard-coded model lists, with fallbacks only when live discovery is unavailable.
- **Duplicate GitHub release notes** — release workflows now publish changelog-backed notes once instead of regenerating and appending autogenerated release notes from multiple asset-upload steps.
- **Linux Tauri build stability** — restored the `lld` linker preference for the Linux Tauri workspace and raised the wrapper stack limit to avoid the `rustc` crashes that were leaving corrupt zero-byte build artifacts behind.

### Changed

- **Application icon refresh** — replaced the app, PWA, and browser-extension icon set with the new branded artwork across packaged Tauri assets, browser extension icons, Apple touch icons, and web manifest images.
- **OCR local-provider guidance** — refreshed the OCR settings copy and handbook instructions to document `llama.cpp` alongside vLLM for local multimodal OCR, with clearer endpoint/model setup guidance.
- **User handbook accuracy** — updated the handbook to reflect the current theme/font counts, available OCR providers, local OCR setup options, and the now-working auto-segmentation flow.

## [1.21.11] - 2026-04-21

### Added

- **Ollama model discovery** — the LLM provider settings now live-fetch installed models from a running local Ollama instance (`/api/tags`) instead of using a hardcoded list. Model names include size and family (e.g., "llama3.2 (llama, 2.0 GB)"), and a clear error message is shown when Ollama is unreachable or has no models installed.
- **Assistant input history** — pressing Up/Down arrow keys on the first/last line of the assistant input field cycles through previously sent messages in the current conversation.
- **Assistant context resolution** — PDF assistant context is now resolved lazily per-prompt using a `resolveForPrompt` callback, so the assistant picks up OCR text, page-window content, and on-demand text extraction as they become available rather than relying on a single stale content snapshot.
- **Document dismiss in review queue** — the item details popover in the review queue now refreshes the queue when a document is dismissed, preventing stale items from lingering.
- **Document dismiss in scroll queue** — dismissing a document from the scroll queue popover now advances to the next item and reloads the queue.
- **Confirm dialog for single document deletion** — deleting a document from the documents list now uses the styled confirm dialog instead of a bare `window.confirm()`.
- **Edit AI provider configurations** — provider cards in LLM settings now have an edit button that opens the form pre-populated with existing values, so API keys, models, and base URLs can be updated without deleting and re-adding the provider.

### Fixed

- **Ollama assistant API key check** — the assistant panel and PWA assistant button no longer require an API key when using Ollama, matching the existing backend behavior that skips auth for local models.
- **Dismissed documents appearing in queue** — dismissed documents are now excluded from both the main reading queue and the due-documents view, with unit tests covering both paths.
- **Browser-backend context window** — the browser-sync LLM backend now respects the caller’s `contextWindowTokens` setting instead of always defaulting to 2000.
- **Audiobook chapter timebase parsing** — the ffmetadata chapter parser now correctly handles fractional timebase values (e.g., `1/1000`) and extracts chapter start/end times in seconds, with duration parsed from ffmpeg’s stderr output.
- **M4B audiobook playback** — desktop audiobook playback now prepares `.m4b` files through an ffmpeg-backed conversion path so audiobook files that previously failed with `NotSupportedError` can play reliably in the viewer.
- **Audiobook chapter extraction** — replaced the placeholder audiobook chapter parser with ffmpeg metadata parsing so embedded chapter titles and timings populate the existing chapter sidebar UI for supported audiobook files.
- **Audiobook viewer import/runtime binding** — corrected the audiobook viewer’s API import path so the new playback-preparation flow loads cleanly at runtime.
- **Ollama chat/stream response parsing** — fixed Ollama non-streaming and streaming calls deserializing responses into Ollama-native structs instead of the OpenAI-compatible format returned by the `/chat/completions` endpoint. The non-streaming path now uses `OpenAIResponse` and the streaming path now parses SSE `data:` lines with `OpenAIStreamChunk`.

## [1.21.10] - 2026-04-20

### Changed

- **Cloud backup upgrade** — expanded the cloud backup flow across Dropbox, Google Drive, and OneDrive with stronger backend orchestration, auth/token persistence, scheduler wiring, and settings/restore UI updates.

### Fixed

- **Browser/PWA document commands** — corrected browser-backend document/dashboard handlers that were throwing `ReferenceError: docs is not defined` in PWA mode.
- **PWA update reliability** — hardened service-worker activation and cache invalidation so new deployments replace stale hashed assets more aggressively.
- **Runtime hook crash** — restored missing `useCallback` imports in RSS scroll and NotebookLM login flows, eliminating the misleading React crash that surfaced during document viewing.

## [1.21.9] - 2026-04-20

### Changed

- **App security hardening** — tightened RSS/OPML feed URL normalization and related feed-discovery handling to reduce malformed input edge cases and make feed imports safer.
- **NotebookLM and backend maintenance** — cleaned up NotebookLM runtime/provider code paths and simplified several backend command implementations for more predictable behavior.
- **RSS and browser-sync reliability cleanup** — refined RSS folder/feed update flows and related browser/backend integration paths to reduce brittle handling.

### Fixed

- **Linting and code-quality errors** — cleared a broad pass of TypeScript, ESLint, Clippy, and Rust style issues across the frontend and Tauri backend.
- **RSS scoring and folder update edge cases** — fixed a few small correctness issues in RSS classifier matching and repository/state reuse during folder updates.
- **Unused code and noisy warnings** — removed unused imports, variables, and redundant patterns that were generating avoidable warnings.

### Performance

- **Selection and excerpt processing efficiency** — tightened several PDF/document selection helpers and simplified excerpt chunk sizing logic to reduce unnecessary work in reading and extraction flows.

## [1.21.8] - 2026-04-19

### Added

- **PDF OCR region select** — users can select a region on any PDF page (including scanned/image-only pages with no text layer) and OCR it into an extract. Activated via the Scan toolbar button or Ctrl+Shift+O, the user draws a rectangle over the desired area, the selected region is sent to the local Tesseract OCR backend, and the recognized text is presented in an editable preview panel before opening the Extract Modal.
- **Rich article capture from browser extension** — the extension now sends styled HTML (with computed CSS inlined) and up to 24 extracted images per page to the backend, with a server-side readability fallback that enriches content if the extension's extraction yields less text.
- **ArXiv HTML import** — papers can now be imported as HTML from `arxiv.org/html/` instead of PDF only, with a PDF/HTML toggle in both the import dialog and the ArXiv browser detail panel.
- **Expanded ArXiv category taxonomy** — complete category tree (~150 categories across 16 domains) with hierarchical collapsible browsing, replacing the previous hand-picked flat list.
- **Cloze creation from source excerpt** — the cloze editor now shows the source extract text in a selectable panel; users can highlight text and click "Cloze selection" or press Ctrl+B to create cloze deletions directly from the excerpt.
- **Split-pane article editor** — scroll mode article editor now shows an HTML article preview on the left and the text editor + extracted images panel on the right, with Ctrl+E to create extracts from selected text.
- **Toggleable EPUB table of contents** — desktop TOC sidebar can now be collapsed/hidden via a close button, with a floating "Table of Contents" button to re-open it.
- **Browser extension save notifications** — a toast notification appears when the browser extension saves a page, and the document list refreshes automatically.
- **Working "Open Data Folder" button** — the data folder button in Settings now actually opens the app data directory and displays the path.

### Changed

- **Browser extension title handling** — saved pages now prefer the destination page's actual title over the link text.
- **Dashboard tab navigation** — clicking a dashboard quick-action button (e.g., Settings) now always navigates to the target tab, even if it is already open. Previously it would do nothing if the tab existed.
- **Article HTML styling** — `processHtmlContent()` now preserves more of the source page's visual style instead of overriding fonts and hiding elements.
- **Interface sound pack refresh** — replaced the previous UI feedback assets for `success`, `error`, `click`, `streak`, `review-complete`, and `milestone` with newly added `.wav` sound files, moved them into `public/sounds/`, and rewired the shared sound service to use the new assets.

### Fixed

- **Linux/Wayland webview positioning** — skips unreliable `window.outerWidth/outerHeight` offset detection on Linux, uses `getBoundingClientRect()` on the container element, and adds a `window.resize` listener as a fallback for Wayland compositors.
- **Webview crash guard** — `.on()` call on embedded Webview is now guarded with a `typeof` check to prevent crashes in Tauri v2 versions where the method may not exist.
- **Mobile crash on `.contains()`** — guarded all `.contains()` DOM calls with `instanceof Node` checks.
- **Stale PWA assets on mobile** — bumped service worker cache version to v5.
- **Web article detection in QueueScroll** — uses `metadata.source === "browser_extension"` instead of unreliable URL prefix matching.
- **Existing browser-imported documents get enriched** — when a duplicate URL is re-saved, the server updates the existing document if it is missing text or HTML content.

## [1.21.6] - 2026-04-16

### Fixed

- **Cloze creation context** — the original extract passage is now shown above the cloze editor so users can see which word to cloze.

## [1.21.5] - 2026-04-16

### Fixed

- **Animated theme performance on Windows** — replaced per-frame canvas self-draw brightness gain (16MB+ pixel R/W per frame) with a GPU-accelerated CSS `filter: brightness()`, eliminating the main source of lag on Windows WebView2.

## [1.21.4] - 2026-04-16

### Fixed

- **Animated themes on Windows** — theme backdrop animations were silently suppressed by the Windows `prefers-reduced-motion` accessibility setting. Animated themes are now always shown when explicitly selected by the user.
- **Console window on Windows** — a terminal window no longer appears alongside the app on Windows.
- **Popover theming** — popover foreground and background colors now follow the active theme instead of falling back to defaults.

## [1.21.3] - 2026-04-16

### Fixed

- **Animated themes on Windows** — improved canvas backdrop rendering reliability on Windows WebView2 with proper `display: block` styling, robust brightness gain compositing via `ctx.save()`/`restore()`, and a diagnostic warning when `prefers-reduced-motion` suppresses animations at the OS level.
- **Popover theming** — popover foreground and background colors now follow the active theme instead of falling back to defaults.

## [1.21.1] - 2026-04-16

### Added

- **SM-20 FSRS-family algorithm branch** — implemented the 3-expert mixture model (power-law, shifted power-decay, exponential forgetting) with 35 tunable parameters discovered in the SM-20 binary via Ghidra decompilation.

### Fixed

- **SM-20 Expert 2 exponent** — corrected `fsrs_expert2` to use `log2(0.9) ≈ -0.152` instead of `0.9^2 = 0.81`, matching the actual binary computation `FUN_0040c140(0.9) / FUN_0040c140(2.0)`. The old exponent caused unbounded growth instead of a proper forgetting curve.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.21.0] - 2026-04-14

### Added

- **NewsBlur-style RSS expansion** — shipped a major RSS reader upgrade with site discovery, classifier/training primitives, related stories, shared stories, read stories, annotations, tag-aware saved stories, keyboard shortcut overlays, expanded feed statistics, and richer story/list layouts across the RSS tab and scroll mode.
- **Discover Sites browser** — added a full-screen discovery experience with curated/feedspot-seeded sources, recommendation sections, category browsing, subscription actions, and generated curated feed imports for politics, science, AI, security, programming, travel, food, and related categories.
- **Newsletter discovery and previews** — added Substack/newsletter discovery APIs and preview flows, richer curated newsletter directory behavior, and newsletter subscription paths that integrate with the RSS reader.
- **Backend RSS feature surface** — added new Tauri/browser-sync commands, migrations, and API modules for folders, search, tags, annotations, site discovery, clustering, classifiers, and newsletter/substack integrations.

### Changed

- **RSS navigation and customization** — refreshed the RSS tab structure, feed settings, customization controls, browser backend support, and reader/sidebar interactions to support the expanded RSS feature set.
- **Curated feed data source** — merged the handwritten curated feed list with generated Feedspot imports, plus an importer/report pipeline to expand and maintain the discovery catalog.
- Updated app, package, Tauri, and Rust crate version metadata to `1.21.0`.

### Fixed

- **Discover Sites subscription refresh** — subscribing from Discover Sites now reloads the RSS reader state immediately so newly added feeds appear in the sidebar.
- **Stale NBC News feed URL** — normalized the old NBC feed endpoint to the current working RSS URL so existing subscriptions refresh correctly instead of failing XML parsing.
- **RSS sidebar organization interactions** — improved folder/feed movement interactions in the RSS sidebar and stabilized the related client-side state handling.

## [1.20.3] - 2026-04-14

### Added

- **Document category migration** — added database migration `038_remove_document_category_fk` to remove the unintended foreign key constraint from `documents.category`, preserving category as free-form text and recreating the relevant indexes after the table rebuild.

### Fixed

- **JSON deck registration from Documents imports** — importing study JSON decks from the Documents page now creates or reuses the matching study deck entry immediately, including drag-and-drop, JSON picker imports, and mixed local file imports.
- **Study deck seeding for JSON imports** — deck auto-seeding now recognizes `study-json-import` tags in addition to `anki-import`, so JSON-imported decks are rediscovered correctly on first load.
- **Review algorithm transparency consistency** — the transparency panel now labels the next review using the active global algorithm while still reading stored SuperMemo state from the card data for reps, lapses, and retrievability details.

## [1.20.2] - 2026-04-14

### Added

- **Study JSON deck import** — import flat-map JSON deck files (`{question: card_object}`) from external tools with full scheduling data preservation (ease factor, interval, repetitions, due date, lapse count). Cards are deduplicated by SHA-256 hash of question text and tagged with `study-json-import`. Includes both a Rust backend (Tauri commands + 8 unit tests) and a browser-compatible implementation using SubtleCrypto.
- **Multi-deck selection** — deck filtering now supports selecting multiple decks simultaneously instead of a single deck. Toggle decks on/off from the deck picker, review queue filters by all selected decks, and deck pills reflect multi-select state.
- **JSON import in file picker** — new "JSON" tab in the enhanced file picker with drag-and-drop support for `.json` deck files on the Documents page.

### Changed

- "Import Anki" button generalized to "Import Deck" — now accepts both `.apkg` and `.json` files.
- Updated handbook and documentation to reference FSRS-6 as the default algorithm recommendation (renamed from FSRS-5).
- Handbook Table of Contents sidebar is now independently scrollable when entries exceed the viewport.

### Removed

- Cleaned up 5 obsolete documentation files (IMPLEMENTATION_STATUS, NEWSLETTER_IMPLEMENTATION_COMPLETE, UX_UI_IMPROVEMENTS, newsletter-directory-ui-ux-improvements, newsletter-improvements-summary).

## [1.20.1] - 2026-04-13

### Changed

- Refreshed app sound effects with a more tactile UI/notification set.
- Added notification-gated review completion and milestone sounds.
- Improved haptic feedback behavior by explicitly disabling vibration on unsupported PWA/browser platforms.

### Fixed

- Fixed multiple TypeScript errors across the app.
- Fixed Tauri sound playback reliability for short UI sounds.
- Updated notification sound preview/settings wiring to use the current sound map consistently.
- Updated app, package, Tauri, and Rust crate version metadata to `1.20.1`.

## [1.20.0] - 2026-04-12

### Added

- **Algorithm-aware postpone system** — replaces the naive "add N days" postpone with a priority-weighted, SM-20-inspired postponement engine that considers item stability, difficulty, retrievability, and review count when computing interval increases.
  - **Single-item smart postpone** — right-click any item (learning item or document) in the queue and choose "Postpone" to get an algorithm-computed interval increase based on the item's current state. Well-established items (high stability, low difficulty) receive larger increases; struggling items are preserved with smaller increases.
  - **Postpone All** — toolbar button to batch-postpone all eligible items in the queue. Shows a confirmation dialog with the count of items to be postponed and a summary after completion (items postponed, average increase, items skipped).
  - **Auto-postpone** — opt-in toggle in learning settings that prompts you to postpone outstanding items when you open the queue with overdue reviews.
  - **Eligibility gates** — items that are already well-established (high priority, high stability, many repetitions, long elapsed time) are automatically skipped during postponement to preserve their learning schedule.
  - **Interval randomization** — optional noise distribution (matching the SM-20 formula) prevents all postponed items from clustering at the same future date.
  - **Simple mode** — alternative postpone mode using linear interpolation by priority, bypassing eligibility checks.
  - **Configurable settings** — full postpone settings panel in Learning Settings with controls for item/document increase percentages, min/max limits, caps, floors, eligibility thresholds, randomization, and auto-postpone toggle.
  - **Full i18n coverage** — all postpone UI strings translated across 6 locales (en, zh, es, de, fr, ja).
  - **22 unit tests** — comprehensive test coverage for the postpone engine covering priority computation, eligibility gates, simple mode, randomization, clamping, edge cases, and batch operations.

### Changed

- Updated app, package, Tauri, and Rust crate version metadata to `1.20.0`.
- `QueueContextMenu` now supports algorithm-aware postpone for both learning items and documents (previously learning-items only with fixed-day presets).

## [1.19.0] - 2026-04-11

### Added

- **Modern AI Summary Panel for RSS Scroll Mode** — complete UX overhaul of the AI summary feature in RSS reading.
  - **Theme-aware design** — replaced amber-on-black terminal aesthetic with modern CSS variable-based styling that matches the app's design system and supports light/dark modes.
  - **Smooth animations** — panel slides in/out with 300ms ease-out (enter) and 200ms ease-in (exit) transitions.
  - **Resizable & repositionable** — drag handle supports 240-600px width; position toggle between left/right side; mobile responsive bottom sheet variant (< 768px).
  - **Summary caching** — client-side cache with 7-day TTL, 100-entry LRU eviction, content hash validation, and localStorage persistence. Prevents redundant API calls when reopening panels.
  - **Generation controls** — collapsible settings for summary length (Brief: 100 tokens, Medium: 200 tokens, Detailed: 400 tokens) and focus area (Key Points, Actionable Items, Background Context).
  - **Stage-based loading** — progress indicator shows "Analyzing content...", "Extracting key points...", "Synthesizing summary..." stages.
  - **Keyboard shortcuts** — `S` to generate/toggle summary, `H` to hide when open.
  - **One-click actions** — copy to clipboard (with visual feedback), share via Web Share API (with desktop fallback), save as extract with tags ["ai-summary", "rss"].
  - **Inline badge** — subtle "AI Summary" indicator appears when cached summary exists but panel is closed; click to expand.
  - **Terminal mode preserved** — retro terminal aesthetic remains available as a toggle option for users who prefer it.
- **Knowledge Graph scale improvements** — the graph is now readable and navigable with hundreds of flashcards instead of collapsing into an unreadable hairball.
  - **Barnes-Hut force simulation** — replaced O(n²) repulsion with a quadtree-based O(n log n) approximation, keeping the physics simulation responsive at 500+ nodes.
  - **Hierarchical node clustering** — flashcards collapse under their parent extract, extracts under their parent document at low zoom. Click a cluster badge to expand it with an animated zoom-to-fit transition.
  - **Level-of-detail rendering** — three visual tiers based on zoom: colored dots at low zoom, labeled circles at medium zoom, full icons/glow/labels at high zoom.
  - **Minimap** — a 180×120px overview canvas in the bottom-left corner with a viewport rectangle and click-to-navigate. Toggleable via a toolbar button, visible by default when the graph has more than 50 nodes.
  - **Search-with-zoom** — typing in the search box auto-zooms the viewport to frame matching nodes after a 300ms debounce. A reset-view button appears during active search.
  - **Edge proximity blending** — overlapping edges render with reduced opacity to cut visual noise in dense regions.
- **SuperMemo 20 scheduling** — added SM-20 as a first-class algorithm option across desktop and browser-backed review flows, with native Rust and TypeScript implementations based on the reverse-engineered SM-20 V2 interval-growth core.
- **SuperMemo 20 transparency** — review transparency, inspector, preview-interval, item-detail, and zen-review surfaces now understand SM-20 state and display SM-20-specific stability, difficulty, retrievability, repetitions, lapses, and forget-curve behavior when SM-20 is active.

### Changed

- **Knowledge Graph controls are now wired** — layout algorithm selector (Force/Circular/Hierarchical/Grid), node size slider, and link distance slider in the filter sidebar all apply to the graph in real time.
- Expanded internationalization coverage across review, queue, keyboard shortcut, graph, mobile, document, settings, and shared UI surfaces. This pass removes additional hardcoded English strings, broadens locale-key usage across `en`, `zh`, `es`, `de`, `fr`, and `ja`, and keeps the release aligned with the current i18n audit work.
- Updated app, package, Tauri, and Rust crate version metadata to `1.19.0`.

### Fixed

- **QuadTree infinite recursion** — the Barnes-Hut quadtree now uses a leaf-body model with a depth limit (40) to prevent infinite subdivision when nodes share the same position.
- Restored native Rust test/build health by updating the stale `Extract` test helper in `src-tauri/src/generator/mod.rs` to include the current `progressive_summaries` field.

## [1.18.7] - 2026-04-10

### Added

- **Progressive disclosure for extract review** — extracts with progressive disclosure enabled now gradually reveal content across multiple review sessions. AI-generated summaries are shown at early levels, then progressively more of the original text, and finally the full content at the max level. Good/Easy ratings advance the disclosure level by one.
- **Ctrl+B shortcut in Cloze Creator** — select text in the cloze creation popup and press Ctrl+B (or Cmd+B) to wrap it in `{{ }}` blanks. A "Wrap as blank" button is also available.
- **Range-based cloze rendering in ReviewCard and ZenReviewMode** — cloze cards created with character ranges (from the Cloze Creator) now render correctly in all review modes, not just scroll mode.

### Fixed

- **cloze_ranges never persisted** — the `cloze_ranges` column existed in the schema but was omitted from the INSERT statement and all four read methods. Range-based cloze data was silently lost after creation.
- **update_extract SQL missing disclosure fields** — `progressive_disclosure_level`, `max_disclosure_level`, and the new `progressive_summaries` column were not in the UPDATE statement, so edits to these fields were silently lost.
- **createExtract/updateExtract API dropped maxDisclosureLevel** — the TypeScript API layer accepted the parameter but never passed it to the Tauri backend.

## [1.18.6] - 2026-04-10

### Changed

- Expanded Chinese localization coverage across the remaining queue, review, import, analytics, settings, mobile navigation, and shared dialog surfaces. This pass removes additional hardcoded English strings from screen-level and shared UI components, adds the missing locale keys to both `en` and `zh`, and keeps locale parity at 100% (`missing 0`, `extra 0`).

### Fixed

- **macOS SQLite linkage fix** — documented the earlier macOS desktop fix where the system SQLite was missing symbols required by `sqlx`. The workaround added explicit macOS build-time linkage to Homebrew SQLite (`/opt/homebrew/opt/sqlite` on Apple Silicon, `/usr/local/opt/sqlite` on Intel) and preferred the static `libsqlite3.a` when present, preventing the startup/build failures caused by relying on the incomplete system SQLite.
- **Screenshot overlay runtime stability** — the screenshot overlay now lazy-loads Tauri window and event APIs instead of importing them eagerly at module load time. This avoids initializing Tauri-only bindings in the wrong runtime and prevents the overlay from crashing when opened outside the expected desktop context.

## [1.18.5] - 2026-04-09

### Added

- **SuperMemo 18 algorithm transparency** — review UI now adapts to the active algorithm. When SM18 is selected, the transparency panel, inspector, and zen-mode overlay show SM18-specific stats (stability, difficulty on 0-1 scale, retrievability via `R = 0.9^(t/S)`, reps, lapses) with correct formulas and labels, matching the existing FSRS-6 transparency experience.

### Changed

- Review backends (Tauri and browser) now respect the algorithm setting passed from the frontend during review submission instead of always reading the stale `algorithm_type` stored on the card. The effective algorithm is also persisted back to the card for correct display.
- FSRS-specific settings (retention slider, personal optimizer, scoped overrides) are hidden in Learning Settings when a non-FSRS algorithm is selected.
- Item details popover scheduling section header now shows "FSRS-6" or "SuperMemo 18" based on the active algorithm.

### Fixed

- Algorithm selection in settings had no effect on actual review scheduling — backends ignored the passed `algorithm` parameter and always dispatched to FSRS-6. All three backends (Tauri, browser, MCP) now correctly route to the user's chosen algorithm.
- Cards created before the algorithm selector was added were permanently stuck on FSRS-6 even after switching to SM18 — the `algorithm_type` field was never updated.

### Added

- **Comprehensive LaTeX engine upgrade** for flashcard rendering with KaTeX.
  - Enabled mhchem extension for chemistry notation (`\ce{}`, `\pu{}`) — renders chemical formulas, equations, and physical units natively.
  - Auto-detection of display-mode-only environments (`gather`, `split`, `multline`, `flalign`, `alignat`, `align`, `tag`) — inline expressions containing these now automatically render as centered block math.
  - Custom macro pre-processor supporting `\newcommand`, `\renewcommand`, and `\DeclareMathOperator` — macros are scoped per card field and expanded before rendering.
  - Live LaTeX preview in the Flashcard Studio editor — rendered math updates as users type with a 300ms debounce, using the same rendering pipeline as review surfaces.
  - Fallback UX improvements — KaTeX rendering errors now show a red-tinted fallback with the raw source and a tooltip describing the error, distinct from the existing yellow non-error fallback.
  - Expanded test coverage: 35 new tests for mhchem, display-mode detection, macro expansion, delimiter parsing, and fallback behavior.
- **Image Occlusion card type** — hide parts of images (diagrams, charts) during review by defining rectangular regions that reveal on answer. Supports multiple labeled regions per card, image selection from the asset registry, and localized study prompts.
- **Multiple Choice card type** — create question cards with multiple answer options, a single correct answer, and optional explanation. Options render as selectable buttons with green/red color-coding after reveal. Supports 2+ options with validation at creation time.
- **Interaction metadata system** — both card types store their specialized data (options, correct answer, regions, image asset) in a structured JSON `interaction_metadata` field, enabling frontend-specific rendering while keeping the backend type system clean.

### Changed

- Broadened LaTeX hint detection in the Anki normalization pipeline to recognize macro definitions (`\newcommand`, `\DeclareMathOperator`), chemistry commands (`\ce`, `\pu`), and a wider range of LaTeX commands for bare-text detection.
- Escaped dollar signs (`\$`) are now properly handled during delimiter tokenization — they are preserved as literal characters and not treated as math delimiters.

### Fixed

- Display-mode-only environments (e.g., `gather`, `split`) no longer silently degrade when used inside inline delimiters — they auto-upgrade to block display mode with proper centered rendering.

## [1.18.3] - 2026-04-09

### Changed

- Migrated the app's configurable UI/theme font loading to an offline-first model by bundling local font assets and removing the runtime Google Fonts dependency.
- Aligned scheduling terminology and defaults across the app with FSRS-6, including updated labels and canonical 21-parameter profile handling for existing personalized weights.

### Fixed

- Fixed browser/PWA Anki package (`.apkg`) imports so imported learning items stay linked to the correct created deck documents and preserve tags needed by downstream review/deck flows.

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

[Unreleased]: https://github.com/melpomenex/incrementum-tauri/compare/v1.21.12...HEAD
[1.21.12]: https://github.com/melpomenex/incrementum-tauri/compare/v1.21.11...v1.21.12
[1.21.11]: https://github.com/melpomenex/incrementum-tauri/compare/v1.21.10...v1.21.11
[1.21.10]: https://github.com/melpomenex/incrementum-tauri/compare/v1.21.9...v1.21.10
[1.19.0]: https://github.com/melpomenex/incrementum-tauri/compare/v1.18.7...v1.19.0
[1.18.7]: https://github.com/melpomenex/incrementum-tauri/compare/v1.18.6...v1.18.7
[1.18.6]: https://github.com/melpomenex/incrementum-tauri/compare/v1.18.5...v1.18.6
[1.18.5]: https://github.com/melpomenex/incrementum-tauri/compare/v1.18.4...v1.18.5
[1.18.4]: https://github.com/melpomenex/incrementum-tauri/compare/v1.18.3...v1.18.4
[1.18.3]: https://github.com/melpomenex/incrementum-tauri/compare/v1.18.0...v1.18.3
[1.2.0]: https://github.com/melpomenex/incrementum-tauri/compare/v1.0.0...v1.2.0
[1.0.0]: https://github.com/melpomenex/incrementum-tauri/releases/tag/v1.0.0
