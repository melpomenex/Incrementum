## Context

Incrementum uses a multi-layer queue system: the Rust backend computes FSRS-6 priority scores, the queue selector applies weighted randomization, the engaging scheduler injects novelty/serendipity/variety, and the frontend scroll mode adds engagement scoring and category-based variety mixing. RSS articles have a separate intelligence system (classifiers for like/dislike on authors, keywords, tags) that produces an intelligence score, but this score is only used for filtering — it does not influence queue position.

The existing content similarity infrastructure (tag-based Jaccard similarity in `SimilarContent.tsx`, semantic embeddings in `VectorStore`) is used for "related content" suggestions but not for queue ordering.

Key constraints:
- The queue assembly happens in Rust (`queue.rs`, `queue_selector.rs`, `engaging_scheduler.rs`) and must remain fast.
- The frontend (`QueueScrollPage.tsx`) applies engagement scoring as a post-processing step after receiving items from the backend.
- RSS intelligence scores are computed in `rss/service.rs` using classifiers stored in the database.
- The engaging scheduler already has a `score_queue_items()` method that computes engagement priority with variety bonuses — this is the natural integration point.

## Goals / Non-Goals

**Goals:**
- Close the feedback loop so user preference signals (classifier likes/dislikes, rating history, tag affinity) directly influence queue ordering.
- Surface high-relevance content earlier in the queue without ignoring scheduling urgency (due dates, FSRS state).
- Provide real-time updates when users provide feedback (upvote/downvote, rate, favorite) — relevance scores update immediately for the affected item and related items.
- Keep the scoring pipeline fast enough for real-time queue assembly (<50ms for full queue).

**Non-Goals:**
- Collaborative filtering (no other users to compare against in a single-user desktop app).
- Machine learning model training — use deterministic, rule-based scoring that can be computed from existing data.
- Changing the FSRS-6 scheduling algorithm itself — relevance is blended *on top of* FSRS priority.
- Modifying the RSS intelligence classifier system — it stays as-is but its output feeds into the new relevance pipeline.

## Decisions

### 1. Relevance score as a separate layer blended with FSRS priority

**Decision**: Compute a 0-1 relevance score per item independently, then blend it with the existing FSRS priority (0-10) using a weighted formula: `final_score = fsrs_priority * (1 - relevance_weight) + normalized_relevance * relevance_weight * 10`.

**Rationale**: Keeps FSRS scheduling intact while adding personalization on top. The `relevance_weight` (default 0.3, configurable 0-1) lets users control how much personalization influences their queue vs. pure scheduling.

**Alternative considered**: Modifying FSRS stability/difficulty based on relevance — rejected because it would corrupt the spaced repetition model and make scheduling unpredictable.

### 2. Relevance scoring signals and weights

**Decision**: Use four weighted signals to compute relevance:
- **Classifier match** (weight 0.4): RSS classifiers (like/dislike on authors, tags, keywords) matching the item's metadata. Positive match → +score, negative match → -score.
- **Tag affinity** (weight 0.25): Frequency of the item's tags in recently positively-rated content. Computed from the last 100 ratings — tags that appear frequently in Easy/Good ratings get boosted.
- **Rating history** (weight 0.2): Items from the same source/author/feed as previously high-rated items get boosted. Items from sources where the user consistently rates Again/Hard get deprioritized.
- **Semantic similarity** (weight 0.15): Cosine similarity between the item's embedding and the centroid of embeddings for recently favorited/high-rated items. Uses the existing `VectorStore`.

**Rationale**: These four signals cover explicit preferences (classifiers), implicit preferences (rating patterns), content similarity (tags), and deep content understanding (embeddings). The weights prioritize explicit signals since they're most reliable.

**Alternative considered**: Pure embedding-based similarity — rejected because the desktop app may not always have embeddings computed for all items, and explicit user signals are more trustworthy.

### 3. Integration point: `engaging_scheduler.rs` `score_queue_items()`

**Decision**: Extend `score_queue_items()` in `engaging_scheduler.rs` to accept pre-computed relevance scores and factor them into the engagement priority calculation. The relevance score becomes an additional input alongside the existing novelty, serendipity, and variety bonuses.

**Rationale**: `score_queue_items()` already computes engagement priority with multiple factors. Adding relevance as another factor is a natural extension that doesn't require architectural changes.

### 4. Incremental relevance updates via feedback hooks

**Decision**: When a user provides feedback (rate, upvote/downvote, favorite), compute relevance for the affected item and trigger lazy recalculation for related items (same tags, same author, same feed). Store the computed relevance score in the database with a `last_computed_at` timestamp. Items without a computed score get a neutral 0.5 default.

**Rationale**: Full recalculation for all items on every feedback event would be too expensive. Lazy incremental updates keep the system responsive while ensuring related items get updated.

**Alternative considered**: Full batch recomputation on a schedule — rejected because it creates stale scores and doesn't provide the real-time feedback loop the user expects.

### 5. Data storage: Add `relevance_score` and `relevance_computed_at` fields to documents and RSS items

**Decision**: Add `relevance_score: Option<f64>` and `relevance_computed_at: Option<DateTime>` to the document and RSS article models. Store the composite score rather than individual signal scores.

**Rationale**: Simple schema change. Individual signal scores can be recomputed from source data and don't need persistence. Storing only the composite keeps the schema clean.

### 6. Frontend: Reuse the IntelligenceIndicator pattern

**Decision**: Extend the existing `IntelligenceIndicator` component to show relevance scores on non-RSS items, or create a similar `RelevanceIndicator` component. The visual treatment (colored dot) is familiar to users already.

**Rationale**: Consistency with the existing intelligence indicator pattern. Users already understand the green/red/gray dot metaphor.

## Risks / Trade-offs

- **Cold start problem** → New users have no rating history or classifiers, so relevance scores default to neutral (0.5). The queue behaves exactly as it does today until the user provides feedback. Mitigation: FSRS priority still drives ordering for new users.
- **Performance of tag affinity computation** → Computing tag frequency from the last 100 ratings requires a query. Mitigation: Cache the tag affinity map in memory and invalidate on new ratings. The dataset is small (desktop app, single user).
- **Embedding availability** → Not all items may have embeddings computed. Mitigation: Semantic similarity signal gets zero weight for items without embeddings; the other three signals still contribute.
- **Overfitting to preferences** → A pure relevance-based queue could create a filter bubble. Mitigation: The serendipity factor in the engaging scheduler already injects randomness; relevance_weight is capped at a reasonable default (0.3) to keep scheduling urgency dominant.
- **Relevance score staleness** → Lazy recalculation means some items may have outdated scores. Mitigation: Items with `relevance_computed_at` older than 7 days get flagged for recomputation during idle queue assembly.
