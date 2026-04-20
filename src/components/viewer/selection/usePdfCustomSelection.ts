/**
 * usePdfCustomSelection - Integration hook for custom PDF text selection.
 *
 * Provides a complete selection system that:
 * 1. Extracts tokens from PDF pages
 * 2. Builds spatial index for fast lookup
 * 3. Manages selection state machine
 * 4. Emits selection changes via callback
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { PdfSelectionContext } from "../../../types/selection";
import type {
  SelectionState,
  UsePdfCustomSelectionOptions,
  UsePdfCustomSelectionResult,
  TokenExtractorConfig,
} from "./types";
import { TokenExtractor } from "./TokenExtractor";
import { SpatialIndex } from "./SpatialIndex";
import { SelectionEngine, resultToSelectionContext } from "./SelectionEngine";

const DEFAULT_CONFIG: TokenExtractorConfig = {
  hitTolerance: 10,
  spaceGapThreshold: 3,
  newlineYThreshold: 5,
  detectColumns: true,
};

/**
 * Create initial selection state.
 */
function createInitialSelectionState(): SelectionState {
  return {
    isActive: false,
    startPageIndex: null,
    startTokenId: null,
    endPageIndex: null,
    endTokenId: null,
    pageSelections: new Map(),
    selectedText: "",
    isReady: false,
  };
}

/**
 * Hook for managing custom PDF text selection.
 */
