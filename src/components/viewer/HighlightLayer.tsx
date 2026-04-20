/**
 * HighlightLayer - Renders persistent highlights for a PDF page.
 *
 * This is Layer 2 (z-index: 2) in the 3-layer architecture.
 * It sits between the canvas layer (1) and text layer (3).
 *
 * Highlights are stored as PDF coordinates and converted to
 * viewport coordinates for rendering. This ensures highlights
 * persist correctly when zooming/resizing.
 */

import React, { useMemo, useCallback } from "react";
import type { PageViewport } from "pdfjs-dist";
import type { PdfRect } from "../../types/selection";
import { HIGHLIGHT_COLORS, type HighlightColor } from "./SelectionPopup";

export interface StoredHighlight {
  /** Unique identifier for the highlight */
  id: string;
  /** Page number (1-indexed) */
  pageNumber: number;
  /** PDF coordinate rectangles (immutable) */
  pdfRects: PdfRect[];
  /** Highlight color */
  color: HighlightColor;
  /** The highlighted text */
  text: string;
  /** Optional note attached to highlight */
  note?: string;
  /** Creation timestamp */
  createdAt: number;
}

export interface HighlightLayerProps {
  /** Page index (0-indexed) */
  pageIndex: number;
  /** Viewport for coordinate conversion */
  viewport: PageViewport | null;
  /** Highlights for this page */
  highlights: StoredHighlight[];
  /** Callback when a highlight is clicked */
  onHighlightClick?: (highlight: StoredHighlight) => void;
  /** Whether highlights should receive pointer events */
  interactive?: boolean;
}

/**
 * Convert PDF coordinates to viewport (screen) coordinates.
 * This is the inverse of viewport.convertToPdfPoint().
 *
 * Uses viewport.convertToViewportRectangle() which handles
 * the coordinate system transformation.
 */
function pdfRectToViewportRect(
  pdfRect: PdfRect,
  viewport: PageViewport
): { left: number; top: number; width: number; height: number } | null {
  try {
    // convertToViewportRectangle expects [x1, y1, x2, y2] in PDF coordinates
    // and returns [x1, y1, x2, y2] in viewport coordinates
    const [x1, y1, x2, y2] = viewport.convertToViewportRectangle([
      pdfRect.x1,
      pdfRect.y1,
      pdfRect.x2,
      pdfRect.y2,
    ]);

    // The returned coordinates might be in any order depending on rotation
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);

    // Validate the result
    if (!Number.isFinite(left) || !Number.isFinite(top) ||
        !Number.isFinite(width) || !Number.isFinite(height)) {
      return null;
    }

    return { left, top, width, height };
  } catch (err) {
    console.warn("[HighlightLayer] Failed to convert PDF rect to viewport:", err);
    return null;
  }
}

/**
 * HighlightLayer component - renders persistent highlights for a PDF page.
 *
 * This component:
 * 1. Takes highlights stored in PDF coordinates
 * 2. Converts them to viewport coordinates using the current scale
 * 3. Renders them as absolutely positioned divs
 *
 * The conversion happens on every render to handle zoom changes.
 */
export const HighlightLayer: React.FC<HighlightLayerProps> = ({
  pageIndex: _pageIndex,
  viewport,
  highlights,
  onHighlightClick,
  interactive = false,
}) => {
  // Convert PDF rects to viewport rects for each highlight
  const viewportHighlights = useMemo(() => {
    if (!viewport || highlights.length === 0) {
      return [];
    }

    return highlights
      .map((highlight) => {
        // Convert each PDF rect to viewport coordinates
        const viewportRects = highlight.pdfRects
          .map((pdfRect) => pdfRectToViewportRect(pdfRect, viewport))
          .filter((rect): rect is NonNullable<typeof rect> => rect !== null);

        return {
          ...highlight,
          viewportRects,
        };
      })
      .filter((h) => h.viewportRects.length > 0);
  }, [viewport, highlights]);

  // Handle click on a highlight
  const handleClick = useCallback(
    (highlight: StoredHighlight) => (e: React.MouseEvent) => {
      if (interactive && onHighlightClick) {
        e.stopPropagation();
        onHighlightClick(highlight);
      }
    },
    [interactive, onHighlightClick]
  );

  if (viewportHighlights.length === 0) {
    return null;
  }

  return (
    <div
      className="highlightLayer"
      aria-hidden={!interactive}
    >
      {viewportHighlights.map((highlight) =>
        highlight.viewportRects.map((rect, rectIndex) => (
          <div
            key={`${highlight.id}-${rectIndex}`}
            className={`pdf-highlight ${highlight.color}`}
            style={{
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              backgroundColor: HIGHLIGHT_COLORS[highlight.color],
              cursor: interactive ? "pointer" : "default",
              pointerEvents: interactive ? "auto" : "none",
            }}
            onClick={handleClick(highlight)}
            title={interactive ? highlight.text : undefined}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
          />
        ))
      )}
    </div>
  );
};

/**
 * Hook to manage highlights for a PDF document.
 * Provides methods to add, remove, and query highlights.
 */
export function useHighlightManager(initialHighlights: StoredHighlight[] = []) {
  const [highlights, setHighlights] = React.useState<StoredHighlight[]>(initialHighlights);

  const addHighlight = useCallback((highlight: Omit<StoredHighlight, "id" | "createdAt">) => {
    const newHighlight: StoredHighlight = {
      ...highlight,
      id: `highlight-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now(),
    };
    setHighlights((prev) => [...prev, newHighlight]);
    return newHighlight;
  }, []);

  const removeHighlight = useCallback((id: string) => {
    setHighlights((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const updateHighlight = useCallback((id: string, updates: Partial<StoredHighlight>) => {
    setHighlights((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...updates } : h))
    );
  }, []);

  const getHighlightsForPage = useCallback(
    (pageNumber: number) => {
      return highlights.filter((h) => h.pageNumber === pageNumber);
    },
    [highlights]
  );

  return {
    highlights,
    addHighlight,
    removeHighlight,
    updateHighlight,
    getHighlightsForPage,
  };
}

export default HighlightLayer;
