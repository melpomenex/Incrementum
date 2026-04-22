## Why

Creating an extract from the queue currently breaks reading continuity. After capture, users can end up on the extracts view without an obvious way to return to the exact book or article they were reading, which is especially disruptive in Scroll Mode and the optimal queue.

The UX should optimize for uninterrupted reading first, while still making the newly created extract easy to inspect and edit.

## What Changes

- Keep users in their current reading session by default after creating an extract from a queue item.
- Add an explicit "View extract" path that opens the new extract without sacrificing a clear return path.
- When users do open the extract view from a queue-created extract, show persistent source-aware actions such as `Back to book`, `Back to article`, and `Resume queue`.
- Preserve enough source context to restore the exact reading target when possible: queue session, item ID, source type, and reader location (page, CFI, scroll anchor, or article position).
- Define safe fallback behavior when the exact source location is no longer available.

## Capabilities

### New Capabilities
- `extract-source-navigation`: Preserve and restore source reading context for extracts created from queue flows.

### Modified Capabilities
- None.

## Impact

- Affected queue extract-creation flows in scroll mode and optimal-session reading.
- Affected extract surfaces, especially document extract views and any post-create extract destination.
- Affected reader state persistence for PDF, EPUB, HTML/web article, and RSS/article reading contexts.
