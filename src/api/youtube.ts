/**
 * YouTube API integration
 * Note: This uses no-auth methods for metadata extraction
 * For full YouTube API features, API key would be required
 */

import { isTauri, isNativeMobile } from "../lib/tauri";

/**
 * YouTube video metadata
 */
export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  channel: string;
  channelId: string;
  duration: number; // in seconds
  viewCount: number;
  uploadDate: string;
  thumbnail: string;
  thumbnailHigh?: string;
  publishDate: string;
  tags: string[];
  category: string;
  liveContent: boolean;
}

/**
 * YouTube playlist info
 */
export interface YouTubePlaylist {
  id: string;
  title: string;
  description: string;
  channel: string;
  channelId: string;
  videoCount: number;
  thumbnail: string;
  videos: YouTubeVideo[];
}

/**
 * YouTube channel info
 */
export interface YouTubeChannel {
  id: string;
  name: string;
  description: string;
  subscriberCount: number;
  videoCount: number;
  thumbnail: string;
  banner?: string;
}

/**
 * YouTube search result
 */
export interface YouTubeSearchResult {
  id: string;
  title: string;
  channel: string;
  duration?: number;
  thumbnail: string;
  type: "video" | "playlist" | "channel";
}

/**
 * YouTube transcript segment
 */
export interface YouTubeTranscriptSegment {
  text: string;
  start: number; // in seconds
  duration: number; // in seconds
}

/**
 * Extract video ID from various YouTube URL formats
 */
