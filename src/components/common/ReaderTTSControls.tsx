import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Pause, Play, SkipBack, SkipForward, Square, Volume2, Loader2 } from "lucide-react";
import { useTTS } from "../../hooks/useTTS";
import { useSettingsStore } from "../../stores/settingsStore";
import { getVoicesForProvider } from "../../utils/ttsSettings";
import { generateSpeech } from "../../api/tts";
import { cn } from "../../utils";

interface ReaderTTSControlsProps {
  text: string;
  className?: string;
  /** Called when all chunks have finished playing */
  onComplete?: () => void;
  /** Whether to auto-play the next chunk after one finishes */
  autoAdvance?: boolean;
  /** Called when a chunk starts playing, useful for highlighting */
  onChunkStart?: (chunkIndex: number, text: string) => void;
}

const CHUNK_TARGET = 420;
const CHUNK_MAX = 700;
const PREFETCH_COUNT = 3; // How many chunks to pre-generate

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
}: ReaderTTSControlsProps) {
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
  const wasPlayingRef = useRef(false);
  const intentionalStopRef = useRef(false);

  const chunks = useMemo(() => buildChunks(text), [text]);

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
    setChunkIndex(0);
    setIsAutoPlaying(false);
    intentionalStopRef.current = true;
    stopAudio();

    // Clear buffer
    audioBufferRef.current.clear();
    setBufferStatus(new Map());
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

      return buffered;
    } catch (error) {
      console.error(`Failed to generate audio for chunk ${index}:`, error);
      setBufferStatus(prev => new Map(prev).set(index, "error"));
      return null;
    }
  }, [chunks, settings, voiceId]);

  // Pre-buffer upcoming chunks
  const preBufferChunks = useCallback(async (fromIndex: number) => {
    const indicesToBuffer: number[] = [];

    for (let i = 0; i < PREFETCH_COUNT; i++) {
      const idx = fromIndex + i;
      if (idx < chunks.length && !audioBufferRef.current.has(idx)) {
        indicesToBuffer.push(idx);
      }
    }

    // Mark as pending
    for (const idx of indicesToBuffer) {
      setBufferStatus(prev => {
        const next = new Map(prev);
        if (!next.has(idx)) {
          next.set(idx, "pending");
        }
        return next;
      });
    }

    // Generate in parallel (but don't wait for all)
    for (const idx of indicesToBuffer) {
      generateChunkAudio(idx).catch(err => {
        console.warn(`Background generation failed for chunk ${idx}:`, err);
      });
    }
  }, [chunks.length, generateChunkAudio]);

  // Play a chunk by index
  const playChunkAtIndex = useCallback(async (index: number) => {
    if (index < 0 || index >= chunks.length) return;

    const chunk = chunks[index];
    setChunkIndex(index);
    onChunkStart?.(index, chunk);

    // Check buffer
    let buffered = audioBufferRef.current.get(index);

    if (!buffered) {
      // Need to generate now
      buffered = await generateChunkAudio(index);
      if (!buffered) {
        console.error("Failed to generate audio for chunk", index);
        setIsAutoPlaying(false);
        return;
      }
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

      // Auto-advance if still in auto-play mode
      if (isAutoPlaying && autoAdvance && !intentionalStopRef.current) {
        const nextIndex = index + 1;
        if (nextIndex < chunks.length) {
          playChunkAtIndex(nextIndex);
        } else {
          // All done
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
  }, [chunks, playbackRate, isAutoPlaying, autoAdvance, stopAudio, generateChunkAudio, preBufferChunks, onComplete, onChunkStart]);

  // Start pre-buffering when component mounts or text changes
  useEffect(() => {
    if (chunks.length > 0 && ttsEnabled) {
      preBufferChunks(0);
    }
  }, [chunks.length, ttsEnabled, preBufferChunks]);

  // Controls
  const handlePlayPause = async () => {
    if (isPlaying) {
      if (isPaused) {
        audioRef.current?.play();
      } else {
        audioRef.current?.pause();
      }
      return;
    }

    setIsAutoPlaying(true);
    intentionalStopRef.current = false;
    await playChunkAtIndex(chunkIndex);
  };

  const handleStop = () => {
    intentionalStopRef.current = true;
    setIsAutoPlaying(false);
    stopAudio();
  };

  const handlePrev = async () => {
    intentionalStopRef.current = true;
    stopAudio();
    setIsAutoPlaying(true);
    intentionalStopRef.current = false;
    await playChunkAtIndex(chunkIndex - 1);
  };

  const handleNext = async () => {
    intentionalStopRef.current = true;
    stopAudio();
    setIsAutoPlaying(true);
    intentionalStopRef.current = false;
    await playChunkAtIndex(chunkIndex + 1);
  };

  const handleVoiceChange = (voiceId: string) => {
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
  };

  const speedOptions = [0.8, 1, 1.2, 1.5, 2];

  if (!ttsEnabled) return null;
  if (chunks.length === 0) return null;

  const currentChunk = chunks[Math.min(chunkIndex, chunks.length - 1)] || "";
  const currentBufferStatus = bufferStatus.get(chunkIndex);
  const isLoading = currentBufferStatus === "loading" || currentBufferStatus === "pending";

  return (
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
          title="Previous chunk"
        >
          <SkipBack className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => void handlePlayPause()}
          className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
          disabled={isLoading}
          title={isPlaying ? (isPaused ? "Resume" : "Pause") : "Play"}
        >
          {isLoading ? (
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
          title="Stop"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => void handleNext()}
          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40"
          disabled={chunkIndex >= chunks.length - 1 || isLoading}
          title="Next chunk"
        >
          <SkipForward className="h-3.5 w-3.5" />
        </button>

        <div className="flex items-center gap-1">
          {providerVoices.length ? (
            <select
              value={selectedVoiceId}
              onChange={(e) => handleVoiceChange(e.target.value)}
              className="max-w-[9.5rem] rounded-md border border-border bg-background px-1.5 py-1 text-xs"
              title="Voice"
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
            title="Playback speed"
          >
            {speedOptions.map((speed) => (
              <option key={speed} value={speed}>
                {speed}x
              </option>
            ))}
          </select>
        </div>

        <span className="text-[11px] text-muted-foreground">
          {Math.min(chunkIndex + 1, chunks.length)}/{chunks.length}
        </span>
      </div>
      <p className="mt-1 max-w-[26rem] truncate text-[11px] text-muted-foreground" title={currentChunk}>
        {isLoading ? "Generating audio..." : currentChunk}
      </p>
    </div>
  );
}
