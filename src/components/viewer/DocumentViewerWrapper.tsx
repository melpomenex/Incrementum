/**
 * Wrapper component that adds Assistant panel to DocumentViewer
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DocumentViewer as BaseDocumentViewer } from "./DocumentViewer";
import { AssistantPanel, type AssistantContext, type AssistantPosition } from "../assistant/AssistantPanel";
import { PwaAssistantButton } from "../assistant/PwaAssistantButton";
import { useDocumentStore, useSettingsStore } from "../../stores";
import * as documentsApi from "../../api/documents";
import { trimToTokenWindow } from "../../utils/tokenizer";
import { useFormFactor } from "../../hooks/useFormFactor";
import { isPWA } from "../../lib/pwa";
import {
  getAssistantContextErrorMessage,
  resolveGenericAssistantContext,
  resolvePdfAssistantContext,
  type ResolvedAssistantContext,
} from "../../utils/assistantContext";
import type { DocumentInitialJump, ExtractSourceContext } from "../../types/extractNavigation";

const ASSISTANT_POSITION_KEY = "assistant-panel-position";

interface DocumentViewerWithAssistantProps {
  documentId: string;
  initialViewMode?: "document" | "extracts" | "cards";
  highlightQuery?: string;
  initialJump?: DocumentInitialJump;
  autoPlay?: boolean;
  focusedExtractId?: string;
  extractSourceContext?: ExtractSourceContext;
}

export function DocumentViewer({
  documentId,
  initialViewMode,
  highlightQuery,
  initialJump,
  autoPlay,
  focusedExtractId,
  extractSourceContext,
}: DocumentViewerWithAssistantProps) {
  const [selection, setSelection] = useState("");
  const [scrollState, setScrollState] = useState<{ pageNumber?: number; scrollPercent?: number }>({});
  const [debouncedScrollPercent, setDebouncedScrollPercent] = useState<number | undefined>(undefined);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedScrollPercent(scrollState.scrollPercent);
    }, 500);
    return () => clearTimeout(timer);
  }, [scrollState.scrollPercent]);
  const [pdfContextText, setPdfContextText] = useState<string | undefined>(undefined);
  const [pdfOcrContextText, setPdfOcrContextText] = useState<string | null>(null);
  const [videoContext, setVideoContext] = useState<{
    videoId: string;
    title?: string;
    transcript?: string;
    currentTime?: number;
    duration?: number;
  } | null>(null);
  const currentDocument = useDocumentStore((state) => state.currentDocument);
  const settings = useSettingsStore((state) => state.settings);
  const contextWindowTokens = useSettingsStore((state) => state.settings.ai.maxTokens);
  const aiModel = useSettingsStore((state) => state.settings.ai.model);
  const pwaAssistantEnabled = useSettingsStore((state) => state.settings.ai.pwaAssistantButtonEnabled);
  const pwaAssistantSide = useSettingsStore((state) => state.settings.ai.pwaAssistantButtonSide);
  const [documentContent, setDocumentContent] = useState<string | undefined>(undefined);
  const [assistantContent, setAssistantContent] = useState<string | undefined>(undefined);
  const [assistantStatus, setAssistantStatus] = useState<"ready" | "loading" | "unavailable">("loading");
  const [assistantStatusMessage, setAssistantStatusMessage] = useState<string | undefined>(undefined);
  const [assistantSource, setAssistantSource] = useState<string | undefined>(undefined);
  const [assistantPosition, setAssistantPosition] = useState<AssistantPosition>(() => {
    const saved = localStorage.getItem(ASSISTANT_POSITION_KEY);
    return saved === "left" ? "left" : "right";
  });
  const formFactor = useFormFactor();
  // Only hide assistant on phones, not on tablets or small screens.
  const isMobile = formFactor === "phone";
  const documents = useDocumentStore((state) => state.documents);
  const currentDoc = documents.find((doc) => doc.id === documentId) ?? currentDocument ?? null;
  const selectionRef = useRef(selection);
  const pdfContextTextRef = useRef(pdfContextText);
  const pdfOcrContextTextRef = useRef(pdfOcrContextText);
  const videoContextRef = useRef(videoContext);
  const scrollStateRef = useRef(scrollState);
  const documentContentRef = useRef<string | undefined>(documentContent);
  const assistantContentRef = useRef<string | undefined>(assistantContent);
  const currentDocRef = useRef(currentDoc);

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  useEffect(() => {
    pdfContextTextRef.current = pdfContextText;
  }, [pdfContextText]);

  useEffect(() => {
    pdfOcrContextTextRef.current = pdfOcrContextText;
  }, [pdfOcrContextText]);

  useEffect(() => {
    videoContextRef.current = videoContext;
  }, [videoContext]);

  useEffect(() => {
    scrollStateRef.current = scrollState;
  }, [scrollState]);

  useEffect(() => {
    documentContentRef.current = documentContent;
  }, [documentContent]);

  useEffect(() => {
    assistantContentRef.current = assistantContent;
  }, [assistantContent]);

  useEffect(() => {
    currentDocRef.current = currentDoc;
  }, [currentDoc]);

  useEffect(() => {
    let isActive = true;
    setPdfContextText(undefined);
    setPdfOcrContextText(null);

    const loadDocumentContent = async () => {
      try {
        const doc = await documentsApi.getDocument(documentId);
        if (isActive) {
          setDocumentContent(doc?.content ?? undefined);
        }
      } catch (error) {
        console.error("Failed to load document content for assistant:", error);
        if (isActive) {
          setDocumentContent(undefined);
        }
      }
    };

    loadDocumentContent();

    return () => {
      isActive = false;
    };
  }, [documentId]);

  useEffect(() => {
    let isActive = true;
    const maxTokens = contextWindowTokens && contextWindowTokens > 0 ? contextWindowTokens : 2000;

    // If video context is available, use it even when transcript is missing.
    if (videoContext?.videoId) {
      const transcriptText = videoContext.transcript?.trim();
      const videoText = transcriptText
        ? `Video: ${videoContext.title || videoContext.videoId}\nDuration: ${formatDuration(videoContext.duration || 0)}\n\nTRANSCRIPT:\n${transcriptText}`
        : `Video: ${videoContext.title || videoContext.videoId}\nDuration: ${formatDuration(videoContext.duration || 0)}\n\nTranscript: unavailable.`;
      
      trimToTokenWindow(videoText, maxTokens, aiModel, selection)
        .then((trimmed) => {
          if (isActive) {
            setAssistantContent(trimmed);
            setAssistantStatus("ready");
            setAssistantStatusMessage(undefined);
            setAssistantSource("video-transcript");
          }
        })
        .catch(() => {
          if (isActive) {
            setAssistantContent(videoText.slice(0, maxTokens * 4));
            setAssistantStatus("ready");
            setAssistantStatusMessage(undefined);
            setAssistantSource("video-transcript");
          }
        });
      
      return () => {
        isActive = false;
      };
    }

    // Otherwise use regular document content
    const baseContent = pdfContextText ?? currentDoc?.content ?? documentContent ?? selection;

    if (!baseContent) {
      setAssistantContent(undefined);
      setAssistantStatus(currentDoc?.fileType === "pdf" ? "loading" : "unavailable");
      setAssistantStatusMessage(
        currentDoc?.fileType === "pdf"
          ? getAssistantContextErrorMessage("loading")
          : getAssistantContextErrorMessage("unavailable")
      );
      setAssistantSource(undefined);
      return () => {
        isActive = false;
      };
    }

    trimToTokenWindow(baseContent, maxTokens, aiModel, selection, debouncedScrollPercent)
      .then((trimmed) => {
        if (isActive) {
          setAssistantContent(trimmed);
          setAssistantStatus("ready");
          setAssistantStatusMessage(undefined);
          setAssistantSource(currentDoc?.fileType === "pdf" ? "pdf-window" : "document");
        }
      })
      .catch(() => {
        if (isActive) {
          setAssistantContent(baseContent.slice(0, maxTokens * 4));
          setAssistantStatus("ready");
          setAssistantStatusMessage(undefined);
          setAssistantSource(currentDoc?.fileType === "pdf" ? "pdf-window" : "document");
        }
      });

    return () => {
      isActive = false;
    };
  }, [currentDoc?.content, currentDoc?.fileType, documentContent, selection, contextWindowTokens, aiModel, pdfContextText, videoContext, debouncedScrollPercent]);

  const resolveContextForPrompt = useCallback(async (_prompt: string): Promise<ResolvedAssistantContext> => {
    const maxTokens = contextWindowTokens && contextWindowTokens > 0 ? contextWindowTokens : 2000;
    const activeDoc = currentDocRef.current;
    const activeSelection = selectionRef.current;
    const pageNumber = scrollStateRef.current.pageNumber;

    if (videoContextRef.current?.videoId) {
      return resolveGenericAssistantContext(assistantContentRef.current, "video-transcript");
    }

    if (activeDoc?.fileType === "pdf") {
      const preferOcr = settings.documents.ocr.autoOCR || settings.documents.ocr.autoExtractOnLoad;
      const resolution = await resolvePdfAssistantContext({
        document: activeDoc,
        liveWindowText: pdfContextTextRef.current,
        storedDocumentText: activeDoc.content ?? documentContentRef.current,
        ocrText: pdfOcrContextTextRef.current,
        selection: activeSelection,
        pageNumber,
        contextPageWindow: 2,
        preferOcr,
        extractedTextLoader: activeDoc.id
          ? async () => {
              const result = await documentsApi.extractDocumentText(activeDoc.id);
              return result.content;
            }
          : undefined,
      });

      if (resolution.status !== "ready" || !resolution.content) {
        return resolution;
      }

      try {
        const trimmed = await trimToTokenWindow(resolution.content, maxTokens, aiModel, activeSelection);
        return {
          ...resolution,
          content: trimmed,
        };
      } catch {
        return {
          ...resolution,
          content: resolution.content.slice(0, maxTokens * 4),
        };
      }
    }

    return resolveGenericAssistantContext(assistantContentRef.current, "document");
  }, [aiModel, contextWindowTokens, settings.documents.ocr.autoExtractOnLoad, settings.documents.ocr.autoOCR]);

  const assistantContext = useMemo<AssistantContext>(() => {
    const maxTokens = contextWindowTokens && contextWindowTokens > 0 ? contextWindowTokens : 2000;

    const base = {
      documentId,
      selection: selection || undefined,
      content: assistantContent,
      contextWindowTokens: maxTokens,
      status: assistantStatus,
      statusMessage: assistantStatusMessage,
      source: assistantSource,
      resolveForPrompt: resolveContextForPrompt,
    };

    if (videoContext?.videoId) {
      return {
        ...base,
        type: "video" as const,
        position: { currentTime: videoContext.currentTime },
        metadata: {
          title: videoContext.title,
          duration: videoContext.duration,
          videoId: videoContext.videoId,
        },
      };
    }

    return {
      ...base,
      type: "document" as const,
      position: scrollState,
    };
  }, [
    assistantContent,
    assistantSource,
    assistantStatus,
    assistantStatusMessage,
    contextWindowTokens,
    documentId,
    resolveContextForPrompt,
    scrollState,
    selection,
    videoContext,
  ]);

  const handlePositionChange = (newPosition: AssistantPosition) => {
    setAssistantPosition(newPosition);
    localStorage.setItem(ASSISTANT_POSITION_KEY, newPosition);
  };

  const assistantPanel = (
    <AssistantPanel
      context={assistantContext}
      className="flex-shrink-0"
      position={assistantPosition}
      onPositionChange={handlePositionChange}
    />
  );

  const documentViewer = (
    <div className="flex-1 h-full min-h-0 overflow-hidden">
      <BaseDocumentViewer
        documentId={documentId}
        onSelectionChange={setSelection}
        onScrollPositionChange={setScrollState}
        initialViewMode={initialViewMode}
        highlightQuery={highlightQuery}
        initialJump={initialJump}
        autoPlay={autoPlay}
        focusedExtractId={focusedExtractId}
        extractSourceContext={extractSourceContext}
        onPdfContextTextChange={setPdfContextText}
        onPdfOcrContextTextChange={setPdfOcrContextText}
        contextPageWindow={2}
        onVideoContextChange={setVideoContext}
      />
    </div>
  );

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {isMobile ? (
        <>
          {documentViewer}
          {isPWA() && (
            <PwaAssistantButton
              context={assistantContext}
              enabled={pwaAssistantEnabled}
              side={pwaAssistantSide}
            />
          )}
        </>
      ) : assistantPosition === "left" ? (
        <>
          {assistantPanel}
          {documentViewer}
        </>
      ) : (
        <>
          {documentViewer}
          {assistantPanel}
        </>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
