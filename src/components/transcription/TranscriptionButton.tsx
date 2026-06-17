/**
 * Transcription Button Component
 * 
 * Provides a unified transcription trigger button that works across:
 * - Web App / PWA (using Groq API with chunked upload support)
 * - Tauri Desktop (using local Whisper or Groq with chunking)
 * 
 * Features:
 * - Shows transcription status (none, queued, processing, completed, failed)
 * - Opens inline API key dialog if needed
 * - Works from queue view, documents view, or video player
 * - Saves transcript automatically when complete
 */

import { useState, useCallback, useEffect } from "react";
import {
  CheckCircle,
  CircleNotch,
  FileAudio,
  Key,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react";
import { cn } from '../../utils';
import { useTranscriptionService, type TranscriptionStatus } from './useTranscriptionService';
import { TranscriptionKeyDialog } from './TranscriptionKeyDialog';
import { isGroqConfigured } from '../../api/groqTranscription';

export interface TranscriptionButtonProps {
  /** Document ID to transcribe */
  documentId: string;
  /** Document title for display */
  documentTitle?: string;
  /** File path (for Tauri local files) */
  filePath?: string;
  /** File object (for web/PWA file upload) */
  file?: File;
  /** Media URL (for remote audio/video) */
  mediaUrl?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Visual variant */
  variant?: 'default' | 'outline' | 'ghost' | 'subtle';
  /** Whether to show text label */
  showLabel?: boolean;
  /** Whether to auto-transcribe on mount if no transcript exists */
  autoTranscribe?: boolean;
  /** Callback when transcription completes */
  onComplete?: () => void;
  /** Callback when transcription fails */
  onError?: (error: Error) => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show status indicator next to button */
  showStatus?: boolean;
}

const sizeClasses = {
  sm: 'h-7 px-2 text-xs gap-1',
  md: 'h-9 px-3 text-sm gap-1.5',
  lg: 'h-11 px-4 text-base gap-2',
};

const iconSizes = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

const spinnerSizes = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-4 h-4',
};

export function TranscriptionButton({
  documentId,
  documentTitle,
  filePath,
  file,
  mediaUrl,
  size = 'md',
  variant = 'default',
  showLabel = true,
  autoTranscribe = false,
  onComplete,
  onError,
  className,
  showStatus = false,
}: TranscriptionButtonProps) {
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  
  const { 
    status, 
    startTranscription, 
    retryTranscription,
    error 
  } = useTranscriptionService({
    documentId,
    documentTitle,
    filePath,
    file,
    mediaUrl,
    onComplete,
    onError,
  });

  useEffect(() => {
    setIsConfigured(isGroqConfigured());
  }, []);

  useEffect(() => {
    if (autoTranscribe && status === 'none' && !error && isConfigured) {
      void startTranscription();
    }
  }, [autoTranscribe, status, error, isConfigured, startTranscription]);

  const handleClick = useCallback(async () => {
    if (status === 'completed') {
      // Already completed, trigger onComplete to refresh transcript
      onComplete?.();
      return;
    }
    
    if (status === 'failed' || status === 'needs-api-key' || status === 'needs-model') {
      if (status === 'needs-api-key') {
        setShowKeyDialog(true);
      } else {
        void retryTranscription();
      }
      return;
    }
    
    if (status === 'queued' || status === 'processing') {
      // Already in progress, could show cancel option in future
      return;
    }
    
    const result = await startTranscription();
    if (result.needsApiKey) {
      setShowKeyDialog(true);
    }
  }, [status, startTranscription, retryTranscription, onComplete]);

  const handleKeySaved = useCallback(() => {
    setIsConfigured(true);
    setShowKeyDialog(false);
    // Retry transcription after key is saved
    void retryTranscription();
  }, [retryTranscription]);

  const getButtonContent = () => {
    switch (status) {
      case 'queued':
        return (
          <>
            <CircleNotch className={cn(spinnerSizes[size], 'animate-spin')} />
            {showLabel && <span>Queued...</span>}
          </>
        );
      case 'processing':
        return (
          <>
            <CircleNotch className={cn(spinnerSizes[size], 'animate-spin')} />
            {showLabel && <span>Transcribing...</span>}
          </>
        );
      case 'completed':
        return (
          <>
            <CheckCircle className={iconSizes[size]} />
            {showLabel && <span>Transcribed</span>}
          </>
        );
      case 'failed':
        return (
          <>
            <WarningCircle className={iconSizes[size]} />
            {showLabel && <span>Retry</span>}
          </>
        );
      case 'needs-api-key':
        return (
          <>
            <Key className={iconSizes[size]} />
            {showLabel && <span>Setup API Key</span>}
          </>
        );
      case 'needs-model':
        return (
          <>
            <FileAudio className={iconSizes[size]} />
            {showLabel && <span>Download Model</span>}
          </>
        );
      default:
        return (
          <>
            <Sparkle className={iconSizes[size]} />
            {showLabel && <span>Transcribe</span>}
          </>
        );
    }
  };

  const getButtonStyles = () => {
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed';
    
    switch (status) {
      case 'completed':
        return cn(
          baseStyles,
          sizeClasses[size],
          'bg-green-500/10 text-green-600 hover:bg-green-500/20 border border-green-500/30'
        );
      case 'failed':
      case 'needs-api-key':
      case 'needs-model':
        return cn(
          baseStyles,
          sizeClasses[size],
          variant === 'outline' 
            ? 'border border-amber-500/50 text-amber-600 hover:bg-amber-500/10'
            : 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
        );
      case 'queued':
      case 'processing':
        return cn(
          baseStyles,
          sizeClasses[size],
          'bg-primary/10 text-primary cursor-wait'
        );
      default:
        return cn(
          baseStyles,
          sizeClasses[size],
          variant === 'outline'
            ? 'border border-border hover:bg-muted text-foreground'
            : variant === 'ghost'
            ? 'hover:bg-muted text-foreground'
            : variant === 'subtle'
            ? 'bg-muted/50 hover:bg-muted text-foreground'
            : 'bg-primary text-primary-foreground hover:opacity-90'
        );
    }
  };

  const isDisabled = status === 'queued' || status === 'processing';

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={cn(getButtonStyles(), className)}
        title={getTooltipText(status, error)}
      >
        {getButtonContent()}
      </button>
      
      {showStatus && status !== 'none' && status !== 'completed' && (
        <StatusIndicator status={status} error={error} />
      )}

      <TranscriptionKeyDialog
        isOpen={showKeyDialog}
        onClose={() => setShowKeyDialog(false)}
        onSaved={handleKeySaved}
        documentTitle={documentTitle}
      />
    </>
  );
}

