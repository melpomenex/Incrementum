import { useCallback, useEffect, useState } from "react";
import { summaryCache, generateContentHash } from "./summaryCache";
import type { SummaryCacheEntry, SummaryGenerationParams } from "../../types/rssSummary";

interface UseSummaryCacheResult {
  /** Get a cached summary if valid */
  getCachedSummary: (articleId: string, content: string) => SummaryCacheEntry | null;
  /** Store a new summary in cache */
  cacheSummary: (
    articleId: string,
    content: string,
    summary: string,
    params: SummaryGenerationParams,
    metadata?: { articleTitle?: string; articleUrl?: string }
  ) => void;
  /** Check if summary is cached */
  isCached: (articleId: string, content: string) => boolean;
  /** Clear all cached summaries */
  clearCache: () => void;
  /** Cache statistics */
  stats: {
    totalEntries: number;
    oldestEntry: string | null;
    newestEntry: string | null;
    totalSizeBytes: number;
  } | null;
}

/**
 * React hook for summary cache management
 * Provides methods to get, set, and manage cached summaries
 */
export function useSummaryCache(): UseSummaryCacheResult {
  const [stats, setStats] = useState<UseSummaryCacheResult["stats"]>(null);

  // Load stats on mount
  useEffect(() => {
    setStats(summaryCache.getStats());
  }, []);

  /** Get cached summary if it exists and content hasn't changed */
  const getCachedSummary = useCallback(
    (articleId: string, content: string): SummaryCacheEntry | null => {
      const contentHash = generateContentHash(content);
      const entry = summaryCache.get(articleId, contentHash);
      setStats(summaryCache.getStats());
      return entry;
    },
    []
  );

  /** Store a summary in cache */
  const cacheSummary = useCallback(
    (
      articleId: string,
      content: string,
      summary: string,
      params: SummaryGenerationParams,
      metadata?: { articleTitle?: string; articleUrl?: string }
    ): void => {
      const contentHash = generateContentHash(content);
      const entry: SummaryCacheEntry = {
        content: summary,
        timestamp: new Date().toISOString(),
        length: params.length,
        focus: params.focus,
        contentHash,
        articleTitle: metadata?.articleTitle,
        articleUrl: metadata?.articleUrl,
      };

      summaryCache.set(articleId, entry);
      summaryCache.saveToStorage();
      setStats(summaryCache.getStats());
    },
    []
  );

  /** Check if summary is cached and valid */
  const isCached = useCallback((articleId: string, content: string): boolean => {
    const contentHash = generateContentHash(content);
    const hasCache = summaryCache.has(articleId, contentHash);
    return hasCache;
  }, []);

  /** Clear all cached summaries */
  const clearCache = useCallback((): void => {
    summaryCache.clear();
    summaryCache.saveToStorage();
    setStats(summaryCache.getStats());
  }, []);

  return {
    getCachedSummary,
    cacheSummary,
    isCached,
    clearCache,
    stats,
  };
}
