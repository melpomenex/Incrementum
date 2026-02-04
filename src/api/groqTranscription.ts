/**
 * Groq Transcription API
 * 
 * Provides fast cloud-based transcription using Groq's Whisper API.
 * Supports both local files and URLs (for podcasts).
 * 
 * Free Tier Limits (as of 2024):
 * - 20 RPM (requests per minute)
 * - 2,000 RPD (requests per day)
 * - 7,200 audio seconds per minute (~2 hours/minute)
 * - 28,800 audio seconds per day (~8 hours/day)
 * - 25 MB max file size per request
 * 
 * For files larger than 25MB, this module automatically splits them into chunks
 * using ffmpeg, transcribes each chunk, and combines the results.
 * 
 * @see https://console.groq.com/docs/speech-to-text
 */

import { invokeCommand } from '../lib/tauri';
import { isTauri } from '../lib/tauri';
import { useSettingsStore } from '../stores/settingsStore';
import type { GroqTranscriptionSettings } from '../types/settings';

const GROQ_API_BASE = 'https://api.groq.com/openai/v1';

// Free tier limits
export const GROQ_FREE_TIER = {
  REQUESTS_PER_MINUTE: 20,
  REQUESTS_PER_DAY: 2000,
  AUDIO_SECONDS_PER_MINUTE: 7200,
  AUDIO_SECONDS_PER_DAY: 28800,
  MAX_FILE_SIZE_MB: 25,
  MAX_CHUNK_SIZE_MB: 20, // Keep under 25MB with safety margin
} as const;

// Cost per hour (for reference)
export const GROQ_PRICING = {
  'whisper-large-v3': 0.111, // $0.111 per hour
  'whisper-large-v3-turbo': 0.04, // $0.04 per hour
} as const;

export interface GroqTranscriptionOptions {
  file?: File | Blob;
  filePath?: string; // For Tauri file system
  url?: string;
  language?: string;
  prompt?: string;
  responseFormat?: 'json' | 'verbose_json' | 'text';
  timestampGranularities?: ('segment' | 'word')[];
  temperature?: number;
  onProgress?: (progress: number) => void;
}

export interface GroqTranscriptionSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

export interface GroqTranscriptionResponse {
  text: string;
  task?: string;
  language?: string;
  duration?: number;
  segments?: GroqTranscriptionSegment[];
  words?: Array<{
    word: string;
    start: number;
    end: number;
  }>;
}

