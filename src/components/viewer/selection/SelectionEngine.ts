
import type { PdfRect } from "../../../types/selection";
import type {
  TextToken,
  SelectionState,
  CustomSelectionResult,
  SelectionEngineState as EngineState,
  TokenExtractorConfig,
  PageSelectionState,
} from "./types";
import { SpatialIndex, TokenUtils } from "./SpatialIndex";

const DEFAULT_CONFIG: TokenExtractorConfig = {
  hitTolerance: 10,
  spaceGapThreshold: 3,
  newlineYThreshold: 5,
  detectColumns: true,
};

/**
 * Selection engine state machine.
 */
export class SelectionEngine {
  private spatialIndex: SpatialIndex;
  private config: TokenExtractorConfig;
  private state: EngineState = "idle";
  private selectionState: SelectionState;

  // Current selection tracking
  private startPageIndex: number | null = null;
  private startTokenId: string | null = null;
  private endPageIndex: number | null = null;
  private endTokenId: string | null = null;

  // Callbacks
  private onStateChange?: (state: SelectionState) => void;

  constructor(
    spatialIndex: SpatialIndex,
    config: Partial<TokenExtractorConfig> = {}
  ) {
    this.spatialIndex = spatialIndex;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.selectionState = this.createInitialState();
  }

  /**
   * Set callback for selection state changes.
   */
  setOnStateChange(callback: (state: SelectionState) => void): void {
    this.onStateChange = callback;
  }

  /**
   * Get current selection state.
   */
  getSelectionState(): SelectionState {
    return this.selectionState;
  }

  /**
   * Handle pointer down - start selection.
   */
  handlePointerDown(pageIndex: number, x: number, y: number): void {
    const hit = this.spatialIndex.findNearestToken(
      pageIndex,
      x,
      y,
      this.config.hitTolerance
    );

    if (!hit) {
      // No token hit - clear any existing selection
      this.clearSelection();
      return;
    }

    this.state = "selecting";
    this.startPageIndex = pageIndex;
    this.startTokenId = hit.token.id;
    this.endPageIndex = pageIndex;
    this.endTokenId = hit.token.id;

    this.updateSelectionState();
  }

  /**
   * Handle pointer move - extend selection.
   */
  handlePointerMove(pageIndex: number, x: number, y: number): void {
    if (this.state !== "selecting") return;

    const hit = this.spatialIndex.findNearestToken(
      pageIndex,
      x,
      y,
      this.config.hitTolerance
    );

    if (!hit) return;

    this.endPageIndex = pageIndex;
    this.endTokenId = hit.token.id;

    this.updateSelectionState();
  }

  /**
   * Handle pointer up - complete selection.
   */
  handlePointerUp(): CustomSelectionResult | null {
    if (this.state !== "selecting") return null;

    this.state = "completed";
    const result = this.buildSelectionResult();

    return result;
  }

  /**
   * Clear the current selection.
   */
  clearSelection(): void {
    this.state = "idle";
    this.startPageIndex = null;
    this.startTokenId = null;
    this.endPageIndex = null;
    this.endTokenId = null;

    this.selectionState = this.createInitialState();
    this.onStateChange?.(this.selectionState);
  }

  /**
   * Check if selection is currently active.
   */
  isSelecting(): boolean {
    return this.state === "selecting";
  }

  /**
   * Check if there is a completed selection.
   */
  hasSelection(): boolean {
    return this.state === "completed" && this.startTokenId !== null;
  }

  /**
   * Create initial selection state.
   */
  private createInitialState(): SelectionState {
    return {
      isActive: false,
      startPageIndex: null,
      startTokenId: null,
      endPageIndex: null,
      endTokenId: null,
      pageSelections: new Map(),
      selectedText: "",
      isReady: this.spatialIndex.pageCount > 0,
    };
  }

  /**
   * Update selection state based on current selection.
   */
  private updateSelectionState(): void {
    if (
      this.startPageIndex === null ||
      this.startTokenId === null ||
      this.endPageIndex === null ||
      this.endTokenId === null
    ) {
      this.selectionState = this.createInitialState();
      this.onStateChange?.(this.selectionState);
      return;
    }

    const { pageSelections, selectedText } = this.computeSelection();

    this.selectionState = {
      isActive: true,
      startPageIndex: this.startPageIndex,
      startTokenId: this.startTokenId,
      endPageIndex: this.endPageIndex,
      endTokenId: this.endTokenId,
      pageSelections,
      selectedText,
      isReady: true,
    };

    this.onStateChange?.(this.selectionState);
  }

