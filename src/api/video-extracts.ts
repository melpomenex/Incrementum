/**
 * Video Extracts API
 *
 * Video extracts are timestamp-linked segments from videos
 * that can be scheduled for spaced repetition review.
 *
 * This API supports both Tauri (desktop) and Web/PWA environments.
 */

import { invokeCommand, isTauri } from "../lib/tauri";

// ============================================================================
// Types
// ============================================================================

/**
 * Video extract with FSRS scheduling support
 */
export interface VideoExtract {
  id: string;
  document_id: string;
  start_time: number;
  end_time: number;
  title: string;
  transcript_text?: string;
  notes?: string;
  tags: string[];
  thumbnail_url?: string;
  memory_state?: {
    stability: number;
    difficulty: number;
  };
  next_review_date?: string;
  last_review_date?: string;
  review_count: number;
  reps: number;
  date_created: string;
  date_modified: string;
  // Additional fields from server response
  document_title?: string;
}

/**
 * Input for creating a video extract
 */
export interface CreateVideoExtractInput {
  document_id: string;
  start_time: number;
  end_time: number;
  title: string;
  transcript_text?: string;
  notes?: string;
  tags?: string[];
  add_to_queue?: boolean;
}

/**
 * Input for updating a video extract
 */
export interface UpdateVideoExtractInput {
  extract_id: string;
  title?: string;
  notes?: string;
  tags?: string[];
}

/**
 * Video chapter data structure
 */
export interface VideoChapter {
  id: string;
  document_id: string;
  title: string;
  start_time: number;
  end_time: number;
  order: number;
}

/**
 * Video transcript segment
 */
export interface VideoTranscriptSegment {
  time: number;
  text: string;
}

/**
 * Video transcript data structure
 */
export interface VideoTranscript {
  document_id: string;
  transcript: string;
  segments: VideoTranscriptSegment[];
}

// ============================================================================
// API Configuration
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ============================================================================
// HTTP API Functions (for Web/PWA)
// ============================================================================

