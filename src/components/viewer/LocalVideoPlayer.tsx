/**
 * Local Video Player Component
 * Plays local video files with position tracking, playback speed, and keyboard shortcuts
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  SkipBack,
  SkipForward,
  X,
  Scissors,
  Layers,
  GripVertical,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { cn } from '../../utils';
import { saveDocumentPosition, timePosition } from '../../api/position';
import { useI18n } from '../../lib/i18n';
import { getDocumentAuto, updateDocumentProgressAuto } from '../../api/documents';
import { useToast } from '../common/Toast';
import {
  SponsorBlockCut,
  SponsorBlockSegment,
  getSponsorBlockCuts,
  fetchSponsorBlockSegments,
  extractVideoID,
  getCategoryDisplayName,
} from '../../api/sponsorblock';
import { VideoFeatures } from '../video/VideoFeatures';
import {
  CreateVideoExtractDialog,
  VideoExtractsList,
} from '../video/VideoExtracts';
import { getVideoTranscript } from '../../api/video-extracts';
import { TranscriptSync, TranscriptSegment } from "../media/TranscriptSync";
import {
  getVideoTranscriptionStatus,
  setVideoPlaybackActive,
  subscribeVideoTranscriptionStatus,
  getTranscriptionError,
} from "../../lib/videoTranscriptionQueue";
import { isTauri } from "../../lib/tauri";
import { TranscriptionButton } from "../transcription";
import {
  classifyLocalMediaError,
  getLocalMediaSourceKey,
  normalizeLocalMediaSources,
  probeLocalMediaSource,
  type LocalMediaProbeFailure,
  type LocalMediaSourceInput,
} from "./localMediaSources";

interface LocalVideoPlayerProps {
  src: LocalMediaSourceInput; // Local file URL or richer source descriptor
  documentId?: string;
  title?: string;
  onLoad?: (metadata: { duration: number; title: string }) => void;
  className?: string;
  mediaType?: "video" | "audio";
  onEnded?: () => void;
}

export function LocalVideoPlayer({
  src,
  documentId,
  title,
  onLoad,
  className = '',
  mediaType = "video",
  onEnded,
}: LocalVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const { t } = useI18n();

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(() => {
    if (typeof window === 'undefined') return 1;
    const key = documentId ? `video-playback-rate-${documentId}` : 'video-playback-rate-default';
    const saved = localStorage.getItem(key);
    return saved ? parseFloat(saved) : 1;
  });
  const [playError, setPlayError] = useState<string | null>(null);

  // SponsorBlock integration states and refs
  const [sponsorBlockCuts, setSponsorBlockCuts] = useState<SponsorBlockCut[]>([]);
  const [sponsorBlockSegments, setSponsorBlockSegments] = useState<SponsorBlockSegment[]>([]);
  const [skipNotification, setSkipNotification] = useState<{
    category: string;
    savedSeconds?: number;
    originalStart?: number;
    originalEnd?: number;
    undoable: boolean;
  } | null>(null);

  const notifiedCutsRef = useRef<Set<string>>(new Set());
  const skippedSegmentsRef = useRef<Set<string>>(new Set());
  const temporarilyDisabledSegmentsRef = useRef<Set<string>>(new Set());
  const skipNotificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [resolvedSourceIndex, setResolvedSourceIndex] = useState<number | null>(null);
  const [isResolvingSource, setIsResolvingSource] = useState(true);
  const [sourceFailure, setSourceFailure] = useState<LocalMediaProbeFailure | null>(null);
  const [sourceFailureStrategy, setSourceFailureStrategy] = useState<string | null>(null);
  const sourceResolutionRequestRef = useRef(0);
  const [sourceRetryNonce, setSourceRetryNonce] = useState(0);

  // Transcript panel state
  const [showTranscript, setShowTranscript] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('transcript-visibility');
    return saved !== 'false';
  });
  const [transcriptLayout, setTranscriptLayout] = useState<'below' | 'side'>('below');
  const [transcriptWidth, setTranscriptWidth] = useState(() => {
    if (typeof window === 'undefined') return 400;
    const saved = localStorage.getItem('transcript-panel-width');
    return saved ? parseInt(saved, 10) : 400;
  });
  const [isResizingTranscript, setIsResizingTranscript] = useState(false);
  const transcriptResizeStartXRef = useRef(0);
  const transcriptResizeStartWidthRef = useRef(0);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [transcriptionStatus, setTranscriptionStatus] = useState<ReturnType<typeof getVideoTranscriptionStatus>>(null);

  // Video features panel state
  const [showVideoFeatures, setShowVideoFeatures] = useState(false);
  const [videoFeaturesWidth, setVideoFeaturesWidth] = useState(() => {
    if (typeof window === 'undefined') return 384;
    const saved = localStorage.getItem('video-features-panel-width');
    return saved ? parseInt(saved, 10) : 384;
  });
  const [isResizingVideoFeatures, setIsResizingVideoFeatures] = useState(false);
  const videoFeaturesResizeStartXRef = useRef(0);
  const videoFeaturesResizeStartWidthRef = useRef(0);
  const [showCreateExtract, setShowCreateExtract] = useState(false);
  const [extractStartTime, setExtractStartTime] = useState(0);
  const [extractTranscript, setExtractTranscript] = useState('');
  const [activeExtractStartTime, setActiveExtractStartTime] = useState<number | null>(null);
  const [activeExtractEndTime, setActiveExtractEndTime] = useState<number | null>(null);

  // Position tracking
  const [startTime, setStartTime] = useState(0);
  const [documentFilePath, setDocumentFilePath] = useState<string | null>(null);
  const startTimeRef = useRef(0);
  const lastSavedTimeRef = useRef(0);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const documentIdRef = useRef(documentId);
  const currentTimeRef = useRef(0); // Track current time for unmount save
  const durationRef = useRef(0); // Track duration for unmount save
  const resumePlaybackAfterFallbackRef = useRef(false);
  const normalizedSources = useMemo(() => normalizeLocalMediaSources(src), [src]);
  const sourceKey = useMemo(() => getLocalMediaSourceKey(normalizedSources), [normalizedSources]);
  const activeSource = resolvedSourceIndex !== null ? normalizedSources[resolvedSourceIndex] ?? null : null;
  const activeSrc = activeSource?.src ?? "";
  const activeSourceStrategy = activeSource?.strategy ?? "unresolved";

  useEffect(() => {
    documentIdRef.current = documentId;
  }, [documentId]);

  useEffect(() => {
    startTimeRef.current = startTime;
  }, [startTime]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    let cancelled = false;
    const loadSponsorBlockData = async () => {
      if (documentId) {
        try {
          const cuts = await getSponsorBlockCuts(documentId);
          if (cancelled) return;
          if (cuts && cuts.length > 0) {
            setSponsorBlockCuts(cuts);
            return; // Downloaded pre-cut audio, skip live fetches
          }
        } catch (error) {
          console.warn("[SponsorBlock] Failed to check for pre-cut metadata:", error);
        }
      }

      const targetUrl = documentFilePath || activeSrc || (typeof src === 'string' ? src : '');
      if (targetUrl) {
        const videoIdResult = extractVideoID(targetUrl);
        if (videoIdResult && videoIdResult.platform === "youtube") {
          try {
            const fetched = await fetchSponsorBlockSegments(videoIdResult.videoID);
            if (!cancelled) {
              setSponsorBlockSegments(fetched);
            }
          } catch (error) {
            console.warn("[SponsorBlock] Failed to fetch live segments:", error);
          }
        }
      }
    };

    loadSponsorBlockData();
    return () => { cancelled = true; };
  }, [documentId, documentFilePath, activeSrc, src]);

  const formatSourceFailureMessage = useCallback((failure: LocalMediaProbeFailure | null) => {
    if (!failure) {
      return mediaType === "audio"
        ? "The audio file could not be loaded."
        : "The video file could not be loaded.";
    }

    switch (failure.kind) {
      case "source-access":
        return mediaType === "audio"
          ? "The app could not open this local audio source. The desktop media URL may be unreadable, or the file may need to be re-imported."
          : "The app could not open this local video source. The desktop media URL may be unreadable, or the file may need to be re-imported.";
      case "unsupported-format":
        return mediaType === "audio"
          ? "This audio format is not supported by the embedded browser. Try converting it to MP3, M4A, or WAV."
          : "This video format is not supported by the embedded browser. Try converting it to MP4 with H.264 video and AAC audio.";
      case "decode":
        return mediaType === "audio"
          ? "The file opened, but the embedded browser could not decode the audio stream."
          : "The file opened, but the embedded browser could not decode the video stream.";
      case "aborted":
        return "Playback was interrupted before the media finished loading.";
      default:
        return failure.message || (mediaType === "audio"
          ? "The audio file could not be loaded."
          : "The video file could not be loaded.");
    }
  }, [mediaType]);

  const resetResolvedPlaybackState = useCallback(() => {
    setResolvedSourceIndex(null);
    setIsResolvingSource(true);
    setSourceFailure(null);
    setSourceFailureStrategy(null);
    setPlayError(null);
    setIsPlaying(false);
    setCurrentTime(0);
    currentTimeRef.current = 0;
    setDuration(0);
    durationRef.current = 0;
    resumePlaybackAfterFallbackRef.current = false;
  }, []);

  // Seek to saved position when startTime changes and video is ready
  // This handles the race condition where metadata loads before saved position is fetched
  useEffect(() => {
    if (startTime > 0 && videoRef.current && videoRef.current.readyState >= 1) {
      // Only seek if we're still at the beginning (or close to it)
      // This prevents overwriting user navigation after the video has loaded
      if (videoRef.current.currentTime < 1) {
        videoRef.current.currentTime = startTime;
      } else {
      }
    } else {
      console.error(`[LocalVideoPlayer] Cannot seek from effect - startTime: ${startTime}, readyState: ${videoRef.current?.readyState}`);
    }
  }, [startTime]);

  // Persist playback rate to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = documentId ? `video-playback-rate-${documentId}` : 'video-playback-rate-default';
    localStorage.setItem(key, String(playbackRate));
  }, [playbackRate, documentId]);

  // Persist transcript visibility to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('transcript-visibility', String(showTranscript));
  }, [showTranscript]);

  // Persist transcript width to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('transcript-panel-width', String(transcriptWidth));
  }, [transcriptWidth]);

  // Persist video features panel width
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('video-features-panel-width', String(videoFeaturesWidth));
  }, [videoFeaturesWidth]);

  const handleVideoFeaturesResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsResizingVideoFeatures(true);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    videoFeaturesResizeStartXRef.current = clientX;
    videoFeaturesResizeStartWidthRef.current = videoFeaturesWidth;

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [videoFeaturesWidth]);

  useEffect(() => {
    if (!isResizingVideoFeatures) return;

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const delta = videoFeaturesResizeStartXRef.current - clientX;
      const newWidth = Math.max(300, Math.min(900, videoFeaturesResizeStartWidthRef.current + delta));
      setVideoFeaturesWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingVideoFeatures(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isResizingVideoFeatures]);

  const handleTranscriptResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsResizingTranscript(true);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    transcriptResizeStartXRef.current = clientX;
    transcriptResizeStartWidthRef.current = transcriptWidth;

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [transcriptWidth]);

  useEffect(() => {
    if (!isResizingTranscript) return;

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const delta = transcriptResizeStartXRef.current - clientX;
      const newWidth = Math.max(250, Math.min(800, transcriptResizeStartWidthRef.current + delta));
      setTranscriptWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingTranscript(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isResizingTranscript]);

  const loadSavedPosition = useCallback(async () => {
    if (!documentId) {
      return;
    }

    try {
      const doc = await getDocumentAuto(documentId);
      setDocumentFilePath(doc?.filePath ?? null);
      const savedTime = doc?.currentPage ?? doc?.current_page ?? 0;
      if (savedTime >= 3) {
        startTimeRef.current = savedTime;
        setStartTime(savedTime);
        // Seek immediately if video is already ready
        if (videoRef.current && videoRef.current.readyState >= 1) {
          videoRef.current.currentTime = savedTime;
        } else {
        }
      } else {
      }
    } catch (error) {
      console.error('[LocalVideoPlayer] Failed to load position:', error);
    }
  }, [documentId, mediaType, src]);

  const mapTranscriptSegments = useCallback((segments: Array<{ time: number; text: string }>): TranscriptSegment[] => {
    if (!segments || segments.length === 0) return [];
    return segments.map((segment, index) => {
      const next = segments[index + 1];
      const fallbackEnd = segment.time + 2;
      const end = next ? Math.max(segment.time + 0.5, next.time) : fallbackEnd;
      return {
        id: `seg-${index}`,
        start: segment.time,
        end,
        text: segment.text,
      };
    });
  }, []);

  const loadTranscript = useCallback(async () => {
    if (!documentId) return;
    setIsLoadingTranscript(true);
    setTranscriptError(null);
    try {
      const result = await getVideoTranscript(documentId);
      if (result?.segments) {
        setTranscriptSegments(mapTranscriptSegments(result.segments));
      } else {
        setTranscriptSegments([]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load transcript";
      setTranscriptError(message);
      setTranscriptSegments([]);
    } finally {
      setIsLoadingTranscript(false);
    }
  }, [documentId, mapTranscriptSegments]);

  const savePosition = useCallback(async (time: number) => {
    const currentDocumentId = documentIdRef.current;
    if (!currentDocumentId) {
      console.error('[LocalVideoPlayer] Cannot save position: no documentId');
      return;
    }

    // Avoid saving if time hasn't changed significantly
    if (Math.abs(time - lastSavedTimeRef.current) < 1) {
      return;
    }

    try {
      const roundedTime = Math.floor(time);
      await updateDocumentProgressAuto(currentDocumentId, roundedTime);
      if (isTauri()) {
        await saveDocumentPosition(
          currentDocumentId,
          timePosition(roundedTime, duration)
        );
      }
      lastSavedTimeRef.current = time;
    } catch (error) {
      console.error('[LocalVideoPlayer] Failed to save position:', error);
    }
  }, [duration, mediaType]);

  useEffect(() => {
    loadSavedPosition();
  }, [loadSavedPosition]);

  useEffect(() => {
    resetResolvedPlaybackState();

    if (normalizedSources.length === 0) {
      setIsResolvingSource(false);
      setPlayError("Could not resolve a playable media source.");
      return;
    }

    let cancelled = false;
    const requestId = sourceResolutionRequestRef.current + 1;
    sourceResolutionRequestRef.current = requestId;

    const resolveSource = async () => {
      let lastFailure: LocalMediaProbeFailure | null = null;
      let lastStrategy: string | null = null;

      for (let index = 0; index < normalizedSources.length; index += 1) {
        const candidate = normalizedSources[index];

        const result = await probeLocalMediaSource(candidate, mediaType);
        if (cancelled || sourceResolutionRequestRef.current !== requestId) {
          return;
        }

        if (result.ok) {
          setResolvedSourceIndex(index);
          setIsResolvingSource(false);
          setSourceFailure(null);
          setSourceFailureStrategy(null);
          setPlayError(null);
          return;
        }

        lastFailure = result.failure ?? null;
        lastStrategy = candidate.strategy ?? null;
        console.warn("[LocalVideoPlayer] Local media source rejected during probe:", {
          mediaType,
          strategy: candidate.strategy,
          index,
          failure: result.failure,
        });
      }

      console.error("[LocalVideoPlayer] Failed to resolve a playable local media source:", {
        mediaType,
        lastStrategy,
        lastFailure,
        candidateCount: normalizedSources.length,
      });
      setIsResolvingSource(false);
      setResolvedSourceIndex(null);
      setSourceFailure(lastFailure);
      setSourceFailureStrategy(lastStrategy);
      setPlayError(formatSourceFailureMessage(lastFailure));
    };

    void resolveSource();

    return () => {
      cancelled = true;
    };
  }, [
    formatSourceFailureMessage,
    mediaType,
    normalizedSources,
    resetResolvedPlaybackState,
    sourceKey,
    sourceRetryNonce,
  ]);

  useEffect(() => {
    if (!documentId) return;
    loadTranscript();
  }, [documentId, loadTranscript]);

  useEffect(() => {
    if (!documentId) return;
    setTranscriptionStatus(getVideoTranscriptionStatus(documentId));
    const unsubscribe = subscribeVideoTranscriptionStatus(documentId, (status) => {
      setTranscriptionStatus(status);
      if (status === "completed") {
        loadTranscript();
      }
    });
    return unsubscribe;
  }, [documentId, loadTranscript]);

  useEffect(() => {
    if (!documentId) return;
    setVideoPlaybackActive(documentId, isPlaying);
    return () => setVideoPlaybackActive(documentId, false);
  }, [documentId, isPlaying]);

  // Set up auto-save interval (every 5 seconds while playing)
  useEffect(() => {
    const startAutoSave = () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
      autoSaveIntervalRef.current = setInterval(() => {
        if (isPlaying && videoRef.current && documentIdRef.current) {
          savePosition(videoRef.current.currentTime);
        }
      }, 5000);
    };

    if (isPlaying) {
      startAutoSave();
    }

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
        autoSaveIntervalRef.current = null;
      }
    };
  }, [isPlaying, savePosition]);

  useEffect(() => {
    return () => {
      // Save on unmount using the ref value (videoRef may be null by now)
      if (documentIdRef.current && currentTimeRef.current > 0) {
        // Use a synchronous approach for unmount to ensure it completes
        const timeToSave = Math.floor(currentTimeRef.current);
        const docId = documentIdRef.current;
        // Avoid saving if time hasn't changed significantly
        if (Math.abs(timeToSave - lastSavedTimeRef.current) >= 1) {
          // Fire and forget - don't await since we're in cleanup
          void updateDocumentProgressAuto(docId, timeToSave);
          if (isTauri()) {
            void saveDocumentPosition(docId, timePosition(timeToSave, durationRef.current));
          }
        }
      }
    };
  }, []); // Empty deps - only run on unmount, use refs for values

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return;

      // Ignore if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekRelative(-5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekRelative(5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          adjustVolume(Math.min(100, volume + 5));
          break;
        case 'ArrowDown':
          e.preventDefault();
          adjustVolume(Math.max(0, volume - 5));
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'j':
          e.preventDefault();
          seekRelative(-10);
          break;
        case 'l':
          e.preventDefault();
          seekRelative(10);
          break;
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          // Number keys seek to percentage
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            const percent = parseInt(e.key) * 10;
            seekToPercentage(percent);
          }
          break;
        case '<':
          e.preventDefault();
          changePlaybackRate(Math.max(0.25, playbackRate - 0.25));
          break;
        case '>':
          e.preventDefault();
          changePlaybackRate(Math.min(2, playbackRate + 0.25));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, volume, playbackRate]);

  const buildPlayErrorMessage = useCallback((error: unknown) => {
    if (error instanceof DOMException) {
      if (error.name === 'NotSupportedError' || /not supported/i.test(error.message)) {
        return mediaType === "audio"
          ? 'This audio format is not supported by the embedded browser. Try converting it to MP3, M4A, or WAV.'
          : 'This video codec is not supported. Please convert to MP4 (H.264/AAC). Some MP4 files use HEVC/H.265 or AV1 which are unsupported.';
      }
      if (error.name === 'NotAllowedError') {
        return 'Playback was blocked. Click the video to play.';
      }
      return error.message || 'Failed to play video';
    }
    if (error instanceof Error) return error.message;
    return mediaType === "audio" ? 'Failed to play audio' : 'Failed to play video';
  }, [mediaType]);

  const attemptPlay = useCallback(async (context: string) => {
    if (!videoRef.current) return;
    try {
      await videoRef.current.play();
    } catch (error) {
      const errorMessage = buildPlayErrorMessage(error);
      console.error(`[LocalVideoPlayer] Play error (${context}):`, errorMessage);
      setPlayError(errorMessage);
      toast.error(t("viewer.playbackError"), errorMessage);
    }
  }, [buildPlayErrorMessage, t, toast]);

  const resetSponsorBlockTracking = useCallback((time: number) => {
    if (sponsorBlockCuts.length > 0) {
      sponsorBlockCuts.forEach(cut => {
        if (cut.cutStart > time) {
          notifiedCutsRef.current.delete(cut.uuid);
        }
      });
    }
    if (sponsorBlockSegments.length > 0) {
      sponsorBlockSegments.forEach(seg => {
        if (seg.segment[0] > time) {
          skippedSegmentsRef.current.delete(seg.UUID);
          temporarilyDisabledSegmentsRef.current.delete(seg.UUID);
        }
      });
    }
    setSkipNotification(null);
  }, [sponsorBlockCuts, sponsorBlockSegments]);

  const handleUndoSkip = useCallback((originalStart: number, originalEnd: number, category: string) => {
    const segment = sponsorBlockSegments.find(s => s.segment[0] === originalStart);
    if (segment) {
      temporarilyDisabledSegmentsRef.current.add(segment.UUID);
    }
    
    if (videoRef.current) {
      videoRef.current.currentTime = originalStart;
      setCurrentTime(originalStart);
      currentTimeRef.current = originalStart;
      void attemptPlay('undo-skip');
    }
    
    setSkipNotification(null);
    toast.success("Playing skipped segment: " + getCategoryDisplayName(category as any));
  }, [sponsorBlockSegments, attemptPlay, toast]);

  useEffect(() => {
    return () => {
      if (skipNotificationTimeoutRef.current) {
        clearTimeout(skipNotificationTimeoutRef.current);
      }
    };
  }, []);

  const tryRuntimeFallback = useCallback((failure: LocalMediaProbeFailure | null) => {
    if (resolvedSourceIndex === null || resolvedSourceIndex >= normalizedSources.length - 1) {
      return false;
    }

    const resumeTime = currentTimeRef.current;
    const nextIndex = resolvedSourceIndex + 1;
    const nextSource = normalizedSources[nextIndex];
    if (!nextSource) {
      return false;
    }

    console.warn("[LocalVideoPlayer] Switching to fallback media source after runtime failure:", {
      fromStrategy: activeSourceStrategy,
      toStrategy: nextSource.strategy,
      mediaType,
      failure,
      resumeTime,
    });

    if (resumeTime > 0) {
      startTimeRef.current = resumeTime;
      setStartTime(resumeTime);
    }

    resumePlaybackAfterFallbackRef.current = Boolean(videoRef.current && !videoRef.current.paused);
    setPlayError(null);
    setSourceFailure(failure);
    setSourceFailureStrategy(activeSourceStrategy);
    setIsResolvingSource(false);
    setResolvedSourceIndex(nextIndex);
    setCurrentTime(resumeTime);
    return true;
  }, [activeSourceStrategy, mediaType, normalizedSources, resolvedSourceIndex]);

  // Toggle play/pause
  const togglePlay = async () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      setPlayError(null);
      const videoDuration = duration > 0 ? duration : (videoRef.current.duration || 0);
      const isNearEnd = videoDuration > 0 && videoRef.current.currentTime >= videoDuration - 1;
      if (videoRef.current.ended || isNearEnd) {
        videoRef.current.currentTime = 0;
        setCurrentTime(0);
        currentTimeRef.current = 0;
      }
      await attemptPlay('toggle');
    } else {
      videoRef.current.pause();
    }
  };

  // Seek relative to current position
  const seekRelative = (seconds: number) => {
    if (videoRef.current) {
      const targetTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
      resetSponsorBlockTracking(targetTime);
      videoRef.current.currentTime = targetTime;
    }
  };

  // Seek to percentage
  const seekToPercentage = (percent: number) => {
    if (videoRef.current) {
      const targetTime = (duration * percent) / 100;
      resetSponsorBlockTracking(targetTime);
      videoRef.current.currentTime = targetTime;
    }
  };

  // Adjust volume
  const adjustVolume = (newVolume: number) => {
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume / 100;
      if (newVolume > 0) {
        setIsMuted(false);
        videoRef.current.muted = false;
      }
    }
  };

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  };

  // Change playback rate
  const changePlaybackRate = (rate: number) => {
    const roundedRate = Math.round(rate * 100) / 100;
    setPlaybackRate(roundedRate);
    if (videoRef.current) {
      videoRef.current.playbackRate = roundedRate;
    }
    toast.success(
      `Speed: ${roundedRate}x`,
      `Playback speed set to ${roundedRate}x`
    );
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Video features handlers
  const handleOpenCreateExtract = () => {
    setExtractStartTime(currentTime);
    setExtractTranscript(''); // Will be populated by a selection
    setShowCreateExtract(true);
  };

  const handleSeek = (time: number, endTime?: number) => {
    resetSponsorBlockTracking(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    if (typeof endTime === 'number' && endTime > time) {
      setActiveExtractStartTime(time);
      setActiveExtractEndTime(endTime);
    } else {
      setActiveExtractStartTime(null);
      setActiveExtractEndTime(null);
    }
  };

  // Use requestVideoFrameCallback for smoother playback when available
  // Falls back to timeupdate event for older browsers
  const rafCallbackRef = useRef<number | undefined>(undefined);

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    // Only update state if time changed significantly (reduces re-renders)
    if (Math.abs(time - currentTimeRef.current) > 0.1) {
      setCurrentTime(time);
    }
    currentTimeRef.current = time; // Keep ref updated for unmount save

    // SponsorBlock cut metadata (pre-cut) check
    if (sponsorBlockCuts && sponsorBlockCuts.length > 0) {
      for (const cut of sponsorBlockCuts) {
        if (time >= cut.cutStart && time <= cut.cutStart + 1.5) {
          if (!notifiedCutsRef.current.has(cut.uuid)) {
            notifiedCutsRef.current.add(cut.uuid);
            
            setSkipNotification({
              category: cut.category,
              savedSeconds: Math.round(cut.originalEnd - cut.originalStart),
              undoable: false,
            });
            
            if (skipNotificationTimeoutRef.current) clearTimeout(skipNotificationTimeoutRef.current);
            skipNotificationTimeoutRef.current = setTimeout(() => {
              setSkipNotification(null);
            }, 4000);
          }
        }
      }
    }

    // SponsorBlock live segment check (streaming / uncut)
    if (sponsorBlockSegments && sponsorBlockSegments.length > 0) {
      for (const segment of sponsorBlockSegments) {
        const [start, end] = segment.segment;
        if (time >= start && time < end) {
          if (!skippedSegmentsRef.current.has(segment.UUID) && !temporarilyDisabledSegmentsRef.current.has(segment.UUID)) {
            skippedSegmentsRef.current.add(segment.UUID);
            
            videoRef.current.currentTime = end;
            setCurrentTime(end);
            currentTimeRef.current = end;
            
            setSkipNotification({
              category: segment.category,
              savedSeconds: Math.round(end - start),
              originalStart: start,
              originalEnd: end,
              undoable: true,
            });
            
            if (skipNotificationTimeoutRef.current) clearTimeout(skipNotificationTimeoutRef.current);
            skipNotificationTimeoutRef.current = setTimeout(() => {
              setSkipNotification(null);
            }, 4000);
            break;
          }
        }
      }
    }

    if (
      activeExtractStartTime !== null
      && activeExtractEndTime !== null
      && activeExtractEndTime > activeExtractStartTime
      && time >= activeExtractEndTime
    ) {
      videoRef.current.currentTime = activeExtractStartTime;
      void attemptPlay('extract-loop');
    }
  }, [activeExtractStartTime, activeExtractEndTime, sponsorBlockCuts, sponsorBlockSegments, attemptPlay]);

  useEffect(() => {
    const video = videoRef.current;
    // WebKit in Tauri can become unstable with per-frame callbacks during media playback.
    // Fall back to native `timeupdate` events in desktop mode.
    if (isTauri() || !video || typeof video.requestVideoFrameCallback !== 'function') {
      return;
    }

    const onFrame = () => {
      if (video) {
        const time = video.currentTime;
        if (Math.abs(time - currentTimeRef.current) > 0.05) {
          setCurrentTime(time);
        }
        currentTimeRef.current = time;

        if (
          activeExtractStartTime !== null
          && activeExtractEndTime !== null
          && activeExtractEndTime > activeExtractStartTime
          && time >= activeExtractEndTime
        ) {
          video.currentTime = activeExtractStartTime;
          void attemptPlay('extract-loop');
        }
      }
      rafCallbackRef.current = video.requestVideoFrameCallback(onFrame);
    };

    rafCallbackRef.current = video.requestVideoFrameCallback(onFrame);

    return () => {
      if (rafCallbackRef.current !== undefined && typeof video.cancelVideoFrameCallback === 'function') {
        video.cancelVideoFrameCallback(rafCallbackRef.current);
      }
    };
  }, [activeExtractStartTime, activeExtractEndTime, attemptPlay]);

  const handleExtractCreated = (_extract: any) => {
    setShowCreateExtract(false);
    // Refresh the video features to show the new extract
    // This will be handled by the VideoExtractsList component
  };

  // Calculate progress percentage
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleTranscriptComplete = () => {
    // Refresh transcript when transcription completes
    loadTranscript();
    toast.success(t("viewer.transcriptionComplete"), t("viewer.transcriptNowAvailable"));
  };

  const waveformBars = useMemo(() => {
    const seedSource = `${title || ''}|${sourceKey}`;
    let hash = 2166136261;
    for (let i = 0; i < seedSource.length; i += 1) {
      hash ^= seedSource.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    let state = hash >>> 0;
    const next = () => {
      state += 0x6D2B79F5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const bars: number[] = [];
    const barCount = 64;
    for (let i = 0; i < barCount; i += 1) {
      const rand = next();
      const shaped = Math.pow(rand, 0.55);
      const height = 0.18 + shaped * 0.82;
      bars.push(height);
    }

    return bars;
  }, [sourceKey, title]);

  const handleScroll = useCallback((e: React.WheelEvent) => {
    if (!videoRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Scroll down (positive deltaY) = forward
    // Scroll up (negative deltaY) = backward
    const delta = e.deltaY > 0 ? 5 : -5;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + delta));
    
    // Show feedback toast for scroll seek
    const newTime = videoRef.current.currentTime;
    const direction = delta > 0 ? 'forward' : 'backward';
    toast.success(
      `${formatTime(newTime)}`,
      `Seeked ${direction} 5 seconds`
    );
  }, [duration, toast]);

  // Note: click/dblclick handlers are attached to the container so clicks on letterboxed
  // areas (not just the <video> pixels) still work. Controls opt-out via data attr.

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      const mediaDuration = videoRef.current.duration;
      setDuration(mediaDuration);
      onLoad?.({ duration: mediaDuration, title: title || t(mediaType === "audio" ? "viewer.audio" : "viewer.video") });
      if (startTimeRef.current > 0) {
        videoRef.current.currentTime = startTimeRef.current;
      }
      if (playbackRate !== 1) {
        videoRef.current.playbackRate = playbackRate;
      }
    }
  }, [activeSourceStrategy, mediaType, onLoad, playbackRate, t, title]);

  const handleCanPlay = useCallback(() => {
    setPlayError(null);
    setSourceFailure(null);
    setSourceFailureStrategy(null);
    if (resumePlaybackAfterFallbackRef.current) {
      resumePlaybackAfterFallbackRef.current = false;
      void attemptPlay('fallback-resume');
    }
  }, [activeSourceStrategy, attemptPlay, mediaType]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    if (videoRef.current && documentIdRef.current) {
      savePosition(videoRef.current.currentTime);
    }
  }, [savePosition]);

  const handleVolumeChange = useCallback(() => {
    if (videoRef.current) {
      setVolume(videoRef.current.volume * 100);
      setIsMuted(videoRef.current.muted);
    }
  }, []);

  const handleMediaElementError = useCallback((e: React.SyntheticEvent<HTMLAudioElement | HTMLVideoElement>) => {
    const error = videoRef.current?.error;
    const failure = activeSource
      ? classifyLocalMediaError(activeSource, mediaType, error?.code)
      : null;

    if (tryRuntimeFallback(failure)) {
      return;
    }

    const userFriendlyMessage = formatSourceFailureMessage(failure);
    const titleKey = mediaType === "audio" ? "viewer.audioPlaybackError" : "viewer.videoPlaybackError";

    console.error('[LocalVideoPlayer] Media error:', {
      strategy: activeSourceStrategy,
      errorCode: error?.code,
      errorMessage: error?.message,
      failure,
      event: e,
    });

    setSourceFailure(failure);
    setSourceFailureStrategy(activeSourceStrategy);
    setPlayError(userFriendlyMessage);
    toast.error(t(titleKey), userFriendlyMessage);
  }, [activeSource, activeSourceStrategy, formatSourceFailureMessage, mediaType, t, toast, tryRuntimeFallback]);

  const mediaElement = mediaType === "audio" ? (
    <audio
      ref={videoRef}
      aria-label="Local media player"
      src={activeSrc}
      preload="none"
      className="sr-only"
      onLoadedMetadata={handleLoadedMetadata}
      onCanPlay={handleCanPlay}
      onWaiting={() => {
      }}
      onPlay={() => setIsPlaying(true)}
      onPause={handlePause}
      // Use timeupdate as fallback for browsers without requestVideoFrameCallback
      onTimeUpdate={() => {
        handleTimeUpdate();
      }}
      onSeeked={() => handleTimeUpdate()}
      onVolumeChange={handleVolumeChange}
      onError={handleMediaElementError}
      onEnded={onEnded}
    />
  ) : (
    <video
      ref={videoRef}
      src={activeSrc}
      preload="none"
      playsInline
      className="w-full max-h-full bg-black cursor-pointer"
      onLoadedMetadata={handleLoadedMetadata}
      onCanPlay={handleCanPlay}
      onWaiting={() => {
      }}
      onPlay={() => setIsPlaying(true)}
      onPause={handlePause}
      // Use timeupdate as fallback for browsers without requestVideoFrameCallback
      onTimeUpdate={() => {
        handleTimeUpdate();
      }}
      onSeeked={() => handleTimeUpdate()}
      onVolumeChange={handleVolumeChange}
      onError={handleMediaElementError}
      onWheel={handleScroll}
      onEnded={onEnded}
    />
  );

  const autoInProgress = transcriptionStatus === "queued" || transcriptionStatus === "processing";
  const autoFailed = transcriptionStatus === "failed";
  const autoNeedsModel = transcriptionStatus === "needs-model";
  const autoNeedsApiKey = transcriptionStatus === "needs-api-key";
  const transcriptionError = autoFailed && documentId ? getTranscriptionError(documentId) : null;

  return (
    <div
      className={cn(
        "relative flex h-full",
        transcriptLayout === 'side' && showTranscript ? "flex-row" : "flex-col",
        className
      )}
    >
      <div
        ref={containerRef}
        className={cn(
          "relative flex flex-col rounded-lg overflow-hidden flex-shrink-0",
          mediaType === "audio" ? "bg-background" : "bg-black",
          transcriptLayout === 'side' && showTranscript ? "h-full" : "w-full"
        )}
        style={transcriptLayout === 'side' && showTranscript ? { flex: 1 } : undefined}
        onClick={(e) => {
          const target = e.target as Element | null;
          if (target?.closest?.('[data-local-video-controls="true"]')) return;
          void togglePlay();
        }}
        onDoubleClick={(e) => {
          const target = e.target as Element | null;
          if (target?.closest?.('[data-local-video-controls="true"]')) return;
          toggleFullscreen();
        }}
      >
        {/* Premium SponsorBlock Skip Notification Overlay */}
        {skipNotification && (
          <div 
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top duration-300 pointer-events-auto"
            data-local-video-controls="true"
          >
            <div className="px-4 py-3 bg-card/85 backdrop-blur-md border border-border/60 rounded-2xl shadow-xl flex items-center gap-3.5 max-w-sm sm:max-w-md ring-1 ring-black/5">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm flex-shrink-0 animate-pulse">
                <Sparkles className="h-5.5 w-5.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground tracking-wide uppercase opacity-90 text-left">
                  SponsorBlock
                </p>
                <p className="text-sm font-medium text-muted-foreground truncate leading-normal text-left">
                  {skipNotification.undoable
                    ? `Auto-skipped: ${getCategoryDisplayName(skipNotification.category as any)} (${skipNotification.savedSeconds}s)`
                    : `Sponsored segment cut (${skipNotification.savedSeconds}s saved!)`
                  }
                </p>
              </div>
              {skipNotification.undoable && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUndoSkip(skipNotification.originalStart!, skipNotification.originalEnd!, skipNotification.category);
                  }}
                  className="px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Undo
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSkipNotification(null);
                }}
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        {/* Media Element */}
        {activeSrc ? mediaElement : null}

      {isResolvingSource && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
          <div className="text-center p-6 max-w-md">
            <h3 className="text-lg font-semibold text-white mb-2">
              {t(mediaType === "audio" ? "viewer.loadingAudio" : "viewer.loadingVideo")}
            </h3>
            <p className="text-sm text-gray-300">
              Resolving a playable local {mediaType} source{normalizedSources.length > 1 ? " and checking fallback options" : ""}.
            </p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {playError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="text-center p-6 max-w-md">
            <div className="text-red-500 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{t("viewer.playbackError")}</h3>
            <p className="text-sm text-gray-300 mb-4">{playError}</p>
            {sourceFailureStrategy && (
              <p className="text-xs text-gray-400 mb-2">
                Last source strategy: {sourceFailureStrategy}
              </p>
            )}
            {sourceFailure?.kind && (
              <p className="text-xs text-gray-400 mb-4">
                Failure classification: {sourceFailure.kind}
              </p>
            )}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => {
                  setSourceRetryNonce((value) => value + 1);
                }}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
              >
                {t("viewer.retry")}
              </button>
              <button
                onClick={() => setPlayError(null)}
                className="mt-4 px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:opacity-90"
              >
                {t("viewer.dismiss")}
              </button>
            </div>
          </div>
        </div>
      )}

        {/* Scroll hint overlay - shows briefly when video loads */}
        <ScrollHint isPlaying={isPlaying} />

      {mediaType === "audio" && (
        <div className="flex-1 w-full flex items-center justify-center px-10 py-12">
          <div className="w-full max-w-5xl h-48 md:h-64">
            <div className="flex items-end gap-1 h-full">
              {waveformBars.map((height, index) => {
                const filled = (index / waveformBars.length) * 100 <= progressPercent;
                return (
                  <div
                    key={`wave-${index}`}
                    className={cn(
                      "flex-1 rounded-full transition-colors",
                      filled ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                    style={{ height: `${Math.max(8, Math.round(height * 100))}%` }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

        {/* Controls Overlay */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col justify-between opacity-100 transition-opacity px-4 pt-4 pb-6 z-20 pointer-events-none",
            mediaType === "audio"
              ? "bg-gradient-to-b from-background/80 via-transparent to-background/80"
              : "bg-gradient-to-b from-black/30 via-transparent to-black/50"
          )}
        >
          <div
            className="pointer-events-auto flex h-full flex-col justify-between"
            data-local-video-controls="true"
          >
        {/* Top Controls */}
        <div className="flex items-center justify-between">
          <div className={cn("text-sm truncate", mediaType === "audio" ? "text-foreground" : "text-white")}>
            {title || (mediaType === "audio" ? t("viewer.audio") : t("viewer.video"))}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleFullscreen}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              title={t("viewer.fullscreenF")}
            >
              <Maximize className={cn("w-5 h-5", mediaType === "audio" ? "text-foreground" : "text-white")} />
            </button>
          </div>
        </div>

        {/* Center Controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => seekRelative(-10)}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
            title={t("viewer.back10s")}
          >
            <SkipBack className={cn("w-5 h-5", mediaType === "audio" ? "text-foreground" : "text-white")} />
          </button>

          <button
            onClick={() => seekRelative(-5)}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
            title={t("viewer.back5s")}
          >
            <SkipBack className={cn("w-5 h-5", mediaType === "audio" ? "text-foreground" : "text-white")} />
          </button>

          <button
            onClick={togglePlay}
            className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
            title={t("viewer.playPause")}
          >
            {isPlaying ? (
              <Pause className={cn("w-6 h-6", mediaType === "audio" ? "text-foreground" : "text-white")} />
            ) : (
              <Play className={cn("w-6 h-6 ml-0.5", mediaType === "audio" ? "text-foreground" : "text-white")} />
            )}
          </button>

          <button
            onClick={() => seekRelative(5)}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
            title={t("viewer.forward5s")}
          >
            <SkipForward className={cn("w-5 h-5", mediaType === "audio" ? "text-foreground" : "text-white")} />
          </button>

          <button
            onClick={() => seekRelative(10)}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
            title={t("viewer.forward10s")}
          >
            <SkipForward className={cn("w-5 h-5", mediaType === "audio" ? "text-foreground" : "text-white")} />
          </button>
        </div>

        {/* Bottom Controls */}
        <div className="space-y-2">
          {/* Progress Bar */}
          <div
            className="w-full h-1 bg-white/30 rounded-full cursor-pointer group"
            role="slider"
            aria-label="Seek bar"
            aria-valuenow={Math.round(progressPercent)}
            aria-valuemin={0}
            aria-valuemax={100}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') seekToPercentage(Math.max(0, progressPercent - 5));
              if (e.key === 'ArrowRight') seekToPercentage(Math.min(100, progressPercent + 5));
            }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = ((e.clientX - rect.left) / rect.width) * 100;
              seekToPercentage(percent);
            }}
          >
            <div
              className="h-full bg-red-500 rounded-full relative transition-all"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Control Bar */}
          <div className={cn("flex items-center justify-between", mediaType === "audio" ? "text-foreground" : "text-white")}>
            {/* Left side - Time and playback speed */}
            <div className="flex items-center gap-4">
              <button
                onClick={togglePlay}
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded transition-colors"
                title={t("viewer.playPause")}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>
              <span className="text-sm font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <button
                onClick={() => changePlaybackRate(playbackRate === 1 ? 1.25 : playbackRate === 1.25 ? 1.5 : playbackRate === 1.5 ? 1.75 : playbackRate === 1.75 ? 2 : 1)}
                className="px-2 py-0.5 bg-white/10 rounded text-xs hover:bg-white/20 transition-colors"
                title={t("viewer.speed")}
              >
                {playbackRate}x
              </button>
            </div>

            {/* Right side - Volume and fullscreen */}
            <div className="flex items-center gap-2">
              {/* Volume Control */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                  title={t("viewer.mute")}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => adjustVolume(parseInt(e.target.value))}
                  aria-label="Volume"
                  className="w-20 h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                />
              </div>

              {/* Rotation button */}
              <button
                onClick={toggleFullscreen}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                title={t("viewer.fullscreenF")}
              >
                <Maximize className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
          </div>
        </div>

        {/* Keyboard Shortcuts Hint */}
        <div className={cn(
          "absolute bottom-24 left-4 p-2 rounded text-xs opacity-0 hover:opacity-100 transition-opacity z-10 pointer-events-none",
          mediaType === "audio" ? "bg-background/90 text-foreground border border-border" : "bg-black/70 text-white"
        )}>
          <div className="font-semibold mb-1">{t("viewer.shortcuts")}</div>
          <div>{t("viewer.spaceKPlayPause")}</div>
          <div>{t("viewer.arrow5s")}</div>
          <div>{t("viewer.arrowUpDownVolume")}</div>
          <div>{t("viewer.scrollSeek")}</div>
          <div>{t("viewer.clickPlayPause")}</div>
          <div>{t("viewer.dblClickFullscreen")}</div>
          <div>{t("viewer.mMute")}</div>
          <div>{t("viewer.fFullscreen")}</div>
          <div>{t("viewer.jumpToPercent")}</div>
          <div>{t("viewer.angleBracketSpeed")}</div>
        </div>
      </div>

      {/* Resize handle - only in side mode with transcript visible */}
      {transcriptLayout === 'side' && showTranscript && (
        <div
          className={`w-1 flex-shrink-0 relative z-10 ${isResizingTranscript ? 'bg-primary' : 'bg-border hover:bg-primary/50'} cursor-ew-resize transition-colors`}
          onMouseDown={handleTranscriptResizeStart}
          onTouchStart={handleTranscriptResizeStart}
          title={t("viewer.dragToResize")}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-1 rounded bg-background/80 shadow-sm">
            <GripVertical className="w-3 h-3 text-muted-foreground" />
          </div>
        </div>
      )}

      {/* Content area with transcript toggle */}
      <div
        className="flex flex-col overflow-hidden"
        style={transcriptLayout === 'side' && showTranscript ? { width: transcriptWidth } : { flex: 1 }}
      >
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border flex-shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-foreground line-clamp-2 mb-1">
                  {title || (mediaType === "audio" ? t("viewer.audio") : t("viewer.video"))}
                </h2>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {duration > 0 && <span>{t("viewer.duration", { duration: formatTime(duration) })}</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                {documentId && (
                  <button
                    onClick={() => setShowVideoFeatures(!showVideoFeatures)}
                    className={cn(
                      "px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-2",
                      showVideoFeatures ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-foreground"
                    )}
                    title={t("viewer.videoFeatures")}
                  >
                    <Layers className="w-4 h-4" />
                    <span className="font-medium">{t("viewer.panels")}</span>
                  </button>
                )}

                {showTranscript && (
                  <button
                    onClick={() => setTranscriptLayout(transcriptLayout === 'below' ? 'side' : 'below')}
                    className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors flex items-center gap-2"
                    title={transcriptLayout === 'below' ? t("viewer.switchToSideBySide") : t("viewer.switchToStacked")}
                  >
                    <span className="text-xs">{transcriptLayout === 'below' ? '↔' : '↕'}</span>
                  </button>
                )}

                <button
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors flex items-center gap-2"
                >
                  <span className="font-medium">{showTranscript ? t("viewer.hideTranscript") : t("viewer.showTranscript")}</span>
                  <span className="text-xs text-muted-foreground">
                    {showTranscript ? "▼" : "▶"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {showTranscript && (
            <div className="flex-1 min-h-0 overflow-hidden">
              {isLoadingTranscript ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin h-6 w-6 border-2 border-muted-foreground border-t-transparent rounded-full" />
                    <span className="text-sm">{t("viewer.loadingTranscript")}</span>
                  </div>
                </div>
              ) : transcriptError ? (
                <div className="flex items-center justify-center h-full p-6">
                  <div className="text-center max-w-md">
                    <p className="text-sm font-medium text-foreground mb-2">{t("viewer.transcriptUnavailableLocal")}</p>
                    <p className="text-xs text-muted-foreground">{transcriptError}</p>
                  </div>
                </div>
              ) : transcriptSegments.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground p-6">
                  <div className="text-center space-y-4 max-w-md">
                    {autoInProgress && (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary">
                        {t("viewer.transcribingInBackground")}
                      </div>
                    )}
                    {autoFailed && !autoNeedsApiKey && !autoNeedsModel && (
                      <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                        <p className="font-medium">{t("viewer.transcriptionFailed")}</p>
                        {transcriptionError && (
                          <p className="mt-1 opacity-90">{transcriptionError}</p>
                        )}
                        <p className="mt-1">{t("viewer.clickButtonBelowToRetry")}</p>
                      </div>
                    )}
                    <p className="text-sm">{t("viewer.noTranscriptForMedia", { mediaType: mediaType === "audio" ? t("viewer.audio") : t("viewer.video") })}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("viewer.generateTranscriptDesc")}
                    </p>
                    {documentId && (
                      <TranscriptionButton
                        documentId={documentId}
                        documentTitle={title}
                        filePath={documentFilePath ?? undefined}
                        onComplete={handleTranscriptComplete}
                        showStatus
                      />
                    )}
                  </div>
                </div>
              ) : (
                <TranscriptSync
                  segments={transcriptSegments}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                  className="h-full"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Video Features Slide-over Panel */}
      {showVideoFeatures && documentId && (
        <div
          className="absolute top-0 right-0 h-full bg-card border-l border-border shadow-xl z-40 flex flex-col"
          style={{ width: videoFeaturesWidth }}
        >
          {/* Resize handle */}
          <div
            className={`absolute left-0 top-0 h-full w-1 ${isResizingVideoFeatures ? 'bg-primary' : 'bg-border hover:bg-primary/50'} cursor-ew-resize transition-colors`}
            onMouseDown={handleVideoFeaturesResizeStart}
            onTouchStart={handleVideoFeaturesResizeStart}
            title={t("viewer.dragToResize")}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-1 rounded bg-background/80 shadow-sm">
              <GripVertical className="w-3 h-3 text-muted-foreground" />
            </div>
          </div>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">{t("viewer.videoFeaturesTitle")}</h3>
            <button
              onClick={() => setShowVideoFeatures(false)}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Video Features Component (Bookmarks, Chapters, Transcript) */}
            <div className="p-4 border-b border-border">
              <VideoFeatures
                documentId={documentId}
                documentTitle={title}
                filePath={documentFilePath ?? undefined}
                currentTime={currentTime}
                duration={duration}
                onSeek={handleSeek}
              />
            </div>

            {/* Video Extracts Section */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Scissors className="w-4 h-4" />
                  {t("viewer.videoExtracts")}
                </h4>
                <button
                  onClick={handleOpenCreateExtract}
                  className="px-3 py-1 bg-primary text-primary-foreground text-sm rounded-md hover:opacity-90 transition-opacity flex items-center gap-1"
                >
                  <Scissors className="w-3 h-3" />
                  New
                </button>
              </div>
              <VideoExtractsList
                documentId={documentId}
                onPlayExtract={(extract) => handleSeek(extract.start_time, extract.end_time)}
              />
            </div>
          </div>
        </div>
      )}

      <CreateVideoExtractDialog
        documentId={documentId || ''}
        documentTitle={title || (mediaType === "audio" ? "Audio" : "Video")}
        isOpen={showCreateExtract}
        initialStartTime={extractStartTime}
        initialEndTime={extractStartTime > 0 ? extractStartTime + 60 : undefined}
        initialTranscriptText={extractTranscript}
        onClose={() => setShowCreateExtract(false)}
        onCreate={handleExtractCreated}
      />
    </div>
  );
}

// Scroll hint component that shows briefly when video loads
function ScrollHint({ isPlaying: _isPlaying }: { isPlaying: boolean }) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  
  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, 2500);
    const hideTimer = setTimeout(() => {
      setVisible(false);
    }, 3000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);
  
  if (!visible) return null;
  
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      <div 
        className={cn(
          "bg-black/60 text-white px-4 py-3 rounded-lg text-sm transition-opacity duration-500",
          fading && "opacity-0"
        )}
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          <div>
            <div className="font-medium">{t("viewer.scrollToSeek")}</div>
            <div className="text-xs text-white/70">{t("viewer.scrollUpDownToSeek")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