export function extractYouTubeID(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Extract timestamp from YouTube URL (e.g., ?t=933 or ?t=15m30s)
 * Returns timestamp in seconds, or null if not present
 */
export function extractYouTubeTimestamp(url: string): number | null {
  try {
    const urlObj = new URL(url);
    const tParam = urlObj.searchParams.get('t');
    if (!tParam) return null;

    // - Pure seconds: 933
    // - HH:MM:SS or MM:SS: 1:23:45 or 15:30
    // - YouTube format: 15m30s

    // Check for YouTube format (e.g., 15m30s, 1h23m45s)
    const ytMatch = tParam.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
    if (ytMatch) {
      const hours = parseInt(ytMatch[1] || '0');
      const minutes = parseInt(ytMatch[2] || '0');
      const seconds = parseInt(ytMatch[3] || '0');
      return hours * 3600 + minutes * 60 + seconds;
    }

    if (tParam.includes(':')) {
      const parts = tParam.split(':');
      if (parts.length === 3) {
        // HH:MM:SS
        const [h, m, s] = parts.map(Number);
        return h * 3600 + m * 60 + s;
      } else if (parts.length === 2) {
        // MM:SS
        const [m, s] = parts.map(Number);
        return m * 60 + s;
      }
    }

    // Pure seconds
    const seconds = parseInt(tParam);
    if (!isNaN(seconds)) {
      return seconds;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract playlist ID from YouTube URL
 */
export function extractPlaylistID(url: string): string | null {
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Extract channel ID from YouTube URL
 */
export function extractChannelID(url: string): string | null {
  const channelMatch = url.match(/\/channel\/([a-zA-Z0-9_-]+)/);
  if (channelMatch) return channelMatch[1];

  const customMatch = url.match(/\/c\/([a-zA-Z0-9_-]+)/);
  if (customMatch) return customMatch[1];

  const handleMatch = url.match(/\/@([a-zA-Z0-9_-]+)/);
  if (handleMatch) return handleMatch[1];

  return null;
}

/**
 * Get YouTube thumbnail URL
 */
export function getYouTubeThumbnail(videoId: string, quality: "default" | "medium" | "high" | "max" = "high"): string {
  const qualities = {
    default: `https://img.youtube.com/vi/${videoId}/default.jpg`,
    medium: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    high: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    max: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
  };
  return qualities[quality];
}

/**
 * Fetch YouTube video metadata
 * Uses multiple fallback methods: oEmbed, Tauri backend, and basic extraction
 */
export async function fetchYouTubeVideoInfo(videoId: string): Promise<YouTubeVideo | null> {
  // Method 1: Try Tauri backend first if available (most reliable)
  if (isTauri()) {
    try {
      const { invokeCommand } = await import("../lib/tauri");
      const result = await invokeCommand<YouTubeVideo | null>("fetch_youtube_video_info", { videoId });
      if (result) {
        return result;
      }
    } catch (error) {
      console.error("[YouTube] Tauri backend fetch failed, trying fallbacks:", error);
    }
  }

  // Method 2: Try YouTube oEmbed API (CORS-friendly)
  try {
    const oembedResponse = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { 
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }
    );
    
    if (oembedResponse.ok) {
      const data = await oembedResponse.json();
      return {
        id: videoId,
        title: data.title || "YouTube Video",
        description: data.description || data.title || "",
        channel: data.author_name || "Unknown Channel",
        channelId: "",
        duration: 0,
        viewCount: 0,
        uploadDate: "",
        thumbnail: data.thumbnail_url || getYouTubeThumbnail(videoId),
        publishDate: "",
        tags: [],
        category: "",
        liveContent: false,
      };
    }
  } catch (error) {
    console.error("[YouTube] oEmbed fetch failed:", error);
  }

  // Method 3: Try noembed.com as fallback
  try {
    const noembedResponse = await fetch(
      `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (noembedResponse.ok) {
      const data = await noembedResponse.json();
      return {
        id: videoId,
        title: data.title || "YouTube Video",
        description: data.description || "",
        channel: data.author_name || "Unknown Channel",
        channelId: "",
        duration: 0,
        viewCount: 0,
        uploadDate: "",
        thumbnail: data.thumbnail_url || getYouTubeThumbnail(videoId),
        publishDate: "",
        tags: [],
        category: "",
        liveContent: false,
      };
    }
  } catch (error) {
    console.error("[YouTube] noembed fetch failed:", error);
  }

  // Method 4: Last resort - return basic info with known thumbnail URL
  // This allows import even when APIs fail
  console.error("[YouTube] All API methods failed, using basic fallback");
  return {
    id: videoId,
    title: "YouTube Video", // Will be updated after import
    description: "",
    channel: "Unknown Channel",
    channelId: "",
    duration: 0,
    viewCount: 0,
    uploadDate: "",
    thumbnail: getYouTubeThumbnail(videoId, "high"),
    publishDate: "",
    tags: [],
    category: "",
    liveContent: false,
  };
}

/**
 * Fetch YouTube transcript
 *
 * Desktop: Uses the backend yt-dlp via the `get_youtube_transcript_by_id` command.
 * Web / native mobile: Uses the hosted readsync.org transcript API via
 * youtubeTranscriptBrowser (yt-dlp can't run on Android/iOS).
 */
export async function fetchYouTubeTranscript(videoId: string): Promise<YouTubeTranscriptSegment[]> {
  if (isTauri() && !isNativeMobile()) {
    // Desktop: backend yt-dlp fetches the transcript.
    const { invokeCommand } = await import("../lib/tauri");
    const result = await invokeCommand<Array<{ text: string; start: number; duration: number }> | null>(
      "get_youtube_transcript_by_id",
      { videoId }
    );
    return result || [];
  }

  // Web / native mobile: yt-dlp can't run on Android/iOS, so fetch the
  // transcript from the hosted readsync.org API (same endpoint the PWA uses).
  try {
    const { fetchYouTubeTranscript: fetchFromApi } = await import("../utils/youtubeTranscriptBrowser");
    const response = await fetchFromApi(videoId);
    return response.segments.map((seg) => ({
      text: seg.text,
      start: seg.start,
      duration: seg.duration,
    }));
  } catch (error: any) {
    console.error("[YouTube] Failed to fetch transcript:", error);

    const errorMsg = error?.message || '';
    if (errorMsg.includes('disabled') || errorMsg.includes('not available')) {
      throw new Error('This video does not have captions enabled.');
    }
    if (errorMsg.includes('unavailable') || errorMsg.includes('private')) {
      throw new Error('This video is unavailable or private.');
    }

    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to fetch transcript. YouTube may be blocking the request."
    );
  }
}

/**
 * Check if YouTube transcript is available for a video
 */
export async function isTranscriptAvailable(videoId: string): Promise<boolean> {
  if (isTauri() && !isNativeMobile()) {
    // Desktop: assume transcripts might be available (the backend will fetch them).
    return true;
  }

  try {
    const { fetchYouTubeTranscript: fetchFromApi } = await import("../utils/youtubeTranscriptBrowser");
    await fetchFromApi(videoId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Search YouTube
 * Note: Full YouTube search requires API key
 * This is a placeholder for future implementation
 */
export async function searchYouTube(_query: string): Promise<YouTubeSearchResult[]> {
  console.warn(
    "YouTube search requires API key or backend service. " +
    "This will be available in the Tauri backend."
  );

  return [];
}

/**
 * Fetch YouTube playlist info
 */
export async function fetchYouTubePlaylist(_playlistId: string): Promise<YouTubePlaylist | null> {
  console.warn(
    "YouTube playlist fetching requires backend processing (yt-dlp). " +
    "This will be available in the Tauri backend."
  );

  return null;
}

/**
 * Fetch YouTube channel info
 */
export async function fetchYouTubeChannel(_channelId: string): Promise<YouTubeChannel | null> {
  console.warn(
    "YouTube channel info requires API key. " +
    "This will be available in the Tauri backend."
  );

  return null;
}

/**
 * Get YouTube watch URL
 */
export function getYouTubeWatchURL(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Get YouTube embed URL
 */
export function getYouTubeEmbedURL(videoId: string, startTime?: number): string {
  // Use YouTube's native embed URL
  const url = `https://www.youtube.com/embed/${videoId}`;
  const params = new URLSearchParams();
  
  // Add parameters for cleaner embed
  params.set('rel', '0'); // Don't show related videos
  params.set('modestbranding', '1'); // Minimal YouTube branding
  
  if (startTime) {
    params.set('start', String(Math.floor(startTime)));
  }
  
  return `${url}?${params.toString()}`;
}

/**
 * Get YouTube embed URL using privacy-enhanced mode (youtube-nocookie.com)
 * This is more likely to work in restricted environments like Tauri WebView
 */
export function getYouTubeEmbedURLNoCookie(videoId: string, startTime?: number): string {
  // Use YouTube's privacy-enhanced embed URL
  const url = `https://www.youtube-nocookie.com/embed/${videoId}`;
  const params = new URLSearchParams();
  
  // Add parameters for cleaner embed
  params.set('rel', '0'); // Don't show related videos
  params.set('modestbranding', '1'); // Minimal YouTube branding
  
  if (startTime) {
    params.set('start', String(Math.floor(startTime)));
  }
  
  return `${url}?${params.toString()}`;
}

/**
 * Parse YouTube duration (ISO 8601 format)
 */
export function parseYouTubeDuration(duration: string): number {
  // YouTube uses PT format: PT1H2M3S = 1 hour, 2 minutes, 3 seconds
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);

  if (!match) return 0;

  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Format duration for display
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format view count
 */
export function formatViewCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M views`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K views`;
  }
  return `${count} views`;
}

/**
 * Check if URL is a YouTube URL
 */
export function isYouTubeURL(url: string): boolean {
  const patterns = [
    /youtube\.com\/watch/,
    /youtu\.be\//,
    /youtube\.com\/embed\//,
    /youtube\.com\/shorts\//,
    /youtube\.com\/playlist/,
    /youtube\.com\/channel\//,
    /youtube\.com\/c\//,
    /youtube\.com\/@/,
  ];

  return patterns.some((pattern) => pattern.test(url));
}

/**
 * Get video type from URL
 */
export function getYouTubeURLType(url: string): "video" | "playlist" | "channel" | "unknown" {
  if (extractYouTubeID(url)) return "video";
  if (extractPlaylistID(url)) return "playlist";
  if (extractChannelID(url)) return "channel";
  return "unknown";
}

/**
 * YouTube API client using yt-dlp (Tauri command placeholder)
 * These will be implemented in the Rust backend
 */

/**
 * Download YouTube video using yt-dlp
 */
export async function downloadYouTubeVideo(
  _url: string,
  _quality: "best" | "1080p" | "720p" | "480p" | "audio" = "best"
): Promise<string> {
  throw new Error("Download requires Tauri backend - will be implemented in Rust");
}

/**
 * Extract YouTube video info using yt-dlp
 */
export async function extractYouTubeInfoWithYTDLP(_url: string): Promise<YouTubeVideo | null> {
  throw new Error("Extraction requires Tauri backend - will be implemented in Rust");
}

/**
 * Get available formats for a YouTube video
 */
export async function getYouTubeFormats(_videoId: string): Promise<
  Array<{
    format_id: string;
    ext: string;
    quality: string;
    filesize: number;
    vcodec: string;
    acodec: string;
  }>
> {
  // This will be a Tauri command
  throw new Error("Format listing requires Tauri backend - will be implemented in Rust");
}
