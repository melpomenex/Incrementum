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
| FSRS-5 Algorithm | ✅ Implemented | State-of-the-art spaced repetition scheduler |
| SM-2 Algorithm | ✅ Implemented | Classic SuperMemo 2 algorithm option |
| Flashcard Creation | ✅ Implemented | Basic front/back cards |
| Cloze Deletion | ✅ Implemented | Fill-in-the-blank style cards |
| Q&A Cards | ✅ Implemented | Question and answer format |
| Image Occlusion | 🚧 Partial | Hide parts of images (diagrams, charts) |
| AI Card Generation | ✅ Implemented | LLM-powered flashcard creation |
| Auto-Summarization | ✅ Implemented | AI-generated document summaries |
| Extract to Card | ✅ Implemented | Convert extracts directly to learning items |
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
| Break Timer | 🚧 Planned | Scheduled breaks during long sessions |

---

## Analytics & Progress

| Feature | Status | Description |
|---------|--------|-------------|
| Dashboard Stats | ✅ Implemented | Cards due, total learned, retention rate |
| 30-Day Activity Chart | ✅ Implemented | Visual review history |
| Study Streaks | ✅ Implemented | Consecutive days tracking |
| FSRS Metrics | ✅ Implemented | Stability and difficulty tracking |
| Category Breakdown | ✅ Implemented | Performance by subject area |
| Memory Statistics | ✅ Implemented | Mature, young, new card breakdown |
| Goals & Targets | ✅ Implemented | Daily/weekly study goals |
| Export Statistics | ✅ Implemented | CSV, JSON, PDF export options |
| Knowledge Graph | ✅ Implemented | 2D/3D visualization of knowledge connections |
| Heatmaps | 🚧 Planned | GitHub-style contribution graphs |

---

## Themes & Customization

| Feature | Status | Description |
|---------|--------|-------------|
| 17 Built-in Themes | ✅ Implemented | 6 dark, 11 light themes |
| Custom Theme Creator | ✅ Implemented | Build your own color schemes |
| Theme Import/Export | ✅ Implemented | Share themes with others |
| Live Theme Preview | ✅ Implemented | See changes instantly |
| Accent Color Customization | ✅ Implemented | Customize primary colors |
| Dense Mode | ✅ Implemented | Compact UI option |
| Font Size Controls | ✅ Implemented | Adjustable text sizing |

---

## Import & Export

| Feature | Status | Description |
|---------|--------|-------------|
| CSV Export | ✅ Implemented | Spreadsheet-compatible export |
| JSON Export | ✅ Implemented | Full data export |
| Anki Export | 🚧 Planned | Export to Anki format |
| Markdown Export | ✅ Implemented | Export cards as Markdown |
| Backup & Restore | ✅ Implemented | Full database backup |
| Auto-Backup | ✅ Implemented | Scheduled automatic backups |

---

## Integrations

| Feature | Status | Description |
|---------|--------|-------------|
| YouTube Import | ✅ Implemented | Video import with transcript extraction |
| RSS Reader | ✅ Implemented | Subscribe to and learn from feeds |
| Browser Extension | ✅ Implemented | Chrome/Firefox extension for web capture |
| Cloud Sync (Dropbox) | 🚧 Planned | Dropbox synchronization |
| Cloud Sync (Google Drive) | 🚧 Planned | Google Drive synchronization |
| Cloud Sync (OneDrive) | 🚧 Planned | OneDrive synchronization |
| Obsidian Integration | 🚧 Planned | Bidirectional Obsidian sync |
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
| AI Card Generation | ✅ Implemented | LLM-powered card creation |
| Content Summarization | ✅ Implemented | AI document summaries |
| MCP Server Support | ✅ Implemented | Model Context Protocol integration |

---

## Mobile & PWA

| Feature | Status | Description |
|---------|--------|-------------|
| PWA Support | ✅ Implemented | Installable web app |
| Mobile Responsive | ✅ Implemented | Works on all screen sizes |
| Touch Gestures | 🚧 Planned | Swipe navigation |
| Bottom Navigation | ✅ Implemented | Mobile-optimized nav bar |
| Mobile EPUB Reader | ✅ Implemented | Touch-optimized EPUB viewing |
| Offline Mode | 🚧 Planned | Full offline functionality |

---

## Advanced Features

| Feature | Status | Description |
|---------|--------|-------------|
| Command Palette | ✅ Implemented | Quick command access (Ctrl+K) |
| Keyboard Shortcuts | ✅ Implemented | Full keyboard navigation |
| Virtual Scrolling | ✅ Implemented | Performance for 10,000+ cards |
| Search & Filtering | ✅ Implemented | Advanced search with operators |
| Saved Searches | ✅ Implemented | Bookmark common searches |
| Smart Collections | 🚧 Planned | Auto-filtered collections |
| Reading Goals | ✅ Implemented | Daily/weekly targets |
| Achievement System | 🚧 Planned | Gamification elements |

---

## Browser Extension

| Feature | Status | Description |
|---------|--------|-------------|
| Web Page Capture | ✅ Implemented | Save any webpage to Incrementum |
| Text Selection Import | ✅ Implemented | Import selected text as extract |
| Sync with Desktop | ✅ Implemented | Bidirectional sync |
| Quick Add | ✅ Implemented | One-click content addition |
| Highlighting | ✅ Implemented | Web page highlighting |
| Cloud Sync | 🚧 Planned | readsync.org cloud integration |
| Offline Queue | 🚧 Planned | Queue items when offline |

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

*Last updated: January 2026*
