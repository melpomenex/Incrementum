/**
 * Wrapper component that adds Assistant panel to LocalVideoPlayer
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { LocalVideoPlayer as BaseLocalVideoPlayer } from "./LocalVideoPlayer";
import { AssistantPanel, type AssistantContext, type AssistantPosition } from "../assistant/AssistantPanel";
import { useSettingsStore } from "../../stores";
import { getDeviceInfo } from "../../lib/pwa";
import { trimToTokenWindow } from "../../utils/tokenizer";
import { getVideoTranscript } from "../../api/video-extracts";

const ASSISTANT_POSITION_KEY = "local-video-assistant-panel-position";

interface LocalVideoPlayerWithAssistantProps {
  src: string;
  documentId?: string;
  title?: string;
  mediaType?: "video" | "audio";
  className?: string;
}

export function LocalVideoPlayer({ src, documentId, title, mediaType, className }: LocalVideoPlayerWithAssistantProps) {
  const [assistantInputActive, setAssistantInputActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const contextWindowTokens = useSettingsStore((state) => state.settings.ai.maxTokens);
  const aiModel = useSettingsStore((state) => state.settings.ai.model);
  const [assistantContent, setAssistantContent] = useState<string | undefined>(undefined);
  const [assistantPosition, setAssistantPosition] = useState<AssistantPosition>(() => {
    const saved = localStorage.getItem(ASSISTANT_POSITION_KEY);
    return saved === "left" ? "left" : "right";
  });
  const deviceInfo = getDeviceInfo();
  const isMobile = deviceInfo.isMobile;

  // Load transcript and convert to text format for the assistant
  useEffect(() => {
    if (!documentId) {
      setAssistantContent(undefined);
      return;
    }

    const loadTranscriptForAssistant = async () => {
      try {
        const result = await getVideoTranscript(documentId);
        if (!result?.segments || result.segments.length === 0) {
          setAssistantContent(undefined);
          return;
        }

        const maxTokens = contextWindowTokens && contextWindowTokens > 0 ? contextWindowTokens : 2000;

        // Format transcript with timestamps for context
        const transcriptText = result.segments
          .map((seg) => `[${formatTime(seg.time)}] ${seg.text}`)
          .join("\n");

        const videoContext = `Video: ${title || "Local Video"}\nDuration: ${formatTime(duration)}\n\nTRANSCRIPT:\n${transcriptText}`;

        trimToTokenWindow(videoContext, maxTokens, aiModel)
          .then((trimmed) => {
            setAssistantContent(trimmed);
          })
          .catch(() => {
            // Fallback: truncate by character count
            setAssistantContent(videoContext.slice(0, maxTokens * 4));
          });
      } catch (error) {
        console.log("[LocalVideoPlayerWrapper] Failed to load transcript for assistant:", error);
        setAssistantContent(undefined);
      }
    };

    loadTranscriptForAssistant();
  }, [documentId, title, duration, contextWindowTokens, aiModel]);

  const assistantContext = useMemo<AssistantContext>(() => {
    const maxTokens = contextWindowTokens && contextWindowTokens > 0 ? contextWindowTokens : 2000;
    return {
      type: "video",
      documentId,
      content: assistantContent,
      contextWindowTokens: maxTokens,
      position: {
        currentTime,
      },
      metadata: {
        title: title || undefined,
        duration: duration || undefined,
      },
    };
  }, [assistantContent, documentId, contextWindowTokens, currentTime, title, duration]);

  const handlePositionChange = (newPosition: AssistantPosition) => {
    setAssistantPosition(newPosition);
    localStorage.setItem(ASSISTANT_POSITION_KEY, newPosition);
  };

  // Handle metadata load
  const handleMetadataLoad = useCallback((metadata: { duration: number; title: string }) => {
    setDuration(metadata.duration);
  }, []);

  const assistantPanel = (
    <AssistantPanel
      context={assistantContext}
      className="flex-shrink-0"
      onInputHoverChange={setAssistantInputActive}
      position={assistantPosition}
      onPositionChange={handlePositionChange}
    />
  );

  const localVideoPlayer = (
    <div className="flex-1 h-full overflow-hidden">
      <BaseLocalVideoPlayer
        src={src}
        documentId={documentId}
        title={title}
        mediaType={mediaType}
        onLoad={handleMetadataLoad}
      />
    </div>
  );

  return (
    <div className="flex h-full">
      {isMobile ? (
        localVideoPlayer
      ) : assistantPosition === "left" ? (
        <>
          {assistantPanel}
          {localVideoPlayer}
        </>
      ) : (
        <>
          {localVideoPlayer}
          {assistantPanel}
        </>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hours = Math.floor(mins / 60);
  if (hours > 0) {
    return `${hours}:${(mins % 60).toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
