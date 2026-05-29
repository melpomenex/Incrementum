/**
 * useTextSelection hook
 * Detects text selection in the reader panel and triggers highlight action
 */

import { useState, useEffect, useCallback } from "react";

interface TextSelection {
  text: string;
  startOffset: number;
  endOffset: number;
  range: Range;
}

export function useTextSelection(containerRef: React.RefObject<HTMLElement | null>) {
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    const container = containerRef.current;
    if (!sel || sel.isCollapsed || !container || !sel.rangeCount) {
      setIsVisible(false);
      return;
    }

    const range = sel.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      setIsVisible(false);
      return;
    }

    const preRange = range.cloneRange();
    preRange.selectNodeContents(container);
    preRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preRange.toString().length;
    const text = sel.toString().trim();

    if (text.length > 0) {
      setSelection({
        text,
        startOffset,
        endOffset: startOffset + text.length,
        range,
      });
      setIsVisible(true);
    }
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("mouseup", handleMouseUp);
    return () => container.removeEventListener("mouseup", handleMouseUp);
  }, [containerRef, handleMouseUp]);

  const clearSelection = useCallback(() => {
    setIsVisible(false);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  return { selection, isVisible, clearSelection };
}
