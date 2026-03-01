# Change: Add next-gen SRS platform capabilities

## Why
Incrementum already has FSRS-based scheduling and strong document workflows, but it lacks several high-impact SRS capabilities users expect for serious exam prep, language learning, and long-term knowledge maintenance. This change proposes a coordinated expansion across scheduling, card interaction models, AI assistance, integrations, sync, analytics, and extensibility.

## What Changes
- Add advanced FSRS controls and simulations:
  - Personal FSRS optimizer for 17-weight personalization.
  - Desired retention target slider that dynamically adjusts intervals.
  - Per-deck/per-tag FSRS parameter sets.
  - 30/60/90-day due workload forecasting.
  - Single-step undo for last review rating.
  - Cram/custom filtered sessions that do not alter long-term scheduling.
- Add richer card interaction types:
  - Typed-answer grading (exact/fuzzy/AI semantic).
  - Progressive hint reveals.
  - Audio prompt/answer cards with TTS playback.
  - Ordering and matching interaction cards.
  - Stylus/handwriting answer canvas.
  - Sibling burying during a review session.
- Add AI intelligence workflows (local + cloud model support):
  - Semantic duplicate detection before card save.
  - Card quality scoring using minimum-information heuristics.
  - Leech detection dashboard with action suggestions.
  - One-keystroke jump to source passage during review.
  - Conversational review mode with tutor-style probing.
  - Auto-tagging recommendations at import.
- Add import/integration expansion:
  - Local podcast/audio file import with Whisper transcription.
  - Extraction of existing PDF highlights on import.
  - System clipboard quick-capture workflow.
  - Inline dictionary/thesaurus lookup with card creation.
  - Zotero/Mendeley metadata import.
  - Bidirectional Logseq integration.
- Add social/collaboration features:
  - Community deck marketplace.
  - Collaborative study groups with aggregate performance.
  - Optional public profile and study stats sharing.
- Add sync/data portability features:
  - Local network/P2P sync mode.
  - Card version history and revert support.
  - Mnemosyne export support.
  - Printable paper flashcard PDF output.
- Add analytics and productivity features:
  - Heatmap with retention overlay.
  - Forgetting-curve visualizer (card and aggregate).
  - Energy-level correlation tracking.
  - Reading speed and ETA forecasting.
- Add extensibility and platform controls:
  - Plugin/extension API system.
  - Focus/Zen review mode.
  - Multi-language UI/i18n.
  - Card prerequisite chains.
  - Daily note/Zettelkasten integration.
  - Webhook/REST API for external automation.

## Reconciliation With Existing Active Changes
- Reuses and extends `add-review-home-decks` for deck/tag scoping semantics used by per-deck FSRS and forecasting.
- Reuses auth/sync direction from `add-user-profile-and-auth` and `add-auth-ui`; collaboration/public features are gated by authenticated identity.
- Reuses transcript and media groundwork from `add-auto-transcribe-local-videos`, `add-local-transcription`, and `fix-review-flashcard-video-transcript-context` for audio workflows.
- Reuses queue/session continuity direction from `add-web-reading-collections` and `preserve-tab-state-on-switch` for undo and cram session UX continuity.
- Reuses import/pathways from existing web/article/video import changes where applicable, adding new source adapters rather than replacing existing ingestion paths.

## Impact
- Affected specs:
  - `fsrs-scheduling-optimization`
  - `advanced-card-types`
  - `ai-study-assist`
  - `content-ingestion-integrations`
  - `collaboration-sharing`
  - `sync-portability-governance`
  - `learning-analytics`
  - `platform-extensibility`
- Affected systems:
  - Tauri commands and scheduler services (`src-tauri`)
  - Review UI state/store and queue flows (`src/components`, `src/store`)
  - Import pipeline and adapters (`src-tauri`, `src/api`, `server`)
  - Sync/auth services and APIs (`server`, `src/lib/sync-client.ts`)
  - Analytics persistence and visualization surfaces (`src/components`, storage schema)
