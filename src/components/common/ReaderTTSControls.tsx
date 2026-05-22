import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Pause, Play, SkipBack, SkipForward, Square, Volume2, Loader2, Highlighter } from "lucide-react";
import { useSettingsStore } from "../../stores/settingsStore";
import { getVoicesForProvider } from "../../utils/ttsSettings";
import { generateSpeech } from "../../api/tts";
import { useI18n } from "../../lib/i18n";
import { cn } from "../../utils";
import { TextPositionIndex } from "../../utils/ttsTextExtraction";
import { WordHighlightLayer } from "./WordHighlightLayer";

interface TTSStartPosition {
  pageNumber: number | null;
  scrollPercent: number | null;
}

interface ReaderTTSControlsProps {
  text: string;
  className?: string;
  /** Called when all chunks have finished playing */
  onComplete?: () => void;
  /** Whether to auto-play the next chunk after one finishes */
  autoAdvance?: boolean;
  /** Called when a chunk starts playing, useful for highlighting */
  onChunkStart?: (chunkIndex: number, text: string) => void;
  /** Document position to start reading from */
  startPosition?: TTSStartPosition;
  /** Document type for position mapping */
  docType?: "pdf" | "epub" | "scroll";
  /** Called when the active chunk changes (useful for auto-scroll / position sync) */
  onChunkChange?: (chunkIndex: number, scrollPercent: number) => void;
  /** Whether word highlighting is enabled */
  highlightEnabled?: boolean;
  /** Called when highlight toggle is clicked */
  onHighlightToggle?: () => void;
  /** Whether auto-scroll is paused (user scrolled manually) */
  autoScrollPaused?: boolean;
  /** Called when user clicks re-center */
  onReCenter?: () => void;
  /** Ref for the element to highlight text in */
  highlightContainerRef?: React.RefObject<HTMLElement | null>;
  /** Iframe window for EPUB and HTML document readers */
  iframeWindow?: Window | null;
}

const CHUNK_TARGET = 420;
const CHUNK_MAX = 700;
const BUFFER_TARGET_SEC = 60;   // target seconds of audio buffered ahead
const MAX_CONCURRENT_GEN = 3;   // max parallel generation invocations
const EVICT_BEHIND_COUNT = 3;   // keep N already-played chunks in memory

function normalizeText(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildChunks(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length === 0) return [normalized];

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;

    if (candidate.length <= CHUNK_TARGET) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = sentence;
      continue;
    }

    // Sentence itself is long; hard-wrap by words.
    const words = sentence.split(/\s+/);
    let fragment = "";
    for (const word of words) {
      const next = fragment ? `${fragment} ${word}` : word;
      if (next.length <= CHUNK_MAX) {
        fragment = next;
      } else {
        if (fragment) chunks.push(fragment);
        fragment = word;
      }
    }
    if (fragment) chunks.push(fragment);
    current = "";
  }

  if (current) chunks.push(current);
  return chunks;
}

interface BufferedAudio {
  audioUrl: string;
  durationSec?: number;
}

