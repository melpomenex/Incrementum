## 1. Integration Foundation

- [x] 1.1 Add a NotebookLM feature flag and configuration entries for enabling/disabling integration surfaces.
- [x] 1.2 Introduce a backend `NotebookLMProvider` adapter interface and `notebooklm-py` implementation scaffold.
- [x] 1.3 Add secure local storage handling for NotebookLM auth/session state and validate load/save behavior.

## 2. Account, Notebook, and Source Workflows

- [x] 2.1 Implement connect/disconnect/session-health commands for NotebookLM account state.
- [x] 2.2 Implement notebook actions (list/create/select) and wire selected notebook context persistence.
- [x] 2.3 Implement source actions (add URL/file/YouTube/text, list status, refresh) with normalized response models.
- [x] 2.4 Add chat and research command handlers that run against the active notebook and return source-referenced responses.

## 3. Artifact Generation Jobs

- [x] 3.1 Implement generation command handlers for flashcards, quizzes, reports, audio/video overviews, mind maps, and data tables.
- [x] 3.2 Build job orchestration with persisted states (`queued`, `running`, `succeeded`, `failed`, `expired-auth`) and polling/retry policy.
- [x] 3.3 Implement artifact retrieval/export paths for required sync formats (flashcards/quiz JSON plus markdown where needed).
- [x] 3.4 Add backend tests for generation lifecycle transitions, retry behavior, and auth-expiry handling.

## 4. Incrementum Sync and Mapping

- [x] 4.1 Define canonical mapping from NotebookLM flashcards into Incrementum cards (front/back, tags, source attribution).
- [x] 4.2 Implement quiz-import modes including "missed items only" and map outputs into card creation/update operations.
- [x] 4.3 Add dedupe/merge logic and sync result reporting (created, updated, skipped) for imported content.
- [x] 4.4 Integrate imported cards into existing incremental scheduling initialization rules.

## 5. User Experience and Workflow Ideas

- [x] 5.1 Add NotebookLM panel UI for connection state, notebook/source management, and chat/research interactions.
- [x] 5.2 Add generation UI with job progress, terminal states, and recovery affordances for expired auth.
- [x] 5.3 Implement curated quick actions: research->study guide->deck, flashcards->deck, quiz missed items->cards, media->study item, mind map/table->notes.
- [x] 5.4 Add preview-before-import UI so users can review/edit mapped cards before final sync.

## 6. Rollout, Observability, and Documentation

- [x] 6.1 Add telemetry/logging for NotebookLM operation outcomes, latency buckets, and top failure categories.
- [x] 6.2 Add end-to-end integration tests for at least one full workflow from source ingestion to deck sync.
- [x] 6.3 Write operator/developer docs for setup, auth recovery, feature-flag rollout, and known `notebooklm-py` instability constraints.
