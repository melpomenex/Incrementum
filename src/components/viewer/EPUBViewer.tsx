import { useEffect, useRef, useState, useCallback, type MouseEvent } from "react";
import type { EpubSelectionContext, SelectionContext } from "../../types/selection";
import type { DocumentMetadata } from "../../types/document";
import ePub from "epubjs";
import { cn } from "../../utils";
import { useTheme } from "../../contexts/ThemeContext";
import { useSettingsStore } from "../../stores/settingsStore";
import { useVimModeStore } from "../../stores/vimModeStore";
import { getDeviceInfo } from "../../lib/pwa";
import { getDocumentAuto, updateDocumentProgressAuto } from "../../api/documents";
import { saveDocumentPosition, cfiPosition } from "../../api/position";
import { ChevronDown, ChevronUp, Menu, Settings } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { normalizeHighlightColor } from "../../utils/highlightColors";
import { buildSegmentCfiMap, findActiveSegment, type SyncSegment } from "../../utils/epubSync";
import { dispatchCommandPaletteOpen, isCommandPaletteOpenShortcut } from "../../utils/commandPaletteShortcut";
import { getShortcutCombo, eventMatchesCombo } from "../common/KeyboardShortcuts";

// Define outside component to keep a stable reference across renders
const FONT_FAMILY_MAP: Record<string, string> = {
  serif: "\"Iowan Old Style\", \"Charter\", \"Source Serif 4\", \"Palatino Linotype\", Palatino, Georgia, \"Times New Roman\", serif",
  "sans-serif": "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  monospace: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
};

function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function scoreQuoteCandidate(candidateText: string, quote: string): number {
  const candidate = normalizeSearchText(candidateText);
  const normalizedQuote = normalizeSearchText(quote);
  if (!candidate || !normalizedQuote) return 0;
  if (candidate.includes(normalizedQuote) || normalizedQuote.includes(candidate)) return 1000;

  const quoteWords = Array.from(new Set(normalizedQuote.split(/\s+/).filter((word) => word.length >= 4)));
  if (quoteWords.length === 0) return 0;

  return quoteWords.reduce((score, word) => score + (candidate.includes(word) ? 1 : 0), 0);
}

