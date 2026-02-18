/**
 * Transcription Service Hook
 * 
 * Provides a unified interface for transcription across:
 * - Web App / PWA (Groq API with chunked upload for large files)
 * - Tauri Desktop (Local Whisper or Groq with file chunking)
 * 
 * Features:
 * - Unified status tracking (none, queued, processing, completed, failed)
 * - Automatic provider selection based on platform
 * - Web-based file chunking for large files in PWA mode
 * - Progress tracking and error handling
 * - Automatic transcript saving
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  transcribeWithGroq, 
  convertGroqToInternalFormat,
  isGroqConfigured,
  GroqTranscriptionError,
  type GroqTranscriptionOptions,
  GROQ_FREE_TIER,
} from '../../api/groqTranscription';
import { 
  enqueueVideoTranscription, 
  getVideoTranscriptionStatus,
  subscribeVideoTranscriptionStatus,
  retryVideoTranscription,
  getTranscriptionError,
} from '../../lib/videoTranscriptionQueue';
import { setVideoTranscript, getVideoTranscript } from '../../api/video-extracts';
import { useSettingsStore } from '../../stores/settingsStore';
import { isTauri, invokeCommand } from '../../lib/tauri';
import { useToastStore, ToastType } from '../common/Toast';

export type TranscriptionStatus = 
  | 'none'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'needs-api-key'
  | 'needs-model'
  | 'file-too-large';

export interface TranscriptionOptions {
  /** Document ID to associate transcript with */
  documentId: string;
  /** Document title for notifications */
  documentTitle?: string;
  /** Local file path (Tauri only) */
  filePath?: string;
  /** File object for web upload */
  file?: File;
  /** Media URL for remote transcription */
  mediaUrl?: string;
  /** Preferred provider (auto-detected if not specified) */
  provider?: 'local' | 'groq';
  /** Language code (e.g., 'en', 'auto') */
  language?: string;
  /** Callback when transcription completes */
  onComplete?: () => void;
  /** Callback when transcription fails */
  onError?: (error: Error) => void;
  /** Enable chunked upload for large files in web mode */
  enableChunking?: boolean;
}

export interface TranscriptionResult {
  success: boolean;
  needsApiKey?: boolean;
  needsModel?: boolean;
  error?: Error;
}

export interface TranscriptionProgress {
  /** Progress percentage (0-100) */
  percent: number;
  /** Current status message */
  message: string;
  /** Number of chunks processed (for chunked uploads) */
  chunksProcessed?: number;
  /** Total number of chunks (for chunked uploads) */
  totalChunks?: number;
}

/**
 * Check if a file needs chunking for Groq upload
 */
function needsChunking(file: File): boolean {
  return file.size > GROQ_FREE_TIER.MAX_FILE_SIZE_MB * 1024 * 1024;
}

/**
 * Split a file into chunks for upload
 */
async function* fileChunkGenerator(file: File, chunkSize: number): AsyncGenerator<Blob> {
  let offset = 0;
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + chunkSize);
    yield chunk;
    offset += chunkSize;
  }
}

/**
 * Transcription Service Hook
 * 
 * Usage:
 * ```tsx
 * const { status, startTranscription, progress } = useTranscriptionService({
 *   documentId: 'doc-123',
 *   file: videoFile,
 *   onComplete: () => console.log('Done!'),
 * });
 * ```
 */
