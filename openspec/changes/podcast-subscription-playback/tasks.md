# Tasks

## Phase 1: Backend Foundation

- [ ] **1. Create podcast database tables** — Add migration in `src-tauri/src/database/connection.rs` to create `podcast_feeds` and `podcast_episodes` tables with indices. Follow existing migration patterns in the codebase.
- [ ] **2. Add podcast Rust models** — Create `src-tauri/src/models/podcast.rs` with `PodcastFeed` and `PodcastEpisode` structs matching the DB schema, with Serialize/Deserialize.
- [ ] **3. Implement RSS podcast feed parser** — Create `src-tauri/src/rss/podcast_parser.rs` (or `src-tauri/src/podcast/parser.rs`). Use `quick-xml` or `rss` crate. Parse standard RSS 2.0 + iTunes namespace. Extract channel metadata and episodes with enclosures. Handle errors gracefully for malformed feeds.
- [ ] **4. Implement Tauri commands** — Create `src-tauri/src/commands/podcast.rs` with: `subscribe_podcast`, `unsubscribe_podcast`, `get_podcast_feeds`, `refresh_podcast_feed`, `get_podcast_episodes`, `mark_episode_played`, `update_episode_position`, `get_episode_position`. Register all commands in `src-tauri/src/lib.rs`.
- [ ] **5. Add podcast repository methods** — Add podcast CRUD methods to `src-tauri/src/database/repository.rs` (or a dedicated podcast repo). Insert/select/update/delete feeds and episodes. Bulk upsert episodes with dedup by feed_id + guid.

## Phase 2: Frontend Rewiring

- [ ] **6. Rewrite `api/podcast.ts` for Tauri IPC** — Replace localStorage functions with Tauri `invokeCommand` calls. Keep the types (`PodcastFeed`, `PodcastEpisode`, `PodcastEpisodeQueue`). Add HTTP fallback for PWA mode (similar to `api/rss.ts` pattern).
- [ ] **7. Update `PodcastManager.tsx`** — Remove localStorage usage. Call Tauri commands for subscribe/unsubscribe/refresh. Handle loading states, errors, and empty states. Keep the existing UI structure (sidebar + episode list + dialogs).
- [ ] **8. Wire PodcastPage into router** — Import in the route file. Add tab with `Headphones` icon. Add route definition. Place between RSS and Settings tabs.
- [ ] **9. localStorage migration** — On first load, check if `localStorage.podcast_subscriptions` exists. If so, parse stored feed URLs and call `subscribe_podcast` for each. Clear localStorage after successful migration.

## Phase 3: Playback

- [ ] **10. Extend AudiobookViewer for remote audio** — Add `remoteAudioUrl?: string` and `episodeId?: string` props. When `remoteAudioUrl` is set, skip file loading and set `<audio src>` directly. Call `update_episode_position` on timeupdate (debounced 5s). Call `get_episode_position` on mount to restore.
- [ ] **11. Wire playback from PodcastManager** — When user clicks "Play" on an episode, open it in a viewer context (either navigate to DocumentViewer with the episode, or render an inline player). Persist playback state across sessions.
- [ ] **12. Add podcast queue settings** — Add `podcastQueue` settings (mirroring `rssQueue`): `includeInQueue`, `maxItemsPerSession`, `unreadOnly`. Wire into `QueueScrollPage.tsx` to load unplayed episodes as scroll items using `AudiobookViewer`.

## Phase 4: Polish

- [ ] **13. Add `PodcastFeed` and `PodcastEpisode` types to browser sync API** — Add HTTP endpoints in `browser_sync_server.rs` for PWA mode.
- [ ] **14. Handle feed refresh failures gracefully** — Show error toast on refresh failure. Don't lose existing episodes. Retry logic with exponential backoff.
- [ ] **15. Update CHANGELOG and cut release** — Once all tasks complete.
