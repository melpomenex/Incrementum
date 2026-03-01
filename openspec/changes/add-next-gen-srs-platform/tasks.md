## 1. MVP (Wave 1): Scheduling Core, Safety, and Foundational Input
Dependencies: Requires active-change reconciliation with `add-review-home-decks`, `add-web-reading-collections`, `preserve-tab-state-on-switch`, and auth/sync foundations.

- [ ] 1.1 Map overlapping active changes and freeze dependency matrix for implementation order.
- [x] 1.2 Add/extend shared schema for scoped FSRS params, review mutation journal, AI provider policy, and analytics baseline fields.
- [x] 1.3 Add feature flags and rollout defaults for each capability family.
- [x] 1.4 Implement desired retention target control and interval policy application.
- [x] 1.5 Implement per-deck/per-tag FSRS parameter resolution order (global -> deck -> tag).
- [x] 1.6 Implement single-step undo for last review with journal-backed rollback.
- [x] 1.7 Implement cram/custom filtered sessions that do not mutate baseline FSRS state.
- [x] 1.8 Implement typed-answer cards with exact and fuzzy grading.
- [x] 1.9 Implement progressive hint stages and hint reveal tracking.
- [x] 1.10 Implement sibling burying rules at session runtime.
- [x] 1.11 Add scheduler correctness tests, undo/cram isolation tests, and typed/hint interaction tests.
- [x] 1.12 Run MVP validation and regression checks.

## 2. Wave 2: Forecasting, Media, and AI-Assisted Study Quality
Dependencies: Starts after Wave 1 schema and journaling are stable.
Parallelizable tracks: 2A Scheduling+Analytics, 2B Card Media Types, 2C AI Assist.

- [x] 2.1 Implement personal FSRS optimizer pipeline using historical review logs and persisted 17-weight outputs.
- [x] 2.2 Implement 30/60/90-day due simulation service and workload visualization API.
- [x] 2.3 Extend heatmap to include retention-rate overlays.
- [x] 2.4 Implement card-level and aggregate forgetting curve visualizations.
- [x] 2.5 Implement audio question/answer cards with TTS read-aloud controls.
- [x] 2.6 Implement ordering and matching card interaction engines.
- [x] 2.7 Implement handwriting/stylus answer canvas with pre-flip capture.
- [x] 2.8 Integrate AI semantic grading for typed answers via dual-provider AI interface.
- [x] 2.9 Implement semantic duplicate detection on card create/edit flows.
- [x] 2.10 Implement card quality analyzer with minimum-information diagnostics.
- [x] 2.11 Implement leech detection thresholds, dashboard, and suggested actions.
- [x] 2.12 Implement contextual source jump from review card to exact source passage.
- [x] 2.13 Add provider-routing tests for local/cloud fallback behavior across AI features shipped in Wave 2.
- [x] 2.14 Run Wave 2 performance checks for simulation and AI-assisted paths.

## 3. Wave 3: Import/Integrations, Sync Portability, and External Interfaces
Dependencies: Requires stable AI provider routing and baseline sync policy behavior.
Parallelizable tracks: 3A Ingestion connectors, 3B Portability/export, 3C API/extensibility foundations.

- [x] 3.1 Implement podcast/audio import adapter using local Whisper transcription.
- [x] 3.2 Implement import-time extraction of existing PDF highlights/annotations.
- [x] 3.3 Implement clipboard watcher quick-add flow for card/extract creation.
- [x] 3.4 Implement inline dictionary/thesaurus lookup and vocabulary-card creation path.
- [x] 3.5 Implement Zotero/Mendeley import connectors with metadata mapping.
- [x] 3.6 Implement bidirectional Logseq synchronization.
- [x] 3.7 Implement local network/P2P sync mode and conflict policy.
- [x] 3.8 Implement card version history and revert UI/API.
- [x] 3.9 Implement Mnemosyne export format support.
- [x] 3.10 Implement printable flashcard PDF generation.
- [x] 3.11 Implement webhook/REST API for external automation.
- [x] 3.12 Implement plugin/extension API lifecycle and permission model.
- [x] 3.13 Add ingestion compatibility tests, sync/export round-trip tests, and API contract tests.

## 4. Wave 4: Collaboration, Personalization Expansion, and Polishing
Dependencies: Requires auth/sync identity and sharing controls from prior waves.
Parallelizable tracks: 4A Social features, 4B Productivity polish, 4C Advanced analytics.

- [x] 4.1 Implement community deck marketplace browse, install, and rating primitives.
- [x] 4.2 Implement collaborative study group sharing and aggregate metrics.
- [x] 4.3 Implement optional public profile and study stats sharing controls.
- [x] 4.4 Implement conversational review mode with follow-up questioning and scoring.
- [x] 4.5 Implement import-time auto-tagging suggestions/applies.
- [x] 4.6 Implement cognitive energy tracking and retention correlation analysis.
- [x] 4.7 Implement reading speed and ETA tracking by document type.
- [x] 4.8 Implement Focus/Zen review mode.
- [x] 4.9 Implement multi-language UI framework and initial locale packs.
- [x] 4.10 Implement card prerequisite chain scheduling constraints.
- [x] 4.11 Implement daily note/Zettelkasten linking workflows.
- [x] 4.12 Add privacy/permission tests for shared surfaces and accessibility checks for new review modes.

## 5. Final Hardening and Proposal Validation
- [x] 5.1 Run full end-to-end targeted capability suites and cross-wave regression checks.
- [x] 5.2 Run cross-platform performance checks for scheduler simulation, AI features, and sync operations.
- [x] 5.3 Run `openspec validate add-next-gen-srs-platform --strict` and resolve all issues.