export function ReaderTTSControls({
  text,
  className,
  onComplete,
  autoAdvance = true,
  onChunkStart,
  startPosition,
  docType = "scroll",
  onChunkChange,
  highlightEnabled = false,
  onHighlightToggle,
  autoScrollPaused = false,
  onReCenter,
  highlightContainerRef,
  iframeWindow,
}: ReaderTTSControlsProps) {
  const { t } = useI18n();
  const tts = useSettingsStore((state) => state.settings.tts);
  const settings = useSettingsStore((state) => state.settings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const ttsEnabled = tts?.enabled;
  const providerVoices = useMemo(
    () => (tts ? getVoicesForProvider(tts) : []),
    [tts]
  );
  const [playbackRate, setPlaybackRate] = useState(1);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [selectedVoiceId, setSelectedVoiceId] = useState(tts?.defaultVoiceId ?? "");
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);

  // Audio buffer: Map of chunk index -> audio URL
  const audioBufferRef = useRef<Map<number, BufferedAudio>>(new Map());
  const [bufferStatus, setBufferStatus] = useState<Map<number, "pending" | "loading" | "ready" | "error">>(new Map());

  // Audio element for playback
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Track previous playing state
  const _wasPlayingRef = useRef(false);
  const intentionalStopRef = useRef(false);
  const advancingRef = useRef(false);

  // Word highlighting
  const [highlightOn, setHighlightOn] = useState(false);

  // Buffer underrun indicator
  const [isBuffering, setIsBuffering] = useState(false);

  // Playback tracking refs to avoid race conditions and audio leaks
  const mountedRef = useRef(true);
  const playbackIdRef = useRef(0);

  const chunks = useMemo(() => buildChunks(text), [text]);

  // TextPositionIndex for position-aware start
  const positionIndexRef = useRef<TextPositionIndex>(new TextPositionIndex(docType));

  useEffect(() => {
    positionIndexRef.current = new TextPositionIndex(docType);
    if (chunks.length > 0) {
      positionIndexRef.current.build(chunks);
    }
  }, [chunks, docType]);

  // Determine initial chunk index from startPosition
  const initialChunkRef = useRef<number | null>(null);
  const startPositionRef = useRef(startPosition);
  startPositionRef.current = startPosition;

  const getInitialChunk = useCallback(() => {
    const sp = startPositionRef.current;
    if (!sp) return 0;
    const pos = positionIndexRef.current.getPosition(
      sp.pageNumber,
      sp.scrollPercent
    );
    return pos?.chunkIndex ?? 0;
  }, []);

  const findVisibleChunkIndex = useCallback((): number | null => {
    try {
      const win = iframeWindow || window;
      const container = iframeWindow 
        ? iframeWindow.document.body 
        : (highlightContainerRef?.current || document.body);

      if (!container) return null;

      // Query paragraph-like and span-like elements that contain text content
      const elements = Array.from(
        container.querySelectorAll<HTMLElement>(
          "p, h1, h2, h3, h4, h5, h6, li, .textLayer span, [role='paragraph']"
        )
      );

      const isElementVisible = (el: HTMLElement) => {
        const rect = el.getBoundingClientRect();
        // Check if the element falls within the visible viewport bounds
        const visibleHorizontally = rect.right > 10 && rect.left < win.innerWidth - 10;
        const visibleVertically = rect.bottom > 10 && rect.top < win.innerHeight - 10;
        return visibleHorizontally && visibleVertically;
      };

      const visibleElements = elements.filter((el) => {
        const text = el.textContent?.trim();
        if (!text || text.length < 3) return false;
        return isElementVisible(el);
      });

      if (visibleElements.length === 0) return null;

      const cleanForComparison = (str: string) => {
        return str.toLowerCase().replace(/[^a-z0-9]/g, "");
      };

      // Check first few visible elements to find the best matching chunk index
      for (const el of visibleElements.slice(0, 5)) {
        const text = el.textContent?.trim();
        if (!text) continue;
        const normEl = cleanForComparison(text);
        if (normEl.length < 3) continue;

        for (let i = 0; i < chunks.length; i++) {
          const normChunk = cleanForComparison(chunks[i]);
          if (normChunk.length < 3) continue;

          if (normChunk.includes(normEl) || normEl.includes(normChunk)) {
            console.log(`TTS: Found starting chunk index ${i} matching visible text: "${text.slice(0, 40)}..."`);
            return i;
          }
        }
      }
    } catch (error) {
      console.warn("TTS: Error finding visible starting chunk index:", error);
    }
    return null;
  }, [chunks, iframeWindow, highlightContainerRef]);

  // Sync refs for values read in callbacks (avoids stale closures)
  const isAutoPlayingRef = useRef(isAutoPlaying);
  isAutoPlayingRef.current = isAutoPlaying;
  const bufferStatusRef = useRef(bufferStatus);
  bufferStatusRef.current = bufferStatus;
  const chunksLenRef = useRef(chunks.length);
  chunksLenRef.current = chunks.length;
  const onChunkChangeRef = useRef(onChunkChange);
  onChunkChangeRef.current = onChunkChange;

  // Waterfall buffer manager — tracks generation concurrency across all providers
  const bufferMgrRef = useRef({
    activeGenCount: 0,
    queuedIndices: new Set<number>(),
    getBufferedSecondsAhead(index: number): number {
      let total = 0;
      for (let i = index; i < chunksLenRef.current; i++) {
        const entry = audioBufferRef.current.get(i);
        if (!entry) break;
        total += entry.durationSec ?? 3;
      }
      return total;
    },
    evictPlayedChunks(index: number) {
      const cutoff = index - EVICT_BEHIND_COUNT;
      for (const key of audioBufferRef.current.keys()) {
        if (key < cutoff) {
          audioBufferRef.current.delete(key);
        }
      }
      setBufferStatus(prev => {
        const next = new Map(prev);
        let changed = false;
        for (const key of next.keys()) {
          if (key < cutoff) {
            next.delete(key);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    },
    reset() {
      this.activeGenCount = 0;
      this.queuedIndices.clear();
    },
  });

  // Create a text fingerprint to detect when content actually changes
  const textFingerprint = useMemo(
    () => `${text.length}:${text.slice(0, 100)}`,
    [text]
  );

  // Selected voice for generation
  const voiceId = useMemo(() => {
    const hasSelectedVoice = providerVoices.some((voice) => voice.id === selectedVoiceId);
    return hasSelectedVoice ? selectedVoiceId : (providerVoices[0]?.id || tts?.defaultVoiceId || "");
  }, [providerVoices, selectedVoiceId, tts?.defaultVoiceId]);

  useEffect(() => {
    if (!tts) return;
    const hasSelectedVoice = providerVoices.some((voice) => voice.id === selectedVoiceId);
    if (!hasSelectedVoice) {
      setSelectedVoiceId(providerVoices[0]?.id || tts.defaultVoiceId);
    }
  }, [tts, providerVoices, selectedVoiceId]);

  // Reset when text changes
  useEffect(() => {
    playbackIdRef.current++;
    const initialChunk = getInitialChunk();
    setChunkIndex(initialChunk);
    initialChunkRef.current = initialChunk;
    setIsBuffering(false);
    stopAudio();

    audioBufferRef.current.clear();
    setBufferStatus(new Map());
    bufferMgrRef.current.reset();

    if (advancingRef.current) {
      advancingRef.current = false;
      setIsAutoPlaying(true);
      intentionalStopRef.current = false;
      playChunkAtIndexRef.current(initialChunk);
    } else {
      setIsAutoPlaying(false);
      intentionalStopRef.current = true;
    }
  }, [textFingerprint]);

  // Stop audio helper
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  // Generate audio for a chunk
  const generateChunkAudio = useCallback(async (index: number): Promise<BufferedAudio | null> => {
    if (index < 0 || index >= chunks.length) return null;

    const chunk = chunks[index];
    if (!chunk) return null;

    try {
      setBufferStatus(prev => new Map(prev).set(index, "loading"));

      const result = await generateSpeech(settings, {
        text: chunk,
        voiceId,
      });

      const buffered: BufferedAudio = {
        audioUrl: result.audioUrl,
        durationSec: result.durationSec,
      };

      audioBufferRef.current.set(index, buffered);
      setBufferStatus(prev => new Map(prev).set(index, "ready"));

      bufferMgrRef.current.activeGenCount = Math.max(0, bufferMgrRef.current.activeGenCount - 1);
      bufferMgrRef.current.queuedIndices.delete(index);

      return buffered;
    } catch (error) {
      console.error(`Failed to generate audio for chunk ${index}:`, error);
      setBufferStatus(prev => new Map(prev).set(index, "error"));
      bufferMgrRef.current.activeGenCount = Math.max(0, bufferMgrRef.current.activeGenCount - 1);
      bufferMgrRef.current.queuedIndices.delete(index);
      return null;
    }
  }, [chunks, settings, voiceId]);

  // Pre-buffer upcoming chunks — unified waterfall for all providers
  const preBufferChunks = useCallback((fromIndex: number) => {
    bufferMgrRef.current.evictPlayedChunks(fromIndex);

    const mgr = bufferMgrRef.current;
    const secondsAhead = mgr.getBufferedSecondsAhead(fromIndex);
    if (secondsAhead >= BUFFER_TARGET_SEC) return;

    let bufferedSec = secondsAhead;
    let idx = fromIndex;
    while (idx < chunks.length && bufferedSec < BUFFER_TARGET_SEC) {
      if (!audioBufferRef.current.has(idx) && !mgr.queuedIndices.has(idx)) {
        const status = bufferStatusRef.current.get(idx);
        if (!status || status === "error") {
          if (mgr.activeGenCount < MAX_CONCURRENT_GEN) {
            mgr.activeGenCount++;
            mgr.queuedIndices.add(idx);
            setBufferStatus(prev => new Map(prev).set(idx, "pending"));
            generateChunkAudio(idx).catch(err => {
              console.warn(`Background generation failed for chunk ${idx}:`, err);
            });
          }
        }
      }
      const entry = audioBufferRef.current.get(idx);
      if (entry) bufferedSec += entry.durationSec ?? 3;
      idx++;
    }
  }, [chunks.length, generateChunkAudio]);

  // Ref so audio.onended always calls the latest playChunkAtIndex (avoids stale closure)
  const playChunkAtIndexRef = useRef<(index: number) => Promise<void>>(() => Promise.resolve());

  // Play a chunk by index
  const playChunkAtIndex = useCallback(async (index: number) => {
    if (index < 0 || index >= chunks.length) return;

    const playId = ++playbackIdRef.current;

    const chunk = chunks[index];
    setChunkIndex(index);
    onChunkStart?.(index, chunk);
    onChunkChangeRef.current?.(index, positionIndexRef.current.getScrollPercent(index));

    // Check buffer
    let buffered = audioBufferRef.current.get(index);

    if (!buffered) {
      // Buffer underrun — show indicator and generate synchronously
      setIsBuffering(true);
      buffered = await generateChunkAudio(index);
      setIsBuffering(false);

      if (!mountedRef.current || playbackIdRef.current !== playId) {
        return;
      }

      if (!buffered) {
        console.error("Failed to generate audio for chunk", index);
        setIsAutoPlaying(false);
        return;
      }
    }

    if (!mountedRef.current || playbackIdRef.current !== playId) {
      return;
    }

    // Stop any currently playing audio
    stopAudio();

    // Create and play new audio
    const audio = new Audio(buffered.audioUrl);
    audio.playbackRate = playbackRate;
    audioRef.current = audio;

    audio.onplay = () => {
      setIsPlaying(true);
      setIsPaused(false);
    };

    audio.onpause = () => {
      if (!audio.ended) {
        setIsPaused(true);
        setIsPlaying(false);
      }
    };

    audio.onended = () => {
      setIsPlaying(false);
      setIsPaused(false);

      if (isAutoPlayingRef.current && autoAdvance && !intentionalStopRef.current) {
        const nextIndex = index + 1;
        if (nextIndex < chunksLenRef.current) {
          playChunkAtIndexRef.current(nextIndex);
        } else {
          // All done — signal advance so new text triggers auto-continue
          advancingRef.current = true;
          setIsAutoPlaying(false);
          onComplete?.();
        }
      }
    };

    audio.onerror = () => {
      console.error("Audio playback error");
      setIsPlaying(false);
      setIsPaused(false);
    };

    try {
      await audio.play();
      // Start pre-buffering next chunks
      preBufferChunks(index + 1);
    } catch (error) {
      console.error("Failed to play audio:", error);
      setIsPlaying(false);
    }
  }, [chunks, playbackRate, autoAdvance, stopAudio, generateChunkAudio, preBufferChunks, onComplete, onChunkStart]);
  playChunkAtIndexRef.current = playChunkAtIndex;

  // Start pre-buffering when component mounts or text changes
  useEffect(() => {
    if (chunks.length > 0 && ttsEnabled) {
      const startIdx = initialChunkRef.current ?? 0;
      preBufferChunks(startIdx);
    }
  }, [chunks.length, ttsEnabled, preBufferChunks]);

  // Clean up and stop audio when the component unmounts
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      playbackIdRef.current++;
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch (e) {
          // Ignore errors from already paused or ended audio elements
        }
        audioRef.current = null;
      }
    };
  }, []);

  // Controls
  const handlePlayPause = async () => {
    if (isPlaying && !isPaused) {
      playbackIdRef.current++;
      audioRef.current?.pause();
      return;
    }

    setIsAutoPlaying(true);
    intentionalStopRef.current = false;

    // Check if we are resuming from a paused audio
    if (isPaused && audioRef.current) {
      // If user scrolled to a different chunk/page while paused, start fresh from there!
      const targetIdx = findVisibleChunkIndex();
      if (targetIdx !== null && targetIdx !== chunkIndex) {
        setChunkIndex(targetIdx);
        await playChunkAtIndex(targetIdx);
      } else {
        audioRef.current.play();
      }
      return;
    }

    // Otherwise, we are starting fresh (or starting after a stop)
    // Let's dynamically find starting chunk index based on top-most visible text
    const targetIdx = findVisibleChunkIndex() ?? chunkIndex;
    setChunkIndex(targetIdx);
    await playChunkAtIndex(targetIdx);
  };

  const handleStop = () => {
    playbackIdRef.current++;
    intentionalStopRef.current = true;
    setIsAutoPlaying(false);
    stopAudio();
  };

  const handlePrev = async () => {
    playbackIdRef.current++;
    intentionalStopRef.current = true;
    stopAudio();
    setIsAutoPlaying(true);
    intentionalStopRef.current = false;
    await playChunkAtIndex(chunkIndex - 1);
  };

  const handleNext = async () => {
    playbackIdRef.current++;
    intentionalStopRef.current = true;
    stopAudio();
    setIsAutoPlaying(true);
    intentionalStopRef.current = false;
    await playChunkAtIndex(chunkIndex + 1);
  };

  const handleVoiceChange = (voiceId: string) => {
    playbackIdRef.current++;
    setSelectedVoiceId(voiceId);
    if (!tts) return;
    updateSettings({
      tts: {
        ...tts,
        defaultVoiceId: voiceId,
      },
    });
    // Clear buffer when voice changes since audio URLs are voice-specific
    audioBufferRef.current.clear();
    setBufferStatus(new Map());
    bufferMgrRef.current.reset();
  };

  const speedOptions = [0.8, 1, 1.2, 1.5, 2];

  if (!ttsEnabled) return null;
  if (chunks.length === 0) return null;

  const currentChunk = chunks[Math.min(chunkIndex, chunks.length - 1)] || "";
  const currentBufferStatus = bufferStatus.get(chunkIndex);
  const isLoading = currentBufferStatus === "loading" || currentBufferStatus === "pending";

  return (
    <>
    {highlightEnabled && currentChunk && (highlightContainerRef?.current || iframeWindow) && (
      <WordHighlightLayer
        enabled={highlightEnabled}
        chunkText={currentChunk}
        wordOffset={0}
        containerRef={highlightContainerRef}
        useChunkLevel={true}
        iframeWindow={iframeWindow}
      />
    )}
    <div
      className={cn(
        "pointer-events-auto rounded-xl border border-border/80 bg-card/95 px-3 py-2 shadow-lg backdrop-blur",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Volume2 className="h-4 w-4 text-primary" />
        <button
          onClick={() => void handlePrev()}
          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40"
          disabled={chunkIndex === 0 || isLoading}
          title={t("readerTts.previousChunk")}
        >
          <SkipBack className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => void handlePlayPause()}
          className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
          disabled={isLoading}
          title={isPlaying ? (isPaused ? t("readerTts.resume") : t("readerTts.pause")) : t("readerTts.play")}
        >
          {isBuffering && isAutoPlaying ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isPlaying && !isPaused ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          onClick={handleStop}
          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40"
          disabled={!isPlaying && !isPaused}
          title={t("readerTts.stop")}
        >
          <Square className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => void handleNext()}
          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40"
          disabled={chunkIndex >= chunks.length - 1 || isLoading}
          title={t("readerTts.nextChunk")}
        >
          <SkipForward className="h-3.5 w-3.5" />
        </button>

        <div className="flex items-center gap-1">
          {providerVoices.length ? (
            <select
              value={selectedVoiceId}
              onChange={(e) => handleVoiceChange(e.target.value)}
              className="max-w-[9.5rem] rounded-md border border-border bg-background px-1.5 py-1 text-xs"
              title={t("readerTts.voice")}
            >
              {providerVoices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}
                </option>
              ))}
            </select>
          ) : null}

          <select
            value={playbackRate}
            onChange={(e) => {
              const rate = Number(e.target.value);
              setPlaybackRate(rate);
              if (audioRef.current) {
                audioRef.current.playbackRate = rate;
              }
            }}
            className="rounded-md border border-border bg-background px-1.5 py-1 text-xs"
            title={t("readerTts.playbackSpeed")}
          >
            {speedOptions.map((speed) => (
              <option key={speed} value={speed}>
                {speed}x
              </option>
            ))}
          </select>
        </div>

          <button
            onClick={() => {
              setHighlightOn(!highlightOn);
              onHighlightToggle?.();
            }}
            className={cn(
              "rounded-md border px-2 py-1 text-xs hover:bg-muted",
              highlightEnabled
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            )}
            title={highlightEnabled ? "Disable word highlighting" : "Enable word highlighting"}
          >
            <Highlighter className="h-3.5 w-3.5" />
          </button>

          {autoScrollPaused && (
            <button
              onClick={() => onReCenter?.()}
              className="rounded-md border border-amber-500 bg-amber-500/10 px-2 py-1 text-xs text-amber-600 hover:bg-amber-500/20"
              title="Re-center to current TTS position"
            >
              Re-center
            </button>
          )}

          <span className="text-[11px] text-foreground/80">
            {Math.min(chunkIndex + 1, chunks.length)}/{chunks.length}
          </span>
      </div>
      <p className="mt-1 max-w-[26rem] truncate text-[11px] text-foreground/80" title={currentChunk}>
        {isBuffering && isAutoPlaying ? t("readerTts.bufferingNextSegment") : isLoading ? t("readerTts.generatingAudio") : currentChunk}
      </p>
    </div>
    </>
  );
}
