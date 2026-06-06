import { useEffect, useRef } from "react";
import { WordHighlighter } from "../../utils/wordHighlighter";

interface WordHighlightLayerProps {
  enabled: boolean;
  chunkText: string;
  wordOffset: number;
  /** Container element where text lives (for Markdown/PDF/EPUB) */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Use chunk-level highlighting instead of word-level */
  useChunkLevel?: boolean;
  /** Optional fallback iframe contentWindow */
  iframeWindow?: Window | null;
}

export function WordHighlightLayer({
  enabled,
  chunkText,
  wordOffset,
  containerRef,
  useChunkLevel = false,
  iframeWindow,
}: WordHighlightLayerProps) {
  // Track highlighters mapped by their HTML container elements to avoid leaks and memory issues
  const highlightersRef = useRef<Map<HTMLElement, WordHighlighter>>(new Map());

  // Clean up all highlighters on unmount
  useEffect(() => {
    return () => {
      highlightersRef.current.forEach((hl) => hl.destroy());
      highlightersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      highlightersRef.current.forEach((hl) => hl.clear());
      return;
    }

    // 1. Gather all active containers (both the main container and any embedded iframes)
    const targets: HTMLElement[] = [];

    // Add direct iframe window document body if provided
    if (iframeWindow && iframeWindow.document?.body) {
      targets.push(iframeWindow.document.body);
    }

    // Search the main scroll container or content area
    let mainContainer = containerRef?.current;
    if (!mainContainer && typeof document !== "undefined") {
      mainContainer = (document.querySelector("[data-document-scroll-container]") ||
                      document.querySelector(".viewer-content-area")) as HTMLElement | null;
    }

    if (mainContainer) {
      // Find all iframe bodies (important for EPUB continuous scroll/chapters)
      const iframes = Array.from(mainContainer.querySelectorAll("iframe"));
      for (const iframe of iframes) {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc && iframeDoc.body) {
            if (!targets.includes(iframeDoc.body)) {
              targets.push(iframeDoc.body);
            }
          }
        } catch {
          // Ignore cross-origin access security warnings
        }
      }

      // If no iframes are rendered, fall back to the main container itself
      if (targets.length === 0) {
        targets.push(mainContainer);
      }
    }

    const currentHighlighters = highlightersRef.current;

    // 2. Synchronize highlighters map with targets
    // Destroy highlighters for elements that are no longer targets
    for (const [el, hl] of currentHighlighters.entries()) {
      if (!targets.includes(el)) {
        hl.destroy();
        currentHighlighters.delete(el);
      }
    }

    // Initialize highlighters for new targets and clear existing highlights
    for (const el of targets) {
      let hl = currentHighlighters.get(el);
      if (!hl) {
        hl = new WordHighlighter();
        hl.init(el, useChunkLevel);
        currentHighlighters.set(el, hl);
      }
      hl.setEnabled(true);
      hl.clear();
    }

    // 3. Apply the current segment highlight to all highlighters.
    // The highlighter internally performs a fast substring lookup and only applies
    // highlights/scrolling to the specific target body containing the match.
    for (const hl of currentHighlighters.values()) {
      if (useChunkLevel) {
        hl.highlightChunk(chunkText);
      } else {
        hl.highlightWord(chunkText, wordOffset);
      }
    }
  }, [enabled, chunkText, wordOffset, useChunkLevel, containerRef, containerRef?.current, iframeWindow]);

  return null;
}
