import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, FileText, List, Brain, Lightbulb, Search, X, Maximize, Minimize, Share2, FileCode, Loader2, Languages, PanelsTopLeft } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useDocumentStore, useTabsStore, useQueueStore } from "../../stores";
import { isTauri, isPWA } from "../../lib/tauri";
import { useSettingsStore } from "../../stores/settingsStore";
import { PDFViewer } from "./PDFViewer";
import { MarkdownViewer } from "./MarkdownViewer";
import { EPUBViewer } from "./EPUBViewer";
import { YouTubeViewer } from "./YouTubeViewer";
import { LocalVideoPlayer } from "./LocalVideoPlayerWrapper";
import { AudiobookViewer } from "./AudiobookViewer";
import { ExtractsList } from "../extracts/ExtractsList";
import { LearningCardsList } from "../learning/LearningCardsList";
import { EditableContentPalette } from "../common/EditableContentPalette";
import { useToast } from "../common/Toast";
import { CreateExtractDialog } from "../extracts/CreateExtractDialog";
import type { PdfSelectionContext, SelectionContext, TextSelectionContext, EpubSelectionContext } from "../../types/selection";
import type { Extract } from "../../api/extracts";
import { createExtract } from "../../api/extracts";
import { QueueNavigationControls } from "../queue/QueueNavigationControls";
import { HoverRatingControls } from "../review/HoverRatingControls";
import { PriorityControl } from "./PriorityControl";
import { DocumentMinimap, type MinimapSegment } from "./DocumentMinimap";
import { useInlineExtraction, flashAnimationStyles } from "../../hooks/useInlineExtraction";
import { markItemViewed } from "../../lib/queueSession";
import { useQueueNavigation } from "../../hooks/useQueueNavigation";
import { cn } from "../../utils";
import * as documentsApi from "../../api/documents";
import { createLearningItem, generateLearningItemsFromExtract } from "../../api/learning-items";
import { updateDocumentProgressAuto } from "../../api/documents";
import { rateDocument } from "../../api/algorithm";
import type { ReviewRating } from "../../api/review";
import { autoExtractWithCache, ensureGLMOllamaRuntime, ensureOCRConfig, isAutoExtractEnabled } from "../../utils/documentAutoExtract";
import { ocrPdfFile } from "../../api/ocrCommands";
import { renderMarkdown } from "../../utils/markdown";
import { processHtmlContent } from "../../utils/documentImport";
import { lookupDictionary, type DictionaryResult } from "../../utils/dictionaryLookup";
import { recordReadingSession } from "../../utils/readingSpeed";
import type { DocumentInitialJump, ExtractSourceContext } from "../../types/extractNavigation";
import type { DocumentSearchState } from "../../types/searchHit";
import { ReaderTTSControls } from "../common/ReaderTTSControls";
import { generateShareUrl, copyShareLink, DocumentState, parseStateFromUrl } from "../../lib/shareLink";
import { usePdfUrlState } from "../../hooks/usePdfUrlState";
import { dispatchCommandPaletteOpen, isCommandPaletteOpenShortcut } from "../../utils/commandPaletteShortcut";
import {
  flushAllViewStateWrites,
  getPreferredViewStateKey,
  getViewState,
  getViewStateKey,
  getViewStateKeyCandidates,
  parseViewState,
  setViewState,
} from "../../lib/readerPosition";
import type { ViewState } from "../../types/readerPosition";
import { saveDocumentPosition, pagePosition, scrollPosition } from "../../api/position";
import type { DocumentPosition } from "../../types/position";
import { useExtractStore } from "../../stores/extractStore";
import { extractYouTubeVideoId } from "../../utils/youtubeEmbed";
import {
  getPdfExtractBlockReason,
  isValidPdfSelection,
  type PdfTextSelectionCapability,
} from "./pdfTextSelection";
import { useI18n } from "../../lib/i18n";
import type { StoredHighlight } from "./HighlightLayer";
import { normalizePdfHighlightColor } from "../../utils/highlightColors";
import { applyAnchoredTextHighlights, buildTextSelectionContext, type AnchoredTextHighlight } from "../../utils/textHighlights";
import { resolveLocalMediaSource, type ResolvedLocalMediaSource } from "./localMediaSource";

const READER_FOCUS_EVENT = "incrementum-reader-focus-mode-change";
const READER_FOCUS_CLASS = "incrementum-reader-focus-mode";

// Helper to format seconds as MM:SS or HH:MM:SS
function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

type ViewMode = "document" | "extracts" | "cards";
type PdfViewMode = "pdf" | "ocr-html";

type DocumentType = "pdf" | "epub" | "markdown" | "html" | "youtube" | "video" | "audio" | "other";
const MARKDOWN_WIDTH_STORAGE_KEY = "incrementum.markdown.width-ch";
const MARKDOWN_MIN_WIDTH_CH = 80;
const MARKDOWN_MAX_WIDTH_CH = 180;
const MARKDOWN_DEFAULT_WIDTH_CH = 120;
const MARKDOWN_LEGACY_DEFAULT_WIDTH_CH = 82;

const DOCUMENT_TYPES: DocumentType[] = ["pdf", "epub", "markdown", "html", "youtube", "video", "audio"];
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "m4b", "aac", "ogg", "flac", "opus"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "mkv", "avi", "m4v"]);

const normalizeDocumentType = (value?: string): DocumentType | undefined => {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (DOCUMENT_TYPES.includes(normalized as DocumentType)) {
    return normalized as DocumentType;
  }
  if (normalized === "md" || normalized === "markdown") return "markdown";
  if (normalized === "htm" || normalized === "html") return "html";
  if (AUDIO_EXTENSIONS.has(normalized)) return "audio";
  if (VIDEO_EXTENSIONS.has(normalized)) return "video";
  return undefined;
};

const isEditableBrowserArticleDocument = (doc?: {
  fileType?: string;
  metadata?: {
    source?: string;
    browserImportMode?: string;
    articleHtml?: string;
  };
}) => {
  if (!doc) return false;
  const normalizedType = normalizeDocumentType(doc.fileType);
  return (
    doc.metadata?.source === "browser_extension" &&
    (normalizedType === "html" || normalizedType === "markdown")
  );
};

function isPdfSelectionContext(value: unknown): value is PdfSelectionContext {
  return Boolean(value && typeof value === "object" && (value as { type?: string }).type === "pdf");
}

function isTextSelectionContext(value: unknown): value is TextSelectionContext {
  return Boolean(value && typeof value === "object" && (value as { type?: string }).type === "text");
}

function isEpubSelectionContext(value: unknown): value is EpubSelectionContext {
  return Boolean(value && typeof value === "object" && (value as { type?: string }).type === "epub");
}

function toExtractDialogColor(color?: string): string | undefined {
  switch (color) {
    case "yellow":
      return "#fef08a";
    case "green":
      return "#bbf7d0";
    case "blue":
      return "#bfdbfe";
    case "pink":
      return "#fbcfe8";
    case "purple":
      return "#e9d5ff";
    default:
      return color;
  }
}

/**
 * Helper to convert scroll state to unified DocumentPosition
 */
function getUnifiedPositionForDocument(
  docType: DocumentType | undefined,
  state: {
    pageNumber: number;
    scrollPercent: number;
    scrollTop: number;
  }
): DocumentPosition | null {
  switch (docType) {
    case "pdf":
      return pagePosition(state.pageNumber);
    case "epub":
      // EPUB uses CFI which is not available in basic scroll state
      // Fall back to scroll percent
      return scrollPosition(state.scrollPercent);
    case "markdown":
    case "html":
      return scrollPosition(state.scrollPercent);
    case "youtube":
      // YouTube uses time-based position (handled separately)
      return null;
    default:
      return scrollPosition(state.scrollPercent);
  }
}

interface DocumentViewerProps {
  documentId: string;
  disableHoverRating?: boolean;
  /**
   * When true, the viewer is being rendered inside another reading surface
   * (eg Scroll Mode) and should not render its own top chrome.
   */
  embedded?: boolean;
  onSelectionChange?: (selection: string) => void;
  onScrollPositionChange?: (state: { pageNumber: number; scrollPercent: number }) => void;
  initialViewMode?: ViewMode;
  highlightQuery?: string;
  initialJump?: DocumentInitialJump;
  autoPlay?: boolean;
  onPdfContextTextChange?: (text: string) => void;
  onPdfOcrContextTextChange?: (text: string | null) => void;
  contextPageWindow?: number;
  onExtractCreated?: (extract: Extract, sourceContext?: ExtractSourceContext) => void;
  extractPostCreateBehavior?: "show-extracts" | "stay-in-reader";
  focusedExtractId?: string;
  extractSourceContext?: ExtractSourceContext;
  onVideoContextChange?: (context: { 
    videoId: string; 
    title?: string; 
    transcript?: string; 
    currentTime?: number;
    duration?: number;
  } | null) => void;
}

type ViewerSearchDirection = "next" | "prev";

interface ViewerSearchNavigationRequest {
  direction: ViewerSearchDirection;
  nonce: number;
  targetIndex?: number;
}

type ViewerSearchState = DocumentSearchState;

const DEFAULT_VIEWER_SEARCH_STATE: ViewerSearchState = {
  supported: true,
  available: true,
  totalMatches: 0,
  activeMatchIndex: 0,
};