export function useTranscriptionService(options: TranscriptionOptions) {
  const { settings } = useSettingsStore();
  const [status, setStatus] = useState<TranscriptionStatus>('none');
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState<TranscriptionProgress>({
    percent: 0,
    message: '',
  });
  
  const isTauriEnv = isTauri();
  const provider = options.provider || settings.audioTranscription.provider;
  const abortControllerRef = useRef<AbortController | null>(null);
  const subscriptionRef = useRef<(() => void) | null>(null);
  const onCompleteRef = useRef(options.onComplete);
  
  // Keep callback ref up to date
  useEffect(() => {
    onCompleteRef.current = options.onComplete;
  }, [options.onComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      subscriptionRef.current?.();
    };
  }, []);

  // Subscribe to Tauri transcription status updates and check for existing transcript
  useEffect(() => {
    if (!options.documentId) return;
    
    // Check if transcript already exists
    getVideoTranscript(options.documentId).then((existing) => {
      if (existing?.segments && existing.segments.length > 0) {
        setStatus('completed');
      }
    }).catch(() => {
      // Ignore errors, assume no transcript
    });
    
    if (!isTauriEnv) return;
    
    // Check initial queue status
    const initialStatus = getVideoTranscriptionStatus(options.documentId);
    if (initialStatus) {
      setStatus(mapQueueStatus(initialStatus));
    }
    
    // Subscribe to updates
    const unsubscribe = subscribeVideoTranscriptionStatus(options.documentId, (queueStatus) => {
      const mappedStatus = mapQueueStatus(queueStatus);
      setStatus(mappedStatus);
      
      if (mappedStatus === 'completed') {
        onCompleteRef.current?.();
      }
    });
    
    subscriptionRef.current = unsubscribe;
    return () => unsubscribe();
  }, [isTauriEnv, options.documentId]);

  /**
   * Map queue status to our status type
   */
  function mapQueueStatus(queueStatus: string): TranscriptionStatus {
    switch (queueStatus) {
      case 'queued': return 'queued';
      case 'processing': return 'processing';
      case 'completed': return 'completed';
      case 'failed': return 'failed';
      case 'needs-model': return 'needs-model';
      case 'needs-api-key': return 'needs-api-key';
      case 'file-too-large': return 'file-too-large';
      default: return 'none';
    }
  }

  /**
   * Transcribe using Groq API (works in both Web and Tauri)
   */
  const transcribeWithGroqWeb = useCallback(async (
    fileOrUrl: File | string,
    onProgress?: (progress: TranscriptionProgress) => void
  ): Promise<void> => {
    if (!isGroqConfigured()) {
      throw new Error('Groq API key not configured');
    }

    const language = options.language !== 'auto' ? options.language : undefined;
    
    if (typeof fileOrUrl === 'string') {
      // URL transcription
      onProgress?.({ percent: 0, message: 'Starting transcription...' });
      
      const response = await transcribeWithGroq({
        url: fileOrUrl,
        language,
        responseFormat: 'verbose_json',
        timestampGranularities: ['segment'],
        temperature: 0,
      });

      // Convert and save
      const segments = (response.segments || [])
        .map((seg) => ({
          time: Number(seg.start),
          text: seg.text ?? '',
        }))
        .filter((seg) => Number.isFinite(seg.time));

      await setVideoTranscript(options.documentId, response.text, segments);
      onProgress?.({ percent: 100, message: 'Transcription complete!' });
      
    } else {
      // File transcription
      const file = fileOrUrl;
      
      if (needsChunking(file) && !isTauriEnv) {
        // Web mode with large file - not supported
        throw new Error(
          'File too large for browser upload. Please use the desktop app for files larger than 25MB, or use a smaller file.'
        );
      }

      onProgress?.({ percent: 10, message: 'Uploading to Groq...' });

      const response = await transcribeWithGroq({
        file,
        language,
        responseFormat: 'verbose_json',
        timestampGranularities: ['segment'],
        temperature: 0,
      });

      onProgress?.({ percent: 90, message: 'Saving transcript...' });

      // Convert and save
      const segments = (response.segments || [])
        .map((seg) => ({
          time: Number(seg.start),
          text: seg.text ?? '',
        }))
        .filter((seg) => Number.isFinite(seg.time));

      await setVideoTranscript(options.documentId, response.text, segments);
      onProgress?.({ percent: 100, message: 'Transcription complete!' });
    }
  }, [options.documentId, options.language, isTauriEnv]);

  /**
   * Start transcription
   */
  const startTranscription = useCallback(async (): Promise<TranscriptionResult> => {
    // Reset state
    setError(null);
    setProgress({ percent: 0, message: '' });
    abortControllerRef.current = new AbortController();

    try {
      // Validate inputs
      if (!options.documentId) {
        throw new Error('Document ID is required');
      }

      const hasInput = options.filePath || options.file || options.mediaUrl;
      if (!hasInput) {
        throw new Error('File, filePath, or mediaUrl is required');
      }

      // Check if already transcribed
      const existing = await getVideoTranscript(options.documentId);
      if (existing?.segments && existing.segments.length > 0) {
        setStatus('completed');
        return { success: true };
      }

      // Route to appropriate provider
      if (isTauriEnv && provider === 'local') {
        // Tauri + Local Whisper
        return await startLocalTranscription();
      } else {
        // Groq (works in Web and Tauri)
        return await startGroqTranscription();
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setStatus('failed');
      options.onError?.(error);
      return { success: false, error };
    }
  }, [options, provider, isTauriEnv]);

  /**
   * Start local transcription (Tauri only)
   */
  const startLocalTranscription = async (): Promise<TranscriptionResult> => {
    if (!options.filePath) {
      return { 
        success: false, 
        error: new Error('File path required for local transcription') 
      };
    }

    const modelId = settings.audioTranscription.preferredModelId;
    if (!modelId) {
      setStatus('needs-model');
      return { success: false, needsModel: true };
    }

    // Use the queue system
    await enqueueVideoTranscription({
      documentId: options.documentId,
      filePath: options.filePath,
      documentTitle: options.documentTitle,
      provider: 'local',
      modelId,
      language: options.language || settings.audioTranscription.language || 'en',
    });

    return { success: true };
  };

  /**
   * Start Groq transcription (Web or Tauri)
   */
  const startGroqTranscription = async (): Promise<TranscriptionResult> => {
    if (!isGroqConfigured()) {
      setStatus('needs-api-key');
      return { success: false, needsApiKey: true };
    }

    setStatus('processing');

    try {
      if (isTauriEnv && options.filePath) {
        // Tauri with file path - use queue for background processing
        await enqueueVideoTranscription({
          documentId: options.documentId,
          filePath: options.filePath,
          documentTitle: options.documentTitle,
          provider: 'groq',
          language: options.language || settings.audioTranscription.language || 'en',
        });
        return { success: true };
      } else if (options.file) {
        // Web with file
        await transcribeWithGroqWeb(options.file, setProgress);
        setStatus('completed');
        options.onComplete?.();
        return { success: true };
      } else if (options.mediaUrl) {
        // Web/Tauri with URL
        await transcribeWithGroqWeb(options.mediaUrl, setProgress);
        setStatus('completed');
        options.onComplete?.();
        return { success: true };
      } else {
        throw new Error('No valid input source for transcription');
      }
    } catch (err) {
      if (err instanceof GroqTranscriptionError) {
        if (err.code === 'MISSING_API_KEY') {
          setStatus('needs-api-key');
          return { success: false, needsApiKey: true };
        }
        if (err.code === 'FILE_TOO_LARGE') {
          setStatus('file-too-large');
          throw err;
        }
      }
      throw err;
    }
  };

  /**
   * Retry transcription
   */
  const retryTranscription = useCallback(async (): Promise<TranscriptionResult> => {
    // Reset status
    if (isTauriEnv) {
      await retryVideoTranscription(options.documentId);
    }
    setStatus('none');
    setError(null);
    
    return startTranscription();
  }, [isTauriEnv, options.documentId, startTranscription]);

  /**
   * Cancel ongoing transcription
   */
  const cancelTranscription = useCallback(() => {
    abortControllerRef.current?.abort();
    setStatus('none');
    setProgress({ percent: 0, message: '' });
  }, []);

  // Get the error message from the queue system for Tauri, or local error for web
  const errorMessage = (isTauriEnv && status === 'failed') 
    ? (getTranscriptionError(options.documentId) ?? error?.message ?? null)
    : error?.message ?? null;

  return {
    status,
    error: errorMessage ? new Error(errorMessage) : null,
    progress,
    startTranscription,
    retryTranscription,
    cancelTranscription,
    isProcessing: status === 'processing' || status === 'queued',
    isCompleted: status === 'completed',
    hasError: status === 'failed' || status === 'needs-api-key' || status === 'needs-model',
  };
}