  /**
   * Compute selection details for all affected pages.
   */
  private computeSelection(): {
    pageSelections: Map<number, PageSelectionState>;
    selectedText: string;
  } {
    const pageSelections = new Map<number, PageSelectionState>();
    const textParts: string[] = [];

    if (this.startPageIndex === this.endPageIndex) {
      const tokens = this.spatialIndex.getTokensInRange(
        this.startPageIndex,
        this.startTokenId!,
        this.endTokenId!
      );

      if (tokens.length > 0) {
        const mergedBoxes = TokenUtils.mergeAdjacentBoundingBoxes(tokens);
        pageSelections.set(this.startPageIndex, {
          pageIndex: this.startPageIndex,
          startTokenId: tokens[0].id,
          endTokenId: tokens[tokens.length - 1].id,
          selectedTokenIds: tokens.map((t) => t.id),
          mergedBoundingBoxes: mergedBoxes,
        });
        textParts.push(this.reconstructText(tokens));
      }
    } else {
      // Multi-page selection
      const minPage = Math.min(this.startPageIndex, this.endPageIndex);
      const maxPage = Math.max(this.startPageIndex, this.endPageIndex);

      for (let pageIndex = minPage; pageIndex <= maxPage; pageIndex++) {
        let tokens: TextToken[];

        if (pageIndex === this.startPageIndex) {
          // From start token to end of page
          const pageTokens = this.spatialIndex.getPageTokens(pageIndex);
          const startToken = this.spatialIndex.getToken(pageIndex, this.startTokenId!);
          if (startToken && pageTokens.length > 0) {
            const lastToken = pageTokens[pageTokens.length - 1];
            tokens = this.spatialIndex.getTokensInRange(
              pageIndex,
              this.startTokenId!,
              lastToken.id
            );
          } else {
            tokens = [];
          }
        } else if (pageIndex === this.endPageIndex) {
          // From start of page to end token
          const pageTokens = this.spatialIndex.getPageTokens(pageIndex);
          const endToken = this.spatialIndex.getToken(pageIndex, this.endTokenId!);
          if (endToken && pageTokens.length > 0) {
            const firstToken = pageTokens[0];
            tokens = this.spatialIndex.getTokensInRange(
              pageIndex,
              firstToken.id,
              this.endTokenId!
            );
          } else {
            tokens = [];
          }
        } else {
          // Full page in between
          tokens = this.spatialIndex.getPageTokens(pageIndex);
        }

        if (tokens.length > 0) {
          const mergedBoxes = TokenUtils.mergeAdjacentBoundingBoxes(tokens);
          pageSelections.set(pageIndex, {
            pageIndex,
            startTokenId: tokens[0].id,
            endTokenId: tokens[tokens.length - 1].id,
            selectedTokenIds: tokens.map((t) => t.id),
            mergedBoundingBoxes: mergedBoxes,
          });

          if (textParts.length > 0) {
            textParts.push("\n\n"); // Double newline between pages
          }
          textParts.push(this.reconstructText(tokens));
        }
      }
    }

    return {
      pageSelections,
      selectedText: textParts.join(""),
    };
  }

  /**
   * Reconstruct text from tokens with proper spacing.
   */
  private reconstructText(tokens: TextToken[]): string {
    if (tokens.length === 0) return "";

    const lines: string[][] = [[]];
    let currentLine = 0;
    let lastToken: TextToken | null = null;

    for (const token of tokens) {
      if (lastToken) {
        const yDiff = Math.abs(token.viewportY - lastToken.viewportY);

        if (yDiff > this.config.newlineYThreshold) {
          currentLine++;
          lines[currentLine] = [];
        } else {
          const gap = token.viewportX - (lastToken.viewportX + lastToken.viewportW);
          if (gap > this.config.spaceGapThreshold) {
            lines[currentLine].push(" ");
          }
        }
      }

      lines[currentLine].push(token.text);
      lastToken = token;
    }

    return lines.map((line) => line.join("")).join("\n");
  }

  /**
   * Build final selection result with PDF coordinates.
   */
  private buildSelectionResult(): CustomSelectionResult | null {
    if (
      this.startPageIndex === null ||
      this.startTokenId === null ||
      this.endPageIndex === null ||
      this.endTokenId === null
    ) {
      return null;
    }

    const { pageSelections, selectedText } = this.computeSelection();

    const pages: CustomSelectionResult["pages"] = [];

    for (const [pageIndex, pageSel] of pageSelections) {
      const tokens = pageSel.selectedTokenIds
        .map((id) => this.spatialIndex.getToken(pageIndex, id))
        .filter((t): t is TextToken => t !== undefined);

      if (tokens.length === 0) continue;

      // Calculate PDF rects
      const pdfRects = this.computePdfRects(tokens);

      pages.push({
        pageIndex,
        pageNumber: pageIndex + 1,
        viewportRects: pageSel.mergedBoundingBoxes,
        pdfRects,
      });
    }

    // Sort pages by page number
    pages.sort((a, b) => a.pageNumber - b.pageNumber);

    // Collect all token IDs
    const allTokenIds: string[] = [];
    for (const pageSel of pageSelections.values()) {
      allTokenIds.push(...pageSel.selectedTokenIds);
    }

    return {
      text: selectedText,
      pages,
      tokenData: {
        startTokenId: this.startTokenId,
        endTokenId: this.endTokenId,
        tokenIds: allTokenIds,
      },
    };
  }

  /**
   * Compute PDF coordinate rectangles from tokens.
   */
  private computePdfRects(tokens: TextToken[]): PdfRect[] {
    if (tokens.length === 0) return [];

    // Merge adjacent tokens and compute PDF rects
    const merged = TokenUtils.mergeAdjacentBoundingBoxes(tokens);

    // Convert viewport rects to PDF rects using token metadata
    // We need to find the scale factor - use the first token's ratio
    const firstToken = tokens[0];
    const scaleX = firstToken.pdfWidth / firstToken.viewportW;
    const scaleY = firstToken.pdfHeight / firstToken.viewportH;

    return merged.map((rect) => ({
      x1: rect.left * scaleX,
      y1: rect.top * scaleY,
      x2: (rect.left + rect.width) * scaleX,
      y2: (rect.top + rect.height) * scaleY,
    }));
  }
}

/**
 * Convert custom selection result to PdfSelectionContext.
 */
export function resultToSelectionContext(
  result: CustomSelectionResult,
  documentId: string,
  fingerprint?: string | null
): import("../../../types/selection").PdfSelectionContext {
  return {
    type: "pdf",
    documentId,
    fingerprint,
    source: "custom",
    pages: result.pages.map((page) => ({
      pageNumber: page.pageNumber,
      viewportRects: page.viewportRects,
      pdfRects: page.pdfRects,
    })),
    tokenData: result.tokenData,
  } as any; // Type assertion to handle extended type
}
