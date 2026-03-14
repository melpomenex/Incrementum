/**
 * SpatialIndex - Sorted array index with binary search for fast token lookup.
 *
 * For ~1000-2000 tokens/page, a sorted array with binary search is sufficient.
 * R-tree would add complexity without measurable benefit for this scale.
 */

import type { TextToken, PageTokenData, HitTestResult } from "./types";

/**
 * Spatial index for efficient token lookup operations.
 * Uses sorted arrays by (Y, X) for binary search.
 */
export class SpatialIndex {
  private pageIndices: Map<number, PageSpatialIndex> = new Map();

  /**
   * Add or update token data for a page.
   */
  addPage(pageData: PageTokenData): void {
    const existing = this.pageIndices.get(pageData.pageIndex);
    if (existing && existing.scale === pageData.scale) {
      return; // Already indexed at this scale
    }

    this.pageIndices.set(pageData.pageIndex, new PageSpatialIndex(pageData));
  }

  /**
   * Remove a page from the index.
   */
  removePage(pageIndex: number): void {
    this.pageIndices.delete(pageIndex);
  }

  /**
   * Clear all pages from the index.
   */
  clear(): void {
    this.pageIndices.clear();
  }

  /**
   * Find the nearest token to a point in viewport coordinates.
   */
  findNearestToken(
    pageIndex: number,
    x: number,
    y: number,
    tolerance: number = 10
  ): HitTestResult | null {
    const pageindex = this.pageIndices.get(pageIndex);
    if (!pageindex) return null;

    return pageindex.findNearestToken(x, y, tolerance);
  }

  /**
   * Get tokens in a range between start and end tokens (inclusive).
   * Returns tokens sorted by reading order.
   */
  getTokensInRange(
    pageIndex: number,
    startTokenId: string,
    endTokenId: string
  ): TextToken[] {
    const pageindex = this.pageIndices.get(pageIndex);
    if (!pageindex) return [];

    return pageindex.getTokensInRange(startTokenId, endTokenId);
  }

  /**
   * Get all tokens for a page.
   */
  getPageTokens(pageIndex: number): TextToken[] {
    const pageindex = this.pageIndices.get(pageIndex);
    return pageindex?.tokens ?? [];
  }

  /**
   * Get a specific token by ID.
   */
  getToken(pageIndex: number, tokenId: string): TextToken | undefined {
    const pageindex = this.pageIndices.get(pageIndex);
    if (!pageindex) return undefined;

    return pageindex.getTokenById(tokenId);
  }

  /**
   * Check if a page is indexed.
   */
  hasPage(pageIndex: number): boolean {
    return this.pageIndices.has(pageIndex);
  }

  /**
   * Get the number of indexed pages.
   */
  get pageCount(): number {
    return this.pageIndices.size;
  }
}

/**
 * Per-page spatial index using sorted arrays.
 */
class PageSpatialIndex {
  readonly tokens: TextToken[];
  readonly scale: number;

  // Sorted arrays for binary search
  private tokensByY: TextToken[];
  private tokenById: Map<string, TextToken>;
  private tokenIndexById: Map<string, number>;

  constructor(pageData: PageTokenData) {
    this.tokens = pageData.tokens;
    this.scale = pageData.scale;

    // Create sorted copy by Y position
    this.tokensByY = [...pageData.tokens].sort((a, b) => a.viewportY - b.viewportY);

    // Create ID lookup map
    this.tokenById = new Map();
    this.tokenIndexById = new Map();
    for (let i = 0; i < pageData.tokens.length; i++) {
      const token = pageData.tokens[i];
      this.tokenById.set(token.id, token);
      this.tokenIndexById.set(token.id, i);
    }
  }

  /**
   * Find the nearest token to a point.
   */
  findNearestToken(x: number, y: number, tolerance: number): HitTestResult | null {
    if (this.tokens.length === 0) return null;

    // Binary search to find candidate range in Y
    const yMin = y - tolerance * 2;
    const yMax = y + tolerance * 2;

    let bestToken: TextToken | null = null;
    let bestDistance = Infinity;

    // Binary search for Y range
    const startIndex = this.binarySearchY(yMin);
    const endIndex = this.binarySearchY(yMax);

    // Linear scan within Y band
    for (let i = startIndex; i <= endIndex && i < this.tokensByY.length; i++) {
      const token = this.tokensByY[i];

      // Quick Y bounds check
      if (token.viewportY + token.viewportH < y - tolerance ||
          token.viewportY > y + tolerance) {
        continue;
      }

      // Calculate distance to token center
      const centerX = token.viewportX + token.viewportW / 2;
      const centerY = token.viewportY + token.viewportH / 2;
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Check if within tolerance and better than current best
      if (distance <= tolerance && distance < bestDistance) {
        bestDistance = distance;
        bestToken = token;
      }
    }

    if (!bestToken) return null;

    return {
      token: bestToken,
      distance: bestDistance,
      pageIndex: bestToken.pageIndex,
    };
  }

