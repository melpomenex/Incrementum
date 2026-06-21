# Feature Overview

Complete list of Incrementum features and their implementation status.

---

## Document Management

| Feature | Status | Description |
|---------|--------|-------------|
| PDF Import | ✅ Implemented | Full PDF rendering with PDF.js, text extraction, and position tracking |
| EPUB Import | ✅ Implemented | EPUB.js-based reader with reflowable text, CFI position tracking |
| Markdown Import | ✅ Implemented | Native Markdown rendering with syntax highlighting |
| HTML Import | ✅ Implemented | Web article extraction with readability parsing |
| Text Files | ✅ Implemented | Plain text (.txt) import and viewing |
| URL Scraping | ✅ Implemented | Web content extraction with article detection |
| Arxiv Integration | ✅ Implemented | Direct research paper import with metadata extraction |
| Anki Import (.apkg) | ✅ Implemented | Full Anki deck migration with card types and scheduling |
| SuperMemo Import | ✅ Implemented | ZIP export import from SuperMemo |
| Screenshot Capture | ✅ Implemented | Screen capture with OCR text extraction |
| Document Organization | ✅ Implemented | Categories, tags, and folder structure |
| Document Search | ✅ Implemented | Full-text search with filters and sorting |

---

## Reading Experience

| Feature | Status | Description |
|---------|--------|-------------|
| Scroll Mode Reading | ✅ Implemented | Continuous scrolling with progress tracking |
| Page Mode Reading | ✅ Implemented | Page-by-page navigation for PDFs |
| Position Persistence | ✅ Implemented | Resume exactly where you left off |
| Highlighting | ✅ Implemented | Multi-color text highlighting with categorization |
| Extract Creation | ✅ Implemented | Convert highlighted text to extracts |
| Note Taking | ✅ Implemented | Add personal notes to documents |
| Table of Contents | ✅ Implemented | Auto-generated TOC for supported formats |
| Search in Document | ✅ Implemented | Find text within documents |
| Zoom Controls | ✅ Implemented | Adjust text size and zoom level |
| Full Screen Mode | ✅ Implemented | Distraction-free reading experience |
| Vimium Navigation | ✅ Implemented | Vim-style keyboard shortcuts (j/k, gg, G, /) |

---

## Learning System

| Feature | Status | Description |
|---------|--------|-------------|
| FSRS-6 Algorithm | ✅ Implemented | State-of-the-art spaced repetition scheduler |
| SM-18 Algorithm | ✅ Implemented | Latest SuperMemo 18 algorithm with 3D SInc matrix |
| SM-2 Algorithm | ✅ Implemented | Classic SuperMemo 2 algorithm option |
| Flashcard Creation | ✅ Implemented | Basic front/back cards |
| Cloze Deletion | ✅ Implemented | Fill-in-the-blank style cards |
| Q&A Cards | ✅ Implemented | Question and answer format |
| Image Occlusion | ✅ Implemented | Hide parts of images (diagrams, charts) — full card type with region editor |
| Multiple Choice | ✅ Implemented | Multi-option cards with correct-answer highlighting |
| Ordering & Matching | ✅ Implemented | Sequence and pair-matching interaction types |
| AI Card Generation | ✅ Implemented | LLM-powered flashcard creation |
| Auto-Summarization | ✅ Implemented | AI-generated document summaries |
| Extract to Card | ✅ Implemented | Convert extracts directly to learning items |
| Extract Priority Inheritance | ✅ Implemented | Extracts inherit parent document priority (SuperMemo-style IR chain) |
| Extract Lifecycle (Forget/Dismiss/Done) | ✅ Implemented | Graduate or retire extracts without deleting |
| Priority System | ✅ Implemented | 0-100 priority scoring for items |
| Tags & Categories | ✅ Implemented | Hierarchical organization system |

---

## Review System

| Feature | Status | Description |
|---------|--------|-------------|
| Review Queue | ✅ Implemented | Daily due cards with filtering |
| Preview Intervals | ✅ Implemented | See next review date before rating |
| Long-Form Duration Safety Cap | ✅ Implemented | Coverage-aware interval caps for long videos/articles on Good/Easy ratings |
| Keyboard Shortcuts | ✅ Implemented | Space to reveal, 1-4 to rate |
| Session Statistics | ✅ Implemented | Track cards reviewed, time spent |
| Session Limits | ✅ Implemented | Time and card count limits |
| Mixed Reviews | ✅ Implemented | Cards + documents in same session |
| Recovery Actions | ✅ Implemented | Compress, reschedule, downgrade items |
| Review Feedback | ✅ Implemented | Celebration animations for milestones |
| Break Timer | ✅ Implemented | Scheduled break reminders during long sessions |
| Source Context on Cards | ✅ Implemented | Collapsible "From: <doc>" provenance on review cards |
| Audio Review Mode | ✅ Implemented | Hands-free TTS read-aloud review (auto-flip + auto-advance) |
| Zen Review Mode | ✅ Implemented | Distraction-free full-screen review with context peek |
| FSRS Inspector | ✅ Implemented | Inspect per-card stability/difficulty during review |
| Queue Load Management | ✅ Implemented | Easy Days, Load Balancing, and Advance (FSRS Helper equivalents) |

