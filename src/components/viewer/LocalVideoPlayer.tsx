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
  Clock,
  SkipBack,
  SkipForward,
  X,
  Scissors,
  Layers,
  GripVertical,
} from 'lucide-react';
import { cn } from '../../utils';
import { saveDocumentPosition, timePosition } from '../../api/position';
import { getDocumentAuto, updateDocumentProgressAuto } from '../../api/documents';
import { useToast } from '../common/Toast';
import { VideoFeatures } from '../video/VideoFeatures';
import {
  CreateVideoExtractDialog,
  VideoExtractsList,
} from '../video/VideoExtracts';
import { getVideoTranscript } from '../../api/video-extracts';
import { TranscriptSync, TranscriptSegment } from "../media/TranscriptSync";
import {
  enqueueVideoTranscription,
  getVideoTranscriptionStatus,
  setVideoPlaybackActive,
  subscribeVideoTranscriptionStatus,
} from "../../lib/videoTranscriptionQueue";
import { useSettingsStore } from "../../stores/settingsStore";
import { isTauri } from "../../lib/tauri";

interface LocalVideoPlayerProps {
  src: string; // Local file URL or blob URL
  documentId?: string;
  title?: string;
  onLoad?: (metadata: { duration: number; title: string }) => void;
  className?: string;
  mediaType?: "video" | "audio";
}

