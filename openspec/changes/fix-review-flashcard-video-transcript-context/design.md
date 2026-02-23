## Context

The Review flashcard generation modal currently derives context and token estimates from `document.content`. For media documents (local video/audio and YouTube), transcript text may live in transcript-specific storage and not be present in `document.content`, resulting in inaccurate "0 tokens" estimates and weak generation context.

This change spans Review UI context estimation, prompt context assembly, and media transcript resolution paths. It must preserve existing behavior for text documents while adding transcript-backed resolution for media content.

## Goals / Non-Goals

**Goals:**
- Provide a single resolved context source for flashcard generation in Review that includes transcript text for media docs.
- Ensure token/cost estimates and context control modes are computed from that resolved source.
- Keep existing generation flow and save behavior unchanged except for improved context quality.

**Non-Goals:**
- Redesigning the flashcard modal UI.
- Changing transcript generation pipelines.
- Introducing new backend APIs or altering transcript storage schemas.

## Decisions

1. Introduce an "effective document text" resolution step in the modal.
- Decision: resolve `selectedDocumentText` from `document.content` first, then transcript providers for media types.
- Rationale: centralizes behavior and avoids duplicated fallback logic across token estimate and generation code paths.
- Alternative considered: only patch token estimator while leaving generation context unchanged. Rejected because it would keep mismatch between estimate and actual prompt context.

2. Use existing transcript APIs for media types.
- Decision: use `getVideoTranscript(documentId)` for local video/audio and `fetchYouTubeTranscript(videoId)` for YouTube when direct content is absent.
- Rationale: avoids new APIs and uses established retrieval mechanisms.
- Alternative considered: force transcript materialization into `document.content`. Rejected because it introduces broader synchronization concerns outside this fix.

3. Fail gracefully when transcript lookup is unavailable.
- Decision: if transcript fetch fails or is empty, keep behavior non-blocking and continue with available context.
- Rationale: generation should remain usable even without transcript availability.
- Alternative considered: hard-block generation for media docs without transcript. Rejected due to poor UX and mismatch with current permissive behavior.

## Risks / Trade-offs

- [Network or provider errors for transcript fetch] -> Mitigation: catch errors, log warning, and fall back to existing content path.
- [Slightly higher modal initialization latency for media docs] -> Mitigation: resolve asynchronously and keep UI interactive.
- [Potential inconsistency across context modes for media docs without chapter semantics] -> Mitigation: default to full/excerpt/search behavior using resolved text and avoid mode-specific assumptions.

## Migration Plan

- No data migration required.
- Deploy as a frontend-only behavioral fix.
- Rollback by reverting modal context resolution logic if regressions are observed.

## Open Questions

- Should the modal show explicit transcript availability state for media documents?
- Should YouTube transcript fetch be cached at modal scope to reduce repeated calls across context changes?
