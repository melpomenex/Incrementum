/**
 * Podcast replication.
 *
 * Two replicated maps:
 *   - `podcastFeeds` (row-lww + tombstone) — subscriptions. Unsubscribing on
 *     one device propagates so a fresh install doesn't re-subscribe.
 *   - `podcastEpisodes` (field-lww) — per-episode state: `played` (by
 *     played_at/unplayed_at), `playback_position` (by position_updated_at),
 *     and `download_intent` (by download_intent_at). Episode metadata +
 *     audio_url are carried so episodes appear on a fresh install; audio BYTES
 *     are never replicated (each device downloads from the feed URL itself).
 *
 * This is the "pick up the podcast where I left off on another device" path.
 * Position writes are debounced per-episode (1.5s) — `timeupdate` fires many
 * times per second and each publish appends a permanent CRDT tombstone, so
 * coalescing a burst into one publish is what keeps the shared doc from
 * ballooning (same lesson as document reading-position republish).
 *
 * Download intent (the user's "sync intent, not bytes" choice): device A taps
 * download → sets download_intent=1 + publishes. Device B receives intent=1 →
 * enqueues a LOCAL download respecting its own wifi/storage settings. Delete on
 * A → intent=0 → B frees its local copy. Position/played always sync regardless.
 */

import { createReplicatedMap, type ReplicatedMap } from "../replicatedMap";
import { nowHLC } from "../syncClock";
import { invokeCommand, isTauri } from "../../tauri";

// --- wire types (camelCase — the Rust podcast models use rename_all=camelCase) ---

export interface SyncedPodcastFeed {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  author: string | null;
  language: string | null;
  link: string | null;
  feedUrl: string;
  lastFetched: string | null;
  subscribedAt: string;
  sortOrder: number;
  autoTranscribe: boolean;
  transcribeLanguage: string | null;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SyncedPodcastEpisode {
  id: string;
  feedId: string;
  guid: string | null;
  title: string;
  description: string | null;
  publishedDate: string | null;
  duration: number | null;
  audioUrl: string;
  audioType: string | null;
  fileSize: number | null;
  imageUrl: string | null;
  link: string | null;
  played: boolean;
  playedAt: string | null;
  unplayedAt: string | null;
  playbackPosition: number;
  positionUpdatedAt: string | null;
  downloadIntent: number;
  downloadIntentAt: string | null;
  downloadIntentDevice: string | null;
  dateAdded: string;
  updatedAt: string;
}

// --- singletons -------------------------------------------------------------
let feedsMap: ReplicatedMap<SyncedPodcastFeed> | null = null;
let episodesMap: ReplicatedMap<SyncedPodcastEpisode> | null = null;

function getFeedsMap(): ReplicatedMap<SyncedPodcastFeed> {
  if (!feedsMap) {
    feedsMap = createReplicatedMap<SyncedPodcastFeed>({
      name: "podcastFeeds",
      label: "podcast-feeds",
      mode: "row-lww",
      clockField: "updatedAt",
      apply: async (_key, row) => {
        await invokeCommand("upsert_synced_podcast_feed", { feed: row });
        try {
          window.dispatchEvent(new CustomEvent("incrementum:synced-podcast-feed", { detail: { id: row.id } }));
        } catch { /* non-Tauri/test */ }
      },
    });
  }
  return feedsMap;
}

function getEpisodesMap(): ReplicatedMap<SyncedPodcastEpisode> {
  if (!episodesMap) {
    episodesMap = createReplicatedMap<SyncedPodcastEpisode>({
      name: "podcastEpisodes",
      label: "podcast-episodes",
      mode: "field-lww",
      clockField: "updatedAt",
      fieldClocks: [
        ["played", "playedAt"],
        ["playbackPosition", "positionUpdatedAt"],
        ["downloadIntent", "downloadIntentAt"],
      ],
      getLocal: async (key) => {
        try {
          return await invokeCommand<SyncedPodcastEpisode | null>(
            "get_synced_podcast_episode",
            { id: key },
          );
        } catch {
          return null;
        }
      },
      apply: async (_key, row) => {
        await invokeCommand("upsert_synced_podcast_episode", { ep: row });
        try {
          window.dispatchEvent(new CustomEvent("incrementum:synced-podcast-episode", { detail: { id: row.id } }));
        } catch { /* ignore */ }
      },
    });
  }
  return episodesMap;
}

// --- publish entry points ---------------------------------------------------

/** Publish a feed after subscribe/rename/reorder. */
export async function publishPodcastFeed(row: SyncedPodcastFeed): Promise<void> {
  await getFeedsMap().publish(row.id, row);
}

/** Tombstone a feed (unsubscribe). */
export async function publishPodcastFeedDeleted(id: string): Promise<void> {
  await getFeedsMap().delete(id);
}

/**
 * Publish a playback-position change, debounced per-episode (1.5s). Call on
 * `timeupdate` / periodic saves; the debounce collapses a burst of ticks into
 * one publish to keep the CRDT doc small. `rowProducer` is called only on
 * flush, so callers can cheaply call this every tick.
 */
export function publishEpisodePositionDebounced(
  episodeId: string,
  rowProducer: () => Promise<SyncedPodcastEpisode>,
): void {
  void getEpisodesMap().publishDebounced(episodeId, async () => {
    const row = await rowProducer();
    const clock = nowHLC();
    return { ...row, positionUpdatedAt: clock, updatedAt: clock };
  });
}

/** Publish a played/unplayed change. */
export async function publishEpisodePlayed(args: {
  row: SyncedPodcastEpisode;
  played: boolean;
}): Promise<void> {
  const clock = nowHLC();
  const row: SyncedPodcastEpisode = {
    ...args.row,
    played: args.played,
    playedAt: args.played ? clock : args.row.playedAt,
    unplayedAt: !args.played ? clock : args.row.unplayedAt,
    updatedAt: clock,
  };
  await getEpisodesMap().publish(row.id, row);
}

/**
 * Publish a download-intent change. The device that set the intent is recorded
 * so the receiver can show "downloaded on another device" provenance. The
 * intent is honored locally subject to each device's own wifi/storage settings.
 */
export async function publishEpisodeDownloadIntent(args: {
  row: SyncedPodcastEpisode;
  intent: number; // 1 = should be downloaded, 0 = should not
  deviceId: string;
}): Promise<void> {
  const clock = nowHLC();
  const row: SyncedPodcastEpisode = {
    ...args.row,
    downloadIntent: args.intent,
    downloadIntentAt: clock,
    downloadIntentDevice: args.intent ? args.deviceId : null,
    updatedAt: clock,
  };
  await getEpisodesMap().publish(row.id, row);
}

/** Warm up the maps on app boot. */
export async function ensurePodcastSyncReady(): Promise<void> {
  if (!isTauri()) return;
  await Promise.all([getFeedsMap().ensureReady(), getEpisodesMap().ensureReady()]);
}

export const __podcastSyncTest = {
  _reset: () => {
    feedsMap?.teardown();
    episodesMap?.teardown();
    feedsMap = null;
    episodesMap = null;
  },
};
