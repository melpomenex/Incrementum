/**
 * Podcast/RSS feed management — Tauri IPC + HTTP fallback
 */

import { invokeCommand, isTauri } from "../lib/tauri";

// ============================================================================
// Types (camelCase — Tauri auto-converts from snake_case)
// ============================================================================

/**
 * Podcast feed as returned by the backend (camelCase in JS).
 */
export interface PodcastFeed {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  author: string | null;
  language: string | null;
  link: string | null;
  feedUrl: string;
  lastFetched: string | null;
  subscribedAt: string;
  sortOrder: number;
  episodeCount: number;
  unplayedCount: number;
}

/**
 * Podcast episode as returned by the backend (camelCase in JS).
 */
export interface PodcastEpisode {
  id: string;
  feedId: string;
  guid: string | null;
  title: string;
  description: string | null;
  publishedDate: string | null;
  duration: number | null; // seconds
  audioUrl: string;
  audioType: string | null;
  fileSize: number | null;
  imageUrl: string | null;
  link: string | null;
  played: boolean;
  playbackPosition: number; // seconds
  dateAdded: string;
}

// ============================================================================
// HTTP helpers (mirrors rss.ts / rss-classifiers.ts pattern)
// ============================================================================

function getApiBaseUrl(): string {
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? `${window.location.protocol}//${window.location.hostname}:8766`
    : `${window.location.protocol}//${window.location.hostname}`;
}

function shouldUseHttp(): boolean {
  if (isTauri()) return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

// ============================================================================
// Unified async API functions (Tauri IPC → HTTP → browserInvoke fallback)
// ============================================================================

/**
 * Subscribe to a podcast feed. Returns the created PodcastFeed.
 */
export async function subscribeToPodcast(feedUrl: string): Promise<PodcastFeed> {
  if (isTauri()) {
    return invokeCommand<PodcastFeed>("subscribe_podcast", { feedUrl });
  }
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/podcast/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feed_url: feedUrl }),
    });
    if (!res.ok) throw new Error(`Failed to subscribe: ${res.statusText}`);
    return res.json();
  }
  // browserInvoke fallback — will return empty/defaults
  return invokeCommand<PodcastFeed>("subscribe_podcast", { feedUrl });
}

/**
 * Rename a podcast feed.
 */
export async function renamePodcastFeed(feedId: string, newTitle: string): Promise<void> {
  if (isTauri()) {
    return invokeCommand<void>("rename_podcast_feed", { feedId, newTitle });
  }
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/podcast/feeds/${feedId}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_title: newTitle }),
    });
    if (!res.ok) throw new Error(`Failed to rename: ${res.statusText}`);
    return;
  }
  // browser fallback: no-op
  console.warn("[Browser] renamePodcastFeed: no-op in browser fallback mode");
}

/**
 * Unsubscribe from a podcast feed.
 */
export async function unsubscribeFromPodcast(feedId: string): Promise<void> {
  if (isTauri()) {
    return invokeCommand<void>("unsubscribe_podcast", { feedId });
  }
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/podcast/feeds/${feedId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`Failed to unsubscribe: ${res.statusText}`);
    return;
  }
  return invokeCommand<void>("unsubscribe_podcast", { feedId });
}

/**
 * Get all subscribed podcast feeds.
 */
export async function getSubscribedPodcasts(): Promise<PodcastFeed[]> {
  if (isTauri()) {
    return invokeCommand<PodcastFeed[]>("get_podcast_feeds");
  }
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/podcast/feeds`);
    if (!res.ok) throw new Error(`Failed to get feeds: ${res.statusText}`);
    return res.json();
  }
  return invokeCommand<PodcastFeed[]>("get_podcast_feeds");
}

/**
 * Refresh (re-fetch) a podcast feed. Returns the updated PodcastFeed.
 */
export async function refreshFeed(feedId: string): Promise<PodcastFeed> {
  if (isTauri()) {
    return invokeCommand<PodcastFeed>("refresh_podcast_feed", { feedId });
  }
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/podcast/feeds/${feedId}/refresh`, {
      method: "POST",
    });
    if (!res.ok) throw new Error(`Failed to refresh feed: ${res.statusText}`);
    return res.json();
  }
  return invokeCommand<PodcastFeed>("refresh_podcast_feed", { feedId });
}

/**
 * Get episodes for a podcast feed.
 */
export async function getPodcastEpisodes(
  feedId: string,
  includePlayed: boolean = true,
): Promise<PodcastEpisode[]> {
  if (isTauri()) {
    return invokeCommand<PodcastEpisode[]>("get_podcast_episodes", {
      feedId,
      includePlayed,
    });
  }
  if (shouldUseHttp()) {
    const params = new URLSearchParams({ include_played: String(includePlayed) });
    const res = await fetch(`${getApiBaseUrl()}/api/podcast/feeds/${feedId}/episodes?${params}`);
    if (!res.ok) throw new Error(`Failed to get episodes: ${res.statusText}`);
    return res.json();
  }
  return invokeCommand<PodcastEpisode[]>("get_podcast_episodes", { feedId, includePlayed });
}

