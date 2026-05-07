## Why

The app already collects rich user preference signals — RSS classifier likes/dislikes, spaced repetition ratings, tag affinity, and semantic embeddings — but these signals do not feed back into queue ordering. The queue is driven purely by FSRS scheduling state with engagement-based variety injection, meaning users see items based on *when* they're due, not *how relevant* they are. A recommendation engine that closes this feedback loop would surface content the user actually wants to read, improving retention and satisfaction.

## What Changes

- Introduce a **relevance scoring layer** that combines user preference signals (RSS classifiers, rating history, tag affinity, semantic similarity to favorited content) into a composite score per queue item.
- Modify the **queue assembly pipeline** to blend relevance scores with existing FSRS priority, creating a unified ranking that respects both scheduling urgency and user interest.
- Extend the **Engaging FSRS-6 scheduler** to accept relevance scores as an input when computing engagement priority, so high-relevance items get boosted and low-relevance items get deprioritized.
- Add a **feedback ingestion hook** that recalculates relevance scores when users upvote/downvote RSS articles, rate documents, or favorite content — ensuring the recommendation model updates in real-time.
- Surface the relevance signal in the **scroll mode UI** as a visual indicator (similar to the existing intelligence indicator for RSS) so users understand *why* items are ranked where they are.

## Capabilities

### New Capabilities
- `relevance-scoring`: Computes a composite relevance score for any queue item based on user preference signals (classifier sentiment, rating history, tag affinity, semantic similarity). Produces a 0-1 score that can be blended with FSRS priority.
- `recommendation-queue-blending`: Merges relevance scores with FSRS priority during queue assembly to produce a final ordering that balances scheduling urgency with user interest.

### Modified Capabilities
- `document-rating`: Rating events now trigger relevance score recalculation for related items (same tags, same author, semantically similar), not just the rated document's own scheduling.

## Impact

- **Backend (Rust)**: `engaging_scheduler.rs` gains a relevance input; `queue_selector.rs` and `queue.rs` blend relevance into sorting; new relevance scoring module.
- **RSS service**: `rss/service.rs` intelligence scores feed into the relevance pipeline instead of being standalone.
- **Frontend**: `QueueScrollPage.tsx` and `RSSScrollMode.tsx` engagement scoring incorporates relevance; new visual indicator component.
- **Data**: New table or fields to persist per-item relevance scores; classifiers and rating history become first-class inputs to scoring.
- **Performance**: Relevance recalculation must be fast (<50ms) for real-time feedback; may require caching or incremental updates.
