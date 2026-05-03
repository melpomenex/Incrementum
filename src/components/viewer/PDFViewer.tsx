import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { TextLayerBuilder } from "pdfjs-dist/web/pdf_viewer.mjs";
import { List, ChevronLeft, ChevronRight, Maximize, Minimize, Scan } from "lucide-react";
import { cn } from "../../utils";
import type { PdfDest, ViewState } from "../../types/readerPosition";
import type { PdfRect, PdfSelectionContext, ViewportRect } from "../../types/selection";
import type { DocumentPosition } from "../../types/position";
import { saveDocumentPosition, getDocumentPosition, pagePosition, scrollPosition as createScrollPosition } from "../../api/position";
import { getDocumentAuto, updateDocumentProgressAuto } from "../../api/documents";
import { isTauri } from "../../lib/tauri";
import {
  deriveCurrentPageFromOffsets,
  isNavigationSettled,
  isStaleNavigationToken,
  shouldSuppressProgrammaticScroll,
  type NavigationMode,
} from "./pdfNavigationStability";
import {
  derivePdfTextSelectionCapability,
  hasSelectableTextInLayer,
  selectionAnchorsInTextLayers,
  selectionIntersectsTextLayers,
  type PdfTextSelectionCapability,
} from "./pdfTextSelection";
import { useI18n } from "../../lib/i18n";
// Custom selection engine imports
import { usePdfCustomSelection } from "./selection";
import { SelectionRenderer } from "./selection";
// 3-layer architecture components
import { HighlightLayer, type StoredHighlight } from "./HighlightLayer";
import { SelectionPopup, type HighlightColor } from "./SelectionPopup";
import { OcrRegionSelector } from "./OcrRegionSelector";
import { OcrProgressOverlay } from "./OcrProgressOverlay";
import { OcrTextPreview } from "./OcrTextPreview";
import { usePdfOcrManager } from "./PdfOcrManager";
import { createPdfLoadSourceFactories } from "./pdfLoadSources";
// Import PDF.js text layer styles
import "pdfjs-dist/web/pdf_viewer.css";
import "./PDFViewer.css";

// Feature flag for custom PDF selection engine
// Set to true to use geometric selection instead of native DOM selection
const ENABLE_CUSTOM_PDF_SELECTION = true;

// Configure PDF.js worker across environments. Keep this best-effort so
// load fallback logic can still render if worker init fails at runtime.
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
} catch {
  // If URL construction fails, PDF.js will fall back to its default behavior
  console.warn("[PDFViewer] Could not construct worker URL, using default");
}

// Suppress verbose PDF.js warnings (Unicode mismatch, unknown glyph name, etc.)
// Only show errors, not warnings or info messages
(pdfjsLib as any).GlobalWorkerOptions.verbosity = 0;

// Suppress PDF.js 5.x internal TypeError("Cannot read properties of null (reading 'parentNode')")
// that fires during page virtualization / scroll cleanup. PDF.js private fields (#e, #container)
// reference DOM nodes that get detached before the async text-layer pump finishes.
// Register at module scope so the handler is active before any async PDF.js work begins
// (the useEffect-based handler can be too late on some platforms / WebView engines).
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    if (reason instanceof TypeError && /parentNode/.test(String(reason.message))) {
      event.preventDefault();
    }
  });
}

interface PDFViewerProps {
  documentId: string;
  fileData?: Uint8Array | null;
  fileUrl?: string | null;
  pageNumber: number;
  scale: number;
  zoomMode?: ZoomMode;
  suppressAutoScroll?: boolean;
  highlightQuery?: string;
  highlightPageNumber?: number;
  highlightTextQuote?: string;
  searchQuery?: string;
  searchNavigationRequest?: {
    requestId: number;
    direction?: "next" | "previous";
    targetIndex?: number;
  } | null;
  onPageChange?: (pageNumber: number) => void;
  onLoad?: (numPages: number, outline: any[]) => void;
  onPagesRendered?: () => void;
  onScrollPositionChange?: (state: {
    pageNumber: number;
    scrollTop: number;
    scrollLeft: number;
    scrollHeight: number;
    clientHeight: number;
    scrollPercent: number;
    scale?: number;
    dest?: PdfDest | null;
  }) => void;
  onPdfInfo?: (info: { fingerprint?: string | null }) => void;
  restoreState?: ViewState | null;
  restoreRequestId?: number;
  onUserScrollDuringRestore?: () => void;
  contextPageWindow?: number;
  onTextWindowChange?: (text: string) => void;
  onSelectionChange?: (text: string, context?: PdfSelectionContext | null) => void;
  onTextSelectionCapabilityChange?: (capability: PdfTextSelectionCapability) => void;
  onSearchResultsChange?: (state: {
    query: string;
    totalMatches: number;
    activeMatchIndex: number;
    isSearchable: boolean;
    status: "idle" | "searching" | "ready" | "unavailable";
  }) => void;
  onOcrExtractText?: (text: string, pageNumber: number) => void;
  persistedHighlights?: StoredHighlight[];
  onHighlightSelection?: (color: HighlightColor, text: string, context: PdfSelectionContext) => void;
  onHighlightSelectionWithDialog?: (color: HighlightColor, text: string, context: PdfSelectionContext) => void;
}

type PdfSearchMatch = {
  pageNumber: number;
  pageMatchIndex: number;
  globalIndex: number;
};

type PdfTextLayerRenderer = {
  cancel?: () => void;
  render?: (params?: { viewport?: import("pdfjs-dist").PageViewport }) => Promise<void> | void;
};

type ZoomMode = "custom" | "fit-width" | "fit-page";
const VIRTUALIZATION_THRESHOLD_PAGES = 80;
const VIRTUAL_WINDOW_PAGES = 10;
const PAGE_GAP_PX = 24;
const ENABLE_PDF_VIRTUALIZATION = false;
const USER_SCROLL_LOCKOUT_MS = 1200;
const NAV_SETTLE_THRESHOLD_PX = 40;
const NAV_SETTLE_STABLE_MS = 180;
const NAV_SETTLE_TIMEOUT_MS = 1400;
const PDF_NAV_STABILITY_FLAG_KEY = "incrementum.feature.pdfNavigationStability";
const PDF_NAV_STABILITY_DEBUG_KEY = "incrementum.debug.pdfNavigationStability";

