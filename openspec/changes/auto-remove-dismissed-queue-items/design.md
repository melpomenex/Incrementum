## Context

The app already persists `is_dismissed` on documents and exposes a `dismiss_document` command, but queue construction currently filters archived documents only. As a result, a dismissed document can continue to appear in queue-derived views until some other state change removes it. The requested behavior is immediate queue removal when the user dismisses an item via the app UI.

This change crosses the backend queue pipeline and frontend queue interactions, so the design needs to define the behavioral source of truth and the refresh path after dismissal.

## Goals / Non-Goals

**Goals:**
- Make dismissed documents ineligible for queue inclusion.
- Ensure dismissing from a queue-facing UI removes the item from the visible queue without requiring manual reload.
- Keep dismissal reversible so the document can be restored later.

**Non-Goals:**
- Changing how archive works or merging dismissal with archive.
- Deleting dismissed documents or hiding them from the broader library/search surfaces unless already specified elsewhere.
- Extending dismissal to learning items, extracts, or other queue item types that do not currently use `dismiss_document`.

## Decisions

### Treat `is_dismissed` as a hard queue exclusion for documents

Queue generation should skip any document with `is_dismissed = true`, the same way it already skips archived documents. This keeps the behavior centralized in the backend instead of relying on each frontend queue surface to filter locally.

Alternative considered: only removing the item from the current UI list after the button click. Rejected because it would leave other queue surfaces inconsistent and allow dismissed items to return on the next fetch.

### Preserve dismissal as a reversible state change

The dismiss action should continue to update document state rather than delete or archive the document. That matches the current command shape and avoids making a queue-management action destructive.

Alternative considered: converting dismiss into archive. Rejected because archive has different product meaning and likely different discovery semantics.

### Refresh queue-facing client state after a successful dismiss action

Queue UIs that expose dismiss must invalidate or recompute their queue data after the dismiss request succeeds so the user sees immediate removal. Backend exclusion is the source of truth; frontend refresh is the responsiveness layer.

Alternative considered: waiting for the next scheduled queue refresh. Rejected because the user expectation is immediate removal after clicking dismiss.

## Risks / Trade-offs

- [Scope ambiguity around "item"] -> Limit this change to document dismissal because the existing command and persisted flag are document-specific; call that out explicitly in the spec and tasks.
- [UI inconsistency across queue surfaces] -> Require queue refresh/invalidation anywhere the dismiss button is available.
- [Dismissed documents becoming hard to recover] -> Preserve the existing reversible dismissal model and avoid conflating dismiss with delete/archive.

## Migration Plan

No data migration is required because `is_dismissed` already exists in the document model and database schema. Existing dismissed documents will stop appearing in queues as soon as queue generation begins honoring the flag.

Rollback is straightforward: remove the queue exclusion and UI refresh behavior if the product decision changes.

## Open Questions

- Which exact queue-facing UI components currently expose dismiss, and do they all already share the same queue invalidation path?
- Should dismissed documents remain visible in non-queue document library views with a recover/undismiss action in the same release, or is that already covered elsewhere?