/**
 * Status indicator component for showing transcription state
 */
function StatusIndicator({ status, error }: { status: TranscriptionStatus; error?: Error | null }) {
  const getStatusConfig = () => {
    switch (status) {
      case 'queued':
        return {
          icon: CircleNotch,
          text: 'Queued',
          className: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
          animate: true,
        };
      case 'processing':
        return {
          icon: CircleNotch,
          text: 'Transcribing...',
          className: 'text-primary bg-primary/10 border-primary/30',
          animate: true,
        };
      case 'failed':
        return {
          icon: WarningCircle,
          text: error?.message || 'Failed',
          className: 'text-red-500 bg-red-500/10 border-red-500/30',
          animate: false,
        };
      case 'needs-api-key':
        return {
          icon: Key,
          text: 'API key needed',
          className: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
          animate: false,
        };
      case 'needs-model':
        return {
          icon: FileAudio,
          text: 'Model needed',
          className: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
          animate: false,
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  const { icon: Icon, text, className, animate } = config;

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border',
      className
    )}>
      <Icon className={cn('w-3.5 h-3.5', animate && 'animate-spin')} />
      <span className="max-w-[150px] truncate">{text}</span>
    </div>
  );
}

function getTooltipText(status: TranscriptionStatus, error?: Error | null): string {
  switch (status) {
    case 'none':
      return 'Generate transcript using AI';
    case 'queued':
      return 'Transcription queued - will start soon';
    case 'processing':
      return 'Transcription in progress...';
    case 'completed':
      return 'Transcript ready - click to view';
    case 'failed':
      return error?.message || 'Transcription failed - click to retry';
    case 'needs-api-key':
      return 'Groq API key required - click to setup';
    case 'needs-model':
      return 'Local Whisper model needed - go to Settings';
    default:
      return '';
  }
}

/**
 * Transcription Status Badge
 * 
 * Standalone component for showing transcription status without action button
 */
export function TranscriptionStatusBadge({
  documentId,
  className,
}: {
  documentId: string;
  className?: string;
}) {
  const { status, error } = useTranscriptionService({ documentId });

  if (status === 'none' || status === 'completed') {
    return null;
  }

  return (
    <div className={cn('inline-flex items-center', className)}>
      <StatusIndicator status={status} error={error} />
    </div>
  );
}