export function DocumentViewer({
  documentId,
  disableHoverRating = false,
  embedded = false,
  onSelectionChange,
  onScrollPositionChange,
  initialViewMode,
  highlightQuery,
  initialJump,
  autoPlay,
  onPdfContextTextChange,
  onPdfOcrContextTextChange,
  contextPageWindow,
  onExtractCreated,
  extractPostCreateBehavior = "show-extracts",
  focusedExtractId,
  extractSourceContext,
  onVideoContextChange,
}: DocumentViewerProps) {
  const toast = useToast();
  const { t } = useI18n();
  const { documents, setCurrentDocument, currentDocument: globalCurrentDocument, updateDocument } = useDocumentStore();
  
  // Use local document lookup by documentId prop instead of global currentDocument
  // This allows multiple DocumentViewers to show different documents in split panes
  const localDocument = documents.find((d) => d.id === documentId);
  const currentDocument = localDocument || globalCurrentDocument;
  const { closeTab, tabs, updateTab, setActiveTab, findPaneContainingTab } = useTabsStore();
  const { items: queueItems, loadQueue } = useQueueStore();
  const { settings } = useSettingsStore();

  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [scale, setScale] = useState(1.0);
  const [zoomMode, setZoomMode] = useState<"custom" | "fit-width" | "fit-page">("fit-width");
  const [fileData, setFileData] = useState<Uint8Array | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [epubUrl, setEpubUrl] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [mediaSource, setMediaSource] = useState<ResolvedLocalMediaSource | null>(null);
  const mediaSourceRef = useRef<ResolvedLocalMediaSource | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setPagesRendered] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode ?? "document");
  const [isPaletteMode, setIsPaletteMode] = useState(false);
  const [videoContext, setVideoContext] = useState<{
    videoId: string;
    title?: string;
    transcript?: string;
    currentTime?: number;
    duration?: number;
  } | null>(null);
  const readingSessionStartRef = useRef(Date.now());

  // Clear transient video context when switching documents.
  useEffect(() => {
    setVideoContext(null);
    readingSessionStartRef.current = Date.now();
  }, [documentId]);

  useEffect(() => {
    return () => {
      if (!currentDocument) return;
      const minutesSpent = (Date.now() - readingSessionStartRef.current) / 60000;
      if (minutesSpent < 0.5) return;
      const plainText = String(currentDocument.content || "").replace(/<[^>]+>/g, " ");
      const wordsRead = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
      const normalizedDocType = normalizeDocumentType(String(currentDocument.fileType || "")) || "other";
      recordReadingSession({
        docType: normalizedDocType,
        wordsRead,
        minutesSpent,
      });
    };
  }, [currentDocument]);

  // Notify parent of video context changes
  useEffect(() => {
    onVideoContextChange?.(videoContext);
  }, [videoContext, onVideoContextChange]);

  // Inject flash animation styles for inline extraction
  useEffect(() => {
    const styleId = "inline-extraction-styles";
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = flashAnimationStyles;
    document.head.appendChild(style);
    
    return () => {
      style.remove();
    };
  }, []);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewerSearchState, setViewerSearchState] = useState<ViewerSearchState>(DEFAULT_VIEWER_SEARCH_STATE);
  const [viewerSearchNavRequest, setViewerSearchNavRequest] = useState<ViewerSearchNavigationRequest | null>(null);
  const [markdownWidthCh, setMarkdownWidthCh] = useState<number>(() => {
    if (typeof window === "undefined") return MARKDOWN_DEFAULT_WIDTH_CH;
    const raw = window.localStorage.getItem(MARKDOWN_WIDTH_STORAGE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    if (Number.isNaN(parsed)) return MARKDOWN_DEFAULT_WIDTH_CH;
    // Migrate old default to the new wider default automatically.
    if (parsed === MARKDOWN_LEGACY_DEFAULT_WIDTH_CH) return MARKDOWN_DEFAULT_WIDTH_CH;
    return Math.min(MARKDOWN_MAX_WIDTH_CH, Math.max(MARKDOWN_MIN_WIDTH_CH, parsed));
  });
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const htmlSearchMatchesRef = useRef<HTMLElement[]>([]);
  const viewerSearchNavCounterRef = useRef(0);
  const jumpTextQuote =
    initialJump && "textQuote" in initialJump && typeof initialJump.textQuote === "string" && initialJump.textQuote.trim()
      ? initialJump.textQuote.trim()
      : undefined;
  const jumpHighlightQuery = jumpTextQuote ?? (highlightQuery?.trim() ? highlightQuery.trim() : undefined);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [minimapPosition, setMinimapPosition] = useState(0); // 0-1
  const [ocrContextText, setOcrContextText] = useState<string | null>(null);
  const [readerContextText, setReaderContextText] = useState<string>("");
  const [ocrResult, setOcrResult] = useState<{
    pages: Array<{ pageNumber: number; text: string }>;
    combinedText: string;
    format: "text" | "markdown" | "html";
    pageCount: number;
  } | null>(null);
  const [pdfViewMode, setPdfViewMode] = useState<PdfViewMode>("pdf");
  const [isOcrConverting, setIsOcrConverting] = useState(false);
  const [restoreRequestId, setRestoreRequestId] = useState(0);
  const [restoreState, setRestoreState] = useState<ViewState | null>(null);
  // Start with auto-scroll suppressed until restoration completes (or we confirm there's no saved position)
  const [suppressPdfAutoScroll, setSuppressPdfAutoScroll] = useState(true);
  const restoreScrollAttemptsRef = useRef(0);
  const restoreScrollTimeoutRef = useRef<number | null>(null);
  const restoreScrollDoneRef = useRef(false);
  const restorationInProgressRef = useRef(false);
  const scrollSaveTimeoutRef = useRef<number | null>(null);
  const restoreRequestIdRef = useRef(0);
  const restoreAttemptRef = useRef(0);
  const restoreReadyAttemptsRef = useRef(0);
  const pendingViewStateRef = useRef<ViewState | null>(null);
  const lastViewStateRef = useRef<ViewState | null>(null);
  const pdfFingerprintRef = useRef<string | null>(null);
  const lastScrollStateRef = useRef<{
    pageNumber: number;
    scrollTop: number;
    scrollLeft: number;
    scrollHeight: number;
    clientHeight: number;
    scrollPercent: number;
    scale?: number;
  } | null>(null);
  const lastScrollMetaRef = useRef<{ storageKey?: string; documentId?: string | null } | null>(null);
  const skipStoredScrollRef = useRef(false);
  // Track current page number for cleanup to use
  const currentPageRef = useRef(pageNumber);
  const scaleRef = useRef(scale);
  const zoomModeRef = useRef(zoomMode);
  const viewModeRef = useRef(viewMode);

  const scrollStorageKey = currentDocument?.id
    ? `document-scroll-position:${currentDocument.id}`
    : undefined;
  const queueScrollTab = useMemo(
    () => tabs.find((tab) => tab.type === "queue-scroll") ?? null,
    [tabs]
  );

  const resumeQueueFromExtract = useCallback(() => {
    if (!queueScrollTab) return;
    const pane = findPaneContainingTab(queueScrollTab.id);
    if (!pane) return;
    setActiveTab(pane.id, queueScrollTab.id);
  }, [findPaneContainingTab, queueScrollTab, setActiveTab]);

  // Listen for fullscreen changes (for PWA/browser environment)
  useEffect(() => {
    if (isTauri()) return;

    const handleFullscreenChange = () => {
      const fullscreenElement = document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).msFullscreenElement;
      setIsFullscreen(!!fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // In browser/PWA, entering document fullscreen should collapse app chrome and keep only
  // the reading surface (plus assistant panel where available in parent layouts).
  useEffect(() => {
    if (isTauri() || embedded) return;

    document.body.classList.toggle(READER_FOCUS_CLASS, isFullscreen);
    window.dispatchEvent(
      new CustomEvent(READER_FOCUS_EVENT, {
        detail: { active: isFullscreen },
      })
    );

    return () => {
      document.body.classList.remove(READER_FOCUS_CLASS);
      window.dispatchEvent(
        new CustomEvent(READER_FOCUS_EVENT, {
          detail: { active: false },
        })
      );
    };
  }, [embedded, isFullscreen]);

  const resolvePreferredViewStateKey = useCallback(
    (docId?: string | null) =>
      getPreferredViewStateKey({
        documentId: docId ?? currentDocument?.id ?? null,
        contentHash: currentDocument?.contentHash ?? null,
        pdfFingerprint: pdfFingerprintRef.current,
      }),
    [currentDocument?.contentHash, currentDocument?.id]
  );

  const resolveViewStateKeyCandidates = useCallback(
    (docId?: string | null) =>
      getViewStateKeyCandidates({
        documentId: docId ?? currentDocument?.id ?? null,
        contentHash: currentDocument?.contentHash ?? null,
        pdfFingerprint: pdfFingerprintRef.current,
      }),
    [currentDocument?.contentHash, currentDocument?.id]
  );

  // Infer fileType from filePath if it's missing (legacy data or import issue)
  const inferFileType = (doc?: typeof currentDocument): DocumentType => {
    if (!doc) return "other";
    if (doc.fileType && doc.fileType !== "other") {
      const normalized = normalizeDocumentType(doc.fileType);
      if (normalized) return normalized;
    }
    // Fallback: infer from file extension
    const ext = doc.filePath?.split(".").pop()?.toLowerCase();
    const inferred = normalizeDocumentType(ext);
    if (inferred) return inferred;
    // Check if filePath is a YouTube URL or ID
    if (doc.filePath?.includes("youtube.com") ||
      doc.filePath?.includes("youtu.be") ||
      doc.fileType === "youtube") {
      return "youtube";
    }
    // If document has content, treat as markdown
    if (doc.content) {
      return "markdown";
    }
    return "other";
  };

  const docType = inferFileType(currentDocument);
  const viewerSearchSupported = docType === "pdf" || docType === "epub" || docType === "markdown" || docType === "html" || docType === "youtube";
  const normalizedViewerSearchQuery = searchQuery.trim();
  const reportViewerSearchState = useCallback((next: Partial<ViewerSearchState>) => {
    setViewerSearchState((prev) => ({
      ...prev,
      ...next,
      supported: next.supported ?? prev.supported,
      available: next.available ?? prev.available,
      totalMatches: next.totalMatches ?? prev.totalMatches,
      activeMatchIndex: next.activeMatchIndex ?? prev.activeMatchIndex,
      unavailableReason: next.unavailableReason,
    }));
  }, []);
  const canUseEditPalette = viewMode === "document"
    && (
      docType === "markdown"
      || docType === "html"
      || docType === "epub"
      || isEditableBrowserArticleDocument(currentDocument)
    );
  const buildExtractSourceContext = useCallback((): ExtractSourceContext | undefined => {
    const title = currentDocument?.title || localDocument?.title;
    if (!documentId || !title) return undefined;

    let sourceKind: ExtractSourceContext["sourceKind"] = "source";
    if (docType === "pdf" || docType === "epub" || docType === "markdown") {
      sourceKind = "book";
    } else if (
      docType === "html" ||
      docType === "youtube" ||
      isEditableBrowserArticleDocument(currentDocument ?? localDocument ?? undefined)
    ) {
      sourceKind = "article";
    }

    let jump: DocumentInitialJump | undefined;
    if (docType === "pdf") {
      jump = { kind: "pdf", pageNumber };
    } else if (docType === "epub" && currentDocument?.currentCfi) {
      jump = { kind: "epub", cfi: currentDocument.currentCfi };
    } else if (docType === "html") {
      jump = {
        kind: "html",
        scrollPercent: lastScrollStateRef.current?.scrollPercent ?? currentDocument?.currentScrollPercent ?? 0,
      };
    } else if (docType === "markdown") {
      jump = {
        kind: "markdown",
        scrollPercent: lastScrollStateRef.current?.scrollPercent ?? currentDocument?.currentScrollPercent ?? 0,
      };
    }

    return {
      documentId,
      sourceTitle: title,
      sourceKind,
      queueType: embedded ? "queue-scroll" : undefined,
      initialJump: jump,
    };
  }, [currentDocument, docType, documentId, embedded, localDocument, pageNumber]);

  useEffect(() => {
    htmlSearchMatchesRef.current = [];
    setViewerSearchNavRequest(null);
    setViewerSearchState({
      ...DEFAULT_VIEWER_SEARCH_STATE,
      supported: viewerSearchSupported,
      available: viewerSearchSupported,
      unavailableReason: undefined,
    });
  }, [documentId, viewerSearchSupported]);

  useEffect(() => {
    if (normalizedViewerSearchQuery) return;
    setViewerSearchState((prev) => ({
      ...prev,
      supported: viewerSearchSupported,
      available: viewerSearchSupported,
      totalMatches: 0,
      activeMatchIndex: 0,
      unavailableReason: undefined,
    }));
  }, [normalizedViewerSearchQuery, viewerSearchSupported]);

  useEffect(() => {
    setIsPaletteMode(false);
  }, [documentId]);

  useEffect(() => {
    return () => {
      if (mediaSourceRef.current?.revokeSrcOnDispose) {
        URL.revokeObjectURL(mediaSourceRef.current.src);
      }
    };
  }, []);

  useEffect(() => {
    if (viewMode !== "document") {
      setIsPaletteMode(false);
    }
  }, [viewMode]);

  const saveEditableDocumentContent = useCallback(async (content: string) => {
    if (!currentDocument) return;
    const updated = await documentsApi.updateDocumentContent(currentDocument.id, content);
    updateDocument(currentDocument.id, { content: updated.content ?? content });
    if (docType === "html") {
      setHtmlContent(updated.content ?? content);
    }
  }, [currentDocument, docType, updateDocument]);

  // Handle URL hash state changes (back/forward navigation)
  const handleUrlHashChange = useCallback((state: {
    pageNumber?: number;
    scale?: number;
    zoomMode?: "custom" | "fit-width" | "fit-page";
    scrollPercent?: number;
  }) => {
    if (state.pageNumber !== undefined) {
      setPageNumber(state.pageNumber);
    }
    if (state.scale !== undefined) {
      setScale(state.scale);
    }
    if (state.zoomMode !== undefined) {
      setZoomMode(state.zoomMode);
    }
    // Scroll percent will be handled by the restoration logic
    if (state.scrollPercent !== undefined) {
      // Trigger a restore with the scroll percent
      const container = document.querySelector("[data-document-scroll-container]") as HTMLElement | null;
      if (container) {
        const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
        container.scrollTop = (state.scrollPercent / 100) * maxScroll;
      }
    }
  }, []);

  const enablePdfUrlSync = false;

  // URL hash state synchronization for PDF back/forward navigation
  const { pushState: pushUrlState } = usePdfUrlState(
    {
      pageNumber,
      scale,
      zoomMode,
      scrollPercent: lastScrollStateRef.current?.scrollPercent,
    },
    {
      enabled: enablePdfUrlSync && viewMode === "document" && docType === "pdf",
      debounceMs: 800,
      onHashChange: handleUrlHashChange,
    }
  );
  const hasDocumentHistory =
    (currentDocument?.reps ?? currentDocument?.readingCount ?? 0) > 0
    || !!currentDocument?.dateLastReviewed;

  useEffect(() => {
    lastScrollMetaRef.current = { storageKey: scrollStorageKey, documentId: currentDocument?.id ?? null };
  }, [scrollStorageKey, currentDocument?.id]);

  // Keep currentPageRef in sync with pageNumber state
  useEffect(() => {
    currentPageRef.current = pageNumber;
  }, [pageNumber]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    zoomModeRef.current = zoomMode;
  }, [zoomMode]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  // Track the last page user viewed, independent of scroll suppression
  // This ensures we save the correct page even if scroll handler was suppressed
  const lastViewedPageRef = useRef(pageNumber);
  useEffect(() => {
    lastViewedPageRef.current = pageNumber;
  }, [pageNumber]);

  // Extract creation state
  const [selectedText, setSelectedText] = useState("");
  const [selectionContext, setSelectionContext] = useState<SelectionContext | null>(null);
  const [initialHighlightColor, setInitialHighlightColor] = useState<string | undefined>(undefined);
  const [pdfTextSelectionCapability, setPdfTextSelectionCapability] = useState<PdfTextSelectionCapability | null>(null);
  const [isExtractDialogOpen, setIsExtractDialogOpen] = useState(false);
  const [dictionaryResult, setDictionaryResult] = useState<DictionaryResult | null>(null);
  const [isDictionaryLoading, setIsDictionaryLoading] = useState(false);
  const lastSelectionRef = useRef("");
  const lastDocumentIdRef = useRef<string | null>(null);
  const lastLoadedDocumentIdRef = useRef<string | null>(null); // Track successfully loaded documents
  const documentsRef = useRef(documents);
  documentsRef.current = documents;

  // Mobile PWA text selection state
  const [mobileSelection, setMobileSelection] = useState<{
    text: string;
    position: { x: number; y: number };
    showButton: boolean;
  }>({ text: "", position: { x: 0, y: 0 }, showButton: false });
  const mobileSelectionTimeoutRef = useRef<number | null>(null);
  const isMobilePWA = isPWA() && (window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window);
  const activeExtractSelection = docType === "epub"
    ? (selectedText || lastSelectionRef.current)
    : selectedText;

  const handleDictionaryLookup = useCallback(async () => {
    const word = activeExtractSelection.trim().split(/\s+/)[0] || "";
    if (!word) return;
    setIsDictionaryLoading(true);
    try {
      const result = await lookupDictionary(word);
      setDictionaryResult(result);
    } catch (error) {
      toast.error(t("viewer.lookupFailed"), error instanceof Error ? error.message : t("viewer.failedToLookupWord"));
    } finally {
      setIsDictionaryLoading(false);
    }
  }, [activeExtractSelection, toast]);

  // Extract store for minimap
  const { extracts, loadExtracts } = useExtractStore();
  
  // Load extracts for minimap
  useEffect(() => {
    if (currentDocument?.id) {
      loadExtracts(currentDocument.id);
    }
  }, [currentDocument?.id, loadExtracts]);
  
  // Build minimap segments from extracts
  const minimapSegments: MinimapSegment[] = useMemo(() => {
    const segments: MinimapSegment[] = [];
    
    // Add segments for each extract
    for (const extract of extracts) {
      if (extract.documentId === currentDocument?.id) {
        // Calculate position from page number or scroll percentage
        let position = 0;
        if (extract.pageNumber && currentDocument?.totalPages) {
          position = extract.pageNumber / currentDocument.totalPages;
        } else if (extract.position) {
          position = extract.position;
        } else if (extract.scrollPercent) {
          position = extract.scrollPercent / 100;
        }
        
        if (position > 0) {
          segments.push({
            start: Math.max(0, position - 0.01),
            end: Math.min(1, position + 0.01),
            type: "extracted",
            id: extract.id,
            label: extract.title || t("viewer.extract"),
          });
        }
      }
    }
    
    return segments;
  }, [extracts, currentDocument?.id, currentDocument?.totalPages]);

  const persistedDocumentHighlights = useMemo(() => {
    const relevantExtracts = extracts.filter((extract: any) => {
      const extractDocumentId = extract.document_id ?? extract.documentId;
      return extractDocumentId === currentDocument?.id;
    });

    const pdfHighlights: StoredHighlight[] = [];
    const epubHighlights: Array<{ id: string; cfiRange: string; color?: string | null; text: string }> = [];
    const markdownHighlights: AnchoredTextHighlight[] = [];
    const htmlHighlights: AnchoredTextHighlight[] = [];

    for (const extract of relevantExtracts) {
      const context = extract.selection_context ?? extract.selectionContext;
      const highlightColor = extract.highlight_color ?? extract.highlightColor;
      const title = extract.content ?? extract.page_title ?? extract.pageTitle ?? "";

      if (isPdfSelectionContext(context)) {
        for (const page of context.pages) {
          pdfHighlights.push({
            id: `${extract.id}:${page.pageNumber}`,
            pageNumber: page.pageNumber,
            pdfRects: page.pdfRects,
            color: normalizePdfHighlightColor(highlightColor),
            text: title,
            note: extract.notes ?? undefined,
            createdAt: Date.parse(extract.date_created ?? extract.dateCreated ?? "") || Date.now(),
          });
        }
        continue;
      }

      if (isEpubSelectionContext(context)) {
        epubHighlights.push({
          id: String(extract.id),
          cfiRange: context.cfiRange,
          color: highlightColor,
          text: title,
        });
        continue;
      }

      if (isTextSelectionContext(context)) {
        const descriptor: AnchoredTextHighlight = {
          id: String(extract.id),
          startOffset: context.startOffset,
          endOffset: context.endOffset,
          color: highlightColor,
          title,
        };
        if (context.surface === "markdown") {
          markdownHighlights.push(descriptor);
        } else if (context.surface === "html") {
          htmlHighlights.push(descriptor);
        }
      }
    }

    return {
      pdfHighlights,
      epubHighlights,
      markdownHighlights,
      htmlHighlights,
    };
  }, [currentDocument?.id, extracts]);

  const MAX_SELECTION_CHARS = 10000;
  const updateSelection = useCallback((rawText: string | null | undefined, context?: SelectionContext | null) => {
    const text = rawText?.trim() ?? "";
    const hasText = text.length > 0 && text.length <= MAX_SELECTION_CHARS;

    if (docType === "pdf") {
      if (hasText && isPdfSelectionContext(context) && isValidPdfSelection(text, context)) {
        setSelectedText(text);
        lastSelectionRef.current = text;
        setSelectionContext(context ?? null);
      } else {
        setSelectedText("");
        if (context === null || context === undefined || !isPdfSelectionContext(context) || !isValidPdfSelection(text, context)) {
          setSelectionContext(null);
        }
      }
      return;
    }

    if (hasText) {
      setSelectedText(text);
      lastSelectionRef.current = text;
      if (context) {
        setSelectionContext(context);
      } else if (context === undefined) {
        setSelectionContext(null);
      }
    } else {
      setSelectedText("");
      if (context === null || context === undefined) {
        setSelectionContext(null);
      }
      // Don't clear lastSelectionRef on empty selection - preserve it for the toolbar button
      // The floating action button is controlled by selectedText state, so it will hide appropriately
    }
  }, [MAX_SELECTION_CHARS, docType]);

  const clearTextSelection = useCallback(() => {
    setSelectedText("");
    lastSelectionRef.current = "";
    setSelectionContext(null);
    setInitialHighlightColor(undefined);
    // Clear the browser's text selection
    window.getSelection()?.removeAllRanges();
  }, []);

  const persistScrollState = useCallback(
    (
      state: {
        pageNumber: number;
        scrollTop: number;
        scrollLeft: number;
        scrollHeight: number;
        clientHeight: number;
        scrollPercent: number;
        scale?: number;
      },
      override?: { storageKey?: string; documentId?: string | null; updatedAt?: number },
      viewStateOverride?: ViewState | null
    ) => {
      const storageKey = override?.storageKey ?? scrollStorageKey;
      if (!storageKey) return;
      const docId = override?.documentId ?? currentDocument?.id;
      const docType = currentDocument?.fileType as DocumentType;
      const updatedAt = override?.updatedAt ?? Date.now();
      const payload = {
        pageNumber: state.pageNumber,
        scrollPercent: state.scrollPercent,
        scrollTop: state.scrollTop,
        scrollLeft: state.scrollLeft,
        scrollHeight: state.scrollHeight,
        clientHeight: state.clientHeight,
        updatedAt,
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));

      // Also sync to PDFViewer's legacy key if it's a PDF
      if (docId && docType === "pdf") {
        const legacyPayload = {
          type: "page", // Unified format often uses 'type'
          page: state.pageNumber,
          scrollTop: state.scrollTop,
          percent: state.scrollPercent,
          updatedAt
        };
        localStorage.setItem(`pdf-position-${docId}`, JSON.stringify(legacyPayload));
      }

      const primaryViewStateKey = docId ? resolvePreferredViewStateKey(docId) : null;
      const legacyViewStateKey = docId ? getViewStateKey({ documentId: docId }) : null;
      const viewState =
        viewStateOverride ??
        (docId
          ? {
            docId,
            pageNumber: state.pageNumber,
            scale: state.scale ?? scale,
            zoomMode,
            rotation: 0,
            viewMode,
            dest: lastViewStateRef.current?.dest ?? null,
            scrollTop: state.scrollTop,
            scrollLeft: state.scrollLeft,
            scrollPercent: state.scrollPercent,
            updatedAt,
            version: 1,
          }
          : null);

      if (viewState && (primaryViewStateKey || legacyViewStateKey)) {
        if (primaryViewStateKey) setViewState(primaryViewStateKey, viewState);
        if (legacyViewStateKey && legacyViewStateKey !== primaryViewStateKey) {
          setViewState(legacyViewStateKey, viewState);
        }
        lastViewStateRef.current = viewState;
      }

      if (docId) {
        // Get unified position first - this is the primary position storage
        const unifiedPosition = getUnifiedPositionForDocument(docType, state);
        
        // Save using the legacy method (includes positionJson via viewState)
        updateDocumentProgressAuto(docId, state.pageNumber, state.scrollPercent, null, viewState ?? undefined)
          .catch((error) => console.warn("Failed to save document progress:", error));

        // Also save unified position via the position API (primary source)
        if (unifiedPosition) {
          saveDocumentPosition(docId, unifiedPosition)
            .catch((error) => console.warn("Failed to save unified position:", error));
        }
      }
    },
    [currentDocument?.id, currentDocument?.fileType, resolvePreferredViewStateKey, scale, scrollStorageKey, viewMode, zoomMode]
  );

  const handleScrollPositionChange = useCallback(
    (state: {
      pageNumber: number;
      scrollTop: number;
      scrollLeft: number;
      scrollHeight: number;
      clientHeight: number;
      scrollPercent: number;
      scale?: number;
      dest?: ViewState["dest"];
    }) => {
      // Don't save scroll state during restoration to prevent overwriting saved position with "Page 1"
      if (restorationInProgressRef.current || suppressPdfAutoScroll) {
        console.log("[DocumentViewer] Ignoring scroll update during restoration/suppression");
        return;
      }

      // Update minimap scroll indicator
      setMinimapPosition(Math.max(0, Math.min(1, state.scrollPercent / 100)));

      lastScrollStateRef.current = state;
      onScrollPositionChange?.({
        pageNumber: state.pageNumber,
        scrollPercent: state.scrollPercent,
      });

      const docId = currentDocument?.id;
      const primaryViewStateKey = docId ? resolvePreferredViewStateKey(docId) : null;
      const legacyViewStateKey = docId ? getViewStateKey({ documentId: docId }) : null;
      if (docId && (primaryViewStateKey || legacyViewStateKey)) {
        const updatedAt = Date.now();
        const viewState: ViewState = {
          docId,
          pageNumber: state.pageNumber,
          scale: state.scale ?? scale,
          zoomMode,
          rotation: 0,
          viewMode,
          dest: state.dest ?? null,
          scrollTop: state.scrollTop,
          scrollLeft: state.scrollLeft,
          scrollPercent: state.scrollPercent,
          updatedAt,
          version: 1,
        };
        lastViewStateRef.current = viewState;
        if (primaryViewStateKey) setViewState(primaryViewStateKey, viewState);
        if (legacyViewStateKey && legacyViewStateKey !== primaryViewStateKey) {
          setViewState(legacyViewStateKey, viewState);
        }
      }

      if (!scrollStorageKey) return;
      if (scrollSaveTimeoutRef.current !== null) return;

      scrollSaveTimeoutRef.current = window.setTimeout(() => {
        scrollSaveTimeoutRef.current = null;
        persistScrollState(state);
      }, 500);
    },
    [currentDocument?.id, onScrollPositionChange, persistScrollState, resolvePreferredViewStateKey, scale, scrollStorageKey, viewMode, zoomMode]
  );

  const handleUserScrollDuringRestore = useCallback(() => {
    if (!restorationInProgressRef.current && !suppressPdfAutoScroll) return;

    console.log("[DocumentViewer] User scrolled during restore, canceling restoration");
    restoreScrollDoneRef.current = true;
    restorationInProgressRef.current = false;
    pendingViewStateRef.current = null;
    setRestoreState(null);
    setSuppressPdfAutoScroll(false);

    if (restoreScrollTimeoutRef.current !== null) {
      clearTimeout(restoreScrollTimeoutRef.current);
      restoreScrollTimeoutRef.current = null;
    }
  }, [setRestoreState, setSuppressPdfAutoScroll, suppressPdfAutoScroll]);

  const cancelPdfRestoreAttempt = useCallback((reason: string) => {
    if (!restorationInProgressRef.current && !suppressPdfAutoScroll && !restoreState) return;

    console.log("[DocumentViewer] Canceling PDF restore attempt:", reason);
    restoreScrollDoneRef.current = true;
    restorationInProgressRef.current = false;
    pendingViewStateRef.current = null;
    setRestoreState(null);
    setSuppressPdfAutoScroll(false);

    if (restoreScrollTimeoutRef.current !== null) {
      clearTimeout(restoreScrollTimeoutRef.current);
      restoreScrollTimeoutRef.current = null;
    }
  }, [restoreState, suppressPdfAutoScroll]);

  const captureScrollState = useCallback(() => {
    const container = document.querySelector(
      "[data-document-scroll-container]"
    ) as HTMLElement | null;
    if (!container) return null;
    const scrollTop = container.scrollTop;
    const scrollLeft = container.scrollLeft;
    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    const scrollPercent = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
    return {
      pageNumber,
      scrollTop,
      scrollLeft,
      scrollHeight: container.scrollHeight,
      clientHeight: container.clientHeight,
      scrollPercent,
      scale,
    };
  }, [pageNumber, scale]);

  // Persist view-state changes that affect coordinate resolution even if the user doesn't scroll.
  // Example: zoom mode/scale changes should not cause us to "forget" the exact anchor in the document.
  useEffect(() => {
    if (docType !== "pdf") return;
    if (viewMode !== "document") return;
    if (!currentDocument?.id) return;
    if (restorationInProgressRef.current || suppressPdfAutoScroll) return;

    const state = lastScrollStateRef.current ?? captureScrollState();
    if (!state) return;

    const docId = currentDocument.id;
    const primaryKey = resolvePreferredViewStateKey(docId);
    const legacyKey = getViewStateKey({ documentId: docId });
    const nextViewState: ViewState = {
      docId,
      pageNumber: state.pageNumber,
      scale,
      zoomMode,
      rotation: 0,
      viewMode,
      dest: lastViewStateRef.current?.dest ?? null,
      scrollTop: state.scrollTop,
      scrollLeft: state.scrollLeft,
      scrollPercent: state.scrollPercent,
      updatedAt: Date.now(),
      version: 1,
    };

    lastViewStateRef.current = nextViewState;
    if (primaryKey) setViewState(primaryKey, nextViewState);
    if (legacyKey && legacyKey !== primaryKey) setViewState(legacyKey, nextViewState);
  }, [captureScrollState, currentDocument?.id, docType, resolvePreferredViewStateKey, scale, suppressPdfAutoScroll, viewMode, zoomMode]);

  const savePdfProgress = useCallback((reason: string) => {
    if (docType !== "pdf" || viewMode !== "document") return;
    if (!scrollStorageKey) return;
    const state = lastScrollStateRef.current ?? captureScrollState();
    if (!state) return;
    const viewState = lastViewStateRef.current
      ? { ...lastViewStateRef.current, updatedAt: Date.now() }
      : null;
    console.log("[DocumentViewer] Saving PDF progress:", reason, state);
    persistScrollState(state, undefined, viewState);
  }, [captureScrollState, docType, persistScrollState, scrollStorageKey, viewMode]);

  // Timer for tracking reading time
  const startTimeRef = useRef(Date.now());

  // Queue navigation
  const queueNav = useQueueNavigation();

  // Inline extraction handlers
  const handleInlineExtract = useCallback(async (options: { documentId: string; text: string; context?: string }) => {
    try {
      await createExtract({
        document_id: options.documentId,
        content: options.text,
        note: options.context,
      });
      toast.success(t("viewer.extractCreated"));
      // Refresh extracts for minimap
      loadExtracts(options.documentId);
    } catch (error) {
      console.error("Failed to create extract:", error);
      throw error;
    }
  }, [toast, loadExtracts]);

  const handleInlineCloze = useCallback(async (options: { documentId: string; text: string; context?: string }) => {
    try {
      const extract = await createExtract({
        document_id: options.documentId,
        content: options.text,
        note: options.context,
        tags: ["cloze"],
      });
      await generateLearningItemsFromExtract(extract.id);
      toast.success(t("viewer.clozeCreated"));
      loadExtracts(options.documentId);
    } catch (error) {
      console.error("Failed to create cloze:", error);
      throw error;
    }
  }, [toast, loadExtracts]);

  // Setup inline extraction keyboard shortcuts
  useInlineExtraction({
    documentId,
    onExtract: handleInlineExtract,
    onCloze: handleInlineCloze,
    enabled: viewMode === "document",
  });

  const loadDocumentData = useCallback(async (doc: typeof currentDocument) => {
    if (!doc) return;

    setIsLoading(true);
    setHtmlContent(null);

    // Infer fileType from filePath if missing (handles empty string or undefined)
    const ext = doc.filePath?.split('.').pop()?.toLowerCase();
    const inferredType = normalizeDocumentType(doc.fileType) ?? normalizeDocumentType(ext) ?? "";
    const needsFileData = inferredType === "pdf" || inferredType === "epub";

    console.log("[DocumentViewer] loadDocumentData:", {
      fileType: doc.fileType,
      filePath: doc.filePath,
      ext,
      inferredType,
      needsFileData,
    });

    if (mediaSourceRef.current?.revokeSrcOnDispose) {
      URL.revokeObjectURL(mediaSourceRef.current.src);
    }
    mediaSourceRef.current = null;
    setMediaSource(null);
    setPdfUrl(null);
    setEpubUrl(null);

    if (needsFileData) {
      setFileData(null);
      try {
        // Load file data directly via backend for both PDFs and EPUBs in Tauri.
        // The convertFileSrc URL approach causes WebKit/CORS errors on Linux (WebKitGTK)
        // because epubjs uses XMLHttpRequest internally, which is blocked on asset://.
        const base64Data = await documentsApi.readDocumentFile(doc.filePath);
        const binaryString = atob(base64Data);
        const rawBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          rawBytes[i] = binaryString.charCodeAt(i);
        }
        // Ensure the Uint8Array has its own independent ArrayBuffer.
        // WebView2 (Windows) can detach the buffer during IPC transfer, causing
        // structuredClone failures when pdfjs-dist passes data to its worker.
        const bytes = new Uint8Array(rawBytes);
        console.log("[DocumentViewer] File data loaded via backend, type:", inferredType, "size:", bytes.byteLength);
        setFileData(bytes);
      } catch (error) {
        console.error(`Failed to load ${inferredType}:`, error);
      } finally {
        setIsLoading(false);
      }
    } else if (inferredType === "video" || inferredType === "audio") {
      try {
        console.log(`[DocumentViewer] Loading ${inferredType} file:`, doc.filePath);
        setMediaError(null);
        if (!doc.filePath) {
          throw new Error("Media document is missing a file path.");
        }
        const resolvedSource = await resolveLocalMediaSource(doc.filePath, inferredType);
        console.log("[DocumentViewer] Resolved local media source:", {
          filePath: doc.filePath,
          strategy: resolvedSource.strategy,
          mimeType: resolvedSource.mimeType,
          attempts: resolvedSource.attempts,
        });
        mediaSourceRef.current = resolvedSource;
        setMediaSource(resolvedSource);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[DocumentViewer] Failed to load ${inferredType} file:`, error);
        setMediaError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    } else if (inferredType === "html") {
      if (isEditableBrowserArticleDocument(doc)) {
        setIsLoading(false);
      } else if (!doc.content && doc.filePath) {
        try {
          const base64Data = await documentsApi.readDocumentFile(doc.filePath);
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const text = new TextDecoder("utf-8").decode(bytes);
          const baseUrl = doc.metadata?.source || doc.filePath;
          const processed = processHtmlContent(text, baseUrl, doc.title, true);
          setHtmlContent(processed);
          try {
            const updated = await documentsApi.updateDocumentContent(doc.id, processed);
            updateDocument(doc.id, { content: updated.content ?? processed });
          } catch (error) {
            console.warn("[DocumentViewer] Failed to persist HTML content:", error);
            updateDocument(doc.id, { content: processed });
          }
        } catch (error) {
          console.error(`[DocumentViewer] Failed to load html file:`, error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }

    // Auto-extract should never block document open. Keep PDF opens lightweight and
    // defer extraction to explicit actions (OCR toggle) to avoid UI lock-ups.
    if (isAutoExtractEnabled() && doc.filePath && inferredType !== "pdf") {
      void (async () => {
        try {
          console.log("[DocumentViewer] Auto-extracting content...");
          const extractionResult = await autoExtractWithCache(
            doc.id,
            doc.filePath,
            inferredType
          );

          // Store extraction result for use in the UI
          if (extractionResult.text || extractionResult.keyPhrases.length > 0) {
            console.log("[DocumentViewer] Extraction result:", {
              textLength: extractionResult.text.length,
              keyPhrases: extractionResult.keyPhrases.length,
              mathExpressions: extractionResult.mathExpressions.length,
              ocrUsed: extractionResult.ocrUsed,
            });
          }
          if (extractionResult.ocrUsed && extractionResult.text) {
            setOcrContextText(extractionResult.text);
          }
        } catch (error) {
          console.error("[DocumentViewer] Auto-extract failed:", error);
        }
      })();
    }
  }, []);

  useEffect(() => {
    if (!documentId) return;

    // Save scroll position BEFORE switching to a new document
    const prevDocId = lastDocumentIdRef.current;
    if (prevDocId && prevDocId !== documentId) {
      // Capture and save scroll position for the previous document
      const container = document.querySelector("[data-document-scroll-container]") as HTMLElement | null;
      if (container) {
        const scrollTop = container.scrollTop;
        const scrollLeft = container.scrollLeft;
        const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
        const scrollPercent = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
        const state = {
          pageNumber: currentPageRef.current,
          scrollTop,
          scrollLeft,
          scrollHeight: container.scrollHeight,
          clientHeight: container.clientHeight,
          scrollPercent,
        };
        const storageKey = `document-scroll-position:${prevDocId}`;
        const payload = {
          pageNumber: state.pageNumber,
          scrollPercent: state.scrollPercent,
          scrollTop: state.scrollTop,
          scrollLeft: state.scrollLeft,
          scrollHeight: state.scrollHeight,
          clientHeight: state.clientHeight,
          updatedAt: Date.now(),
        };
        console.log("[DocumentViewer] Saving before document switch:", storageKey, payload);
        localStorage.setItem(storageKey, JSON.stringify(payload));
        const viewState = lastViewStateRef.current
          ? { ...lastViewStateRef.current, updatedAt: Date.now() }
          : null;
        updateDocumentProgressAuto(prevDocId, state.pageNumber, state.scrollPercent, null, viewState ?? undefined)
          .catch((error) => console.warn("Failed to save document progress before switch:", error));
      }
    }

    setOcrContextText(null);

    // Only reload if documentId actually changed, OR if we haven't successfully loaded this document yet
    const shouldLoad = documentId !== lastDocumentIdRef.current ||
      documentId !== lastLoadedDocumentIdRef.current;

    if (shouldLoad) {
      lastDocumentIdRef.current = documentId;

      // Reset timer when document changes
      startTimeRef.current = Date.now();

      // Mark as viewed in session (for smart queue filtering)
      markItemViewed(documentId, false);

      const doc = documentsRef.current.find((d) => d.id === documentId);
      if (doc) {
        setCurrentDocument(doc);
        loadDocumentData(doc);
        lastLoadedDocumentIdRef.current = documentId; // Mark as successfully loaded
      } else {
        documentsApi.getDocument(documentId)
          .then((fetched) => {
            if (!fetched) return;
            setCurrentDocument(fetched);
            loadDocumentData(fetched);
            lastLoadedDocumentIdRef.current = documentId;
          })
          .catch((error) => {
            console.error("Failed to load document by id:", error);
          });
      }
    }
  }, [documentId, setCurrentDocument, loadDocumentData]);

  useEffect(() => {
    if (initialViewMode) {
      setViewMode(initialViewMode);
      return;
    }
    setViewMode("document");
  }, [documentId, initialViewMode]);

  useEffect(() => {
    if (docType !== "pdf") return;
    setPagesRendered(false);
  }, [docType, scale, zoomMode, currentDocument?.id]);

  // Save PDF progress when switching away from document view (e.g., to extracts or cards)
  const prevViewModeRef = useRef<ViewMode | null>(null);
  useEffect(() => {
    if (prevViewModeRef.current === "document" && viewMode !== "document") {
      savePdfProgress("viewMode change");
    }
    prevViewModeRef.current = viewMode;
  }, [viewMode, savePdfProgress]);

  // Track if this tab is currently visible/active
  const isVisibleRef = useRef(true);
  
  // Save position when tab becomes hidden (user switches to another tab)
  // and restore position when tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      const wasVisible = isVisibleRef.current;
      
      console.log("[DocumentViewer] Visibility change:", { 
        isVisible, 
        wasVisible, 
        documentId,
        docType 
      });
      
      if (!isVisible && wasVisible) {
        // Tab is being hidden - save position immediately
        console.log("[DocumentViewer] Tab hidden, saving position");
        
        // IMPORTANT: Flush any pending debounced scroll save before saving
        if (scrollSaveTimeoutRef.current !== null) {
          clearTimeout(scrollSaveTimeoutRef.current);
          scrollSaveTimeoutRef.current = null;
          // Persist the last scroll state immediately
          if (lastScrollStateRef.current) {
            persistScrollState(lastScrollStateRef.current);
          }
        }
        
        // Also call savePdfProgress for any additional cleanup
        savePdfProgress("tab-hidden");
        
        // CRITICAL: Also write directly to localStorage to bypass setViewState debounce
        // This ensures the position is available immediately when tab becomes visible again
        if (currentDocument?.id && lastScrollStateRef.current) {
          const state = lastScrollStateRef.current;
          const now = Date.now();
          
          // Write to the view state key directly (bypassing debounce)
          const viewState: ViewState = {
            docId: currentDocument.id,
            pageNumber: state.pageNumber,
            scale: scaleRef.current,
            zoomMode: zoomModeRef.current,
            rotation: 0,
            viewMode: viewModeRef.current,
            dest: null,
            scrollTop: state.scrollTop,
            scrollLeft: state.scrollLeft,
            scrollPercent: state.scrollPercent,
            updatedAt: now,
            version: 1,
          };
          const primaryKey = resolvePreferredViewStateKey(currentDocument.id);
          const legacyKey = getViewStateKey({ documentId: currentDocument.id });
          if (primaryKey) localStorage.setItem(primaryKey, JSON.stringify(viewState));
          if (legacyKey && legacyKey !== primaryKey) localStorage.setItem(legacyKey, JSON.stringify(viewState));
          lastViewStateRef.current = viewState;
          
          // Also update legacy keys
          localStorage.setItem(`document-scroll-position:${currentDocument.id}`, JSON.stringify({
            pageNumber: state.pageNumber,
            scrollPercent: state.scrollPercent,
            scrollTop: state.scrollTop,
            scrollLeft: state.scrollLeft,
            scrollHeight: state.scrollHeight,
            clientHeight: state.clientHeight,
            updatedAt: now,
          }));
          localStorage.setItem(`pdf-position-${currentDocument.id}`, JSON.stringify({
            type: "page",
            page: state.pageNumber,
            scrollTop: state.scrollTop,
            percent: state.scrollPercent,
            updatedAt: now
          }));
        }
        
        isVisibleRef.current = false;
      } else if (isVisible && !wasVisible) {
        // Tab is becoming visible again
        console.log("[DocumentViewer] Tab visible again");
        isVisibleRef.current = true;
        
        // For PDFs, we need to restore the scroll position
        // because the PDFViewer might have reset to page 1
        if (docType === "pdf" && currentDocument?.id) {
          // Reset restoration state so the restoration effect will run
          restoreScrollDoneRef.current = false;
          restorationInProgressRef.current = true;
          setSuppressPdfAutoScroll(true);
          
          // Use in-memory state first (most recent), fallback to localStorage
          // This is needed because setViewState is debounced and localStorage might have stale data
          let viewStateToRestore: ViewState | null = lastViewStateRef.current;
          
          // If no in-memory state, try localStorage
          if (!viewStateToRestore) {
            const keys = resolveViewStateKeyCandidates(currentDocument.id);
            let best: ViewState | null = null;
            for (const key of keys) {
              const candidate = getViewState(key);
              if (!candidate) continue;
              if (!best || candidate.updatedAt > best.updatedAt) best = candidate;
            }
            viewStateToRestore = best;
          }
          
          // If still no state, try the legacy storage keys
          if (!viewStateToRestore) {
            const scrollStorageKey = `document-scroll-position:${currentDocument.id}`;
            const stored = localStorage.getItem(scrollStorageKey);
            const legacyStored = localStorage.getItem(`pdf-position-${currentDocument.id}`);
            
            let legacyParsed: { pageNumber?: number; scrollPercent?: number; scrollTop?: number; updatedAt?: number } | null = null;
            if (stored) {
              try {
                legacyParsed = JSON.parse(stored);
              } catch { /* ignore */ }
            }
            if (!legacyParsed && legacyStored) {
              try {
                const legacyState = JSON.parse(legacyStored);
                legacyParsed = {
                  pageNumber: legacyState.page ?? legacyState.pageNumber ?? 1,
                  scrollTop: legacyState.scrollTop,
                  scrollPercent: legacyState.percent ?? legacyState.scrollPercent,
                  updatedAt: legacyState.updatedAt
                };
              } catch { /* ignore */ }
            }
            
            if (legacyParsed) {
              viewStateToRestore = {
                docId: currentDocument.id,
                pageNumber: legacyParsed.pageNumber ?? 1,
                scale: scaleRef.current,
                zoomMode: zoomModeRef.current,
                rotation: 0,
                viewMode: viewModeRef.current,
                dest: null,
                scrollTop: legacyParsed.scrollTop ?? null,
                scrollLeft: null,
                scrollPercent: legacyParsed.scrollPercent ?? null,
                updatedAt: legacyParsed.updatedAt ?? Date.now(),
                version: 1,
              };
            }
          }
          
          if (viewStateToRestore) {
            console.log("[DocumentViewer] Restoring position on tab visibility:", viewStateToRestore);
            pendingViewStateRef.current = viewStateToRestore;
            lastViewStateRef.current = viewStateToRestore;
            currentPageRef.current = viewStateToRestore.pageNumber;
            setRestoreState(viewStateToRestore);
            
            if (viewStateToRestore.zoomMode) {
              setZoomMode(viewStateToRestore.zoomMode);
            }
            if (typeof viewStateToRestore.scale === "number") {
              setScale(viewStateToRestore.scale);
            }
            if (typeof viewStateToRestore.pageNumber === "number" && viewStateToRestore.pageNumber > 0) {
              setPageNumber(viewStateToRestore.pageNumber);
            }
          }
        }
      }
    };

    // Also handle pagehide event (fires when page is being unloaded/navigated away)
    const handlePageHide = () => {
      console.log("[DocumentViewer] Page hide, saving position");
      flushAllViewStateWrites();
      
      // Flush any pending debounced save before page hides
      if (scrollSaveTimeoutRef.current !== null) {
        clearTimeout(scrollSaveTimeoutRef.current);
        scrollSaveTimeoutRef.current = null;
        if (lastScrollStateRef.current) {
          persistScrollState(lastScrollStateRef.current);
        }
      }
      
      savePdfProgress("pagehide");
    };

    // Handle beforeunload as an extra safety measure (especially for desktop browsers)
    const handleBeforeUnload = () => {
      console.log("[DocumentViewer] Before unload, saving position");
      flushAllViewStateWrites();
      
      // Flush any pending debounced save
      if (scrollSaveTimeoutRef.current !== null) {
        clearTimeout(scrollSaveTimeoutRef.current);
        scrollSaveTimeoutRef.current = null;
        if (lastScrollStateRef.current) {
          persistScrollState(lastScrollStateRef.current);
        }
      }
      
      savePdfProgress("beforeunload");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handleBeforeUnload);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [documentId, docType, currentDocument?.id, savePdfProgress, resolvePreferredViewStateKey, resolveViewStateKeyCandidates, persistScrollState]);

  // Parse URL fragment and restore state after document is loaded
  useEffect(() => {
    if (!currentDocument || !documentId || !enablePdfUrlSync) return;

    skipStoredScrollRef.current = false;
    const state = parseStateFromUrl();
    const hasUrlState = state.scroll !== undefined || state.pos !== undefined || state.zoom !== undefined;
    skipStoredScrollRef.current = hasUrlState;

    // Restore page number from fragment
    if (state.pos !== undefined) {
      setPageNumber(state.pos);
      // If URL provides position, allow auto-scroll to navigate there
      if (hasUrlState) {
        setSuppressPdfAutoScroll(false);
        restoreScrollDoneRef.current = true;
        restorationInProgressRef.current = false;
      }
    }

    // Restore zoom/scale from fragment
    if (state.zoom !== undefined) {
      if (typeof state.zoom === 'number') {
        setScale(state.zoom);
        setZoomMode('custom');
      } else if (state.zoom === 'page-width' || state.zoom === 'fit-width') {
        setZoomMode('fit-width');
      } else if (state.zoom === 'fit-page') {
        setZoomMode('fit-page');
      }
    }

    // Restore scroll position from fragment
    if (state.scroll !== undefined) {
      // Scroll to percentage position
      setTimeout(() => {
        const scrollableElement = document.querySelector('[data-document-scroll-container]');
        if (scrollableElement) {
          const scrollHeight = scrollableElement.scrollHeight - scrollableElement.clientHeight;
          const targetScroll = (state.scroll / 100) * scrollHeight;
          scrollableElement.scrollTop = targetScroll;
        } else {
          // Fallback to window scroll
          const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
          const targetScroll = (state.scroll / 100) * scrollHeight;
          window.scrollTo(0, targetScroll);
        }
      }, 100);
    }

    // TODO: Restore highlights and extracts from fragment IDs
    // This would require loading the specific highlights/extracts and displaying them
    // For now, we just parse the state but don't restore highlights/extracts
    if (state.highlights || state.extracts) {
      console.log('[DocumentViewer] Shared state contains highlights/extracts:', state);
    }
  }, [currentDocument, documentId]);

  // Restore scroll position for this document
  useEffect(() => {
    // Only reset restoration state when document ID changes, not on viewMode change
    // to avoid race conditions with pending restoration
    if (restorationInProgressRef.current) {
      console.log("[DocumentViewer] Skipping state reset - restoration in progress");
      return;
    }
    restoreScrollDoneRef.current = false;
    restoreScrollAttemptsRef.current = 0;
    restoreAttemptRef.current = 0;
    restoreRequestIdRef.current = 0;
    setRestoreRequestId(0);
    setPagesRendered(false);
    pendingViewStateRef.current = null;
    lastViewStateRef.current = null;
    lastScrollStateRef.current = null;
    setRestoreState(null);
    if (restoreScrollTimeoutRef.current !== null) {
      clearTimeout(restoreScrollTimeoutRef.current);
      restoreScrollTimeoutRef.current = null;
    }
  }, [currentDocument?.id]);

  useEffect(() => {
    console.log("[DocumentViewer] Restoration effect running:", {
      viewMode,
      viewModeRef: viewModeRef.current,
      docType,
      isLoading,
      docId: currentDocument?.id,
      restoreScrollDone: restoreScrollDoneRef.current,
      skipStoredScroll: skipStoredScrollRef.current,
      restorationInProgress: restorationInProgressRef.current,
    });
    if (viewModeRef.current !== "document") return;
    if (docType !== "pdf") return;
    if (isLoading) return;
    if (!currentDocument?.id) return;
    if (restoreScrollDoneRef.current) return;
    if (skipStoredScrollRef.current) {
      setSuppressPdfAutoScroll(false);
      restoreScrollDoneRef.current = true;
      restorationInProgressRef.current = false;
      return;
    }

    // Mark restoration as in progress to prevent reset effect from clearing state
    restorationInProgressRef.current = true;

    const docId = currentDocument.id;
    const preferredKey = resolvePreferredViewStateKey(docId);
    const candidateKeys = resolveViewStateKeyCandidates(docId);
    let localViewState: ViewState | null = null;
    let localViewStateKey: string | null = null;
    for (const key of candidateKeys) {
      const candidate = getViewState(key);
      if (!candidate) continue;
      if (!localViewState || candidate.updatedAt > localViewState.updatedAt) {
        localViewState = candidate;
        localViewStateKey = key;
      }
    }

    // Migrate legacy/local state into the preferred key so future restores use the stable, namespaced key.
    if (preferredKey && localViewState && localViewStateKey && localViewStateKey !== preferredKey) {
      setViewState(preferredKey, localViewState);
    }
    const remoteRaw = (currentDocument as any)?.currentViewState ?? (currentDocument as any)?.current_view_state;
    let remoteViewState: ViewState | null = null;
    if (typeof remoteRaw === "string") {
      remoteViewState = parseViewState(remoteRaw);
    } else if (remoteRaw && typeof remoteRaw === "object" && typeof (remoteRaw as ViewState).updatedAt === "number") {
      remoteViewState = remoteRaw as ViewState;
    }

    let selectedViewState = localViewState;
    if (remoteViewState && (!selectedViewState || remoteViewState.updatedAt > selectedViewState.updatedAt)) {
      selectedViewState = {
        ...remoteViewState,
        docId: remoteViewState.docId || docId,
      };
    }

    if (!selectedViewState) {
      let legacyParsed: { scrollPercent?: number; scrollTop?: number; pageNumber?: number; updatedAt?: number } | null = null;
      // Check DocumentViewer's specific key
      const stored = scrollStorageKey ? localStorage.getItem(scrollStorageKey) : null;
      // Also check PDFViewer's legacy key as fallback
      const legacyStored = docId ? localStorage.getItem(`pdf-position-${docId}`) : null;

      if (stored) {
        try {
          legacyParsed = JSON.parse(stored);
        } catch {
          legacyParsed = null;
        }
      }
      
      // If no DocumentViewer state, or if PDFViewer state is newer, use PDFViewer state
      if (legacyStored) {
        try {
          const legacyState = JSON.parse(legacyStored);
          // If we don't have stored state, or legacy state has a timestamp and it's newer
          // Note: legacy state might not have updatedAt, so we prioritize 'stored' if it exists unless we're sure
          if (!legacyParsed || (legacyState.updatedAt && (!legacyParsed.updatedAt || legacyState.updatedAt > legacyParsed.updatedAt))) {
             // Adapt legacy state format to our needs
             const adapted = {
               pageNumber: legacyState.page ?? legacyState.pageNumber ?? 1,
               scrollTop: legacyState.scrollTop,
               scrollPercent: legacyState.percent ?? legacyState.scrollPercent,
               updatedAt: legacyState.updatedAt
             };
             legacyParsed = adapted;
          }
        } catch {
          // Ignore parse errors
        }
      }
      const remoteUpdatedAt = currentDocument?.dateModified
        ? new Date(currentDocument.dateModified).getTime()
        : 0;
      const localUpdatedAt = legacyParsed?.updatedAt ?? 0;
      
      // Check for positionJson (unified position storage) first
      const positionJson = (currentDocument as any)?.positionJson ?? (currentDocument as any)?.position_json;
      let parsedPosition: { type: string; page?: number; percent?: number; cfi?: string; offset?: number } | null = null;
      if (positionJson) {
        try {
          parsedPosition = typeof positionJson === 'string' ? JSON.parse(positionJson) : positionJson;
        } catch {
          parsedPosition = null;
        }
      }
      
      const hasRemoteProgress = typeof currentDocument?.currentScrollPercent === "number" || parsedPosition !== null;

      if ((hasRemoteProgress && remoteUpdatedAt > localUpdatedAt) || !legacyParsed) {
        // Use positionJson if available, otherwise fall back to legacy fields
        if (parsedPosition) {
          let pageNumber = 1;
          let scrollPercent: number | null = null;
          
          switch (parsedPosition.type) {
            case 'page':
              pageNumber = parsedPosition.page ?? 1;
              // Estimate scroll percent from page number if total pages is known
              if (currentDocument?.totalPages && currentDocument.totalPages > 0) {
                scrollPercent = ((pageNumber - 1) / currentDocument.totalPages) * 100;
              }
              break;
            case 'scroll':
              scrollPercent = parsedPosition.percent ?? 0;
              break;
            case 'cfi':
              // For EPUB CFI, we can't easily convert to page number
              // Keep scrollPercent from legacy fields if available
              scrollPercent = currentDocument?.currentScrollPercent ?? 0;
              break;
          }
          
          legacyParsed = {
            scrollPercent: scrollPercent ?? undefined,
            pageNumber: pageNumber,
            updatedAt: remoteUpdatedAt || Date.now(),
          };
        } else {
          legacyParsed = hasRemoteProgress
            ? {
              scrollPercent: currentDocument.currentScrollPercent,
              pageNumber: currentDocument.currentPage ?? undefined,
              updatedAt: remoteUpdatedAt || Date.now(),
            }
            : null;
        }
      }

      if (legacyParsed) {
        // Use refs for scale/zoomMode/viewMode to avoid dependency issues
        selectedViewState = {
          docId,
          pageNumber: legacyParsed.pageNumber ?? 1,
          scale: scaleRef.current,
          zoomMode: zoomModeRef.current,
          rotation: 0,
          viewMode: viewModeRef.current,
          dest: null,
          scrollTop: legacyParsed.scrollTop ?? null,
          scrollPercent: legacyParsed.scrollPercent ?? null,
          updatedAt: legacyParsed.updatedAt ?? Date.now(),
          version: 1,
        };
      }
    }

    if (!selectedViewState) {
      setSuppressPdfAutoScroll(false);
      restoreScrollDoneRef.current = true;
      restorationInProgressRef.current = false;
      return;
    }

    pendingViewStateRef.current = selectedViewState;
    lastViewStateRef.current = selectedViewState;
    currentPageRef.current = selectedViewState.pageNumber;
    setRestoreState(selectedViewState);
    setSuppressPdfAutoScroll(true);

    if (selectedViewState.zoomMode) {
      setZoomMode(selectedViewState.zoomMode);
    }
    if (typeof selectedViewState.scale === "number") {
      setScale(selectedViewState.scale);
    }
    if (typeof selectedViewState.pageNumber === "number" && selectedViewState.pageNumber > 0) {
      setPageNumber(selectedViewState.pageNumber);
    }
    // Note: restorationInProgressRef will be cleared by the verification effect after restoration completes
  }, [currentDocument, docType, isLoading, resolvePreferredViewStateKey, resolveViewStateKeyCandidates, scrollStorageKey]);

  useEffect(() => {
    if (viewMode !== "document") return;
    if (docType !== "pdf") return;
    if (isLoading) return;
    if (restoreScrollDoneRef.current) return;

    const state = restoreState ?? pendingViewStateRef.current;
    if (!state) {
      setSuppressPdfAutoScroll(false);
      restoreScrollDoneRef.current = true;
      restorationInProgressRef.current = false;
      return;
    }

    restoreRequestIdRef.current += 1;
    setRestoreRequestId(restoreRequestIdRef.current);
    restoreAttemptRef.current = 0;
    restoreReadyAttemptsRef.current = 0;

    const maxReadyAttempts = 100;
    const maxVerifyAttempts = 3;

    const getRestoreContainer = () =>
      document.querySelector("[data-document-scroll-container]") as HTMLElement | null;

    const getRestoreReadiness = () => {
      const container = getRestoreContainer();
      if (!container) return { ready: false, container: null };
      const pageEl = container.querySelector<HTMLElement>(
        `[data-pdf-page][data-page-number="${state.pageNumber}"]`
      );
      if (!pageEl) return { ready: false, container };
      const hasLayout = pageEl.offsetHeight > 0 || container.scrollHeight > 0;
      return { ready: hasLayout, container };
    };

    const verifyRestore = (container: HTMLElement) => {

      const pages = Array.from(container.querySelectorAll<HTMLElement>("[data-pdf-page]"));
      let currentPage = 1;
      for (const pageEl of pages) {
        const pageNum = Number(pageEl.dataset.pageNumber);
        if (!Number.isNaN(pageNum) && pageEl.offsetTop - 24 <= container.scrollTop) {
          currentPage = pageNum;
        }
      }

      const withinPage = Math.abs(currentPage - state.pageNumber) <= 1;
      if (!withinPage) return false;

      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      const expectedScroll = typeof state.scrollTop === "number"
        ? Math.min(Math.max(0, state.scrollTop), maxScroll)
        : typeof state.scrollPercent === "number"
          ? (state.scrollPercent / 100) * maxScroll
          : null;
      if (expectedScroll !== null) {
        return Math.abs(container.scrollTop - expectedScroll) <= 200;
      }
      return true;
    };

    const attemptVerify = () => {
      const readiness = getRestoreReadiness();
      if (!readiness.container || !readiness.ready) {
        restoreReadyAttemptsRef.current += 1;
        if (restoreReadyAttemptsRef.current <= maxReadyAttempts) {
          restoreScrollTimeoutRef.current = window.setTimeout(attemptVerify, 200);
          return;
        }
      }

      const container = readiness.container ?? getRestoreContainer();
      const ok = container ? verifyRestore(container) : false;
      if (ok) {
        if (state.pageNumber !== pageNumber) {
          setPageNumber(state.pageNumber);
        }
        restoreScrollDoneRef.current = true;
        restorationInProgressRef.current = false;
        setTimeout(() => setSuppressPdfAutoScroll(false), 500);
        return;
      }

      if (restoreAttemptRef.current < maxVerifyAttempts - 1) {
        restoreAttemptRef.current += 1;
        restoreRequestIdRef.current += 1;
        setRestoreRequestId(restoreRequestIdRef.current);
        restoreScrollTimeoutRef.current = window.setTimeout(attemptVerify, 200);
        return;
      }

      restoreScrollDoneRef.current = true;
      restorationInProgressRef.current = false;
      setSuppressPdfAutoScroll(false);
    };

    restoreScrollTimeoutRef.current = window.setTimeout(attemptVerify, 200);
  }, [docType, isLoading, restoreState, viewMode]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Note: visibilitychange handling is done in the effect above with restoration logic


  useEffect(() => {
    return () => {
      if (restoreScrollTimeoutRef.current !== null) {
        clearTimeout(restoreScrollTimeoutRef.current);
      }
      if (scrollSaveTimeoutRef.current !== null) {
        clearTimeout(scrollSaveTimeoutRef.current);
        scrollSaveTimeoutRef.current = null;
      }

      const storageKey = lastScrollMetaRef.current?.storageKey;
      const documentId = lastScrollMetaRef.current?.documentId;

      if (!storageKey || !documentId) {
        console.log("[DocumentViewer] Cleanup - missing metadata:", { storageKey, documentId });
        return;
      }

      // Always try to capture the latest scroll state from DOM first
      // This is more reliable than the debounced ref which might be stale
      let stateToSave = lastScrollStateRef.current;
      
      // Try reading from DOM first - the scroll container might still be available
      const container = document.querySelector("[data-document-scroll-container]") as HTMLElement | null;
      if (container) {
        const scrollTop = container.scrollTop;
        const scrollLeft = container.scrollLeft;
        const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
        const scrollPercent = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
        
        // Only use DOM values if they seem valid (scrollTop > 0 or we have no better data)
        if (scrollTop > 0 || !stateToSave) {
          stateToSave = {
            pageNumber: currentPageRef.current,
            scrollTop,
            scrollLeft,
            scrollHeight: container.scrollHeight,
            clientHeight: container.clientHeight,
            scrollPercent,
          };
          console.log("[DocumentViewer] Cleanup - captured fresh from DOM:", stateToSave);
        }
      }

      if (!stateToSave) {
        // Fallback: try using last view state
        const fallbackViewState = lastViewStateRef.current;
        if (fallbackViewState) {
          stateToSave = {
            pageNumber: fallbackViewState.pageNumber ?? currentPageRef.current,
            scrollTop: fallbackViewState.scrollTop ?? 0,
            scrollLeft: fallbackViewState.scrollLeft ?? 0,
            scrollHeight: 0,
            clientHeight: 0,
            scrollPercent: fallbackViewState.scrollPercent ?? 0,
          };
          console.log("[DocumentViewer] Cleanup - captured from last view state:", stateToSave);
        } else {
          // Last resort: use current page ref
          stateToSave = {
            pageNumber: currentPageRef.current,
            scrollTop: 0,
            scrollLeft: 0,
            scrollHeight: 0,
            clientHeight: 0,
            scrollPercent: 0,
          };
          console.log("[DocumentViewer] Cleanup - using current page ref:", stateToSave);
        }
      }

      console.log("[DocumentViewer] Cleanup - saving position:", stateToSave);

      const payload = {
        pageNumber: stateToSave.pageNumber,
        scrollPercent: stateToSave.scrollPercent,
        scrollTop: stateToSave.scrollTop,
        scrollLeft: stateToSave.scrollLeft,
        scrollHeight: stateToSave.scrollHeight,
        clientHeight: stateToSave.clientHeight,
        updatedAt: Date.now(),
      };

      console.log("[DocumentViewer] Saving to localStorage:", storageKey, payload);
      localStorage.setItem(storageKey, JSON.stringify(payload));
      
      // Also sync to PDFViewer's legacy key
      if (documentId) {
        const legacyPayload = {
          type: "page",
          page: stateToSave.pageNumber,
          scrollTop: stateToSave.scrollTop,
          percent: stateToSave.scrollPercent,
          updatedAt: Date.now()
        };
        localStorage.setItem(`pdf-position-${documentId}`, JSON.stringify(legacyPayload));
      }

      const primaryViewStateKey = getPreferredViewStateKey({ documentId });
      const legacyViewStateKey = getViewStateKey({ documentId });
      const viewState = lastViewStateRef.current
        ? { ...lastViewStateRef.current, updatedAt: Date.now() }
        : {
          docId: documentId,
          pageNumber: stateToSave.pageNumber,
          scale: scaleRef.current,
          zoomMode: zoomModeRef.current,
          rotation: 0,
          viewMode: viewModeRef.current,
          dest: null,
          scrollTop: stateToSave.scrollTop,
          scrollLeft: stateToSave.scrollLeft,
          scrollPercent: stateToSave.scrollPercent,
          updatedAt: Date.now(),
          version: 1,
        };

      if (primaryViewStateKey) setViewState(primaryViewStateKey, viewState);
      if (legacyViewStateKey && legacyViewStateKey !== primaryViewStateKey) {
        setViewState(legacyViewStateKey, viewState);
      }
      flushAllViewStateWrites();

      updateDocumentProgressAuto(documentId, stateToSave.pageNumber, stateToSave.scrollPercent, null, viewState)
        .catch((error) => console.warn("Failed to save document progress on cleanup:", error));
    };
  }, []);

  useEffect(() => {
    if (!documentId) return;
    setOcrResult(null);
    setPdfViewMode("pdf");
    setPdfTextSelectionCapability(null);
  }, [documentId]);

  // Handle text selection
  useEffect(() => {
    if (docType === "pdf" || docType === "markdown" || docType === "html" || docType === "epub") return;

    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection) return;
      const anchorElement = selection.anchorNode instanceof Element
        ? selection.anchorNode
        : selection.anchorNode?.parentElement;
      const focusElement = selection.focusNode instanceof Element
        ? selection.focusNode
        : selection.focusNode?.parentElement;
      if (anchorElement?.closest(".textLayer") || focusElement?.closest(".textLayer")) {
        return;
      }
      updateSelection(selection.toString(), undefined);
    };

    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("keyup", handleSelection);

    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("keyup", handleSelection);
    };
  }, [docType, updateSelection]);

  // Mobile PWA: Handle text selection via selectionchange event
  useEffect(() => {
    if (!isMobilePWA) return;

    let rafId: number | null = null;

    const handleSelectionChange = () => {
      // Cancel any pending RAF to avoid multiple updates
      if (rafId) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        const selection = window.getSelection();
        if (!selection) {
          setMobileSelection(prev => ({ ...prev, showButton: false }));
          return;
        }

        const text = selection.toString().trim();

        // Check if selection is within the document content
        const anchorElement = selection.anchorNode instanceof Element
          ? selection.anchorNode
          : selection.anchorNode?.parentElement;
        const focusElement = selection.focusNode instanceof Element
          ? selection.focusNode
          : selection.focusNode?.parentElement;

        // Only handle selections within document content
        const isInDocumentContent = anchorElement?.closest("[data-document-content='true']") ||
          focusElement?.closest("[data-document-content='true']") ||
          anchorElement?.closest(".prose") ||
          focusElement?.closest(".prose") ||
          anchorElement?.closest(".textLayer") ||
          focusElement?.closest(".textLayer");

        if (!text || text.length === 0 || !isInDocumentContent) {
          setMobileSelection(prev => ({ ...prev, showButton: false }));
          return;
        }

        // Get selection position for button placement
        try {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();

          // Position the button centered above the selection
          const x = rect.left + rect.width / 2;
          const y = rect.top - 60; // 60px above selection

          setMobileSelection({
            text,
            position: { x, y },
            showButton: true,
          });

          if (docType !== "pdf") {
            // For non-PDF content, mobile selection directly drives extract text.
            setSelectedText(text);
            lastSelectionRef.current = text;
          }

          // Auto-hide after 5 seconds if not interacted with
          if (mobileSelectionTimeoutRef.current) {
            clearTimeout(mobileSelectionTimeoutRef.current);
          }
          mobileSelectionTimeoutRef.current = window.setTimeout(() => {
            setMobileSelection(prev => ({ ...prev, showButton: false }));
          }, 5000);
        } catch {
          // Range might be invalid, ignore
        }
      });
    };

    // Also handle touchend for immediate response on mobile
    const handleTouchEnd = () => {
      // Small delay to allow selection to be finalized, then use RAF
      setTimeout(handleSelectionChange, 100);
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("touchend", handleTouchEnd);
      if (mobileSelectionTimeoutRef.current) {
        clearTimeout(mobileSelectionTimeoutRef.current);
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [docType, isMobilePWA, setSelectedText]);

  // Clear text selection when clicking outside the document content
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't clear if clicking on the floating button, dialog, or within the document content
      if (
        target.closest('[data-extract-button="true"]') ||
        target.closest('[role="dialog"]') ||
        target.closest('[data-document-content="true"]')
      ) {
        return;
      }
      // Clear selection when clicking on empty areas
      if (activeExtractSelection && !window.getSelection()?.toString()) {
        clearTextSelection();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeExtractSelection, clearTextSelection]);

  useEffect(() => {
    onSelectionChange?.(selectedText);
  }, [selectedText, onSelectionChange]);

  const closeViewerSearch = useCallback(() => {
    setShowSearch(false);
    setSearchQuery("");
    setViewerSearchNavRequest(null);
    setViewerSearchState({
      ...DEFAULT_VIEWER_SEARCH_STATE,
      supported: viewerSearchSupported,
      available: viewerSearchSupported,
    });
  }, [viewerSearchSupported]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in input
      if ((e.target as HTMLElement).tagName === "INPUT" ||
        (e.target as HTMLElement).tagName === "TEXTAREA") {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      const lowerKey = e.key.toLowerCase();

      // F11 for fullscreen toggle
      if (e.key === "F11") {
        e.preventDefault();
        toggleFullscreen();
      }

      // Ctrl/Cmd + F for search
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        if (viewerSearchSupported) {
          setShowSearch(true);
          requestAnimationFrame(() => {
            searchInputRef.current?.focus();
            searchInputRef.current?.select();
          });
        }
        return;
      }

      // Ctrl/Cmd + E for create extract from current selection
      if (mod && lowerKey === "e") {
        e.preventDefault();
        setInitialHighlightColor(undefined);
        openExtractDialog();
        return;
      }

      // Ctrl/Cmd + H for highlight selection (mapped to extract dialog with highlight color)
      if (mod && lowerKey === "h") {
        e.preventDefault();
        setInitialHighlightColor("#fef08a");
        openExtractDialog();
        return;
      }

      // Ctrl/Cmd + + / - / 0 zoom controls
      if (mod && (e.key === "+" || (e.key === "=" && e.shiftKey) || e.key === "=")) {
        e.preventDefault();
        handleZoomIn();
        return;
      }
      if (mod && e.key === "-") {
        e.preventDefault();
        handleZoomOut();
        return;
      }
      if (mod && e.key === "0") {
        e.preventDefault();
        handleResetZoom();
        return;
      }

      // Arrow keys for navigation when in document mode
      if (viewMode === "document") {
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          handlePrevPage();
        } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          handleNextPage();
        }
      }

      // Escape to close dialogs, clear selection, or exit fullscreen
      if (e.key === "Escape") {
        if (showSearch) closeViewerSearch();
        if (isExtractDialogOpen) {
          setIsExtractDialogOpen(false);
          clearTextSelection();
        } else if (activeExtractSelection) {
          // If no dialog is open but text is selected, clear the selection
          clearTextSelection();
        }
        if (isFullscreen) {
          toggleFullscreen();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeExtractSelection, closeViewerSearch, isExtractDialogOpen, isFullscreen, showSearch, viewerSearchSupported, viewMode]);

  const handlePrevPage = () => {
    if (currentDocument && currentDocument.totalPages) {
      const newPage = Math.max(1, pageNumber - 1);
      if (
        docType === "pdf" &&
        restorationInProgressRef.current &&
        restoreState &&
        restoreState.pageNumber !== newPage
      ) {
        cancelPdfRestoreAttempt("manual-prev-page");
      }
      setPageNumber(newPage);
      // Push to history for back/forward navigation
      if (docType === "pdf") {
        pushUrlState({ pageNumber: newPage, scale, zoomMode, scrollPercent: lastScrollStateRef.current?.scrollPercent });
      }
    }
  };

  const handleNextPage = () => {
    if (currentDocument && currentDocument.totalPages) {
      const newPage = Math.min(currentDocument.totalPages!, pageNumber + 1);
      if (
        docType === "pdf" &&
        restorationInProgressRef.current &&
        restoreState &&
        restoreState.pageNumber !== newPage
      ) {
        cancelPdfRestoreAttempt("manual-next-page");
      }
      setPageNumber(newPage);
      // Push to history for back/forward navigation
      if (docType === "pdf") {
        pushUrlState({ pageNumber: newPage, scale, zoomMode, scrollPercent: lastScrollStateRef.current?.scrollPercent });
      }
    }
  };

  const handlePageChange = (newPageNumber: number) => {
    if (
      docType === "pdf" &&
      restorationInProgressRef.current &&
      restoreState &&
      restoreState.pageNumber !== newPageNumber
    ) {
      cancelPdfRestoreAttempt("programmatic-page-change");
    }
    setPageNumber(newPageNumber);
    // Push to history for significant page jumps (e.g., TOC navigation)
    if (docType === "pdf" && Math.abs(newPageNumber - pageNumber) > 1) {
      pushUrlState({ pageNumber: newPageNumber, scale, zoomMode, scrollPercent: undefined });
    }
  };

  const handleZoomIn = () => {
    setZoomMode("custom");
    setScale((prev) => Math.min(3.0, prev + 0.25));
  };

  const handleZoomOut = () => {
    setZoomMode("custom");
    setScale((prev) => Math.max(0.5, prev - 0.25));
  };

  const handleResetZoom = () => {
    setZoomMode("custom");
    setScale(1.0);
  };

  const handleZoomModeChange = (mode: "custom" | "fit-width" | "fit-page") => {
    setZoomMode(mode);
  };

  const handleWidenMarkdown = useCallback(() => {
    setMarkdownWidthCh((prev) => Math.min(MARKDOWN_MAX_WIDTH_CH, prev + 2));
  }, []);

  const handleNarrowMarkdown = useCallback(() => {
    setMarkdownWidthCh((prev) => Math.max(MARKDOWN_MIN_WIDTH_CH, prev - 2));
  }, []);

  const handleResetMarkdownWidth = useCallback(() => {
    setMarkdownWidthCh(MARKDOWN_DEFAULT_WIDTH_CH);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MARKDOWN_WIDTH_STORAGE_KEY, String(markdownWidthCh));
  }, [markdownWidthCh]);

  const handlePdfInfo = useCallback((info: { fingerprint?: string | null }) => {
    pdfFingerprintRef.current = info.fingerprint ?? null;
  }, []);

  // Handle PDF/EPUB load
  const handleDocumentLoad = useCallback((numPages: number, outline: any[] = []) => {
    console.log("Document loaded:", numPages, "pages", outline.length, "outline items");

    // Store total pages for TTS auto-advance
    setTotalPages(numPages);

    // Update document with page count if not already set
    // This ensures the "Continue Reading" tab can calculate progress correctly
    if (currentDocument && numPages > 0 && !currentDocument.totalPages) {
      documentsApi.updateDocument(currentDocument.id, {
        ...currentDocument,
        totalPages: numPages,
      }).catch(err => {
        console.warn("Failed to update document total pages:", err);
      });
    }
  }, [currentDocument]);

  // Handle YouTube load
  const handleYouTubeLoad = useCallback((metadata: { duration: number; title: string }) => {
    console.log("YouTube loaded:", metadata);
  }, []);

  const handlePdfContextTextChange = useCallback(
    (text: string) => {
      const preferOcr = settings.documents.ocr.autoOCR || settings.documents.ocr.autoExtractOnLoad;
      const contextForReader = preferOcr && ocrContextText ? ocrContextText : text;
      setReaderContextText(contextForReader);
      if (!onPdfContextTextChange) return;
      onPdfContextTextChange(contextForReader);
    },
    [onPdfContextTextChange, ocrContextText, settings.documents.ocr.autoOCR, settings.documents.ocr.autoExtractOnLoad]
  );

  // Handle TTS completion - advance to next page if available
  const handleTTSComplete = useCallback(() => {
    // Only auto-advance for paginated documents (PDF/EPUB)
    if (docType !== "pdf" && docType !== "epub") return;

    const nextPage = pageNumber + 1;
    if (nextPage <= totalPages) {
      console.log(`TTS: Auto-advancing to page ${nextPage}`);
      setPageNumber(nextPage);
    } else {
      console.log("TTS: Reached end of document");
    }
  }, [docType, pageNumber, totalPages]);

  useEffect(() => {
    if (docType === "pdf" || docType === "epub") return;
    if (docType === "markdown") {
      const content = currentDocument?.content || "";
      setReaderContextText(content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
      return;
    }
    if (docType === "html") {
      const html = htmlContent || "";
      setReaderContextText(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
      return;
    }
    setReaderContextText("");
  }, [docType, currentDocument?.content, htmlContent]);

  useEffect(() => {
    if (docType !== "pdf") return;
    const preferOcr = settings.documents.ocr.autoOCR || settings.documents.ocr.autoExtractOnLoad;
    onPdfOcrContextTextChange?.(ocrContextText);
    if (preferOcr && ocrContextText) {
      setReaderContextText(ocrContextText);
      onPdfContextTextChange?.(ocrContextText);
    }
  }, [
    docType,
    ocrContextText,
    onPdfContextTextChange,
    onPdfOcrContextTextChange,
    settings.documents.ocr.autoOCR,
    settings.documents.ocr.autoExtractOnLoad,
  ]);

  // Handle extract creation
  const handleExtractCreated = (extract: Extract) => {
    const sourceContext = buildExtractSourceContext();
    if (extractPostCreateBehavior === "show-extracts") {
      setViewMode("extracts");
    }
    onExtractCreated?.(extract, sourceContext);
  };

  const openExtractDialog = () => {
    if (docType === "pdf") {
      const blockReason = getPdfExtractBlockReason({
        selectedText,
        selectionContext: isPdfSelectionContext(selectionContext) ? selectionContext : null,
        capability: pdfTextSelectionCapability,
      });
      if (blockReason === "no_text_layer") {
        toast.info(t("viewer.noSelectableText"), t("viewer.pdfPageImageOnly"));
        return;
      }
      if (blockReason === "missing_selection") {
        toast.info(t("viewer.selectPdfTextFirst"), t("viewer.dragAcrossPdfText"));
        return;
      }
      setIsExtractDialogOpen(true);
      return;
    }

    const selection = window.getSelection()?.toString().trim();
    const selectionText = selectedText.trim() || selection || lastSelectionRef.current;
    if (selectionText) {
      setSelectedText(selectionText);
      lastSelectionRef.current = selectionText;
    }
    setIsExtractDialogOpen(true);
  };

  const handlePdfHighlightSelection = useCallback((color: string, text: string, context: PdfSelectionContext) => {
    setSelectedText(text);
    lastSelectionRef.current = text;
    setSelectionContext(context);
    setInitialHighlightColor(toExtractDialogColor(color));
    setIsExtractDialogOpen(true);
  }, []);

  // Mobile PWA: Open extract dialog from mobile selection
  const handleMobileExtract = () => {
    if (docType === "pdf") {
      setMobileSelection(prev => ({ ...prev, showButton: false }));
      if (mobileSelectionTimeoutRef.current) {
        clearTimeout(mobileSelectionTimeoutRef.current);
      }
      openExtractDialog();
      return;
    }

    if (mobileSelection.text) {
      setSelectedText(mobileSelection.text);
      lastSelectionRef.current = mobileSelection.text;
      setIsExtractDialogOpen(true);
      setMobileSelection(prev => ({ ...prev, showButton: false }));
      if (mobileSelectionTimeoutRef.current) {
        clearTimeout(mobileSelectionTimeoutRef.current);
      }
    }
  };

  const handleSearch = useCallback((direction: ViewerSearchDirection = "next") => {
    if (!viewerSearchSupported) {
      setViewerSearchState({
        supported: false,
        available: false,
        totalMatches: 0,
        activeMatchIndex: 0,
        unavailableReason: "Search is not available for this document type.",
      });
      return;
    }

    if (!normalizedViewerSearchQuery) {
      setViewerSearchState((prev) => ({
        ...prev,
        supported: true,
        available: true,
        totalMatches: 0,
        activeMatchIndex: 0,
        unavailableReason: undefined,
      }));
      return;
    }

    setViewerSearchState((prev) => {
      if (prev.totalMatches <= 0) {
        setViewerSearchNavRequest({
          direction,
          nonce: ++viewerSearchNavCounterRef.current,
          targetIndex: 0,
        });
        return {
          ...prev,
          supported: true,
          available: prev.available,
          activeMatchIndex: 0,
        };
      }

      const delta = direction === "next" ? 1 : -1;
      const nextIndex = ((prev.activeMatchIndex + delta) % prev.totalMatches + prev.totalMatches) % prev.totalMatches;
      setViewerSearchNavRequest({
        direction,
        nonce: ++viewerSearchNavCounterRef.current,
        targetIndex: nextIndex,
      });
      return {
        ...prev,
        activeMatchIndex: nextIndex,
      };
    });
  }, [normalizedViewerSearchQuery, viewerSearchSupported]);

  const toggleFullscreen = async () => {
    try {
      // PWA/Browser environment - use standard Fullscreen API
      if (!isTauri()) {
        const docWithWebkit = document as Document & {
          webkitExitFullscreen?: () => Promise<void> | void;
          msExitFullscreen?: () => Promise<void> | void;
        };
        const elWithWebkit = document.documentElement as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void> | void;
          msRequestFullscreen?: () => Promise<void> | void;
        };
        const hasNativeFullscreen =
          typeof document.documentElement.requestFullscreen === "function" ||
          typeof elWithWebkit.webkitRequestFullscreen === "function" ||
          typeof elWithWebkit.msRequestFullscreen === "function";

        // Some PWA contexts (notably iOS) don't support the Fullscreen API.
        // Fall back to an in-app reader focus mode that still hides chrome.
        if (!hasNativeFullscreen) {
          setIsFullscreen((prev) => !prev);
          return;
        }

        if (isFullscreen) {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if (docWithWebkit.webkitExitFullscreen) {
            await docWithWebkit.webkitExitFullscreen();
          } else if (docWithWebkit.msExitFullscreen) {
            await docWithWebkit.msExitFullscreen();
          }
        } else {
          const docEl = document.documentElement;
          if (docEl.requestFullscreen) {
            await docEl.requestFullscreen();
          } else if (elWithWebkit.webkitRequestFullscreen) {
            await elWithWebkit.webkitRequestFullscreen();
          } else if (elWithWebkit.msRequestFullscreen) {
            await elWithWebkit.msRequestFullscreen();
          }
        }
        return;
      }

      // Tauri desktop environment
      const appWindow = getCurrentWindow();
      if (isFullscreen) {
        await appWindow.setFullscreen(false);
        setIsFullscreen(false);
      } else {
        await appWindow.setFullscreen(true);
        setIsFullscreen(true);
      }
    } catch (error) {
      console.error("Failed to toggle fullscreen:", error);
      // Browser fallback when Fullscreen API fails at runtime.
      if (!isTauri()) {
        setIsFullscreen((prev) => !prev);
      }
    }
  };

  // Handle rating from keyboard shortcuts
  const handleRating = async (rating: ReviewRating) => {
    try {
      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);

      console.log(`DocumentViewer: Rating document ${documentId} as ${rating} (time: ${timeTaken}s)`);

      await rateDocument(documentId, rating, timeTaken);
      
      // Mark as rated in session
      markItemViewed(documentId, true);

      // Reset timer
      startTimeRef.current = Date.now();

      const documentQueueItems = queueItems.filter((item) => item.itemType === "document");
      const currentIndex = documentQueueItems.findIndex((item) => item.documentId === documentId);
      const nextItem = currentIndex >= 0 ? documentQueueItems[currentIndex + 1] : undefined;

      if (nextItem) {
        const nextDoc = documents.find((doc) => doc.id === nextItem.documentId);
        const currentTab = tabs.find((tab) => tab.data?.documentId === documentId);

        if (currentTab && nextDoc) {
          updateTab(currentTab.id, {
            title: nextItem.documentTitle,
            icon:
              nextDoc.fileType === "pdf"
                ? "📕"
                : nextDoc.fileType === "epub"
                  ? "📖"
                  : nextDoc.fileType === "youtube"
                    ? "📺"
                    : "📄",
            data: { ...currentTab.data, documentId: nextItem.documentId },
          });
        }
      } else {
        console.log("No next document in queue.");
      }
    } catch (error) {
      console.error("Failed to rate document:", error);
    }
  };

  // Handle back button - close the current tab
  const handleBack = () => {
    const currentTab = tabs.find(t => t.data?.documentId === documentId);
    if (currentTab) {
      closeTab(currentTab.id);
    }
  };

  // Share document with current reading position
  const handleShare = async () => {
    if (!currentDocument) return;

    // Build the document state with current position
    const state: DocumentState = {};

    // Add page position for documents
    if (pageNumber && docType !== 'youtube') {
      state.pos = pageNumber;
    }

    // Add zoom/scale for PDFs
    if (docType === 'pdf') {
      if (zoomMode === 'custom' && scale !== 1.0) {
        state.zoom = scale;
      } else if (zoomMode !== 'custom') {
        state.zoom = zoomMode === 'fit-width' ? 'page-width' : zoomMode;
      }

      // Add scroll position if meaningful
      const scrollPercent = lastScrollStateRef.current?.scrollPercent;
      if (scrollPercent !== undefined && scrollPercent > 0) {
        state.scroll = Math.round(scrollPercent);
      }
    }

    // Add timestamp for YouTube videos
    if (docType === 'youtube') {
      // YouTube videos store position differently - would need to get from player
      // For now, we'll skip this as YouTubeViewer has its own share button
    }

    // Generate share URL
    const baseUrl = window.location.origin;
    const shareUrl = generateShareUrl(baseUrl, documentId, state);

    // Copy to clipboard with toast notification
    const success = await copyShareLink(shareUrl);
    if (success) {
      toast.success(t("viewer.linkCopied"), t("viewer.linkCopiedDesc"));
    } else {
      toast.error(t("viewer.failedToCopy"), t("viewer.couldNotCopyLink"));
    }
  };

  const splitTextIntoPages = (text: string, pageCount: number) => {
    if (!text.trim()) {
      return [{ pageNumber: 1, text: "" }];
    }

    if (pageCount <= 1) {
      return [{ pageNumber: 1, text }];
    }

    const paragraphs = text
      .split(/\n\s*\n/)
      .map((para) => para.trim())
      .filter(Boolean);

    if (paragraphs.length === 0) {
      return [{ pageNumber: 1, text }];
    }

    const paragraphsPerPage = Math.max(1, Math.ceil(paragraphs.length / pageCount));
    const pages: Array<{ pageNumber: number; text: string }> = [];

    for (let i = 0; i < paragraphs.length; i += paragraphsPerPage) {
      const pageNumber = pages.length + 1;
      const chunk = paragraphs.slice(i, i + paragraphsPerPage).join("\n\n");
      pages.push({ pageNumber, text: chunk });
    }

    return pages;
  };

  const renderOcrPages = () => {
    if (!ocrResult) return null;

    const showPageBreaks = settings.documents.pdfSettings.showOcrPageBreaks;
    const format = ocrResult.format;

    const pages = ocrResult.pages.length
      ? ocrResult.pages
      : format === "html"
        ? [{ pageNumber: 1, text: ocrResult.combinedText }]
        : splitTextIntoPages(ocrResult.combinedText, ocrResult.pageCount || 1);

    return pages.map((page) => {
      const html = format === "html" ? page.text : renderMarkdown(page.text);
      return (
        <section key={page.pageNumber} className="ocr-page mb-8">
          {showPageBreaks && (
            <div className="ocr-page-break text-xs uppercase tracking-widest text-muted-foreground border-b border-border pb-2 mb-4">
              Page {page.pageNumber}
            </div>
          )}
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </section>
      );
    });
  };

  // Convert PDF to HTML for better text selection
  const handleConvertToHtml = async () => {
    if (!currentDocument || docType !== 'pdf' || !currentDocument.filePath) return;

    setIsOcrConverting(true);
    try {
      await ensureOCRConfig(settings.documents.ocr);
      await ensureGLMOllamaRuntime(settings.documents.ocr);

      const ocrResult = await ocrPdfFile({
        pdf_path: currentDocument.filePath,
        provider: settings.documents.ocr.provider,
        language: settings.documents.ocr.language,
      });

      if (!ocrResult.success || !ocrResult.combined_text.trim()) {
        throw new Error(ocrResult.error || "OCR returned no text");
      }

      const format = (ocrResult.format || "markdown") as "text" | "markdown" | "html";
      const pages = ocrResult.pages.map((page) => ({
        pageNumber: page.page_number,
        text: page.text,
      }));

      setOcrResult({
        pages,
        combinedText: ocrResult.combined_text,
        format,
        pageCount: ocrResult.page_count,
      });
      setPdfViewMode("ocr-html");

      toast.success(t("viewer.ocrComplete"), t("viewer.ocrRenderedAsHtml"));
    } catch (error) {
      console.error("Failed to OCR PDF:", error);
      toast.error(
        "OCR failed",
        error instanceof Error ? error.message : "Failed to OCR the document"
      );
    } finally {
      setIsOcrConverting(false);
    }
  };

  const htmlSource = currentDocument?.metadata?.articleHtml || currentDocument?.content || htmlContent || "";
  const htmlForDisplay = useMemo(() => {
    if (!htmlSource) {
      if (isEditableBrowserArticleDocument(currentDocument)) {
        const sourceUrl = currentDocument?.filePath || "";
        return `<!DOCTYPE html><html><head></head><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; color: #666; text-align: center; padding: 2rem;">
          <div>
            <p>This page had no readable content when saved.</p>
            <p style="font-size: 0.85em; margin-top: 8px; color: #888;">The source may require JavaScript to render content.</p>
            ${sourceUrl.startsWith("http") ? `<p style="font-size: 0.85em; margin-top: 12px;"><a href="${sourceUrl}" target="_blank" rel="noopener" style="color: #2563eb;">Open original page</a></p>` : ""}
          </div>
        </body></html>`;
      }
      return "";
    }

    // Browser extension documents store plain text (captured via innerText).
    // Route through processHtmlContent to add proper styling for iframe display.
    if (isEditableBrowserArticleDocument(currentDocument)) {
      const preserveImages = settings.documents.webImportPreserveImages;
      const baseUrl = currentDocument?.filePath?.startsWith("http")
        ? currentDocument.filePath
        : window.location.origin;
      return processHtmlContent(htmlSource, baseUrl, currentDocument?.title || "", preserveImages);
    }

    const preserveImages = settings.documents.webImportPreserveImages;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlSource, "text/html");
      if (!preserveImages) {
        const styleTag = doc.createElement("style");
        styleTag.textContent = `
          img, picture, source {
            display: none !important;
          }
        `;
        doc.head.appendChild(styleTag);
      }
      let html = doc.documentElement.outerHTML;
      if (!jumpHighlightQuery) return html;

      // Highlight query terms inside HTML text nodes. This runs only when opening via jump navigation.
      try {
        const highlightDoc = parser.parseFromString(html, "text/html");
        highlightDoc.querySelectorAll("script, style").forEach((el) => el.remove());
        const terms = jumpHighlightQuery
          .split(/\s+/)
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 8);
        if (terms.length === 0) return html;

        const walker = highlightDoc.createTreeWalker(highlightDoc.body, NodeFilter.SHOW_TEXT);
        const regex = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");

        const textNodes: Text[] = [];
        while (walker.nextNode()) {
          const node = walker.currentNode as Text;
          if (!node.nodeValue || !node.nodeValue.trim()) continue;
          textNodes.push(node);
        }

        for (const node of textNodes) {
          const value = node.nodeValue || "";
          if (!regex.test(value)) continue;
          regex.lastIndex = 0;
          const frag = highlightDoc.createDocumentFragment();
          let last = 0;
          let match: RegExpExecArray | null;
          while ((match = regex.exec(value)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (start > last) frag.append(value.slice(last, start));
            const mark = highlightDoc.createElement("mark");
            mark.setAttribute("data-search-highlight", "true");
            mark.style.background = "rgba(245, 158, 11, 0.35)"; // amber
            mark.style.borderRadius = "2px";
            mark.textContent = value.slice(start, end);
            frag.append(mark);
            last = end;
          }
          if (last < value.length) frag.append(value.slice(last));
          node.parentNode?.replaceChild(frag, node);
        }

        html = highlightDoc.documentElement.outerHTML;
      } catch {
        // If highlighting fails, fall back to unmodified HTML.
      }

      return html;
    } catch {
      return htmlSource;
    }
  }, [htmlSource, settings.documents.webImportPreserveImages, jumpHighlightQuery, currentDocument]);

  useEffect(() => {
    if (docType !== "html") return;
    const frame = iframeRef.current;
    if (!frame || !currentDocument?.id) return;

    let teardown: (() => void) | null = null;

    const attach = () => {
      teardown?.();

      const doc = frame.contentDocument;
      const win = frame.contentWindow;
      const body = doc?.body;
      if (!doc || !win || !body) return;

      applyAnchoredTextHighlights({
        root: body,
        highlights: persistedDocumentHighlights.htmlHighlights,
        signature: `${currentDocument.id}:${htmlForDisplay}`,
      });

      const publishSelection = () => {
        const selection = win.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
          updateSelection("", null);
          return;
        }

        const range = selection.getRangeAt(0);
        const context = buildTextSelectionContext({
          root: body,
          range,
          documentId: currentDocument.id,
          surface: "html",
        });
        updateSelection(context?.selectedText ?? "", context);
      };

      doc.addEventListener("selectionchange", publishSelection);
      doc.addEventListener("mouseup", publishSelection);
      doc.addEventListener("keyup", publishSelection);

      teardown = () => {
        doc.removeEventListener("selectionchange", publishSelection);
        doc.removeEventListener("mouseup", publishSelection);
        doc.removeEventListener("keyup", publishSelection);
      };
    };

    frame.addEventListener("load", attach);
    if (frame.contentDocument?.readyState === "complete") {
      attach();
    }

    return () => {
      frame.removeEventListener("load", attach);
      teardown?.();
    };
  }, [
    currentDocument?.id,
    docType,
    htmlForDisplay,
    persistedDocumentHighlights.htmlHighlights,
    updateSelection,
  ]);

  useEffect(() => {
    if (docType !== "html") return;
    const frame = iframeRef.current;
    const doc = frame?.contentDocument;
    const win = frame?.contentWindow;
    const body = doc?.body;
    if (!doc || !win || !body) return;

    const unwrapPreviousSearchMarks = () => {
      const marks = Array.from(doc.querySelectorAll("mark[data-viewer-search='true']")) as HTMLElement[];
      for (const mark of marks) {
        const parent = mark.parentNode;
        if (!parent) continue;
        const textNode = doc.createTextNode(mark.textContent ?? "");
        parent.replaceChild(textNode, mark);
        parent.normalize();
      }
    };

    const query = normalizedViewerSearchQuery;
    unwrapPreviousSearchMarks();
    htmlSearchMatchesRef.current = [];

    if (!viewerSearchSupported) {
      reportViewerSearchState({
        supported: false,
        available: false,
        totalMatches: 0,
        activeMatchIndex: 0,
        unavailableReason: "Search is not available for this document type.",
      });
      return;
    }

    if (!query) {
      reportViewerSearchState({
        supported: true,
        available: true,
        totalMatches: 0,
        activeMatchIndex: 0,
        unavailableReason: undefined,
      });
      return;
    }

    const bodyText = (body.innerText || body.textContent || "").trim();
    if (!bodyText) {
      reportViewerSearchState({
        supported: true,
        available: false,
        totalMatches: 0,
        activeMatchIndex: 0,
        unavailableReason: "This document has no searchable text.",
      });
      return;
    }

    const terms = Array.from(new Set(query.split(/\s+/).map((term) => term.trim()).filter(Boolean))).slice(0, 8);
    if (terms.length === 0) {
      reportViewerSearchState({
        supported: true,
        available: true,
        totalMatches: 0,
        activeMatchIndex: 0,
        unavailableReason: undefined,
      });
      return;
    }

    const regex = new RegExp(`(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
    const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      if (node.parentElement?.closest("script, style, mark[data-viewer-search='true']")) continue;
      textNodes.push(node);
    }

    for (const node of textNodes) {
      const value = node.nodeValue ?? "";
      if (!regex.test(value)) continue;
      regex.lastIndex = 0;
      const fragment = doc.createDocumentFragment();
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(value)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (start > lastIndex) fragment.append(value.slice(lastIndex, start));
        const mark = doc.createElement("mark");
        mark.setAttribute("data-viewer-search", "true");
        mark.style.background = "rgba(245, 158, 11, 0.28)";
        mark.style.borderRadius = "2px";
        mark.style.padding = "0 1px";
        mark.textContent = value.slice(start, end);
        fragment.append(mark);
        htmlSearchMatchesRef.current.push(mark);
        lastIndex = end;
      }

      if (lastIndex < value.length) fragment.append(value.slice(lastIndex));
      node.parentNode?.replaceChild(fragment, node);
    }

    const totalMatches = htmlSearchMatchesRef.current.length;
    if (totalMatches === 0) {
      reportViewerSearchState({
        supported: true,
        available: true,
        totalMatches: 0,
        activeMatchIndex: 0,
        unavailableReason: undefined,
      });
      return;
    }

    const normalizedIndex = ((viewerSearchState.activeMatchIndex % totalMatches) + totalMatches) % totalMatches;
    htmlSearchMatchesRef.current.forEach((mark, index) => {
      if (index === normalizedIndex) {
        mark.style.background = "rgba(245, 158, 11, 0.52)";
        mark.style.outline = "2px solid rgba(217, 119, 6, 0.85)";
      } else {
        mark.style.background = "rgba(245, 158, 11, 0.28)";
        mark.style.outline = "none";
      }
    });

    const activeMark = htmlSearchMatchesRef.current[normalizedIndex];
    activeMark?.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });

    reportViewerSearchState({
      supported: true,
      available: true,
      totalMatches,
      activeMatchIndex: normalizedIndex,
      unavailableReason: undefined,
    });
  }, [
    currentDocument?.id,
    docType,
    htmlForDisplay,
    normalizedViewerSearchQuery,
    reportViewerSearchState,
    viewerSearchState.activeMatchIndex,
    viewerSearchSupported,
  ]);

  const scrollHtmlFrameToInitialHit = useCallback(() => {
    if (!initialJump || initialJump.kind !== "html") return;
    const frame = iframeRef.current;
    const win = frame?.contentWindow;
    const doc = frame?.contentDocument;
    if (!win || !doc) return;

    const searchMarks = Array.from(doc.querySelectorAll("mark[data-search-highlight='true']")) as HTMLElement[];
    const normalizedQuote = initialJump.textQuote?.trim().toLowerCase();
    const targetMark =
      (normalizedQuote
        ? searchMarks.find((mark) => (mark.textContent ?? "").trim().toLowerCase() === normalizedQuote) ??
          searchMarks.find((mark) => (mark.textContent ?? "").trim().toLowerCase().includes(normalizedQuote))
        : undefined) ??
      searchMarks[0];

    if (targetMark) {
      targetMark.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
      return;
    }

    // No existing search marks — search DOM for the text quote and highlight it
    if (normalizedQuote) {
      const body = doc.body;
      if (body) {
        const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT);
        let matchNode: Text | null = null;
        let matchOffset = -1;
        while (walker.nextNode()) {
          const node = walker.currentNode as Text;
          const value = node.nodeValue ?? "";
          const idx = value.toLowerCase().indexOf(normalizedQuote);
          if (idx >= 0 && node.parentElement?.closest("script, style") === null) {
            matchNode = node;
            matchOffset = idx;
            break;
          }
        }
        if (matchNode && matchOffset >= 0) {
          const range = doc.createRange();
          range.setStart(matchNode, matchOffset);
          range.setEnd(matchNode, matchOffset + normalizedQuote.length);
          const mark = doc.createElement("mark");
          mark.setAttribute("data-search-highlight", "true");
          mark.style.background = "rgba(245, 158, 11, 0.35)";
          mark.style.borderRadius = "2px";
          mark.style.padding = "0 1px";
          range.surroundContents(mark);
          range.detach();
          mark.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
          return;
        }
      }
    }

    if (typeof initialJump.scrollPercent === "number") {
      const pct = Math.max(0, Math.min(100, initialJump.scrollPercent));
      const el = doc.scrollingElement || doc.documentElement || doc.body;
      const maxScroll = Math.max(0, el.scrollHeight - win.innerHeight);
      win.scrollTo(0, (pct / 100) * maxScroll);
    }
  }, [initialJump]);

  // Apply initial jump navigation (page/scroll/time) on document load.
  useEffect(() => {
    if (!currentDocument) return;
    if (!initialJump) return;

    if (docType === "pdf" && initialJump.kind === "pdf" && typeof initialJump.pageNumber === "number") {
      const page = Math.max(1, Math.floor(initialJump.pageNumber));
      setSuppressPdfAutoScroll(false);
      setPageNumber(page);
      return;
    }

    if (docType === "html" && initialJump.kind === "html") {
      // iframe onLoad handles the initial call; retry after a short delay in case onLoad fires before content is parsed
      setTimeout(() => {
        scrollHtmlFrameToInitialHit();
      }, 300);
      return;
    }
  }, [currentDocument?.id, docType, initialJump, scrollHtmlFrameToInitialHit]);

  // Make Cmd/Ctrl+K work even when an embedded same-origin iframe has focus (eg HTML imports).
  // Key events inside iframes do not bubble to the parent window, so we also bind to the frame window.
  useEffect(() => {
    if (!currentDocument) return;
    if (docType !== "html") return;
    const frame = iframeRef.current;
    const win = frame?.contentWindow;
    if (!win) return;

    const handler = (e: KeyboardEvent) => {
      if (isCommandPaletteOpenShortcut(e)) {
        e.preventDefault();
        dispatchCommandPaletteOpen();
      }
    };

    win.addEventListener("keydown", handler, true);
    return () => win.removeEventListener("keydown", handler, true);
  }, [currentDocument?.id, docType]);

  if (!currentDocument) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">{t("viewer.documentNotFound")}</div>
      </div>
    );
  }

  const hasPageNavigation = docType === "pdf" || docType === "epub";

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Toolbar */}
      {!embedded && !isFullscreen && (
      <div className="flex items-center justify-between p-4 bg-card border-b border-border">
        <div className="flex items-center gap-2">
          <button
            onClick={handleBack}
            className="p-2 rounded-md hover:bg-muted transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
            title={t("viewer.backToDocuments")}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="hidden sm:block h-6 w-px bg-border" />
          <h2 className="font-semibold text-foreground line-clamp-1 max-w-[120px] sm:max-w-[200px] md:max-w-md text-sm md:text-base">
            {currentDocument.title}
          </h2>
          <span className="hidden sm:inline text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            {docType.toUpperCase()}
          </span>
          {/* Compact progress indicator */}
          {currentDocument.progressPercent !== undefined && currentDocument.progressPercent > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-blue-500/10 text-blue-600 px-2 py-1 rounded">
              <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${currentDocument.progressPercent}%` }}
                />
              </div>
              {Math.round(currentDocument.progressPercent)}%
            </span>
          )}
          
          {/* Priority Control */}
          <PriorityControl
            documentId={currentDocument.id}
            prioritySlider={currentDocument.prioritySlider}
            priorityRating={currentDocument.priorityRating}
            variant="compact"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          {showSearch ? (
            <div className="flex items-center gap-2 bg-muted rounded-md p-1">
              <input
                ref={searchInputRef}
                type="text"
                placeholder={t("viewer.searchInDocument")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearch(e.shiftKey ? "prev" : "next");
                  } else if (e.key === "Escape") {
                    closeViewerSearch();
                  }
                }}
                className="flex-1 md:flex-none px-3 py-1.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary md:w-64 min-h-[36px]"
                autoFocus
              />
              {normalizedViewerSearchQuery ? (
                <>
                  <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground px-2">
                    {!viewerSearchState.available && viewerSearchState.unavailableReason ? (
                      <span className="max-w-[220px] truncate">{viewerSearchState.unavailableReason}</span>
                    ) : viewerSearchState.totalMatches > 0 ? (
                      <span>{viewerSearchState.activeMatchIndex + 1} / {viewerSearchState.totalMatches}</span>
                    ) : (
                      <span>0 matches</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleSearch("prev")}
                    disabled={!viewerSearchState.available || viewerSearchState.totalMatches <= 0}
                    className="p-2 hover:bg-background rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-w-[36px] min-h-[36px] flex items-center justify-center"
                    title="Previous match"
                  >
                    <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleSearch("next")}
                    disabled={!viewerSearchState.available || viewerSearchState.totalMatches <= 0}
                    className="p-2 hover:bg-background rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-w-[36px] min-h-[36px] flex items-center justify-center"
                    title="Next match"
                  >
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                </>
              ) : null}
              <button
                onClick={closeViewerSearch}
                className="p-2 hover:bg-background rounded-md transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                if (!viewerSearchSupported) return;
                setShowSearch(true);
                requestAnimationFrame(() => {
                  searchInputRef.current?.focus();
                });
              }}
              disabled={!viewerSearchSupported}
              className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground"
              title={t("viewer.searchInDocumentShortcut")}
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          {/* Create Extract Button (manual) */}
          <button
            onClick={openExtractDialog}
            className="p-2 rounded-md hover:bg-muted transition-colors text-primary"
            title={t("viewer.createExtract")}
            data-extract-button="true"
          >
            <Lightbulb className="w-4 h-4" />
          </button>

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="p-2 rounded-md hover:bg-muted transition-colors relative"
            title={t("viewer.shareDocumentLink")}
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Convert to HTML Button (PDF only) */}
          {docType === "pdf" && (
            <button
              onClick={handleConvertToHtml}
              disabled={isOcrConverting}
              className={cn(
                "p-2 rounded-md transition-colors relative",
                isOcrConverting
                  ? "bg-muted text-muted-foreground cursor-wait"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
              title={t("viewer.ocrToHtml")}
            >
              {isOcrConverting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileCode className="w-4 h-4" />
              )}
            </button>
          )}

          {/* PDF / OCR HTML Toggle */}
          {docType === "pdf" && ocrResult && viewMode === "document" && (
            <div className="flex items-center bg-muted rounded-md p-1">
              <button
                onClick={() => setPdfViewMode("pdf")}
                className={cn(
                  "px-2 py-1 text-xs rounded-md transition-colors",
                  pdfViewMode === "pdf"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title={t("viewer.viewPdf")}
              >
                PDF
              </button>
              <button
                onClick={() => setPdfViewMode("ocr-html")}
                className={cn(
                  "px-2 py-1 text-xs rounded-md transition-colors",
                  pdfViewMode === "ocr-html"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title={t("viewer.viewOcrHtml")}
              >
                OCR HTML
              </button>
            </div>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center bg-muted rounded-md p-1 mr-2">
            <button
              onClick={() => setViewMode("document")}
              className={cn(
                "p-2 rounded-md transition-colors",
                viewMode === "document"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={t("viewer.viewDocument")}
            >
              <FileText className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("extracts")}
              className={cn(
                "p-2 rounded-md transition-colors",
                viewMode === "extracts"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={t("viewer.viewExtracts")}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={cn(
                "p-2 rounded-md transition-colors",
                viewMode === "cards"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={t("viewer.viewLearningCards")}
            >
              <Brain className="w-4 h-4" />
            </button>
          </div>

          {canUseEditPalette && (
            <div className="flex items-center bg-muted rounded-md p-1 mr-2">
              <button
                onClick={() => setIsPaletteMode((prev) => !prev)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  isPaletteMode
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title={isPaletteMode ? "Return to reader" : "Open edit palette"}
              >
                <PanelsTopLeft className="w-4 h-4" />
                {isPaletteMode ? "Reader" : "Palette"}
              </button>
            </div>
          )}

          {/* Markdown Width Controls */}
          {docType === "markdown" && viewMode === "document" && !isPaletteMode && (
            <div className="flex items-center bg-muted rounded-md p-1">
              <button
                onClick={handleNarrowMarkdown}
                className="p-2 rounded-md hover:bg-background transition-colors"
                title={t("viewer.narrowTextWidth")}
                disabled={markdownWidthCh <= MARKDOWN_MIN_WIDTH_CH}
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-muted-foreground min-w-[54px] text-center">
                {markdownWidthCh}ch
              </span>
              <button
                onClick={handleWidenMarkdown}
                className="p-2 rounded-md hover:bg-background transition-colors"
                title={t("viewer.widenTextWidth")}
                disabled={markdownWidthCh >= MARKDOWN_MAX_WIDTH_CH}
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleResetMarkdownWidth}
                className="p-2 rounded-md hover:bg-background transition-colors"
                title={t("viewer.resetTextWidth")}
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Queue Navigation Controls */}
          {viewMode === "document" && queueNav.totalDocuments > 0 && (
            <QueueNavigationControls
              currentDocumentIndex={queueNav.currentDocumentIndex}
              totalDocuments={queueNav.totalDocuments}
              hasMoreChunks={queueNav.canGoToNextChunk}
              onPreviousDocument={queueNav.goToPreviousDocument}
              onNextDocument={queueNav.goToNextDocument}
              onNextChunk={queueNav.goToNextChunk}
            />
          )}

          {/* Page Navigation and Zoom */}
          {hasPageNavigation && viewMode === "document" && (
            <>
              {docType === "pdf" && (
                <>
                  <button
                    onClick={handlePrevPage}
                    disabled={pageNumber <= 1}
                    className="p-2 rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={t("viewer.previousPage")}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="text-sm text-muted-foreground min-w-[80px] text-center">
                    {currentDocument.totalPages
                      ? t("viewer.pageOf", { current: pageNumber, total: currentDocument.totalPages })
                      : t("viewer.page", { current: pageNumber })}
                  </span>

                  <button
                    onClick={handleNextPage}
                    disabled={
                      !currentDocument.totalPages || pageNumber >= (currentDocument.totalPages || 0)
                    }
                    className="p-2 rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={t("viewer.nextPage")}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}

              <div className="h-6 w-px bg-border mx-2" />

              {docType === "pdf" && (
                <>
                  {/* Zoom Mode Buttons */}
                  <button
                    onClick={() => handleZoomModeChange("fit-page")}
                    className={cn(
                      "p-2 rounded-md transition-colors text-xs",
                      zoomMode === "fit-page" ? "bg-muted text-foreground" : "hover:bg-muted text-muted-foreground"
                    )}
                    title={t("viewer.fitToPage")}
                  >
                    {t("viewer.fitPage")}
                  </button>

                  <button
                    onClick={() => handleZoomModeChange("fit-width")}
                    className={cn(
                      "p-2 rounded-md transition-colors text-xs",
                      zoomMode === "fit-width" ? "bg-muted text-foreground" : "hover:bg-muted text-muted-foreground"
                    )}
                    title={t("viewer.fitToWidth")}
                  >
                    {t("viewer.fitWidth")}
                  </button>

                  <div className="h-6 w-px bg-border mx-2" />
                </>
              )}

              <button
                onClick={handleZoomOut}
                className="p-2 rounded-md hover:bg-muted transition-colors"
                title={t("viewer.zoomOut")}
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <span className="text-sm text-muted-foreground min-w-[50px] text-center">
                {Math.round(scale * 100)}%
              </span>

              <button
                onClick={handleZoomIn}
                className="p-2 rounded-md hover:bg-muted transition-colors"
                title={t("viewer.zoomIn")}
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                onClick={handleResetZoom}
                className="p-2 rounded-md hover:bg-muted transition-colors"
                title={t("viewer.resetView")}
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <div className="h-6 w-px bg-border mx-2" />

              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                className={cn(
                  "p-2 rounded-md transition-colors",
                  isFullscreen
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground"
                )}
                title={isFullscreen ? t("viewer.exitFullscreen") : t("viewer.enterFullscreen")}
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </>
          )}
        </div>
      </div>
      )}

      {/* Content Area */}
      <div 
        data-document-content="true"
        className={cn(
          "flex-1 bg-muted/30 relative min-h-0",
          // Avoid nested scrolling when a child viewer owns its own internal scroll containers.
          // PDFs restore against their own scroll element; YouTube has transcript/chat panes.
          viewMode === "document"
          && (
            (docType === "pdf" && !(pdfViewMode === "ocr-html" && ocrResult))
            || docType === "youtube"
          )
            ? "overflow-hidden"
            : "overflow-auto"
        )}
        onClick={(e) => {
          // Toggle controls/fullscreen on click/tap if not clicking interactive elements
          const isMobile = window.matchMedia("(max-width: 768px)").matches;
          if (isMobile && !(e.target as HTMLElement).closest('button, input, textarea, a, .interactive, [data-extract-button]')) {
            // For EPUB, the viewer handles its own taps. For PDF/others, we handle it here.
            if (docType !== 'epub') {
              toggleFullscreen();
            }
          }
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">{t("viewer.loadingDocument")}</div>
          </div>
        ) : viewMode === "extracts" ? (
          <div className="p-6 bg-background h-full overflow-auto">
            <ExtractsList
              documentId={currentDocument.id}
              focusedExtractId={focusedExtractId}
              sourceContext={extractSourceContext}
              onBackToSource={extractSourceContext ? () => setViewMode("document") : undefined}
              onResumeQueue={extractSourceContext?.queueType === "queue-scroll" && queueScrollTab ? resumeQueueFromExtract : undefined}
            />
          </div>
        ) : viewMode === "cards" ? (
          <div className="p-6 bg-background h-full overflow-auto">
            <LearningCardsList documentId={currentDocument.id} />
          </div>
        ) : isPaletteMode && canUseEditPalette ? (
          <EditableContentPalette
            title={currentDocument.title}
            badge={docType === "epub" ? "EPUB Palette" : docType === "html" ? "Document Palette" : "Markdown Palette"}
            content={docType === "html" ? (currentDocument.content || htmlContent || "") : (currentDocument.content || "")}
            contentKind={docType === "html" ? "html" : "markdown"}
            sourceUrl={currentDocument.filePath?.startsWith("http") ? currentDocument.filePath : undefined}
            placeholder={docType === "epub"
              ? "Edit the extracted EPUB text here. This is a working text layer, not a full EPUB package editor."
              : "Edit the document text here..."}
            emptyPreviewMessage="The live preview will appear here as you edit."
            onSave={({ content }) => saveEditableDocumentContent(content)}
          />
        ) : docType === "pdf" && (fileData || pdfUrl) ? (
          pdfViewMode === "ocr-html" && ocrResult ? (
            <div className="reading-surface min-h-[500px]">
              <h1 className="reading-title">{currentDocument.title}</h1>
              <div className="prose prose-sm max-w-none dark:prose-invert reading-prose">
                {renderOcrPages()}
              </div>
            </div>
          ) : (
          <PDFViewer
            documentId={currentDocument.id}
            fileData={fileData}
            fileUrl={pdfUrl}
            pageNumber={pageNumber}
            scale={scale}
            zoomMode={zoomMode}
            searchQuery={normalizedViewerSearchQuery}
            searchNavigationRequest={
              normalizedViewerSearchQuery
                ? {
                    requestId: viewerSearchNavRequest?.nonce ?? 0,
                    direction: viewerSearchNavRequest?.direction === "prev" ? "previous" : "next",
                    targetIndex: viewerSearchNavRequest?.targetIndex,
                  }
                : null
            }
            // On mobile, opening the extract modal (or the on-screen keyboard)
            // can cause rapid viewport/container resizes. Avoid resize-driven
            // re-render loops while the modal is open.
            suppressAutoScroll={suppressPdfAutoScroll || isExtractDialogOpen}
            onPageChange={handlePageChange}
            onLoad={handleDocumentLoad}
            onPdfInfo={handlePdfInfo}
            onPagesRendered={() => setPagesRendered(true)}
            onScrollPositionChange={handleScrollPositionChange}
            onUserScrollDuringRestore={handleUserScrollDuringRestore}
            restoreState={restoreState}
            restoreRequestId={restoreRequestId}
            contextPageWindow={contextPageWindow}
            onTextWindowChange={handlePdfContextTextChange}
            onSelectionChange={updateSelection}
            onTextSelectionCapabilityChange={setPdfTextSelectionCapability}
            onOcrExtractText={(text, _pageNum) => {
              setSelectedText(text);
              lastSelectionRef.current = text;
              setSelectionContext(null);
              setIsExtractDialogOpen(true);
            }}
            onSearchResultsChange={(state) => {
              reportViewerSearchState({
                supported: true,
                available: state.isSearchable && state.status !== "unavailable",
                totalMatches: state.totalMatches,
                activeMatchIndex: state.activeMatchIndex >= 0 ? state.activeMatchIndex : 0,
                unavailableReason:
                  state.status === "unavailable" || !state.isSearchable
                    ? "This PDF has no searchable text layer. Run OCR or extract text first."
                    : undefined,
              });
            }}
            persistedHighlights={persistedDocumentHighlights.pdfHighlights}
            onHighlightSelection={handlePdfHighlightSelection}
            highlightQuery={jumpHighlightQuery}
            highlightPageNumber={initialJump?.kind === "pdf" ? initialJump.pageNumber : undefined}
            highlightTextQuote={jumpTextQuote}
          />
          )
        ) : docType === "epub" && (fileData || epubUrl) ? (
          <EPUBViewer
            fileData={fileData}
            fileUrl={epubUrl}
            fileName={currentDocument.title}
            documentId={currentDocument.id}
            onLoad={(toc) => handleDocumentLoad(0, toc)}
            onSelectionChange={updateSelection}
            onContextTextChange={handlePdfContextTextChange}
            highlightQuery={jumpHighlightQuery}
            initialSearchMatchIndex={initialJump?.kind === "epub" ? initialJump.matchIndex : undefined}
            searchQuery={normalizedViewerSearchQuery}
            searchMatchIndex={viewerSearchState.activeMatchIndex}
            onSearchResultsChange={(results) => {
              reportViewerSearchState({
                supported: true,
                available: true,
                totalMatches: results.total,
                activeMatchIndex: results.activeIndex >= 0 ? results.activeIndex : 0,
                unavailableReason: undefined,
              });
            }}
            initialCfi={initialJump?.kind === "epub" ? initialJump.cfi || undefined : undefined}
            persistedHighlights={persistedDocumentHighlights.epubHighlights}
            onProgressChange={(percent) => {
              handleScrollPositionChange({
                pageNumber: 1,
                scrollTop: 0,
                scrollLeft: 0,
                scrollHeight: 0,
                clientHeight: 0,
                scrollPercent: percent,
              });
            }}
          />
        ) : docType === "audio" ? (
          mediaSource ? (
            <AudiobookViewer
              document={currentDocument}
              fileContent={mediaSource.src}
            />
          ) : mediaError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md px-4">
                <div className="text-6xl mb-4">🎧</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {t("viewer.couldNotLoadAudiobook")}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {mediaError}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("viewer.fileRemovedOrReimport")}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-6xl mb-4">🎧</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {t("viewer.loadingAudiobook")}
                </h3>
                <p className="text-muted-foreground">
                  {t("viewer.pleaseWaitWhileAudioLoads")}
                </p>
              </div>
            </div>
          )
        ) : docType === "video" ? (
          mediaSource ? (
            <div className="h-full w-full bg-black">
              <LocalVideoPlayer
                src={{
                  src: mediaSource.src,
                  mimeType: mediaSource.mimeType,
                  strategy: mediaSource.strategy,
                  alreadyPlayable: true,
                }}
                documentId={currentDocument.id}
                title={currentDocument.title}
                className="h-full w-full"
                mediaType="video"
              />
            </div>
          ) : mediaError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md px-4">
                <div className="text-6xl mb-4">🎬</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {t("viewer.couldNotLoadVideo")}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {mediaError}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("viewer.fileRemovedOrReimport")}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-6xl mb-4">🎬</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {t("viewer.loadingVideo")}
                </h3>
                <p className="text-muted-foreground">
                  {t("viewer.pleaseWaitWhileVideoLoads")}
                </p>
              </div>
            </div>
          )
        ) : docType === "markdown" ? (
          <div
            className="reading-surface reading-surface-markdown relative min-h-full h-full overflow-x-hidden"
            style={{ "--reading-markdown-max-width": `${markdownWidthCh}ch` } as CSSProperties}
          >
            {embedded && (
              <div className="absolute top-3 right-3 z-20 flex items-center bg-card/85 backdrop-blur border border-border rounded-md p-1">
                <button
                  onClick={handleNarrowMarkdown}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors"
                  title={t("viewer.narrowTextWidth")}
                  disabled={markdownWidthCh <= MARKDOWN_MIN_WIDTH_CH}
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] text-muted-foreground min-w-[50px] text-center">
                  {markdownWidthCh}ch
                </span>
                <button
                  onClick={handleWidenMarkdown}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors"
                  title={t("viewer.widenTextWidth")}
                  disabled={markdownWidthCh >= MARKDOWN_MAX_WIDTH_CH}
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <MarkdownViewer
              document={currentDocument}
              content={currentDocument.content}
              initialScrollPercent={initialJump?.kind === "markdown" ? initialJump.scrollPercent : currentDocument.currentScrollPercent}
              searchQuery={normalizedViewerSearchQuery}
              activeSearchMatchIndex={viewerSearchState.activeMatchIndex}
              onSearchResultsChange={(totalMatches, activeMatchIndex) => {
                reportViewerSearchState({
                  supported: true,
                  available: true,
                  totalMatches,
                  activeMatchIndex: activeMatchIndex,
                  unavailableReason: undefined,
                });
              }}
              highlightQuery={jumpHighlightQuery}
              initialSearchTextQuote={jumpTextQuote}
              highlights={persistedDocumentHighlights.markdownHighlights}
              onSelectionChange={updateSelection}
              onScrollPositionChange={(scrollPercent) => {
                handleScrollPositionChange({
                  pageNumber: 1,
                  scrollTop: 0,
                  scrollLeft: 0,
                  scrollHeight: 0,
                  clientHeight: 0,
                  scrollPercent,
                });
              }}
            />
          </div>
        ) : docType === "html" ? (
          <div className="h-full w-full overflow-hidden bg-background">
            <iframe
              title={currentDocument.title}
              ref={iframeRef}
              className="h-full w-full border-0"
              sandbox="allow-same-origin"
              srcDoc={htmlForDisplay}
              onLoad={() => {
                scrollHtmlFrameToInitialHit();
              }}
            />
          </div>
        ) : docType === "youtube" ? (
          <div className="h-full min-h-0 overflow-hidden">
            <YouTubeViewer
              videoId={extractYouTubeVideoId(currentDocument.filePath) ?? ""}
              documentId={currentDocument.id}
              title={currentDocument.title}
              onLoad={handleYouTubeLoad}
              initialSeekTime={initialJump?.kind === "youtube" ? initialJump.timeSeconds : undefined}
              transcriptSearchQuery={normalizedViewerSearchQuery}
              activeTranscriptMatchIndex={viewerSearchState.activeMatchIndex}
              onTranscriptSearchStateChange={(state) => {
                reportViewerSearchState({
                  supported: true,
                  available: state.available,
                  totalMatches: state.totalMatches,
                  activeMatchIndex: state.activeMatchIndex >= 0 ? state.activeMatchIndex : 0,
                  unavailableReason: state.available ? undefined : "Transcript search is unavailable for this video.",
                });
              }}
              initialTranscriptHighlightQuery={jumpHighlightQuery}
              initialTranscriptSegmentId={initialJump?.kind === "youtube" ? initialJump.segmentId : undefined}
              autoPlayOnOpen={!!autoPlay && initialJump?.kind === "youtube"}
              onArchive={() => {
                loadQueue();
                const currentTab = tabs.find(t => t.data?.documentId === documentId);
                if (currentTab) {
                  closeTab(currentTab.id);
                }
              }}
              onTranscriptLoad={(segments) => {
                const transcriptText = segments.map(s => `[${formatTime(s.start)}] ${s.text}`).join("\n");
                setVideoContext(prev => ({
                  ...prev,
                  videoId: extractYouTubeVideoId(currentDocument.filePath) ?? "",
                  title: currentDocument.title,
                  transcript: transcriptText,
                }));
              }}
              onTimeUpdate={(time) => {
                setVideoContext(prev => prev ? { ...prev, currentTime: time } : null);
              }}
              onSelectionChange={(text) => {
                onSelectionChange?.(text);
              }}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-6xl mb-4">📄</div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {t("viewer.previewNotAvailable")}
              </h3>
              <p className="text-muted-foreground">
                {t("viewer.documentTypePreviewComingSoon", { type: docType })}
                {docType !== "epub" && currentDocument.filePath?.endsWith(".epub") && " (fileType was empty, inferred from extension)"}
              </p>
              {docType === "epub" && !fileData && !epubUrl && (
                <p className="text-sm text-orange-500 mt-2">
                  {t("viewer.epubDetectedButNotLoaded")}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Hover Rating Controls - for quick document rating (non-PDF docs, only when in queue) */}
        {viewMode === "document" && !disableHoverRating && docType !== "pdf" && docType !== "youtube" && docType !== "audio" && hasDocumentHistory && queueNav.totalDocuments > 0 && (
          <HoverRatingControls
            context="document"
            documentId={documentId}
            onRatingSubmitted={handleRating}
            position="absolute"
            disableBackdropBlur={docType === "epub"}
            compactMode={docType === "epub" && isPWA()}
          />
        )}

        {/* Document Minimap - VS Code style */}
        {viewMode === "document" && (docType === "pdf" || docType === "epub" || docType === "markdown" || docType === "html") && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-30 opacity-50 hover:opacity-100 transition-opacity">
            <DocumentMinimap
              segments={minimapSegments}
              currentPosition={minimapPosition}
              totalHeight={300}
              onSegmentClick={(position) => {
                // Navigate to position in document.
                if (docType === "html") {
                  const frame = iframeRef.current;
                  const win = frame?.contentWindow;
                  const doc = frame?.contentDocument;
                  if (win && doc) {
                    const el = doc.scrollingElement || doc.documentElement || doc.body;
                    const maxScroll = Math.max(0, el.scrollHeight - win.innerHeight);
                    win.scrollTo(0, position * maxScroll);
                  }
                  return;
                }

                const container = document.querySelector("[data-document-scroll-container]") as HTMLElement | null;
                if (container) {
                  const targetScroll = position * Math.max(0, container.scrollHeight - container.clientHeight);
                  container.scrollTo({ top: targetScroll, behavior: "smooth" });
                }
              }}
            />
          </div>
        )}

        {viewMode === "document" && (docType === "pdf" || docType === "epub" || docType === "markdown" || docType === "html") && (
          <ReaderTTSControls
            text={readerContextText}
            onComplete={handleTTSComplete}
            autoAdvance={true}
            className={cn(
              "absolute z-40",
              embedded ? "bottom-3 left-3 right-3" : "bottom-4 left-1/2 -translate-x-1/2"
            )}
          />
        )}
      </div>

      {/* Floating Action Button for Extract Creation */}
      {activeExtractSelection && viewMode === "document" && (
        <div 
          className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[70] pointer-events-auto animate-in slide-in-from-bottom-4 duration-200"
          data-extract-button="true"
        >
          <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/92 p-2 shadow-2xl backdrop-blur-md">
            <button
              onClick={openExtractDialog}
              className="group flex items-center gap-3 rounded-xl bg-primary px-4 py-3 text-primary-foreground shadow-lg ring-1 ring-primary/20 transition-all min-h-[52px] text-sm font-semibold hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:translate-y-0"
              title={t("viewer.createExtractFromSelection")}
              aria-label={t("viewer.createExtractFromSelectionChars", { count: activeExtractSelection.length })}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/14 transition-colors group-hover:bg-primary-foreground/20">
                <Lightbulb className="w-5 h-5" aria-hidden="true" />
              </span>
              <span className="flex flex-col items-start leading-tight">
                <span>{t("viewer.createExtract")}</span>
                <span className="text-[11px] font-medium text-primary-foreground/80">
                  {t("extracts.selectedText")}
                </span>
              </span>
              <span className="rounded-full bg-primary-foreground/14 px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                {activeExtractSelection.length}
              </span>
            </button>
            <button
              onClick={handleDictionaryLookup}
              disabled={isDictionaryLoading}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-3 text-foreground shadow-sm transition-colors min-h-[52px] hover:bg-muted disabled:opacity-60"
              title={t("viewer.lookupDictionaryThesaurus")}
            >
              <Languages className="w-4 h-4" />
              <span className="text-xs">{isDictionaryLoading ? t("viewer.lookingUp") : t("viewer.lookup")}</span>
            </button>
          </div>
        </div>
      )}

      {dictionaryResult && (
        <div className="fixed bottom-[7.5rem] md:bottom-24 right-4 md:right-6 z-[72] w-[min(420px,calc(100vw-2rem))] rounded-lg border border-border bg-card p-3 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{dictionaryResult.word}</p>
              {dictionaryResult.definitions[0] && (
                <p className="mt-1 text-xs text-muted-foreground">{dictionaryResult.definitions[0]}</p>
              )}
              {dictionaryResult.synonyms.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("viewer.synonyms", { synonyms: dictionaryResult.synonyms.slice(0, 5).join(", ") })}
                </p>
              )}
            </div>
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setDictionaryResult(null)}
            >
              {t("viewer.close")}
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              className="rounded bg-primary px-2.5 py-1.5 text-xs text-primary-foreground"
              onClick={async () => {
                await createLearningItem({
                  item_type: "flashcard",
                  question: `Define: ${dictionaryResult.word}`,
                  answer: dictionaryResult.definitions[0] || dictionaryResult.synonyms.join(", "),
                  allow_duplicate: true,
                });
                toast.success(t("viewer.vocabularyCardCreated"));
                setDictionaryResult(null);
              }}
            >
              {t("viewer.createVocabularyCard")}
            </button>
          </div>
        </div>
      )}

      {/* Mobile PWA: Lightbulb button that appears near text selection */}
      {isMobilePWA && mobileSelection.showButton && viewMode === "document" && (
        <div
          className="fixed z-[80] pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
          style={{
            left: `${mobileSelection.position.x}px`,
            top: `${Math.max(60, mobileSelection.position.y)}px`,
            transform: "translateX(-50%)",
          }}
          data-extract-button="true"
        >
          <button
            onClick={handleMobileExtract}
            className="flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-xl hover:opacity-90 hover:scale-110 active:scale-95 transition-all"
            title={t("viewer.createExtractFromSelection")}
            aria-label={t("viewer.createExtractFromSelectionChars", { count: mobileSelection.text.length })}
          >
            <Lightbulb className="w-6 h-6" aria-hidden="true" />
          </button>
          {/* Small arrow pointing down to the selection */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-primary" />
        </div>
      )}

      {/* Create Extract Dialog */}
      <CreateExtractDialog
        documentId={currentDocument.id}
        selectedText={activeExtractSelection}
        pageNumber={isPdfSelectionContext(selectionContext) ? (selectionContext.pages[0]?.pageNumber ?? pageNumber) : pageNumber}
        selectionContext={selectionContext}
        initialHighlightColor={initialHighlightColor}
        isOpen={isExtractDialogOpen}
        onClose={() => {
          setIsExtractDialogOpen(false);
          clearTextSelection();
        }}
        onCreate={handleExtractCreated}
      />

      {/* Floating Fullscreen Control Bar (visible on hover in fullscreen mode) */}
      {isFullscreen && (
        <div className="fixed top-0 left-0 right-0 z-50 group">
          {/* Semi-transparent trigger area */}
          <div className="h-8 bg-transparent hover:bg-black/20 transition-colors">
            {/* Control bar that appears on hover */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center py-2">
              <button
                onClick={toggleFullscreen}
                className="flex items-center gap-2 px-4 py-2 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg hover:bg-background transition-colors"
                title={t("viewer.exitFullscreen")}
              >
                <Minimize className="w-4 h-4 text-foreground" />
                <span className="text-sm font-medium text-foreground">{t("viewer.exitFullscreenShort")}</span>
                <span className="text-xs text-muted-foreground ml-2">{t("viewer.pressF11OrEsc")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Floating Fullscreen Button (when not in fullscreen) */}
      {!isFullscreen && !isTauri() && (
        <button
          onClick={toggleFullscreen}
          className="fixed bottom-[calc(80px+env(safe-area-inset-bottom,0px))] right-4 z-40 md:hidden"
          title={t("viewer.enterFullscreen")}
          aria-label={t("viewer.enterFullscreenMode")}
        >
          <div className="flex items-center justify-center w-12 h-12 bg-card/95 backdrop-blur-sm border border-border rounded-full shadow-lg hover:bg-card active:scale-95 transition-all">
            <Maximize className="w-5 h-5 text-foreground" />
          </div>
        </button>
      )}
    </div>
  );
}
