/**
 * Transcription Queue Actions
 * 
 * Adds transcription controls to queue items for video/audio documents.
 * Shows inline status and quick transcription buttons.
 */

import { useState, useEffect } from "react";
import { FileAudio, FileVideo, Mic, CheckCircle2 } from 'lucide-react';
import { cn } from '../../utils';
import { TranscriptionButton, TranscriptionStatusBadge } from './TranscriptionButton';
import { getVideoTranscript } from '../../api/video-extracts';
import type { DocumentFileType } from '../../types/queue';

export interface TranscriptionQueueActionsProps {
  documentId: string;
  documentTitle: string;
  fileType?: DocumentFileType;
  filePath?: string;
  /** Whether to show compact or full version */
  compact?: boolean;
  /** Callback when transcript becomes available */
  onTranscriptReady?: () => void;
}

/**
 * Check if a file type supports transcription
 */
export function isTranscribableFileType(fileType?: DocumentFileType): boolean {
  if (!fileType) return false;
  return ['video', 'audio', 'audiobook', 'youtube'].includes(fileType);
}

/**
 * Get icon for transcribable media
 */
function getMediaIcon(fileType?: DocumentFileType) {
  switch (fileType) {
    case 'audio':
    case 'audiobook':
      return <FileAudio className="w-4 h-4" />;
    case 'video':
    case 'youtube':
      return <FileVideo className="w-4 h-4" />;
    default:
      return <Mic className="w-4 h-4" />;
  }
}

/**
 * Transcription Queue Actions
 * 
 * Renders transcription controls for queue items.
 * Shows status badges and quick action buttons.
 */
export function TranscriptionQueueActions({
  documentId,
  documentTitle,
  fileType,
  filePath,
  compact = false,
  onTranscriptReady,
}: TranscriptionQueueActionsProps) {
  const [hasTranscript, setHasTranscript] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isTranscribableFileType(fileType)) return;
    
    let cancelled = false;
    
    getVideoTranscript(documentId)
      .then((result) => {
        if (!cancelled) {
          setHasTranscript(!!result?.segments && result.segments.length > 0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasTranscript(false);
        }
      });
    
    return () => { cancelled = true; };
  }, [documentId, fileType]);

  // Don't render for non-transcribable types
  if (!isTranscribableFileType(fileType)) {
    return null;
  }

  const handleComplete = () => {
    setHasTranscript(true);
    onTranscriptReady?.();
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {hasTranscript === true ? (
          <span 
            className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full"
            title="Transcript available"
          >
            <CheckCircle2 className="w-3 h-3" />
            Transcribed
          </span>
        ) : (
          <>
            <TranscriptionStatusBadge documentId={documentId} />
            <TranscriptionButton
              documentId={documentId}
              documentTitle={documentTitle}
              filePath={filePath}
              size="sm"
              variant="subtle"
              showLabel={false}
              onComplete={handleComplete}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg border",
      hasTranscript 
        ? "bg-green-500/5 border-green-500/20" 
        : "bg-muted/30 border-border"
    )}>
      <div className={cn(
        "p-2 rounded-lg",
        hasTranscript ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
      )}>
        {hasTranscript ? <CheckCircle2 className="w-4 h-4" /> : getMediaIcon(fileType)}
      </div>
      
      <div className="flex-1 min-w-0">
        {hasTranscript ? (
          <div>
            <p className="text-sm font-medium text-green-700">Transcript Available</p>
            <p className="text-xs text-green-600/70">
              AI transcription is ready for this {fileType === 'audio' || fileType === 'audiobook' ? 'audio' : 'video'}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-foreground">Transcribe {fileType === 'audio' || fileType === 'audiobook' ? 'Audio' : 'Video'}</p>
            <p className="text-xs text-muted-foreground">
              Generate AI transcript to read along and create extracts
            </p>
          </div>
        )}
      </div>
      
      {hasTranscript ? (
        <span className="text-xs font-medium text-green-600 px-2 py-1 bg-green-500/10 rounded-full">
          Ready
        </span>
      ) : (
        <TranscriptionButton
          documentId={documentId}
          documentTitle={documentTitle}
          filePath={filePath}
          size="sm"
          onComplete={handleComplete}
        />
      )}
    </div>
  );
}

/**
 * Compact transcription indicator for queue item rows
 */
export function TranscriptionQueueIndicator({
  documentId,
  fileType,
  className,
}: {
  documentId: string;
  fileType?: DocumentFileType;
  className?: string;
}) {
  const [hasTranscript, setHasTranscript] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isTranscribableFileType(fileType)) return;
    
    let cancelled = false;
    
    getVideoTranscript(documentId)
      .then((result) => {
        if (!cancelled) {
          setHasTranscript(!!result?.segments && result.segments.length > 0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasTranscript(false);
        }
      });
    
    return () => { cancelled = true; };
  }, [documentId, fileType]);

  if (!isTranscribableFileType(fileType)) {
    return null;
  }

  if (hasTranscript) {
    return (
      <span 
        className={cn(
          "inline-flex items-center gap-1 text-xs text-green-600",
          className
        )}
        title="Transcript available"
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Transcribed</span>
      </span>
    );
  }

  return (
    <TranscriptionStatusBadge 
      documentId={documentId} 
      className={className}
    />
  );
}
