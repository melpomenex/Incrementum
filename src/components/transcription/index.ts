/**
 * Transcription Components
 * 
 * Unified transcription system that works across:
 * - Web App / PWA (Groq API with chunked upload)
 * - Tauri Desktop (Local Whisper or Groq with chunking)
 */

export { TranscriptionButton, TranscriptionStatusBadge } from './TranscriptionButton';
export type { TranscriptionButtonProps } from './TranscriptionButton';

export { 
  TranscriptionQueueActions, 
  TranscriptionQueueIndicator,
  isTranscribableFileType 
} from './TranscriptionQueueActions';
export type { TranscriptionQueueActionsProps } from './TranscriptionQueueActions';

export { TranscriptionKeyDialog, InlineTranscriptionKeyInput } from './TranscriptionKeyDialog';
export type { TranscriptionKeyDialogProps } from './TranscriptionKeyDialog';

export { 
  useTranscriptionService, 
  useTranscriptionAvailability,
  useBatchTranscription 
} from './useTranscriptionService';
export type { 
  TranscriptionOptions, 
  TranscriptionResult, 
  TranscriptionProgress,
  TranscriptionStatus 
} from './useTranscriptionService';
