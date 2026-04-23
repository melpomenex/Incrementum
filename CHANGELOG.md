# Changelog

## [1.23.0] - 2026-04-23

### Added

- **Extract-to-document navigation** — extracts created from the queue scroll page now carry source context, so jumping back to the source document lands on the exact extract. The extracts list highlights the focused extract and offers a "back to source" button.
- **Text highlight persistence** — anchored text highlights can be rendered inside extract cards and the document viewer using character-offset positions, with a new `textHighlights` utility that walks text nodes, wraps ranges in `<mark>` elements, and avoids re-highlighting already-wrapped content.
- **Extract color highlighting** — extracts now display their highlight color inline, and a unified `highlightColors` utility normalizes named colors (yellow, green, blue, pink, purple) across PDF, EPUB, and text surfaces.
- **Source-aware extract creation from queue** — creating an extract in queue scroll mode records the document, queue type, and source kind, enabling round-trip navigation between queue items and their extracts.

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