export function LocalVideoPlayer({
  src,
  documentId,
  title,
  onLoad,
  className = '',
  mediaType = "video",
}: LocalVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const { settings } = useSettingsStore();
  const audioSettings = settings.audioTranscription;

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);

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
  const [positionLoaded, setPositionLoaded] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [documentFilePath, setDocumentFilePath] = useState<string | null>(null);
  const startTimeRef = useRef(0);
  const lastSavedTimeRef = useRef(0);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const documentIdRef = useRef(documentId);

  // Update refs when values change
  useEffect(() => {
    documentIdRef.current = documentId;
  }, [documentId]);

  useEffect(() => {
    startTimeRef.current = startTime;
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

  // Load saved position from document
  const loadSavedPosition = useCallback(async () => {
    if (!documentId) {
      setPositionLoaded(true);
      return;
    }

    try {
      const doc = await getDocumentAuto(documentId);
      setDocumentFilePath(doc?.filePath ?? null);
      const savedTime = doc?.currentPage ?? doc?.current_page ?? 0;
      console.log("[LocalVideoPlayer] Loaded saved time:", {
        documentId,
        savedTime,
        mediaType,
        src,
      });
      if (savedTime >= 3) {
        // Update ref immediately so onLoadedMetadata can use it
        startTimeRef.current = savedTime;
        setStartTime(savedTime);
        // Seek immediately if video is already ready
        if (videoRef.current && videoRef.current.readyState >= 1) {
          videoRef.current.currentTime = savedTime;
          console.log(`[LocalVideoPlayer] Restored position immediately: ${savedTime}s`);
        }
        console.log(`[LocalVideoPlayer] Saved position set: ${savedTime}s`);
      }
    } catch (error) {
      console.log('[LocalVideoPlayer] Failed to load position:', error);
    } finally {
      setPositionLoaded(true);
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

  // Save current position
  const savePosition = useCallback(async (time: number) => {
    const currentDocumentId = documentIdRef.current;
    if (!currentDocumentId) return;

    // Avoid saving if time hasn't changed significantly
    if (Math.abs(time - lastSavedTimeRef.current) < 1) {
      return;
    }

    try {
      const roundedTime = Math.floor(time);
      console.log("[LocalVideoPlayer] Saving position:", {
        documentId: currentDocumentId,
        time: roundedTime,
        duration,
        mediaType,
      });
      await updateDocumentProgressAuto(currentDocumentId, roundedTime);
      if (typeof window !== "undefined" && "__TAURI__" in window) {
        await saveDocumentPosition(
          currentDocumentId,
          timePosition(roundedTime, duration)
        );
      }
      lastSavedTimeRef.current = time;
    } catch (error) {
      console.log('[LocalVideoPlayer] Failed to save position:', error);
    }
  }, [duration, mediaType]);

  // Load position on mount
  useEffect(() => {
    loadSavedPosition();
  }, [loadSavedPosition]);

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

  // Save position when unmounting or pausing
  useEffect(() => {
    return () => {
      // Save on unmount
      if (videoRef.current && documentIdRef.current) {
        savePosition(videoRef.current.currentTime);
      }
    };
  }, [savePosition]);

  // Handle keyboard shortcuts
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

  const buildPlayErrorMessage = (error: unknown) => {
    if (error instanceof DOMException) {
      if (error.name === 'NotSupportedError' || /not supported/i.test(error.message)) {
        return 'This video codec is not supported. Please convert to MP4 (H.264/AAC). '
          + 'Some MP4 files use HEVC/H.265 or AV1 which are unsupported.';
      }
      if (error.name === 'NotAllowedError') {
        return 'Playback was blocked. Click the video to play.';
      }
      return error.message || 'Failed to play video';
    }
    if (error instanceof Error) return error.message;
    return 'Failed to play video';
  };

  const attemptPlay = async (context: string) => {
    if (!videoRef.current) return;
    try {
      await videoRef.current.play();
    } catch (error) {
      const errorMessage = buildPlayErrorMessage(error);
      console.error(`[LocalVideoPlayer] Play error (${context}):`, errorMessage);
      setPlayError(errorMessage);
      toast.error('Playback Error', errorMessage);
    }
  };

  // Toggle play/pause
  const togglePlay = async () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      setPlayError(null);
      await attemptPlay('toggle');
    } else {
      videoRef.current.pause();
    }
  };

  // Seek relative to current position
  const seekRelative = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
    }
  };

  // Seek to percentage
  const seekToPercentage = (percent: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = (duration * percent) / 100;
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
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
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

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    setCurrentTime(time);

    if (
      activeExtractStartTime !== null
      && activeExtractEndTime !== null
      && activeExtractEndTime > activeExtractStartTime
      && time >= activeExtractEndTime
    ) {
      videoRef.current.currentTime = activeExtractStartTime;
      void attemptPlay('extract-loop');
    }
  }, [activeExtractStartTime, activeExtractEndTime]);

  const handleCreateExtract = () => {
    setShowCreateExtract(false);
    // The VideoExtractsList will refresh automatically
    toast.success('Extract created successfully');
  };

  const handleExtractCreated = (extract: any) => {
    setShowCreateExtract(false);
    // Refresh the video features to show the new extract
    // This will be handled by the VideoExtractsList component
  };

  // Get transcript text for the current time range (simplified version)
  const getCurrentTimeTranscript = () => {
    // In a real implementation, this would get the transcript segment
    // for the current time range from the video transcript
    return '';
  };

  // Calculate progress percentage
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleGenerateTranscript = async () => {
    if (!documentId) return;
    if (!isTauri()) {
      toast.error("Desktop app required", "Local video transcription only works in the Tauri app.");
      return;
    }
    if (!documentFilePath) {
      toast.error("Missing file path", "This video does not have a local file path.");
      return;
    }
    if (audioSettings.provider === 'local' && !audioSettings.preferredModelId) {
      toast.error("Model required", "Select a Whisper model in Settings → Audio Transcription.");
      return;
    }

    try {
      await enqueueVideoTranscription({
        documentId,
        filePath: documentFilePath,
        provider: audioSettings.provider,
        modelId: audioSettings.preferredModelId,
        language: audioSettings.language || "en",
      });
      const message = isPlaying
        ? "Transcription will start when playback is idle."
        : "Your video will be transcribed in the background.";
      toast.success("Transcription queued", message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start transcription";
      toast.error("Transcription failed", message);
    }
  };

  const waveformBars = useMemo(() => {
    const seedSource = `${title || ''}|${src}`;
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
  }, [src, title]);

  // Handle scroll to seek
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

  // Handle video click to toggle play/pause
  const handleVideoClick = useCallback((e: React.MouseEvent) => {
    // Only toggle if clicking directly on the video element, not controls
    if (e.target === videoRef.current) {
      togglePlay();
    }
  }, []);

  // Handle double click to toggle fullscreen
  const handleVideoDoubleClick = useCallback((e: React.MouseEvent) => {
    if (e.target === videoRef.current) {
      toggleFullscreen();
    }
  }, []);

  const mediaElement = mediaType === "audio" ? (
    <audio
      ref={videoRef}
      src={src}
      className="sr-only"
      onLoadedMetadata={() => {
        if (videoRef.current) {
          const mediaDuration = videoRef.current.duration;
          setDuration(mediaDuration);
          onLoad?.({ duration: mediaDuration, title: title || 'Audio' });
          if (startTimeRef.current > 0) {
            videoRef.current.currentTime = startTimeRef.current;
            console.log("[LocalVideoPlayer] Seeked audio to saved time:", startTimeRef.current);
          }
          // Apply saved playback rate
          if (playbackRate !== 1) {
            videoRef.current.playbackRate = playbackRate;
            console.log("[LocalVideoPlayer] Applied saved playback rate:", playbackRate);
          }
        }
      }}
      onCanPlay={() => {
        console.log("[LocalVideoPlayer] Audio can play");
        setPlayError(null);
      }}
      onWaiting={() => {
        console.log("[LocalVideoPlayer] Audio waiting for data");
      }}
      onPlay={() => setIsPlaying(true)}
      onPause={() => {
        setIsPlaying(false);
        if (videoRef.current && documentIdRef.current) {
          savePosition(videoRef.current.currentTime);
        }
      }}
      onTimeUpdate={handleTimeUpdate}
      onVolumeChange={() => {
        if (videoRef.current) {
          setVolume(videoRef.current.volume * 100);
          setIsMuted(videoRef.current.muted);
        }
      }}
      onError={(e) => {
        const error = videoRef.current?.error;
        let errorMessage = error
          ? `Error code ${error.code}: ${error.message}`
          : 'Unknown audio error';
        let userFriendlyMessage = errorMessage;

        // Provide codec-specific guidance for audio
        if (error?.code === 3) {
          userFriendlyMessage = 'This audio format is not supported by your browser. '
            + 'Please try converting to MP3, M4A, or WAV format.';
        } else if (error?.code === 4) {
          userFriendlyMessage = 'The audio file could not be loaded. It may be corrupted or in an unsupported format.';
        }

        console.error('[LocalVideoPlayer] Audio error:', errorMessage, e);
        setPlayError(userFriendlyMessage);
        toast.error('Audio Error', userFriendlyMessage);
      }}
    />
  ) : (
    <video
      ref={videoRef}
      src={src}
      className="w-full max-h-full bg-black cursor-pointer"
      onLoadedMetadata={() => {
        if (videoRef.current) {
          const mediaDuration = videoRef.current.duration;
          setDuration(mediaDuration);
          onLoad?.({ duration: mediaDuration, title: title || 'Video' });
          if (startTimeRef.current > 0) {
            videoRef.current.currentTime = startTimeRef.current;
            console.log("[LocalVideoPlayer] Seeked video to saved time:", startTimeRef.current);
          }
          // Apply saved playback rate
          if (playbackRate !== 1) {
            videoRef.current.playbackRate = playbackRate;
            console.log("[LocalVideoPlayer] Applied saved playback rate:", playbackRate);
          }
        }
      }}
      onCanPlay={() => {
        console.log("[LocalVideoPlayer] Video can play");
        setPlayError(null);
      }}
      onWaiting={() => {
        console.log("[LocalVideoPlayer] Video waiting for data");
      }}
      onPlay={() => setIsPlaying(true)}
      onPause={() => {
        setIsPlaying(false);
        if (videoRef.current && documentIdRef.current) {
          savePosition(videoRef.current.currentTime);
        }
      }}
      onTimeUpdate={handleTimeUpdate}
      onVolumeChange={() => {
        if (videoRef.current) {
          setVolume(videoRef.current.volume * 100);
          setIsMuted(videoRef.current.muted);
        }
      }}
      onError={(e) => {
        const error = videoRef.current?.error;
        let errorMessage = error
          ? `Error code ${error.code}: ${error.message}`
          : 'Unknown video error';
        let userFriendlyMessage = errorMessage;

        // Provide codec-specific guidance
        if (error?.code === 3) {
          // MEDIA_ERR_DECODE - codec not supported
          userFriendlyMessage = 'This video format is not supported by your browser. '
            + 'Please try converting the video to MP4 (H.264 codec). '
            + 'Common incompatible formats include HEVC/H.265, AV1, and some MKV files.';
        } else if (error?.code === 4) {
          // MEDIA_ERR_SRC_NOT_SUPPORTED
          userFriendlyMessage = 'The video file could not be loaded. It may be corrupted or in an unsupported format.';
        }

        console.error('[LocalVideoPlayer] Video error:', errorMessage, e);
        setPlayError(userFriendlyMessage);
        toast.error('Video Error', userFriendlyMessage);
      }}
      onWheel={handleScroll}
      onClick={handleVideoClick}
      onDoubleClick={handleVideoDoubleClick}
    />
  );

  const autoInProgress = transcriptionStatus === "queued" || transcriptionStatus === "processing";
  const autoFailed = transcriptionStatus === "failed";
  const autoNeedsModel = transcriptionStatus === "needs-model";
  const autoNeedsApiKey = transcriptionStatus === "needs-api-key";
  const autoFileTooLarge = transcriptionStatus === "file-too-large";

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
      >
        {/* Media Element */}
        {mediaElement}

      {/* Error Display */}
      {playError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="text-center p-6 max-w-md">
            <div className="text-red-500 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Playback Error</h3>
            <p className="text-sm text-gray-300 mb-4">{playError}</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => {
                  setPlayError(null);
                  if (videoRef.current) {
                    videoRef.current.load();
                  }
                }}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
              >
                Retry
              </button>
              <button
                onClick={() => setPlayError(null)}
                className="mt-4 px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:opacity-90"
              >
                Dismiss
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
          <div className="pointer-events-auto flex h-full flex-col justify-between">
        {/* Top Controls */}
        <div className="flex items-center justify-between">
          <div className={cn("text-sm truncate", mediaType === "audio" ? "text-foreground" : "text-white")}>
            {title || (mediaType === "audio" ? "Audio" : "Video")}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleFullscreen}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              title="Fullscreen (F)"
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
            title="Back 10s (←)"
          >
            <SkipBack className={cn("w-5 h-5", mediaType === "audio" ? "text-foreground" : "text-white")} />
          </button>

          <button
            onClick={() => seekRelative(-5)}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
            title="Back 5s"
          >
            <SkipBack className={cn("w-5 h-5", mediaType === "audio" ? "text-foreground" : "text-white")} />
          </button>

          <button
            onClick={togglePlay}
            className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
            title="Play/Pause (Space/K)"
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
            title="Forward 5s"
          >
            <SkipForward className={cn("w-5 h-5", mediaType === "audio" ? "text-foreground" : "text-white")} />
          </button>

          <button
            onClick={() => seekRelative(10)}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
            title="Forward 10s"
          >
            <SkipForward className={cn("w-5 h-5", mediaType === "audio" ? "text-foreground" : "text-white")} />
          </button>
        </div>

        {/* Bottom Controls */}
        <div className="space-y-2">
          {/* Progress Bar */}
          <div
            className="w-full h-1 bg-white/30 rounded-full cursor-pointer group"
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
              <span className="text-sm font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <button
                onClick={() => changePlaybackRate(playbackRate === 1 ? 1.25 : playbackRate === 1.25 ? 1.5 : playbackRate === 1.5 ? 1.75 : playbackRate === 1.75 ? 2 : 1)}
                className="px-2 py-0.5 bg-white/10 rounded text-xs hover:bg-white/20 transition-colors"
                title="Speed"
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
                  title="Mute (M)"
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
                  className="w-20 h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                />
              </div>

              {/* Rotation button */}
              <button
                onClick={toggleFullscreen}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                title="Fullscreen (F)"
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
          <div className="font-semibold mb-1">Shortcuts:</div>
          <div>Space/K: Play/Pause</div>
          <div>←/→: 5s</div>
          <div>↑/↓: Volume</div>
          <div>Scroll: Seek ±5s</div>
          <div>Click: Play/Pause</div>
          <div>Dbl Click: Fullscreen</div>
          <div>M: Mute</div>
          <div>F: Fullscreen</div>
          <div>0-9: Jump to %</div>
          <div>&lt;/&gt;: Speed</div>
        </div>
      </div>

      {/* Resize handle - only in side mode with transcript visible */}
      {transcriptLayout === 'side' && showTranscript && (
        <div
          className={`w-1 flex-shrink-0 relative z-10 ${isResizingTranscript ? 'bg-primary' : 'bg-border hover:bg-primary/50'} cursor-ew-resize transition-colors`}
          onMouseDown={handleTranscriptResizeStart}
          onTouchStart={handleTranscriptResizeStart}
          title="Drag to resize"
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
                  {title || (mediaType === "audio" ? "Audio" : "Video")}
                </h2>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {duration > 0 && <span>Duration: {formatTime(duration)}</span>}
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
                    title="Video Features (Bookmarks, Chapters, Extracts)"
                  >
                    <Layers className="w-4 h-4" />
                    <span className="font-medium">Panels</span>
                  </button>
                )}

                {showTranscript && (
                  <button
                    onClick={() => setTranscriptLayout(transcriptLayout === 'below' ? 'side' : 'below')}
                    className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors flex items-center gap-2"
                    title={transcriptLayout === 'below' ? 'Switch to side-by-side view' : 'Switch to stacked view'}
                  >
                    <span className="text-xs">{transcriptLayout === 'below' ? '↔' : '↕'}</span>
                  </button>
                )}

                <button
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors flex items-center gap-2"
                >
                  <span className="font-medium">{showTranscript ? "Hide" : "Show"} Transcript</span>
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
                    <span className="text-sm">Loading transcript...</span>
                  </div>
                </div>
              ) : transcriptError ? (
                <div className="flex items-center justify-center h-full p-6">
                  <div className="text-center max-w-md">
                    <p className="text-sm font-medium text-foreground mb-2">Transcript Unavailable</p>
                    <p className="text-xs text-muted-foreground">{transcriptError}</p>
                  </div>
                </div>
              ) : transcriptSegments.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground p-6">
                  <div className="text-center space-y-4 max-w-md">
                    {autoInProgress && (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary">
                        Transcribing in the background…
                      </div>
                    )}
                    {isTauri() && autoNeedsModel && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                        <p className="font-medium">Model required for transcription</p>
                        <p className="mt-1 text-amber-800/90">
                          Download a model in Settings → Audio Transcription to enable transcription.
                        </p>
                      </div>
                    )}
                    {autoNeedsApiKey && (
                      <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-xs text-orange-900">
                        <p className="font-medium">Groq API key required</p>
                        <p className="mt-1 text-orange-800/90">
                          Add your Groq API key in Settings → Audio Transcription to use cloud transcription.
                        </p>
                      </div>
                    )}
                    {autoFileTooLarge && (
                      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900">
                        <p className="font-medium">File too large</p>
                        <p className="mt-1 text-blue-800/90">
                          {isTauri() 
                            ? "This video exceeds Groq's 25MB free tier limit. Switch to Local Whisper in settings."
                            : "This video is too large to transcribe in the web app. Please use the desktop app for large files."}
                        </p>
                      </div>
                    )}
                    {autoFailed && (
                      <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                        Background transcription failed. You can try again manually.
                      </div>
                    )}
                    <p className="text-sm">No transcript available for this video.</p>
                    <button
                      onClick={handleGenerateTranscript}
                      disabled={autoInProgress || !documentId}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                    >
                      Generate Transcript
                    </button>
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
            title="Drag to resize"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-1 rounded bg-background/80 shadow-sm">
              <GripVertical className="w-3 h-3 text-muted-foreground" />
            </div>
          </div>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">Video Features</h3>
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
                  Video Extracts
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
function ScrollHint({ isPlaying }: { isPlaying: boolean }) {
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
            <div className="font-medium">Scroll to seek</div>
            <div className="text-xs text-white/70">Scroll up/down to rewind/forward</div>
          </div>
        </div>
      </div>
    </div>
  );
}