---

## Analytics & Progress

| Feature | Status | Description |
|---------|--------|-------------|
| Dashboard Stats | ✅ Implemented | Cards due, total learned, retention rate |
| Activity Chart | ✅ Implemented | Visual review history |
| Study Streaks | ✅ Implemented | Consecutive days tracking |
| FSRS Metrics | ✅ Implemented | Stability and difficulty tracking |
| Category Breakdown | ✅ Implemented | Performance by subject area |
| Memory Statistics | ✅ Implemented | Mature, young, new card breakdown |
| Goals & Targets | ✅ Implemented | Daily/weekly study goals |
| Export Statistics | ✅ Implemented | CSV, JSON, PDF export options |
| Knowledge Graph | ✅ Implemented | 2D/3D visualization of knowledge connections |
| Review Heatmap | ✅ Implemented | GitHub-style 12-month contribution graph |
| Workload Forecast | ✅ Implemented | 30/60/90-day due workload projection |
| Forecast Simulator | ✅ Implemented | What-if: project review load under a new-cards/day rate |
| Forgetting Curve | ✅ Implemented | FSRS forgetting-curve visualization |
| Schedule Visualization | ✅ Implemented | Calendar view of upcoming reviews |

---

## Themes & Customization

| Feature | Status | Description |
|---------|--------|-------------|
| 170+ Built-in Themes | ✅ Implemented | 51 builtin + 121 legacy themes, including liquid-glass with native vibrancy |
| Custom Theme Creator | ✅ Implemented | Build your own color schemes |
| Theme Import/Export | ✅ Implemented | Share themes with others |
| Live Theme Preview | ✅ Implemented | See changes instantly |
| Accent Color Customization | ✅ Implemented | Customize primary colors |
| Dense Mode | ✅ Implemented | Compact UI option |
| Font Size Controls | ✅ Implemented | Adjustable text sizing |
| Bundled Fonts | ✅ Implemented | 65 @fontsource font packages |
| i18n (6 locales) | ✅ Implemented | English, 中文, Español, Deutsch, Français, 日本語 |

---

## Import & Export

| Feature | Status | Description |
|---------|--------|-------------|
| CSV Export | ✅ Implemented | Spreadsheet-compatible export |
| JSON Export | ✅ Implemented | Full data export |
| Anki Export (.apkg) | ✅ Implemented | Export to Anki package format |
| Markdown Export | ✅ Implemented | Export cards as Markdown |
| Collection Archive | ✅ Implemented | Full collection backup archive |
| Backup & Restore | ✅ Implemented | Full database backup |
| Auto-Backup | ✅ Implemented | Scheduled automatic backups (Daily/Weekly/Monthly/Interval) |
| Kindle Clippings Import | ✅ Implemented | Import highlights from Kindle |
| Anna's Archive / LibGen Search | ✅ Implemented | Search and import from book sources |

---

## Integrations

| Feature | Status | Description |
|---------|--------|-------------|
| YouTube Import | ✅ Implemented | Video import with transcript extraction |
| YouTube Playlists | ✅ Implemented | Full playlist import and management |
| RSS Reader | ✅ Implemented | Subscribe to and learn from feeds (folders, classifiers, river-of-news) |
| Podcast Support | ✅ Implemented | Podcast search, subscription, and transcript learning |
| Substack Import | ✅ Implemented | Direct Substack article import |
| Twitter/X Import | ✅ Implemented | Thread unrolling and import |
| Audiobook Import | ✅ Implemented | MP3/M4A/M4B/FLAC/OGG with chapter support |
| Local Video | ✅ Implemented | MP4/WebM/MOV/MKV with transcript sync |
| Browser Extension | ✅ Implemented | Chrome/Firefox extension for web capture |
| Cloud Sync (Dropbox) | ✅ Implemented | Dropbox synchronization |
| Cloud Sync (Google Drive) | ✅ Implemented | Google Drive synchronization |
| Cloud Sync (OneDrive) | ✅ Implemented | OneDrive synchronization |
| Cross-Device Sync (Yjs) | ✅ Implemented | Real-time sync via WebSocket relay with QR pairing |
| Obsidian Integration | ✅ Implemented | Bidirectional Obsidian sync |
| NotebookLM Integration | ✅ Implemented | Chat, artifacts, flashcard preview, sync-to-learning |
| AnkiConnect | 🚧 Planned | Real-time Anki synchronization |

---

## OCR & AI Features

