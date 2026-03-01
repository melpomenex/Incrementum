## Context
This umbrella change spans scheduling, review UX, AI tooling, import pipelines, sync, social workflows, analytics, and extensibility. Existing active changes already cover deck scoping, auth/sync foundations, and some media/transcript infrastructure, but there is no unified architecture and sequencing for the broader SRS feature set.

## Goals / Non-Goals
- Goals:
  - Provide a coherent, phased architecture that can deliver all requested capabilities without conflicting with active changes.
  - Preserve FSRS scheduling correctness while adding personalization, per-scope parameters, and simulation tools.
  - Support both local and cloud AI models with explicit provider-routing and fallback policy.
  - Keep data portability and auditability first-class (version history, export, P2P/local sync).
- Non-Goals:
  - Replacing existing FSRS implementation with a different scheduler.
  - Defining final visual design details for every new UI surface in this proposal.
  - Implementing this change in this stage (proposal only).

## Decisions
- Decision: Deliver as one umbrella change with capability-separated spec deltas.
  - Rationale: Keeps one approval surface while isolating requirements by domain for staged implementation.
- Decision: Define explicit integration boundaries with active changes instead of duplicating their requirements.
  - Rationale: Avoids spec conflicts and reduces future archive merge risk.
- Decision: Use a dual-provider AI interface for every AI-dependent feature.
  - Rationale: Meets requirement for local and cloud model support while allowing feature-level policy selection.
- Decision: Model scheduling scopes as global + deck + tag parameter layers.
  - Rationale: Supports per-subject memory dynamics and aligns with active deck/tag work.
- Decision: Treat cram/filtered sessions as ephemeral review contexts with no FSRS state mutation.
  - Rationale: Preserves long-term scheduling quality while enabling exam-eve review.

## Architecture Overview
- Scheduling core:
  - Add optimizer job pipeline that reads historical review logs and outputs FSRS weight sets by scope.
  - Add retention target policy layer that maps desired retention to interval scaling.
  - Add forecast simulator service that projects due counts over rolling windows.
- Review interaction layer:
  - Add pluggable card interaction engines (typed, matching, ordering, handwriting, audio, hints).
  - Add review mutation journal to support one-step undo and card version history coupling.
- AI service layer:
  - Add provider abstraction (`local`, `cloud`) with per-feature policy and fallback rules.
  - Centralize prompts/schema validation for duplicate detection, card quality, auto-tagging, and tutor mode.
- Import/integration layer:
  - Extend source adapters for audio files, PDF embedded annotations, clipboard capture, reference managers, and Logseq.
- Sync/collaboration layer:
  - Extend sync protocol with LAN transport option and collaboration objects (shared deck, group metrics, profile visibility).
- Analytics layer:
  - Add derived metrics pipeline for retention-by-day, forgetting curves, energy correlation, and reading ETA trends.
- Extensibility layer:
  - Add plugin lifecycle + permission model and REST/webhook gateway for external tools.

## Risks / Trade-offs
- Risk: Large scope can block delivery if treated as one release.
  - Mitigation: Implement by phase with capability-level feature flags and independent validation gates.
- Risk: AI behavior inconsistency across local/cloud providers.
  - Mitigation: Define capability-level quality thresholds and fallback hierarchy in tests.
- Risk: Overlap with active changes may cause requirement duplication.
  - Mitigation: Cross-reference active changes and mark dependencies explicitly in tasks and implementation sequencing.
- Risk: New interaction types increase UX and accessibility complexity.
  - Mitigation: Require accessibility checks and keyboard-first parity in implementation tasks.

## Migration Plan
1. Land foundational schema/API changes (scope parameters, journaling, AI provider config, analytics fields).
2. Implement scheduling and review primitives (optimizer, retention target, undo, cram isolation).
3. Add card interaction engines and media/TTS capabilities.
4. Add AI intelligence surfaces with local/cloud routing.
5. Add integrations, sync/collaboration features, analytics dashboards, then plugin/API surfaces.
6. Enable by feature flags, then graduate features after validation thresholds are met.

## Open Questions
- None. Scope, packaging, and AI provider direction were confirmed by the user for this proposal.
