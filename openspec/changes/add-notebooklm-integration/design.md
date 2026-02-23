## Context

Incrementum currently supports collecting and scheduling learning content, but it does not provide a direct bridge to NotebookLM's research and artifact-generation workflows. The `notebooklm-py` library offers async APIs and CLI commands for notebooks, sources, chat, research, and artifact generation/download, including flashcards and quizzes export formats that map well to Incrementum study entities.

Constraints:
- `notebooklm-py` is an unofficial API wrapper and may break when upstream endpoints change.
- Many NotebookLM operations are long-running and require polling (`wait_for_completion`/task status patterns).
- Authentication relies on Google session state; sessions can expire and require refresh/re-login flows.

Stakeholders:
- End users who want research-to-review workflows.
- Product/UX owners defining high-value study flows.
- Engineering owners for desktop/web frontend, Tauri/backend commands, and import/scheduling pipeline.

## Goals / Non-Goals

**Goals:**
- Provide in-app NotebookLM connectivity and core notebook/source/chat actions.
- Expose artifact generation flows with progress, completion, and retry behavior.
- Support import/sync of NotebookLM outputs (especially flashcards, quiz-derived cards, reports) into Incrementum decks and scheduling.
- Keep the integration behind a feature flag and isolate failures from core study flows.

**Non-Goals:**
- Re-implement all NotebookLM web UI features in the first release.
- Guarantee permanent compatibility with undocumented upstream APIs.
- Provide full collaborative sharing management parity in v1.

## Decisions

### 1) Use a dedicated NotebookLM adapter service boundary
Decision:
- Implement NotebookLM operations behind a backend adapter interface (`NotebookLMProvider`) rather than calling `notebooklm-py` directly from UI code.

Rationale:
- Contains third-party volatility.
- Enables mock/stub providers for tests.
- Allows later provider swap if official APIs become available.

Alternatives considered:
- Direct UI-to-library calls via Python bridge: rejected due to poor fault isolation and testability.
- Building raw RPC calls in Incrementum: rejected because `notebooklm-py` already encapsulates auth and endpoint behavior.

### 2) Job-based orchestration for generation workflows
Decision:
- Treat generation actions as asynchronous jobs with persisted task state (`queued`, `running`, `succeeded`, `failed`, `expired-auth`).

Rationale:
- NotebookLM artifact generation is not immediate.
- Users need resumable progress in-app.

Alternatives considered:
- Blocking request/response flow: rejected due to timeouts and poor UX.

### 3) Normalize NotebookLM outputs into Incrementum study import schema
Decision:
- Define a canonical import mapper:
- Flashcards JSON/Markdown/HTML -> card front/back + tags/source refs.
- Quiz results -> cards for missed/incorrect items.
- Reports/mind maps/data tables -> notes and optional card extraction hooks.

Rationale:
- Keeps study scheduling independent from external formats.
- Allows consistent dedupe/versioning and source attribution.

Alternatives considered:
- Persist raw artifacts only: rejected because it postpones core value (incremental study).

### 4) Authentication/session strategy
Decision:
- Store NotebookLM auth state in secure local storage path controlled by backend.
- Add explicit account health checks and re-auth prompts when refresh fails.

Rationale:
- Session expiration is expected.
- Users need clear recovery paths.

Alternatives considered:
- Silent best-effort retries only: rejected due to confusing failure modes.

### 5) Deliver a curated idea-based action set in v1
Decision:
- Ship predefined actions derived from high-value workflows:
- Research topic -> study guide -> incremental deck.
- Generate flashcards -> review deck sync.
- Generate quiz -> convert missed items to cards.
- Generate audio/video overview -> attach to study item.
- Generate mind map/data table -> structured notes import.

Rationale:
- Makes broad capability discoverable without exposing full low-level API surface.

Alternatives considered:
- Expose only low-level controls: rejected for poor onboarding.

## Risks / Trade-offs

- [Unofficial upstream API changes] -> Mitigation: feature flag, adapter boundary, compatibility checks, fallback messaging.
- [Auth/session churn causes failed jobs] -> Mitigation: preflight auth checks, explicit `expired-auth` job state, guided reconnect.
- [Artifact mapping quality varies by content] -> Mitigation: preview-before-import, user-editable mapping, confidence tags.
- [Long-running jobs increase complexity] -> Mitigation: unified job model, retry policy, bounded polling intervals/timeouts.
- [Scope creep from too many artifact types] -> Mitigation: phase rollout (flashcards/quiz/report first, then media/table/map enhancements).

## Migration Plan

1. Introduce feature flag and backend adapter scaffolding with no UI exposure.
2. Implement auth/connect flow and notebook/source/chat read/write operations.
3. Add generation job orchestration and artifact retrieval.
4. Add import mapper and sync into Incrementum deck/card entities.
5. Roll out curated quick actions and telemetry.
6. Enable for internal testing, then staged user rollout.

Rollback:
- Disable feature flag to hide NotebookLM surfaces immediately.
- Preserve imported Incrementum content (no destructive rollback on user data).

## Open Questions

- Should NotebookLM sync default to one-way import or optional bi-directional metadata sync?
- Which artifact types are mandatory for GA vs experimental (video/infographic/mind-map)?
- Do we run NotebookLM operations only on desktop/Tauri backend initially, or also web-hosted mode?
- What retention policy should apply to raw downloaded artifacts after mapping/import?
