## Context

The current flow treats extract creation as a context switch into extract management. That is the wrong default for queue reading. In a queue session, the user's primary job is to keep reading and deciding what to extract next. The product should therefore preserve momentum and only move into extract management when the user explicitly asks for it.

The design needs to cover two cases:

1. Immediate post-create behavior.
2. Returning to source after opening the newly created extract.

## Goals / Non-Goals

**Goals:**
- Keep queue readers anchored to their current source by default.
- Make the newly created extract easy to inspect without trapping the user in the extracts view.
- Restore the exact reading target whenever the app has enough location data.
- Provide clear fallback actions if the exact restore target is unavailable.
- Apply the same mental model across books, imported articles, and RSS/article-style reading surfaces.

**Non-Goals:**
- Redesign the extract editor itself.
- Introduce long-term cross-device resume or synced reading restoration.
- Solve every non-queue path that can open an extract list.

## Decisions

1. Queue extract creation should be non-disruptive by default.
- Decision: After saving an extract from Scroll Mode or an optimal-session reader, the app stays on the current source and shows a success affordance with `Continue reading` as the default outcome and `View extract` as an explicit secondary action.
- Rationale: The most common next action after extracting is continued reading, not extract management.

2. Queue-created extracts must carry resumable source context.
- Decision: Persist a lightweight source-resume payload with queue-created extracts or alongside the current session state: queue mode, queue item ID, source document/article ID, source type, and reader position metadata.
- Rationale: A generic browser-history back action is too fragile and fails when the user opens the extract later or from another surface.

3. Opening a queue-created extract should show sticky source-return actions.
- Decision: The extract surface should render a persistent source context bar for queue-created extracts with:
  - Primary action: `Back to book` or `Back to article`
  - Secondary action: `Resume queue`
  - Optional metadata: source title and location hint such as page number
- Rationale: Users should not need to guess how to get back to their reading flow.

4. Return actions should restore exact position first, then degrade gracefully.
- Decision: Restore order should be:
  - exact reader location in the same queue item
  - source item root if exact location is missing
  - queue item root if the source still exists but location does not
  - disabled action with explanatory copy if the source no longer exists
- Rationale: Predictable fallback is better than broken back navigation.

5. "View extract" should prefer focused inspection over a generic list jump.
- Decision: When possible, opening the extract should focus the created extract directly rather than dropping users into an undifferentiated extracts list.
- Rationale: If the user explicitly wants the extract, they should land on that extract, not hunt for it.

## Risks / Trade-offs

- [Risk] Different readers expose different position models. Mitigation: define a shared source-resume contract with format-specific location fields.
- [Risk] Users may still expect the old auto-open-extract behavior. Mitigation: keep a clear `View extract` CTA in the post-create confirmation.
- [Risk] Stale source context could create dead buttons. Mitigation: validate targets before rendering active return actions.

## Migration Plan

1. Define a queue extract source-context model and shared restore helpers.
2. Change queue extract creation to remain in reading context and surface explicit CTAs.
3. Add source-return UI to queue-created extract views.
4. Add restore/fallback coverage for supported reader types.

Rollback: revert to the previous post-create routing behavior and remove the source-context UI.

## Open Questions

- Should `Resume queue` reopen the current queue session even if the user has since started a different one, or should it prefer the most recent active session?
