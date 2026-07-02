/**
 * RSS replication.
 *
 * Two replicated maps:
 *   - `rssFeeds` (row-lww + tombstone) — feed subscriptions. Unsubscribing on
 *     one device propagates (via tombstone) so a freshly-installed device
 *     doesn't re-subscribe from a stale local row. Feeds dedupe by `url`.
 *   - `rssArticlesState` (field-lww) — per-article user state: `is_read` /
 *     `is_queued` plus their transition clocks. Article *content* (HTML) is
 *     NEVER replicated — each device re-fetches it — keeping the CRDT doc small.
 *
 * This is what fixes the "I re-installed and my RSS feeds / read state didn't
 * sync" complaint: read an article on desktop → phone's queue no longer shows
 * it; subscribe on one device → appears on all.
 *
 * Conflict resolution: field-LWW on the read/queued state. Bare `is_read`/
 * `is_queued` booleans race when two devices toggle concurrently; the
 * `read_at`/`unread_at`/`queued_at`/`unqueued_at` companion clocks make the
 * merge deterministic (the transition with the newer clock wins).
 */

import { createReplicatedMap, type ReplicatedMap } from "../replicatedMap";
import { nowHLC } from "../syncClock";
import { invokeCommand, isTauri } from "../../tauri";

// --- wire types -------------------------------------------------------------

export interface SyncedRssFeed {
  id: string;
  url: string;
  title: string;
  description: string | null;
  category: string | null;
  update_interval: number;
  last_fetched: string | null;
  is_active: boolean;
  date_added: string;
  auto_queue: boolean;
  auto_fetch_full_content: string | null;
  collection_id: string;
  updated_at: string;
  deleted_at: string | null;
  /** CamelCase alias for the factory constraint. */
  updatedAt: string;
}

export interface SyncedRssArticleState {
  id: string;
  feed_id: string;
  url: string;
  guid: string | null;
  title: string;
  author: string | null;
  published_date: string | null;
  image_url: string | null;
  is_read: boolean;
  read_at: string | null;
  unread_at: string | null;
  is_queued: boolean;
  queued_at: string | null;
  unqueued_at: string | null;
  updated_at: string;
  date_added: string;
  updatedAt: string;
}

// --- singletons -------------------------------------------------------------
let feedsMap: ReplicatedMap<SyncedRssFeed> | null = null;
let articleStateMap: ReplicatedMap<SyncedRssArticleState> | null = null;

function getFeedsMap(): ReplicatedMap<SyncedRssFeed> {
  if (!feedsMap) {
    feedsMap = createReplicatedMap<SyncedRssFeed>({
      name: "rssFeeds",
      label: "rss-feeds",
      mode: "row-lww",
      clockField: "updated_at",
      apply: async (_key, row) => {
        await invokeCommand("upsert_synced_rss_feed", { feed: row });
        try {
          window.dispatchEvent(new CustomEvent("incrementum:synced-rss-feed", { detail: { id: row.id } }));
        } catch { /* non-Tauri/test */ }
      },
      applyDelete: async (key) => {
        // Re-publish a tombstone with deleted_at so the receiver soft-deletes.
        // The factory already wrote the Yjs tombstone; here we mirror it to the
        // SQLite row via the same upsert with deleted_at set.
        await invokeCommand("upsert_synced_rss_feed", {
          feed: { id: key, deleted_at: nowHLC() } as Partial<SyncedRssFeed> as SyncedRssFeed,
        }).catch(() => { /* best-effort */ });
      },
    });
  }
  return feedsMap;
}

function getArticleStateMap(): ReplicatedMap<SyncedRssArticleState> {
  if (!articleStateMap) {
    articleStateMap = createReplicatedMap<SyncedRssArticleState>({
      name: "rssArticlesState",
      label: "rss-article-state",
      mode: "field-lww",
      // The row clock for non-churn metadata (title/url) is updated_at; the
      // churn fields (is_read/is_queued) each resolve by their own *_at clock.
      clockField: "updated_at",
      fieldClocks: [
        ["is_read", "read_at"],
        ["is_queued", "queued_at"],
      ],
      getLocal: async (key) => {
        try {
          return await invokeCommand<SyncedRssArticleState | null>(
            "get_synced_rss_article_state",
            { id: key },
          );
        } catch {
          return null;
        }
      },
      apply: async (_key, row) => {
        await invokeCommand("upsert_synced_rss_article_state", { state: row });
        try {
          window.dispatchEvent(new CustomEvent("incrementum:synced-rss-article", { detail: { id: row.id } }));
        } catch { /* ignore */ }
      },
    });
  }
  return articleStateMap;
}

// --- publish entry points ---------------------------------------------------

/**
 * Publish a feed row after subscribe/rename/move. `row.updated_at` must be a
 * fresh `nowHLC()`. Fire-and-forget; no-op outside Tauri.
 */
export async function publishRssFeed(row: SyncedRssFeed): Promise<void> {
  row.updatedAt = row.updated_at;
  await getFeedsMap().publish(row.id, row);
}

/**
 * Publish an article's read/unread state change. Stamps the matching transition
 * clock (read_at when marking read, unread_at when marking unread) so the
 * field-LWW merge picks the latest transition. The caller passes the article's
 * current state fields; this fills in the clocks.
 */
export async function publishRssArticleReadState(args: {
  article: Omit<SyncedRssArticleState, "updatedAt">;
  isRead: boolean;
}): Promise<void> {
  const clock = nowHLC();
  const row: SyncedRssArticleState = {
    ...args.article,
    is_read: args.isRead,
    read_at: args.isRead ? clock : args.article.read_at,
    unread_at: !args.isRead ? clock : args.article.unread_at,
    updated_at: clock,
    updatedAt: clock,
  };
  await getArticleStateMap().publish(row.id, row);
}

/**
 * Publish an article's queued (star/save) state change.
 */
export async function publishRssArticleQueuedState(args: {
  article: Omit<SyncedRssArticleState, "updatedAt">;
  isQueued: boolean;
}): Promise<void> {
  const clock = nowHLC();
  const row: SyncedRssArticleState = {
    ...args.article,
    is_queued: args.isQueued,
    queued_at: args.isQueued ? clock : args.article.queued_at,
    unqueued_at: !args.isQueued ? clock : args.article.unqueued_at,
    updated_at: clock,
    updatedAt: clock,
  };
  await getArticleStateMap().publish(row.id, row);
}

/** Tombstone a feed (unsubscribe). */
export async function publishRssFeedDeleted(id: string): Promise<void> {
  await getFeedsMap().delete(id);
}

/** Warm up the maps on app boot. */
export async function ensureRssSyncReady(): Promise<void> {
  if (!isTauri()) return;
  await Promise.all([getFeedsMap().ensureReady(), getArticleStateMap().ensureReady()]);
}

export const __rssSyncTest = {
  _reset: () => {
    feedsMap?.teardown();
    articleStateMap?.teardown();
    feedsMap = null;
    articleStateMap = null;
  },
};
