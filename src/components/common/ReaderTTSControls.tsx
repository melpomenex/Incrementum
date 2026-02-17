import { useEffect, useMemo, useState } from "react";
import { Pause, Play, SkipBack, SkipForward, Square, Volume2 } from "lucide-react";
import { useTTS } from "../../hooks/useTTS";
import { useSettingsStore } from "../../stores/settingsStore";
import { getVoicesForProvider } from "../../utils/ttsSettings";
import { cn } from "../../utils";

interface ReaderTTSControlsProps {
  text: string;
  className?: string;
}

const CHUNK_TARGET = 420;
const CHUNK_MAX = 700;

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

export function ReaderTTSControls({ text, className }: ReaderTTSControlsProps) {
  const tts = useSettingsStore((state) => state.settings.tts);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const ttsEnabled = tts?.enabled;
  const providerVoices = useMemo(
    () => (tts ? getVoicesForProvider(tts) : []),
    [tts]
  );
  const [playbackRate, setPlaybackRate] = useState(1);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [selectedVoiceId, setSelectedVoiceId] = useState(tts?.defaultVoiceId ?? "");

  const chunks = useMemo(() => buildChunks(text), [text]);
  const {
    speak,
    stop,
    pause,
    resume,
    isSpeaking,
    isPaused,
    isGenerating,
  } = useTTS({ rate: playbackRate });

  useEffect(() => {
    if (!tts) return;
    const hasSelectedVoice = providerVoices.some((voice) => voice.id === selectedVoiceId);
    if (!hasSelectedVoice) {
      setSelectedVoiceId(providerVoices[0]?.id || tts.defaultVoiceId);
    }
  }, [tts, providerVoices, selectedVoiceId]);

  useEffect(() => {
    setChunkIndex(0);
    stop();
  }, [chunks.length, stop]);

  if (!ttsEnabled) return null;
  if (chunks.length === 0) return null;

  const currentChunk = chunks[Math.min(chunkIndex, chunks.length - 1)] || "";

  const playChunk = async (index: number) => {
    const nextIndex = Math.min(Math.max(0, index), chunks.length - 1);
    setChunkIndex(nextIndex);
    await speak(chunks[nextIndex], selectedVoiceId ? { voiceId: selectedVoiceId } : undefined);
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
  };

  const handlePlayPause = async () => {
    if (isGenerating) return;

    if (isSpeaking) {
      if (isPaused) {
        resume();
      } else {
        pause();
      }
      return;
    }

    if (isPaused) {
      resume();
      return;
    }

    await playChunk(chunkIndex);
  };

  const handlePrev = async () => {
    stop();
    await playChunk(chunkIndex - 1);
  };

  const handleNext = async () => {
    stop();
    await playChunk(chunkIndex + 1);
  };

  const speedOptions = [0.8, 1, 1.2, 1.5, 2];

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
          disabled={chunkIndex === 0 || isGenerating}
          title="Previous chunk"
        >
          <SkipBack className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => void handlePlayPause()}
          className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
          title={isSpeaking ? (isPaused ? "Resume" : "Pause") : "Play"}
        >
          {isSpeaking && !isPaused ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={stop}
          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40"
          disabled={!isSpeaking && !isPaused && !isGenerating}
          title="Stop"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => void handleNext()}
          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40"
          disabled={chunkIndex >= chunks.length - 1 || isGenerating}
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
            onChange={(e) => setPlaybackRate(Number(e.target.value))}
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
        {isGenerating ? "Generating audio..." : currentChunk}
      </p>
    </div>
  );
}
