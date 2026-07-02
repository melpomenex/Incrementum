/**
 * Podcast/RSS feed management — Tauri IPC + HTTP fallback
 */

import { invokeCommand, isTauri } from "../lib/tauri";
import type { TranscriptSegment as SyncTranscriptSegment } from "../components/media/TranscriptSync";

/**
 * Import a podcast episode as a document in the incremental reading system.
 */

/**
 * Load an episode's full row in the sync wire shape (camelCase), for the
 * podcast replication publish hooks. Returns null if the episode isn't local
 * (the field-LWW merge handles absence). Uses the dedicated sync read command
 * so we don't depend on a store being warm.
 */
async function loadEpisodeForSync(
  episodeId: string,
): Promise<import("../lib/sync/entities/podcasts").SyncedPodcastEpisode | null> {
  try {
    return await invokeCommand<import("../lib/sync/entities/podcasts").SyncedPodcastEpisode | null>(
      "get_synced_podcast_episode",
      { id: episodeId },
    );
  } catch {
    return null;
  }
}

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
  feedId: string | null,
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
    const url = feedId
      ? `${getApiBaseUrl()}/api/podcast/feeds/${feedId}/episodes?${params}`
      : `${getApiBaseUrl()}/api/podcast/feeds/episodes?${params}`;
    const res = await fetch(url);
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
    await invokeCommand<void>("mark_episode_played", { episodeId, played });
    // Replicate the played change. Fire-and-forget so playback UX never waits
    // on sync; field-LWW (played_at/unplayed_at) resolves concurrent toggles.
    void (async () => {
      try {
        const { publishEpisodePlayed } = await import("../lib/sync/entities/podcasts");
        const row = await loadEpisodeForSync(episodeId);
        if (row) await publishEpisodePlayed({ row, played });
      } catch (err) {
        console.warn("[podcast] sync publish played failed (non-fatal)", err);
      }
    })();
    return;
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
 * Update playback position for an episode. Position is high-churn (the audio
 * element's `timeupdate` fires ~4×/sec), so the sync publish is debounced
 * per-episode (1.5s) to keep the shared CRDT doc small.
 */
export async function updateEpisodePosition(
  episodeId: string,
  position: number,
): Promise<void> {
  if (isTauri()) {
    await invokeCommand<void>("update_episode_position", { episodeId, position });
    // Debounced publish — coalesces a burst of position ticks into one wire write.
    void (async () => {
      try {
        const { publishEpisodePositionDebounced } = await import("../lib/sync/entities/podcasts");
        publishEpisodePositionDebounced(episodeId, async () => {
          const row = await loadEpisodeForSync(episodeId);
          if (!row) throw new Error("episode not found");
          return { ...row, playbackPosition: position };
        });
      } catch (err) {
        console.warn("[podcast] sync publish position failed (non-fatal)", err);
      }
    })();
    return;
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

export interface WordTiming {
  word: string;
  start_ms: number;
  end_ms: number;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  /** Per-word timings for karaoke-style highlighting (Groq word-level transcription). */
  wordTimings?: WordTiming[];
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
 * Map a Groq verbose_json transcription response (segments + words in SECONDS)
 * into our per-segment DB shape (start_ms/end_ms in ms) with per-word timings
 * attached to each segment. Each Groq word is assigned to the segment whose
 * [start, end] span contains the word's midpoint, using a single forward pass
 * (both lists are sorted by time). Exported so the timing assignment logic can
 * be unit-tested in isolation.
 */
export function mapGroqResponseToSegments(
  response: GroqResponseLike,
): SaveSegmentInput[] {
  const words = response.words ?? [];
  let wordCursor = 0;
  return (response.segments ?? []).map((seg) => {
    const startMs = Math.round(seg.start * 1000);
    const endMs = Math.round(seg.end * 1000);
    // Collect words whose midpoint falls within [start, end] of this segment.
    const segWords: { word: string; start_ms: number; end_ms: number }[] = [];
    while (wordCursor < words.length) {
      const w = words[wordCursor];
      const wMid = (w.start + w.end) / 2;
      if (wMid < seg.start) { wordCursor++; continue; }
      if (wMid >= seg.end) { break; }
      segWords.push({ word: w.word, start_ms: Math.round(w.start * 1000), end_ms: Math.round(w.end * 1000) });
      wordCursor++;
    }
    return {
      start_ms: startMs,
      end_ms: endMs,
      text: seg.text.trim(),
      word_timings_json: segWords.length > 0 ? JSON.stringify(segWords) : null,
    };
  });
}

/** Minimal shape of a Groq verbose_json response (for the mapping logic). */
export interface GroqResponseLike {
  segments?: Array<{ start: number; end: number; text: string }>;
  words?: Array<{ word: string; start: number; end: number }>;
}

/**
 * Transcribe a podcast episode via Groq cloud transcription (word-level
 * timestamps). This is the mobile/Android path: Groq fetches the remote audio
 * URL directly, so no FFmpeg/sidecar is needed (the local Whisper/sherpa sidecar
 * approach does not work on Android). Produces real per-segment AND per-word
 * timings, persists them via save_podcast_transcript_segments, and resolves when
 * the transcript is stored. Emits the same progress events the local path uses
 * (podcast://transcription-progress / -complete / -error) so the UI is shared.
 */
export async function transcribePodcastEpisodeWithGroq(
  episodeId: string,
  audioUrl: string,
  language?: string,
): Promise<void> {
  // Dynamic import to avoid pulling groq deps into non-podcast bundles eagerly.
  const { transcribeWithGroq } = await import("./groqTranscription");
  const { emit } = await import("@tauri-apps/api/event");
  await emit("podcast://transcription-progress", { episodeId, status: "processing", progress: 10, message: "Transcribing via Groq…" });

  // Read the Groq key + model from the persisted settings (the Rust command
  // needs them passed explicitly — it runs server-side and can't read the JS store).
  const { apiKey, model } = (() => {
    try {
      const raw = localStorage.getItem("incrementum-settings");
      const parsed = raw ? JSON.parse(raw) : null;
      const g = parsed?.state?.settings?.audioTranscription?.groq;
      return { apiKey: g?.apiKey || "", model: g?.model || "whisper-large-v3-turbo" };
    } catch { return { apiKey: "", model: "whisper-large-v3-turbo" }; }
  })();
  if (!apiKey) {
    await emit("podcast://transcription-error", { episodeId, error: "Groq API key not configured." });
    throw new Error("Groq API key not configured.");
  }

  try {
    // Resolve the redirect chain to the final media URL first. Many podcast
    // audio URLs are wrapped in tracking-redirect chains (podtrac → ... → CDN)
    // that Groq does NOT follow (it fails with "received status code: 302").
    let resolvedUrl = audioUrl;
    try {
      resolvedUrl = await resolvePodcastAudioUrl(audioUrl);
    } catch (e) {
      console.warn("[podcast] resolvePodcastAudioUrl failed, using original URL:", e);
    }

    // Transcribe entirely on the Rust side: download → split into <25MB chunks
    // (ffmpeg-free) → upload each chunk to Groq with word-level timestamps →
    // combine offsets. Doing this in Rust avoids transferring multi-megabyte
    // chunk bytes over the Tauri IPC as JSON (which hung the previous
    // frontend-driven path). Progress events are emitted from Rust.
    const segments = await invokeCommand<Array<{
      start_ms: number;
      end_ms: number;
      text: string;
      word_timings_json: string | null;
    }>>("transcribe_podcast_groq_chunks", {
      episodeId,
      audioUrl: resolvedUrl,
      language: language ?? null,
      groqApiKey: apiKey,
      groqModel: model,
    });

    if (segments.length === 0) {
      throw new Error("Groq returned no transcript segments.");
    }

    // Persist the combined segments + word timings to the DB.
    await emit("podcast://transcription-progress", { episodeId, status: "processing", progress: 90, message: "Saving transcript…" });
    await savePodcastTranscriptSegments(episodeId, segments);

    await emit("podcast://transcription-complete", { episodeId, segmentCount: segments.length, duration: null });
    return;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await emit("podcast://transcription-error", { episodeId, error: message });
    throw err;
  }
}

/**
 * Probe the Content-Length of an audio URL via a Range request (follows the
 * resolved redirect). Returns null when the server doesn't report a length
 * (caller then assumes large → chunk). This is the size gate that decides
 * whether to use a single Groq request or chunked transcription.
 */
async function probeAudioSize(resolvedUrl: string): Promise<number | null> {
  try {
    const resp = await fetch(resolvedUrl, { method: "GET", headers: { Range: "bytes=0-0" } });
    // Content-Range: bytes 0-0/12345  → total is after the slash.
    const cr = resp.headers.get("content-range");
    if (cr) {
      const m = /\/(\d+)/.exec(cr);
      if (m) return parseInt(m[1], 10);
    }
    const cl = resp.headers.get("content-length");
    if (cl) return parseInt(cl, 10);
    return null;
  } catch {
    return null;
  }
}

/**
 * Transcribe a large podcast episode by splitting it on-device (ffmpeg-free
 * Rust chunker) and uploading each <25 MB chunk to Groq with word-level
 * timestamps, then combining the per-chunk segments (adjusting each segment's
 * timestamps by the chunk's start_ms offset) and persisting the result.
 * Emits per-chunk progress (15% → 85%). Returns the total segment count.
 */
async function transcribeEpisodeChunked(
  episodeId: string,
  resolvedUrl: string,
  language: string | undefined,
  emit: (event: string, payload: unknown) => Promise<void>,
): Promise<number> {
  // Read the Groq key + model from the persisted settings (getGroqApiKey isn't
  // exported, and we're in a dynamic-import context anyway).
  const { apiKey, model } = (() => {
    try {
      const raw = localStorage.getItem("incrementum-settings");
      const parsed = raw ? JSON.parse(raw) : null;
      const g = parsed?.state?.settings?.audioTranscription?.groq;
      return { apiKey: g?.apiKey || "", model: g?.model || "whisper-large-v3-turbo" };
    } catch { return { apiKey: "", model: "whisper-large-v3-turbo" }; }
  })();
  if (!apiKey) throw new Error("Groq API key not configured.");

  // 1. Split on-device into <25 MB chunks.
  await emit("podcast://transcription-progress", { episodeId, status: "processing", progress: 15, message: "Splitting audio…" });
  const chunks = await invokeCommand<Array<{ index: number; path: string; start_ms: number; end_ms: number; bytes: number }>>(
    "split_audio_for_groq_mobile", { url: resolvedUrl }
  );
  if (!chunks || chunks.length === 0) {
    throw new Error("Audio splitting produced no chunks.");
  }

  const combinedSegments: SaveSegmentInput[] = [];

  // 2. Transcribe each chunk with word-level timestamps.
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const progress = 20 + Math.round((i / chunks.length) * 65);
    await emit("podcast://transcription-progress", { episodeId, status: "processing", progress, message: `Transcribing chunk ${i + 1}/${chunks.length}…` });

    // Read chunk bytes → Blob → upload to Groq.
    const bytes = await invokeCommand<number[]>("read_file_bytes", { filePath: chunk.path, file_path: chunk.path });
    const blob = new Blob([new Uint8Array(bytes)], { type: "audio/mp3" });
    const form = new FormData();
    form.append("file", blob, "chunk.mp3");
    form.append("model", model);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "segment");
    form.append("timestamp_granularities[]", "word");
    if (language) form.append("language", language);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);
    let resp: Response;
    try {
      resp = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form, signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timeoutId);
      throw new Error(`Chunk ${i + 1} upload failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    clearTimeout(timeoutId);
    if (!resp.ok) {
      const e = await resp.json().catch(() => ({}));
      throw new Error(`Chunk ${i + 1} failed (HTTP ${resp.status}): ${e?.error?.message || resp.statusText}`);
    }
    const data = await resp.json();

    // Map this chunk's segments, adding the chunk's start_ms offset to every
    // segment + word timestamp so the combined transcript is continuous.
    const chunkWords = data.words || [];
    let wc = 0;
    const chunkSegs: SaveSegmentInput[] = (data.segments || []).map((seg: { start: number; end: number; text: string }) => {
      const segWords: { word: string; start_ms: number; end_ms: number }[] = [];
      while (wc < chunkWords.length) {
        const w = chunkWords[wc];
        const mid = (w.start + w.end) / 2;
        if (mid < seg.start) { wc++; continue; }
        if (mid >= seg.end) break;
        segWords.push({ word: w.word, start_ms: chunk.start_ms + Math.round(w.start * 1000), end_ms: chunk.start_ms + Math.round(w.end * 1000) });
        wc++;
      }
      return {
        start_ms: chunk.start_ms + Math.round(seg.start * 1000),
        end_ms: chunk.start_ms + Math.round(seg.end * 1000),
        text: seg.text.trim(),
        word_timings_json: segWords.length ? JSON.stringify(segWords) : null,
      };
    });
    combinedSegments.push(...chunkSegs);

    // Small delay to respect Groq rate limits between chunks.
    if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 1000));
  }

  // 3. Clean up temp chunk files.
  try { await invokeCommand("cleanup_mobile_audio_chunks", {}); } catch { /* non-fatal */ }

  if (combinedSegments.length === 0) {
    throw new Error("Groq returned no transcript segments across all chunks.");
  }

  // 4. Persist the combined segments.
  await emit("podcast://transcription-progress", { episodeId, status: "processing", progress: 88, message: "Saving transcript…" });
  await savePodcastTranscriptSegments(episodeId, combinedSegments);

  return combinedSegments.length;
}

/** Segment payload for the save_podcast_transcript_segments command. */
export interface SaveSegmentInput {
  start_ms: number;
  end_ms: number;
  text: string;
  word_timings_json: string | null;
}

/**
 * Resolve a podcast audio URL through its redirect chain to the final media URL.
 * Many podcast feeds wrap the real audio in tracking-redirect chains (podtrac →
 * pdst → chrt → mgln → megaphone, etc.) that Groq's transcription API does not
 * follow. Done in Rust (reqwest follows up to 10 redirects).
 */
export async function resolvePodcastAudioUrl(url: string): Promise<string> {
  if (isTauri()) {
    return invokeCommand<string>("resolve_podcast_audio_url", { url });
  }
  return url;
}

/**
 * Persist per-segment (and optional per-word) podcast transcript timings to the
 * DB. Also stores the concatenated full text on the episode row (back-compat /
 * search). Used by the Groq transcription path (transcribePodcastEpisodeWithGroq)
 * and available for any other frontend-driven transcription source.
 */
export async function savePodcastTranscriptSegments(
  episodeId: string,
  segments: SaveSegmentInput[],
): Promise<void> {
  if (isTauri()) {
    return invokeCommand<void>("save_podcast_transcript_segments", { episodeId, segments });
  }
  console.warn("[Browser] savePodcastTranscriptSegments: no-op in browser fallback mode");
}

/**
 * Save a podcast transcript from the frontend.
 */
export async function savePodcastTranscript(
  episodeId: string,
  status: string,
  error?: string,
  transcript?: string,
): Promise<void> {
  if (isTauri()) {
    return invokeCommand<void>("save_podcast_transcript", {
      episodeId,
      status,
      error: error ?? null,
      transcript: transcript ?? null,
    });
  }
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/podcast/episodes/${episodeId}/transcript`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        error: error ?? null,
        transcript: transcript ?? null,
      }),
    });
    if (!res.ok) throw new Error(`Failed to save transcript: ${res.statusText}`);
    return;
  }
  throw new Error("Transcripts not available in browser fallback mode");
}