async function fetchAPI(endpoint: string, options?: RequestInit): Promise<Response> {
  const token = localStorage.getItem('auth_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
}

// ============================================================================
// Video Extract CRUD Operations
// ============================================================================

/**
 * Get all video extracts for a document
 */
export async function getVideoExtracts(documentId: string): Promise<VideoExtract[]> {
  if (isTauri()) {
    return await invokeCommand<VideoExtract[]>("get_video_extracts", { documentId });
  }

  const response = await fetchAPI(`/api/video-extracts/document/${documentId}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get video extracts');
  }
  return await response.json();
}

/**
 * Get a single video extract by ID
 */
export async function getVideoExtract(extractId: string): Promise<VideoExtract | null> {
  if (isTauri()) {
    return await invokeCommand<VideoExtract>("get_video_extract", { extractId });
  }

  const response = await fetchAPI(`/api/video-extracts/${extractId}`);
  if (!response.ok) {
    if (response.status === 404) return null;
    const error = await response.json();
    throw new Error(error.error || 'Failed to get video extract');
  }
  return await response.json();
}

/**
 * Create a new video extract
 */
export async function createVideoExtract(input: CreateVideoExtractInput): Promise<VideoExtract> {
  if (isTauri()) {
    return await invokeCommand<VideoExtract>("create_video_extract", {
      documentId: input.document_id,
      startTime: input.start_time,
      endTime: input.end_time,
      title: input.title,
      transcriptText: input.transcript_text,
      notes: input.notes,
      tags: input.tags,
      addToQueue: input.add_to_queue,
    });
  }

  const response = await fetchAPI('/api/video-extracts', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create video extract');
  }
  return await response.json();
}

/**
 * Update a video extract
 */
export async function updateVideoExtract(input: UpdateVideoExtractInput): Promise<VideoExtract> {
  if (isTauri()) {
    return await invokeCommand<VideoExtract>("update_video_extract", {
      extractId: input.extract_id,
      title: input.title,
      notes: input.notes,
      tags: input.tags,
    });
  }

  const response = await fetchAPI(`/api/video-extracts/${input.extract_id}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: input.title,
      notes: input.notes,
      tags: input.tags,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update video extract');
  }
  return await response.json();
}

/**
 * Delete a video extract
 */
export async function deleteVideoExtract(extractId: string): Promise<void> {
  if (isTauri()) {
    await invokeCommand("delete_video_extract", { extractId });
    return;
  }

  const response = await fetchAPI(`/api/video-extracts/${extractId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete video extract');
  }
}

/**
 * Rate a video extract (update FSRS scheduling)
 * Rating: 1 = Again, 2 = Hard, 3 = Good, 4 = Easy
 */
export async function rateVideoExtract(extractId: string, rating: number): Promise<string> {
  if (isTauri()) {
    return await invokeCommand<string>("rate_video_extract", { extractId, rating });
  }

  const response = await fetchAPI(`/api/video-extracts/${extractId}/rate`, {
    method: 'POST',
    body: JSON.stringify({ rating }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to rate video extract');
  }
  const result = await response.json();
  return result.message || `Next review: ${new Date(result.next_review_date).toLocaleDateString()}`;
}

// ============================================================================
// Video Chapters
// ============================================================================

/**
 * Get all chapters for a video
 */
export async function getVideoChapters(documentId: string): Promise<VideoChapter[]> {
  if (isTauri()) {
    return await invokeCommand<VideoChapter[]>("get_video_chapters", { documentId });
  }

  const response = await fetchAPI(`/api/video-extracts/document/${documentId}/chapters`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get video chapters');
  }
  return await response.json();
}

/**
 * Set chapters for a video
 */
export async function setVideoChapters(
  documentId: string,
  chapters: Omit<VideoChapter, "id" | "document_id">[]
): Promise<void> {
  if (isTauri()) {
    await invokeCommand("set_video_chapters", {
      documentId,
      chapters: chapters.map((c, i) => ({
        ...c,
        id: crypto.randomUUID(),
        document_id: documentId,
        order: i,
      })),
    });
    return;
  }

  const response = await fetchAPI(`/api/video-extracts/document/${documentId}/chapters`, {
    method: 'PUT',
    body: JSON.stringify({ chapters }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to set video chapters');
  }
}

// ============================================================================
// Video Transcript
// ============================================================================

/**
 * Get transcript for a video
 */
export async function getVideoTranscript(documentId: string): Promise<VideoTranscript | null> {
  if (isTauri()) {
    return await invokeCommand<VideoTranscript | null>("get_video_transcript", { documentId });
  }

  const response = await fetchAPI(`/api/video-extracts/document/${documentId}/transcript`);
  if (!response.ok) {
    if (response.status === 404) return null;
    const error = await response.json();
    throw new Error(error.error || 'Failed to get video transcript');
  }
  return await response.json();
}

/**
 * Set transcript for a video
 */
export async function setVideoTranscript(
  documentId: string,
  transcript: string,
  segments: VideoTranscriptSegment[]
): Promise<void> {
  if (isTauri()) {
    await invokeCommand("set_video_transcript", {
      documentId,
      transcript,
      segments,
    });
    return;
  }

  const response = await fetchAPI(`/api/video-extracts/document/${documentId}/transcript`, {
    method: 'PUT',
    body: JSON.stringify({ transcript, segments }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to set video transcript');
  }
}

/**
 * Generate transcript for a local video using Whisper (Tauri only)
 */
export async function generateVideoTranscript(
  documentId: string,
  filePath: string,
  modelId: string,
  language: string
): Promise<VideoTranscript> {
  if (!isTauri()) {
    throw new Error("Video transcription requires the desktop app");
  }

  return await invokeCommand<VideoTranscript>("generate_video_transcript", {
    documentId,
    filePath,
    modelId,
    language,
  });
}

// ============================================================================
// YouTube Chapters (Tauri only - requires yt-dlp)
// ============================================================================

/**
 * Get YouTube chapters for a video URL
 * Auto-detects chapters from video metadata or description
 * NOTE: This feature is Tauri-only as it requires yt-dlp on the backend
 */
export async function getYouTubeChapters(
  url: string,
  documentId?: string
): Promise<VideoChapter[]> {
  // YouTube chapters require yt-dlp, so this is Tauri-only
  if (isTauri()) {
    return await invokeCommand<VideoChapter[]>("get_youtube_chapters", {
      url,
      documentId,
    });
  }

  // For Web/PWA, return empty array with a console warning
  console.warn('YouTube chapter detection requires Tauri desktop app with yt-dlp');
  return [];
}

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Format seconds as MM:SS or HH:MM:SS
 */
export function formatSeconds(seconds: number): string {
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format duration in seconds to human readable string
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Get the duration of a video extract in seconds
 */
export function getExtractDuration(extract: VideoExtract): number {
  return extract.end_time - extract.start_time;
}

/**
 * Format the time range of a video extract
 */
export function formatTimeRange(extract: VideoExtract): string {
  return `${formatSeconds(extract.start_time)}-${formatSeconds(extract.end_time)}`;
}

/**
 * Get a preview of the transcript text (first 200 characters)
 */
export function getTranscriptPreview(extract: VideoExtract, maxLength: number = 200): string | null {
  if (!extract.transcript_text) return null;
  if (extract.transcript_text.length <= maxLength) {
    return extract.transcript_text;
  }
  return `${extract.transcript_text.slice(0, maxLength)}...`;
}

/**
 * Check if a video extract is valid (end_time > start_time and both are non-negative)
 */
export function isValidVideoExtract(extract: VideoExtract): boolean {
  return extract.start_time >= 0 && extract.end_time > extract.start_time;
}

/**
 * Check if the duration exceeds the recommended maximum (5 minutes = 300 seconds)
 */
export function exceedsRecommendedDuration(extract: VideoExtract): boolean {
  return getExtractDuration(extract) > 300;
}

/**
 * Check if the duration exceeds the hard maximum (10 minutes = 600 seconds)
 */
export function exceedsMaximumDuration(extract: VideoExtract): boolean {
  return getExtractDuration(extract) > 600;
}

/**
 * Rating values for FSRS
 */
export const VIDEO_RATINGS = {
  AGAIN: 1,
  HARD: 2,
  GOOD: 3,
  EASY: 4,
} as const;

export type VideoRating = (typeof VIDEO_RATINGS)[keyof typeof VIDEO_RATINGS];

/**
 * Get the label for a rating value
 */
export function getRatingLabel(rating: number): string {
  switch (rating) {
    case 1:
      return "Again";
    case 2:
      return "Hard";
    case 3:
      return "Good";
    case 4:
      return "Easy";
    default:
      return "Unknown";
  }
}

/**
 * Get the color for a rating value
 */
export function getRatingColor(rating: number): string {
  switch (rating) {
    case 1:
      return "#ef4444"; // red
    case 2:
      return "#f59e0b"; // amber
    case 3:
      return "#10b981"; // green
    case 4:
      return "#3b82f6"; // blue
    default:
      return "#6b7280"; // gray
  }
}