export interface AudioChunk {
  index: number;
  path: string;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface GroqRateLimitInfo {
  limitRequests: number;
  limitTokens: number;
  remainingRequests: number;
  remainingTokens: number;
  resetRequests: string;
  resetTokens: string;
}

export interface UsageStats {
  audioSecondsProcessed: number;
  requestsMade: number;
  estimatedCost: number;
  remainingDailySeconds: number;
  remainingDailyRequests: number;
}

/**
 * Get the Groq API key from settings
 */
function getGroqApiKey(): string {
  const state = useSettingsStore.getState();
  return state.settings.audioTranscription.groq.apiKey;
}

/**
 * Get the Groq model from settings
 */
function getGroqModel(): 'whisper-large-v3' | 'whisper-large-v3-turbo' {
  const state = useSettingsStore.getState();
  return state.settings.audioTranscription.groq.model;
}

/**
 * Update usage statistics in settings
 */
function updateUsageStats(audioSeconds: number): void {
  const state = useSettingsStore.getState();
  const { groq } = state.settings.audioTranscription;
  
  const now = new Date();
  const lastReset = new Date(groq.usage.lastResetDate);
  
  // Reset if it's a new day
  if (now.getDate() !== lastReset.getDate() || now.getMonth() !== lastReset.getMonth()) {
    state.updateSettings({
      audioTranscription: {
        ...state.settings.audioTranscription,
        groq: {
          ...groq,
          usage: {
            lastResetDate: now.toISOString(),
            audioSecondsProcessed: audioSeconds,
            requestsMade: 1,
          },
        },
      },
    });
  } else {
    state.updateSettings({
      audioTranscription: {
        ...state.settings.audioTranscription,
        groq: {
          ...groq,
          usage: {
            ...groq.usage,
            audioSecondsProcessed: groq.usage.audioSecondsProcessed + audioSeconds,
            requestsMade: groq.usage.requestsMade + 1,
          },
        },
      },
    });
  }
}

/**
 * Check if the file size is within Groq's limits
 */
export function isFileSizeValid(file: File | Blob): boolean {
  return file.size <= GROQ_FREE_TIER.MAX_FILE_SIZE_MB * 1024 * 1024;
}

/**
 * Check if file needs chunking
 */
export function needsChunking(file: File | Blob): boolean {
  return file.size > GROQ_FREE_TIER.MAX_CHUNK_SIZE_MB * 1024 * 1024;
}

/**
 * Get estimated audio duration from file (if possible)
 * This is a rough estimate - actual duration comes from the API response
 */
export function estimateAudioDuration(file: File): number {
  // Rough estimates based on file size and typical bitrates
  const bytesPerSecond: Record<string, number> = {
    'audio/mpeg': 16000, // ~128 kbps MP3
    'audio/mp3': 16000,
    'audio/wav': 176400, // 16-bit 44.1kHz stereo
    'audio/x-wav': 176400,
    'audio/flac': 80000, // ~700 kbps FLAC
    'audio/ogg': 12000, // ~96 kbps OGG
    'audio/opus': 12000,
    'audio/aac': 16000,
    'audio/mp4': 16000,
    'audio/x-m4a': 16000,
    'video/mp4': 500000, // ~4 Mbps video (varies greatly)
    'video/webm': 300000,
    'video/ogg': 400000,
  };
  
  const bitrate = bytesPerSecond[file.type] || 16000;
  return Math.ceil(file.size / bitrate);
}

/**
 * Get current usage statistics
 */
export function getUsageStats(): UsageStats {
  const state = useSettingsStore.getState();
  const { groq } = state.settings.audioTranscription;
  const model = groq.model;
  
  // Check if we need to reset
  const now = new Date();
  const lastReset = new Date(groq.usage.lastResetDate);
  let audioSeconds = groq.usage.audioSecondsProcessed;
  let requests = groq.usage.requestsMade;
  
  if (now.getDate() !== lastReset.getDate() || now.getMonth() !== lastReset.getMonth()) {
    audioSeconds = 0;
    requests = 0;
  }
  
  const hoursProcessed = audioSeconds / 3600;
  const estimatedCost = hoursProcessed * GROQ_PRICING[model];
  
  return {
    audioSecondsProcessed: audioSeconds,
    requestsMade: requests,
    estimatedCost,
    remainingDailySeconds: Math.max(0, GROQ_FREE_TIER.AUDIO_SECONDS_PER_DAY - audioSeconds),
    remainingDailyRequests: Math.max(0, GROQ_FREE_TIER.REQUESTS_PER_DAY - requests),
  };
}

/**
 * Check if we're approaching rate limits
 */
export function getRateLimitStatus(): {
  isLimited: boolean;
  isWarning: boolean;
  message: string;
  details: {
    requestsRemaining: number;
    audioSecondsRemaining: number;
  };
} {
  const stats = getUsageStats();
  
  const requestsRemaining = stats.remainingDailyRequests;
  const audioSecondsRemaining = stats.remainingDailySeconds;
  
  // Less than 10% remaining = limited
  const isLimited = requestsRemaining < 10 || audioSecondsRemaining < 3600;
  
  // Less than 25% remaining = warning
  const isWarning = requestsRemaining < 500 || audioSecondsRemaining < 7200;
  
  let message = '';
  if (isLimited) {
    message = `Approaching Groq free tier limits. ${requestsRemaining} requests and ${Math.floor(audioSecondsRemaining / 60)} minutes of audio remaining today.`;
  } else if (isWarning) {
    message = `You're using Groq's free tier. ${Math.floor(requestsRemaining / 10)}% requests and ${Math.floor(audioSecondsRemaining / 3600)} hours of audio remaining today.`;
  }
  
  return {
    isLimited,
    isWarning,
    message,
    details: {
      requestsRemaining,
      audioSecondsRemaining,
    },
  };
}

/**
 * Transcribe a single audio chunk
 */
async function transcribeChunk(
  chunkPath: string,
  language?: string,
  prompt?: string
): Promise<GroqTranscriptionResponse> {
  const apiKey = getGroqApiKey();
  
  if (!apiKey) {
    throw new GroqTranscriptionError(
      'Groq API key not configured. Please add your API key in Audio Transcription settings.',
      'MISSING_API_KEY'
    );
  }
  
  const model = getGroqModel();
  
  // Read the chunk file
  const bytes = await invokeCommand<number[]>('read_file_bytes', { filePath: chunkPath });
  const blob = new Blob([new Uint8Array(bytes)], { type: 'audio/mp3' });
  
  const formData = new FormData();
  formData.append('file', blob, 'chunk.mp3');
  formData.append('model', model);
  
  if (language) {
    formData.append('language', language);
  }
  if (prompt) {
    formData.append('prompt', prompt);
  }
  
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'segment');
  formData.append('temperature', '0');
  
