# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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

[Unreleased]: https://github.com/melpomenex/incrementum-tauri/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/melpomenex/incrementum-tauri/releases/tag/v1.0.0
