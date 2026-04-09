/**
 * Audiobook Viewer
 * 
 * Full-featured audiobook player with:
 - Playback controls (play, pause, skip, speed)
 - Chapter navigation
 - Bookmark management
 - Sleep timer
 - Transcript sync and text selection
 - Extract creation from audio + text
 - Progress tracking
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Bookmark,
  BookmarkPlus,
  List,
  Clock,
  Moon,
  X,
  FileText,
  Headphones,
  Maximize2,
  Minimize2,
  Loader2,
  Mic,
} from "lucide-react";
import { cn } from "../../utils";
import { Document } from "../../types/document";
import { useI18n } from "../../lib/i18n";
import {
  AudiobookMetadata,
  AudiobookChapter,
  AudiobookTranscript,
  formatDuration,
  extractAudioCoverArt,
  searchAudiobookCover,
} from "../../api/audiobooks";
import { useToast } from "../common/Toast";
import { CreateExtractDialog } from "../extracts/CreateExtractDialog";
import { useTranscriptionStore } from "../../stores/useTranscriptionStore";
import { startTranscription } from "../../api/transcription";
import { isTauri } from "../../lib/tauri";
import { readDocumentFile, updateDocument as updateDocumentApi, updateDocumentProgressAuto } from "../../api/documents";
import { getDocumentPosition, saveDocumentPosition, timePosition } from "../../api/position";

interface AudiobookViewerProps {
  document: Document;
  fileContent?: string; // Base64 or URL
}

interface AudiobookBookmark {
  id: string;
  time: number;
  title: string;
  note?: string;
  createdAt: string;
}

interface SleepTimer {
  minutes: number;
  endTime: number;
}

interface MultiPartInfo {
  totalParts: number;
  partFiles: string[];
  partDurations: number[];
}

export function AudiobookViewer({ document, fileContent }: AudiobookViewerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const { success: showSuccess, info: showInfo, error: showError } = useToast();
  const { t } = useI18n();
  const { profiles, fetchProfiles, currentStatus, activeJob, activeSegments, loadTranscript, transcriptionProgress } = useTranscriptionStore();
  
  // Core playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [buffered, setBuffered] = useState(0);
  
  // Multi-part handling
  const [multiPartInfo, setMultiPartInfo] = useState<MultiPartInfo | null>(null);
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [partSources, setPartSources] = useState<string[]>([]);
  
  // Audiobook data
  const [metadata, setMetadata] = useState<Partial<AudiobookMetadata>>({});
  const [chapters, setChapters] = useState<AudiobookChapter[]>([]);
  const [transcript, setTranscript] = useState<AudiobookTranscript | null>(null);
  const [bookmarks, setBookmarks] = useState<AudiobookBookmark[]>([]);
  
  // UI state
  const [showChapters, setShowChapters] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [isExtractDialogOpen, setIsExtractDialogOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sleepTimer, setSleepTimer] = useState<SleepTimer | null>(null);
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);
  const [hasTriedFallback, setHasTriedFallback] = useState(false);
  const [localCoverUrl, setLocalCoverUrl] = useState<string | undefined>(document.coverImageUrl);

  const documentIdRef = useRef(document.id);
  const currentTimeRef = useRef(0);
  const currentGlobalTimeRef = useRef(0);
  const durationRef = useRef(0);
  const totalDurationSecondsRef = useRef<number | undefined>(undefined);
  const lastSavedGlobalTimeRef = useRef(0);
  const pendingSeekTimeRef = useRef<number | null>(null);

  // Auto-fetch cover if document has none
  useEffect(() => {
    if (document.coverImageUrl) {
      setLocalCoverUrl(document.coverImageUrl);
      return;
    }

    let cancelled = false;

    const fetchCover = async () => {
      try {
        // Step 1: Try to extract embedded cover from audio file
        const embeddedCover = await extractAudioCoverArt(document.filePath);
        if (cancelled) return;

        if (embeddedCover) {
          setLocalCoverUrl(embeddedCover);
          await updateDocumentApi(document.id, {
            ...document,
            coverImageUrl: embeddedCover,
          } as any);
          return;
        }

        // Step 2: Search Google Books using title/author
        const author = metadata.author || document.metadata?.author;
        const covers = await searchAudiobookCover(document.title, author);
        if (cancelled) return;

        if (covers.length > 0) {
          setLocalCoverUrl(covers[0]);
          await updateDocumentApi(document.id, {
            ...document,
            coverImageUrl: covers[0],
          } as any);
        }
      } catch (error) {
        console.error("[AudiobookViewer] Failed to auto-fetch cover:", error);
      }
    };

    fetchCover();

    return () => { cancelled = true; };
  }, [document.id, document.coverImageUrl]);

  // Debug fileContent
  useEffect(() => {
    console.log('[AudiobookViewer] fileContent:', fileContent ? fileContent.substring(0, 100) + '...' : 'undefined');
  }, [fileContent]);

  // Load audiobook data
  useEffect(() => {
    documentIdRef.current = document.id;
    const loadAudiobookData = async () => {
      const data = localStorage.getItem(`audiobook-${document.id}`);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          setMetadata(parsed.metadata || {});
          setChapters(parsed.chapters || []);
          setTranscript(parsed.transcript || null);
          
          // Check for multi-part info
          if (parsed.multiPart) {
            setMultiPartInfo(parsed.multiPart);
            setPartSources(parsed.multiPart.partFiles);
          }
        } catch {
          // Invalid data
        }
      }
      
      // Load bookmarks
      const bookmarksData = localStorage.getItem(`audiobook-${document.id}-bookmarks`);
      if (bookmarksData) {
        try {
          setBookmarks(JSON.parse(bookmarksData));
        } catch {
          // Invalid data
        }
      }
    };
    
    loadAudiobookData();
  }, [document.id]);

  const getTotalDurationSeconds = useCallback((): number | undefined => {
    if (multiPartInfo?.partDurations?.length) {
      const sum = multiPartInfo.partDurations.reduce(
        (acc, d) => acc + (Number.isFinite(d) ? d : 0),
        0
      );
      return Number.isFinite(sum) && sum > 0 ? Math.floor(sum) : undefined;
    }
    return Number.isFinite(durationRef.current) && durationRef.current > 0
      ? Math.floor(durationRef.current)
      : undefined;
  }, [multiPartInfo?.partDurations]);

  // Keep a ref for cleanup/unmount saves (avoid stale closures).
  useEffect(() => {
    totalDurationSecondsRef.current = getTotalDurationSeconds();
  }, [getTotalDurationSeconds, duration, multiPartInfo?.partDurations]);

  const toGlobalSeconds = useCallback(
    (partIndex: number, timeInPart: number): number => {
      if (!multiPartInfo?.partDurations?.length) return timeInPart;
      const base = multiPartInfo.partDurations
        .slice(0, Math.max(0, partIndex))
        .reduce((acc, d) => acc + (Number.isFinite(d) ? d : 0), 0);
      return base + timeInPart;
    },
    [multiPartInfo?.partDurations]
  );

  const fromGlobalSeconds = useCallback(
    (globalSeconds: number): { partIndex: number; timeInPart: number } => {
      if (!multiPartInfo?.partDurations?.length) {
        return { partIndex: 0, timeInPart: globalSeconds };
      }

      const totalParts = multiPartInfo.partDurations.length;
      let remaining = Math.max(0, globalSeconds);
      for (let i = 0; i < totalParts; i++) {
        const d = Number.isFinite(multiPartInfo.partDurations[i]) ? multiPartInfo.partDurations[i] : 0;
        if (remaining < d || i === totalParts - 1) {
          return { partIndex: i, timeInPart: Math.min(remaining, Math.max(0, d - 0.25)) };
        }
        remaining -= d;
      }

      return { partIndex: 0, timeInPart: globalSeconds };
    },
    [multiPartInfo?.partDurations]
  );

  const savePosition = useCallback(
    async (timeInPart: number) => {
      const docId = documentIdRef.current;
      if (!docId) return;

      const globalSeconds = toGlobalSeconds(currentPartIndex, timeInPart);
      const rounded = Math.floor(globalSeconds);

      if (!Number.isFinite(rounded) || rounded < 0) return;
      if (Math.abs(rounded - lastSavedGlobalTimeRef.current) < 1) return;

      try {
        await updateDocumentProgressAuto(docId, rounded);
        await saveDocumentPosition(docId, timePosition(rounded, getTotalDurationSeconds()));
        lastSavedGlobalTimeRef.current = rounded;
      } catch (error) {
        console.warn("[AudiobookViewer] Failed to save position:", error);
      }
    },
    [currentPartIndex, getTotalDurationSeconds, toGlobalSeconds]
  );

  const loadSavedPosition = useCallback(async () => {
    let savedSeconds: number | null = null;

    try {
      const pos = await getDocumentPosition(document.id);
      if (pos?.type === "time" && typeof pos.seconds === "number") {
        savedSeconds = pos.seconds;
      }
    } catch (error) {
      console.warn("[AudiobookViewer] Failed to load saved position from position API:", error);
    }

    if (savedSeconds == null && typeof document.currentPage === "number") {
      savedSeconds = document.currentPage;
    }

    if (savedSeconds == null || !Number.isFinite(savedSeconds) || savedSeconds <= 0) {
      return;
    }

    const { partIndex, timeInPart } = fromGlobalSeconds(savedSeconds);
    if (multiPartInfo && partIndex !== currentPartIndex) {
      setCurrentPartIndex(partIndex);
    }
    pendingSeekTimeRef.current = timeInPart;
  }, [currentPartIndex, document.currentPage, document.id, fromGlobalSeconds, multiPartInfo]);

  // Load saved progress + audio prefs
  useEffect(() => {
    void loadSavedPosition();
    
    const savedVolume = localStorage.getItem("audiobook-volume");
    if (savedVolume) {
      setVolume(parseFloat(savedVolume));
      if (audioRef.current) {
        audioRef.current.volume = parseFloat(savedVolume);
      }
    }
    
    const savedRate = localStorage.getItem("audiobook-rate");
    if (savedRate) {
      setPlaybackRate(parseFloat(savedRate));
      if (audioRef.current) {
        audioRef.current.playbackRate = parseFloat(savedRate);
      }
    }
  }, [document.id, document.currentPage, loadSavedPosition]);
  
  // Audio event handlers
  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      currentTimeRef.current = time;
      currentGlobalTimeRef.current = toGlobalSeconds(currentPartIndex, time);
      
      // Update active transcript segment
      if (transcript?.segments) {
        const segment = transcript.segments.find(
          s => time >= s.startTime && time < s.endTime
        );
        if (segment && segment.id !== activeSegmentId) {
          setActiveSegmentId(segment.id);
          // Scroll segment into view using container-relative scrolling
          // to avoid scrolling the entire page and affecting other elements
          const element = window.document.getElementById(`segment-${segment.id}`);
          const container = transcriptRef.current;
          if (element && container && showTranscript) {
            // Calculate the element's position relative to the container
            const containerRect = container.getBoundingClientRect();
            const elementRect = element.getBoundingClientRect();
            
            // Calculate relative position (accounting for container's scroll position)
            const relativeTop = elementRect.top - containerRect.top + container.scrollTop;
            const elementHeight = elementRect.height;
            const containerHeight = containerRect.height;
            
            // Calculate target scroll position to center the element
            const targetScrollTop = relativeTop - (containerHeight / 2) + (elementHeight / 2);
            
            // Only scroll if the element is outside the visible area (with some padding)
            const padding = 50;
            const isAbove = elementRect.top < containerRect.top + padding;
            const isBelow = elementRect.bottom > containerRect.bottom - padding;
            
            if (isAbove || isBelow) {
              container.scrollTo({
                top: targetScrollTop,
                behavior: "smooth",
              });
            }
          }
        }
      }
      
      // Update buffered progress
      if (audioRef.current.buffered.length > 0) {
        setBuffered(audioRef.current.buffered.end(audioRef.current.buffered.length - 1));
      }
    }
  }, [activeSegmentId, currentPartIndex, showTranscript, toGlobalSeconds, transcript]);
  
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      durationRef.current = audioRef.current.duration;

      // Apply a deferred seek after the correct src has loaded.
      if (pendingSeekTimeRef.current != null) {
        const t = pendingSeekTimeRef.current;
        pendingSeekTimeRef.current = null;
        audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.duration || t, t));
        setCurrentTime(audioRef.current.currentTime);
        currentTimeRef.current = audioRef.current.currentTime;
      }
    }
  };
  
  const handleEnded = () => {
    // Check if this is a multi-part book and there are more parts
    if (multiPartInfo && currentPartIndex < multiPartInfo.partFiles.length - 1) {
      const nextPartIndex = currentPartIndex + 1;
      setCurrentPartIndex(nextPartIndex);
      currentTimeRef.current = 0;
      currentGlobalTimeRef.current = toGlobalSeconds(nextPartIndex, 0);
      // Load next part - audio element will auto-play if it was playing
      if (audioRef.current) {
        audioRef.current.src = partSources[nextPartIndex] || "";
        audioRef.current.load();
        audioRef.current.play().catch(() => {
          setIsPlaying(false);
        });
      }
      showInfo(t("viewer.nextPart"), t("viewer.playingPart", { current: nextPartIndex + 1, total: multiPartInfo.partFiles.length }));
      return;
    }
    
    setIsPlaying(false);
    showInfo(t("viewer.audiobookFinished"), t("viewer.reachedTheEnd"));
  };
  
  // Go to specific part (for multi-part books)
  const goToPart = (partIndex: number) => {
    if (!multiPartInfo || partIndex < 0 || partIndex >= multiPartInfo.partFiles.length) return;
    
    setCurrentPartIndex(partIndex);
    currentTimeRef.current = 0;
    currentGlobalTimeRef.current = toGlobalSeconds(partIndex, 0);
    if (audioRef.current) {
      audioRef.current.src = partSources[partIndex] || "";
      audioRef.current.load();
      audioRef.current.play().catch(() => {
        setIsPlaying(false);
      });
    }
  };
  
  // Playback controls
  const togglePlay = () => {
    console.log('[AudiobookViewer] togglePlay:', { isPlaying, src: audioRef.current?.src, readyState: audioRef.current?.readyState });
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        console.log('[AudiobookViewer] Attempting to play...');
        audioRef.current.play().catch(err => {
          console.error('[AudiobookViewer] Play error:', err);
        });
      }
    } else {
      console.warn('[AudiobookViewer] No audio ref');
    }
  };

  const handlePause = () => {
    setIsPlaying(false);
    if (audioRef.current) {
      void savePosition(audioRef.current.currentTime);
    }
  };

  const getAudioMimeType = (path?: string) => {
    const ext = path?.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "wav":
        return "audio/wav";
      case "m4a":
      case "m4b":
        return "audio/mp4";
      case "aac":
        return "audio/aac";
      case "ogg":
        return "audio/ogg";
      case "flac":
        return "audio/flac";
      case "opus":
        return "audio/opus";
      case "mp3":
      default:
        return "audio/mpeg";
    }
  };

  const handleAudioError = async () => {
    const error = audioRef.current?.error;
    const src = audioRef.current?.currentSrc || audioRef.current?.src;
    console.error("[AudiobookViewer] Audio error:", { code: error?.code, message: error?.message, src });

    if (hasTriedFallback) {
      showError(
        t("viewer.playbackFailed"),
        t("viewer.audioFormatNotSupported")
      );
      return;
    }

    if (!isTauri() || !document.filePath) {
      showError(t("viewer.playbackFailed"), t("viewer.unableToLoadAudio"));
      return;
    }

    // Fallback: read file into memory and create a blob URL (slower, but avoids file-scope issues).
    try {
      setHasTriedFallback(true);
      showInfo(t("viewer.loadingAudio"), t("viewer.directPlaybackFailed"));
      const base64Data = await readDocumentFile(document.filePath);
      if (!base64Data) {
        throw new Error("Empty file data");
      }
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const mimeType = getAudioMimeType(document.filePath);
      const blobUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
      setFallbackSrc(blobUrl);
      showSuccess(t("viewer.audioLoaded"), t("viewer.retryPlay"));
    } catch (err) {
      showError(
        t("viewer.playbackFailed"),
        err instanceof Error ? err.message : t("viewer.unableToLoadAudio")
      );
    }
  };
  
  const seek = (time: number) => {
    if (audioRef.current) {
      const clamped = Math.max(0, Math.min(duration, time));
      audioRef.current.currentTime = clamped;
      setCurrentTime(clamped);
      currentTimeRef.current = clamped;
      currentGlobalTimeRef.current = toGlobalSeconds(currentPartIndex, clamped);
    }
  };

  // Auto-save every 5s while playing
  useEffect(() => {
    if (!isPlaying) return;

    const id = window.setInterval(() => {
      if (audioRef.current) {
        void savePosition(audioRef.current.currentTime);
      }
    }, 5000);

    return () => window.clearInterval(id);
  }, [isPlaying, savePosition]);

  // Save on unmount
  useEffect(() => {
    return () => {
      const docId = documentIdRef.current;
      const globalRounded = Math.floor(
        Number.isFinite(currentGlobalTimeRef.current) && currentGlobalTimeRef.current > 0
          ? currentGlobalTimeRef.current
          : currentTimeRef.current
      );
      if (docId && Number.isFinite(globalRounded) && globalRounded > 0) {
        // Fire-and-forget in cleanup.
        void updateDocumentProgressAuto(docId, globalRounded);
        void saveDocumentPosition(docId, timePosition(globalRounded, totalDurationSecondsRef.current));
      }
    };
  }, []); // Empty deps: refs carry the latest values
  
  const skip = (seconds: number) => {
    seek(currentTime + seconds);
  };
  
  const goToChapter = (chapter: AudiobookChapter) => {
    seek(chapter.startTime);
    setShowChapters(false);
  };
  
  // Volume controls
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      audioRef.current.muted = newVolume === 0;
    }
    localStorage.setItem("audiobook-volume", newVolume.toString());
  };
  
  const toggleMute = () => {
    if (audioRef.current) {
      const newMuted = !isMuted;
      audioRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (!newMuted && volume === 0) {
        setVolume(0.5);
        audioRef.current.volume = 0.5;
      }
    }
  };
  
  // Playback rate
  const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  const cyclePlaybackRate = () => {
    const currentIndex = playbackRates.indexOf(playbackRate);
    const nextRate = playbackRates[(currentIndex + 1) % playbackRates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
    localStorage.setItem("audiobook-rate", nextRate.toString());
  };
  
  // Bookmarks
  const addBookmark = () => {
    const chapter = getCurrentChapter();
    const newBookmark: AudiobookBookmark = {
      id: `bookmark-${Date.now()}`,
      time: currentTime,
      title: chapter?.title || `${t("viewer.bookmark")} @ ${formatDuration(currentTime)}`,
      createdAt: new Date().toISOString(),
    };
    
    const updated = [...bookmarks, newBookmark];
    setBookmarks(updated);
    localStorage.setItem(`audiobook-${document.id}-bookmarks`, JSON.stringify(updated));
    showSuccess("Bookmark added", `Saved at ${formatDuration(currentTime)}`);
  };
  
  const deleteBookmark = (id: string) => {
    const updated = bookmarks.filter(b => b.id !== id);
    setBookmarks(updated);
    localStorage.setItem(`audiobook-${document.id}-bookmarks`, JSON.stringify(updated));
  };
  
  const goToBookmark = (bookmark: AudiobookBookmark) => {
    seek(bookmark.time);
    setShowBookmarks(false);
  };
  
  // Sleep timer
  const startSleepTimer = (minutes: number) => {
    const endTime = Date.now() + minutes * 60 * 1000;
    setSleepTimer({ minutes, endTime });
    setShowSleepTimer(false);
    showSuccess("Sleep timer set", `Playback will pause in ${minutes} minutes`);
  };
  
  const cancelSleepTimer = () => {
    setSleepTimer(null);
  };
  
  // Check sleep timer
  useEffect(() => {
    if (!sleepTimer) return;
    
    const interval = setInterval(() => {
      if (Date.now() >= sleepTimer.endTime) {
        if (audioRef.current && isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
        setSleepTimer(null);
        showInfo("Sleep timer", "Playback paused");
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [sleepTimer, isPlaying, showInfo]);
  
  // Get current chapter
  const getCurrentChapter = (): AudiobookChapter | null => {
    if (!chapters.length) return null;
    
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (currentTime >= chapters[i].startTime) {
        return chapters[i];
      }
    }
    return chapters[0];
  };
  
  const handleTranscribe = async () => {
    if (!document.filePath) {
      showError("Transcription Error", "No file path available for this document");
      return;
    }

    if (profiles.length === 0) {
      await fetchProfiles();
    }

    // Default to the first profile (usually distil-small.en)
    const profile = profiles.find(p => p.id === "distil-small.en") || profiles[0];
    if (!profile) {
      showError("Transcription Error", "No transcription models found. Please check settings.");
      return;
    }

    try {
      const currentChapter = getCurrentChapter();
      await startTranscription(
        document.id,
        currentChapter?.id?.toString() || "default",
        document.filePath,
        profile.id,
        "en" // TODO: Detect language or use setting
      );
      showSuccess("Transcription Started", "Transcribing in background...");
    } catch (err) {
      showError("Transcription Failed", String(err));
    }
  };

  const isCurrentTranscribing = activeJob?.bookId === document.id;

  // Text selection for extracts
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      setSelectedText(selection.toString());
    }
  };
  
  const createExtractFromSelection = () => {
    if (selectedText) {
      setIsExtractDialogOpen(true);
    }
  };
  
  // Current chapter
  const currentChapter = getCurrentChapter();

  useEffect(() => {
    if (!showTranscript) return;
    if (transcript?.segments?.length) return;
    if (activeSegments.length > 0) return;

    const chapterId = currentChapter?.id?.toString() || "default";
    loadTranscript(document.id, chapterId).catch((err) => {
      console.warn("[AudiobookViewer] Failed to load transcript:", err);
    });
  }, [
    showTranscript,
    transcript?.segments?.length,
    activeSegments.length,
    loadTranscript,
    document.id,
    currentChapter?.id,
  ]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          skip(e.shiftKey ? -30 : -10);
          break;
        case "ArrowRight":
          e.preventDefault();
          skip(e.shiftKey ? 30 : 10);
          break;
        case "ArrowUp":
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.1));
          break;
        case "ArrowDown":
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.1));
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "s":
          e.preventDefault();
          cyclePlaybackRate();
          break;
        case "b":
          e.preventDefault();
          addBookmark();
          break;
        case "t":
          e.preventDefault();
          setShowTranscript(prev => !prev);
          break;
        case "c":
          e.preventDefault();
          setShowChapters(prev => !prev);
          break;
        case "f":
          e.preventDefault();
          setIsFullscreen(prev => !prev);
          break;
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, volume, playbackRate]);
  
  // Progress bar click handler
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    seek(percent * duration);
  };
  
  return (
    <div className={cn(
      "flex flex-col bg-background h-full",
      isFullscreen && "fixed inset-0 z-50"
    )}>
      {/* Audio element - use fileContent (blob URL) when available, otherwise fall back to partSources */}
      <audio
        ref={audioRef}
        src={fallbackSrc || fileContent || (multiPartInfo ? partSources[currentPartIndex] || "" : "")}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={handlePause}
        onError={handleAudioError}
      />
      
      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Chapters/Bookmarks */}
        {(showChapters || showBookmarks) && (
          <div className="w-80 border-r border-border bg-card flex flex-col">
            <div className="flex items-center justify-between border-b border-border p-3">
              <h3 className="font-semibold">
                {showChapters ? t("viewer.chapters") : t("viewer.bookmarks")}
              </h3>
              <button
                onClick={() => {
                  setShowChapters(false);
                  setShowBookmarks(false);
                }}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            {/* Part selector for multi-part books */}
            {showChapters && multiPartInfo && (
              <div className="border-b border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground mb-2">{t("viewer.selectPart")}</p>
                <div className="grid grid-cols-5 gap-1">
                  {multiPartInfo.partFiles.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => goToPart(idx)}
                      className={cn(
                        "px-2 py-1.5 text-xs rounded transition-colors",
                        currentPartIndex === idx
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      )}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex-1 overflow-y-auto">
              {showChapters && chapters.map((chapter) => (
                <button
                  key={chapter.id}
                  onClick={() => goToChapter(chapter)}
                  className={cn(
                    "w-full px-4 py-3 text-left hover:bg-muted transition-colors border-b border-border/50",
                    currentChapter?.id === chapter.id && "bg-primary/10 text-primary"
                  )}
                >
                  <p className="text-sm font-medium">{chapter.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDuration(chapter.startTime)}
                  </p>
                </button>
              ))}
              
              {showBookmarks && (
                <>
                  {bookmarks.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      {t("viewer.noBookmarksYet")}
                    </div>
                  ) : (
                    bookmarks.map(bookmark => (
                      <div
                        key={bookmark.id}
                        className="flex items-start gap-2 px-4 py-3 border-b border-border/50 hover:bg-muted group"
                      >
                        <button
                          onClick={() => goToBookmark(bookmark)}
                          className="flex-1 text-left"
                        >
                          <p className="text-sm font-medium">{bookmark.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDuration(bookmark.time)}
                          </p>
                          {bookmark.note && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {bookmark.note}
                            </p>
                          )}
                        </button>
                        <button
                          onClick={() => deleteBookmark(bookmark.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 hover:text-destructive rounded"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </div>
        )}
        
        {/* Center - Main player */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Cover and info */}
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="flex flex-col items-center max-w-md w-full">
              {/* Cover */}
              <div
                className="relative mb-6 aspect-square w-full max-w-[300px] rounded-xl overflow-hidden shadow-2xl cursor-pointer group"
                onClick={togglePlay}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePlay(); } }}
                aria-label={isPlaying ? t("viewer.pause") : t("viewer.play")}
              >
                {localCoverUrl ? (
                  <img
                    src={localCoverUrl}
                    alt={document.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-muted flex items-center justify-center">
                    <Headphones className="h-24 w-24 text-muted-foreground" />
                  </div>
                )}

                {/* Play/pause overlay on hover */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all duration-200">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {isPlaying ? (
                      <Pause className="h-16 w-16 text-white drop-shadow-lg" />
                    ) : (
                      <Play className="h-16 w-16 text-white drop-shadow-lg" />
                    )}
                  </div>
                </div>

                {/* Playing indicator */}
                {isPlaying && (
                  <div className="absolute bottom-4 right-4 flex gap-1">
                    {[1, 2, 3].map(i => (
                      <div
                        key={i}
                        className="w-1 h-4 bg-primary rounded-full animate-pulse"
                        style={{ animationDelay: `${i * 0.1}s` }}
                      />
                    ))}
                  </div>
                )}
              </div>
              
              {/* Info */}
              <h1 className="text-xl font-bold text-center mb-1">{document.title}</h1>
              <p className="text-muted-foreground text-center mb-2">
                {metadata.author || document.metadata?.author}
              </p>
              
              {/* Multi-part indicator */}
              {multiPartInfo && (
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-xs text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    {t("viewer.partOf", { current: currentPartIndex + 1, total: multiPartInfo.partFiles.length })}
                  </span>
                </div>
              )}
              
              {currentChapter && (
                <p className="text-sm text-primary text-center">
                  {currentChapter.title}
                </p>
              )}
            </div>
          </div>
          
          {/* Controls */}
          <div className="border-t border-border bg-card p-4">
            {/* Progress bar */}
            <div className="mb-4">
              <div 
                className="h-2 bg-muted rounded-full cursor-pointer relative group"
                onClick={handleProgressClick}
              >
                {/* Buffered */}
                <div 
                  className="absolute h-full bg-muted-foreground/30 rounded-full"
                  style={{ width: `${(buffered / duration) * 100}%` }}
                />
                {/* Played */}
                <div 
                  className="absolute h-full bg-primary rounded-full"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
                {/* Handle */}
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ left: `calc(${(currentTime / duration) * 100}% - 8px)` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{formatDuration(currentTime)}</span>
                <span>{formatDuration(duration)}</span>
              </div>
            </div>
            
            {/* Control buttons */}
            <div className="flex items-center justify-between">
              {/* Left - Secondary controls */}
              <div className="flex items-center gap-2">
                {/* Chapters */}
                <button
                  onClick={() => {
                    setShowChapters(!showChapters);
                    setShowBookmarks(false);
                  }}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    showChapters ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  )}
                  title={t("viewer.chapters")}
                >
                  <List className="h-5 w-5" />
                </button>
                
                {/* Bookmarks */}
                <button
                  onClick={() => {
                    setShowBookmarks(!showBookmarks);
                    setShowChapters(false);
                  }}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    showBookmarks ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  )}
                  title={t("viewer.bookmarks")}
                >
                  <Bookmark className="h-5 w-5" />
                </button>
                
                {/* Add bookmark */}
                <button
                  onClick={addBookmark}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                  title={t("viewer.addBookmark")}
                >
                  <BookmarkPlus className="h-5 w-5" />
                </button>
              </div>
              
              {/* Center - Main playback */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => skip(-30)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                  title={t("viewer.skipBack30s")}
                >
                  <SkipBack className="h-5 w-5" />
                </button>
                
                <button
                  onClick={togglePlay}
                  className="p-4 bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-opacity"
                  title={t("viewer.playPause")}
                >
                  {isPlaying ? (
                    <Pause className="h-6 w-6" />
                  ) : (
                    <Play className="h-6 w-6" />
                  )}
                </button>
                
                <button
                  onClick={() => skip(30)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                  title={t("viewer.skipForward30s")}
                >
                  <SkipForward className="h-5 w-5" />
                </button>
              </div>
              
              {/* Right - Additional controls */}
              <div className="flex items-center gap-2">
                {/* Sleep timer indicator */}
                {sleepTimer && (
                  <button
                    onClick={cancelSleepTimer}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-amber-500 bg-amber-500/10 rounded-lg hover:bg-amber-500/20"
                    title={t("viewer.cancelSleepTimer")}
                  >
                    <Moon className="h-3 w-3" />
                    {formatDuration(Math.max(0, (sleepTimer.endTime - Date.now()) / 1000))}
                  </button>
                )}
                
                {/* Sleep timer */}
                <button
                  onClick={() => setShowSleepTimer(!showSleepTimer)}
                  className={cn(
                    "p-2 rounded-lg transition-colors relative",
                    showSleepTimer ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  )}
                  title={t("viewer.sleepTimer")}
                >
                  <Clock className="h-5 w-5" />
                </button>
                
                {/* Speed */}
                <button
                  onClick={cyclePlaybackRate}
                  className="px-2 py-1 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
                  title={t("viewer.playbackSpeed")}
                >
                  {playbackRate}x
                </button>
                
                {/* Volume */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={toggleMute}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                    title={t("viewer.mute")}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-5 w-5" />
                    ) : (
                      <Volume2 className="h-5 w-5" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-20 h-1 bg-muted rounded-full appearance-none cursor-pointer"
                  />
                </div>
                
                {/* Transcript toggle */}
                <button
                  onClick={() => setShowTranscript(!showTranscript)}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    showTranscript ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  )}
                  title={t("viewer.transcript")}
                >
                  <FileText className="h-5 w-5" />
                </button>
                
                {/* Fullscreen */}
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                  title={t("viewer.fullscreen")}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-5 w-5" />
                  ) : (
                    <Maximize2 className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right sidebar - Transcript */}
        {showTranscript && (
          <div className="w-96 border-l border-border bg-card flex flex-col">
            <div className="flex items-center justify-between border-b border-border p-3">
              <h3 className="font-semibold">{t("viewer.transcript")}</h3>
              <button
                onClick={() => setShowTranscript(false)}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div 
              ref={transcriptRef}
              className="flex-1 overflow-y-auto overscroll-contain p-4"
              onMouseUp={handleTextSelection}
            >
              {(transcript || activeSegments.length > 0) ? (
                <>
                  {/* Extract button for selected text */}
                  {selectedText && (
                    <div className="sticky top-0 mb-4 p-2 bg-primary/10 rounded-lg flex items-center justify-between">
                      <span className="text-sm text-primary truncate flex-1 mr-2">
                        {selectedText.substring(0, 50)}...
                      </span>
                      <button
                        onClick={createExtractFromSelection}
                        className="px-3 py-1 bg-primary text-primary-foreground text-sm rounded-lg hover:opacity-90"
                      >
                        {t("viewer.extractButton")}
                      </button>
                    </div>
                  )}
                  
                  {/* Transcript segments */}
                  <div className="space-y-2">
                    {(transcript?.segments || activeSegments).map((segment, idx) => {
                      const id = (segment as any).id || `seg-${idx}`;
                      const startTime = (segment as any).startTime ?? (segment as any).start_ms / 1000;
                      
                      return (
                        <div
                          key={id}
                          id={`segment-${id}`}
                          className={cn(
                            "p-3 rounded-lg cursor-pointer transition-colors",
                            activeSegmentId === id
                              ? "bg-primary/10 border-l-4 border-primary"
                              : "hover:bg-muted/50 border-l-4 border-transparent"
                          )}
                          onClick={() => seek(startTime)}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-muted-foreground">
                              {formatDuration(startTime)}
                            </span>
                            {(segment as any).speaker && (
                              <span className="text-xs text-primary">{(segment as any).speaker}</span>
                            )}
                          </div>
                          <p className="text-sm leading-relaxed">{segment.text}</p>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">{t("viewer.noTranscriptAvailable")}</p>
                  
                  <div className="mt-6 space-y-4">
                    <button
                      onClick={handleTranscribe}
                      disabled={isCurrentTranscribing || currentStatus === 'processing'}
                      className="w-full flex flex-col items-center justify-center gap-1 px-4 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2">
                        {isCurrentTranscribing ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            {t("viewer.transcribing")}
                          </>
                        ) : (
                          <>
                            <Mic className="w-5 h-5" />
                            {t("viewer.startLocalTranscription")}
                          </>
                        )}
                      </div>
                      
                      {isCurrentTranscribing && (
                        <div className="w-full mt-2 px-1">
                          <div className="flex justify-between text-[10px] mb-1 opacity-90">
                            <span>{t("viewer.overallProgress")}</span>
                            <span>{transcriptionProgress}%</span>
                          </div>
                          <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-white transition-all duration-300"
                              style={{ width: `${transcriptionProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </button>
                    <p className="text-xs" dangerouslySetInnerHTML={{ __html: t("viewer.usesWhisper") }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Sleep timer popup */}
      {showSleepTimer && (
        <div className="absolute bottom-20 right-4 bg-card border border-border rounded-lg shadow-lg p-4 z-50">
          <h4 className="font-medium mb-3">{t("viewer.sleepTimerTitle")}</h4>
          <div className="grid grid-cols-3 gap-2">
            {[15, 30, 45, 60, 90, 120].map(minutes => (
              <button
                key={minutes}
                onClick={() => startSleepTimer(minutes)}
                className="px-3 py-2 text-sm bg-muted hover:bg-muted/80 rounded-lg transition-colors"
              >
                {minutes}m
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowSleepTimer(false)}
            className="mt-3 w-full py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}
      
      {/* Extract dialog */}
      <CreateExtractDialog
        isOpen={isExtractDialogOpen}
        onClose={() => {
          setIsExtractDialogOpen(false);
          setSelectedText("");
        }}
        documentId={document.id}
        selectedText={selectedText}
        pageNumber={Math.floor(currentTime)} // Use time as "page" for audio
      />
    </div>
  );
}
