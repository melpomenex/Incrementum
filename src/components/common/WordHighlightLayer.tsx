import { useEffect, useRef, useCallback } from "react";
import { WordHighlighter } from "../../utils/wordHighlighter";

interface WordHighlightLayerProps {
  enabled: boolean;
  chunkText: string;
  wordOffset: number;
  /** Container element where text lives (for Markdown/PDF) */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Use chunk-level highlighting instead of word-level */
  useChunkLevel?: boolean;
  /** Iframe contentWindow for HTML documents */
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
  const highlighterRef = useRef<WordHighlighter | null>(null);
  const iframeHighlighterRef = useRef<WordHighlighter | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    return () => {
      highlighterRef.current?.destroy();
      highlighterRef.current = null;
      iframeHighlighterRef.current?.destroy();
      iframeHighlighterRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || iframeWindow) return;

    if (!highlighterRef.current) {
      highlighterRef.current = new WordHighlighter();
    }

    const hl = highlighterRef.current;
    hl.init(containerRef.current, useChunkLevel);
    hl.setEnabled(enabled);

    return () => {
      if (!enabledRef.current) {
        hl.clear();
      }
    };
  }, [containerRef.current, iframeWindow, useChunkLevel, enabled]);

  useEffect(() => {
    if (!iframeWindow || !iframeWindow.document?.body) return;

    if (!iframeHighlighterRef.current) {
      iframeHighlighterRef.current = new WordHighlighter();
    }

    const hl = iframeHighlighterRef.current;
    hl.init(iframeWindow.document.body, useChunkLevel);
    hl.setEnabled(enabled);

    return () => {
      if (!enabledRef.current) {
        hl.clear();
      }
    };
  }, [iframeWindow, useChunkLevel, enabled]);

  const activeHighlighter = iframeWindow ? iframeHighlighterRef.current : highlighterRef.current;

  useEffect(() => {
    if (!activeHighlighter || !enabled) return;

    if (useChunkLevel) {
      activeHighlighter.highlightChunk(chunkText);
    } else {
      activeHighlighter.highlightWord(chunkText, wordOffset);
    }
  }, [enabled, chunkText, wordOffset, useChunkLevel, activeHighlighter]);

  return null;
}