| Feature | Status | Description |
|---------|--------|-------------|
| Google Cloud Vision | ✅ Implemented | OCR via Google Cloud |
| AWS Textract | ✅ Implemented | OCR via AWS |
| Mistral OCR | ✅ Implemented | OCR via Mistral AI |
| Tesseract (Local) | ✅ Implemented | On-device OCR |
| Mathpix (Math OCR) | ✅ Implemented | Equation and formula recognition |
| GPT-4o Vision | ✅ Implemented | OpenAI vision model OCR |
| Claude Vision | ✅ Implemented | Anthropic vision model OCR |
| GLM OCR | ✅ Implemented | GLM vision model OCR |
| AI Card Generation | ✅ Implemented | LLM-powered card creation |
| Content Summarization | ✅ Implemented | AI document summaries |
| AI Assistant (multimodal) | ✅ Implemented | Chat with documents, image support |
| MCP Server Support | ✅ Implemented | Model Context Protocol integration (25 tools) |
| LLM Providers | ✅ Implemented | OpenAI, Anthropic, OpenRouter, Ollama (local) |
| Semantic Search | ✅ Implemented | Embeddings-based search across library |
| Local Transcription | ✅ Implemented | Whisper.cpp + sherpa-onnx on-device |
| Cloud Transcription | ✅ Implemented | Groq + OpenAI transcription |
| TTS | ✅ Implemented | Fal, Groq, Pocket TTS with voice cloning |
| API Key Storage | ✅ Implemented | OS keychain secure storage |

---

## Mobile & PWA

| Feature | Status | Description |
|---------|--------|-------------|
| PWA Support | ✅ Implemented | Installable web app |
| Mobile Responsive | ✅ Implemented | Works on all screen sizes |
| Touch Gestures | ✅ Implemented | Swipe-to-rate with haptic feedback |
| Bottom Navigation | ✅ Implemented | Mobile-optimized nav bar |
| Mobile EPUB Reader | ✅ Implemented | Touch-optimized EPUB viewing |
| Offline Mode | ✅ Implemented | Local-first SQLite; full offline functionality |
| Mobile Scaffolding | 🚧 Partial | Android/iOS Tauri configs initialized; not yet shipped |

---

## Advanced Features

| Feature | Status | Description |
|---------|--------|-------------|
| Command Palette | ✅ Implemented | Quick command access (Ctrl+K) |
| Keyboard Shortcuts | ✅ Implemented | Full keyboard navigation, customizable with conflict detection |
| Vim Reading Mode | ✅ Implemented | Full vim keybinds in reading/review (h/l/j/k/w/b/e/gg/G/v/V/aw/iw…) |
| Virtual Scrolling | ✅ Implemented | Performance for 10,000+ cards |
| Search & Filtering | ✅ Implemented | Advanced search with operators |
| Full-Text Search (FTS5) | ✅ Implemented | SQLite FTS5 over documents + extracts with snippets |
| Semantic Search | ✅ Implemented | Embeddings-based relevance ranking |
| Saved Searches | ✅ Implemented | Bookmark common searches |
| Smart Collections | ✅ Implemented | Auto-filtered collections |
| Collections | ✅ Implemented | Multi-collection support with switcher |
| Study Decks | ✅ Implemented | Tag-based deck grouping with scoped review |
| Reading Goals | ✅ Implemented | Daily/weekly targets (minutes, pages) |
| Achievement System | ✅ Implemented | Streaks, milestones, and goal achievements |
| Pomodoro / Focus Timer | ✅ Implemented | Focus timer for study sessions |
| TAS Scheduling | ✅ Implemented | Topic-Adaptive Scheduling with circular queues |
| Knowledge Sphere (3D) | ✅ Implemented | Three.js 3D knowledge graph |

---

## Browser Extension

| Feature | Status | Description |
|---------|--------|-------------|
| Web Page Capture | ✅ Implemented | Save any webpage to Incrementum |
| Text Selection Import | ✅ Implemented | Import selected text as extract |
| Sync with Desktop | ✅ Implemented | Bidirectional sync |
| Quick Add | ✅ Implemented | One-click content addition |
| Highlighting | ✅ Implemented | Web page highlighting |
| Cloud Sync | ✅ Implemented | readsync.org relay with QR device pairing |
| Offline Queue | ✅ Implemented | Queue items when offline, sync on reconnect |
| Automation REST API | ✅ Implemented | HTTP API for programmatic card creation and review |

---

## Performance

| Feature | Status | Description |
|---------|--------|-------------|
| <500ms Startup | ✅ Implemented | Fast cold start |
| <100ms Queue Loading | ✅ Implemented | 10,000+ cards handled smoothly |
| <50ms Review Submit | ✅ Implemented | Instant rating response |
| <20ms FSRS Calculation | ✅ Implemented | Fast interval prediction |
| Virtual Lists | ✅ Implemented | Render only visible items |
| Skeleton Screens | ✅ Implemented | Loading state placeholders |

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ Implemented | Feature is complete and available |
| 🚧 Partial | Feature works but has limitations |
| 🚧 Planned | Feature is on the roadmap |
| ❌ Not Started | Feature not yet implemented |

---

*Last updated: June 2026 (v1.54.0)*
