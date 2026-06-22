<div align="center">

# Incrementum

**Incremental Reading + Spaced Repetition = Knowledge Retention**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)]()
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)]()
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-informational)]()
[![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131?logo=tauri)]()
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)]()
[![Try Flashcard Studio Online](https://img.shields.io/badge/Flashcard_Studio-Try_Online-FF6B6B)](https://socialistic.ai/en/skill/incrementum-reading-srs-6b9e85?utm_source=github&utm_medium=readme&utm_campaign=20260618-intl-exam-flashcard-builders&utm_content=badge)

[Features](#-features) • [Demo](https://readsync.org) • [Try Flashcard Studio Online](https://socialistic.ai/en/skill/incrementum-reading-srs-6b9e85?utm_source=github&utm_medium=readme&utm_campaign=20260618-intl-exam-flashcard-builders&utm_content=nav_link) • [Installation](#-installation) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Contributing](#-contributing)

</div>

---

## Overview

**Incrementum** is a sophisticated desktop application that combines **incremental reading** with **spaced repetition** to help you efficiently process and retain information from large volumes of content.

Built with modern technologies—Tauri, React, and Rust—it offers a beautiful, fast, and cross-platform learning environment that adapts to your needs.

### Core Philosophy

| Principle | Description |
|-----------|-------------|
| **Incremental Reading** | Process large documents in small, manageable chunks over time |
| **Spaced Repetition** | Review content at scientifically-optimized intervals using FSRS-6, SM-18, SM-20, or SM-2 |
| **Import Flexibility** | Bring content from anywhere—PDFs, EPUBs, audiobooks, videos, websites, podcasts, Anki decks |
| **Smart Scheduling** | Know exactly when you'll review each card again with preview intervals |
| **Rich Analytics** | Track your progress, streaks, and performance metrics |

---

## ✨ Features

### 📚 Document Management

- Import and read PDF, EPUB, Markdown, HTML, and TXT content
- Import audiobooks and audio files (MP3, M4A, M4B, AAC, FLAC, OGG, OPUS, WAV, WMA)
- Import video files (MP4, WebM, MOV, MKV, AVI, M4V) with local playback
- Import from URLs, Arxiv papers, YouTube videos/playlists, RSS feeds, and Substack
- Capture screenshots and run OCR extraction
- Auto-transcribe audio/video content with local Whisper or cloud providers (OpenAI, Groq)
- Create highlights/extracts, organize by tags/categories, and resume reading positions
- Migrate study data from Anki (`.apkg`) and SuperMemo (ZIP exports)

---

### 🧠 Learning & Review

- Multiple scheduling algorithms: FSRS-6, SM-18, SM-20, SM-2
- Card types: Basic, Cloze, Q&A, Multiple Choice, and Image Occlusion (via Flashcard Studio)
- Review queue with filtering/sorting, keyboard-first rating flow, and session stats
- Preview intervals (including long-form duration-aware safety caps)
- Focus timer (Pomodoro-style) integrated into study workflows

---

### 📊 Analytics & Insights

- Dashboard stats (due cards, retention, progress)
- 30-day activity views, streak tracking, and goal progress
- FSRS metrics (stability/difficulty) and category-level breakdowns
- Knowledge Graph with interactive 2D/3D exploration

---

### 🎨 User Experience

- 146 built-in themes, 65 bundled fonts, plus custom theme creation/import/export
- Command palette (`Ctrl+K` / `Cmd+K`) and full keyboard navigation
- Vim-style navigation support in reading/review contexts
- Mobile-responsive UI with PWA support
- Virtualized lists and optimized document/review rendering for large libraries

---

### 🔧 Advanced Features

- AI-assisted workflows: flashcard generation, summaries, Q&A helpers
- AI assistant with multimodal image support (paste, drag & drop, or attach images)
- Flashcard Studio with AI-powered card creation (Basic, Cloze, Q&A, Multiple Choice, Image Occlusion) — [try it online without installing](https://socialistic.ai/en/skill/incrementum-reading-srs-6b9e85?utm_source=github&utm_medium=readme&utm_campaign=20260618-intl-exam-flashcard-builders&utm_content=feature_link)
- OCR pipeline with local and cloud providers (including math OCR options)
- Text-to-Speech (TTS) for reading documents and review cards aloud
- Audio/video transcription with local Whisper.cpp or cloud providers (OpenAI, Groq)
- NotebookLM workspace for research/chat/artifact generation and sync-to-learning flows
- Browser extension bridge for web capture ([Install Firefox Extension](https://github.com/melpomenex/incrementum-tauri/releases/latest/download/incrementum-browser-sync-1.6.0.xpi))
- Obsidian integration (export and sync workflows)
- Backup/restore tools (local and cloud-backed), plus import/export utilities

---

## 🚀 Installation

### Prerequisites

- **Node.js** 18+ and npm
- **Rust** toolchain (1.70+)
- **System dependencies** for your platform

#### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    file \
    libxdo-dev \
    libssl-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
```

#### macOS

```bash
xcode-select --install
```

#### macOS Security: Opening Self-Signed Applications

When you first run Incrementum on macOS, you may encounter a security warning since the application is self-signed. This is normal for unsigned apps. Here's how to proceed:

**Method 1: Open via Finder (Recommended)**

1. In Finder, locate the `Incrementum.app`
2. Right-click (or Control-click) the app → Open
3. A security warning dialog will appear
4. Click "Open" again to confirm

The right-click → Open path adds a security exception for that application.

**Method 2: Allow via System Settings**

1. Try to open the app normally (double-click). It will fail with a security warning
2. Open System Settings → Privacy & Security
3. Scroll down to the security section
4. Look for a message saying "Incrementum was blocked from use because it is not from an identified developer"
5. Click "Open Anyway" and confirm with "Open" in the dialog

After following either method, macOS will remember your choice, and you can open the app normally in the future.

#### Windows

No additional dependencies required.

### Build from Source

```bash
# Clone the repository (includes whisper.cpp submodule)
git clone --recurse-submodules https://github.com/melpomenex/incrementum-tauri.git
cd incrementum-tauri

# If you already cloned without submodules
git submodule update --init --recursive

# Install dependencies
npm install

# Run development server
npm run tauri:dev

# Build for production
npm run tauri:build
```

The production bundle will be in `src-tauri/target/release/bundle/`.

### Download Pre-built Binaries

Visit the [Releases](https://github.com/melpomenex/incrementum-tauri/releases) page to download pre-built binaries for your platform.

---

## 🎯 Quick Start

### Step 1: Import Your First Document

```
Documents → Import Document → Choose source
```

| Source | Description |
|--------|-------------|
| 📁 **Local Files** | Select PDF, EPUB, or text files from your computer |
| 🎧 **Audiobook / Audio** | Import audiobooks or audio files (MP3, M4A, M4B, FLAC, etc.) with auto-transcription |
| 🎬 **Video** | Import video files (MP4, WebM, MOV, MKV, etc.) with local playback and transcription |
| 🌐 **URL** | Enter any web URL to fetch and process content |
| 📺 **YouTube** | Import YouTube videos or playlists |
| 📄 **Arxiv** | Paste Arxiv ID or URL for research papers |
| 📸 **Screenshot** | Capture your screen directly |
| 🃏 **Anki** | Import .apkg files from Anki |
| 📦 **SuperMemo** | Import ZIP exports from SuperMemo |

---

### Step 2: Process Content

Once a document is loaded, select text to create **extracts** — the building blocks for learning items.

- **Create extracts**: Select text while reading, or use **Segmentation** (smart, paragraph, semantic, or fixed) to batch-split a document into extracts
- **Review & organize**: Edit, categorize, and tag extracts in the **Extracts** tab
- **Convert to flashcards**:
  - Click **Create Card** on an individual extract → opens Flashcard Studio with the extract as seed content
  - Select multiple extracts → **Bulk Generate** AI-powered flashcards from them
- Optionally enable **Auto-Extract on Load** in OCR settings to automatically run extraction when opening documents

---

### Step 3: Start Reviewing

```
Review → See due cards → Rate your recall (1-4)
```

**Rating Scale**

| Rating | Label | Description | Next Review |
|--------|-------|-------------|-------------|
| 1 | 🔴 Again | Forgot completely | ~10 minutes |
| 2 | 🟡 Hard | Remembered with difficulty | ~1-2 days |
| 3 | 🟢 Good | Remembered easily | ~5-7 days |
| 4 | 🔵 Easy | Too easy | ~10-14 days |

> **Preview Intervals**: See exactly when each card will appear next before you rate!

---

### Step 4: Track Progress

```
Analytics → View stats, charts, and streaks
```

---

## 📖 Documentation

### User Documentation

| Document | Description |
|----------|-------------|
| [Feature Overview](docs/FEATURES_IMPLEMENTED.md) | Complete feature list and implementation status |
| [Installation Guide](docs/INSTALL.md) | Detailed setup instructions |
| [OCR Features](docs/OCR_FEATURES.md) | Text extraction from images |

### Developer Documentation

| Document | Description |
|----------|-------------|
| [Project Summary](docs/PROJECT_SUMMARY.md) | Architecture and technical details |
| [Implementation Status](docs/IMPLEMENTATION_STATUS.md) | Current progress and roadmap |
| [OpenSpec Workflow](openspec/AGENTS.md) | Contribution guide and proposal process |

---

## 🛠️ Development

### Project Structure

```
incrementum-tauri/
├── src/                    # Frontend (React + TypeScript)
│   ├── components/         # UI components
│   ├── pages/             # Page components
│   ├── stores/            # Zustand state management
│   ├── api/               # Tauri command wrappers
│   ├── themes/            # Theme definitions
│   └── utils/             # Utility functions
├── src-tauri/             # Backend (Rust)
│   ├── src/
│   │   ├── commands/      # Tauri command handlers
│   │   ├── models/        # Data models
│   │   ├── database/      # SQLite database layer
│   │   ├── algorithms/    # FSRS, SM-2, SM-18, SM-20 implementations
│   │   ├── processor/     # Document processors
│   │   └── integrations/  # External integrations
│   └── Cargo.toml         # Rust dependencies
└── package.json           # Node.js dependencies
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run tauri:dev` | Start development server |
| `npm run dev` | Web-only development server |
| `npm run tauri:build` | Build production application |
| `npm run build` | Build web frontend only |
| `npm run test` | Run test suite |
| `npm run test:ui` | Launch test UI |
| `npm run test:coverage` | Generate coverage report |
| `npm run tauri:build:linux` | Build for Linux |
| `npm run tauri:build:macos` | Build for macOS |
| `npm run tauri:build:windows` | Build for Windows |
| `npm run tauri:android:init` | Initialize Android project scaffolding |
| `npm run tauri:android:build` | Build Android ARM64 APK |
| `npm run tauri:android:dev` | Run Android dev build on ARM64 |
| `npm run tauri:ios:init` | Initialize iOS project scaffolding (macOS) |
| `npm run tauri:ios:build:sim` | Build iOS simulator app (Apple Silicon) |
| `npm run tauri:ios:dev:sim` | Run iOS simulator dev build (Apple Silicon) |

Mobile note: desktop sidecar binaries (like `whisper`) are disabled on Android/iOS builds via `src-tauri/tauri.android.conf.json` and `src-tauri/tauri.ios.conf.json`.

---

### Tech Stack

<details>
<summary><b>Frontend</b></summary>

- **Framework**: React 19 with TypeScript
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **Icons**: Lucide React

</details>

<details>
<summary><b>Backend</b></summary>

- **Framework**: Tauri 2.0
- **Language**: Rust
- **Database**: SQLite with SQLx
- **Algorithm**: FSRS-6, SM-18, SM-20, SM-2 (spaced repetition)
- **Runtime**: Tokio (async)

</details>

<details>
<summary><b>Key Libraries</b></summary>

- **React Query**: Data fetching and caching
- **React Router**: Client-side routing
- **Recharts**: Analytics visualizations
- **EPUB.js**: EPUB parsing
- **PDF.js**: PDF rendering
- **Three.js**: 3D visualizations
- **Whisper.cpp**: Local audio/video transcription

</details>

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

```mermaid
graph LR
    A[Check OpenSpec Proposals] --> B[Create Issue/Proposal]
    B --> C[Fork Repository]
    C --> D[Create Feature Branch]
    D --> E[Make Changes]
    E --> F[Write Tests]
    F --> G[Submit Pull Request]
```

1. **Check** [OpenSpec proposals](openspec/changes/) for planned features
2. **Create** an issue or proposal for new features
3. **Fork** the repository
4. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
5. **Make** your changes
6. **Write** tests if applicable
7. **Submit** a pull request

### Code Style Guidelines

| Language | Tool | Guidelines |
|----------|------|------------|
| **Rust** | `cargo fmt` | Follow Rust naming conventions |
| **TypeScript** | Prettier | Functional components, proper typing |
| **General** | - | Self-documenting code, comment complex logic |

---

## 📊 Performance Benchmarks

| Operation | Time | Notes |
|-----------|------|-------|
| **Startup** | <500ms | Cold start |
| **Queue Loading** | <100ms | 10,000+ cards |
| **Review Submission** | <50ms | Database write |
| **Preview Intervals** | <20ms | FSRS calculation |
| **Analytics Dashboard** | <200ms | All charts loaded |
| **Document Import** | <2s* | Varies by file size |

*Average PDF/EPUB, processing time included

---

## 📝 License

Apache 2.0 License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

| Project | Contribution |
|---------|--------------|
| **[FSRS](https://github.com/open-spaced-repetition/fsrs4anki)** | Excellent spaced repetition algorithm |
| **[Tauri](https://tauri.app/)** | Amazing desktop framework |
| **[Open Spaced Repetition](https://github.com/open-spaced-repetition)** | Research and insights |

---

<div align="center">

### **Built with ❤️ using Tauri + React + Rust**

[![Website](https://img.shields.io/badge/Website-readsync.org-blue)](https://readsync.org)
[![Documentation](https://img.shields.io/badge-Docs-latest-brightgreen)](docs/)
[![Issues](https://img.shields.io/badge/Issues-Get%20Help-orange)](https://github.com/melpomenex/incrementum-tauri/issues)
[![Changelog](https://img.shields.io/badge/Changelog-Release%20Notes-purple)](CHANGELOG.md)

**[⬆ Back to Top](#incrementum)**

</div>