/**
 * Get the episode queue (unplayed episodes across all feeds).
 */
export async function getEpisodeQueue(): Promise<PodcastEpisode[]> {
  if (isTauri()) {
    return invokeCommand<PodcastEpisode[]>("get_podcast_episodes", {
      feedId: null,
      includePlayed: false,
    });
  }
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/podcast/feeds/episodes?include_played=false`);
    if (!res.ok) throw new Error(`Failed to get episode queue: ${res.statusText}`);
    return res.json();
  }
  return invokeCommand<PodcastEpisode[]>("get_podcast_episodes", {
    feedId: null,
    includePlayed: false,
  });
}

/**
 * Mark an episode as played or unplayed.
 */
export async function markEpisodePlayed(
  episodeId: string,
  played: boolean = true,
): Promise<void> {
  if (isTauri()) {
    return invokeCommand<void>("mark_episode_played", { episodeId, played });
  }
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/podcast/episodes/${episodeId}/played`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ played }),
    });
    if (!res.ok) throw new Error(`Failed to mark episode: ${res.statusText}`);
    return;
  }
  return invokeCommand<void>("mark_episode_played", { episodeId, played });
}

/**
 * Update playback position for an episode.
 */
export async function updateEpisodePosition(
  episodeId: string,
  position: number,
): Promise<void> {
  if (isTauri()) {
    return invokeCommand<void>("update_episode_position", { episodeId, position });
  }
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/podcast/episodes/${episodeId}/position`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position }),
    });
    if (!res.ok) throw new Error(`Failed to update position: ${res.statusText}`);
    return;
  }
  return invokeCommand<void>("update_episode_position", { episodeId, position });
}

/**
 * Get playback position for an episode.
 */
export async function getEpisodePosition(episodeId: string): Promise<number> {
  if (isTauri()) {
    return invokeCommand<number>("get_episode_position", { episodeId });
  }
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/podcast/episodes/${episodeId}/position`);
    if (!res.ok) throw new Error(`Failed to get position: ${res.statusText}`);
    const data = await res.json();
    return data.position ?? 0;
  }
  return invokeCommand<number>("get_episode_position", { episodeId });
}

// ============================================================================
// Client-side helper functions (kept as-is)
// ============================================================================

/**
 * Preview/parse a podcast feed URL client-side (before subscribing).
 * The backend handles full parsing on subscribe, but this can be used for preview.
 */
export async function parsePodcastFeed(feedUrl: string): Promise<{
  title: string;
  description: string;
  imageUrl?: string;
  author?: string;
  feedUrl: string;
  episodeCount: number;
} | null> {
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`Failed to fetch feed: ${response.statusText}`);

    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");

    if (xmlDoc.querySelector("parsererror")) return null;
    const channel = xmlDoc.querySelector("channel");
    if (!channel) return null;

    const title = getElementText(channel, "title") || "Unknown Podcast";
    const description =
      getElementText(channel, "itunes\\:summary") ||
      getElementText(channel, "description") ||
      "";
    const imageUrl =
      getAttributeText(channel.querySelector("itunes\\:image"), "href") ||
      getElementText(channel, "itunes\\:image") ||
      getElementText(channel, "image > url") ||
      undefined;
    const author =
      getElementText(channel, "itunes\\:author") ||
      getElementText(channel, "managingEditor") ||
      undefined;

    const items = channel.querySelectorAll("item");
    const episodeCount = Array.from(items).filter(
      (item) => item.querySelector("enclosure")?.getAttribute("url")
    ).length;

    return { title, description, imageUrl, author, feedUrl, episodeCount };
  } catch (error) {
    console.error("Failed to preview podcast feed:", error);
    return null;
  }
}

/**
 * Validate podcast feed URL.
 */
export function isValidPodcastUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Discover popular podcasts (mock/curated data).
 */
export async function discoverPodcasts(): Promise<string[]> {
  return [
    "https://feeds.npr.org/510289/podcast.xml",
    "https://feeds.simplecast.com/qm_9xx0g",
    "https://feeds.feedburner.com/tedtalks_audio",
    "https://feeds.acast.com/public/shows/the-diary-of-a-ceo",
  ];
}

/**
 * Format duration in seconds to human readable string.
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  return `${minutes}m ${secs}s`;
}

// ============================================================================
// DOM helpers
// ============================================================================

function getElementText(parent: Element | null, selector: string): string | null {
  if (!parent) return null;
  const element = parent.querySelector(selector);
  return element?.textContent?.trim() || null;
}

function getAttributeText(element: Element | null, attr: string): string | null {
  return element?.getAttribute(attr) || null;
}
