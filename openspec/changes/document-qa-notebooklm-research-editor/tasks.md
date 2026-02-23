## 1. Foundation and Data Model

- [x] 1.1 Add feature flag/config plumbing for NotebookLM mode in Document Q&A.
- [x] 1.2 Create research session schema/storage for prompts, responses, draft content, and timestamps.
- [x] 1.3 Add provenance metadata model linking artifacts to document ID, research session ID, and selected text range.
- [x] 1.4 Add repository/service interfaces for loading and saving research sessions and drafts.

## 2. NotebookLM Orchestration Backend

- [x] 2.1 Implement NotebookLM adapter interface and concrete request/response mapping.
- [x] 2.2 Implement orchestration endpoint for research requests with input validation.
- [x] 2.3 Add throttling, timeout, retry, and structured error handling for NotebookLM calls.
- [x] 2.4 Persist successful NotebookLM prompt/response events into research session history.

## 3. Document Q&A UI Integration

- [x] 3.1 Add NotebookLM toggle UI and session state wiring in the Document Q&A tab.
- [x] 3.2 Implement research panel interactions for submitting prompts and rendering provenance-aware responses.
- [x] 3.3 Add brainstorming helper chips/templates (summarize, compare, timeline, key concepts, counterpoints).
- [x] 3.4 Implement loading, empty, and failure states for NotebookLM research interactions.

## 4. Inline Editor and Selection Actions

- [x] 4.1 Add inline research editor surface with editable draft content and controlled formatting scope.
- [x] 4.2 Implement selection range tracking and context actions for cloze and Q&A generation.
- [x] 4.3 Add autosave and draft recovery behavior for inline edits.
- [x] 4.4 Validate selection boundaries and block invalid generation actions with user-facing feedback.

## 5. Study Artifact Generation Flow

- [x] 5.1 Implement cloze draft generation from selected text with preview-before-save.
- [x] 5.2 Implement Q&A draft generation from selected text with editable question/answer fields.
- [x] 5.3 Integrate artifact commit path into existing card pipeline with provenance metadata persisted.
- [x] 5.4 Add idempotency and duplicate-creation safeguards for repeated generation actions.

## 6. Quality, Telemetry, and Rollout

- [x] 6.1 Add unit tests for toggle behavior, orchestration validation, and selection-to-artifact conversion.
- [x] 6.2 Add integration tests covering research session persistence, autosave recovery, and artifact save flows.
- [x] 6.3 Add analytics/telemetry events for toggle usage, research requests, generation actions, and error categories.
- [x] 6.4 Document rollout/rollback runbook and release behind staged feature-flag rollout.
