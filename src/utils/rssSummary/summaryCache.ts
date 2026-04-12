import type { SummaryCacheEntry, SummaryCacheStats } from "../../types/rssSummary";

/** Cache version for format migrations */
const CACHE_VERSION = "1";
const CACHE_KEY = "rss-summary-cache-v" + CACHE_VERSION;
const MAX_CACHE_ENTRIES = 100;
const TTL_DAYS = 7;
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Generate a simple hash from content string
 * Used for cache invalidation when article content changes
 */
export function generateContentHash(content: string): string {
  let hash = 0;
  if (content.length === 0) return String(hash);

  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return String(Math.abs(hash));
}

/**
 * Summary Cache Manager
 * Handles caching of AI-generated summaries with TTL and LRU eviction
 */
export class SummaryCache {
  private cache: Map<string, SummaryCacheEntry> = new Map();

  /**
   * Get a cached summary if it exists and is valid
   * @param articleId - Unique article identifier
   * @param contentHash - Hash of current article content for validation
   * @returns The cached entry or null if not found/invalid
   */
  get(articleId: string, contentHash: string): SummaryCacheEntry | null {
    const entry = this.cache.get(articleId);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    const entryAge = Date.now() - new Date(entry.timestamp).getTime();
    if (entryAge > TTL_MS) {
      this.cache.delete(articleId);
      return null;
    }

    // Check if content has changed
    if (entry.contentHash !== contentHash) {
      this.cache.delete(articleId);
      return null;
    }

    // Move to end (LRU - most recently used)
    this.cache.delete(articleId);
    this.cache.set(articleId, entry);

    return entry;
  }

  /**
   * Store a summary in the cache
   * @param articleId - Unique article identifier
   * @param entry - The cache entry to store
   */
  set(articleId: string, entry: SummaryCacheEntry): void {
    // If at capacity, remove oldest entry (first in map due to LRU ordering)
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(articleId, entry);
  }

  /**
   * Check if a valid cached summary exists
   * @param articleId - Unique article identifier
   * @param contentHash - Hash of current article content for validation
   * @returns true if valid cache exists
   */
  has(articleId: string, contentHash: string): boolean {
    return this.get(articleId, contentHash) !== null;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics for debugging
   */
  getStats(): SummaryCacheStats {
    let totalSizeBytes = 0;
    let oldestTimestamp: Date | null = null;
    let newestTimestamp: Date | null = null;

    for (const entry of this.cache.values()) {
      totalSizeBytes += new Blob([entry.content]).size;
      const timestamp = new Date(entry.timestamp);

      if (!oldestTimestamp || timestamp < oldestTimestamp) {
        oldestTimestamp = timestamp;
      }
      if (!newestTimestamp || timestamp > newestTimestamp) {
        newestTimestamp = timestamp;
      }
    }

    return {
      totalEntries: this.cache.size,
      oldestEntry: oldestTimestamp?.toISOString() ?? null,
      newestEntry: newestTimestamp?.toISOString() ?? null,
      totalSizeBytes,
    };
  }

  /**
   * Load cache from localStorage
   * Automatically purges expired entries during load
   */
  loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored) as Record<string, SummaryCacheEntry>;
      const now = Date.now();

      // Filter out expired entries during load
      for (const [articleId, entry] of Object.entries(parsed)) {
        const entryAge = now - new Date(entry.timestamp).getTime();
        if (entryAge <= TTL_MS) {
          this.cache.set(articleId, entry);
        }
      }

      // If loaded more than max entries, trim to limit
      while (this.cache.size > MAX_CACHE_ENTRIES) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey !== undefined) {
          this.cache.delete(firstKey);
        }
      }
    } catch (error) {
      console.error("Failed to load summary cache from storage:", error);
      this.cache.clear();
    }
  }

  /**
   * Save cache to localStorage
   */
  saveToStorage(): void {
    try {
      const entries: Record<string, SummaryCacheEntry> = {};
      for (const [articleId, entry] of this.cache.entries()) {
        entries[articleId] = entry;
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error("Failed to save summary cache to storage:", error);
    }
  }

  /**
   * Get all cache entries (for debugging)
   */
  getAllEntries(): Map<string, SummaryCacheEntry> {
    return new Map(this.cache);
  }

  /**
   * Delete a specific entry from the cache
   * @param articleId - Unique article identifier
   */
  delete(articleId: string): void {
    this.cache.delete(articleId);
  }
}

/** Singleton instance for application-wide use */
export const summaryCache = new SummaryCache();

// Load cache on module initialization
if (typeof window !== "undefined") {
  summaryCache.loadFromStorage();
}
