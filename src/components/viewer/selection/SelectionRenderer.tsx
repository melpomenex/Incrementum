/**
 * SelectionRenderer - SVG-based highlights for custom text selection.
 *
 * Renders selection highlights as SVG rectangles with:
 * - Proper z-index above text layer
 * - Smooth rendering during drag selection
 * - Per-line merged bounding boxes
 */

import React, { useMemo } from "react";
import type { SelectionState } from "./types";
import type { ViewportRect } from "../../../types/selection";

interface SelectionRendererProps {
  /** Page index to render selection for */
  pageIndex: number;
  /** Current selection state */
  selectionState: SelectionState;
  /** Highlight color (CSS color string) */
  highlightColor?: string;
  /** Highlight opacity (0-1) */
  highlightOpacity?: number;
}

/**
 * Renders selection highlights for a single page.
 */
export const SelectionRenderer: React.FC<SelectionRendererProps> = ({
  pageIndex,
  selectionState,
  highlightColor = "rgba(59, 130, 246, 0.4)",
  highlightOpacity: _highlightOpacity = 0.4,
}) => {
  // Get selection boxes for this page
  const selectionBoxes = useMemo(() => {
    if (!selectionState.isActive) return [];

    const pageSelection = selectionState.pageSelections.get(pageIndex);
    if (!pageSelection) return [];

    return pageSelection.mergedBoundingBoxes;
  }, [selectionState, pageIndex]);

  // Don't render if no selection on this page
  if (selectionBoxes.length === 0) {
    return null;
  }

  return (
    <div
      className="custom-selection-highlight-layer"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 15, // Above textLayer (10)
      }}
    >
      {selectionBoxes.map((rect, index) => (
        <div
          key={`${pageIndex}-${index}-${rect.left}-${rect.top}`}
          className="custom-selection-highlight"
          style={{
            position: "absolute",
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            backgroundColor: highlightColor,
            borderRadius: "2px",
            pointerEvents: "none",
          }}
        />
      ))}
    </div>
  );
};

/**
 * SVG-based selection renderer for more complex highlighting needs.
 * Use this when you need features like:
 * - Rotated text selection
 * - Complex shapes
 * - Gradient highlights
 */
export const SVGSelectionRenderer: React.FC<SelectionRendererProps> = ({
  pageIndex,
  selectionState,
  highlightColor = "#3b82f6",
  highlightOpacity: _highlightOpacity = 0.4,
}) => {
  // Get selection boxes for this page
  const selectionBoxes = useMemo(() => {
    if (!selectionState.isActive) return [];

    const pageSelection = selectionState.pageSelections.get(pageIndex);
    if (!pageSelection) return [];

    return pageSelection.mergedBoundingBoxes;
  }, [selectionState, pageIndex]);

  // Calculate SVG dimensions
  const _svgDimensions = useMemo(() => {
    if (selectionBoxes.length === 0) return { width: 0, height: 0 };

    let maxX = 0;
    let maxY = 0;

    for (const rect of selectionBoxes) {
      const right = rect.left + rect.width;
      const bottom = rect.top + rect.height;
      maxX = Math.max(maxX, right);
      maxY = Math.max(maxY, bottom);
    }

    return { width: maxX + 10, height: maxY + 10 };
  }, [selectionBoxes]);

  // Don't render if no selection on this page
  if (selectionBoxes.length === 0) {
    return null;
  }

  return (
    <svg
      className="custom-selection-svg-layer"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 15,
        overflow: "visible",
      }}
    >
      <g className="selection-highlights">
        {selectionBoxes.map((rect, index) => (
          <rect
            key={`${pageIndex}-${index}-${rect.left}-${rect.top}`}
            x={rect.left}
            y={rect.top}
            width={rect.width}
            height={rect.height}
            fill={highlightColor}
            fillOpacity={_highlightOpacity}
            rx={2}
            ry={2}
          />
        ))}
      </g>
    </svg>
  );
};

/**
 * Hook to get selection rectangles for a specific page.
 */
export function useSelectionRects(
  pageIndex: number,
  selectionState: SelectionState
): ViewportRect[] {
  return useMemo(() => {
    if (!selectionState.isActive) return [];

    const pageSelection = selectionState.pageSelections.get(pageIndex);
    if (!pageSelection) return [];

    return pageSelection.mergedBoundingBoxes;
  }, [selectionState, pageIndex]);
}

/**
 * Renders selection highlights for all pages.
 * Use this when you have access to the full selection state.
 */
export const AllPagesSelectionRenderer: React.FC<{
  selectionState: SelectionState;
  numPages: number;
  highlightColor?: string;
}> = ({ selectionState, numPages, highlightColor }) => {
  const activePages = useMemo(() => {
    const pages: number[] = [];
    for (let i = 0; i < numPages; i++) {
      if (selectionState.pageSelections.has(i)) {
        pages.push(i);
      }
    }
    return pages;
  }, [selectionState, numPages]);

  return (
    <>
      {activePages.map((pageIndex) => (
        <SelectionRenderer
          key={pageIndex}
          pageIndex={pageIndex}
          selectionState={selectionState}
          highlightColor={highlightColor}
        />
      ))}
    </>
  );
};

export default SelectionRenderer;