function chooseSearchResultIndex(results: any[], fallbackIndex?: number | null, quote?: string): number {
  if (results.length === 0) return -1;

  const normalizedFallback =
    typeof fallbackIndex === "number" && Number.isFinite(fallbackIndex)
      ? ((Math.trunc(fallbackIndex) % results.length) + results.length) % results.length
      : 0;

  if (!quote?.trim()) return normalizedFallback;

  let bestIndex = normalizedFallback;
  let bestScore = 0;
  results.forEach((result, index) => {
    const candidateText = [
      result?.excerpt,
      result?.text,
      result?.chapter?.label,
      result?.href,
    ]
      .filter((value) => typeof value === "string")
      .join(" ");
    const score = scoreQuoteCandidate(candidateText, quote);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

const resolveSpineIndex = (book: any, href: string): number | null => {
  if (!book || !book.spine) return null;
  const normalizeHref = (value: string) =>
    value.replace(/^\.?\//, "").split("#")[0];
  const normalizedPath = normalizeHref(href);
  const spine = book.spine;
  const spineItem = spine.get ? spine.get(normalizedPath) : null;
  if (spineItem && typeof spineItem.index === 'number') {
    return spineItem.index;
  }
  if (spine.items) {
    for (const item of spine.items) {
      const itemHref = normalizeHref(item.href || "");
      if (itemHref === normalizedPath || itemHref?.endsWith?.(normalizedPath)) {
        if (typeof item.index === 'number') return item.index;
      }
    }
  }
  return null;
};

const filterTocItems = (items: any[], book: any, start: number | undefined, end: number | undefined): any[] => {
  if (start === undefined && end === undefined) return items;
  
  return items
    .map(item => {
      const filteredSubitems = item.subitems ? filterTocItems(item.subitems, book, start, end) : undefined;
      
      const itemIndex = resolveSpineIndex(book, item.href);
      let isVisible = true;
      
      if (itemIndex !== null) {
        if (start !== undefined && itemIndex < start) isVisible = false;
        if (end !== undefined && itemIndex > end) isVisible = false;
      } else if (filteredSubitems && filteredSubitems.length > 0) {
        isVisible = true;
      } else {
        isVisible = false;
      }
      
      if (isVisible) {
        return {
          ...item,
          subitems: filteredSubitems,
        };
      }
      return null;
    })
    .filter(Boolean) as any[];
};

interface EPUBViewerProps {
  fileData?: Uint8Array | null;
  fileUrl?: string | null;
  fileName: string;
  documentId?: string;
  onLoad?: (toc: any[]) => void;
  onSelectionChange?: (text: string, context?: SelectionContext | null) => void;
  /** Callback when user right-clicks on selected text */
  onContextMenu?: (event: { x: number; y: number; selectedText: string; selectionContext?: SelectionContext | null }) => void;
  onContextTextChange?: (text: string) => void;
  initialCfi?: string;
  initialSearchMatchIndex?: number;
  initialSearchTextQuote?: string;
  highlightQuery?: string;
  searchQuery?: string;
  searchMatchIndex?: number | null;
  onSearchResultsChange?: (results: {
    query: string;
    total: number;
    activeIndex: number;
    activeCfi: string | null;
  }) => void;
  onProgressChange?: (progressPercent: number) => void;
  persistedHighlights?: Array<{ id: string; cfiRange: string; color?: string | null; text: string }>;
  /** Increment to trigger rendition.next() for TTS chapter auto-advance */
  advanceChapterSignal?: number;
  /** Transcript segments for audiobook sync */
  syncSegments?: SyncSegment[];
  /** Current audio playback time in seconds */
  syncCurrentTime?: number;
  /** Callback when sync state changes */
  onSyncStateChange?: (state: { status: "idle" | "building" | "ready" | "error"; mappedCount: number; totalSegments: number }) => void;
  /** Increment to force sync highlight + scroll to current audio position */
  syncJumpSignal?: number;
  metadata?: DocumentMetadata;
  onIframeWindowReady?: (iframeWindow: Window) => void;
}

export function EPUBViewer({
  fileData,
  fileUrl,
  fileName,
  documentId,
  onLoad,
  onSelectionChange,
  onContextMenu,
  onContextTextChange,
  initialCfi,
  initialSearchMatchIndex,
  initialSearchTextQuote,
  highlightQuery,
  searchQuery,
  searchMatchIndex,
  onSearchResultsChange,
  onProgressChange,
  persistedHighlights = [],
  advanceChapterSignal,
  syncSegments,
  syncCurrentTime,
  onSyncStateChange,
  syncJumpSignal,
  metadata,
  onIframeWindowReady,
}: EPUBViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rendition, setRendition] = useState<any>(null);
  const [book, setBook] = useState<any>(null);
  const [toc, setToc] = useState<any[]>([]);
  const tocRef = useRef<any[]>([]);
  const [showFontSizeControl, setShowFontSizeControl] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [showTocDrawer, setShowTocDrawer] = useState(false);
  const [showDesktopToc, setShowDesktopToc] = useState(true);
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentChapter, setCurrentChapter] = useState("");
  const selectionActiveRef = useRef(false);
  const lastEpubSelectionContextRef = useRef<EpubSelectionContext | null>(null);
  const initialDisplayCompleteRef = useRef(false);
  const activeSearchHighlightsRef = useRef<string[]>([]);
  const liveSearchHighlightsRef = useRef<string[]>([]);
  const liveSearchResultsRef = useRef<string[]>([]);
  const liveSearchVersionRef = useRef(0);
  const activeLiveSearchCfiRef = useRef<string | null>(null);
  const activePersistedHighlightsRef = useRef<string[]>([]);
  const handleEPUBKeyDownRef = useRef<any>(null);

  // Sync state
  const syncSegmentsRef = useRef<SyncSegment[]>([]);
  const syncMapRef = useRef<Map<number, string>>(new Map());
  const syncCurrentChapterRef = useRef<string | null>(null);
  const activeSyncHighlightRef = useRef<string | null>(null);
  const syncNavigatingRef = useRef(false);

  const { theme } = useTheme();
  const themeRef = useRef(theme);
  const { t } = useI18n();
  const { settings, updateSettings } = useSettingsStore();
  const deviceInfo = getDeviceInfo();
  const isMobile = deviceInfo.isMobile || deviceInfo.isTablet;
  const epubSettings = settings.documents.epubSettings;
  const fontSizeRef = useRef(epubSettings.fontSize);
  const fontFamilyRef = useRef(epubSettings.fontFamily);
  const lineHeightRef = useRef(epubSettings.lineHeight);

  // Use refs for callback props so the main loading effect doesn't re-run when they change
  const onContextTextChangeRef = useRef(onContextTextChange);
  onContextTextChangeRef.current = onContextTextChange;
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const onContextMenuRef = useRef(onContextMenu);
  onContextMenuRef.current = onContextMenu;
  const onProgressChangeRef = useRef(onProgressChange);
  onProgressChangeRef.current = onProgressChange;
  const onSearchResultsChangeRef = useRef(onSearchResultsChange);
  onSearchResultsChangeRef.current = onSearchResultsChange;
  const onIframeWindowReadyRef = useRef(onIframeWindowReady);
  onIframeWindowReadyRef.current = onIframeWindowReady;
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  // Keep fontSizeRef in sync with fontSize
  useEffect(() => {
    fontSizeRef.current = epubSettings.fontSize;
    fontFamilyRef.current = epubSettings.fontFamily;
    lineHeightRef.current = epubSettings.lineHeight;
  }, [epubSettings.fontSize, epubSettings.fontFamily, epubSettings.lineHeight]);

  const saveReadingPosition = useCallback(async (cfi: string) => {
    if (!documentId || !cfi) return;

    // Always save to localStorage first (works in both Tauri and web mode)
    localStorage.setItem(`epub-position-${documentId}`, cfi);

    // Then try to save to backend (may fail in web mode if endpoint doesn't exist)
    try {
      await updateDocumentProgressAuto(documentId, null, null, cfi);
    } catch (error) {
      // Fail gracefully - localStorage already has the position saved
      console.warn("EPUBViewer: Failed to save position to backend (localStorage saved):", error);
    }

    // Also save unified position
    try {
      await saveDocumentPosition(documentId, cfiPosition(cfi));
    } catch (error) {
      console.warn("EPUBViewer: Failed to save unified position:", error);
    }
  }, [documentId]);

  const loadReadingPosition = useCallback(async (): Promise<string | null> => {
    if (!documentId) return null;

    // First check localStorage (always available, fast)
    const localCfi = localStorage.getItem(`epub-position-${documentId}`);

    try {
      const doc = await getDocumentAuto(documentId);
      const remoteCfi = doc?.current_cfi || doc?.currentCfi;

      // Prefer remote if available and newer, otherwise use local
      if (remoteCfi) {
        return remoteCfi;
      }
      if (localCfi) {
        return localCfi;
      }
    } catch {
      // API failed - use localStorage as fallback
      console.warn("EPUBViewer: Failed to load position from backend, using localStorage");
      if (localCfi) {
        return localCfi;
      }
    }
    return null;
  }, [documentId]);

  const loadReadingPositionRef = useRef(loadReadingPosition);
  loadReadingPositionRef.current = loadReadingPosition;
  const saveReadingPositionRef = useRef(saveReadingPosition);
  saveReadingPositionRef.current = saveReadingPosition;
  const initialCfiRef = useRef(initialCfi);
  initialCfiRef.current = initialCfi;
  const metadataRef = useRef(metadata);
  metadataRef.current = metadata;
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;

  const updateEpubSettings = useCallback((updates: Partial<typeof epubSettings>) => {
    updateSettings({
      documents: {
        ...settings.documents,
        epubSettings: { ...settings.documents.epubSettings, ...updates },
      },
    });
  }, [settings.documents, updateSettings]);

  const isMobileRef = useRef(isMobile);
  isMobileRef.current = isMobile;

  const applyContentOverrides = useCallback((contents: any) => {
    const textColor = themeRef.current.colors.onBackground || themeRef.current.colors.text;
    const bgColor = themeRef.current.colors.background;
    const fontFamily = FONT_FAMILY_MAP[fontFamilyRef.current] || FONT_FAMILY_MAP.serif;
    const contentPadding = isMobileRef.current ? "1.25rem 1rem 4.5rem" : "2rem 3rem";
    const contentMaxWidth = isMobileRef.current ? "40rem" : "100%";
    const contentMargin = isMobileRef.current ? "0 auto" : "0";

    const existing = contents.document.getElementById("epub-override-styles");
    if (existing) {
      existing.remove();
    }

    const style = contents.document.createElement("style");
    style.id = "epub-override-styles";
    style.textContent = `
      * {
        box-sizing: border-box !important;
        font-family: ${fontFamily} !important;
      }
      html, body {
        margin: 0 !important;
        padding: ${contentPadding} !important;
        width: 100% !important;
        height: auto !important;
        min-height: 100% !important;
        line-height: ${lineHeightRef.current} !important;
        color: ${textColor} !important;
        background: ${bgColor} !important;
        max-width: ${contentMaxWidth} !important;
        overflow-x: hidden !important;
        overflow-y: visible !important;
        -webkit-overflow-scrolling: touch !important;
      }
      body {
        font-size: ${fontSizeRef.current}px !important;
        padding-bottom: 80px !important;
        margin: ${contentMargin} !important;
      }
      body *:not(.epub-persisted-highlight) {
        color: ${textColor} !important;
        background-color: transparent !important;
      }
      .epub-persisted-highlight {
        background-color: rgba(255, 235, 59, 0.5);
        border-radius: 0.12rem !important;
      }
      .epub-sync-highlight {
        background: rgba(59, 130, 246, 0.3) !important;
        border-radius: 2px !important;
      }
      p {
        line-height: ${lineHeightRef.current} !important;
        margin: 1em 0 !important;
        font-size: inherit !important;
        max-width: 100% !important;
        color: ${textColor} !important;
      }
      h1, h2, h3, h4, h5, h6 {
        line-height: 1.3 !important;
        margin: 1.5em 0 0.5em 0 !important;
        font-weight: 600 !important;
        font-size: inherit !important;
        max-width: 100% !important;
        color: ${textColor} !important;
      }
      div, section, article, nav, aside, main, header, footer {
        line-height: inherit !important;
        margin: 0 !important;
        padding: 0 !important;
        max-width: 100% !important;
        color: ${textColor} !important;
        background: transparent !important;
      }
      span {
        line-height: inherit !important;
        margin: 0 !important;
        padding: 0 !important;
        color: ${textColor} !important;
      }
      img {
        max-width: 100% !important;
        height: auto !important;
        display: block !important;
        margin: 1em auto !important;
      }
      table {
        max-width: 100% !important;
        border-collapse: collapse !important;
        margin: 1em 0 !important;
      }
      td, th {
        padding: 0.5em !important;
        border: 1px solid ${textColor} !important;
        color: ${textColor} !important;
      }
      ul, ol {
        margin: 1em 0 !important;
        padding-left: 2em !important;
      }
      li {
        margin: 0.5em 0 !important;
        color: ${textColor} !important;
      }
      a {
        color: ${themeRef.current.colors.primary} !important;
        text-decoration: underline !important;
        background-color: transparent !important;
      }
      .epub-search-highlight {
        background: rgba(245, 158, 11, 0.35) !important;
        border-radius: 2px !important;
        padding: 0 2px !important;
      }
      .epub-search-highlight-active {
        background: rgba(249, 115, 22, 0.55) !important;
        outline: 2px solid rgba(194, 65, 12, 0.45) !important;
        border-radius: 3px !important;
        padding: 0 2px !important;
      }
      * {
        text-rendering: optimizeLegibility !important;
        -webkit-font-smoothing: antialiased !important;
        -moz-osx-font-smoothing: grayscale !important;
      }
    `;
    contents.document.head.appendChild(style);
  }, []);

  const applyRenditionTheme = useCallback(() => {
    if (!rendition) return;

    const textColor = themeRef.current.colors.onBackground || themeRef.current.colors.text;
    const fontFamily = FONT_FAMILY_MAP[fontFamilyRef.current] || FONT_FAMILY_MAP.serif;
    rendition.themes.default({
      body: {
        "font-size": `${fontSizeRef.current}px !important`,
        "line-height": `${lineHeightRef.current} !important`,
        "margin": "0 !important",
        "padding": "0 !important",
        "color": `${textColor} !important`,
        "background": `${themeRef.current.colors.background} !important`,
        "font-family": `${fontFamily} !important`,
      },
      p: {
        "line-height": `${lineHeightRef.current} !important`,
        "margin": "1em 0 !important",
        "color": `${textColor} !important`,
      },
      "*": {
        "color": `${textColor} !important`,
        "background-color": "transparent !important",
        "box-sizing": "border-box !important",
        "max-width": "100% !important",
      },
    });
    rendition.themes.select("default");

    try {
      rendition.getContents().forEach((contents: any) => {
        applyContentOverrides(contents);
      });
    } catch {
      // Ignore if contents are not ready yet
    }
  }, [applyContentOverrides, rendition]);

  const updateFontSize = useCallback((newSize: number) => {
    const clampedSize = Math.max(12, Math.min(32, newSize));
    updateEpubSettings({ fontSize: clampedSize });
  }, [updateEpubSettings]);

  const updateLineHeight = useCallback((newHeight: number) => {
    const clampedHeight = Math.max(1.2, Math.min(2.2, newHeight));
    updateEpubSettings({ lineHeight: parseFloat(clampedHeight.toFixed(2)) });
  }, [updateEpubSettings]);

  const updateFontFamily = useCallback((fontFamily: "serif" | "sans-serif" | "monospace") => {
    updateEpubSettings({ fontFamily });
  }, [updateEpubSettings]);

  // Increase font size
  const increaseFontSize = useCallback(() => {
    updateFontSize(epubSettings.fontSize + 1);
  }, [epubSettings.fontSize, updateFontSize]);

  // Decrease font size
  const decreaseFontSize = useCallback(() => {
    updateFontSize(epubSettings.fontSize - 1);
  }, [epubSettings.fontSize, updateFontSize]);

  // Reset font size
  const resetFontSize = useCallback(() => {
    updateFontSize(16);
  }, [updateFontSize]);

  // ResizeObserver to handle container resize (e.g., when assistant panel is resized)
  useEffect(() => {
    if (!rendition || !viewerRef.current) return;

    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    let animationFrameId: number | null = null;

    const resizeObserver = new ResizeObserver(() => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(() => {
        if (!initialDisplayCompleteRef.current) {
          return;
        }
        if (resizeTimeout) {
          clearTimeout(resizeTimeout);
        }
        resizeTimeout = setTimeout(() => {
          if (!rendition) return;
          try {
            rendition.resize();
          } catch {
            // Rendition may be destroyed during unmount while a resize is pending
          }
        }, 150);
      });
    });

    resizeObserver.observe(viewerRef.current);

    return () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      resizeObserver.disconnect();
    };
  }, [rendition]);

  useEffect(() => {
    let mounted = true;
    let bookInstance: any = null;
    let renditionInstance: any = null;
    let savePositionTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    const maxRetries = 10;

    const loadEPUB = async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (!fileUrl && !fileData) {
          throw new Error("No EPUB source available.");
        }
        if (fileUrl) {
        } else {
        }

        // Prefer URL source in Tauri to avoid heavy base64 decode on the renderer thread.
        // Fall back to in-memory bytes when URL is unavailable.
        const epubBook = fileUrl ? ePub(fileUrl) : ePub(fileData!.slice().buffer);
        bookInstance = epubBook;
        setBook(epubBook);

        // Wait for book to be ready
        await epubBook.ready;

        if (!mounted) return;

        const tocData = await epubBook.loaded.navigation;
        
        let filteredToc = tocData.toc;
        const startIdx = metadataRef.current?.chunkStartSpineIndex;
        const endIdx = metadataRef.current?.chunkEndSpineIndex;
        if (startIdx !== undefined || endIdx !== undefined) {
          try {
            await epubBook.loaded.spine;
            filteredToc = filterTocItems(tocData.toc, epubBook, startIdx, endIdx);
          } catch (e) {
            console.warn("EPUBViewer: Failed to filter TOC items:", e);
          }
        }

        setToc(filteredToc);
        tocRef.current = filteredToc;
        onLoadRef.current?.(filteredToc);

        const initializeRendition = async (): Promise<boolean> => {

          if (!viewerRef.current) {
            if (retryCount < maxRetries) {
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, 100));
              return initializeRendition();
            } else {
              console.error("EPUBViewer: viewerRef never became available");
              throw new Error("Failed to initialize EPUB viewer - container not available. Please try reopening the document.");
            }
          }

          // Check if container has dimensions (required for epubjs)
          const containerRect = viewerRef.current.getBoundingClientRect();
          if (containerRect.width === 0 || containerRect.height === 0) {
            if (retryCount < maxRetries) {
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, 100));
              return initializeRendition();
            } else {
              console.error("EPUBViewer: Container never got dimensions");
              throw new Error("Failed to initialize EPUB viewer - container has no size. Please try resizing the window.");
            }
          }

          const rendition = epubBook.renderTo(viewerRef.current, {
            width: "100%",
            height: "100%",
            spread: "none",
            flow: "scrolled",
            allowScriptedContent: true,
            manager: "continuous",
          });

          renditionInstance = rendition;
          setRendition(rendition);

          // Register hooks BEFORE displaying content
          // Try multiple hook types to ensure styles are applied
          rendition.hooks.render.register((_contents: any) => {
            // This fires when each section is rendered
          });

          // Inject global styles to override EPUB internal styles
          rendition.hooks.content.register((contents: any) => {

            // Disable all EPUB stylesheets by setting them to disabled
            const links = contents.document.querySelectorAll('link[rel="stylesheet"]');
            links.forEach((link: any) => {
              link.disabled = true;
              link.remove(); // Completely remove the stylesheet element
            });

            const styleTags = contents.document.querySelectorAll('style:not(#epub-override-styles)');
            styleTags.forEach((tag: any) => {
              tag.remove();
            });

            // More targeted inline style cleanup - only fix specific problematic elements
            // instead of iterating through ALL elements
            const problematicTags = contents.document.querySelectorAll('div[style], p[style], span[style]');
            problematicTags.forEach((el: any) => {
              if (el.style && el.style.overflow) {
                // Preserve overflow for scrolling
                const overflow = el.style.overflow;
                el.style.overflow = overflow;
              }
            });

            // Now inject our consistent styling
            applyContentOverrides(contents);
            const selectionHandler = () => handleSelectionChange(contents);
            contents.document.addEventListener("selectionchange", selectionHandler);
            contents.document.addEventListener("mouseup", selectionHandler);
            contents.document.addEventListener("touchend", selectionHandler);

            // Right-click context menu for selected text inside the EPUB iframe
            contents.document.addEventListener("contextmenu", (e: Event) => {
              const selection = contents.window.getSelection();
              const text = selection?.toString().trim();
              if (!text) return;
              e.preventDefault();
              const mouseEvent = e as unknown as MouseEvent;
              const iframe = (contents.window?.frameElement || viewerRef.current?.querySelector("iframe")) as HTMLIFrameElement | null;
              if (iframe) {
                const iframeRect = iframe.getBoundingClientRect();
                onContextMenuRef.current?.({
                  x: iframeRect.left + mouseEvent.clientX,
                  y: iframeRect.top + mouseEvent.clientY,
                  selectedText: text,
                  selectionContext: lastEpubSelectionContextRef.current,
                });
              }
            });

            // Key events inside the EPUB iframe don't reliably reach the parent window.
            // Bind Cmd/Ctrl+K here so the command palette always opens while reading.
            contents.window.addEventListener("keydown", handleCommandPaletteHotkey, true);
            contents.window.addEventListener("keydown", handleExtractTextHotkey, true);
            contents.window.addEventListener("keydown", (e: KeyboardEvent) => {
              if (handleEPUBKeyDownRef.current) {
                handleEPUBKeyDownRef.current(e);
              }
            }, true);
            
            // Auto-focus the iframe window to enable immediate keyboard navigation
            try {
              setTimeout(() => {
                contents.window.focus();
              }, 150);
            } catch { /* ignore */ }

            if (contents.window) {
              onIframeWindowReadyRef.current?.(contents.window);
            }
          });

          rendition.themes.register("default", {});
          applyRenditionTheme();

          // Display the book at saved position or start
          const savedPosition = await loadReadingPositionRef.current();
          const startIdx = metadataRef.current?.chunkStartSpineIndex;

          let displayTarget: any = null;
          if (initialCfiRef.current) {
            displayTarget = initialCfiRef.current;
          } else if (savedPosition) {
            displayTarget = savedPosition;
          } else if (startIdx !== undefined) {
            const spine = epubBook.spine;
            if (spine) {
              const item = spine.get(startIdx);
              if (item) {
                displayTarget = (item as any).cfi || item.href;
              }
            }
          }

          if (displayTarget) {
            lastDisplayedCfiRef.current = displayTarget;
            await rendition.display(displayTarget);
          } else {
            await rendition.display();
          }

          if (onContextTextChangeRef.current) {
            // Extract text from current chapter only (not entire book)
            const extractCurrentChapterText = () => {
              try {
                const contents = rendition?.getContents?.() as unknown as any[] | undefined;
                if (contents && contents.length > 0) {
                  const text = contents
                    .map((content: any) => content?.document?.body?.textContent?.trim())
                    .filter(Boolean)
                    .join("\n\n");
                  if (text && mounted) {
                    onContextTextChangeRef.current?.(text);
                  }
                }
              } catch (err) {
                console.warn("EPUBViewer: Failed to extract current chapter text:", err);
              }
            };

            setTimeout(() => {
              extractCurrentChapterText();
            }, 100);

            rendition.on("relocated", () => {
              setTimeout(() => {
                extractCurrentChapterText();
              }, 100);
            });
          }

          // Mark initial display as complete after a delay to allow content to render
          // This prevents resize events from causing blank page issues
          setTimeout(() => {
            if (mounted) {
              initialDisplayCompleteRef.current = true;
              // Force a resize to ensure proper rendering after content is stable
              if (rendition) {
                try { rendition.resize(undefined, undefined); } catch { /* ignore */ }
              }
            }
          }, 500);

          if (!mounted) return true;

          // Generate locations in the background to avoid blocking initial render
          const locationChunkSize = isMobile ? 800 : 1200;
          void epubBook.locations.generate(locationChunkSize).catch((err: unknown) => {
            console.warn("EPUBViewer: Failed to generate locations:", err);
          });

          const updateProgress = (location: any) => {
            if (!location || !location.start || !epubBook.locations) return;
            try {
              const percent = epubBook.locations.percentageFromCfi(location.start.cfi);
              if (typeof percent === "number" && !Number.isNaN(percent)) {
                const rounded = Math.round(percent * 100);
                setProgressPercent(rounded);
                onProgressChangeRef.current?.(rounded);
              }
            } catch {
              // Ignore progress calculation errors
            }
          };

          const resolveChapterLabel = (href: string | undefined) => {
            if (!href) return "";
            const searchToc = (items: any[]): string | null => {
              for (const item of items) {
                if (item.href === href || item.href?.endsWith?.(href)) {
                  return item.label;
                }
                if (item.subitems) {
                  const found = searchToc(item.subitems);
                  if (found) return found;
                }
              }
              return null;
            };
            return searchToc(tocRef.current) || "";
          };

          // Save position when location changes (debounced)
          const debouncedSavePosition = () => {
            if (savePositionTimer) {
              clearTimeout(savePositionTimer);
            }
            savePositionTimer = setTimeout(() => {
              try {
                const currentLocation = rendition.currentLocation() as any;
                if (currentLocation && currentLocation.start && mounted) {
                  saveReadingPositionRef.current(currentLocation.start.cfi);
                }
              } catch { /* ignore */ }
            }, 1000); // Save 1 second after last movement
          };

          // Track location changes to save reading position
          rendition.on("relocated", (location: any) => {
            if (!mounted) return;

            // Enforce spine boundaries
            const currentSpineIndex = location.start?.index;
            if (typeof currentSpineIndex === 'number') {
              const startIdx = metadataRef.current?.chunkStartSpineIndex;
              const endIdx = metadataRef.current?.chunkEndSpineIndex;
              
              if (startIdx !== undefined && currentSpineIndex < startIdx) {
                const spine = epubBook.spine || (bookInstance ? bookInstance.spine : null);
                if (spine) {
                  const item = spine.get(startIdx);
                  if (item) {
                    rendition.display(item.cfi || item.href);
                    return;
                  }
                }
              }
              
              if (endIdx !== undefined && currentSpineIndex > endIdx) {
                const spine = epubBook.spine || (bookInstance ? bookInstance.spine : null);
                if (spine) {
                  const item = spine.get(endIdx);
                  if (item) {
                    rendition.display(item.cfi || item.href);
                    return;
                  }
                }
              }
            }

            debouncedSavePosition();
            try { updateProgress(location); } catch { /* ignore */ }
            const chapter = resolveChapterLabel(location.start?.href || location.start?.page);
            if (chapter) {
              setCurrentChapter(chapter);
            }
            // Rebuild sync map when chapter changes
            const href = location.start?.href;
            if (href && href !== syncCurrentChapterRef.current && syncSegmentsRef.current.length > 0) {
              syncCurrentChapterRef.current = href;
              syncMapRef.current = new Map();
              setTimeout(() => buildSyncMapRef.current(), 300);
            }
          });

          // Enable text selection
          rendition.on("selected", (cfiRange: any, contents: any) => {
            const selection = contents.window.getSelection();
            if (selection && selection.toString()) {
              selectionActiveRef.current = true;
              const ctx: EpubSelectionContext = {
                type: "epub",
                documentId: documentId ?? "",
                cfiRange: String(cfiRange),
                selectedText: selection.toString(),
              };
              lastEpubSelectionContextRef.current = ctx;
              onSelectionChangeRef.current?.(selection.toString(), ctx);
            }
          });

          return true;
        };

        await initializeRendition();
      } catch (err) {
        console.error("EPUBViewer: Error loading EPUB:", err);
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load EPUB");
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadEPUB();

    return () => {
      mounted = false;
      if (savePositionTimer) {
        clearTimeout(savePositionTimer);
      }
      if (renditionInstance) {
        try {
          const location = renditionInstance.currentLocation?.();
          const cfi = location?.start?.cfi;
          if (cfi) {
            void saveReadingPositionRef.current(cfi);
          }
        } catch { /* ignore */ }
        try { renditionInstance.destroy(); } catch { /* ignore */ }
      }
      if (bookInstance) {
        try { bookInstance.destroy(); } catch { /* ignore */ }
      }
    };
    // Note: onLoad, onContextTextChange, onSelectionChange, and onProgressChange are
    // intentionally excluded from deps - they use refs to avoid destroying and
    // recreating the EPUB book when parent callbacks change.
  }, [fileData, fileUrl, documentId]);

  const lastDisplayedCfiRef = useRef<string | null>(null);

  useEffect(() => {
    if (rendition && initialCfi && initialCfi !== lastDisplayedCfiRef.current) {
      lastDisplayedCfiRef.current = initialCfi;
      rendition.display(initialCfi);
    }
  }, [rendition, initialCfi]);

  // Re-apply styles when settings or theme change
  useEffect(() => {
    applyRenditionTheme();
  }, [applyRenditionTheme, epubSettings.fontFamily, epubSettings.fontSize, epubSettings.lineHeight, theme]);

  const removeSearchAnnotations = useCallback((cfis: string[]) => {
    if (!rendition || cfis.length === 0) return;
    for (const cfi of cfis) {
      try {
        rendition.annotations?.remove?.(cfi, "highlight");
      } catch {
        // ignore
      }
    }
  }, [rendition]);

  const reportLiveSearchResults = useCallback((query: string, results: string[], requestedIndex?: number | null) => {
    const total = results.length;
    const activeIndex = total === 0
      ? -1
      : typeof requestedIndex === "number" && Number.isFinite(requestedIndex)
        ? ((Math.trunc(requestedIndex) % total) + total) % total
        : 0;

    onSearchResultsChangeRef.current?.({
      query,
      total,
      activeIndex,
      activeCfi: total > 0 ? results[activeIndex] : null,
    });
  }, []);

  const searchVisibleContents = useCallback((query: string): string[] => {
    if (!rendition || !query.trim()) return [];

    const escapedQuery = escapeRegex(query.trim());
    // Match the full phrase, allowing flexible whitespace between words
    const flexibleRegex = escapedQuery.replace(/\\\s+/g, "\\s+");
    const regex = new RegExp(flexibleRegex, "gi");
    const cfis: string[] = [];
    const seen = new Set<string>();

    try {
      const contentsList = rendition.getContents?.() ?? [];
      for (const contents of contentsList) {
        const doc = contents?.document as Document | undefined;
        const body = doc?.body;
        if (!body) continue;

        const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode as Text;
          const value = node.nodeValue ?? "";
          if (!value.trim()) continue;

          let match: RegExpExecArray | null;
          regex.lastIndex = 0;
          while ((match = regex.exec(value)) !== null) {
            try {
              const range = doc.createRange();
              range.setStart(node, match.index);
              range.setEnd(node, match.index + match[0].length);
              const cfi = contents.cfiFromRange?.(range);
              range.detach?.();
              if (cfi && !seen.has(cfi)) {
                seen.add(cfi);
                cfis.push(String(cfi));
              }
            } catch {
              // ignore individual range failures
            }

            if (match[0].length === 0) {
              regex.lastIndex += 1;
            }
          }
        }
      }
    } catch (error) {
      console.warn("EPUBViewer: visible-content search failed:", error);
    }

    return cfis;
  }, [rendition]);

  const renderLiveSearchHighlights = useCallback(async (
    results: string[],
    requestedIndex?: number | null,
    options?: { navigate?: boolean }
  ) => {
    if (!rendition) return;

    removeSearchAnnotations(liveSearchHighlightsRef.current);
    liveSearchHighlightsRef.current = [];
    activeLiveSearchCfiRef.current = null;

    if (results.length === 0) {
      reportLiveSearchResults(searchQuery?.trim() ?? "", [], requestedIndex);
      return;
    }

    const activeIndex = typeof requestedIndex === "number" && Number.isFinite(requestedIndex)
      ? ((Math.trunc(requestedIndex) % results.length) + results.length) % results.length
      : 0;
    const activeCfi = results[activeIndex] ?? null;

    for (let i = 0; i < results.length; i++) {
      const cfi = results[i];
      const className = i === activeIndex ? "epub-search-highlight-active" : "epub-search-highlight";
      try {
        rendition.annotations?.highlight?.(cfi, {}, undefined, className);
        liveSearchHighlightsRef.current.push(cfi);
      } catch {
        // ignore
      }
    }

    activeLiveSearchCfiRef.current = activeCfi;

    if (activeCfi && options?.navigate !== false) {
      try {
        await rendition.display(activeCfi);
      } catch {
        // ignore
      }
    }

    reportLiveSearchResults(searchQuery?.trim() ?? "", results, activeIndex);
  }, [removeSearchAnnotations, rendition, reportLiveSearchResults, searchQuery]);

  const applySearchHighlights = useCallback(async () => {
    if (!highlightQuery || !highlightQuery.trim()) return;
    if (!rendition || !book) return;

    try {
      for (const cfi of activeSearchHighlightsRef.current) {
        rendition.annotations?.remove?.(cfi, "highlight");
      }
    } catch {
      // ignore
    }
    activeSearchHighlightsRef.current = [];

    const query = highlightQuery.trim();
    let results: any[] = [];
    try {
      if (typeof (book as any).search === "function") {
        results = await (book as any).search(query);
      }
    } catch (error) {
      console.warn("EPUBViewer: book.search failed:", error);
      results = [];
    }

    const indexedResults = (results || [])
      .map((result: any) => ({
        cfi: result?.cfi ? String(result.cfi) : "",
        excerpt: typeof result?.excerpt === "string" ? result.excerpt : "",
        text: typeof result?.text === "string" ? result.text : "",
      }))
      .filter((result) => result.cfi)
      .slice(0, 30);

    let cfis = indexedResults
      .map((r) => r.cfi)
      .filter(Boolean)
      .map((cfi: any) => String(cfi));

    // Fall back to visible-content DOM search when book.search returns nothing
    if (cfis.length === 0) {
      cfis = searchVisibleContents(query);
    }

    if (cfis.length > 0) {
      const targetIndex =
        indexedResults.length > 0
          ? chooseSearchResultIndex(indexedResults, initialSearchMatchIndex, initialSearchTextQuote)
          : typeof initialSearchMatchIndex === "number" && Number.isFinite(initialSearchMatchIndex)
            ? ((Math.trunc(initialSearchMatchIndex) % cfis.length) + cfis.length) % cfis.length
            : 0;
      const targetCfi = cfis[targetIndex] ?? cfis[0];

      if (!initialCfi && targetCfi) {
        try {
          await rendition.display(targetCfi);
        } catch {
          // ignore
        }
      }

      for (let i = 0; i < cfis.length; i++) {
        const cfi = cfis[i];
        try {
          rendition.annotations?.highlight?.(
            cfi,
            {},
            undefined,
            i === targetIndex ? "epub-search-highlight-active" : "epub-search-highlight"
          );
          activeSearchHighlightsRef.current.push(cfi);
        } catch {
          // ignore
        }
      }
    }
  }, [book, highlightQuery, initialCfi, initialSearchMatchIndex, initialSearchTextQuote, rendition, searchVisibleContents]);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (cancelled) return;
      console.warn("EPUBViewer: applySearchHighlights timed out, skipping exact navigation");
    }, 3000);
    applySearchHighlights().finally(() => {
      clearTimeout(timeout);
    });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      try {
        for (const cfi of activeSearchHighlightsRef.current) {
          rendition?.annotations?.remove?.(cfi, "highlight");
        }
      } catch {
        // ignore
      }
      activeSearchHighlightsRef.current = [];
    };
  }, [applySearchHighlights, rendition]);

  useEffect(() => {
    if (!rendition || !book) return;

    const trimmedQuery = searchQuery?.trim() ?? "";
    const searchVersion = ++liveSearchVersionRef.current;

    if (!trimmedQuery) {
      liveSearchResultsRef.current = [];
      activeLiveSearchCfiRef.current = null;
      removeSearchAnnotations(liveSearchHighlightsRef.current);
      liveSearchHighlightsRef.current = [];
      reportLiveSearchResults("", [], null);
      return;
    }

    // Debounce: only run the heavy search after user stops typing
    const debounceTimer = setTimeout(async () => {
      let results: any[] = [];
      let visibleCfis: string[] = [];
      try {
        if (typeof (book as any).search === "function") {
          results = await (book as any).search(trimmedQuery);
        }
      } catch (error) {
        console.warn("EPUBViewer: live search failed:", error);
        results = [];
      }

      visibleCfis = searchVisibleContents(trimmedQuery);

      if (liveSearchVersionRef.current !== searchVersion) {
        return;
      }

      const indexedResults = (results || [])
        .map((result: any) => ({
          cfi: result?.cfi ?? result?.cfiRange,
          excerpt: result?.excerpt,
          text: result?.text,
          chapter: result?.chapter,
          href: result?.href,
        }))
        .filter((result) => result.cfi)
        .map((result) => ({ ...result, cfi: String(result.cfi) }));
      const indexedCfis = indexedResults.map((result) => result.cfi);
      const cfis = Array.from(new Set([
        ...indexedCfis,
        ...visibleCfis,
      ]));

      liveSearchResultsRef.current = cfis;
      const targetIndex =
        indexedResults.length > 0
          ? chooseSearchResultIndex(indexedResults, searchMatchIndex, initialSearchTextQuote)
          : searchMatchIndex;

      await renderLiveSearchHighlights(cfis, targetIndex, {
        navigate: cfis.length > 0,
      });
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [book, initialSearchTextQuote, rendition, removeSearchAnnotations, renderLiveSearchHighlights, reportLiveSearchResults, searchMatchIndex, searchQuery, searchVisibleContents]);

  useEffect(() => {
    if (!rendition) return;
    if (!(searchQuery?.trim())) return;
    if (liveSearchResultsRef.current.length === 0) return;

    void renderLiveSearchHighlights(liveSearchResultsRef.current, searchMatchIndex, {
      navigate: true,
    });
  }, [rendition, renderLiveSearchHighlights, searchMatchIndex, searchQuery]);

  useEffect(() => {
    if (!rendition) return;

    try {
      for (const cfi of activePersistedHighlightsRef.current) {
        rendition.annotations?.remove?.(cfi, "highlight");
      }
    } catch {
      // ignore
    }
    activePersistedHighlightsRef.current = [];

    for (const highlight of persistedHighlights) {
      try {
        rendition.annotations?.highlight?.(
          highlight.cfiRange,
          {},
          undefined,
          "epub-persisted-highlight",
          { "background-color": normalizeHighlightColor(highlight.color) }
        );
        activePersistedHighlightsRef.current.push(highlight.cfiRange);
      } catch (error) {
        console.warn("EPUBViewer: Failed to render persisted highlight", error);
      }
    }

    return () => {
      try {
        for (const cfi of activePersistedHighlightsRef.current) {
          rendition.annotations?.remove?.(cfi, "highlight");
        }
      } catch {
        // ignore
      }
      activePersistedHighlightsRef.current = [];
    };
  }, [persistedHighlights, removeSearchAnnotations, rendition]);

  useEffect(() => {
    return () => {
      removeSearchAnnotations(liveSearchHighlightsRef.current);
      liveSearchHighlightsRef.current = [];
      liveSearchResultsRef.current = [];
      activeLiveSearchCfiRef.current = null;
    };
  }, [removeSearchAnnotations]);

  const handlePrevPage = () => {
    if (rendition) {
      const startIdx = metadata?.chunkStartSpineIndex;
      if (startIdx !== undefined) {
        const location = rendition.currentLocation() as any;
        const currentSpineIndex = location?.start?.index;
        if (typeof currentSpineIndex === 'number' && currentSpineIndex <= startIdx) {
          return;
        }
      }
      rendition.prev();
    }
  };

  const handleNextPage = () => {
    if (rendition) {
      const endIdx = metadata?.chunkEndSpineIndex;
      if (endIdx !== undefined) {
        const location = rendition.currentLocation() as any;
        const currentSpineIndex = location?.start?.index;
        if (typeof currentSpineIndex === 'number' && currentSpineIndex >= endIdx) {
          return;
        }
      }
      rendition.next();
    }
  };

  // Watch for TTS chapter advance signal
  const chapterSignalRef = useRef(advanceChapterSignal);
  useEffect(() => {
    if (advanceChapterSignal !== undefined && advanceChapterSignal !== chapterSignalRef.current) {
      chapterSignalRef.current = advanceChapterSignal;
      handleNextPage();
    }
  }, [advanceChapterSignal]);

  const buildSyncMapForChapter = useCallback(() => {
    if (!rendition || syncSegmentsRef.current.length === 0) return;

    const contentsList = rendition.getContents?.() ?? [];
    if (contentsList.length === 0) return;

    for (const contents of contentsList) {
      const map = buildSegmentCfiMap(contents, syncSegmentsRef.current);
      if (map.size > 0) {
        syncMapRef.current = map;
        onSyncStateChange?.({
          status: "ready",
          mappedCount: map.size,
          totalSegments: syncSegmentsRef.current.length,
        });
        return;
      }
    }

    onSyncStateChange?.({
      status: "error",
      mappedCount: 0,
      totalSegments: syncSegmentsRef.current.length,
    });
  }, [rendition, onSyncStateChange]);

  // Ref so the relocated handler can call the latest version
  const buildSyncMapRef = useRef(buildSyncMapForChapter);
  buildSyncMapRef.current = buildSyncMapForChapter;

  // Keep syncSegments ref up to date
  useEffect(() => {
    syncSegmentsRef.current = syncSegments ?? [];
    syncMapRef.current = new Map();
    syncCurrentChapterRef.current = null;
    if (syncSegments && syncSegments.length > 0) {
      onSyncStateChange?.({ status: "building", mappedCount: 0, totalSegments: syncSegments.length });
      const timer = setTimeout(() => buildSyncMapRef.current(), 300);
      return () => clearTimeout(timer);
    } else {
      onSyncStateChange?.({ status: "idle", mappedCount: 0, totalSegments: 0 });
    }
  }, [syncSegments, buildSyncMapForChapter, onSyncStateChange]);

  // Audiobook sync: highlight active segment
  const lastSyncSegmentIdxRef = useRef<number | null>(null);
  const syncJumpSignalRef = useRef(syncJumpSignal);
  useEffect(() => {
    // syncJumpSignal forces re-highlight of current segment
    if (syncJumpSignal !== undefined && syncJumpSignal !== syncJumpSignalRef.current) {
      syncJumpSignalRef.current = syncJumpSignal;
      lastSyncSegmentIdxRef.current = null; // force re-process
    }
  }, [syncJumpSignal]);

  useEffect(() => {
    if (!rendition || !syncSegments || syncSegments.length === 0) return;
    if (syncCurrentTime === undefined || syncCurrentTime === null) return;
    if (syncMapRef.current.size === 0) return;

    const active = findActiveSegment(syncSegments, syncCurrentTime);
    if (!active || active.index === lastSyncSegmentIdxRef.current) return;

    const cfi = syncMapRef.current.get(active.index);
    if (!cfi) return;

    lastSyncSegmentIdxRef.current = active.index;

    if (activeSyncHighlightRef.current) {
      try { rendition.annotations?.remove?.(activeSyncHighlightRef.current, "highlight"); } catch { /* ignore */ }
    }

    // Add new highlight
    try {
      rendition.annotations?.highlight?.(cfi, {}, undefined, "epub-sync-highlight");
      activeSyncHighlightRef.current = cfi;
    } catch { /* ignore */ }

    // Auto-scroll
    try {
      syncNavigatingRef.current = true;
      rendition.display(cfi);
      setTimeout(() => { syncNavigatingRef.current = false; }, 500);
    } catch { /* ignore */ }
  }, [rendition, syncSegments, syncCurrentTime, syncJumpSignal]);

  const handleTocClick = async (href: string) => {
    if (!rendition || !book) {
      console.warn("EPUBViewer: Cannot navigate - rendition or book not ready");
      return;
    }

    try {
      const normalizeHref = (value: string) =>
        value.replace(/^\.?\//, "").split("#")[0];
      const [rawPath, rawFragment] = href.split("#");
      const normalizedPath = normalizeHref(rawPath);

      const spine = await book.loaded.spine;

      // Try to find the spine item by href
      let spineItem = spine.get(normalizedPath);

      // If not found directly, try to find by searching the spine
      if (!spineItem) {
        // Search through spine items for a match
        for (const item of spine.items) {
          const itemHref = normalizeHref(item.href || "");
          if (itemHref === normalizedPath || itemHref?.endsWith?.(normalizedPath)) {
            spineItem = item;
            break;
          }
        }
      }

      // If we found the spine item, navigate to it
      if (spineItem) {
        const targetHref = rawFragment ? `${spineItem.href}#${rawFragment}` : spineItem.href;

        // Method 1: Use rendition.display with the full href (preserves anchor fragments)
        try {
          await rendition.display(targetHref);
          return;
        } catch (e) {
          console.error("EPUBViewer: rendition.display failed:", e);
        }

        // Method 2: Use spine.goto with index (ignores fragments, but works as fallback)
        try {
          if (typeof spineItem.index === 'number') {
            await spine.goto(spineItem.index);
            return;
          }
        } catch (e) {
          console.error("EPUBViewer: spine.goto with index failed:", e);
        }

        // Method 3: Try navigating to the URL directly
        try {
          await rendition.display(spineItem.url || targetHref);
          return;
        } catch (e) {
          console.error("EPUBViewer: URL navigation failed:", e);
        }

        console.warn("EPUBViewer: All navigation methods failed for href:", href);
        return;
      }

      // Fallback: Try to navigate to the href directly
      try {
        await rendition.display(rawFragment ? `${normalizedPath}#${rawFragment}` : normalizedPath);
        return;
      } catch (e) {
        console.error("EPUBViewer: Direct href navigation failed:", e);
      }

      // Try searching through TOC to find a matching item
      const searchToc = (items: any[]): any => {
        for (const item of items) {
          if (item.href === href || item.href?.endsWith?.(href)) {
            return item;
          }
          if (item.subitems) {
            const found = searchToc(item.subitems);
            if (found) return found;
          }
        }
        return null;
      };

      const tocItem = searchToc(toc);
      if (tocItem) {
        const tocPath = normalizeHref(tocItem.href || "");
        await rendition.display(tocPath || tocItem.href);
        return;
      }

      console.warn("EPUBViewer: Could not resolve TOC href:", href);
    } catch (error) {
      console.error("EPUBViewer: Error navigating to TOC item:", error);
    }
  };

  const scrollEpub = useCallback((direction: "up" | "down") => {
    const step = 120;
    const target = direction === "down" ? step : -step;

    const getScrollableElement = (root: HTMLElement): HTMLElement | null => {
      // Prevent traversing inside iframes to avoid getting hijacked by sub-documents
      if (root.tagName === "IFRAME") return null;

      if (root.scrollHeight > root.clientHeight) {
        const style = window.getComputedStyle(root);
        if (style.overflowY === "auto" || style.overflowY === "scroll") {
          return root;
        }
      }
      for (let i = 0; i < root.children.length; i++) {
        const child = root.children[i] as HTMLElement;
        const found = getScrollableElement(child);
        if (found) return found;
      }
      return null;
    };

    const root = viewerRef.current;
    if (root) {
      const scrollable = getScrollableElement(root);
      if (scrollable) {
        scrollable.scrollBy({ top: target, behavior: "smooth" });
        return;
      }
    }

    const iframe = viewerRef.current?.querySelector("iframe");
    if (iframe?.contentWindow) {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        const el = doc.scrollingElement || doc.documentElement || doc.body;
        if (el) {
          el.scrollBy({ top: target, behavior: "smooth" });
        }
      } catch (e) {
        console.warn("EPUBViewer: Failed to scroll iframe:", e);
      }
    }
  }, []);

  const getFlatToc = useCallback(() => {
    const flat: any[] = [];
    const traverse = (items: any[]) => {
      for (const item of items) {
        flat.push(item);
        if (item.subitems && item.subitems.length > 0) {
          traverse(item.subitems);
        }
      }
    };
    traverse(tocRef.current || []);
    return flat;
  }, []);

  const getCurrentTocIndex = useCallback((flat: any[]) => {
    if (!rendition) return -1;
    try {
      const currentLocation = rendition.currentLocation() as any;
      const currentHref = currentLocation?.start?.href;
      if (!currentHref) return -1;

      const normalize = (h: string) => h.replace(/^\.?\//, "").split("#")[0];
      const normCurrent = normalize(currentHref);

      let index = flat.findIndex(item => item.href && normalize(item.href) === normCurrent);
      if (index !== -1) return index;

      index = flat.findIndex(item => item.href && (normalize(item.href).endsWith(normCurrent) || normCurrent.endsWith(normalize(item.href))));
      return index;
    } catch {
      return -1;
    }
  }, [rendition]);

  const handlePrevToc = useCallback(async () => {
    const flat = getFlatToc();
    if (flat.length === 0) return;
    const currentIndex = getCurrentTocIndex(flat);
    if (currentIndex > 0) {
      await handleTocClick(flat[currentIndex - 1].href);
    } else if (currentIndex === -1) {
      await handleTocClick(flat[0].href);
    }
  }, [getFlatToc, getCurrentTocIndex, handleTocClick]);

  const handleNextToc = useCallback(async () => {
    const flat = getFlatToc();
    if (flat.length === 0) return;
    const currentIndex = getCurrentTocIndex(flat);
    if (currentIndex !== -1 && currentIndex < flat.length - 1) {
      await handleTocClick(flat[currentIndex + 1].href);
    } else if (currentIndex === -1) {
      await handleTocClick(flat[0].href);
    }
  }, [getFlatToc, getCurrentTocIndex, handleTocClick]);

  const handleEPUBKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger if typing in input
    if ((e.target as HTMLElement).tagName === "INPUT" ||
      (e.target as HTMLElement).tagName === "TEXTAREA" ||
      (e.target as HTMLElement).isContentEditable) {
      return;
    }

    const lowerKey = e.key.toLowerCase();

    // Ctrl/Cmd + Plus to increase font size
    if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) {
      e.preventDefault();
      increaseFontSize();
    }
    // Ctrl/Cmd + Minus to decrease font size
    else if ((e.ctrlKey || e.metaKey) && (e.key === "-" || e.key === "_")) {
      e.preventDefault();
      decreaseFontSize();
    }
    // Ctrl/Cmd + 0 to reset font size
    else if ((e.ctrlKey || e.metaKey) && e.key === "0") {
      e.preventDefault();
      resetFontSize();
    }
    
    // J / K scroll navigation (suppressed when vim reading mode is active)
    else if (lowerKey === "j") {
      if (useVimModeStore.getState().mode === "inactive") {
        e.preventDefault();
        scrollEpub("down");
      }
    } else if (lowerKey === "k") {
      if (useVimModeStore.getState().mode === "inactive") {
        e.preventDefault();
        scrollEpub("up");
      }
    }

    // H / L and Arrow keys for TOC navigation (suppressed when vim mode is active)
    else if (lowerKey === "h" || e.key === "ArrowLeft") {
      if (useVimModeStore.getState().mode === "inactive") {
        e.preventDefault();
        void handlePrevToc();
      }
    } else if (lowerKey === "l" || e.key === "ArrowRight") {
      if (useVimModeStore.getState().mode === "inactive") {
        e.preventDefault();
        void handleNextToc();
      }
    }

    // Home / End boundaries
    else if (e.key === "Home") {
      e.preventDefault();
      const flat = getFlatToc();
      if (flat.length > 0) {
        void handleTocClick(flat[0].href);
      }
    } else if (e.key === "End") {
      e.preventDefault();
      const flat = getFlatToc();
      if (flat.length > 0) {
        void handleTocClick(flat[flat.length - 1].href);
      }
    }
  }, [decreaseFontSize, increaseFontSize, resetFontSize, scrollEpub, handlePrevToc, handleNextToc, getFlatToc, handleTocClick]);

  // Keep ref up to date on every render
  useEffect(() => {
    handleEPUBKeyDownRef.current = handleEPUBKeyDown;
  }, [handleEPUBKeyDown]);

  useEffect(() => {
    if (isMobile) return;

    const handleWheel = (e: WheelEvent) => {
      // Ctrl/Cmd + Scroll to change font size
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          increaseFontSize();
        } else {
          decreaseFontSize();
        }
      }
    };

    window.addEventListener("keydown", handleEPUBKeyDown);
    const viewerElement = viewerRef.current;
    if (viewerElement) {
      viewerElement.addEventListener("wheel", handleWheel, { passive: false });
    }

    return () => {
      window.removeEventListener("keydown", handleEPUBKeyDown);
      if (viewerElement) {
        viewerElement.removeEventListener("wheel", handleWheel);
      }
    };
  }, [handleEPUBKeyDown, decreaseFontSize, increaseFontSize, isMobile]);

  const handleReaderTap = (event: MouseEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    if ((event.target as HTMLElement).closest('[data-chrome-control="true"]')) {
      return;
    }
    if (selectionActiveRef.current) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const zone = x / rect.width;

    if (zone < 0.33) {
      handlePrevPage();
      return;
    }
    if (zone > 0.66) {
      handleNextPage();
      return;
    }

    setChromeVisible((prev) => !prev);
  };

  const handleCommandPaletteHotkey = useCallback((e: KeyboardEvent) => {
    if (isCommandPaletteOpenShortcut(e)) {
      e.preventDefault();
      dispatchCommandPaletteOpen();
    }
  }, []);

  const handleExtractTextHotkey = useCallback((e: KeyboardEvent) => {
    const combo = getShortcutCombo("edit.extract-text");
    if (combo && eventMatchesCombo(e, combo)) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("extract-text"));
    }
  }, []);

  const handleSelectionChange = useCallback((contents: any) => {
    const selection = contents.window.getSelection();
    const selectedText = selection?.toString().trim() || "";
    const hasSelection = selectedText.length > 0;
    selectionActiveRef.current = hasSelection;
    // Always notify parent of selection changes (both selection and clearing)
    onSelectionChange?.(selectedText);
  }, [onSelectionChange]);

  return (
    <div
      className="flex flex-col h-full bg-background relative overflow-hidden"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg m-4">
          {t("viewer.failedToLoadEpub", { error })}
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-50">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <div className="text-muted-foreground">{t("viewer.loadingEpub")}</div>
          </div>
        </div>
      )}

      {!isMobile && (
        <>
          {/* Font size control panel */}
          <div
            className={cn(
              "absolute top-4 right-16 z-30 bg-card border border-border rounded-lg shadow-lg transition-all",
              showFontSizeControl ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          >
            <div className="p-3 space-y-2">
              <div className="text-xs font-medium text-muted-foreground mb-2">{t("viewer.fontSize")}</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={decreaseFontSize}
                  className="p-1 rounded hover:bg-muted transition-colors"
                  title={t("viewer.decreaseFontSize")}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <span className="text-sm font-medium min-w-[50px] text-center">{epubSettings.fontSize}px</span>
                <button
                  onClick={increaseFontSize}
                  className="p-1 rounded hover:bg-muted transition-colors"
                  title={t("viewer.increaseFontSize")}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
              <button
                onClick={resetFontSize}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("viewer.reset")}
              </button>
            </div>
          </div>

          {/* Floating font size toggle button */}
          <button
            onClick={() => setShowFontSizeControl(!showFontSizeControl)}
            className="absolute top-4 right-4 z-30 p-2 bg-card border border-border rounded-lg shadow-md hover:shadow-lg transition-all"
            title={t("viewer.fontSizeSettings")}
          >
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </button>
        </>
      )}

      {isMobile && (
        <>
          {/* Tap area to toggle chrome - small trigger zones at edges, not full coverage */}
          {chromeVisible ? (
            // When visible, just a small tap area to hide (top bar area already handles this)
            <div
              className="absolute inset-x-0 bottom-0 h-20 z-30 pointer-events-auto"
              onClick={() => setChromeVisible(false)}
              aria-hidden="true"
            />
          ) : (
            // When hidden, small edge triggers to show
            <>
              <div
                className="absolute inset-x-0 top-0 h-16 z-30 pointer-events-auto"
                onClick={() => setChromeVisible(true)}
                aria-hidden="true"
              />
              <div
                className="absolute inset-x-0 bottom-0 h-16 z-30 pointer-events-auto"
                onClick={() => setChromeVisible(true)}
                aria-hidden="true"
              />
            </>
          )}

          {/* Mobile chrome - Top Bar */}
          <div
            className={cn(
              "absolute left-0 right-0 top-0 z-40 transition-all duration-300",
              chromeVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full pointer-events-none"
            )}
          >
            <div className="mx-3 mt-3 rounded-2xl bg-background/95 backdrop-blur border border-border shadow-lg">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground truncate">{fileName}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {currentChapter || t("viewer.reading")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-chrome-control="true"
                    onClick={() => setShowTocDrawer(true)}
                    className="px-3 py-1.5 text-xs rounded-full border border-border bg-card text-foreground"
                  >
                    TOC
                  </button>
                  <button
                    type="button"
                    data-chrome-control="true"
                    onClick={() => setShowSettingsSheet(true)}
                    className="px-3 py-1.5 text-xs rounded-full border border-border bg-card text-foreground"
                  >
                    Aa
                  </button>
                  <button
                    type="button"
                    data-chrome-control="true"
                    onClick={() => setChromeVisible(false)}
                    className="p-1.5 rounded-full border border-border bg-card text-foreground"
                    aria-label={t("viewer.hideToolbar")}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile chrome - Bottom Bar */}
          <div
            className={cn(
              "absolute left-0 right-0 bottom-0 z-40 transition-all duration-300 pb-[env(safe-area-inset-bottom)]",
              chromeVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-full pointer-events-none"
            )}
          >
            <div className="mx-3 mb-16 rounded-2xl bg-background/95 backdrop-blur border border-border shadow-lg">
              <div className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{progressPercent}%</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-chrome-control="true"
                      onClick={handlePrevPage}
                      className="px-3 py-1.5 text-xs rounded-full border border-border bg-card text-foreground"
                    >
                      {t("viewer.prev")}
                    </button>
                    <button
                      type="button"
                      data-chrome-control="true"
                      onClick={handleNextPage}
                      className="px-3 py-1.5 text-xs rounded-full border border-border bg-card text-foreground"
                    >
                      {t("viewer.next")}
                    </button>
                    <button
                      type="button"
                      data-chrome-control="true"
                      onClick={() => setChromeVisible(false)}
                      className="p-1.5 rounded-full border border-border bg-card text-foreground"
                      aria-label={t("viewer.hideToolbar")}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Floating Expand Buttons (when chrome is hidden) */}
          {!chromeVisible && (
            <>
              {/* Top-left: Show toolbar button */}
              <button
                type="button"
                onClick={() => setChromeVisible(true)}
                className="absolute top-4 left-4 z-40 p-2.5 rounded-full bg-background/95 backdrop-blur border border-border shadow-lg active:scale-95 transition-all"
                aria-label={t("viewer.showToolbar")}
              >
                <ChevronDown className="w-5 h-5 text-foreground" />
              </button>

              {/* Top-right: TOC quick access */}
              <button
                type="button"
                onClick={() => setShowTocDrawer(true)}
                className="absolute top-4 right-16 z-40 p-2.5 rounded-full bg-background/95 backdrop-blur border border-border shadow-lg active:scale-95 transition-all"
                aria-label={t("viewer.openTableOfContents")}
              >
                <Menu className="w-5 h-5 text-foreground" />
              </button>

              {/* Top-right: Settings quick access */}
              <button
                type="button"
                onClick={() => setShowSettingsSheet(true)}
                className="absolute top-4 right-4 z-40 p-2.5 rounded-full bg-background/95 backdrop-blur border border-border shadow-lg active:scale-95 transition-all"
                aria-label={t("viewer.openSettings")}
              >
                <Settings className="w-5 h-5 text-foreground" />
              </button>

              {/* Bottom center: Show toolbar & progress */}
              <button
                type="button"
                onClick={() => setChromeVisible(true)}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full bg-background/95 backdrop-blur border border-border shadow-lg active:scale-95 transition-all flex items-center gap-2"
                aria-label={t("viewer.showToolbar")}
              >
                <ChevronUp className="w-4 h-4 text-foreground" />
                <span className="text-xs font-medium text-foreground">{progressPercent}%</span>
              </button>
            </>
          )}

          {/* Mobile TOC drawer */}
          {showTocDrawer && (
            <div className="absolute inset-0 z-50 bg-background/60 backdrop-blur-sm" onClick={() => setShowTocDrawer(false)}>
              <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-border bg-card max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
                  <div className="text-sm font-semibold text-foreground">{t("viewer.tableOfContents")}</div>
                  <button
                    type="button"
                    data-chrome-control="true"
                    onClick={() => setShowTocDrawer(false)}
                    className="text-sm text-muted-foreground px-3 py-2 min-h-[44px]"
                  >
                    {t("viewer.close")}
                  </button>
                </div>
                <div className="overflow-y-auto flex-1">
                  {toc.map((chapter, index) => (
                    <button
                      key={index}
                      data-chrome-control="true"
                      onClick={() => {
                        handleTocClick(chapter.href);
                        setShowTocDrawer(false);
                      }}
                      className="block w-full text-left px-4 py-3 text-sm text-foreground border-b border-border/40 hover:bg-muted transition-colors min-h-[48px]"
                    >
                      {chapter.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Mobile settings sheet */}
          {showSettingsSheet && (
            <div className="absolute inset-0 z-50 bg-background/60 backdrop-blur-sm" onClick={() => setShowSettingsSheet(false)}>
              <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-border bg-card p-4 space-y-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-foreground">{t("viewer.readingSettings")}</div>
                  <button
                    type="button"
                    data-chrome-control="true"
                    onClick={() => setShowSettingsSheet(false)}
                    className="text-sm text-muted-foreground px-3 py-2 min-h-[44px]"
                  >
                    {t("viewer.close")}
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">{t("viewer.fontSize")}</div>
                  <div className="flex items-center justify-center gap-4">
                    <button
                      type="button"
                      data-chrome-control="true"
                      onClick={decreaseFontSize}
                      className="px-4 py-3 text-sm rounded-full border border-border bg-card text-foreground min-w-[60px] min-h-[44px] hover:bg-muted transition-colors"
                    >
                      A-
                    </button>
                    <div className="text-base font-medium text-foreground min-w-[60px] text-center">{epubSettings.fontSize}px</div>
                    <button
                      type="button"
                      data-chrome-control="true"
                      onClick={increaseFontSize}
                      className="px-4 py-3 text-sm rounded-full border border-border bg-card text-foreground min-w-[60px] min-h-[44px] hover:bg-muted transition-colors"
                    >
                      A+
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">{t("viewer.lineHeight")}</div>
                  <div className="flex items-center justify-center gap-4">
                    <button
                      type="button"
                      data-chrome-control="true"
                      onClick={() => updateLineHeight(epubSettings.lineHeight - 0.1)}
                      className="px-4 py-3 text-sm rounded-full border border-border bg-card text-foreground min-w-[60px] min-h-[44px] hover:bg-muted transition-colors"
                    >
                      -
                    </button>
                    <div className="text-base font-medium text-foreground min-w-[60px] text-center">{epubSettings.lineHeight.toFixed(2)}</div>
                    <button
                      type="button"
                      data-chrome-control="true"
                      onClick={() => updateLineHeight(epubSettings.lineHeight + 0.1)}
                      className="px-4 py-3 text-sm rounded-full border border-border bg-card text-foreground min-w-[60px] min-h-[44px] hover:bg-muted transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">{t("viewer.font")}</div>
                  <div className="flex items-center gap-2">
                    {(["serif", "sans-serif", "monospace"] as const).map((family) => (
                      <button
                        key={family}
                        type="button"
                        data-chrome-control="true"
                        onClick={() => updateFontFamily(family)}
                        className={cn(
                          "px-3 py-1.5 text-xs rounded-full border",
                          epubSettings.fontFamily === family
                            ? "border-primary text-primary"
                            : "border-border text-foreground"
                        )}
                      >
                        {family === "sans-serif" ? t("viewer.sans") : family === "serif" ? t("viewer.serif") : t("viewer.mono")}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Main content area with sidebar and viewer */}
      <div className="flex flex-1 overflow-hidden relative" onClick={handleReaderTap}>
        {/* Sidebar - Table of Contents (sibling to viewer) */}
        {!isMobile && toc.length > 0 && showDesktopToc && (
          <div className="w-64 border-r border-border bg-card overflow-y-auto z-10 flex-shrink-0">
            <div className="p-4 border-b border-border flex items-center justify-between gap-3">
              <h3 className="font-semibold text-foreground">{t("viewer.tableOfContents")}</h3>
              <button
                type="button"
                onClick={() => setShowDesktopToc(false)}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label={t("viewer.close")}
                title={t("viewer.close")}
              >
                <Menu className="w-3.5 h-3.5" />
                <span>{t("viewer.close")}</span>
              </button>
            </div>
            <nav className="p-2">
              {toc.map((chapter, index) => (
                <button
                  key={index}
                  onClick={() => handleTocClick(chapter.href)}
                  className="block w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted rounded-md transition-colors"
                >
                  {chapter.label}
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* EPUB viewer container - epubjs renders directly into this */}
        <div className="flex-1 overflow-hidden relative">
          {!isMobile && toc.length > 0 && !showDesktopToc && (
            <button
              type="button"
              onClick={() => setShowDesktopToc(true)}
              className="absolute left-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-border bg-background/95 px-3 py-2 text-sm text-foreground shadow-lg backdrop-blur-sm hover:bg-muted transition-colors"
              aria-label={t("viewer.openTableOfContents")}
              title={t("viewer.openTableOfContents")}
            >
              <Menu className="w-4 h-4" />
              <span>{t("viewer.tableOfContents")}</span>
            </button>
          )}
          <div
            ref={viewerRef}
            className="absolute inset-0"
            data-epub-viewer="true"
            style={{ opacity: isLoading ? 0 : 1 }}
          />
        </div>
      </div>

      {/* Help tooltip */}
      {!isMobile && (
        <div className="absolute bottom-4 left-4 z-20 text-xs text-muted-foreground bg-background/95 backdrop-blur-sm px-2 py-1 rounded border border-border shadow-sm">
          Ctrl +/-/+ to resize • Ctrl+Scroll to resize • Ctrl+0 to reset
        </div>
      )}
    </div>
  );
}
