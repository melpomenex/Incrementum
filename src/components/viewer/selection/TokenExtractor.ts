/**
 * TokenExtractor - Extracts text tokens from PDF.js text content.
 *
 * This module is responsible for:
 * 1. Calling page.getTextContent() for each rendered page
 * 2. Calculating per-character bounding boxes using viewport transforms
 * 3. Sorting tokens by reading order (Y-first, then X within line band)
 * 4. Detecting column boundaries for multi-column documents
 */

import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from "pdfjs-dist";
import type {
  TextToken,
  PageTokenData,
  LineBand,
  ColumnBoundary,
  TokenExtractorConfig,
} from "./types";

const DEFAULT_CONFIG: TokenExtractorConfig = {
  hitTolerance: 10,
  spaceGapThreshold: 3,
  newlineYThreshold: 5,
  detectColumns: true,
};

/**
 * Extracts text tokens from PDF pages for use in geometric selection.
 */
export class TokenExtractor {
  private config: TokenExtractorConfig;
  private pageDataCache: Map<number, PageTokenData> = new Map();

  constructor(config: Partial<TokenExtractorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Extract tokens for a specific page.
   * Results are cached per page/scale combination.
   */
  async extractPageTokens(
    page: PDFPageProxy,
    viewport: PageViewport,
    pageIndex: number
  ): Promise<PageTokenData> {
    // Check cache
    const _cacheKey = `${pageIndex}-${viewport.scale}`;
    const cached = this.pageDataCache.get(pageIndex);
    if (cached && cached.scale === viewport.scale) {
      return cached;
    }

    // Get text content from PDF.js
    const textContent = await page.getTextContent({
      includeMarkedContent: true,
    });

    const tokens: TextToken[] = [];
    let globalTokenIndex = 0;

    // Process each text item
    for (let itemIndex = 0; itemIndex < textContent.items.length; itemIndex++) {
      const item = textContent.items[itemIndex];

      // Skip non-text items
      if (!("str" in item) || typeof item.str !== "string") {
        continue;
      }

      // Get the transform array: [scaleX, skewX, skewY, scaleY, translateX, translateY]
      const transform = item.transform;
      if (!transform || transform.length < 6) {
        continue;
      }

      const [scaleX, _skewX, skewY, _scaleY, translateX, translateY] = transform;

      // Calculate font metrics
      const fontSize = Math.sqrt(scaleX * scaleX + skewY * skewY);
      const height = Math.abs(fontSize);

      // Extract per-character tokens
      const text = item.str;
      let currentX = translateX;

      for (let charIndex = 0; charIndex < text.length; charIndex++) {
        const char = text[charIndex];

        // Skip whitespace-only tokens (but track position)
        if (char === " " || char === "\t" || char === "\n" || char === "\r") {
          // Estimate character width for space tracking
          const charWidth = fontSize * 0.3; // Approximate space width
          currentX += charWidth;
          continue;
        }

        // Calculate character width approximation
        // PDF.js doesn't provide per-character widths, so we estimate
        const charWidth = this.estimateCharWidth(char, fontSize, item.fontName);

        // Calculate bounding box in PDF coordinates
        // Note: PDF Y-axis is inverted (0 at bottom)
        const pdfX = currentX;
        const pdfY = translateY - height; // Convert to top-left origin
        const pdfWidth = charWidth;
        const pdfHeight = height;

        // Convert to viewport coordinates
        const [viewportX1, viewportY1] = viewport.convertToViewportPoint(pdfX, pdfY + pdfHeight);
        const [viewportX2, viewportY2] = viewport.convertToViewportPoint(pdfX + pdfWidth, pdfY);

        const viewportX = Math.min(viewportX1, viewportX2);
        const viewportY = Math.min(viewportY1, viewportY2);
        const viewportW = Math.abs(viewportX2 - viewportX1);
        const viewportH = Math.abs(viewportY2 - viewportY1);

        const token: TextToken = {
          id: `${pageIndex}-${itemIndex}-${charIndex}`,
          text: char,
          pageIndex,
          pdfX,
          pdfY,
          pdfWidth,
          pdfHeight,
          viewportX,
          viewportY,
          viewportW,
          viewportH,
          readingOrder: globalTokenIndex++,
        };

        tokens.push(token);
        currentX += charWidth;
      }
    }

    // Sort tokens by reading order (Y-first, then X within line band)
    const sortedTokens = this.sortByReadingOrder(tokens);

    // Detect line bands
    const lineBands = this.detectLineBands(sortedTokens);

    // Detect columns (if enabled)
    const columns = this.config.detectColumns
      ? this.detectColumns(sortedTokens)
      : [];

    // Assign final reading order based on sorted position
    sortedTokens.forEach((token, index) => {
      token.readingOrder = index;
    });

    const pageData: PageTokenData = {
      pageIndex,
      tokens: sortedTokens,
      lineBands,
      columns,
      scale: viewport.scale,
    };

    // Cache the result
    this.pageDataCache.set(pageIndex, pageData);

    return pageData;
  }

  /**
   * Extract tokens for all pages in a document.
   */
  async extractAllPageTokens(
    pdf: PDFDocumentProxy,
    viewports: (PageViewport | null)[]
  ): Promise<Map<number, PageTokenData>> {
    const results = new Map<number, PageTokenData>();

    for (let i = 0; i < pdf.numPages; i++) {
      const viewport = viewports[i];
      if (!viewport) continue;

      const page = await pdf.getPage(i + 1);
      const pageData = await this.extractPageTokens(page, viewport, i);
      results.set(i, pageData);
    }

    return results;
  }

  /**
   * Clear cached token data (call on significant changes like document reload).
   */
  clearCache(pageIndex?: number): void {
    if (pageIndex !== undefined) {
      this.pageDataCache.delete(pageIndex);
    } else {
      this.pageDataCache.clear();
    }
  }

  /**
   * Estimate character width based on font metrics.
   * This is a heuristic since PDF.js doesn't provide per-character widths.
   */
  private estimateCharWidth(char: string, fontSize: number, _fontName?: string): number {
    // Basic width estimation based on character type
    const code = char.charCodeAt(0);

    // CJK characters are typically full-width
    if (code >= 0x4e00 && code <= 0x9fff) {
      return fontSize * 1.0;
    }

    // Wide characters (MW, etc.)
    if ("MW".includes(char)) {
      return fontSize * 0.9;
    }

    // Narrow characters
    if ("iIl|.,;:'\"!".includes(char)) {
      return fontSize * 0.3;
    }

    // Default for Latin characters
    return fontSize * 0.5;
  }

  /**
   * Sort tokens by reading order: Y-first, then X within line band.
   */
  private sortByReadingOrder(tokens: TextToken[]): TextToken[] {
    if (tokens.length === 0) return tokens;

    // Group tokens into line bands based on Y position
    const LINE_TOLERANCE = 3; // pixels in PDF coords

    // Sort by Y first
    const sortedByY = [...tokens].sort((a, b) => a.pdfY - b.pdfY);

    // Create line bands
    const bands: { y: number; tokens: TextToken[] }[] = [];
    for (const token of sortedByY) {
      // Find existing band or create new one
      let band = bands.find(
        (b) => Math.abs(b.y - token.pdfY) < LINE_TOLERANCE
      );
      if (!band) {
        band = { y: token.pdfY, tokens: [] };
        bands.push(band);
      }
      band.tokens.push(token);
    }

    // Sort bands by Y, then tokens within each band by X
    bands.sort((a, b) => a.y - b.y);
    for (const band of bands) {
      band.tokens.sort((a, b) => a.pdfX - b.pdfX);
    }

    // Flatten back to single array
    return bands.flatMap((band) => band.tokens);
  }

  /**
   * Detect line bands for text reconstruction.
   */
  private detectLineBands(tokens: TextToken[]): LineBand[] {
    if (tokens.length === 0) return [];

    const bands: LineBand[] = [];
    const LINE_TOLERANCE = 5; // pixels in viewport coords

    for (const token of tokens) {
      const tokenCenterY = token.viewportY + token.viewportH / 2;

      // Find existing band
      let band = bands.find(
        (b) => Math.abs(b.centerY - tokenCenterY) < LINE_TOLERANCE
      );

      if (!band) {
        band = {
          centerY: tokenCenterY,
          tolerance: LINE_TOLERANCE,
          tokens: [],
        };
        bands.push(band);
      }

      band.tokens.push(token);
    }

    // Sort bands by Y and tokens within bands by X
    bands.sort((a, b) => a.centerY - b.centerY);
    for (const band of bands) {
      band.tokens.sort((a, b) => a.viewportX - b.viewportX);
    }

    return bands;
  }

  /**
   * Detect column boundaries using X-gap clustering.
   */
  private detectColumns(tokens: TextToken[]): ColumnBoundary[] {
    if (tokens.length === 0) return [];

    // Get all unique X positions
    const xPositions = new Set<number>();
    for (const token of tokens) {
      xPositions.add(token.viewportX);
    }

    const sortedX = Array.from(xPositions).sort((a, b) => a - b);

    if (sortedX.length < 2) {
      return [{ startX: 0, endX: Infinity, columnIndex: 0 }];
    }

    // Calculate gaps between consecutive X positions
    const gaps: { x1: number; x2: number; gap: number }[] = [];
    for (let i = 1; i < sortedX.length; i++) {
      gaps.push({
        x1: sortedX[i - 1],
        x2: sortedX[i],
        gap: sortedX[i] - sortedX[i - 1],
      });
    }

    // Find significant gaps (larger than average)
    const avgGap = gaps.reduce((sum, g) => sum + g.gap, 0) / gaps.length;
    const threshold = avgGap * 3; // Significant gap is 3x average

    const significantGaps = gaps.filter((g) => g.gap > threshold);

    if (significantGaps.length === 0) {
      return [{ startX: 0, endX: Infinity, columnIndex: 0 }];
    }

    // Create columns from significant gaps
    const columns: ColumnBoundary[] = [];
    let currentStart = 0;
    let columnIndex = 0;

    for (const gap of significantGaps) {
      columns.push({
        startX: currentStart,
        endX: gap.x1 + gap.gap / 2, // Split point in middle of gap
        columnIndex: columnIndex++,
      });
      currentStart = gap.x1 + gap.gap / 2;
    }

    // Add final column
    columns.push({
      startX: currentStart,
      endX: Infinity,
      columnIndex,
    });

    return columns;
  }

  /**
   * Get cached page data if available.
   */
  getCachedPageData(pageIndex: number): PageTokenData | undefined {
    return this.pageDataCache.get(pageIndex);
  }
}
