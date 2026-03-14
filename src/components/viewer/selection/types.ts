/**
 * Type definitions for the custom PDF text selection engine.
 * This module provides geometric, coordinate-based selection that bypasses
 * native DOM selection for smooth, precise text extraction.
 */

import type { ViewportRect, PdfRect } from "../../../types/selection";

/**
 * Represents a single character token extracted from PDF.js text content.
 * Each token contains both PDF coordinates (immutable) and viewport coordinates
 * (updated on zoom/scale changes).
 */
export interface TextToken {
  /** Unique identifier: `${pageIndex}-${itemIndex}-${charIndex}` */
  id: string;
  /** Single character text */
  text: string;
  /** 0-indexed page number */
  pageIndex: number;
  /** PDF coordinate X (left edge, immutable) */
  pdfX: number;
  /** PDF coordinate Y (top edge, immutable) */
  pdfY: number;
  /** PDF coordinate width (immutable) */
  pdfWidth: number;
  /** PDF coordinate height (immutable) */
  pdfHeight: number;
  /** Viewport coordinate X (screen pixels, updated on zoom) */
  viewportX: number;
  /** Viewport coordinate Y (screen pixels, updated on zoom) */
  viewportY: number;
  /** Viewport width (screen pixels, updated on zoom) */
  viewportW: number;
  /** Viewport height (screen pixels, updated on zoom) */
  viewportH: number;
  /** Reading order index within the page */
  readingOrder: number;
}

/**
 * A line band represents tokens grouped by similar Y position.
 * Used for multi-column detection and text reconstruction.
 */
export interface LineBand {
  /** Center Y position of the line */
  centerY: number;
  /** Height tolerance for grouping tokens into this line */
  tolerance: number;
  /** Tokens belonging to this line, sorted by X position */
  tokens: TextToken[];
}

/**
 * Represents a detected column in a multi-column layout.
 */
export interface ColumnBoundary {
  /** X coordinate of column start */
  startX: number;
  /** X coordinate of column end */
  endX: number;
  /** Estimated column index (0 = leftmost) */
  columnIndex: number;
}

/**
 * Page-level token data with spatial index and layout analysis.
 */
export interface PageTokenData {
  /** Page index (0-based) */
  pageIndex: number;
  /** All tokens for this page, sorted by reading order */
  tokens: TextToken[];
  /** Detected line bands for text reconstruction */
  lineBands: LineBand[];
  /** Detected column boundaries (empty if single-column) */
  columns: ColumnBoundary[];
  /** Viewport scale used when extracting these tokens */
  scale: number;
}

/**
 * Selection state for a single page.
 */
export interface PageSelectionState {
  /** Page index (0-based) */
  pageIndex: number;
  /** Start token ID (or null if no selection on this page) */
  startTokenId: string | null;
  /** End token ID (or null if no selection on this page) */
  endTokenId: string | null;
  /** All selected token IDs in reading order */
  selectedTokenIds: string[];
  /** Merged bounding boxes per line for rendering */
  mergedBoundingBoxes: ViewportRect[];
}

/**
 * Overall selection state across all pages.
 */
export interface SelectionState {
  /** Whether a selection is currently active */
  isActive: boolean;
  /** Page where selection started */
  startPageIndex: number | null;
  /** Token where selection started */
  startTokenId: string | null;
  /** Current page where selection ends */
  endPageIndex: number | null;
  /** Current token where selection ends */
  endTokenId: string | null;
  /** Per-page selection states */
  pageSelections: Map<number, PageSelectionState>;
  /** Extracted text (updated on selection change) */
  selectedText: string;
  /** Whether the engine is ready for selection */
  isReady: boolean;
}

/**
 * Result of a completed selection operation.
 */
export interface CustomSelectionResult {
  /** Extracted text with proper spacing and newlines */
  text: string;
  /** Per-page selection details */
  pages: {
    pageIndex: number;
    pageNumber: number;
    /** Merged viewport rects for rendering highlights */
    viewportRects: ViewportRect[];
    /** PDF rects for position storage */
    pdfRects: PdfRect[];
  }[];
  /** Token identifiers for the selection range */
  tokenData: {
    startTokenId: string;
    endTokenId: string;
    tokenIds: string[];
  };
}

/**
 * Hit test result from spatial index lookup.
 */
export interface HitTestResult {
  /** The nearest token found */
  token: TextToken;
  /** Distance from the query point to the token center */
  distance: number;
  /** Page index containing the token */
  pageIndex: number;
}

/**
 * Configuration for the token extractor.
 */
export interface TokenExtractorConfig {
  /** Hit test tolerance in pixels */
  hitTolerance: number;
  /** Gap threshold in pixels for inserting spaces */
  spaceGapThreshold: number;
  /** Y difference threshold in pixels for inserting newlines */
  newlineYThreshold: number;
  /** Enable column detection */
  detectColumns: boolean;
}

/**
 * Default configuration values.
 */
export const DEFAULT_EXTRACTOR_CONFIG: TokenExtractorConfig = {
  hitTolerance: 10,
  spaceGapThreshold: 3,
  newlineYThreshold: 5,
  detectColumns: true,
};

/**
 * Selection engine state machine states.
 */
export type SelectionEngineState = "idle" | "selecting" | "completed";

/**
 * Options for the usePdfCustomSelection hook.
 */
export interface UsePdfCustomSelectionOptions {
  /** PDF document proxy */
  pdf: import("pdfjs-dist").PDFDocumentProxy | null;
  /** Document identifier */
  documentId: string;
  /** Refs to page container elements */
  pageContainerRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  /** Refs to page viewports */
  pageViewportRefs: React.MutableRefObject<(import("pdfjs-dist").PageViewport | null)[]>;
  /** Whether custom selection is enabled */
  enabled: boolean;
  /** Callback when selection changes */
  onSelectionChange?: (text: string, context: import("../../../types/selection").PdfSelectionContext | null) => void;
}

/**
 * Return type for the usePdfCustomSelection hook.
 */
export interface UsePdfCustomSelectionResult {
  /** Current selection state for rendering */
  selectionState: SelectionState;
  /** Handler for pointer down events */
  handlePointerDown: (pageIndex: number, event: React.PointerEvent) => void;
  /** Handler for pointer move events */
  handlePointerMove: (pageIndex: number, event: React.PointerEvent) => void;
  /** Handler for pointer up events */
  handlePointerUp: (pageIndex: number, event: React.PointerEvent) => void;
  /** Clear the current selection */
  clearSelection: () => void;
  /** Whether the engine is ready for selection */
  isReady: boolean;
  /** Refresh token data for all pages (call on zoom change) */
  refreshTokens: () => Promise<void>;
}
