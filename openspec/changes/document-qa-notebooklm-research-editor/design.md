## Context

The current Document Q&A flow generates outputs but does not provide a dedicated research mode with controllable NotebookLM usage, nor an inline editing workspace that supports selection-based study artifact creation. Users who want to iterate on research content and transform it into cloze or Q&A cards currently need multiple disconnected steps. This change introduces a coherent research-to-study pipeline in a single tab while preserving existing Document Q&A behavior for users who do not enable NotebookLM.

Constraints:
- NotebookLM integration must be optional and explicitly user-controlled.
- Generated and edited research content must maintain source provenance for trust and traceability.
- Study artifact creation from selected text must align with existing card-generation pipeline contracts.

Stakeholders:
- Learners using Document Q&A to create study materials
- Frontend maintainers of the Document Q&A experience
- Backend/service owners for AI integrations and card generation

## Goals / Non-Goals

**Goals:**
- Provide a NotebookLM toggle and session-aware research workflow in Document Q&A.
- Provide inline research editing with selection actions for cloze and Q&A creation.
- Add brainstorming helpers that seed NotebookLM prompts for common research intents.
- Persist research drafts and generated artifacts with provenance metadata.
- Keep the integration modular so NotebookLM can be disabled without breaking baseline Q&A.

**Non-Goals:**
- Building a full standalone NotebookLM clone outside the Document Q&A context.
- Redesigning the entire card system or replacing existing card storage models.
- Introducing collaborative/multi-user editing in this iteration.
- Expanding this change to unrelated capabilities like YouTube playback or document ratings.

## Decisions

1. Decision: Gate NotebookLM features behind an in-tab toggle with explicit state.
Rationale: Users need control over when third-party/LLM-assisted research is active; explicit opt-in reduces unexpected behavior and usage cost.
Alternatives considered:
- Always-on NotebookLM integration: rejected because it removes user control and increases token usage.
- Global app-level toggle only: rejected because users need per-session/per-document control.

2. Decision: Use a structured inline editor model with selection ranges and action commands.
Rationale: Cloze/Q&A creation depends on precise span selection and deterministic extraction.
Alternatives considered:
- Plain textarea without range metadata: rejected because selection fidelity and provenance mapping are weak.
- Rich editor with unrestricted formatting extensions: deferred to reduce complexity; start with constrained formatting.

3. Decision: Persist research drafts and artifact generation in a dedicated research session record linked to document and user.
Rationale: Enables resume/edit flows, auditability, and rollback after failed generation.
Alternatives considered:
- Ephemeral frontend-only state: rejected because users lose work on refresh/navigation.
- Writing directly into final card storage only: rejected because users need a draft/refine stage.

4. Decision: Normalize generation actions through a single backend orchestration endpoint that calls NotebookLM adapter and card-generation services.
Rationale: Centralizes retries, error handling, throttling, and telemetry.
Alternatives considered:
- Frontend directly calling multiple services: rejected due to duplication and inconsistent failures.
- Embedding NotebookLM calls inside card pipeline only: rejected because research editing must exist independent of final card generation.

5. Decision: Introduce prompt-template chips for brainstorming (summarize, compare, timeline, key concepts, counterpoints).
Rationale: Improves usability while keeping prompts inspectable/editable.
Alternatives considered:
- Free-form prompt only: rejected due to higher user friction.
- Fully auto-generated prompts with no edits: rejected due to lower user trust/control.

## Risks / Trade-offs

- [NotebookLM latency and rate limits] -> Mitigation: add debounced requests, cancelation tokens, request queueing, and clear loading states.
- [Hallucinated or weakly grounded research output] -> Mitigation: display provenance snippets, source citations, and user-visible confidence/disclaimer UI.
- [Selection-to-cloze conversion inaccuracies] -> Mitigation: validate selected range boundaries before creation and provide preview/edit-before-save.
- [State complexity in editor + session persistence] -> Mitigation: define explicit session state machine (idle, researching, editing, generating, saved, error) and integration tests.
- [Increased API usage cost] -> Mitigation: explicit toggle defaults off, per-session token budget signals, and telemetry for monitoring.

## Migration Plan

1. Add backend schema/storage for research sessions and artifact draft records.
2. Add NotebookLM adapter interface and orchestration endpoint behind feature flag.
3. Ship frontend toggle and editor shell with mocked provider in internal builds.
4. Enable selection actions and artifact preview/write path to existing card pipeline.
5. Roll out to a small cohort with telemetry monitoring (latency, error rate, conversion).
6. Gradually widen rollout; keep runtime kill switch for NotebookLM integration.

Rollback strategy:
- Disable feature flag to hide NotebookLM toggle and orchestration calls.
- Preserve stored draft/session data for future re-enable; baseline Document Q&A remains operational.

## Open Questions

- Should NotebookLM mode be persisted per user globally, per workspace, or per document only?
- What is the allowed formatting subset in the inline editor for v1 (plain text only vs limited markdown)?
- Do we require human review checkpoint before cards are committed to study decks?
- What telemetry/privacy constraints apply to storing raw prompts and NotebookLM outputs?