  /**
   * Get tokens in a range between two token IDs (inclusive).
   */
  getTokensInRange(startTokenId: string, endTokenId: string): TextToken[] {
    const startIndex = this.tokenIndexById.get(startTokenId);
    const endIndex = this.tokenIndexById.get(endTokenId);

    if (startIndex === undefined || endIndex === undefined) {
      return [];
    }

    // Ensure proper order
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);

    // Return tokens in reading order
    return this.tokens.slice(minIndex, maxIndex + 1);
  }

  /**
   * Get a token by its ID.
   */
  getTokenById(tokenId: string): TextToken | undefined {
    return this.tokenById.get(tokenId);
  }

  /**
   * Binary search to find the index of the first token with Y >= targetY.
   */
  private binarySearchY(targetY: number): number {
    let low = 0;
    let high = this.tokensByY.length - 1;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.tokensByY[mid].viewportY < targetY) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }
}

/**
 * Utility functions for token operations.
 */
export const TokenUtils = {
  /**
   * Calculate the center point of a token's bounding box.
   */
  getTokenCenter(token: TextToken): { x: number; y: number } {
    return {
      x: token.viewportX + token.viewportW / 2,
      y: token.viewportY + token.viewportH / 2,
    };
  },

  /**
   * Check if a point is within a token's bounding box.
   */
  isPointInToken(x: number, y: number, token: TextToken): boolean {
    return (
      x >= token.viewportX &&
      x <= token.viewportX + token.viewportW &&
      y >= token.viewportY &&
      y <= token.viewportY + token.viewportH
    );
  },

  /**
   * Check if a point is within a token's bounding box with tolerance.
   */
  isPointNearToken(
    x: number,
    y: number,
    token: TextToken,
    tolerance: number
  ): boolean {
    return (
      x >= token.viewportX - tolerance &&
      x <= token.viewportX + token.viewportW + tolerance &&
      y >= token.viewportY - tolerance &&
      y <= token.viewportY + token.viewportH + tolerance
    );
  },

  /**
   * Merge adjacent tokens' bounding boxes on the same line.
   */
  mergeAdjacentBoundingBoxes(
    tokens: TextToken[],
    gapThreshold: number = 2
  ): { left: number; top: number; width: number; height: number }[] {
    if (tokens.length === 0) return [];

    // Sort by viewport position (Y, then X)
    const sorted = [...tokens].sort((a, b) => {
      const yDiff = a.viewportY - b.viewportY;
      if (Math.abs(yDiff) > 5) return yDiff;
      return a.viewportX - b.viewportX;
    });

    const mergedBoxes: { left: number; top: number; width: number; height: number }[] = [];
    let currentBox: { left: number; top: number; width: number; height: number } | null = null;
    let lastToken: TextToken | null = null;

    for (const token of sorted) {
      const box = {
        left: token.viewportX,
        top: token.viewportY,
        width: token.viewportW,
        height: token.viewportH,
      };

      if (!currentBox) {
        currentBox = { ...box };
        lastToken = token;
        continue;
      }

      // Check if this token is adjacent to the current box
      const isSameLine = Math.abs(token.viewportY - currentBox.top) < 5;
      const isAdjacent = isSameLine &&
        Math.abs(token.viewportX - (currentBox.left + currentBox.width)) < gapThreshold;

      if (isAdjacent) {
        // Extend current box
        const newRight = token.viewportX + token.viewportW;
        currentBox.width = newRight - currentBox.left;
        currentBox.height = Math.max(currentBox.height, token.viewportH);
        lastToken = token;
      } else {
        // Push current box and start new one
        mergedBoxes.push(currentBox);
        currentBox = { ...box };
        lastToken = token;
      }
    }

    // Push final box
    if (currentBox) {
      mergedBoxes.push(currentBox);
    }

    return mergedBoxes;
  },
};
