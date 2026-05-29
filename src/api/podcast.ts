/**
 * Podcast/RSS feed management — Tauri IPC + HTTP fallback
 */

import { invokeCommand, isTauri } from "../lib/tauri";

/**
 * Import a podcast episode as a document in the incremental reading system.
 */
export async function importPodcastEpisodeAsDocument(episodeId: string, collectionId?: string): Promise<any> {
  if (isTauri()) {
    return invokeCommand<any>("import_podcast_episode_as_document", { episodeId, collectionId: collectionId ?? null });
  }
  // Browser fallback not implemented for this specific command
  console.warn("[Browser] importPodcastEpisodeAsDocument: not implemented");
  return null;
}

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
  autoTranscribe: boolean;
  transcribeLanguage?: string | null;
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
  transcriptStatus: string;
  transcriptError?: string | null;
  transcribedAt?: string | null;
  transcriptText?: string | null;
}

export interface PodcastSearchResult {
  title: string;
  url: string;
  author?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  link?: string | null;
  episodeCount?: number | null;
  categories?: Record<string, string> | null;
}

/**
 * Search for podcasts by keyword via the iTunes Search API (completely keyless and highly reliable).
 */
export async function searchPodcasts(query: string): Promise<PodcastSearchResult[]> {
  if (!query.trim()) return [];

  if (isTauri()) {
    return invokeCommand<PodcastSearchResult[]>("search_podcasts", { query });
  }

  // Web / PWA mode: direct fetch to iTunes Search API (no CORS proxy needed!)
  try {
    const url = `https://itunes.apple.com/search?media=podcast&term=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const results: any[] = data.results || [];
    
    return results
      .filter((r: any) => r.feedUrl)
      .map((r: any) => ({
        title: r.collectionName,
        url: r.feedUrl,
        author: r.artistName,
        description: r.primaryGenreName || null,
        imageUrl: r.artworkUrl600 || r.artworkUrl100 || null,
        link: r.trackViewUrl || null,
        episodeCount: r.trackCount || null,
        categories: r.primaryGenreName ? { "0": r.primaryGenreName } : null,
      }));
  } catch (error) {
    console.error("Direct iTunes search failed, trying HTTP fallback...", error);
    if (shouldUseHttp()) {
      const res = await fetch(`${getApiBaseUrl()}/api/podcast/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`Search failed: ${res.statusText}`);
      return res.json();
    }
    throw error;
  }
}

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

export async function downloadEpisodeAudio(
  episodeId: string,
  audioUrl: string,
  audioType?: string,
): Promise<string> {
  if (isTauri()) {
    return invokeCommand<string>("download_podcast_episode", { episodeId, audioUrl, audioType });
  }
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/podcast/episodes/${episodeId}/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioUrl, audioType }),
    });
    if (!res.ok) throw new Error(`Failed to download: ${res.statusText}`);
    const data = await res.json();
    return data.path;
  }
  return invokeCommand<string>("download_podcast_episode", { episodeId, audioUrl, audioType });
}

export async function getDownloadedEpisodePath(
  episodeId: string,
): Promise<string | null> {
  if (isTauri()) {
    return invokeCommand<string | null>("get_downloaded_episode_path", { episodeId });
  }
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/podcast/episodes/${episodeId}/download`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.path ?? null;
  }
  return invokeCommand<string | null>("get_downloaded_episode_path", { episodeId });
}

export async function deleteDownloadedEpisode(
  episodeId: string,
): Promise<void> {
  if (isTauri()) {
    return invokeCommand<void>("delete_downloaded_episode", { episodeId });
  }
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/podcast/episodes/${episodeId}/download`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`Failed to delete download: ${res.statusText}`);
    return;
  }
  return invokeCommand<void>("delete_downloaded_episode", { episodeId });
}

/**
 * Probe a local audio file for its duration using the browser's Audio API.
 * Returns duration in seconds, or null if it can't be determined.
 */
export async function probeAudioDuration(localPath: string): Promise<number | null> {
  try {
    const { convertFileSrc } = await import("../lib/tauri");
    const url = await convertFileSrc(localPath);
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.preload = "metadata";
      const timeout = setTimeout(() => {
        audio.src = "";
        resolve(null);
      }, 5000);
      audio.addEventListener("loadedmetadata", () => {
        clearTimeout(timeout);
        const dur = audio.duration;
        audio.src = "";
        resolve(Number.isFinite(dur) && dur > 0 ? Math.round(dur) : null);
      });
      audio.addEventListener("error", () => {
        clearTimeout(timeout);
        resolve(null);
      });
      audio.src = url;
    });
  } catch {
    return null;
  }
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface PodcastTranscriptResponse {
  text: string;
  segments: TranscriptSegment[];
  status: string;
}

/**
 * Start transcription for a podcast episode.
 */
export async function transcribePodcastEpisode(
  episodeId: string,
  model?: string,
  language?: string,
  autoSegment?: boolean,
): Promise<void> {
  if (isTauri()) {
    return invokeCommand<void>("transcribe_podcast_episode", {
      episodeId,
      model,
      language,
      autoSegment: autoSegment ?? null,
    });
  }
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/podcast/episodes/${episodeId}/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model ?? null,
        language: language ?? null,
        auto_segment: autoSegment ?? null,
      }),
    });
    if (!res.ok) throw new Error(`Failed to start transcription: ${res.statusText}`);
    return;
  }
  // browser: no-op
  console.warn("[Browser] transcribePodcastEpisode: no-op in browser fallback mode");
}

/**
 * Get transcript for a podcast episode.
 */
export async function getPodcastTranscript(
  episodeId: string,
): Promise<PodcastTranscriptResponse> {
  if (isTauri()) {
    return invokeCommand<PodcastTranscriptResponse>("get_podcast_transcript", { episodeId });
  }
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/podcast/episodes/${episodeId}/transcript`);
    if (!res.ok) throw new Error(`Failed to get transcript: ${res.statusText}`);
    return res.json();
  }
  throw new Error("Transcripts not available in browser fallback mode");
}

/**
 * Cancel an in-progress transcription.
 */
export async function cancelPodcastTranscription(episodeId: string): Promise<void> {
  if (isTauri()) {
    return invokeCommand<void>("cancel_podcast_transcription", { episodeId });
  }
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/podcast/episodes/${episodeId}/cancel-transcription`, {
      method: "POST",
    });
    if (!res.ok) throw new Error(`Failed to cancel transcription: ${res.statusText}`);
    return;
  }
  console.warn("[Browser] cancelPodcastTranscription: no-op in browser fallback mode");
}

/**
 * Set auto-transcribe for a feed.
 */
export async function setFeedAutoTranscribe(
  feedId: string,
  enabled: boolean,
  language?: string,
): Promise<void> {
  if (isTauri()) {
    return invokeCommand<void>("set_feed_auto_transcribe", { feedId, enabled, language });
  }
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/podcast/feeds/${feedId}/auto-transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, language: language ?? null }),
    });
    if (!res.ok) throw new Error(`Failed to set auto-transcribe: ${res.statusText}`);
    return;
  }
  console.warn("[Browser] setFeedAutoTranscribe: no-op in browser fallback mode");
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
