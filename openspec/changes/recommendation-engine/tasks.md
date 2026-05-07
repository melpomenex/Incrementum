## 1. Data Model & Schema

- [x] 1.1 Add `relevance_score: Option<f64>` and `relevance_computed_at: Option<DateTime>` fields to the `Document` model in the database schema
- [x] 1.2 Add `relevance_score: Option<f64>` and `relevance_computed_at: Option<DateTime>` fields to the RSS article model in the database schema
- [x] 1.3 Create a database migration that adds the new columns with defaults (NULL for existing rows)
- [x] 1.4 Update the `QueueItem` Rust model to include `relevance_score: Option<f64>` field
- [x] 1.5 Update the frontend `QueueItem` TypeScript type to include `relevanceScore?: number`

## 2. Relevance Scoring Engine (Backend)

- [x] 2.1 Create a new `relevance` module in `src-tauri/src/algorithms/` with the composite scoring function
- [x] 2.2 Implement the classifier match signal computation (reuse logic from `rss/service.rs` intelligence scoring)
- [x] 2.3 Implement the tag affinity signal — query the last 100 ratings and compute tag frequency for positive (Good/Easy) ratings
- [x] 2.4 Implement the rating history signal — aggregate ratings by source/author/feed and compute per-source sentiment
- [x] 2.5 Implement the semantic similarity signal — use the existing `VectorStore` to compute cosine similarity against the centroid of favorited item embeddings
- [x] 2.6 Implement the composite scoring function that blends all four signals with configurable weights, handling missing signals by redistributing weight
- [x] 2.7 Implement stale score detection — flag items with `relevance_computed_at` older than 7 days

## 3. Tag Affinity Cache

- [x] 3.1 Create an in-memory tag affinity cache struct that stores tag frequency from the last 100 ratings
- [x] 3.2 Implement cache initialization on app startup — load the last 100 ratings and build the frequency map
- [x] 3.3 Implement cache update on new rating — add the new rating's tags and evict the oldest entry when size exceeds 100
- [x] 3.4 Expose the cache to the relevance scoring module for tag affinity signal computation

## 4. Feedback Hooks & Incremental Updates

- [x] 4.1 Add a relevance recalculation trigger to `rate_document_engaging()` in `algorithm.rs` — recompute relevance for the rated document after scheduling
- [x] 4.2 Add a relevance recalculation trigger to `rate_document()` — recompute relevance for the rated document
- [x] 4.3 Add a relevance recalculation trigger to RSS classifier CRUD operations — recompute relevance for the classified article
- [x] 4.4 Implement lazy propagation — when a rating occurs, enqueue a background task to recompute relevance for items sharing tags/source with the rated item
- [x] 4.5 Implement the background task executor that processes the lazy propagation queue and updates relevance scores in the database

## 5. Queue Assembly Integration

- [x] 5.1 Extend `score_queue_items()` in `engaging_scheduler.rs` to accept relevance scores as input and apply relevance bonuses/penalties to engagement priority
- [x] 5.2 Modify the queue assembly in `queue.rs` to load relevance scores from the database for all items
- [x] 5.3 Implement the blending formula in the queue sorting: `final_score = fsrs_priority * (1 - weight) + relevance * 10 * weight`
- [x] 5.4 Add the `relevance_weight` field to `EngagementPreferences` with default value 0.3
- [x] 5.5 Pass relevance scores through the `QueueSelector` weighted randomization without disrupting the existing FSFS-first ordering

## 6. Frontend Integration

- [x] 6.1 Update the `QueueItem` type in `src/types/queue.ts` to include `relevanceScore?: number`
- [x] 6.2 Update the Tauri command bindings in `src/api/queue.ts` to deserialize the new `relevance_score` field
- [x] 6.3 Modify the engagement score calculation in `QueueScrollPage.tsx` to include `relevance_score * relevance_weight * 5` as a factor
- [x] 6.4 Modify the `calculateEngagementScore()` in `RSSScrollMode.tsx` to include relevance as a factor, replacing the random variety component for items with computed scores
- [x] 6.5 Create a `RelevanceIndicator` component (or extend `IntelligenceIndicator`) that shows green/red/gray dots based on relevance score thresholds (0.7/0.3)
- [x] 6.6 Add the `RelevanceIndicator` to scroll mode item cards in both `QueueScrollPage.tsx` and `RSSScrollMode.tsx`

## 7. Settings & Configuration

- [x] 7.1 Add a `relevance_weight` setting to the user settings store (range 0.0-1.0, default 0.3)
- [x] 7.2 Create a settings UI control (slider or dropdown) for the relevance weight in the queue/scroll settings page
- [x] 7.3 Ensure the relevance weight is passed to both the backend (queue assembly) and frontend (engagement scoring) when changed
- [x] 7.4 Trigger queue re-sorting when the relevance weight setting changes

## 8. Testing & Validation

- [x] 8.1 Write unit tests for the composite relevance scoring function with various signal combinations
- [x] 8.2 Write unit tests for each individual signal (classifier match, tag affinity, rating history, semantic similarity)
- [x] 8.3 Write unit tests for the blending formula with edge cases (weight=0, weight=1, missing scores)
- [x] 8.4 Write integration tests for the feedback hooks — verify relevance updates propagate on rating/classifier changes
- [x] 8.5 Test queue assembly with relevance scores — verify items with high relevance appear earlier
- [x] 8.6 Test cold start behavior — verify queue ordering is unchanged when no feedback history exists
- [x] 8.7 Verify performance — full queue assembly with relevance computation should complete in <50ms
