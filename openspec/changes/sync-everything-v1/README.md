# Sync Everything v1 — Implementation Notes

Status: **infrastructure + flashcards + RSS + podcasts implemented** (this change).
Tracks but deviates from the earlier `overhaul-cross-device-sync` design — see
"Deviations from the original design" below.

## What shipped

### Foundation
- **`src/lib/sync/syncClock.ts`** — monotonic HLC clock (`nowHLC()`) + stable
  per-install device id (`getDeviceId()` → `get_or_create_sync_device_id`
  Tauri command, single-row `sync_device_id` table). `compareClock`/`isNewer`
  handle HLC and ISO strings and treat absent as older-than-any.
- **`src/lib/sync/tombstone.ts`** — `writeTombstone`/`gcTombstones` + the
  `isTombstone`/`Tombstoned<T>` helpers. 30-day TTL (matches the design).
- **`src/lib/sync/replicatedMap.ts`** — the shared factory. `createReplicatedMap`
  encapsulates the `documentReplication.ts` pattern (getMap, ensureReady with
  room-switch reset, observe→handleRemote, timestamp echo-guard, per-key
  debounce, tombstone handling). Three merge modes: `row-lww`, `append-only`,
  `field-lww`. Each entity is a small declarative config (~30-60 lines).

### Relay (Phase 0.1 + 0.2)
- **`yjs-sync/frameLog.js`** — server-side rolling log of encrypted frames
  (task 1.8b). Per-room append-only file log, capped (64 MiB default) with LRU
  eviction, time-GC'd (30d). Frames are opaque ciphertext — the relay stays
  ciphertext-only. Wired into `yjs-sync/utils.js`: append on forward, replay on
  connect. This is what makes async encrypted sync work (device A writes, device
  B downloads later when A is offline). Gated on `FRAME_LOG_DIR`. Test:
  `yjs-sync/test/frame-log.cjs` (12/12).
- `yjs-sync/server.js` + `utils.js` opaque-forwarding fork (task 1.8a, previously
  written) still needs **deployment** to `sync.readsync.org` (operator action).

### Schema (migration `053_sync_state_columns`)
Monotonic sync-clock columns on every syncable table, plus `sync_device_id` and
`sync_tombstones`. Backfilled from existing date columns where possible. RSS
article read/queued and podcast played/position gained per-field transition
clocks (`read_at`/`unread_at`/`queued_at`/`played_at`/`position_updated_at`/…)
so concurrent edits merge deterministically. Podcasts gained
`download_intent` + intent clock/device columns.

### Flashcards (Phase 3 — the paramount case)
- Maps: `learningItems` (row-lww), `reviews` (append-only, deterministic id).
- `deterministicReviewId = sha1(itemId|reviewedAtMs|deviceId)` — two devices
  reviewing the same card both count; a replay collapses to one row via the
  unique `(item_id, reviewed_at_ms, device_id)` index + `INSERT OR IGNORE`.
- Publish hooked into `submitReview` (api/review.ts) — fire-and-forget; the
  review UX never waits on sync and never fails if sync is offline.
- Rust: `upsert_synced_learning_item`, `upsert_synced_review_result`,
  `delete_synced_learning_item`, `get_synced_learning_item`.
- LearningItem model gained `updated_at`; the 4 duplicated row-mappers were
  refactored into one `row_to_learning_item` helper.
- Tests: `sync.reviewCorrectness.test.ts` (12/12) — idempotency, two-device,
  same-ms collisions, HLC monotonicity, tombstone detection, the paramount
  scenario.

### RSS (Phase 4 — the reinstall complaint)
- Maps: `rssFeeds` (row-lww + tombstone, dedupe by `url`),
  `rssArticlesState` (field-lww on read/queued). Article **content is never
  replicated** — re-fetched per device — keeping the CRDT doc small.
- Publish hooked into `markItemReadAuto` / `toggleItemFavoriteAuto`.
- Rust: `upsert_synced_rss_feed`, `upsert_synced_rss_article_state`,
  `get_synced_rss_article_state`.

### Podcasts (Phase 5)
- Maps: `podcastFeeds` (row-lww + tombstone, dedupe by `feed_url`),
  `podcastEpisodes` (field-lww on played/position/download_intent).
- **Audio bytes are never replicated** (the user's "sync intent, not bytes"
  choice). Each device downloads from the feed URL, honoring its own
  wifi/storage settings. `download_intent` is the synced "should be downloaded"
  flag.
- Position publish is **debounced per-episode (1.5s)** to avoid CRDT-doc bloat
  from `timeupdate` ticks (same lesson as document reading-position).
- Publish hooked into `markEpisodePlayed` / `updateEpisodePosition`.
- Rust: `upsert_synced_podcast_feed`, `upsert_synced_podcast_episode`,
  `get_synced_podcast_episode`.

### Migration (Phase 6)
- `src/lib/sync/migrate.ts` — first-join backfill. Gated by
  `incrementum_yjs_migration_v1_done:<room>`. Publishes local cards into the
  room on first join, batched (50) with event-loop yields. Non-blocking,
  best-effort. v1 focuses on cards; RSS/podcast feed seeding reuses the same
  publish entry points (follow-up).

### UI/UX (Phase 7)
- `src/lib/sync/useSyncedData.ts` — reactive refresh hooks on
  `incrementum:synced-*` events. Wired into ReviewHome (debounced reload of due
  items on card sync) so the home screen reflects cross-device reviews.
- SyncSettings already shows the truthful Encrypted / TLS only / Not syncing
  label (unchanged).

## Deviations from the original `overhaul-cross-device-sync` design

1. **Factory, not full YjsAdapter refactor.** The design's Decision 2 makes Yjs
   the *single writer* (every UI write routes through `adapter.writeLocal()`
   first). That's a large, risky refactor of every write path. v1 instead
   mirrors the proven `documentReplication.ts` pattern — local writes hit SQLite
   immediately (offline-first), and a fire-and-forget publish mirrors the change
   to Yjs. Functionally equivalent for the user; far less churn. The full
   single-writer adapter remains a future hardening step (Phase 3.3 of the
   original).

2. **Per-entity wire types, not a shared `schemas.ts`.** Each entity module
   defines its own `Synced*` interface. Slightly more repetition, but each
   entity's strip/merge rules are explicit and the snake/camel naming
   differences between models (LearningItem is snake_case; PodcastFeed/Episode
   are camelCase) are handled per-entity instead of fighting one shared schema.

3. **No extracts/decks/audioPositions/settings maps yet.** The design's Phase 2
   listed extracts, learningItems, reviews, audioPositions, settings. v1 ships
   learningItems + reviews (paramount) and adds RSS + podcasts (the explicit
   user ask). Extracts and study-decks are deferred — extract provenance on
   synced cards will dangle until extracts sync (non-fatal; cards still review).

## Remaining work (deferred from this change)
- **Deploy** the forked relay (1.8a) + frame log (0.2) to `sync.readsync.org`
  and set `FRAME_LOG_DIR`. Code is ready; this is an operator deploy step.
- **Extracts + study-decks sync** (so card provenance and deck definitions
  converge across devices).
- **RSS/podcast feed seeding** in the migration runner (publish entry points
  exist; wire them into `migrate.ts` like `seedCards`).
- **Two-client convergence harness** (original Phase 8 / 10.4) — the
  end-to-end "review on desktop, open phone, assert identical state" test.
  Unit invariants are covered; the full harness needs a real relay.
- **Web/PWA receive path** (out of scope — Tauri↔Tauri only this phase).
- **Single-writer adapter hardening** (original Phase 3.3) if write-path races
  surface in the field.