/**
 * Get transcript for a podcast episode.
 */
export async function getPodcastTranscript(
  episodeId: string,
): Promise<PodcastTranscriptResponse> {
  if (isTauri()) {
    const raw = await invokeCommand<RawPodcastTranscriptResponse>("get_podcast_transcript", { episodeId });
    // Normalize the backend shape (start_ms/end_ms/word_timings_json) into the
    // frontend shape (start/end in seconds + parsed wordTimings). Tauri's serde
    // serialization leaves snake_case field names as-is, so map explicitly here.
    return {
      text: raw.text,
      status: raw.status,
      segments: (raw.segments ?? []).map((s) => {
        let wordTimings: WordTiming[] | undefined;
        if (s.word_timings_json) {
          try {
            const parsed = JSON.parse(s.word_timings_json) as Array<{ word: string; start_ms: number; end_ms: number }>;
            if (Array.isArray(parsed) && parsed.length > 0) {
              wordTimings = parsed.map((w) => ({
                word: w.word,
                start_ms: w.start_ms,
                end_ms: w.end_ms,
              }));
            }
          } catch { /* malformed JSON — ignore, fall back to segment-level */ }
        }
        return {
          start: s.start_ms / 1000,
          end: s.end_ms / 1000,
          text: s.text,
          wordTimings,
        };
      }),
    };
  }
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/podcast/episodes/${episodeId}/transcript`);
    if (!res.ok) throw new Error(`Failed to get transcript: ${res.statusText}`);
    return res.json();
  }
  throw new Error("Transcripts not available in browser fallback mode");
}

/** Raw backend shape (ms + snake_case) before normalization. */
interface RawPodcastTranscriptResponse {
  text: string;
  status: string;
  segments: Array<{
    start_ms: number;
    end_ms: number;
    text: string;
    word_timings_json?: string | null;
  }>;
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

/**
 * Split a single-blob podcast transcript into timestamped segments that
 * `TranscriptSync` can render and search.
 *
 * The backend (`get_podcast_transcript`) stores the whole transcript as one
 * string; real Whisper timestamps are a future enhancement. We sentence-split
 * here (mirroring the previous overlay's split logic) and distribute start/end
 * proportionally across the episode duration. When duration is unknown we fall
 * back to evenly spaced points (timestamps are hidden in the viewer either way).
 */
export function splitTranscriptIntoSegments(
  text: string,
  durationSec?: number,
): SyncTranscriptSegment[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const sentences = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length === 0) return [];

  const total = durationSec && durationSec > 0 ? durationSec : sentences.length;
  const step = total / sentences.length;

  return sentences.map((sentence, i) => ({
    id: `podcast-seg-${i}`,
    start: i * step,
    end: (i + 1) * step,
    text: sentence,
  }));
}