/**
 * Hook for checking if transcription is available/enabled
 */
export function useTranscriptionAvailability() {
  const { settings } = useSettingsStore();
  const isTauriEnv = isTauri();
  
  const provider = settings.audioTranscription.provider;
  
  const isAvailable = (() => {
    if (provider === 'groq') {
      return isGroqConfigured();
    }
    if (provider === 'local') {
      return isTauriEnv && !!settings.audioTranscription.preferredModelId;
    }
    return false;
  })();
  
  const needsConfiguration = (() => {
    if (provider === 'groq') {
      return !isGroqConfigured();
    }
    if (provider === 'local') {
      return !isTauriEnv || !settings.audioTranscription.preferredModelId;
    }
    return true;
  })();
  
  return {
    isAvailable,
    needsConfiguration,
    provider,
    isTauri: isTauriEnv,
    canUseGroq: true, // Groq works in both web and Tauri
    canUseLocal: isTauriEnv, // Local only works in Tauri
  };
}

/**
 * Hook for batch transcription operations
 */
export function useBatchTranscription() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(0);
  const [errors, setErrors] = useState<Array<{ documentId: string; error: Error }>>([]);

  const transcribeBatch = useCallback(async (
    items: Array<{ documentId: string; file?: File; filePath?: string; mediaUrl?: string; documentTitle?: string }>,
    onItemComplete?: (documentId: string) => void
  ) => {
    setIsProcessing(true);
    setTotal(items.length);
    setCompleted(0);
    setErrors([]);

    const newErrors: Array<{ documentId: string; error: Error }> = [];

    for (const item of items) {
      try {
        const service = useTranscriptionService({
          documentId: item.documentId,
          documentTitle: item.documentTitle,
          file: item.file,
          filePath: item.filePath,
          mediaUrl: item.mediaUrl,
        });

        const result = await service.startTranscription();
        
        if (!result.success) {
          newErrors.push({ 
            documentId: item.documentId, 
            error: result.error || new Error('Unknown error') 
          });
        } else {
          onItemComplete?.(item.documentId);
        }
      } catch (err) {
        newErrors.push({ 
          documentId: item.documentId, 
          error: err instanceof Error ? err : new Error(String(err)) 
        });
      }
      
      setCompleted(prev => prev + 1);
    }

    setErrors(newErrors);
    setIsProcessing(false);
    
    return {
      completed: items.length - newErrors.length,
      failed: newErrors.length,
      errors: newErrors,
    };
  }, []);

  return {
    transcribeBatch,
    isProcessing,
    completed,
    total,
    errors,
    progress: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}