  const response = await fetch(`${GROQ_API_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      throw new GroqTranscriptionError(
        `Rate limit exceeded. ${retryAfter ? `Retry after ${retryAfter} seconds.` : 'Please try again later.'}`,
        'RATE_LIMITED',
        { status: 429, retryAfter: retryAfter ? parseInt(retryAfter) : undefined }
      );
    }
    
    if (response.status === 401) {
      throw new GroqTranscriptionError(
        'Invalid API key. Please check your Groq API key in settings.',
        'INVALID_API_KEY',
        { status: 401 }
      );
    }
    
    throw new GroqTranscriptionError(
      errorData.error?.message || `Transcription failed: ${response.statusText}`,
      'API_ERROR',
      { status: response.status, response: errorData }
    );
  }
  
  const result: GroqTranscriptionResponse = await response.json();
  
  // Update usage stats
  if (result.duration) {
    updateUsageStats(result.duration);
  }
  
  return result;
}

/**
 * Transcribe audio using Groq API
 * 
 * Supports:
 * - Local files (File or Blob)
 * - URLs (for podcasts)
 * - Large files via automatic chunking
 * 
 * For files larger than 25MB, the file is automatically split into chunks,
 * each chunk is transcribed, and results are combined with adjusted timestamps.
 */
export async function transcribeWithGroq(
  options: GroqTranscriptionOptions
): Promise<GroqTranscriptionResponse> {
  // Check rate limits before making request
  const rateLimitStatus = getRateLimitStatus();
  if (rateLimitStatus.isLimited) {
    throw new GroqTranscriptionError(
      `Groq free tier limit reached: ${rateLimitStatus.message}. Please wait until tomorrow or upgrade your Groq plan.`,
      'RATE_LIMITED',
      { status: 429 }
    );
  }
  
  // Handle URL transcription (no chunking needed, Groq fetches from URL)
  if (options.url) {
    return transcribeUrl(options);
  }
  
  // Handle file transcription
  if (options.file && options.filePath) {
    throw new GroqTranscriptionError(
      'Cannot provide both file and filePath. Use one or the other.',
      'INVALID_INPUT'
    );
  }
  
  if (options.file) {
    // Browser environment - check if chunking needed
    if (needsChunking(options.file)) {
      throw new GroqTranscriptionError(
        'File too large for browser upload. Please use the desktop app for files larger than 25MB.',
        'FILE_TOO_LARGE'
      );
    }
    return transcribeSingleFile(options.file, options);
  }
  
  if (options.filePath) {
    // Tauri environment - can use chunking
    return transcribeWithChunking(options.filePath, options);
  }
  
  throw new GroqTranscriptionError(
    'Either file, filePath, or url must be provided',
    'INVALID_INPUT'
  );
}

/**
 * Transcribe a URL (no chunking needed)
 */
async function transcribeUrl(options: GroqTranscriptionOptions): Promise<GroqTranscriptionResponse> {
  const apiKey = getGroqApiKey();
  
  if (!apiKey) {
    throw new GroqTranscriptionError(
      'Groq API key not configured.',
      'MISSING_API_KEY'
    );
  }
  
  const model = getGroqModel();
  const formData = new FormData();
  
  formData.append('url', options.url!);
  formData.append('model', model);
  
  if (options.language) {
    formData.append('language', options.language);
  }
  if (options.prompt) {
    formData.append('prompt', options.prompt);
  }
  if (options.responseFormat) {
    formData.append('response_format', options.responseFormat);
  }
  if (options.temperature !== undefined) {
    formData.append('temperature', options.temperature.toString());
  }
  if (options.timestampGranularities) {
    options.timestampGranularities.forEach(granularity => {
      formData.append('timestamp_granularities[]', granularity);
    });
  }
  
  const response = await fetch(`${GROQ_API_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new GroqTranscriptionError(
      errorData.error?.message || `Transcription failed: ${response.statusText}`,
      'API_ERROR',
      { status: response.status, response: errorData }
    );
  }
  
  const result: GroqTranscriptionResponse = await response.json();
  
  if (result.duration) {
    updateUsageStats(result.duration);
  }
  
  return result;
}

/**
 * Transcribe a single small file (no chunking)
 */
async function transcribeSingleFile(
  file: File | Blob,
  options: GroqTranscriptionOptions
): Promise<GroqTranscriptionResponse> {
  const apiKey = getGroqApiKey();
  
  if (!apiKey) {
    throw new GroqTranscriptionError(
      'Groq API key not configured.',
      'MISSING_API_KEY'
    );
  }
  
  const model = getGroqModel();
  const formData = new FormData();
  
  formData.append('file', file);
  formData.append('model', model);
  
  if (options.language) {
    formData.append('language', options.language);
  }
  if (options.prompt) {
    formData.append('prompt', options.prompt);
  }
  if (options.responseFormat) {
    formData.append('response_format', options.responseFormat);
  }
  if (options.temperature !== undefined) {
    formData.append('temperature', options.temperature.toString());
  }
  if (options.timestampGranularities) {
    options.timestampGranularities.forEach(granularity => {
      formData.append('timestamp_granularities[]', granularity);
    });
  }
  
  const response = await fetch(`${GROQ_API_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new GroqTranscriptionError(
      errorData.error?.message || `Transcription failed: ${response.statusText}`,
      'API_ERROR',
      { status: response.status, response: errorData }
    );
  }
  
  const result: GroqTranscriptionResponse = await response.json();
  
  if (result.duration) {
    updateUsageStats(result.duration);
  }
  
  return result;
}

/**
 * Transcribe a large file using chunking
 */
async function transcribeWithChunking(
  filePath: string,
  options: GroqTranscriptionOptions
): Promise<GroqTranscriptionResponse> {
  if (!isTauri()) {
    throw new GroqTranscriptionError(
      'File chunking requires the desktop app.',
      'NOT_SUPPORTED'
    );
  }
  
  // Split audio into chunks
  const chunks: AudioChunk[] = await invokeCommand('split_audio_for_groq', {
    filePath,
    maxChunkDurationSeconds: 480, // 8 minutes per chunk
  });
  
  if (chunks.length === 0) {
    throw new GroqTranscriptionError(
      'Failed to split audio into chunks.',
      'CHUNKING_FAILED'
    );
  }
  
  if (chunks.length === 1) {
    // Only one chunk, transcribe it directly
    const result = await transcribeChunk(chunks[0].path, options.language, options.prompt);
    
    // Clean up
    await invokeCommand('cleanup_audio_chunks').catch(() => {});
    
    return result;
  }
  
  // Multiple chunks - transcribe each and combine
  const allSegments: GroqTranscriptionSegment[] = [];
  let fullText: string[] = [];
  let detectedLanguage: string | undefined;
  let totalDuration = 0;
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    // Report progress
    if (options.onProgress) {
      options.onProgress(Math.round((i / chunks.length) * 100));
    }
    
    // Add delay between requests to respect rate limits
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    }
    
    try {
      const result = await transcribeChunk(chunk.path, options.language, options.prompt);
      
      // Adjust timestamps for this chunk
      if (result.segments) {
        for (const segment of result.segments) {
          allSegments.push({
            ...segment,
            start: segment.start + chunk.startTime,
            end: segment.end + chunk.startTime,
          });
        }
      }
      
      if (result.text) {
        fullText.push(result.text.trim());
      }
      
      if (result.language && !detectedLanguage) {
        detectedLanguage = result.language;
      }
      
      if (result.duration) {
        totalDuration += result.duration;
      }
      
    } catch (error) {
      // Clean up on error
      await invokeCommand('cleanup_audio_chunks').catch(() => {});
      throw error;
    }
  }
  
  // Final progress
  if (options.onProgress) {
    options.onProgress(100);
  }
  
  // Clean up chunks
  await invokeCommand('cleanup_audio_chunks').catch(() => {});
  
  return {
    text: fullText.join(' '),
    task: 'transcribe',
    language: detectedLanguage,
    duration: totalDuration,
    segments: allSegments,
  };
}

/**
 * Custom error class for Groq transcription errors
 */
export class GroqTranscriptionError extends Error {
  public code: string;
  public status?: number;
  public retryAfter?: number;
  public response?: unknown;
  public originalError?: unknown;
  
  constructor(
    message: string,
    code: string,
    options?: {
      status?: number;
      retryAfter?: number;
      response?: unknown;
      originalError?: unknown;
    }
  ) {
    super(message);
    this.name = 'GroqTranscriptionError';
    this.code = code;
    this.status = options?.status;
    this.retryAfter = options?.retryAfter;
    this.response = options?.response;
    this.originalError = options?.originalError;
  }
}

/**
 * Check if Groq transcription is properly configured
 */
export function isGroqConfigured(): boolean {
  const apiKey = getGroqApiKey();
  return !!apiKey && apiKey.startsWith('gsk_');
}

/**
 * Validate a Groq API key format
 */
export function validateGroqApiKey(apiKey: string): { valid: boolean; message?: string } {
  if (!apiKey) {
    return { valid: false, message: 'API key is required' };
  }
  
  if (!apiKey.startsWith('gsk_')) {
    return { valid: false, message: 'Invalid API key format. Groq keys should start with "gsk_"' };
  }
  
  if (apiKey.length < 20) {
    return { valid: false, message: 'API key appears to be truncated' };
  }
  
  return { valid: true };
}

/**
 * Convert Groq transcription response to our internal format
 */
export function convertGroqToInternalFormat(
  response: GroqTranscriptionResponse
): {
  text: string;
  segments: Array<{
    start_ms: number;
    end_ms: number;
    text: string;
    confidence: number;
  }>;
} {
  const segments = response.segments?.map(segment => ({
    start_ms: Math.round(segment.start * 1000),
    end_ms: Math.round(segment.end * 1000),
    text: segment.text.trim(),
    confidence: Math.exp(segment.avg_logprob), // Convert logprob to approximate confidence
  })) || [];
  
  return {
    text: response.text,
    segments,
  };
}