export function PDFViewer({
  documentId,
  fileData,
  fileUrl,
  pageNumber,
  scale,
  zoomMode: externalZoomMode,
  suppressAutoScroll = false,
  highlightQuery,
  highlightPageNumber,
  highlightTextQuote,
  searchQuery,
  searchNavigationRequest,
  onPageChange,
  onLoad,
  onPagesRendered,
  onScrollPositionChange,
  onPdfInfo,
  restoreState,
  restoreRequestId,
  onUserScrollDuringRestore,
  contextPageWindow = 2,
  onTextWindowChange,
  onSelectionChange,
  onTextSelectionCapabilityChange,
  onSearchResultsChange,
  onOcrExtractText,
  persistedHighlights = [],
  onHighlightSelection,
  onHighlightSelectionWithDialog,
}: PDFViewerProps) {
  const { t } = useI18n();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const outerContainerRef = useRef<HTMLDivElement>(null);
  const pageContainerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const textLayerContainerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const textLayerRootsRef = useRef<(HTMLDivElement | null)[]>([]);
  const textLayerBuildersRef = useRef<(PdfTextLayerRenderer | null)[]>([]);
  const textLayerTimeoutsRef = useRef<(ReturnType<typeof setTimeout> | null)[]>([]);
  const pageViewportRefs = useRef<(import("pdfjs-dist").PageViewport | null)[]>([]);
  const pageScaleRefs = useRef<(number | null)[]>([]);
  const renderTasksRef = useRef<(any | null)[]>([]);  // Track PDF.js render tasks to cancel
  const renderIdRef = useRef(0);
  const scrollRafRef = useRef<number | null>(null);
  const pageNumberRef = useRef(pageNumber);
  const isProgrammaticScrollRef = useRef(false);
  // Keep pageNumberRef in sync so async renderPage can check it
  useEffect(() => { pageNumberRef.current = pageNumber; }, [pageNumber]);

  // If the page number update came from scroll syncing, don't auto-scroll to the top of the page.
  // (pageNumberRef sync is above)
  const pageUpdateFromScrollRef = useRef(false);
  // If the user scrolls during an in-flight restore attempt, cancel further restore retries.
  const userScrolledDuringRestoreRef = useRef(false);
  const userScrollSignaledRef = useRef(false);
  const textCacheRef = useRef<Map<number, string>>(new Map());
  const textWindowRef = useRef<{ start: number; end: number }>({ start: 1, end: 1 });
  const skipAutoScrollOnceRef = useRef(false);
  const lastSelectionWasPdfRef = useRef(false);
  const pageTextSelectionAvailabilityRef = useRef<Map<number, boolean>>(new Map());
  // Track selection highlight elements
  const selectionHighlightsRef = useRef<Map<number, HTMLDivElement[]>>(new Map());
  // Track the last restored page to prevent scroll events from resetting backwards
  const restoredPageRef = useRef<number | null>(null);
  const restorationWindowRef = useRef<number>(0);
  // Track initial load to suppress resize during first render
  const initialLoadWindowRef = useRef<number>(Date.now() + 5000); // 5 second initial protection
  const searchResultsRef = useRef<PdfSearchMatch[]>([]);
  const pageSearchMatchesRef = useRef<Map<number, PdfSearchMatch[]>>(new Map());
  const searchQueryRef = useRef("");
  const searchStatusRef = useRef<"idle" | "searching" | "ready" | "unavailable">("idle");
  const isSearchableRef = useRef(true);
  const activeSearchMatchIndexRef = useRef(-1);
  const pendingSearchScrollRef = useRef<number | null>(null);
  const searchRequestTokenRef = useRef(0);
  const lastProcessedSearchNavRequestRef = useRef<number | null>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outline, setOutline] = useState<any[]>([]);
  const [showTOC, setShowTOC] = useState(false);
  const [zoomMode, setZoomMode] = useState<ZoomMode>(externalZoomMode || "custom");

  const getHighlightsForPage = useCallback(
    (pageNumberForHighlights: number) =>
      persistedHighlights.filter((highlight) => highlight.pageNumber === pageNumberForHighlights),
    [persistedHighlights],
  );

  // OCR mode manager
  const ocr = usePdfOcrManager();

  // Reset OCR mode when page changes or document unloads
  useEffect(() => {
    if (ocr.flowState !== "idle") {
      ocr.exitOcrMode();
    }
  }, [pageNumber]);  

  // Selection popup state
  const [showSelectionPopup, setShowSelectionPopup] = useState(false);
  const [selectionPopupRect, setSelectionPopupRect] = useState<DOMRect | null>(null);
  const [pendingSelectionContext, setPendingSelectionContext] = useState<PdfSelectionContext | null>(null);
  const [fallbackPageSize, setFallbackPageSize] = useState<{ width: number; height: number } | null>(null);
  const [renderPass, setRenderPass] = useState(0);
  const [textSelectionCapability, setTextSelectionCapability] = useState<PdfTextSelectionCapability>(() =>
    derivePdfTextSelectionCapability(pageTextSelectionAvailabilityRef.current, 0, pageNumber),
  );
  // Lazy loading: track which pages should be rendered
  const [renderedPageRange, setRenderedPageRange] = useState<{ start: number; end: number }>({ start: 1, end: 1 });
  const renderedPageRangeRef = useRef({ start: 1, end: 1 });
  const pendingNavRef = useRef<{ token: number; pageNumber: number; destArray: any[] | null } | null>(null);
  const navModeRef = useRef<NavigationMode>("idle");
  const userScrollLockoutUntilRef = useRef(0);
  const navTokenCounterRef = useRef(0);
  const activeNavTokenRef = useRef<number | null>(null);
  const latestTocRequestTokenRef = useRef<number | null>(null);
  const navSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navSettleStableSinceRef = useRef<number | null>(null);
  const navSettleTargetRef = useRef<{ token: number; targetTop: number; pageNumber: number } | null>(null);
  const pdfNavStabilityEnabledRef = useRef(true);
  const pdfNavStabilityDebugRef = useRef(false);
  const isTauriRuntime = isTauri();

  // Position persistence refs
  const docIdRef = useRef<string>("");
  const lastSavedPositionRef = useRef<DocumentPosition | null>(null);
  const positionSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRestoringPositionRef = useRef(false);

  // Custom PDF selection hook
  const customSelection = usePdfCustomSelection({
    pdf,
    documentId,
    pageContainerRefs,
    pageViewportRefs,
    enabled: ENABLE_CUSTOM_PDF_SELECTION && ocr.flowState === "idle",
    onSelectionChange: (text, context) => {
      // Store the selection context for later use (highlight, etc.)
      setPendingSelectionContext(context);

      // Show popup when there's a selection
      if (text && context) {
        // Get the bounding rect from the selection
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setSelectionPopupRect(rect);
          setShowSelectionPopup(true);
        }
      } else {
        setShowSelectionPopup(false);
        setSelectionPopupRect(null);
      }

      // Call parent callback
      onSelectionChange?.(text, context);
    },
  });

  // Handle highlight creation from popup
  const handleHighlight = useCallback(
    (color: HighlightColor) => {
      if (!pendingSelectionContext) return;
      onHighlightSelection?.(color, customSelection.selectionState.selectedText, pendingSelectionContext);

      // Clear selection after highlighting
      customSelection.clearSelection();
      setShowSelectionPopup(false);
      setPendingSelectionContext(null);
    },
    [customSelection, onHighlightSelection, pendingSelectionContext]
  );

  const handleHighlightWithDialog = useCallback(
    (color: HighlightColor) => {
      if (!pendingSelectionContext) return;
      onHighlightSelectionWithDialog?.(color, customSelection.selectionState.selectedText, pendingSelectionContext);

      customSelection.clearSelection();
      setShowSelectionPopup(false);
      setPendingSelectionContext(null);
    },
    [customSelection, onHighlightSelectionWithDialog, pendingSelectionContext]
  );

  // Handle copy action from popup
  const handleCopy = useCallback(() => {
    // Copy is handled inside SelectionPopup component
    setShowSelectionPopup(false);
    customSelection.clearSelection();
  }, [customSelection]);

  // Handle add note from popup
  const handleAddNote = useCallback(() => {
    // TODO: Implement note modal
    console.log("Add note for selection:", pendingSelectionContext);
    setShowSelectionPopup(false);
  }, [pendingSelectionContext]);

  // Handle popup dismiss
  const handlePopupDismiss = useCallback(() => {
    setShowSelectionPopup(false);
    setPendingSelectionContext(null);
  }, []);

  // Clear selection highlights from all pages
  const clearSelectionHighlights = useCallback(() => {
    selectionHighlightsRef.current.forEach((highlights) => {
      highlights.forEach((el) => el.remove());
    });
    selectionHighlightsRef.current.clear();
  }, []);

  // Pan state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const scrollPositionRef = useRef({ x: 0, y: 0 });

  const highlightConfigRef = useRef<{ query: string; pageNumber: number; textQuote?: string; resolved: boolean } | null>(null);
  useEffect(() => {
    if (highlightQuery && highlightPageNumber) {
      highlightConfigRef.current = {
        query: highlightQuery,
        pageNumber: highlightPageNumber,
        textQuote: highlightTextQuote?.trim() || undefined,
        resolved: false,
      };
    } else {
      highlightConfigRef.current = null;
    }
  }, [highlightQuery, highlightPageNumber, highlightTextQuote]);

  const publishSearchResults = useCallback(
    (overrides?: Partial<{
      query: string;
      totalMatches: number;
      activeMatchIndex: number;
      isSearchable: boolean;
      status: "idle" | "searching" | "ready" | "unavailable";
    }>) => {
      onSearchResultsChange?.({
        query: overrides?.query ?? searchQueryRef.current,
        totalMatches: overrides?.totalMatches ?? searchResultsRef.current.length,
        activeMatchIndex: overrides?.activeMatchIndex ?? activeSearchMatchIndexRef.current,
        isSearchable: overrides?.isSearchable ?? isSearchableRef.current,
        status: overrides?.status ?? searchStatusRef.current,
      });
    },
    [onSearchResultsChange],
  );

  const extractPdfPageText = useCallback(
    async (pdfDoc: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
      if (textCacheRef.current.has(pageNum)) {
        return textCacheRef.current.get(pageNum) ?? "";
      }
      try {
        const page = await pdfDoc.getPage(pageNum);
        const content = await page.getTextContent();
        const text = content.items
          .map((item: any) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        textCacheRef.current.set(pageNum, text);
        return text;
      } catch (err) {
        console.warn("Failed to extract PDF text for page", pageNum, err);
        textCacheRef.current.set(pageNum, "");
        return "";
      }
    },
    [],
  );

  const getSearchHighlightPattern = useCallback((query: string) => {
    const normalized = query.trim().replace(/\s+/g, " ");
    if (!normalized) return null;
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(escaped.replace(/\s+/g, "\\s+"), "gi");
  }, []);

  const applyTextLayerHighlights = useCallback((pageIndex: number) => {
    const root = textLayerRootsRef.current[pageIndex];
    if (!root) return;

    const spans = Array.from(root.querySelectorAll("span"));
    for (const span of spans) {
      const el = span as HTMLElement;
      if (!el.dataset.origHtml) {
        el.dataset.origHtml = el.innerHTML;
      } else {
        el.innerHTML = el.dataset.origHtml;
      }
      delete el.dataset.searchMarkCount;
    }

    const normalizedSearchQuery = searchQueryRef.current.trim();
    const searchRe = normalizedSearchQuery ? getSearchHighlightPattern(normalizedSearchQuery) : null;
    if (searchRe) {
      const pageMatches = pageSearchMatchesRef.current.get(pageIndex + 1) ?? [];
      let pageSearchMarkCount = 0;
      for (const span of spans) {
        const el = span as HTMLElement;
        const text = el.textContent ?? "";
        if (!text) continue;
        if (!searchRe.test(text)) {
          searchRe.lastIndex = 0;
          continue;
        }
        searchRe.lastIndex = 0;
        let localMatchCount = 0;
        el.innerHTML = text.replace(searchRe, (match) => {
          localMatchCount += 1;
          const pageOrder = pageSearchMarkCount;
          pageSearchMarkCount += 1;
          return `<mark class="pdf-search-highlight" data-search-match="true" data-search-match-page-order="${pageOrder}">${match}</mark>`;
        });
        if (localMatchCount > 0) {
          el.dataset.searchMarkCount = String(localMatchCount);
        }
      }

      const activeMatch = searchResultsRef.current[activeSearchMatchIndexRef.current];
      const activePageOrder =
        activeMatch && activeMatch.pageNumber === pageIndex + 1 ? activeMatch.pageMatchIndex : -1;
      const marks = Array.from(root.querySelectorAll("mark[data-search-match='true']")) as HTMLElement[];
      const activeMark = activePageOrder >= 0 ? marks[activePageOrder] : null;
      if (activeMark) {
        activeMark.classList.add("pdf-search-highlight-target");
        if (pendingSearchScrollRef.current === activeSearchMatchIndexRef.current) {
          requestAnimationFrame(() => {
            activeMark.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
            pendingSearchScrollRef.current = null;
          });
        }
      } else if (pageMatches.length === 0 && pendingSearchScrollRef.current === activeSearchMatchIndexRef.current) {
        pendingSearchScrollRef.current = null;
      }
      return;
    }

    const cfg = highlightConfigRef.current;
    if (!cfg) return;
    // Search a window of pages around the estimated page to handle page estimation errors
    if (cfg.resolved && cfg.pageNumber - 1 !== pageIndex) return;
    const pageDelta = Math.abs(pageIndex - (cfg.pageNumber - 1));
    if (pageDelta > 3) return;

    const query = cfg.query.trim();
    if (!query) return;
    const terms = Array.from(new Set(query.split(/\s+/).map((t) => t.trim()).filter((t) => t.length >= 2))).slice(0, 8);
    if (terms.length === 0) return;

    const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const re = new RegExp(`(${escaped.join("|")})`, "gi");

    for (const span of spans) {
      const el = span as HTMLElement;
      const text = el.textContent ?? "";
      if (!re.test(text)) continue;
      re.lastIndex = 0;
      el.innerHTML = text.replace(re, `<mark class="pdf-search-highlight">$1</mark>`);
    }

    const marks = Array.from(root.querySelectorAll("mark.pdf-search-highlight")) as HTMLElement[];
    const normalizedQuote = cfg.textQuote?.toLowerCase();
    const targetMark =
      (normalizedQuote
        ? marks.find((mark) => (mark.textContent ?? "").trim().toLowerCase() === normalizedQuote) ??
          marks.find((mark) => (mark.textContent ?? "").trim().toLowerCase().includes(normalizedQuote))
        : undefined) ??
      marks[0];

    if (!targetMark) return;

    // Mark as resolved so other pages don't also try to highlight
    cfg.resolved = true;
    cfg.pageNumber = pageIndex + 1;

    targetMark.classList.add("pdf-search-highlight-target");
    requestAnimationFrame(() => {
      targetMark.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
    });
  }, [getSearchHighlightPattern]);

  const reapplyVisibleTextLayerHighlights = useCallback(() => {
    textLayerRootsRef.current.forEach((root, pageIndex) => {
      if (root) {
        applyTextLayerHighlights(pageIndex);
      }
    });
  }, [applyTextLayerHighlights]);

  const focusSearchMatch = useCallback(
    (requestedIndex: number, options?: { scroll?: boolean }) => {
      if (searchResultsRef.current.length === 0) {
        activeSearchMatchIndexRef.current = -1;
        publishSearchResults({ activeMatchIndex: -1 });
        return;
      }

      const clampedIndex = Math.max(0, Math.min(requestedIndex, searchResultsRef.current.length - 1));
      activeSearchMatchIndexRef.current = clampedIndex;
      if (options?.scroll !== false) {
        pendingSearchScrollRef.current = clampedIndex;
      }
      publishSearchResults({ activeMatchIndex: clampedIndex });
      reapplyVisibleTextLayerHighlights();

      const target = searchResultsRef.current[clampedIndex];
      if (!target) return;

      if (pageNumber !== target.pageNumber) {
        const token = ++navTokenCounterRef.current;
        activeNavTokenRef.current = token;
        pendingNavRef.current = { token, pageNumber: target.pageNumber, destArray: null };
        isProgrammaticScrollRef.current = true;
        onPageChange?.(target.pageNumber);
        return;
      }

      requestAnimationFrame(() => {
        applyTextLayerHighlights(target.pageNumber - 1);
      });
    },
    [applyTextLayerHighlights, onPageChange, pageNumber, publishSearchResults, reapplyVisibleTextLayerHighlights],
  );

  useEffect(() => {
    reapplyVisibleTextLayerHighlights();
  }, [highlightPageNumber, highlightQuery, highlightTextQuote, reapplyVisibleTextLayerHighlights]);

  useEffect(() => {
    if (!highlightPageNumber) return;
    restoredPageRef.current = highlightPageNumber;
    restorationWindowRef.current = Date.now() + 2500;
  }, [highlightPageNumber, highlightQuery, highlightTextQuote]);

  const publishTextSelectionCapability = useCallback(
    (availability: ReadonlyMap<number, boolean>, totalPagesOverride?: number) => {
      const capability = derivePdfTextSelectionCapability(
        availability,
        totalPagesOverride ?? numPages,
        pageNumber,
      );
      setTextSelectionCapability(capability);
      onTextSelectionCapabilityChange?.(capability);
    },
    [numPages, onTextSelectionCapabilityChange, pageNumber],
  );

  const setPageTextSelectionAvailability = useCallback(
    (pageNum: number, hasSelectableText: boolean) => {
      const current = pageTextSelectionAvailabilityRef.current;
      if (current.get(pageNum) === hasSelectableText) return;
      const next = new Map(current);
      next.set(pageNum, hasSelectableText);
      pageTextSelectionAvailabilityRef.current = next;
      publishTextSelectionCapability(next);
    },
    [publishTextSelectionCapability],
  );

  // Update zoom mode when external prop changes
  useEffect(() => {
    if (externalZoomMode) {
      setZoomMode(externalZoomMode);
    }
  }, [externalZoomMode]);

  useEffect(() => {
    try {
      const value = localStorage.getItem(PDF_NAV_STABILITY_FLAG_KEY);
      if (value === "0" || value === "false") {
        pdfNavStabilityEnabledRef.current = false;
      } else if (value === "1" || value === "true") {
        pdfNavStabilityEnabledRef.current = true;
      }
    } catch {
      pdfNavStabilityEnabledRef.current = true;
    }
    try {
      const debugValue = localStorage.getItem(PDF_NAV_STABILITY_DEBUG_KEY);
      pdfNavStabilityDebugRef.current = debugValue === "1" || debugValue === "true";
    } catch {
      pdfNavStabilityDebugRef.current = false;
    }
  }, []);

  // Disable browser-native scroll restoration to prevent "bouncing" during PDF load.
  // Without this, the browser tries to restore scroll position before the PDF has rendered,
  // causing the viewport to bounce between browser-attempted and app-controlled positions.
  useEffect(() => {
    const previous = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    if (pdfNavStabilityDebugRef.current) {
      console.debug("[PDFViewer] Disabled browser scroll restoration (was:", previous, ")");
    }
    return () => {
      history.scrollRestoration = (previous as ScrollRestoration) || 'auto';
    };
  }, []);

  const logNav = useCallback((event: string, details?: Record<string, unknown>) => {
    if (!pdfNavStabilityEnabledRef.current || !pdfNavStabilityDebugRef.current) return;
    console.debug("[PDFViewer][nav]", event, details ?? {});
  }, []);

  const setNavigationMode = useCallback((mode: NavigationMode, reason: string) => {
    if (!pdfNavStabilityEnabledRef.current) return;
    if (navModeRef.current === mode) return;
    const previous = navModeRef.current;
    navModeRef.current = mode;
    logNav("mode-transition", { from: previous, to: mode, reason });
  }, [logNav]);

  const markUserScrollOwnership = useCallback((reason: string) => {
    if (!pdfNavStabilityEnabledRef.current) return;
    userScrollLockoutUntilRef.current = Date.now() + USER_SCROLL_LOCKOUT_MS;
    setNavigationMode("user-scroll", reason);
    logNav("lockout-armed", { until: userScrollLockoutUntilRef.current, reason });
  }, [logNav, setNavigationMode]);

  const clearNavigationSettleTimeout = useCallback(() => {
    if (navSettleTimeoutRef.current) {
      clearTimeout(navSettleTimeoutRef.current);
      navSettleTimeoutRef.current = null;
    }
    navSettleStableSinceRef.current = null;
    navSettleTargetRef.current = null;
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadPDF = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const loadDocument = async () => {
          // In WebKitGTK/Tauri, embedded fonts in some PDFs can trigger excessive glyph parsing.
          // Use path-based font rendering for better stability, but keep worker enabled first.
          const shouldDisableFontFace = isTauriRuntime;
          const sources = createPdfLoadSourceFactories({
            fileUrl,
            fileData,
            disableFontFace: shouldDisableFontFace,
          });

          if (sources.length === 0) {
            throw new Error("No PDF source available.");
          }

          let lastError: unknown = null;
          for (const sourceFactory of sources) {
            try {
              const source = sourceFactory.create();
              const loadingTask = pdfjsLib.getDocument(source as any);
              return await loadingTask.promise;
            } catch (workerError) {
              // Some packaged runtimes fail to initialize the PDF worker.
              // Retry without a worker so PDFs still render. Create a fresh source:
              // PDF.js may detach data buffers while trying to transfer them to its worker.
              try {
                console.warn("[PDFViewer] Worker/source load failed, retrying with disableWorker=true:", workerError);
                const source = sourceFactory.create();
                const fallbackTask = pdfjsLib.getDocument({ ...(source as any), disableWorker: true } as any);
                return await fallbackTask.promise;
              } catch (fallbackError) {
                lastError = fallbackError;
              }
            }
          }
          throw lastError ?? new Error("Failed to load PDF from all sources.");
        };

        const pdfDoc = await loadDocument();

        if (!mounted) return;

        pageTextSelectionAvailabilityRef.current = new Map();
        const initialCapability = derivePdfTextSelectionCapability(
          pageTextSelectionAvailabilityRef.current,
          pdfDoc.numPages,
          1,
        );
        setTextSelectionCapability(initialCapability);
        onTextSelectionCapabilityChange?.(initialCapability);
        setPdf(pdfDoc);
        onPdfInfo?.({ fingerprint: (pdfDoc as any).fingerprint ?? null });
        textCacheRef.current.clear();
        pageOffsetsRef.current = [];
        setNumPages(pdfDoc.numPages);
        try {
          const first = await pdfDoc.getPage(1);
          const vp = first.getViewport({ scale: 1 });
          setFallbackPageSize({ width: vp.width, height: vp.height });
        } catch {
          setFallbackPageSize(null);
        }
        // Clear and initialize rendered pages tracking
        renderedPagesRef.current.clear();
        // Windowed rendering: start with a small range around the initial page.
        const initialBuffer = 2;
        const start = Math.max(1, pageNumber - initialBuffer);
        const end = Math.min(pdfDoc.numPages, pageNumber + initialBuffer);
        setRenderedPageRange({ start, end });
        renderedPageRangeRef.current = { start, end };
        onLoad?.(pdfDoc.numPages, []);

        // Get outline (table of contents)
        const outlineData = await pdfDoc.getOutline();
        if (outlineData) {
          setOutline(outlineData);
        }

      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load PDF");
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadPDF();

    return () => {
      mounted = false;
    };
    // Note: onLoad is intentionally excluded from deps - it's a callback that
    // shouldn't trigger reloading the PDF source.
  }, [fileData, fileUrl, isTauriRuntime, onTextSelectionCapabilityChange]);

  useEffect(() => {
    publishTextSelectionCapability(pageTextSelectionAvailabilityRef.current);
  }, [numPages, pageNumber, publishTextSelectionCapability]);

  // Update rendered page window around the current page.
  useEffect(() => {
    if (!pdf || numPages <= 0) return;
    const buffer = 2;
    const start = Math.max(1, pageNumber - buffer);
    const end = Math.min(numPages, pageNumber + buffer);
    const current = renderedPageRangeRef.current;
    if (current.start === start && current.end === end) return;
    setRenderedPageRange({ start, end });
  }, [pdf, numPages, pageNumber]);

  // Store documentId in ref for use in callbacks
  useEffect(() => {
    docIdRef.current = documentId;
  }, [documentId]);

  // Save reading position to localStorage and backend
  const saveReadingPosition = useCallback(async (position: DocumentPosition) => {
    const docId = docIdRef.current;
    if (!docId) return;

    // Avoid redundant saves
    const lastSaved = lastSavedPositionRef.current;
    if (lastSaved && JSON.stringify(lastSaved) === JSON.stringify(position)) {
      return;
    }

    console.log("[PDFViewer] Saving reading position:", { docId, position });

    // Save to localStorage as backup
    localStorage.setItem(`pdf-position-${docId}`, JSON.stringify(position));

    // Save to backend
    try {
      await saveDocumentPosition(docId, position);
      
      // Also update document progress if it's a page position
      if (position.type === 'page') {
        await updateDocumentProgressAuto(docId, null, position.page, null);
      }
      
      lastSavedPositionRef.current = position;
    } catch (err) {
      console.warn("[PDFViewer] Failed to save position to backend:", err);
    }
  }, []);

  // Debounced save for scroll events
  const debouncedSavePosition = useCallback((position: DocumentPosition) => {
    if (positionSaveTimeoutRef.current) {
      clearTimeout(positionSaveTimeoutRef.current);
    }
    positionSaveTimeoutRef.current = setTimeout(() => {
      saveReadingPosition(position);
    }, 500);
  }, [saveReadingPosition]);

  // Load reading position from backend or localStorage
  const loadReadingPosition = useCallback(async (): Promise<DocumentPosition | null> => {
    const docId = docIdRef.current;
    if (!docId) return null;

    // Try backend first
    try {
      const remotePosition = await getDocumentPosition(docId);
      if (remotePosition) {
        console.log("[PDFViewer] Loaded position from backend:", remotePosition);
        return remotePosition;
      }
    } catch (err) {
      console.warn("[PDFViewer] Failed to load position from backend:", err);
    }

    // Fall back to localStorage
    const localData = localStorage.getItem(`pdf-position-${docId}`);
    if (localData) {
      try {
        const position = JSON.parse(localData) as DocumentPosition;
        console.log("[PDFViewer] Loaded position from localStorage:", position);
        return position;
      } catch (e) {
        console.warn("[PDFViewer] Failed to parse localStorage position:", e);
      }
    }

    // Try legacy format (just page number stored in document)
    try {
      const doc = await getDocumentAuto(docId);
      if (doc?.current_page && doc.current_page > 1) {
        console.log("[PDFViewer] Using legacy current_page from document:", doc.current_page);
        return pagePosition(doc.current_page);
      }
    } catch (err) {
      console.warn("[PDFViewer] Failed to load document data:", err);
    }

    return null;
  }, []);

  // Restore position when PDF loads (fallback when no explicit restoreState)
  useEffect(() => {
    if (!pdf || numPages === 0) return;
    if (restoreState) return;

    const restorePosition = async () => {
      isRestoringPositionRef.current = true;

      const position = await loadReadingPosition();
      if (!position) {
        isRestoringPositionRef.current = false;
        return;
      }

      console.log("[PDFViewer] Restoring position:", position);

      const attemptRestore = (attempt: number) => {
        const container = scrollContainerRef.current;
        if (!container) {
          isRestoringPositionRef.current = false;
          return;
        }

        let targetPage = 1;
        let targetScrollTop = 0;
        let ready = true;

        if (position.type === 'page') {
          targetPage = Math.max(1, Math.min(position.page, numPages));
          const pageIndex = targetPage - 1;
          const pageEl = pageContainerRefs.current[pageIndex];
          if (!pageEl || pageEl.offsetHeight === 0) {
            ready = false;
          } else if (position.offset !== undefined && position.offset > 0) {
            targetScrollTop = pageEl.offsetTop + (pageEl.offsetHeight * position.offset);
          } else {
            targetScrollTop = Math.max(0, pageEl.offsetTop - 16);
          }
        } else if (position.type === 'scroll') {
          const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
          if (maxScroll <= 0) {
            ready = false;
          } else {
            targetScrollTop = (position.percent / 100) * maxScroll;
          }

          if (ready) {
            for (let i = 0; i < pageContainerRefs.current.length; i++) {
              const pageEl = pageContainerRefs.current[i];
              if (!pageEl || pageEl.offsetHeight === 0) {
                ready = false;
                break;
              }
              if (pageEl.offsetTop - 24 <= targetScrollTop) {
                targetPage = i + 1;
              } else {
                break;
              }
            }
          }
        }

        if (!ready) {
          if (attempt < 15) {
            setTimeout(() => attemptRestore(attempt + 1), 200);
          } else {
            isRestoringPositionRef.current = false;
          }
          return;
        }

        restoredPageRef.current = targetPage;
        restorationWindowRef.current = Date.now() + 2000;

        if (targetPage !== pageNumber) {
          onPageChange?.(targetPage);
        }

        setTimeout(() => {
          const activeContainer = scrollContainerRef.current;
          if (activeContainer) {
            if (shouldSuppressProgrammaticScroll({
              enabled: pdfNavStabilityEnabledRef.current,
              source: "restore",
              now: Date.now(),
              lockoutUntil: userScrollLockoutUntilRef.current,
              activeToken: activeNavTokenRef.current,
            })) {
              logNav("initial-restore-suppressed-by-user-lockout", {
                targetPage,
                lockoutUntil: userScrollLockoutUntilRef.current,
              });
              isRestoringPositionRef.current = false;
              return;
            }
            if (pdfNavStabilityEnabledRef.current) {
              setNavigationMode("programmatic-nav", "initial-restore");
            }
            isProgrammaticScrollRef.current = true;
            activeContainer.scrollTop = targetScrollTop;
            console.log("[PDFViewer] Scrolled to position:", {
              targetPage,
              targetScrollTop,
              scrollRestoration: history.scrollRestoration,
              containerReady: activeContainer.scrollHeight > 0,
            });

            setTimeout(() => {
              isProgrammaticScrollRef.current = false;
              if (pdfNavStabilityEnabledRef.current && activeNavTokenRef.current === null) {
                if (Date.now() >= userScrollLockoutUntilRef.current) {
                  setNavigationMode("idle", "initial-restore-complete");
                }
              }
              isRestoringPositionRef.current = false;
            }, 300);
          } else {
            isRestoringPositionRef.current = false;
          }
        }, 100);
      };

      attemptRestore(0);
    };

    const timeout = setTimeout(restorePosition, 500);
    return () => clearTimeout(timeout);
  }, [
    loadReadingPosition,
    logNav,
    numPages,
    onPageChange,
    pageNumber,
    pdf,
    restoreState,
    setNavigationMode,
  ]);

  // Cleanup on unmount: cancel all render tasks, text layers, highlights, and timeouts.
  useEffect(() => {
    return () => {
      if (positionSaveTimeoutRef.current) {
        clearTimeout(positionSaveTimeoutRef.current);
      }
      clearNavigationSettleTimeout();
      // Clear selection highlights on unmount
      clearSelectionHighlights();
      // Cancel any in-flight PDF render tasks and text layer builders
      // to prevent "parentNode is null" errors when the DOM is detached.
      for (let i = 0; i < renderTasksRef.current.length; i++) {
        try { renderTasksRef.current[i]?.cancel(); } catch { /* ignore */ }
      }
      for (let i = 0; i < textLayerBuildersRef.current.length; i++) {
        try { textLayerBuildersRef.current[i]?.cancel(); } catch { /* ignore */ }
      }
      for (let i = 0; i < textLayerTimeoutsRef.current.length; i++) {
        if (textLayerTimeoutsRef.current[i] != null) clearTimeout(textLayerTimeoutsRef.current[i]!);
      }
    };
  }, [clearNavigationSettleTimeout, clearSelectionHighlights]);

  useEffect(() => {
    if (!pdf || numPages <= 0) return;
    // Any zoom change invalidates previous renders (especially fit-width/page).
    renderedPagesRef.current.clear();
    recomputePageOffsets();
  }, [scale, zoomMode, numPages, pdf]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!pdf || numPages <= 0) return;
      const renderId = ++renderIdRef.current;
      // Use state directly; the ref can lag a render behind and cause blank pages until the next update.
      renderedPageRangeRef.current = renderedPageRange;
      const { start, end } = renderedPageRange;
      let needsRetry = false;

      for (let i = start; i <= end; i += 1) {
        if (!mounted || renderId !== renderIdRef.current) return;
        if (renderedPagesRef.current.has(i)) continue;
        try {
          const ok = await renderPage(pdf, i);
          if (ok) {
            renderedPagesRef.current.add(i);
          } else {
            needsRetry = true;
          }
        } catch (err: any) {
          // Swallow errors from pages whose DOM was detached during render
          // (e.g. component unmount, view mode switch). Common in pdf.js when
          // canvas/textLayer.parentNode is null due to React cleanup.
          if (!mounted) return;
          console.warn(`[PDFViewer] Page ${i} render error:`, err?.message || err);
        }
      }

      // Signal "ready enough" once we rendered the current window.
      if (mounted && renderId === renderIdRef.current) {
        onPagesRendered?.();
      }

      // If refs were not ready for some pages, retry shortly.
      if (mounted && renderId === renderIdRef.current && needsRetry) {
        setTimeout(() => {
          if (mounted) setRenderPass((v) => v + 1);
        }, 50);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
    // Note: onPagesRendered is intentionally excluded from deps (callback identity).
  }, [pdf, numPages, renderedPageRange, scale, zoomMode, renderPass]);

  // Sync renderedPageRangeRef when state changes
  useEffect(() => {
    renderedPageRangeRef.current = renderedPageRange;
  }, [renderedPageRange]);

  useEffect(() => {
    if (!pdf || !onTextWindowChange) return;

    const start = Math.max(1, pageNumber - contextPageWindow);
    const end = Math.min(pdf.numPages, pageNumber + contextPageWindow);
    textWindowRef.current = { start, end };

    const updateWindow = () => {
      const { start: windowStart, end: windowEnd } = textWindowRef.current;
      const chunks: string[] = [];
      for (let page = windowStart; page <= windowEnd; page += 1) {
        const cached = textCacheRef.current.get(page);
        if (cached) {
          chunks.push(cached);
        }
      }
      if (chunks.length > 0) {
        onTextWindowChange(chunks.join("\n\n"));
      }
    };

    const extractPageText = async (pageNum: number) => {
      const text = await extractPdfPageText(pdf, pageNum);
      if (text) {
        updateWindow();
      }
    };

    updateWindow();
    for (let page = start; page <= end; page += 1) {
      void extractPageText(page);
    }
    // Note: onTextWindowChange is intentionally excluded from deps - callbacks
    // shouldn't trigger effect re-runs, only data changes should
  }, [contextPageWindow, extractPdfPageText, onTextWindowChange, pageNumber, pdf]);

  useEffect(() => {
    searchQueryRef.current = searchQuery?.trim() ?? "";
    const requestToken = ++searchRequestTokenRef.current;

    if (!pdf || numPages <= 0) {
      searchResultsRef.current = [];
      pageSearchMatchesRef.current = new Map();
      activeSearchMatchIndexRef.current = -1;
      pendingSearchScrollRef.current = null;
      searchStatusRef.current = "idle";
      isSearchableRef.current = true;
      publishSearchResults({
        query: searchQueryRef.current,
        totalMatches: 0,
        activeMatchIndex: -1,
        isSearchable: true,
        status: "idle",
      });
      reapplyVisibleTextLayerHighlights();
      return;
    }

    if (!searchQueryRef.current) {
      searchResultsRef.current = [];
      pageSearchMatchesRef.current = new Map();
      activeSearchMatchIndexRef.current = -1;
      pendingSearchScrollRef.current = null;
      searchStatusRef.current = "idle";
      isSearchableRef.current = true;
      publishSearchResults({
        query: "",
        totalMatches: 0,
        activeMatchIndex: -1,
        isSearchable: true,
        status: "idle",
      });
      reapplyVisibleTextLayerHighlights();
      return;
    }

    const queryPattern = getSearchHighlightPattern(searchQueryRef.current);
    searchStatusRef.current = "searching";
    publishSearchResults({
      query: searchQueryRef.current,
      totalMatches: searchResultsRef.current.length,
      activeMatchIndex: activeSearchMatchIndexRef.current,
      isSearchable: isSearchableRef.current,
      status: "searching",
    });

    const run = async () => {
      const nextResults: PdfSearchMatch[] = [];
      const matchesByPage = new Map<number, PdfSearchMatch[]>();
      let anySearchableText = false;

      for (let page = 1; page <= numPages; page += 1) {
        const text = await extractPdfPageText(pdf, page);
        if (requestToken !== searchRequestTokenRef.current) {
          return;
        }
        if (text) {
          anySearchableText = true;
        }
        if (!text || !queryPattern) {
          continue;
        }

        const pageMatches: PdfSearchMatch[] = [];
        let match: RegExpExecArray | null;
        while ((match = queryPattern.exec(text)) !== null) {
          const result: PdfSearchMatch = {
            pageNumber: page,
            pageMatchIndex: pageMatches.length,
            globalIndex: nextResults.length,
          };
          pageMatches.push(result);
          nextResults.push(result);
          if (match[0].length === 0) {
            queryPattern.lastIndex += 1;
          }
        }
        queryPattern.lastIndex = 0;
        if (pageMatches.length > 0) {
          matchesByPage.set(page, pageMatches);
        }
      }

      if (requestToken !== searchRequestTokenRef.current) {
        return;
      }

      searchResultsRef.current = nextResults;
      pageSearchMatchesRef.current = matchesByPage;
      isSearchableRef.current = anySearchableText;
      searchStatusRef.current = anySearchableText ? "ready" : "unavailable";

      const nextActiveIndex = nextResults.length > 0 ? 0 : -1;
      activeSearchMatchIndexRef.current = nextActiveIndex;
      pendingSearchScrollRef.current = nextActiveIndex >= 0 ? nextActiveIndex : null;

      publishSearchResults({
        query: searchQueryRef.current,
        totalMatches: nextResults.length,
        activeMatchIndex: nextActiveIndex,
        isSearchable: anySearchableText,
        status: searchStatusRef.current,
      });
      reapplyVisibleTextLayerHighlights();

      if (nextActiveIndex >= 0) {
        focusSearchMatch(nextActiveIndex);
      }
    };

    void run();
  }, [
    extractPdfPageText,
    focusSearchMatch,
    getSearchHighlightPattern,
    numPages,
    pdf,
    publishSearchResults,
    reapplyVisibleTextLayerHighlights,
    searchQuery,
  ]);

  useEffect(() => {
    if (!searchNavigationRequest) return;
    if (lastProcessedSearchNavRequestRef.current === searchNavigationRequest.requestId) return;
    lastProcessedSearchNavRequestRef.current = searchNavigationRequest.requestId;

    if (searchResultsRef.current.length === 0) {
      publishSearchResults({ activeMatchIndex: -1 });
      return;
    }

    const currentIndex = activeSearchMatchIndexRef.current >= 0 ? activeSearchMatchIndexRef.current : 0;
    if (typeof searchNavigationRequest.targetIndex === "number") {
      focusSearchMatch(searchNavigationRequest.targetIndex);
      return;
    }

    if (searchNavigationRequest.direction === "previous") {
      focusSearchMatch((currentIndex - 1 + searchResultsRef.current.length) % searchResultsRef.current.length);
      return;
    }

    focusSearchMatch((currentIndex + 1) % searchResultsRef.current.length);
  }, [focusSearchMatch, publishSearchResults, searchNavigationRequest]);

  // ResizeObserver to handle container resize (e.g., when assistant panel is resized)
  useEffect(() => {
    if (!pdf || !scrollContainerRef.current) return;

    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    let animationFrameId: number | null = null;

    const resizeObserver = new ResizeObserver(() => {
      // Use requestAnimationFrame to avoid "loop completed with undelivered notifications" error
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      animationFrameId = requestAnimationFrame(() => {
        // Debounce resize calls to avoid excessive re-renders
        if (resizeTimeout) {
          clearTimeout(resizeTimeout);
        }
        resizeTimeout = setTimeout(async () => {
          const container = scrollContainerRef.current;
          if (!container) return;

          // Skip resize handling while scroll position restoration is in progress
          // suppressAutoScroll is controlled by DocumentViewer and stays true until restoration completes
          if (suppressAutoScroll) {
            return;
          }

          // Also skip during protection windows
          const now = Date.now();
          const isInInitialLoadWindow = now < initialLoadWindowRef.current;
          const isInRestorationWindow = now < restorationWindowRef.current;
          if (isInInitialLoadWindow || isInRestorationWindow) {
            return;
          }

          if (pdf && (zoomMode === "fit-width" || zoomMode === "fit-page")) {
            // Save current scroll position before re-render
            const scrollTop = container.scrollTop;
            const scrollHeight = container.scrollHeight;
            const scrollPercent = scrollHeight > 0 ? scrollTop / scrollHeight : 0;

            // Re-render only a small window to keep resize responsive.
            const renderId = ++renderIdRef.current;
            renderedPagesRef.current.clear();
            const { start, end } = renderedPageRangeRef.current;
            for (let i = start; i <= end; i += 1) {
              if (renderId !== renderIdRef.current) {
                return;
              }
              try {
                const ok = await renderPage(pdf, i);
                if (ok) renderedPagesRef.current.add(i);
              } catch {
                // Swallow render errors on detached DOM during resize re-render
              }
            }

            // Restore scroll position after re-render (based on percentage)
            if (container.scrollHeight > 0 && scrollPercent > 0) {
              if (shouldSuppressProgrammaticScroll({
                enabled: pdfNavStabilityEnabledRef.current,
                source: "resize",
                now: Date.now(),
                lockoutUntil: userScrollLockoutUntilRef.current,
                activeToken: activeNavTokenRef.current,
              })) {
                logNav("resize-scroll-restore-suppressed", {
                  scrollPercent,
                  lockoutUntil: userScrollLockoutUntilRef.current,
                });
                return;
              }
              const newScrollTop = scrollPercent * container.scrollHeight;
              if (pdfNavStabilityEnabledRef.current) {
                setNavigationMode("programmatic-nav", "resize-restore");
              }
              container.scrollTop = newScrollTop;
              if (pdfNavStabilityEnabledRef.current) {
                isProgrammaticScrollRef.current = true;
                window.setTimeout(() => {
                  if (activeNavTokenRef.current === null) {
                    isProgrammaticScrollRef.current = false;
                    if (Date.now() >= userScrollLockoutUntilRef.current) {
                      setNavigationMode("idle", "resize-restore-complete");
                    }
                  }
                }, 200);
              }
            }
          }
        }, 100);
      });
    });

    resizeObserver.observe(scrollContainerRef.current);
    // Also observe outer container to catch width changes from assistant panel show/hide
    if (outerContainerRef.current) {
      resizeObserver.observe(outerContainerRef.current);
    }

    return () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      resizeObserver.disconnect();
    };
  }, [pdf, pageNumber, zoomMode, suppressAutoScroll]);

  const buildPdfSelectionContext = useCallback((): PdfSelectionContext | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

    const textLayers = textLayerRootsRef.current.filter(Boolean) as HTMLDivElement[];
    if (textLayers.length === 0) return null;
    if (!selectionAnchorsInTextLayers(selection, textLayers)) return null;
    if (!selectionIntersectsTextLayers(selection, textLayers)) return null;

    const text = selection.toString().trim();
    if (!text) return null;

    const range = selection.getRangeAt(0);
    const rects = Array.from(range.getClientRects())
      .filter((rect) => rect.width > 0 && rect.height > 0);

    if (rects.length === 0) return null;

    const pages = new Map<number, { pageNumber: number; viewportRects: ViewportRect[]; pdfRects: PdfRect[] }>();

    rects.forEach((rect) => {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      for (let i = 0; i < pageContainerRefs.current.length; i += 1) {
        const pageEl = pageContainerRefs.current[i];
        const viewport = pageViewportRefs.current[i];
        if (!pageEl || !viewport) continue;
        const bounds = pageEl.getBoundingClientRect();
        if (centerX < bounds.left || centerX > bounds.right || centerY < bounds.top || centerY > bounds.bottom) {
          continue;
        }

        const viewportRect = {
          left: rect.left - bounds.left,
          top: rect.top - bounds.top,
          width: rect.width,
          height: rect.height,
        };
        const [x1, y1] = viewport.convertToPdfPoint(viewportRect.left, viewportRect.top);
        const [x2, y2] = viewport.convertToPdfPoint(
          viewportRect.left + viewportRect.width,
          viewportRect.top + viewportRect.height
        );
        const pdfRect = { x1, y1, x2, y2 };

        const pageNumber = i + 1;
        if (!pages.has(pageNumber)) {
          pages.set(pageNumber, { pageNumber, viewportRects: [], pdfRects: [] });
        }
        pages.get(pageNumber)?.viewportRects.push(viewportRect);
        pages.get(pageNumber)?.pdfRects.push(pdfRect);
        break;
      }
    });

    if (pages.size === 0) return null;

    return {
      type: "pdf",
      documentId,
      fingerprint: (pdf as any)?.fingerprint ?? null,
      pages: Array.from(pages.values()).sort((a, b) => a.pageNumber - b.pageNumber),
    };
  }, [documentId, pdf]);

  // Draw selection highlights based on current selection
  const updateSelectionHighlights = useCallback(() => {
    clearSelectionHighlights();
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }

    const range = selection.getRangeAt(0);
    const rects = Array.from(range.getClientRects());
    
    rects.forEach((rect) => {
      if (rect.width === 0 || rect.height === 0) return;
      
      // Find which page this rect belongs to
      for (let i = 0; i < pageContainerRefs.current.length; i++) {
        const pageEl = pageContainerRefs.current[i];
        if (!pageEl) continue;
        
        const pageRect = pageEl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Check if rect is within this page
        if (centerX >= pageRect.left && centerX <= pageRect.right &&
            centerY >= pageRect.top && centerY <= pageRect.bottom) {
          
          // Create highlight element
          const highlight = document.createElement("div");
          highlight.className = "pdf-selection-highlight";
          highlight.style.position = "absolute";
          highlight.style.left = `${rect.left - pageRect.left}px`;
          highlight.style.top = `${rect.top - pageRect.top}px`;
          highlight.style.width = `${rect.width}px`;
          highlight.style.height = `${rect.height}px`;
          highlight.style.backgroundColor = "rgba(59, 130, 246, 0.4)";
          highlight.style.pointerEvents = "none";
          highlight.style.zIndex = "5";
          highlight.style.borderRadius = "2px";
          
          pageEl.appendChild(highlight);
          
          if (!selectionHighlightsRef.current.has(i)) {
            selectionHighlightsRef.current.set(i, []);
          }
          selectionHighlightsRef.current.get(i)?.push(highlight);
          break;
        }
      }
    });
  }, [clearSelectionHighlights]);

  // Handle text selection changes (native DOM selection - disabled when custom selection is active)
  useEffect(() => {
    // Skip native selection handling when custom selection is enabled
    if (ENABLE_CUSTOM_PDF_SELECTION) return;
    if (!onSelectionChange) return;
    let rafId: number | null = null;
    let isProcessingSelection = false;

    const handleSelectionChange = () => {
      if (isProcessingSelection) return;
      if (rafId !== null) return;
      
      rafId = requestAnimationFrame(() => {
        rafId = null;
        isProcessingSelection = true;
        
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
          if (lastSelectionWasPdfRef.current) {
            lastSelectionWasPdfRef.current = false;
            clearSelectionHighlights();
            onSelectionChange("", null);
          }
          isProcessingSelection = false;
          return;
        }

        const textLayers = textLayerRootsRef.current.filter(Boolean) as HTMLDivElement[];
        const isInPdf =
          textLayers.length > 0 &&
          selectionAnchorsInTextLayers(selection, textLayers) &&
          selectionIntersectsTextLayers(selection, textLayers);

        if (!isInPdf) {
          if (lastSelectionWasPdfRef.current) {
            lastSelectionWasPdfRef.current = false;
            clearSelectionHighlights();
            onSelectionChange("", null);
          }
          isProcessingSelection = false;
          return;
        }

        const context = buildPdfSelectionContext();
        if (!context) {
          if (lastSelectionWasPdfRef.current) {
            lastSelectionWasPdfRef.current = false;
            clearSelectionHighlights();
            onSelectionChange("", null);
          }
          isProcessingSelection = false;
          return;
        }

        const text = selection.toString().trim();
        if (!text) {
          if (lastSelectionWasPdfRef.current) {
            lastSelectionWasPdfRef.current = false;
            clearSelectionHighlights();
            onSelectionChange("", null);
          }
          isProcessingSelection = false;
          return;
        }
        
        lastSelectionWasPdfRef.current = true;
        
        // Update visual highlights
        updateSelectionHighlights();
        
        onSelectionChange(text, context);
        isProcessingSelection = false;
      });
    };

    // Handle mouse up to capture selection end
    const handleMouseUp = () => {
      // Small delay to let selection finalize
      setTimeout(handleSelectionChange, 50);
    };

    // Clear highlights only when starting interaction away from text.
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer || !scrollContainer.contains(target)) return;
      const clickedTextLayer = textLayerRootsRef.current.some(
        (layer) => layer && (layer === target || layer.contains(target)),
      );
      if (clickedTextLayer) return;
      const hasNativeSelection = Boolean(window.getSelection()?.toString().trim());
      if (!hasNativeSelection) {
        clearSelectionHighlights();
        if (lastSelectionWasPdfRef.current) {
          lastSelectionWasPdfRef.current = false;
          onSelectionChange("", null);
        }
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mouseup", handleMouseUp);
    
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mouseup", handleMouseUp);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [onSelectionChange, buildPdfSelectionContext, clearSelectionHighlights, updateSelectionHighlights]);

  const renderPage = async (pdfDoc: pdfjsLib.PDFDocumentProxy, pageNum: number): Promise<boolean> => {
    const page = await pdfDoc.getPage(pageNum);
    const pageIndex = pageNum - 1;
    const canvas = canvasRefs.current[pageIndex];
    const textLayerContainer = textLayerContainerRefs.current[pageIndex];
    const pageContainer = pageContainerRefs.current[pageIndex];
    const scrollContainer = scrollContainerRef.current;

    // If the page DOM hasn't mounted yet, let the caller retry later.
    if (!canvas || !textLayerContainer || !pageContainer) return false;

    const context = canvas.getContext("2d");
    if (!context) return false;

    // Calculate scale based on zoom mode
    let actualScale = scale;
    if (zoomMode === "fit-width") {
      const viewport = page.getViewport({ scale: 1 });
      const containerWidth = (scrollContainer?.clientWidth ?? pageContainer.clientWidth) - 32; // padding
      if (containerWidth > 0) {
        actualScale = containerWidth / viewport.width;
      }
    } else if (zoomMode === "fit-page") {
      const viewport = page.getViewport({ scale: 1 });
      const containerWidth = (scrollContainer?.clientWidth ?? pageContainer.clientWidth) - 32;
      const containerHeight = (scrollContainer?.clientHeight ?? pageContainer.clientHeight) - 32;
      if (containerWidth > 0 && containerHeight > 0) {
        const scaleWidth = containerWidth / viewport.width;
        const scaleHeight = containerHeight / viewport.height;
        actualScale = Math.min(scaleWidth, scaleHeight);
      }
    }

    const viewport = page.getViewport({ scale: actualScale });
    pageViewportRefs.current[pageIndex] = viewport;
    pageScaleRefs.current[pageIndex] = actualScale;
    // Cap outputScale at 2x to avoid enormous canvases on 3x/4x displays;
    // PDF text stays sharp because it's vector-rasterized at render time.
    const rawDpr = window.devicePixelRatio || 1;
    const outputScale = Math.min(rawDpr, 2);
    // Cap canvas pixel count to ~16 megapixels (4096×4096) to prevent
    // GPU memory spikes on large pages at high zoom.
    const MAX_CANVAS_PIXELS = 4096 * 4096;
    let canvasW = Math.floor(viewport.width * outputScale);
    let canvasH = Math.floor(viewport.height * outputScale);
    if (canvasW * canvasH > MAX_CANVAS_PIXELS) {
      const downscale = Math.sqrt(MAX_CANVAS_PIXELS / (canvasW * canvasH));
      canvasW = Math.floor(canvasW * downscale);
      canvasH = Math.floor(canvasH * downscale);
    }
    canvas.width = canvasW;
    canvas.height = canvasH;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    pageContainer.style.width = `${viewport.width}px`;
    pageContainer.style.height = `${viewport.height}px`;

    // Cancel any previous render task for this page BEFORE clearing DOM,
    // so PDF.js internal cleanup (annotation layers etc.) can access
    // still-attached DOM nodes without "parentNode is null" errors.
    const previousTask = renderTasksRef.current[pageIndex];
    if (previousTask) {
      try {
        previousTask.cancel();
      } catch {
        // Ignore cancel errors
      }
      renderTasksRef.current[pageIndex] = null;
    }

    // Cancel any pending text layer build (deferred via setTimeout) AND any
    // in-flight text layer render BEFORE clearing innerHTML.  If we clear the
    // DOM first, pdfjs's TextLayer.#processItems will dereference a detached
    // node ("this.#container.parentNode is null") and crash.
    //
    // NOTE: textLayer.cancel() is async — it cancels the reader stream but
    // #processItems may already be mid-execution in the current microtask.
    // We delay the innerHTML clear to the next microtask so the in-flight
    // pump callback finishes before the container is emptied.
    const pendingTimeout = textLayerTimeoutsRef.current[pageIndex];
    if (pendingTimeout != null) {
      clearTimeout(pendingTimeout);
      textLayerTimeoutsRef.current[pageIndex] = null;
    }
    const prevTextLayer = textLayerBuildersRef.current[pageIndex];
    textLayerBuildersRef.current[pageIndex] = null;
    if (prevTextLayer) {
      try { prevTextLayer.cancel(); } catch { /* ignore */ }
      // Yield to the macrotask queue so the cancelled reader's rejection
      // propagates and any in-flight #processItems call completes.
      // (reader.cancel is async — pump() may still be executing)
      await new Promise<void>((r) => setTimeout(r, 0));
    }

    // Clear and setup text layer
    textLayerContainer.innerHTML = "";
    textLayerContainer.style.width = `${viewport.width}px`;
    textLayerContainer.style.height = `${viewport.height}px`;
    textLayerRootsRef.current[pageIndex] = null;

    // Render PDF page to canvas
    // Scale the 2D context so PDF.js paints at CSS-pixel coordinates
    const contextScale = canvas.width / viewport.width;
    if (contextScale !== 1) {
      context.scale(contextScale, contextScale);
    }
    
    // Tell PDF.js about the intended output scale so it can hint the font
    // engine and avoid re-rasterizing glyphs at a different size.
    const renderContext = {
      canvas: canvas,
      canvasContext: context,
      viewport: viewport,
      intent: "print" as any, // renders at full quality without extra work
      // Don't use WebGL for canvas rendering — software path is faster for 2D PDFs
      enableWebGL: false as any,
    };

    const renderTask = page.render(renderContext);
    renderTasksRef.current[pageIndex] = renderTask;

    try {
      await renderTask.promise;
    } catch (err: any) {
      // Ignore cancelled render errors and DOM-detached errors
      if (err?.name === 'RenderingCancelledException') {
        return false;
      }
      if (err?.message?.includes('parentNode')) {
        console.warn(`[PDFViewer] Page ${pageNum} render cancelled (DOM detached):`, err.message);
        return false;
      }
      throw err;
    }
    context.setTransform(1, 0, 0, 1, 0, 0);

    // Render text layer for text selection (PDF.js implementation)
    // Defer text-layer for non-current pages so canvas paint isn't blocked.
    const isCurrentPage = pageNum === pageNumberRef.current;
    const textLayerDelay = isCurrentPage ? 0 : 300;

    const buildTextLayer = async () => {
    try {
      // Cancel previous text layer builder BEFORE clearing DOM
      // so PDF.js internal cleanup can access still-attached nodes.
      const prevBuilder = textLayerBuildersRef.current[pageIndex];
      textLayerBuildersRef.current[pageIndex] = null;
      if (prevBuilder) {
        try { prevBuilder.cancel(); } catch { /* ignore */ }
        // Yield so the cancelled reader's pump() finishes before we detach nodes.
        await new Promise<void>((r) => setTimeout(r, 0));
      }

      // Only clear after cancelling — if we clear first, the cancel
      // cleanup inside PDF.js may hit a null parentNode.
      textLayerContainer.innerHTML = "";
      textLayerContainer.style.width = `${viewport.width}px`;
      textLayerContainer.style.height = `${viewport.height}px`;
      textLayerRootsRef.current[pageIndex] = null;

      const mountTextLayer = () => {
        const layer = document.createElement("div");
        layer.className = "textLayer";
        layer.style.width = `${viewport.width}px`;
        layer.style.height = `${viewport.height}px`;
        layer.style.cursor = "text";
        layer.style.userSelect = "text";
        layer.style.webkitUserSelect = "text";
        textLayerContainer.appendChild(layer);
        textLayerRootsRef.current[pageIndex] = layer;
        return layer;
      };

      const textLayerRoot = mountTextLayer();
      const PdfjsTextLayer = (pdfjsLib as any).TextLayer;

      if (typeof PdfjsTextLayer === "function") {
        const textLayer = new PdfjsTextLayer({
          textContentSource:
            typeof (page as any).streamTextContent === "function"
              ? (page as any).streamTextContent({ includeMarkedContent: true })
              : await page.getTextContent(),
          container: textLayerRoot,
          viewport,
        });

        textLayerBuildersRef.current[pageIndex] = {
          cancel: () => {
            try {
              textLayer.cancel?.();
            } catch {
              // Ignore cancel errors from detached text layers.
            }
          },
        };

        await textLayer.render();
      } else {
        textLayerRoot.remove();
        textLayerRootsRef.current[pageIndex] = null;

        const textLayerBuilder = new TextLayerBuilder({
          pdfPage: page,
          onAppend: (layer: HTMLDivElement) => {
            layer.style.width = `${viewport.width}px`;
            layer.style.height = `${viewport.height}px`;
            layer.style.cursor = "text";
            layer.style.userSelect = "text";
            (layer.style as any).webkitUserSelect = "text";
            textLayerContainer.appendChild(layer);
            textLayerRootsRef.current[pageIndex] = layer;
          },
        });

        textLayerBuildersRef.current[pageIndex] = textLayerBuilder as PdfTextLayerRenderer;
        await textLayerBuilder.render({ viewport });
      }
      // Guard: if the text layer container was detached during async render,
      // skip downstream DOM operations to avoid "parentNode is null" errors.
      if (!textLayerContainer.isConnected) {
        return true;
      }
      const hasSelectableText = hasSelectableTextInLayer(textLayerRootsRef.current[pageIndex]);
      setPageTextSelectionAvailability(pageNum, hasSelectableText);
      
      // Apply any search highlights
      applyTextLayerHighlights(pageIndex);
      
      // Ensure the text layer is properly positioned above the canvas
      textLayerContainer.style.zIndex = '10';
    } catch (err) {
      console.warn("Text layer rendering failed:", err);
      setPageTextSelectionAvailability(pageNum, false);
      // Don't fail the entire page render if text layer fails
    }
    };

    if (textLayerDelay > 0) {
      textLayerTimeoutsRef.current[pageIndex] = setTimeout(() => {
        textLayerTimeoutsRef.current[pageIndex] = null;
        void buildTextLayer();
      }, textLayerDelay);
    } else {
      void buildTextLayer();
    }

    recomputePageOffsets();
    return true;
  };

  const getCurrentPageFromScrollTop = useCallback((scrollTop: number) => {
    return deriveCurrentPageFromOffsets(pageOffsetsRef.current, numPages, pageNumber, scrollTop, 24);
  }, [numPages, pageNumber]);

  const completeProgrammaticNavigation = useCallback((token: number, reason: string) => {
    if (!pdfNavStabilityEnabledRef.current) {
      isProgrammaticScrollRef.current = false;
      return;
    }
    if (activeNavTokenRef.current !== token) return;
    activeNavTokenRef.current = null;
    isProgrammaticScrollRef.current = false;
    clearNavigationSettleTimeout();
    if (Date.now() >= userScrollLockoutUntilRef.current) {
      setNavigationMode("idle", reason);
    }
    logNav("programmatic-nav-complete", { token, reason });
  }, [clearNavigationSettleTimeout, logNav, setNavigationMode]);

  const startNavigationSettleCheck = useCallback((token: number, targetTop: number, targetPageNumber: number) => {
    if (!pdfNavStabilityEnabledRef.current) return;
    clearNavigationSettleTimeout();
    navSettleTargetRef.current = { token, targetTop, pageNumber: targetPageNumber };
    const deadline = Date.now() + NAV_SETTLE_TIMEOUT_MS;

    const check = () => {
      if (activeNavTokenRef.current !== token) return;
      const container = scrollContainerRef.current;
      if (!container) {
        completeProgrammaticNavigation(token, "container-missing");
        return;
      }

      const currentTop = container.scrollTop;
      const currentPageFromOffsets = getCurrentPageFromScrollTop(currentTop);
      const delta = Math.abs(currentTop - targetTop);
      const onTargetPage = currentPageFromOffsets === targetPageNumber;
      const settled = isNavigationSettled(delta, onTargetPage, NAV_SETTLE_THRESHOLD_PX);
      const now = Date.now();

      if (settled) {
        if (!navSettleStableSinceRef.current) {
          navSettleStableSinceRef.current = now;
        }
        if (now - navSettleStableSinceRef.current >= NAV_SETTLE_STABLE_MS) {
          completeProgrammaticNavigation(token, "settled");
          return;
        }
      } else {
        navSettleStableSinceRef.current = null;
      }

      if (now >= deadline) {
        completeProgrammaticNavigation(token, "settle-timeout");
        return;
      }

      navSettleTimeoutRef.current = setTimeout(check, 80);
    };

    navSettleTimeoutRef.current = setTimeout(check, 80);
  }, [
    clearNavigationSettleTimeout,
    completeProgrammaticNavigation,
    getCurrentPageFromScrollTop,
  ]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const pageContainer = pageContainerRefs.current[pageNumber - 1];
    if (!container || !pageContainer) return;

    // If the pageNumber update came from scroll syncing, avoid auto-scrolling
    // (it feels like the viewer is "snapping back" while scrolling).
    if (pageUpdateFromScrollRef.current) {
      pageUpdateFromScrollRef.current = false;
      return;
    }

    if (suppressAutoScroll) {
      skipAutoScrollOnceRef.current = true;
      // Track the restored page to prevent scroll events from resetting it backwards
      restoredPageRef.current = pageNumber;
      // Set a protection window - ignore ALL auto-scrolls for 2 seconds after restoration
      restorationWindowRef.current = Date.now() + 2000;
      return;
    }

    // Check if we're still in the restoration protection window
    const now = Date.now();
    const isInRestorationWindow = now < restorationWindowRef.current;

    if (skipAutoScrollOnceRef.current) {
      skipAutoScrollOnceRef.current = false;
      // Don't scroll during restoration window
      if (isInRestorationWindow) {
        console.log("[PDFViewer] Skipping auto-scroll during restoration window", { pageNumber, restoredPage: restoredPageRef.current });
        return;
      }
    }

    // Block any auto-scroll that would take us to a different page during restoration window
    if (isInRestorationWindow && restoredPageRef.current !== null && pageNumber !== restoredPageRef.current) {
      console.log("[PDFViewer] Blocking auto-scroll to different page during restoration:", { pageNumber, restoredPage: restoredPageRef.current });
      return;
    }

    const pending = pendingNavRef.current;
    if (pending && pending.pageNumber === pageNumber) {
      if (pdfNavStabilityEnabledRef.current && isStaleNavigationToken(activeNavTokenRef.current, pending.token)) {
        logNav("stale-pending-nav-ignored", {
          pendingToken: pending.token,
          activeToken: activeNavTokenRef.current,
          pageNumber,
        });
        pendingNavRef.current = null;
        return;
      }

      const pageIndex = pageNumber - 1;
      const viewport = pageViewportRefs.current[pageIndex];
      const destArray = pending.destArray;

      let targetTop = Math.max(0, pageContainer.offsetTop - 16);
      let targetLeft = container.scrollLeft;

      if (destArray && viewport) {
        const kindRaw = destArray[1];
        const kind =
          (kindRaw && typeof kindRaw === "object" && typeof (kindRaw as any).name === "string"
            ? (kindRaw as any).name
            : typeof kindRaw === "string"
              ? kindRaw
              : null) as string | null;

        try {
          if (kind === "XYZ") {
            const leftPdf = typeof destArray[2] === "number" ? destArray[2] : 0;
            const topPdf = typeof destArray[3] === "number" ? destArray[3] : null;
            if (topPdf !== null) {
              const [vx, vy] = viewport.convertToViewportPoint(leftPdf, topPdf);
              if (Number.isFinite(vy)) targetTop = Math.max(0, pageContainer.offsetTop + vy - 16);
              if (Number.isFinite(vx)) targetLeft = Math.max(0, vx);
            }
          } else if (kind === "FitH" || kind === "FitBH") {
            const topPdf = typeof destArray[2] === "number" ? destArray[2] : null;
            if (topPdf !== null) {
              const [, vy] = viewport.convertToViewportPoint(0, topPdf);
              if (Number.isFinite(vy)) targetTop = Math.max(0, pageContainer.offsetTop + vy - 16);
            }
          }
        } catch {
          // Ignore dest parsing issues and fall back to top-of-page scroll.
        }
      }

      const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
      const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
      targetTop = Math.min(Math.max(0, targetTop), maxScrollTop);
      targetLeft = Math.min(Math.max(0, targetLeft), maxScrollLeft);

      pendingNavRef.current = null;
      if (pdfNavStabilityEnabledRef.current) {
        setNavigationMode("programmatic-nav", "toc-pending-nav");
        isProgrammaticScrollRef.current = true;
      }
      isProgrammaticScrollRef.current = true;
      container.scrollTo({ top: targetTop, left: targetLeft, behavior: "auto" });

      if (pdfNavStabilityEnabledRef.current) {
        startNavigationSettleCheck(pending.token, targetTop, pageNumber);
      } else {
        const timeout = setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 300);
        return () => {
          clearTimeout(timeout);
        };
      }
      return;
    }

    // Do not auto-scroll on generic pageNumber prop changes. Programmatic
    // navigation must go through pendingNavRef to avoid snap-back loops.
    return;
  }, [
    logNav,
    pageNumber,
    numPages,
    suppressAutoScroll,
    startNavigationSettleCheck,
  ]);

  // Track the last restoreRequestId we've processed to detect new restore attempts
  const lastProcessedRestoreIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!restoreState || restoreRequestId === undefined) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    // Only reset user scroll tracking when this is a genuinely NEW restore attempt
    // (i.e., restoreRequestId changed for the first time, not just re-triggered by verification)
    const isNewRestore = lastProcessedRestoreIdRef.current === null ||
                         restoreRequestId < (lastProcessedRestoreIdRef.current ?? 0);
    if (isNewRestore) {
      userScrolledDuringRestoreRef.current = false;
      userScrollSignaledRef.current = false;
    }
    lastProcessedRestoreIdRef.current = restoreRequestId;
    const start = Date.now();
    const deadline = start + 8000;
    let canceled = false;
    let settleTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    const attempt = () => {
      if (canceled) return;
      if (userScrolledDuringRestoreRef.current) return;
      const activeContainer = scrollContainerRef.current;
      if (!activeContainer) return;

      const clampedPageNumber = Math.max(1, Math.min(restoreState.pageNumber, Math.max(1, numPages || 1)));
      const pageIndex = clampedPageNumber - 1;
      const pageEl = pageContainerRefs.current[pageIndex];
      const viewport = pageViewportRefs.current[pageIndex];

      let targetScrollTop: number | null = null;
      let targetScrollLeft: number | null = null;
      const maxScroll = Math.max(0, activeContainer.scrollHeight - activeContainer.clientHeight);

      if (restoreState.dest && pageEl && viewport && pageEl.offsetHeight > 0) {
        const left = restoreState.dest.left ?? 0;
        const top = restoreState.dest.top ?? 0;
        const [viewportX, viewportY] = viewport.convertToViewportPoint(left, top);
        if (Number.isFinite(viewportY)) {
          targetScrollTop = pageEl.offsetTop + viewportY;
        }
        if (Number.isFinite(viewportX)) {
          targetScrollLeft = viewportX;
        }
      } else if (
        typeof restoreState.scrollTop === "number"
        || typeof restoreState.scrollPercent === "number"
      ) {
        const scrollLeft = typeof restoreState.scrollLeft === "number" ? restoreState.scrollLeft : null;
        if (typeof restoreState.scrollPercent === "number" && maxScroll > 0) {
          const percentScrollTop = (restoreState.scrollPercent / 100) * maxScroll;
          if (typeof restoreState.scrollTop === "number") {
            const delta = Math.abs(restoreState.scrollTop - percentScrollTop);
            const threshold = Math.max(200, maxScroll * 0.05);
            targetScrollTop = delta > threshold ? percentScrollTop : restoreState.scrollTop;
          } else {
            targetScrollTop = percentScrollTop;
          }
        } else if (typeof restoreState.scrollTop === "number") {
          targetScrollTop = restoreState.scrollTop;
        }
        targetScrollLeft = scrollLeft;
      } else if (pageEl && pageEl.offsetTop !== undefined) {
        targetScrollTop = pageEl.offsetTop;
      }

      const hasEnoughLayout =
        maxScroll > 0 ||
        (!!pageEl && pageEl.offsetHeight > 0) ||
        (activeContainer.scrollHeight > 0 && activeContainer.clientHeight > 0);

      if (targetScrollTop === null || !hasEnoughLayout) {
        if (!userScrolledDuringRestoreRef.current && Date.now() < deadline) {
          retryTimeout = setTimeout(attempt, 120);
        }
        return;
      }

      const clamped = Math.min(Math.max(0, targetScrollTop), maxScroll > 0 ? maxScroll : targetScrollTop);
      if (shouldSuppressProgrammaticScroll({
        enabled: pdfNavStabilityEnabledRef.current,
        source: "restore",
        now: Date.now(),
        lockoutUntil: userScrollLockoutUntilRef.current,
        activeToken: activeNavTokenRef.current,
      })) {
        logNav("restore-scroll-suppressed-by-user-lockout", {
          page: clampedPageNumber,
          lockoutUntil: userScrollLockoutUntilRef.current,
        });
        return;
      }
      restoredPageRef.current = clampedPageNumber;
      restorationWindowRef.current = Date.now() + 2000;
      if (pdfNavStabilityEnabledRef.current) {
        setNavigationMode("programmatic-nav", "restore-request");
      }
      isProgrammaticScrollRef.current = true;
      activeContainer.scrollTop = clamped;

      if (targetScrollLeft !== null) {
        const maxScrollLeft = Math.max(0, activeContainer.scrollWidth - activeContainer.clientWidth);
        activeContainer.scrollLeft = Math.min(Math.max(0, targetScrollLeft), maxScrollLeft);
      }

      if (settleTimeout) clearTimeout(settleTimeout);
      settleTimeout = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
        if (pdfNavStabilityEnabledRef.current && activeNavTokenRef.current === null) {
          if (Date.now() >= userScrollLockoutUntilRef.current) {
            setNavigationMode("idle", "restore-request-complete");
          }
        }
      }, 300);
    };

    attempt();

    return () => {
      canceled = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      if (settleTimeout) clearTimeout(settleTimeout);
    };
  }, [logNav, numPages, restoreRequestId, restoreState, setNavigationMode]);

  // Reset restore tracking when restoreState becomes null (restoration complete/cancelled)
  useEffect(() => {
    if (!restoreState) {
      lastProcessedRestoreIdRef.current = null;
    }
  }, [restoreState]);


  const handlePrevPage = () => {
    if (pageNumber > 1) {
      const nextPageNumber = pageNumber - 1;
      const token = ++navTokenCounterRef.current;
      activeNavTokenRef.current = token;
      pendingNavRef.current = { token, pageNumber: nextPageNumber, destArray: null };
      if (pdfNavStabilityEnabledRef.current) {
        setNavigationMode("programmatic-nav", "prev-page");
        isProgrammaticScrollRef.current = true;
      }
      onPageChange?.(nextPageNumber);
    }
  };

  const handleNextPage = () => {
    if (pageNumber < numPages) {
      const nextPageNumber = pageNumber + 1;
      const token = ++navTokenCounterRef.current;
      activeNavTokenRef.current = token;
      pendingNavRef.current = { token, pageNumber: nextPageNumber, destArray: null };
      if (pdfNavStabilityEnabledRef.current) {
        setNavigationMode("programmatic-nav", "next-page");
        isProgrammaticScrollRef.current = true;
      }
      onPageChange?.(nextPageNumber);
    }
  };

  const resolveOutlineDest = useCallback(async (dest: any) => {
    if (!pdf) return null;

    // Some PDFs/creators return a direct page index (0-based). Keep supporting it.
    if (typeof dest === "number" && Number.isFinite(dest)) {
      const pageIndex = Math.max(0, Math.min(Math.max(0, numPages - 1), dest));
      return { pageIndex, destArray: null as any[] | null };
    }

    let destArray: any[] | null = null;
    if (typeof dest === "string") {
      try {
        destArray = (await pdf.getDestination(dest)) as any[] | null;
      } catch {
        destArray = null;
      }
    } else if (Array.isArray(dest)) {
      destArray = dest as any[];
    }

    if (!destArray || !Array.isArray(destArray) || destArray.length === 0) return null;

    const pageRef = destArray[0];
    try {
      if (typeof pageRef === "number" && Number.isFinite(pageRef)) {
        const pageIndex = Math.max(0, Math.min(Math.max(0, numPages - 1), pageRef));
        return { pageIndex, destArray };
      }

      // PDF.js uses a Ref object for the page reference in explicit destinations.
      const pageIndex = await pdf.getPageIndex(pageRef as any);
      if (!Number.isFinite(pageIndex)) return null;
      return { pageIndex, destArray };
    } catch {
      return null;
    }
  }, [pdf, numPages]);

  const handleTocClick = useCallback(async (dest: any) => {
    const requestToken = ++navTokenCounterRef.current;
    latestTocRequestTokenRef.current = requestToken;
    const resolved = await resolveOutlineDest(dest);
    if (!resolved) {
      if (pdfNavStabilityEnabledRef.current && latestTocRequestTokenRef.current !== requestToken) {
        logNav("stale-toc-resolve-ignored", { requestToken, reason: "no-resolved-destination" });
      }
      return;
    }
    if (pdfNavStabilityEnabledRef.current && latestTocRequestTokenRef.current !== requestToken) {
      logNav("stale-toc-resolve-ignored", {
        requestToken,
        latestToken: latestTocRequestTokenRef.current,
      });
      return;
    }

    const nextPageNumber = resolved.pageIndex + 1;
    activeNavTokenRef.current = requestToken;
    pendingNavRef.current = { token: requestToken, pageNumber: nextPageNumber, destArray: resolved.destArray };
    if (pdfNavStabilityEnabledRef.current) {
      setNavigationMode("programmatic-nav", "toc-click");
      isProgrammaticScrollRef.current = true;
    }
    setShowTOC(false);
    onPageChange?.(nextPageNumber);
  }, [logNav, onPageChange, resolveOutlineDest, setNavigationMode]);

  const handleZoomModeChange = (mode: ZoomMode) => {
    setZoomMode(mode);
  };

  const renderOutline = (items: any[], depth = 0): React.ReactElement[] => {
    return items.map((item, index) => (
      <div key={index}>
        <button
          onClick={() => {
            if (item.dest) handleTocClick(item.dest);
          }}
          className={cn(
            "block w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted rounded-md transition-colors",
            depth > 0 && "pl-6"
          )}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
        >
          {item.title}
        </button>
        {item.items && renderOutline(item.items, depth + 1)}
      </div>
    ));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      handlePrevPage();
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      handleNextPage();
    } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "o") {
      e.preventDefault();
      if (ocr.flowState === "idle") {
        ocr.enterOcrMode();
      } else {
        ocr.exitOcrMode();
      }
    }
  };

  // Pan/drag handlers for zoomed content
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only enable drag when:
    // 1. Zoomed in significantly (scale > 1.2) or in custom zoom mode
    // 2. Not clicking on the text layer (to allow text selection)
    // 3. Middle mouse button or holding space (for pan mode)
    const isMiddleButton = e.button === 1;
    const isZoomedIn = scale > 1.2 || zoomMode === "custom";
    
    if (isZoomedIn || isMiddleButton) {
      const targetNode = e.target as Node;
      
      // Don't drag if clicking on text layer (allow text selection)
      const isClickingText = textLayerRootsRef.current.some((layer) => 
        layer && (layer === targetNode || layer.contains(targetNode))
      );
      
      if (isClickingText) {
        // Allow text selection to proceed
        return;
      }
      
      // Start dragging
      setIsDragging(true);
      const sp = scrollPositionRef.current;
      setDragStart({ x: e.clientX - sp.x, y: e.clientY - sp.y });
      
      // Prevent default to avoid text selection during drag
      if (isMiddleButton) {
        e.preventDefault();
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const container = scrollContainerRef.current;
    if (container) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      container.scrollLeft = -newX;
      container.scrollTop = -newY;
      scrollPositionRef.current = { x: newX, y: newY };
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const selectionStatusLabel = useMemo(() => {
    if (textSelectionCapability.analyzedPages === 0) {
      return "Detecting selectable text...";
    }
    if (!textSelectionCapability.hasSelectableText) {
      return "No selectable text layer detected";
    }
    if (textSelectionCapability.currentPageHasSelectableText === false) {
      return "This page has no selectable text";
    }
    return "Text selection available";
  }, [textSelectionCapability]);

  // Track which pages have been rendered
  const renderedPagesRef = useRef<Set<number>>(new Set());
  const pageOffsetsRef = useRef<number[]>([]);
  const offsetsUpdateRafRef = useRef<number | null>(null);
  const shouldVirtualize = ENABLE_PDF_VIRTUALIZATION && numPages > VIRTUALIZATION_THRESHOLD_PAGES;
  const virtualStartPage = shouldVirtualize ? Math.max(1, pageNumber - VIRTUAL_WINDOW_PAGES) : 1;
  const virtualEndPage = shouldVirtualize ? Math.min(numPages, pageNumber + VIRTUAL_WINDOW_PAGES) : numPages;
  const currentScaleEstimate = pageScaleRefs.current[Math.max(0, pageNumber - 1)] ?? scale;
  const estimatedPageHeight = Math.max(400, (fallbackPageSize?.height ?? 1100) * currentScaleEstimate);
  const estimatedPageStride = estimatedPageHeight + PAGE_GAP_PX;
  const topSpacerHeight = shouldVirtualize ? (virtualStartPage - 1) * estimatedPageStride : 0;
  const bottomSpacerHeight = shouldVirtualize ? (numPages - virtualEndPage) * estimatedPageStride : 0;

  const recomputePageOffsets = useCallback(() => {
    if (offsetsUpdateRafRef.current !== null) return;
    offsetsUpdateRafRef.current = requestAnimationFrame(() => {
      offsetsUpdateRafRef.current = null;
      const offsets: number[] = new Array(numPages).fill(0);
      let runningOffset = 0;
      for (let i = 0; i < numPages; i += 1) {
        const el = pageContainerRefs.current[i];
        if (el) {
          runningOffset = el.offsetTop;
          offsets[i] = runningOffset;
        } else if (i > 0) {
          runningOffset = offsets[i - 1] + estimatedPageStride;
          offsets[i] = runningOffset;
        }
      }
      pageOffsetsRef.current = offsets;
    });
  }, [estimatedPageStride, numPages]);

  useEffect(() => {
    if (!shouldVirtualize) return;
    for (let i = 0; i < numPages; i += 1) {
      if (i < virtualStartPage - 1 || i > virtualEndPage - 1) {
        // Cancel in-flight text layer renders before dropping refs.
        try { textLayerBuildersRef.current[i]?.cancel(); } catch { /* ignore */ }
        textLayerBuildersRef.current[i] = null;
        const timeout = textLayerTimeoutsRef.current[i];
        if (timeout != null) { clearTimeout(timeout); textLayerTimeoutsRef.current[i] = null; }
        pageContainerRefs.current[i] = null;
        canvasRefs.current[i] = null;
        textLayerContainerRefs.current[i] = null;
      }
    }
  }, [numPages, shouldVirtualize, virtualEndPage, virtualStartPage]);

  useEffect(() => {
    if (numPages <= 0) return;
    recomputePageOffsets();
    // Recompute again shortly to catch late layout (fonts, text layer, etc).
    const t = setTimeout(() => recomputePageOffsets(), 150);
    return () => clearTimeout(t);
  }, [numPages]);

  // Sync scroll position
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (container) scrollPositionRef.current = { x: -container.scrollLeft, y: -container.scrollTop };

    if (!container || scrollRafRef.current !== null) return;

    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      if (isProgrammaticScrollRef.current) return;
      markUserScrollOwnership("user-scroll");

      // User scrolled. If we're still trying to restore, don't snap them back later.
      if (restoreState && restoreRequestId !== undefined) {
        userScrolledDuringRestoreRef.current = true;
        if (!userScrollSignaledRef.current) {
          userScrollSignaledRef.current = true;
          onUserScrollDuringRestore?.();
        }
      }

      const scrollTop = container.scrollTop;
      let currentPage = getCurrentPageFromScrollTop(scrollTop);

      if (currentPage !== pageNumber && !suppressAutoScroll) {
        // Check if we're in a restoration protection window
        const now = Date.now();
        const isInRestorationWindow = now < restorationWindowRef.current;
        const restoredPage = restoredPageRef.current;

        // Block backward page changes during restoration window to prevent reset to page 1
        if (isInRestorationWindow && restoredPage !== null && currentPage < restoredPage) {
          // Ignore transient "current page" changes while restoring.
          currentPage = restoredPage;
        } else {
          // Clear restoration tracking if we've moved past the window or forward
          if (!isInRestorationWindow) {
            restoredPageRef.current = null;
          }
          pageUpdateFromScrollRef.current = true;
          onPageChange?.(currentPage);
        }
      }

      let dest: PdfDest | null = null;
      const pageIndex = currentPage - 1;
      const pageEl = pageContainerRefs.current[pageIndex];
      const viewport = pageViewportRefs.current[pageIndex];
      const pageScale = pageScaleRefs.current[pageIndex] ?? scale;
      if (pageEl && viewport) {
        const relativeTop = Math.max(0, scrollTop - pageEl.offsetTop);
        const relativeLeft = Math.max(0, container.scrollLeft);
        const [pdfX, pdfY] = viewport.convertToPdfPoint(relativeLeft, relativeTop);
        dest = {
          kind: "XYZ",
          left: Number.isFinite(pdfX) ? pdfX : null,
          top: Number.isFinite(pdfY) ? pdfY : null,
          zoom: Number.isFinite(pageScale) ? pageScale : null,
        };
      }

      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      const scrollPercent = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
      const scrollLeft = container.scrollLeft;
      onScrollPositionChange?.({
        pageNumber: currentPage,
        scrollTop,
        scrollLeft,
        scrollHeight: container.scrollHeight,
        clientHeight: container.clientHeight,
        scrollPercent,
        scale: pageScaleRefs.current[pageIndex] ?? scale,
        dest,
      });

      // Save position on scroll (debounced)
      if (!isRestoringPositionRef.current) {
        const pageEl = pageContainerRefs.current[pageIndex];
        let position: DocumentPosition;
        
        if (pageEl && scrollTop >= pageEl.offsetTop) {
          // Calculate offset within current page (0-1)
          const offset = (scrollTop - pageEl.offsetTop) / pageEl.offsetHeight;
          position = pagePosition(currentPage, Math.min(1, Math.max(0, offset)));
        } else {
          // Use scroll percentage as fallback
          position = createScrollPosition(scrollPercent);
        }
        
        debouncedSavePosition(position);
      }
    });
  };

  return (
    <div
      ref={outerContainerRef}
      className="flex flex-col h-full min-h-0 bg-background"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg m-4">
          Failed to load PDF: {error}
        </div>
      )}

      <div className="flex flex-1 min-h-0 relative">
        {/* Table of Contents Sidebar - Overlay on mobile, inline on desktop */}
        {showTOC && (
          <>
            {/* Mobile overlay backdrop */}
            <div
              className="md:hidden fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowTOC(false)}
            />
            {/* TOC Panel */}
            <div className="fixed md:relative inset-y-0 left-0 md:left-auto w-[280px] md:w-64 border-r border-border bg-card overflow-y-auto flex-shrink-0 z-50">
              <div className="p-3 md:p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-foreground text-sm md:text-base">Table of Contents</h3>
                <button
                  onClick={() => setShowTOC(false)}
                  className="p-2 hover:bg-muted rounded transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
              <nav className="p-2">
                {outline.length > 0 ? (
                  renderOutline(outline)
                ) : (
                  <p className="text-sm text-muted-foreground px-3 py-2">
                    No table of contents available
                  </p>
                )}
              </nav>
            </div>
          </>
        )}

        {/* Main Viewer Area */}
        <div className="flex-1 flex flex-col">
          {/* Viewer Toolbar */}
          <div className="flex items-center justify-between p-1 md:p-2 border-b border-border bg-card gap-2 overflow-x-auto">
            <div className="flex items-center gap-0.5 md:gap-1">
              <button
                onClick={() => setShowTOC(!showTOC)}
                className={cn(
                  "p-2 rounded-md transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center",
                  showTOC ? "bg-muted text-foreground" : "hover:bg-muted text-muted-foreground"
                )}
                title={t("viewer.toggleToc")}
              >
                <List className="w-4 h-4 md:w-4 md:h-4" />
              </button>

              <button
                onClick={() => {
                  if (ocr.flowState === "idle") ocr.enterOcrMode();
                  else ocr.exitOcrMode();
                }}
                className={cn(
                  "p-2 rounded-md transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center",
                  ocr.flowState !== "idle" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400" : "hover:bg-muted text-muted-foreground"
                )}
                title="OCR Select (Ctrl+Shift+O)"
              >
                <Scan className="w-4 h-4 md:w-4 md:h-4" />
              </button>

              <div className="hidden md:block h-6 w-px bg-border mx-2" />

              <button
                onClick={handlePrevPage}
                disabled={pageNumber <= 1}
                className="p-2 rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[36px] min-h-[36px] flex items-center justify-center"
                title={t("viewer.previousPage")}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs md:text-sm text-muted-foreground min-w-[70px] md:min-w-[100px] text-center whitespace-nowrap">
                {pageNumber}/{numPages}
              </span>

              <button
                onClick={handleNextPage}
                disabled={pageNumber >= numPages}
                className="p-2 rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[36px] min-h-[36px] flex items-center justify-center"
                title={t("viewer.nextPage")}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-0.5 md:gap-1">
              {/* Zoom Mode Buttons - Hide some on mobile */}
              <button
                onClick={() => handleZoomModeChange("fit-page")}
                className={cn(
                  "hidden md:flex p-2 rounded-md transition-colors min-w-[36px] min-h-[36px] items-center justify-center",
                  zoomMode === "fit-page" ? "bg-muted text-foreground" : "hover:bg-muted text-muted-foreground"
                )}
                title={t("viewer.fitToPage")}
              >
                <Maximize className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleZoomModeChange("fit-width")}
                className={cn(
                  "p-2 rounded-md transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center",
                  zoomMode === "fit-width" ? "bg-muted text-foreground" : "hover:bg-muted text-muted-foreground"
                )}
                title={t("viewer.fitToWidth")}
              >
                <Minimize className="w-4 h-4" />
              </button>

              <div className="h-6 w-px bg-border mx-2" />

              <button
                onClick={() => handleZoomModeChange("custom")}
                className={cn(
                  "p-2 rounded-md transition-colors",
                  zoomMode === "custom" ? "bg-muted text-foreground" : "hover:bg-muted text-muted-foreground"
                )}
                title={t("viewer.customZoom")}
              >
                <span className="text-xs font-medium">
                  {Math.round(scale * 100)}%
                </span>
              </button>
            </div>
          </div>

          {/* Canvas Container */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className={cn(
              "flex-1 min-h-0 overflow-auto bg-muted/30 p-4",
              "[contain:strict]", // GPU-compositing isolation for scroll perf
              isDragging && "cursor-grabbing",
              !isDragging && ocr.flowState === "idle" && (scale > 1 || zoomMode === "custom") && "cursor-grab",
              ocr.flowState !== "idle" && !isDragging && "cursor-crosshair"
            )}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            data-document-scroll-container
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">{t("viewer.loadingPdf")}</div>
              </div>
            ) : (
              <div className="mx-auto flex flex-col items-center gap-6 w-full">
                {shouldVirtualize && topSpacerHeight > 0 && (
                  <div
                    aria-hidden="true"
                    style={{ height: `${Math.max(0, Math.round(topSpacerHeight))}px` }}
                    className="w-full"
                  />
                )}
                {Array.from({ length: Math.max(0, virtualEndPage - virtualStartPage + 1) }, (_, offset) => {
                  const pageNum = virtualStartPage + offset;
                  const index = pageNum - 1;
                  return (
                    <div
                      key={index}
                      ref={(el) => {
                        pageContainerRefs.current[index] = el;
                      }}
                      data-pdf-page
                      data-page-number={pageNum}
                      className="relative shadow-lg border border-border bg-white"
                      style={{
                        ...fallbackPageSize
                          ? {
                              minWidth: `${Math.round(fallbackPageSize.width)}px`,
                              minHeight: `${Math.round(fallbackPageSize.height)}px`,
                            }
                          : undefined,
                        contain: 'layout style paint',
                      }}
                      {...(ENABLE_CUSTOM_PDF_SELECTION && {
                        onPointerDown: (e: React.PointerEvent) => customSelection.handlePointerDown(index, e),
                        onPointerMove: (e: React.PointerEvent) => customSelection.handlePointerMove(index, e),
                        onPointerUp: (e: React.PointerEvent) => customSelection.handlePointerUp(index, e),
                      })}
                    >
                      <canvas
                        ref={(el) => {
                          canvasRefs.current[index] = el;
                        }}
                        className="block"
                      />
                      {/* Layer 2: Highlight Layer - Persistent highlights between canvas and text */}
                      <HighlightLayer
                        pageIndex={index}
                        viewport={pageViewportRefs.current[index]}
                        highlights={getHighlightsForPage(pageNum)}
                        interactive={true}
                        onHighlightClick={(highlight) => {
                          console.log("Highlight clicked:", highlight);
                          // TODO: Show highlight options menu
                        }}
                      />
                      <div
                        ref={(el) => {
                          textLayerContainerRefs.current[index] = el;
                        }}
                        className={cn(
                          "textLayerContainer",
                          ENABLE_CUSTOM_PDF_SELECTION && "customSelectionActive"
                        )}
                        style={{
                          transformOrigin: "0 0",
                          zIndex: 10,
                          pointerEvents: ocr.flowState !== "idle" ? "none" : undefined,
                        }}
                      />
                      {/* Custom selection layer - sits above textLayer for geometric selection */}
                      {ENABLE_CUSTOM_PDF_SELECTION && (
                        <div
                          className="customSelectionLayer"
                          onPointerDown={(e) => customSelection.handlePointerDown(index, e)}
                          onPointerMove={(e) => customSelection.handlePointerMove(index, e)}
                          onPointerUp={(e) => customSelection.handlePointerUp(index, e)}
                        >
                          <SelectionRenderer
                            pageIndex={index}
                            selectionState={customSelection.selectionState}
                          />
                        </div>
                      )}
                      {/* OCR region selection and overlays - only on current page */}
                      {ocr.flowState !== "idle" && pageNum === pageNumber && (
                        <>
                          {ocr.flowState === "selecting" && (
                            <OcrRegionSelector
                              canvasRef={{ current: canvasRefs.current[index] }}
                              isActive={true}
                              onRegionSelected={(rect) => {
                                const canvas = canvasRefs.current[index];
                                if (canvas) ocr.handleRegionSelected(rect, canvas);
                              }}
                              onCancel={ocr.exitOcrMode}
                            />
                          )}
                          {(ocr.flowState === "processing" || ocr.flowState === "previewing" || ocr.flowState === "error") && ocr.selectedRect && (() => {
                            const canvas = canvasRefs.current[index];
                            if (!canvas) return null;
                            const cssScale = canvas.getBoundingClientRect().width / canvas.width;
                            return (
                              <>
                                {ocr.flowState === "processing" && (
                                  <OcrProgressOverlay
                                    selectionRect={ocr.selectedRect}
                                    cssScale={cssScale}
                                    progress={0}
                                    status="Processing..."
                                  />
                                )}
                                {(ocr.flowState === "previewing" || ocr.flowState === "error") && (
                                  <OcrTextPreview
                                    ocrResult={ocr.ocrResult}
                                    editedText={ocr.editedText}
                                    language={ocr.language}
                                    isLoading={false}
                                    error={ocr.error}
                                    selectionRect={ocr.selectedRect}
                                    cssScale={cssScale}
                                    onTextChange={ocr.setEditedText}
                                    onLanguageChange={ocr.setLanguage}
                                    onCreateExtract={() => {
                                      const text = ocr.editedText.trim();
                                      if (text && onOcrExtractText) {
                                        onOcrExtractText(text, pageNumber);
                                        ocr.exitOcrMode();
                                      }
                                    }}
                                    onRetry={() => ocr.retryOcr()}
                                    onCancel={ocr.exitOcrMode}
                                  />
                                )}
                              </>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  );
                })}
                {shouldVirtualize && bottomSpacerHeight > 0 && (
                  <div
                    aria-hidden="true"
                    style={{ height: `${Math.max(0, Math.round(bottomSpacerHeight))}px` }}
                    className="w-full"
                  />
                )}
              </div>
            )}
          </div>

          {/* Page Navigation Footer */}
          {numPages > 0 && !isLoading && (
            <div className="flex items-center justify-center gap-4 p-3 border-t border-border bg-card text-xs text-muted-foreground">
              <span>Use arrow keys to navigate</span>
              <span>•</span>
              <span>{selectionStatusLabel}</span>
              <span>•</span>
              <button
                onClick={() => setShowTOC(!showTOC)}
                className="hover:text-foreground transition-colors"
              >
                Toggle TOC
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Selection Popup - Floating context menu for text selection */}
      <SelectionPopup
        visible={showSelectionPopup}
        selectionRect={selectionPopupRect}
        selectedText={customSelection.selectionState.selectedText}
        onHighlight={handleHighlight}
        onHighlightWithDialog={handleHighlightWithDialog}
        onCopy={handleCopy}
        onAddNote={handleAddNote}
        onDismiss={handlePopupDismiss}
      />
    </div>
  );
}