export function usePdfCustomSelection(
  options: UsePdfCustomSelectionOptions
): UsePdfCustomSelectionResult {
  const {
    pdf,
    documentId,
    pageContainerRefs,
    pageViewportRefs,
    enabled,
    onSelectionChange,
  } = options;

  // Core instances (refs to avoid re-renders)
  const extractorRef = useRef<TokenExtractor | null>(null);
  const spatialIndexRef = useRef<SpatialIndex | null>(null);
  const engineRef = useRef<SelectionEngine | null>(null);

  // Track which pages have been indexed
  const indexedPagesRef = useRef<Set<number>>(new Set());

  // Selection state for rendering
  const [selectionState, setSelectionState] = useState<SelectionState>(
    createInitialSelectionState
  );

  // Track if system is ready
  const [isReady, setIsReady] = useState(false);

  // Track current viewport scales for re-extraction
  const lastScalesRef = useRef<number[]>([]);

  /**
   * Initialize core instances.
   */
  useEffect(() => {
    if (!enabled) return;

    extractorRef.current = new TokenExtractor(DEFAULT_CONFIG);
    spatialIndexRef.current = new SpatialIndex();

    engineRef.current = new SelectionEngine(
      spatialIndexRef.current,
      DEFAULT_CONFIG
    );

    engineRef.current.setOnStateChange((state) => {
      setSelectionState(state);
    });

    indexedPagesRef.current = new Set();
    setIsReady(false);

    return () => {
      extractorRef.current = null;
      spatialIndexRef.current = null;
      engineRef.current = null;
      indexedPagesRef.current.clear();
    };
  }, [enabled]);

  /**
   * Extract tokens when PDF and viewports are ready.
   */
  const extractPageTokens = useCallback(
    async (pageIndex: number): Promise<void> => {
      if (!pdf || !extractorRef.current || !spatialIndexRef.current) return;

      const viewport = pageViewportRefs.current[pageIndex];
      if (!viewport) return;

      // Check if we already have tokens at this scale
      const lastScale = lastScalesRef.current[pageIndex];
      if (lastScale === viewport.scale && indexedPagesRef.current.has(pageIndex)) {
        return; // Already indexed at this scale
      }

      try {
        const page = await pdf.getPage(pageIndex + 1);
        const pageData = await extractorRef.current.extractPageTokens(
          page,
          viewport,
          pageIndex
        );

        spatialIndexRef.current.addPage(pageData);
        indexedPagesRef.current.add(pageIndex);
        lastScalesRef.current[pageIndex] = viewport.scale;

        // Update ready state
        if (!isReady && indexedPagesRef.current.size > 0) {
          setIsReady(true);
          setSelectionState((prev) => ({ ...prev, isReady: true }));
        }
      } catch (error) {
        console.warn(
          `[usePdfCustomSelection] Failed to extract tokens for page ${pageIndex + 1}:`,
          error
        );
      }
    },
    [pdf, pageViewportRefs, isReady]
  );

  /**
   * Extract tokens for all pages in the visible range.
   */
  const refreshTokens = useCallback(async (): Promise<void> => {
    if (!pdf || !extractorRef.current) return;

    // Clear existing index
    spatialIndexRef.current?.clear();
    indexedPagesRef.current.clear();

    // Extract tokens for all pages with viewports
    for (let i = 0; i < pageViewportRefs.current.length; i++) {
      const viewport = pageViewportRefs.current[i];
      if (viewport) {
        await extractPageTokens(i);
      }
    }
  }, [pdf, pageViewportRefs, extractPageTokens]);

  /**
   * Handle viewport scale changes (zoom).
   */
  useEffect(() => {
    if (!enabled || !pdf) return;

    // Check if any viewport scale changed
    let scaleChanged = false;
    for (let i = 0; i < pageViewportRefs.current.length; i++) {
      const viewport = pageViewportRefs.current[i];
      const lastScale = lastScalesRef.current[i];

      if (viewport && viewport.scale !== lastScale) {
        scaleChanged = true;
        break;
      }
    }

    if (scaleChanged) {
      // Clear cache and re-extract
      extractorRef.current?.clearCache();
      refreshTokens();
    }
  }, [enabled, pdf, pageViewportRefs, refreshTokens]);

  /**
   * Extract tokens for rendered pages.
   */
  useEffect(() => {
    if (!enabled || !pdf) return;

    // Extract tokens for pages that have viewports
    for (let i = 0; i < pageViewportRefs.current.length; i++) {
      const viewport = pageViewportRefs.current[i];
      if (viewport && !indexedPagesRef.current.has(i)) {
        extractPageTokens(i);
      }
    }
  }, [enabled, pdf, pageViewportRefs, extractPageTokens]);

  /**
   * Convert page-relative coordinates to viewport coordinates.
   */
  const getViewportCoords = useCallback(
    (
      pageIndex: number,
      event: React.PointerEvent
    ): { x: number; y: number } | null => {
      const pageContainer = pageContainerRefs.current[pageIndex];
      if (!pageContainer) return null;

      const rect = pageContainer.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    },
    [pageContainerRefs]
  );

  /**
   * Handle pointer down - start selection.
   */
  const handlePointerDown = useCallback(
    (pageIndex: number, event: React.PointerEvent): void => {
      if (!enabled || !engineRef.current) return;

      const coords = getViewportCoords(pageIndex, event);
      if (!coords) return;

      // Ensure page is indexed before selection
      if (!indexedPagesRef.current.has(pageIndex)) {
        extractPageTokens(pageIndex);
        return;
      }

      engineRef.current.handlePointerDown(pageIndex, coords.x, coords.y);
    },
    [enabled, getViewportCoords, extractPageTokens]
  );

  /**
   * Handle pointer move - extend selection.
   */
  const handlePointerMove = useCallback(
    (pageIndex: number, event: React.PointerEvent): void => {
      if (!enabled || !engineRef.current) return;

      const coords = getViewportCoords(pageIndex, event);
      if (!coords) return;

      engineRef.current.handlePointerMove(pageIndex, coords.x, coords.y);
    },
    [enabled, getViewportCoords]
  );

  /**
   * Handle pointer up - complete selection.
   */
  const handlePointerUp = useCallback(
    (_pageIndex: number, _event: React.PointerEvent): void => {
      if (!enabled || !engineRef.current || !pdf) return;

      const result = engineRef.current.handlePointerUp();

      if (result && onSelectionChange) {
        const context = resultToSelectionContext(
          result,
          documentId,
          (pdf as any).fingerprint
        );

        onSelectionChange(result.text, context as PdfSelectionContext);
      }
    },
    [enabled, pdf, documentId, onSelectionChange]
  );

  /**
   * Clear the current selection.
   */
  const clearSelection = useCallback((): void => {
    if (!engineRef.current) return;

    engineRef.current.clearSelection();
    setSelectionState(createInitialSelectionState());

    if (onSelectionChange) {
      onSelectionChange("", null);
    }
  }, [onSelectionChange]);

  /**
   * Clear selection when clicking outside text areas.
   */
  useEffect(() => {
    if (!enabled) return;

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check if click is outside any page container
      const isInsidePage = pageContainerRefs.current.some(
        (container) => container && container.contains(target)
      );

      if (!isInsidePage && engineRef.current?.hasSelection()) {
        clearSelection();
      }
    };

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [enabled, pageContainerRefs, clearSelection]);

  return {
    selectionState,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    clearSelection,
    isReady,
    refreshTokens,
  };
}

export default usePdfCustomSelection;
