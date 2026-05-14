/**
 * YouTube Viewer Component
 * Displays YouTube videos with synchronized transcript and SponsorBlock integration
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Play, Clock, ExternalLink, Share2, Youtube, AlertTriangle, SkipForward, Loader2, GripVertical, Layers, Scissors, X } from "lucide-react";
import { useToast } from "../common/Toast";
import { useDocumentStore } from "../../stores";
import { VideoFeatures } from '../video/VideoFeatures';
import {
  CreateVideoExtractDialog,
  VideoExtractsList,
} from '../video/VideoExtracts';
import { TranscriptSearchState, TranscriptSync, TranscriptSegment } from "../media/TranscriptSync";
import { invokeCommand as invoke } from "../../lib/tauri";
import { getYouTubeWatchURL, formatDuration } from "../../api/youtube";
import { fetchYouTubeTranscript } from "../../utils/youtubeTranscriptBrowser";
import { getDocumentAuto, updateDocument, updateDocumentProgressAuto } from "../../api/documents";
import { generateYouTubeShareUrl, copyShareLink, parseStateFromUrl } from "../../lib/shareLink";
import { cn } from "../../utils";
import { saveDocumentPosition, timePosition } from "../../api/position";
import { useI18n } from "../../lib/i18n";
import { getDocumentPosition } from "../../api/position";
import { isTauri, getPlatform } from "../../lib/tauri";
import YouTube, { YouTubeProps, YouTubePlayer } from "react-youtube";
import { 
  fetchSponsorBlockSegments, 
  SponsorBlockSegment, 
  getCategoryDisplayName
} from "../../api/sponsorblock";
import { buildYouTubeNoCookieEmbedUrl, extractYouTubeVideoId } from "../../utils/youtubeEmbed";
import { isNetworkDebugEnabled } from "../../debug/networkDebug";

interface YouTubeViewerProps {
  videoId: string;
  documentId?: string;
  title?: string;
  onLoad?: (metadata: { duration: number; title: string }) => void;
  onTranscriptLoad?: (segments: Array<{ text: string; start: number; end: number }>) => void;
  onTimeUpdate?: (time: number) => void;
  onSelectionChange?: (text: string) => void;
  onArchive?: () => void;
  initialSeekTime?: number;
  autoPlayOnOpen?: boolean;
  transcriptSearchQuery?: string;
  onTranscriptSearchQueryChange?: (query: string) => void;
  activeTranscriptMatchIndex?: number;
  onTranscriptSearchStateChange?: (state: TranscriptSearchState) => void;
  initialTranscriptHighlightQuery?: string;
  initialTranscriptSegmentId?: string;
}

export function YouTubeViewer({
  videoId,
  documentId,
  title,
  onLoad,
  onTranscriptLoad,
  onTimeUpdate,
  onSelectionChange,
  onArchive,
  initialSeekTime,
  autoPlayOnOpen,
  transcriptSearchQuery,
  onTranscriptSearchQueryChange,
  activeTranscriptMatchIndex,
  onTranscriptSearchStateChange,
  initialTranscriptHighlightQuery,
  initialTranscriptSegmentId,
}: YouTubeViewerProps) {
  const toast = useToast();
  const { t } = useI18n();
  const updateDocumentInStore = useDocumentStore((state) => state.updateDocument);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSavedTimeRef = useRef<number>(0);
  const documentIdRef = useRef(documentId);
  const onTranscriptLoadRef = useRef(onTranscriptLoad);
  const onTranscriptSearchStateChangeRef = useRef(onTranscriptSearchStateChange);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const titleRef = useRef(title);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showTranscript, setShowTranscript] = useState(() => {
    const saved = localStorage.getItem('transcript-visibility');
    return saved !== 'false';
  });
  const [transcriptLayout, setTranscriptLayout] = useState<'below' | 'side'>('below');
  
  // Resizable transcript panel state
  const [transcriptWidth, setTranscriptWidth] = useState(() => {
    const saved = localStorage.getItem('transcript-panel-width');
    return saved ? parseInt(saved, 10) : 400; // Default 400px
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(0);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  // Initialize startTime from initialSeekTime to ensure YouTube player starts at correct position
  const [startTime, setStartTime] = useState(() => {
    if (typeof initialSeekTime === "number" && initialSeekTime >= 0) {
      return initialSeekTime;
    }
    return 0;
  });
  const [resolvedTitle, setResolvedTitle] = useState<string | undefined>(title);
  const titleFetchRef = useRef<string | null>(null);
  const [showInlinePlayer, setShowInlinePlayer] = useState(false);
  const [showArchivePrompt, setShowArchivePrompt] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [playerError, setPlayerError] = useState<{ code: number; message: string } | null>(null);
  const [embedHost, setEmbedHost] = useState<"https://www.youtube-nocookie.com" | "https://www.youtube.com">(
    () => {
      // WebKitGTK on Linux blocks CORS for youtube-nocookie.com internal requests,
      // causing "Your browser can't play this video." Use youtube.com instead.
      if (getPlatform() === 'linux') return "https://www.youtube.com";
      return "https://www.youtube-nocookie.com";
    }
  );
  const [inlinePlaybackLikelyUnsupported, setInlinePlaybackLikelyUnsupported] = useState(false);
  const [forceInlinePlayback, setForceInlinePlayback] = useState(false);
  const [normalizedVideoId, setNormalizedVideoId] = useState(() => extractYouTubeVideoId(videoId) ?? "");
  const networkDebugEnabled = useMemo(() => isNetworkDebugEnabled(), []);
  const effectiveTranscriptSearchQuery = transcriptSearchQuery ?? initialTranscriptHighlightQuery ?? "";

  // SponsorBlock state
  const [segments, setSegments] = useState<SponsorBlockSegment[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const lastSkippedSegmentIdRef = useRef<string | null>(null);
  const playerReadyRef = useRef(false);
  const desiredStartTimeRef = useRef(0);
  const initialSeekAppliedRef = useRef(false);
  const userInteractedRef = useRef(false);
  const initialSeekAttemptsRef = useRef(0);
  const initialSeekAttemptsDesiredRef = useRef(0);

  // Video features panel state
  const [showVideoFeatures, setShowVideoFeatures] = useState(false);
  const [videoFeaturesWidth, setVideoFeaturesWidth] = useState(() => {
    const saved = localStorage.getItem('video-features-panel-width');
    return saved ? parseInt(saved, 10) : 384; // Default matches w-96
  });
  const [isResizingVideoFeatures, setIsResizingVideoFeatures] = useState(false);
  const videoFeaturesResizeStartXRef = useRef(0);
  const videoFeaturesResizeStartWidthRef = useRef(0);
  const [showCreateExtract, setShowCreateExtract] = useState(false);
  const [extractStartTime, setExtractStartTime] = useState(0);
  const [activeExtractStartTime, setActiveExtractStartTime] = useState<number | null>(null);
  const [activeExtractEndTime, setActiveExtractEndTime] = useState<number | null>(null);

  const localResumeKey = useMemo(() => {
    // Stored in localStorage as a best-effort fallback when backend/IndexedDB state
    // is missing or stale (e.g. transient persistence issues in dev).
    return documentId ? `youtube-resume:${documentId}` : null;
  }, [documentId]);

  useEffect(() => {
    console.log("[YouTubeViewer] initialSeekTime prop:", initialSeekTime, "documentId:", documentId);
  }, [documentId, initialSeekTime]);

  // Update refs when values change
  useEffect(() => {
    documentIdRef.current = documentId;
  }, [documentId]);

  // Reset player ready state when videoId changes
  useEffect(() => {
    setNormalizedVideoId(extractYouTubeVideoId(videoId) ?? "");
    playerReadyRef.current = false;
    initialSeekAppliedRef.current = false;
    userInteractedRef.current = false;
    desiredStartTimeRef.current = 0;
    initialSeekAttemptsRef.current = 0;
    initialSeekAttemptsDesiredRef.current = 0;
    setPlayerError(null);
  }, [videoId]);

  useEffect(() => {
    if (!networkDebugEnabled) return;
    const onMessageError = (event: MessageEvent) => {
      console.error("[YouTubeViewer][postMessage][error]", {
        origin: event.origin,
        data: event.data,
      });
    };
    window.addEventListener("messageerror", onMessageError);
    return () => window.removeEventListener("messageerror", onMessageError);
  }, [networkDebugEnabled]);

  // If the viewer is reused across document switches, ensure we start in "thumbnail" mode
  // so the user reliably sees the Resume button/badge for the current document.
  useEffect(() => {
    setShowInlinePlayer(false);
    setForceInlinePlayback(false);
    setPlayerError(null);
    setEmbedHost(getPlatform() === 'linux' ? "https://www.youtube.com" : "https://www.youtube-nocookie.com");
  }, [documentId, videoId]);

  useEffect(() => {
    if (normalizedVideoId) return;
    setShowInlinePlayer(false);
  }, [normalizedVideoId]);

  // Preflight: WebKitGTK builds often lack H.264/MP4 codecs, causing YouTube to show
  // "Your browser can't play this video." Provide a clear fallback message.
  useEffect(() => {
    if (!isTauri()) return;
    try {
      const v = document.createElement("video");
      const h264 = v.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
      const anyMp4 = v.canPlayType("video/mp4");
      const likelyUnsupported = !h264 && !anyMp4;
      setInlinePlaybackLikelyUnsupported(likelyUnsupported);
      if (likelyUnsupported) {
        console.warn("[YouTubeViewer] Inline playback may be unsupported (missing MP4/H.264 codecs).");
      }
    } catch {
      setInlinePlaybackLikelyUnsupported(false);
    }
  }, []);

  useEffect(() => {
    onTranscriptLoadRef.current = onTranscriptLoad;
  }, [onTranscriptLoad]);

  useEffect(() => {
    onTranscriptSearchStateChangeRef.current = onTranscriptSearchStateChange;
  }, [onTranscriptSearchStateChange]);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  useEffect(() => {
    titleRef.current = title;
    setResolvedTitle(title);
  }, [title]);

  // Persist transcript visibility to localStorage
  useEffect(() => {
    localStorage.setItem('transcript-visibility', String(showTranscript));
  }, [showTranscript]);

  // Persist transcript width to localStorage
  useEffect(() => {
    localStorage.setItem('transcript-panel-width', String(transcriptWidth));
  }, [transcriptWidth]);

  // Persist video features width to localStorage
  useEffect(() => {
    localStorage.setItem('video-features-panel-width', String(videoFeaturesWidth));
  }, [videoFeaturesWidth]);

  useEffect(() => {
    if (!effectiveTranscriptSearchQuery.trim() && !initialTranscriptSegmentId && activeTranscriptMatchIndex === undefined) {
      return;
    }
    setShowTranscript(true);
  }, [activeTranscriptMatchIndex, effectiveTranscriptSearchQuery, initialTranscriptSegmentId]);

  useEffect(() => {
    if (!onTranscriptSearchStateChangeRef.current || isLoadingTranscript) return;

    const normalizedQuery = effectiveTranscriptSearchQuery.trim().toLowerCase();
    const matches = normalizedQuery
      ? transcript.filter((segment) => segment.text.toLowerCase().includes(normalizedQuery))
      : [];
    const resolvedActiveMatchIndex = matches.length > 0
      ? Math.max(0, Math.min(matches.length - 1, activeTranscriptMatchIndex ?? 0))
      : -1;

    onTranscriptSearchStateChangeRef.current({
      available: transcript.length > 0 && !transcriptError,
      query: effectiveTranscriptSearchQuery,
      totalMatches: matches.length,
      activeMatchIndex: resolvedActiveMatchIndex,
      activeSegmentId: resolvedActiveMatchIndex >= 0 ? matches[resolvedActiveMatchIndex].id : null,
    });
  }, [
    activeTranscriptMatchIndex,
    effectiveTranscriptSearchQuery,
    isLoadingTranscript,
    transcript,
    transcriptError,
  ]);

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    resizeStartXRef.current = clientX;
    resizeStartWidthRef.current = transcriptWidth;
    
    // Add resize cursor to body
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [transcriptWidth]);

  const handleVideoFeaturesResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsResizingVideoFeatures(true);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    videoFeaturesResizeStartXRef.current = clientX;
    videoFeaturesResizeStartWidthRef.current = videoFeaturesWidth;

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [videoFeaturesWidth]);

  // Handle resize move
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const delta = resizeStartXRef.current - clientX; // Inverted: dragging left increases width
      const newWidth = Math.max(250, Math.min(800, resizeStartWidthRef.current + delta));
      setTranscriptWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
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
  }, [isResizing]);

  useEffect(() => {
    if (!isResizingVideoFeatures) return;

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const delta = videoFeaturesResizeStartXRef.current - clientX; // Dragging left increases width
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
  // Load SponsorBlock segments
  useEffect(() => {
    if (!normalizedVideoId) return;
    
    const loadSegments = async () => {
      const fetchedSegments = await fetchSponsorBlockSegments(normalizedVideoId);
      console.log(`[SponsorBlock] Loaded ${fetchedSegments.length} segments for ${normalizedVideoId}`);
      setSegments(fetchedSegments);
    };
    
    loadSegments();
  }, [normalizedVideoId]);

  // Load transcript from backend
  const loadTranscript = useCallback(async () => {
    if (!normalizedVideoId) return;

    setIsLoadingTranscript(true);
    setTranscriptError(null);
    try {
      let segments: TranscriptSegment[] = [];
      let fetchedDuration = 0;

      if (isTauri()) {
        // Use Tauri backend for desktop app
        const transcriptData = await invoke<Array<{ text: string; start: number; duration: number }> | null>(
          "get_youtube_transcript_by_id",
          { videoId: normalizedVideoId, documentId }
        );

        if (!transcriptData || !Array.isArray(transcriptData)) {
          setTranscript([]);
          onTranscriptLoadRef.current?.([]);
          onTranscriptSearchStateChangeRef.current?.({
            available: false,
            query: effectiveTranscriptSearchQuery,
            totalMatches: 0,
            activeMatchIndex: -1,
            activeSegmentId: null,
          });
          return;
        }

        segments = transcriptData.map((seg, i) => ({
          id: `seg-${i}`,
          start: seg.start,
          end: seg.start + seg.duration,
          text: seg.text,
        }));
        fetchedDuration = segments[segments.length - 1]?.end || 0;
      } else {
        // Use web API for browser app
        console.log('[YouTubeViewer] Fetching transcript via web API...');
        const result = await fetchYouTubeTranscript(normalizedVideoId);

        segments = result.segments.map((seg, i) => ({
          id: `seg-${i}`,
          start: seg.start,
          end: seg.start + seg.duration,
          text: seg.text,
        }));
        fetchedDuration = segments[segments.length - 1]?.end || 0;
      }

      setTranscript(segments);
      setDuration(fetchedDuration);

      // Notify parent component of transcript load
      onTranscriptLoadRef.current?.(segments);
      onLoad?.({ duration: fetchedDuration, title: titleRef.current || "" });
    } catch (error) {
      console.log("Transcript not available:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      setTranscriptError(errorMsg);
      setTranscript([]);
      onTranscriptLoadRef.current?.([]);
      onTranscriptSearchStateChangeRef.current?.({
        available: false,
        query: effectiveTranscriptSearchQuery,
        totalMatches: 0,
        activeMatchIndex: -1,
        activeSegmentId: null,
      });
    } finally {
      setIsLoadingTranscript(false);
    }
  }, [documentId, effectiveTranscriptSearchQuery, normalizedVideoId, onLoad]);

  // Handle videoId changes for transcript
  useEffect(() => {
    loadTranscript();
  }, [loadTranscript]);

  // Resolve YouTube title
  useEffect(() => {
    if (!normalizedVideoId || !documentId) return;
    const currentTitle = (titleRef.current || "").trim();
    const looksLikeUrl = currentTitle.startsWith("http") || currentTitle.startsWith("YouTube:");
    if (!looksLikeUrl) return;
    if (titleFetchRef.current === normalizedVideoId) return;

    titleFetchRef.current = normalizedVideoId;
    (async () => {
      try {
        const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${normalizedVideoId}`);
        if (!response.ok) return;
        const data = await response.json();
        if (!data?.title) return;
        setResolvedTitle(data.title);
        await updateDocument(documentId, { title: data.title } as any);
      } catch (error) {
        console.warn("Failed to resolve YouTube title:", error);
      }
    })();
  }, [documentId, normalizedVideoId]);

  // Parse URL fragment to get initial timestamp
  useEffect(() => {
    if (typeof initialSeekTime === "number" && initialSeekTime >= 0) return;
    const state = parseStateFromUrl();
    if (state.time !== undefined) {
      setStartTime(state.time);
      desiredStartTimeRef.current = state.time;
      initialSeekAppliedRef.current = false;
      console.log(`[YouTubeViewer] Restoring timestamp from URL: ${state.time}s`);
    }
  }, [videoId, initialSeekTime]);

  // Explicit initial seek (command palette jump)
  useEffect(() => {
    console.log("[YouTubeViewer] Initial seek effect running:", initialSeekTime);
    if (typeof initialSeekTime !== "number" || initialSeekTime < 0) return;
    console.log(`[YouTubeViewer] Setting startTime from initialSeekTime: ${initialSeekTime}s`);
    setStartTime(initialSeekTime);
    desiredStartTimeRef.current = initialSeekTime;
    initialSeekAppliedRef.current = false;
    setShowInlinePlayer(true);
  }, [videoId, initialSeekTime]);

  // Load saved position from document
  useEffect(() => {
    if (!documentId) return;
    console.log("[YouTubeViewer] Document restoration effect check, initialSeekTime:", initialSeekTime);
    if (typeof initialSeekTime === "number" && initialSeekTime >= 0) {
      console.log("[YouTubeViewer] Skipping document restoration - initialSeekTime provided");
      return;
    }

    console.log("[YouTubeViewer] Loading saved position from document:", documentId);
    (async () => {
      try {
        // Prefer unified position API (works even if legacy current_page isn't being updated yet).
        const position = await getDocumentPosition(documentId);
        console.log("[YouTubeViewer] Position API returned:", position);
        if (position?.type === "time" && typeof position.seconds === "number" && position.seconds >= 3) {
          const savedTime = position.seconds;
          console.log(`[YouTubeViewer] Restoring video position from position API: ${savedTime}s`);
          setStartTime(savedTime);
          desiredStartTimeRef.current = savedTime;
          initialSeekAppliedRef.current = false;
          if (playerReadyRef.current && playerRef.current) {
            playerRef.current.seekTo(savedTime, true);
            console.log(`[YouTubeViewer] Seeked to loaded position: ${savedTime}s`);
          }
          return;
        }

        // Fallback: localStorage (useful in browser dev if IndexedDB/backend state is missing).
        if (localResumeKey) {
          const raw = localStorage.getItem(localResumeKey);
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as { seconds?: number; updatedAt?: number };
              const seconds = typeof parsed.seconds === "number" ? parsed.seconds : 0;
              if (seconds >= 3) {
                console.log(`[YouTubeViewer] Restoring video position from localStorage: ${seconds}s`);
                setStartTime(seconds);
                desiredStartTimeRef.current = seconds;
                initialSeekAppliedRef.current = false;
                if (playerReadyRef.current && playerRef.current) {
                  playerRef.current.seekTo(seconds, true);
                  console.log(`[YouTubeViewer] Seeked to localStorage position: ${seconds}s`);
                }
                return;
              }
            } catch (e) {
              console.warn("[YouTubeViewer] Failed to parse local resume position:", e);
            }
          }
        }

        // Fallback: legacy fields on Document.
        const doc = await getDocumentAuto(documentId);
        const savedTime = doc?.current_page ?? doc?.currentPage;
        console.log("[YouTubeViewer] Legacy saved position:", {
          current_page: doc?.current_page,
          currentPage: doc?.currentPage,
          savedTime,
        });
        if (savedTime !== null && savedTime !== undefined && savedTime >= 3) {
          console.log(`[YouTubeViewer] Restoring video position from legacy field: ${savedTime}s`);
          setStartTime(savedTime);
          desiredStartTimeRef.current = savedTime;
          initialSeekAppliedRef.current = false;
          if (playerReadyRef.current && playerRef.current) {
            playerRef.current.seekTo(savedTime, true);
            console.log(`[YouTubeViewer] Seeked to loaded position: ${savedTime}s`);
          }
        }
      } catch (error) {
        console.log("Failed to load saved position:", error);
      }
    })();
  }, [documentId]);

  const tryApplyInitialSeek = useCallback(async (reason: string) => {
    const desired = desiredStartTimeRef.current;
    const player = playerRef.current;
    if (!playerReadyRef.current || !player) return;
    if (userInteractedRef.current) return;
    if (desired <= 0) return;
    if (initialSeekAppliedRef.current) return;

    if (initialSeekAttemptsDesiredRef.current !== desired) {
      initialSeekAttemptsDesiredRef.current = desired;
      initialSeekAttemptsRef.current = 0;
    }
    if (initialSeekAttemptsRef.current >= 8) {
      console.log("[YouTubeViewer] Giving up on initial seek after attempts:", {
        desired,
        attempts: initialSeekAttemptsRef.current,
        reason,
      });
      // Avoid retry loops; user can still manually seek via transcript/extract actions.
      initialSeekAppliedRef.current = true;
      return;
    }

    try {
      const current = await player.getCurrentTime();
      if (Number.isFinite(current) && Math.abs(current - desired) <= 1.5) {
        initialSeekAppliedRef.current = true;
        return;
      }
    } catch {
      // Ignore and attempt seek anyway.
    }

    try {
      initialSeekAttemptsRef.current += 1;
      await player.seekTo(desired, true);
      console.log(`[YouTubeViewer] Applied initial seek (${reason}): ${desired}s`);
    } catch (error) {
      console.log("[YouTubeViewer] Failed to apply initial seek:", error);
      return;
    }

    // Verify (and re-apply once) because YouTube sometimes ignores an early seek
    // until the player has transitioned states.
    window.setTimeout(() => {
      void tryApplyInitialSeek("verify");
    }, 250);
  }, []);

  // Seek when startTime changes and player is ready
  // This handles the case where saved position loads after player is ready
  useEffect(() => {
    console.log("[YouTubeViewer] Seek effect running:", { startTime, playerReady: playerReadyRef.current });
    if (startTime > 0) {
      desiredStartTimeRef.current = startTime;
      void tryApplyInitialSeek("startTimeEffect");
    }
  }, [startTime, tryApplyInitialSeek]);

  // Save current position to document
  const saveCurrentPosition = useCallback(async (time: number) => {
    const currentDocumentId = documentIdRef.current;
    if (!currentDocumentId) return;
    if (Math.abs(time - lastSavedTimeRef.current) < 1) return;

    try {
      await updateDocumentProgressAuto(currentDocumentId, Math.floor(time));
      await saveDocumentPosition(currentDocumentId, timePosition(Math.floor(time), duration));
      if (localResumeKey) {
        localStorage.setItem(localResumeKey, JSON.stringify({ seconds: Math.floor(time), updatedAt: Date.now() }));
      }
      lastSavedTimeRef.current = time;
      console.log(`Saved video position: ${Math.floor(time)}s`);
    } catch (error) {
      console.log("Failed to save position:", error);
    }
  }, [duration, localResumeKey]);

  // Monitor playback for SponsorBlock segments and position saving
  useEffect(() => {
    if (!isPlaying || !playerRef.current) return;

    // Use a longer interval to reduce cross-origin iframe calls
    // 1000ms is sufficient for position updates and segment checking
    const intervalId = setInterval(async () => {
      try {
        const time = await playerRef.current.getCurrentTime();
        setCurrentTime(time);

        // Notify parent
        onTimeUpdateRef.current?.(time);

        // Save position periodically (throttled inside saveCurrentPosition)
        saveCurrentPosition(time);

        // Check SponsorBlock segments.
        // Important: don't let SponsorBlock seek override a pending resume seek.
        const pendingInitialSeek =
          desiredStartTimeRef.current > 0 &&
          !initialSeekAppliedRef.current &&
          !userInteractedRef.current;

        if (!pendingInitialSeek && segments.length > 0) {
          for (const segment of segments) {
            const [start, end] = segment.segment;

            // If current time is within a segment and we haven't just skipped it
            if (time >= start && time < end) {
              if (lastSkippedSegmentIdRef.current !== segment.UUID) {
                // Skip segment
                playerRef.current.seekTo(end, true);
                lastSkippedSegmentIdRef.current = segment.UUID;

                // Show toast
                const categoryName = getCategoryDisplayName(segment.category);
                toast.info(`Skipped ${categoryName}`, "SponsorBlock");
                console.log(`[SponsorBlock] Skipped ${categoryName} (${start.toFixed(1)}s - ${end.toFixed(1)}s)`);
              }
            } else if (time >= end && lastSkippedSegmentIdRef.current === segment.UUID) {
              // Reset skipped flag once we're past the segment
              // This is a simplification; handling seeking back is trickier but this covers forward playback
              // We don't strictly need to clear it, but it helps if user seeks back before the segment
            }
          }
        }

        if (
          activeExtractStartTime !== null
          && activeExtractEndTime !== null
          && activeExtractEndTime > activeExtractStartTime
          && time >= activeExtractEndTime
        ) {
          playerRef.current.seekTo(activeExtractStartTime, true);
          playerRef.current.playVideo?.();
        }
      } catch {
        // Ignore errors from player (e.g. if it's not ready)
      }
    }, 1000); // Increased from 500ms to 1000ms to reduce cross-origin calls

    return () => clearInterval(intervalId);
  }, [
    isPlaying,
    segments,
    saveCurrentPosition,
    toast,
    activeExtractStartTime,
    activeExtractEndTime,
  ]);

  // Seek to time - opens video at specific timestamp
  const handleSeek = useCallback((time: number, endTime?: number) => {
    userInteractedRef.current = true;
    initialSeekAppliedRef.current = true;
    setCurrentTime(time);
    setStartTime(time);
    desiredStartTimeRef.current = time;
    saveCurrentPosition(time);
    if (typeof endTime === "number" && endTime > time) {
      setActiveExtractStartTime(time);
      setActiveExtractEndTime(endTime);
    } else {
      setActiveExtractStartTime(null);
      setActiveExtractEndTime(null);
    }

    if (showInlinePlayer && playerRef.current) {
      playerRef.current.seekTo(time, true);
      playerRef.current.playVideo?.();
    } else {
      setShowInlinePlayer(true);
    }

    toast.success(t("viewer.seeking"), t("viewer.startingAt", { time: formatTime(time) }));
  }, [resolvedTitle, title, saveCurrentPosition, toast, showInlinePlayer]);

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Share video with current timestamp
  const handleShare = async () => {
    const shareUrl = generateYouTubeShareUrl(normalizedVideoId, currentTime);
    const success = await copyShareLink(shareUrl);
    if (success) {
      toast.success(t("viewer.linkCopied"), t("viewer.linkCopiedTimestamp"));
    } else {
      toast.error(t("viewer.failedToCopy"), t("viewer.couldNotCopyLink"));
    }
  };

  const handlePlayVideo = () => {
    if (!normalizedVideoId) {
      toast.error(t("viewer.invalidYouTubeUrlToast"), t("viewer.invalidYouTubeUrlDesc"));
      return;
    }
    setShowInlinePlayer(true);
  };

  const handleArchiveVideo = useCallback(async () => {
    if (!documentId || isArchiving) return;
    setIsArchiving(true);
    try {
      await updateDocument(documentId, { isArchived: true } as any);
      updateDocumentInStore(documentId, { isArchived: true });
      toast.success(t("viewer.archived"), t("viewer.archivedDesc"));
      setShowArchivePrompt(false);
      onArchive?.();
    } catch (error) {
      toast.error(t("viewer.archiveFailed"), error instanceof Error ? error.message : t("viewer.archiveFailedDesc"));
    } finally {
      setIsArchiving(false);
    }
  }, [documentId, isArchiving, onArchive, toast, updateDocumentInStore]);

  const handleReplay = useCallback(() => {
    setShowArchivePrompt(false);
    setHasEnded(false);
    if (playerRef.current) {
      playerRef.current.seekTo(0, true);
      playerRef.current.playVideo?.();
    }
  }, []);

  // Video features handlers
  const handleOpenCreateExtract = useCallback(() => {
    setExtractStartTime(currentTime);
    setShowCreateExtract(true);
  }, [currentTime]);

  const handleExtractCreated = useCallback(() => {
    setShowCreateExtract(false);
    toast.success(t("viewer.videoExtractCreated"));
  }, [toast]);

  // Listen for app-wide Ctrl+E extract-text shortcut
  useEffect(() => {
    const handleExtractText = () => {
      if (showCreateExtract) return;
      handleOpenCreateExtract();
    };
    window.addEventListener("extract-text", handleExtractText);
    return () => window.removeEventListener("extract-text", handleExtractText);
  }, [showCreateExtract, handleOpenCreateExtract]);

  // YouTube Player Event Handlers
  const onPlayerReady = (event: any) => {
    playerRef.current = event.target;
    playerReadyRef.current = true;
    try {
      const iframe = event?.target?.getIframe?.() as HTMLIFrameElement | undefined;
      if (iframe) {
        iframe.setAttribute(
          "allow",
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        );
        iframe.setAttribute("allowfullscreen", "true");
        iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
        if (networkDebugEnabled) {
          console.info("[YouTubeViewer] iframe src:", iframe.src);
          console.info("[YouTubeViewer] expected embed:", buildYouTubeNoCookieEmbedUrl(normalizedVideoId, startTime));
        }
      }
    } catch (error) {
      if (networkDebugEnabled) {
        console.warn("[YouTubeViewer] Failed to inspect iframe element:", error);
      }
    }
    void (async () => {
      try {
        const playerDuration = await event.target.getDuration();
        if (typeof playerDuration === "number" && playerDuration > 0) setDuration(playerDuration);
      } catch {
        // Ignore duration failures.
      }
      void tryApplyInitialSeek("onReady");
    })();

    if (autoPlayOnOpen) {
      try {
        event.target.playVideo?.();
      } catch {
        // Autoplay may be blocked by browser policies.
      }
    }
  };

  const onPlayerStateChange = (event: any) => {
    // Player states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
    setIsPlaying(event.data === 1);
    
    if (event.data === 1) { // Playing
      void tryApplyInitialSeek("statePlaying");
      if (hasEnded) {
        setHasEnded(false);
      }
      if (showArchivePrompt) {
        setShowArchivePrompt(false);
      }
      // Ensure duration is set
      void (async () => {
        try {
          const d = await event.target.getDuration();
          if (typeof d === "number" && d > 0) setDuration(d);
        } catch {
          // Ignore.
        }
      })();
    } else if (event.data === 5) { // Video cued
      void tryApplyInitialSeek("stateCued");
    } else if (event.data === 0) { // Ended
      setHasEnded(true);
      setShowArchivePrompt(true);
      if (duration > 0) {
        saveCurrentPosition(duration);
      }
    }
  };

  const onPlayerError = (event: any) => {
    const code = typeof event?.data === "number" ? event.data : -1;

    if ((code === 101 || code === 150) && embedHost === "https://www.youtube-nocookie.com") {
      console.warn("[YouTubeViewer] Embedded playback blocked on youtube-nocookie. Retrying with youtube.com host.");
      setEmbedHost("https://www.youtube.com");
      setPlayerError(null);
      return;
    }

    const message =
      code === 5
        ? t("viewer.youTubePlaybackFailed")
        : code === 101 || code === 150
          ? t("viewer.videoCannotPlayEmbedded")
          : code === 100
            ? t("viewer.videoUnavailable")
            : t("viewer.youTubePlaybackError");

    console.warn("[YouTubeViewer] Player error:", { code, message });
    setPlayerError({ code, message });
  };

  const displayTitle = resolvedTitle || title || t("viewer.youTubeVideo");

  // WebKitGTK (Linux AppImage) serves pages from http://localhost:<random-port>,
  // causing "Unable to post message to https://www.youtube.com" errors because
  // the dynamic localhost origin mismatches during postMessage validation.
  // Omit the origin parameter for Linux production builds so YouTube's iframe API
  // skips origin checking; all other environments pass window.location.origin.
  const omitOrigin = isTauri() && getPlatform() === 'linux' && import.meta.env.PROD;

  const youtubeOpts: YouTubeProps['opts'] = {
    host: embedHost,
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 1,
      start: Math.floor(startTime),
      enablejsapi: 1,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
      ...(!omitOrigin ? { origin: window.location.origin } : {}),
    },
  };

  // Calculate video container style based on layout
  const getVideoContainerStyle = () => {
    if (transcriptLayout === 'side' && showTranscript) {
      return {
        // In side mode, use flex to fill available height
        // No padding-bottom needed as the container uses h-full
        flex: 1,
      };
    }
    return {
      paddingBottom: showTranscript ? "40%" : "56.25%",
      minHeight: showTranscript ? "300px" : "auto",
    };
  };

  return (
    <div className={`flex h-full min-h-0 overflow-hidden bg-background ${transcriptLayout === 'side' && showTranscript ? 'flex-row' : 'flex-col'}`}>
      {!normalizedVideoId && (
        <div className="p-3 text-sm bg-destructive/10 border-b border-destructive/30 text-destructive">
          {t("viewer.invalidYouTubeUrl", { videoId })} <code>{videoId}</code>
        </div>
      )}
      {/* Video Player Container */}
      <div
        ref={containerRef}
        className={`relative bg-black flex-shrink-0 transition-all duration-300 ${transcriptLayout === 'side' && showTranscript ? 'h-full' : 'w-full'}`}
        style={getVideoContainerStyle()}
      >
        {/* Inline Player */}
        {showInlinePlayer ? (
          <div className="absolute inset-0 w-full h-full">
            <YouTube
              key={`${normalizedVideoId}:${embedHost}`}
              videoId={normalizedVideoId}
              opts={youtubeOpts}
              onReady={onPlayerReady}
              onStateChange={onPlayerStateChange}
              onError={onPlayerError}
              className="w-full h-full"
              iframeClassName="w-full h-full"
            />
            {playerError && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4">
                <div className="w-full max-w-lg rounded-xl bg-background border border-border shadow-2xl p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">
                        {t("viewer.inlinePlaybackFailed")}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {playerError.message} (code {playerError.code})
                      </div>
                      {inlinePlaybackLikelyUnsupported && (
                        <div className="text-xs text-muted-foreground mt-2">
                          {t("viewer.missingH264Codecs")}
                        </div>
                      )}
                      <div className="mt-4 flex flex-col sm:flex-row gap-2">
                        <a
                          href={getYouTubeWatchURL(normalizedVideoId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors font-medium border border-gray-700"
                        >
                          <ExternalLink className="w-4 h-4" />
                          {t("viewer.openInBrowser")}
                        </a>
                        <button
                          onClick={() => {
                            setPlayerError(null);
                            setShowInlinePlayer(false);
                          }}
                          className="inline-flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 text-foreground px-4 py-2 rounded-lg transition-colors font-medium"
                        >
                          <X className="w-4 h-4" />
                          {t("viewer.close")}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
            <div className="text-center p-6 max-w-xl w-full">
              {/* Thumbnail */}
              <div 
                className="relative mb-6 group cursor-pointer rounded-xl overflow-hidden shadow-2xl"
                onClick={handlePlayVideo}
              >
                <img
                  src={`https://img.youtube.com/vi/${normalizedVideoId}/maxresdefault.jpg`}
                  alt={displayTitle}
                  className="w-full aspect-video object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${normalizedVideoId}/hqdefault.jpg`;
                  }}
                />
                {/* Play button overlay */}
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Play className="w-10 h-10 text-white ml-1" />
                  </div>
                </div>
                {/* Resume badge */}
                {startTime > 0 && (
                  <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {t("viewer.resumeFrom", { time: formatTime(startTime) })}
                  </div>
                )}
                
                {/* Segments badge */}
                {segments.length > 0 && (
                  <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
                    <SkipForward className="w-4 h-4" />
                    {t("viewer.skippableSegments", { count: segments.length })}
                  </div>
                )}
              </div>

              {/* Title */}
              <h3 className="text-white text-lg font-semibold mb-2 line-clamp-2">
                {displayTitle}
              </h3>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => {
                    if (inlinePlaybackLikelyUnsupported && !forceInlinePlayback) return;
                    handlePlayVideo();
                  }}
                  className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors font-medium shadow-lg shadow-red-600/20"
                >
                  <Play className="w-5 h-5" />
                  {startTime > 0 ? t("viewer.resumeFrom", { time: formatTime(startTime) }) : t("viewer.playVideo")}
                </button>
                
                <button
                  onClick={handleShare}
                  className="inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg transition-colors font-medium border border-gray-700"
                >
                  <Share2 className="w-5 h-5" />
                  {t("viewer.share")}
                </button>

                <a
                  href={getYouTubeWatchURL(normalizedVideoId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg transition-colors font-medium border border-gray-700"
                >
                  <ExternalLink className="w-5 h-5" />
                  {t("viewer.browser")}
                </a>
              </div>

              {inlinePlaybackLikelyUnsupported && !forceInlinePlayback && (
                <div className="mt-4 mx-auto max-w-lg rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-left">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-sm text-foreground font-medium">
                        {t("viewer.inlinePlaybackMayNotWork")}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {t("viewer.machineLacksMp4Support")}
                      </div>
                      <button
                        onClick={() => {
                          setForceInlinePlayback(true);
                          setShowInlinePlayer(true);
                        }}
                        className="mt-2 inline-flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 text-foreground px-3 py-1.5 rounded-md transition-colors text-sm"
                      >
                        {t("viewer.tryInlineAnyway")}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {showArchivePrompt && documentId && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl bg-background border border-border shadow-2xl p-6 text-center">
              <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-red-600/10 flex items-center justify-center">
                <Youtube className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{t("viewer.finishedWatching")}</h3>
              <p className="text-sm text-muted-foreground mb-5">
                {t("viewer.archiveVideoDesc")}
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleArchiveVideo}
                  disabled={isArchiving}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {isArchiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>{t("viewer.archiveVideo")}</span>}
                </button>
                <button
                  onClick={() => setShowArchivePrompt(false)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors"
                >
                  {t("viewer.keepInQueue")}
                </button>
                <button
                  onClick={handleReplay}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t("viewer.replay")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Resize handle - only in side mode with transcript visible */}
      {transcriptLayout === 'side' && showTranscript && (
        <div
          className={`w-1 flex-shrink-0 relative z-10 ${isResizing ? 'bg-primary' : 'bg-border hover:bg-primary/50'} cursor-ew-resize transition-colors`}
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
          title={t("viewer.dragToResize")}
        >
          {/* Visual grip indicator */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-1 rounded bg-background/80 shadow-sm">
            <GripVertical className="w-3 h-3 text-muted-foreground" />
          </div>
        </div>
      )}

      {/* Content area with transcript toggle */}
      <div 
        className="flex flex-col min-h-0 overflow-hidden"
        style={transcriptLayout === 'side' && showTranscript ? { width: transcriptWidth } : { flex: 1 }}
      >
        {/* Video info and transcript */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Video info header */}
          <div className="p-4 border-b border-border flex-shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-foreground line-clamp-2 mb-1">
                  {displayTitle}
                </h2>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {duration > 0 && <span>{t("viewer.duration", { duration: formatDuration(duration) })}</span>}
                  {segments.length > 0 && (
                    <span className="flex items-center gap-1 text-green-600">
                      <SkipForward className="w-3 h-3" />
                      {t("viewer.sponsorBlockEnabled")}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                {startTime >= 3 && (
                  <button
                    onClick={() => {
                      userInteractedRef.current = true;
                      initialSeekAppliedRef.current = true;
                      desiredStartTimeRef.current = startTime;
                      setCurrentTime(startTime);
                      if (playerRef.current && showInlinePlayer) {
                        playerRef.current.seekTo(startTime, true);
                        playerRef.current.playVideo?.();
                      } else {
                        setShowInlinePlayer(true);
                      }
                    }}
                    className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors flex items-center gap-2"
                    title={t("viewer.resumeFrom", { time: formatTime(startTime) })}
                  >
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">{t("viewer.resume")}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatTime(startTime)}
                    </span>
                  </button>
                )}

                {/* Video Features panel button */}
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

                {/* Layout toggle - only show when transcript is visible */}
                {showTranscript && (
                  <button
                    onClick={() => setTranscriptLayout(transcriptLayout === 'below' ? 'side' : 'below')}
                    className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors flex items-center gap-2"
                    title={transcriptLayout === 'below' ? t("viewer.switchToSideBySide") : t("viewer.switchToStacked")}
                  >
                    <span className="text-xs">{transcriptLayout === 'below' ? '↔' : '↕'}</span>
                  </button>
                )}

                {/* Transcript toggle button */}
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

          {/* Transcript panel - fills available space */}
          {showTranscript && (
            <div className="flex-1 min-h-0 overflow-hidden">
              {isLoadingTranscript ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-sm">{t("viewer.loadingTranscript")}</span>
                  </div>
                </div>
              ) : transcriptError ? (
                <div className="flex items-center justify-center h-full p-6">
                  <div className="text-center max-w-md">
                    <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-3" />
                    <h3 className="text-sm font-medium text-foreground mb-2">{t("viewer.transcriptUnavailable")}</h3>
                    <p className="text-xs text-muted-foreground">{transcriptError}</p>
                    {!isTauri() && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {t("viewer.transcriptRequiresApi")}
                      </p>
                    )}
                  </div>
                </div>
              ) : transcript.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <p className="text-sm">{t("viewer.noTranscriptForVideo")}</p>
                  </div>
                </div>
              ) : (
                <TranscriptSync
                  segments={transcript}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                  onSelectionChange={onSelectionChange}
                  className="flex-1 min-h-0"
                  searchQuery={effectiveTranscriptSearchQuery}
                  onSearchQueryChange={onTranscriptSearchQueryChange}
                  activeMatchIndex={activeTranscriptMatchIndex}
                  onSearchStateChange={onTranscriptSearchStateChange}
                  highlightQuery={effectiveTranscriptSearchQuery}
                  highlightedSegmentId={initialTranscriptSegmentId}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Video Features Slide-over Panel */}
      {showVideoFeatures && documentId && (
        <div
          className="absolute top-0 right-0 h-full bg-card border-l border-border shadow-xl z-50 flex flex-col"
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

      {/* Create Video Extract Dialog */}
      <CreateVideoExtractDialog
        documentId={documentId || ''}
        documentTitle={displayTitle}
        isOpen={showCreateExtract}
        initialStartTime={extractStartTime}
        initialEndTime={extractStartTime > 0 ? extractStartTime + 60 : undefined}
        onClose={() => setShowCreateExtract(false)}
        onCreate={handleExtractCreated}
      />
    </div>
  );
}
