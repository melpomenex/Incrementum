import { useEffect, useRef, useCallback } from "react";
import { useVimModeStore } from "../stores/vimModeStore";
import { VimCursorEngine, type VimAction } from "../utils/vim/VimCursorEngine";
import { MarkdownAdapter } from "../utils/vim/adapters/markdownAdapter";
import { HtmlAdapter } from "../utils/vim/adapters/htmlAdapter";
import { EpubAdapter } from "../utils/vim/adapters/epubAdapter";
import { PdfAdapter } from "../utils/vim/adapters/pdfAdapter";
import type { VimActionContext } from "../utils/vim/actions";
import { doExtract, doExtractWithDialog, doYank, doHighlight, doFlashcard } from "../utils/vim/actions";
import { clearSelection } from "../utils/vim/selectionManager";

interface UseVimReadingOptions {
  docType: "epub" | "pdf" | "markdown" | "html";
  documentId: string;
  iframeWindow?: Window | null;
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
  contentRef?: React.RefObject<HTMLElement | null>;
  scrollContainerRef?: React.RefObject<HTMLElement | null> | null;
  pdfTextLayerRoots?: (HTMLDivElement | null)[];
  pdfScrollContainer?: HTMLElement | null;
  actionContext?: VimActionContext;
  isModalOpen?: boolean;
}

export function useVimReading({
  docType,
  documentId,
  iframeWindow,
  iframeRef,
  contentRef,
  scrollContainerRef,
  pdfTextLayerRoots,
  pdfScrollContainer,
  actionContext,
  isModalOpen,
}: UseVimReadingOptions) {
  const engineRef = useRef<VimCursorEngine | null>(null);
  const actionContextRef = useRef(actionContext);
  actionContextRef.current = actionContext;

  const getScrollContainer = useCallback((): HTMLElement | null => {
    if (scrollContainerRef && "current" in scrollContainerRef) {
      return scrollContainerRef.current;
    }
    return null;
  }, [scrollContainerRef]);

  // Create/recreate engine when viewer refs change
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.dispose();
      engineRef.current = null;
    }

    const scrollContainer = getScrollContainer();

    switch (docType) {
      case "markdown": {
        if (!contentRef?.current) return;
        const adapter = new MarkdownAdapter(contentRef, scrollContainer);
        engineRef.current = new VimCursorEngine(adapter, handleAction);
        break;
      }
      case "html": {
        if (!iframeRef?.current) return;
        const adapter = new HtmlAdapter(iframeRef, scrollContainer);
        engineRef.current = new VimCursorEngine(adapter, handleAction);
        break;
      }
      case "epub": {
        if (!iframeWindow) return;
        const adapter = new EpubAdapter(iframeWindow, scrollContainer);
        engineRef.current = new VimCursorEngine(adapter, handleAction);
        break;
      }
      case "pdf": {
        if (!pdfTextLayerRoots || !pdfScrollContainer) return;
        const adapter = new PdfAdapter(pdfTextLayerRoots, pdfScrollContainer);
        engineRef.current = new VimCursorEngine(adapter, handleAction);
        break;
      }
    }

    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [docType, iframeWindow, contentRef, iframeRef, pdfTextLayerRoots, pdfScrollContainer, getScrollContainer]);

  // Create a stable keydown handler function
  const makeKeyHandler = useCallback(() => {
    return (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;

      const mode = useVimModeStore.getState().mode;

      // Activation: Escape when inactive and no modal open
      if (e.key === "Escape" && mode === "inactive" && !isModalOpen) {
        engine.activate(documentId);
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      // Only process other keys when vim mode is active
      if (mode === "inactive") return;

      const handled = engine.handleKeyDown(e);
      if (handled) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
  }, [documentId, isModalOpen]);

  // Listen on parent window (covers PDF, Markdown, and when parent has focus)
  useEffect(() => {
    const handler = makeKeyHandler();
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [makeKeyHandler]);

  // Listen inside iframe for EPUB and HTML viewers
  useEffect(() => {
    const win = iframeWindow;
    if (!win || (docType !== "epub" && docType !== "html")) return;

    const handler = makeKeyHandler();
    win.addEventListener("keydown", handler, true);
    return () => {
      try {
        win.removeEventListener("keydown", handler, true);
      } catch {
        // iframe may have been destroyed
      }
    };
  }, [iframeWindow, docType, makeKeyHandler]);

  // Keep action context ref in sync
  useEffect(() => {
    vimActionContextRef = actionContext ?? null;
    vimIframeWindowRef = iframeWindow ?? null;
  }, [actionContext, iframeWindow]);

  // Rebuild text model on content changes for markdown/HTML
  useEffect(() => {
    if (docType !== "markdown" && docType !== "html") return;
    if (docType === "markdown" && !contentRef?.current) return;
    if (docType === "html" && !iframeRef?.current) return;

    const target = docType === "markdown"
      ? contentRef!.current!
      : iframeRef!.current?.contentDocument?.body;
    if (!target) return;

    const observer = new MutationObserver(() => {
      engineRef.current?.rebuildModel();
    });

    observer.observe(target, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [docType, contentRef, iframeRef]);

  // Rebuild text model periodically for PDF (pages render lazily)
  useEffect(() => {
    if (docType !== "pdf") return;

    const interval = setInterval(() => {
      const store = useVimModeStore.getState();
      if (store.mode !== "inactive") {
        engineRef.current?.rebuildModel();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [docType]);

  // For EPUB: rebuild text model when iframe window changes (chapter navigation)
  useEffect(() => {
    if (docType !== "epub" || !iframeWindow) return;

    // The iframeWindow reference changes on chapter change, so rebuild
    engineRef.current?.rebuildModel();
  }, [docType, iframeWindow]);

  // Refresh cached rects on scroll so they stay accurate
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const scrollContainer = (() => {
      switch (docType) {
        case "epub": return iframeWindow?.document?.scrollingElement as HTMLElement | null;
        case "pdf": return pdfScrollContainer ?? null;
        default: return document.querySelector("[data-document-scroll-container]") as HTMLElement | null;
      }
    })();

    if (!scrollContainer) return;

    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    const handleScroll = () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        if (useVimModeStore.getState().mode !== "inactive") {
          engine.refreshRects();
        }
      }, 150);
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll);
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, [docType, iframeWindow, pdfScrollContainer]);

  return { engineRef };
}

function handleAction(action: VimAction): void {
  const actionCtx = vimActionContextRef;
  if (!actionCtx) return;

  const finishAction = () => {
    // Clear selection in both parent and iframe documents
    clearSelection(document);
    try {
      const iframeWin = vimIframeWindowRef;
      if (iframeWin) {
        iframeWin.getSelection()?.removeAllRanges();
      }
    } catch { /* cross-origin */ }
    useVimModeStore.getState().setMode("normal");
  };

  switch (action) {
    case "extract":
      doExtract(actionCtx).then(finishAction);
      break;
    case "extract-dialog":
      doExtractWithDialog(actionCtx);
      finishAction();
      break;
    case "yank":
      doYank(actionCtx).then(finishAction);
      break;
    case "highlight":
      doHighlight(actionCtx).then(finishAction);
      break;
    case "flashcard":
      doFlashcard(actionCtx);
      finishAction();
      break;
  }
}

// Module-level refs (set by the hook, read by action handler)
let vimActionContextRef: VimActionContext | null = null;
let vimIframeWindowRef: Window | null = null;
