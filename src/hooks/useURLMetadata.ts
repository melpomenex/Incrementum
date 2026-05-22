/**
 * Hook for fetching metadata from URLs for import preview
 * Integrates with existing YouTube and RSS APIs
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { invokeCommand, isTauri } from "../lib/tauri";
import { URLType } from "./useURLDetector";
import {
  fetchYouTubeVideoInfo,
  type YouTubeVideo,
} from "../api/youtube";
import {
  fetchFeed,
  subscribeToFeedAuto,
  type Feed,
} from "../api/rss";
import { useDocumentStore } from "../stores/documentStore";
import { importYouTubeVideo } from "../api/documents";
import type { Document } from "../types/document";

/**
 * Duplicate check result
 */
export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingItem?: {
    id: string;
    title: string;
    type: "document" | "feed";
  };
}

/**
 * Check if a URL has already been imported
 */
export function checkForDuplicate(
  urlType: URLType,
  url: string,
  documents: Array<{ id: string; title: string; filePath: string; fileType: string }>
): DuplicateCheckResult {
  if (urlType === URLType.YouTube) {
    // Extract video ID
    const videoIdMatch = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
    );
    if (videoIdMatch) {
      const videoId = videoIdMatch[1];
      // Check if any YouTube document has this video ID in its filePath
      const existing = documents.find(
        (doc) => doc.fileType === "youtube" && doc.filePath.includes(videoId)
      );
      if (existing) {
        return {
          isDuplicate: true,
          existingItem: {
            id: existing.id,
            title: existing.title,
            type: "document",
          },
        };
      }
    }
  } else if (urlType === URLType.RSSFeed) {
    // For RSS feeds, check if any document has this feed URL
    // RSS feeds might be stored differently, so we check the filePath
    const normalizedUrl = url.toLowerCase().trim();
    const existing = documents.find(
      (doc) => doc.filePath.toLowerCase().includes(normalizedUrl) ||
               (doc.fileType === "rss" && doc.filePath.toLowerCase() === normalizedUrl)
    );
    if (existing) {
      return {
        isDuplicate: true,
        existingItem: {
          id: existing.id,
          title: existing.title,
          type: "feed",
        },
      };
    }
  } else if (urlType === URLType.WebPage) {
    // For web pages, check if any HTML document has this URL
    const normalizedUrl = url.toLowerCase().trim();
    const existing = documents.find(
      (doc) => doc.fileType === "html" && doc.filePath.toLowerCase() === normalizedUrl
    );
    if (existing) {
      return {
        isDuplicate: true,
        existingItem: {
          id: existing.id,
          title: existing.title,
          type: "document",
        },
      };
    }
  }

  return { isDuplicate: false };
}

/**
 * Metadata fetch state
 */
export interface MetadataFetchState {
  data: YouTubeVideo | Feed | WebPageMetadata | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Web page metadata
 */
export interface WebPageMetadata {
  url: string;
  title: string;
  description: string;
  favicon?: string;
  image?: string;
}

/**
 * Fetch options
 */
export interface FetchOptions {
  debounceMs?: number;
  enabled?: boolean;
}

/**
 * Hook for fetching URL metadata
 */
export function useURLMetadata(
  urlType: URLType,
  url: string,
  options: FetchOptions = {}
): MetadataFetchState {
  const { debounceMs = 500, enabled = true } = options;

  const [state, setState] = useState<MetadataFetchState>({
    data: null,
    isLoading: false,
    error: null,
  });

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchMetadata = useCallback(async () => {
    if (!enabled || !url || urlType === URLType.Unknown) {
      setState({ data: null, isLoading: false, error: null });
      return;
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      let data: YouTubeVideo | Feed | WebPageMetadata | null = null;

        switch (urlType) {
        case URLType.YouTube: {
          // Extract video ID and fetch metadata
          const videoIdMatch = url.match(
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
          );
          if (videoIdMatch) {
            data = await fetchYouTubeVideoInfo(videoIdMatch[1]);
            if (!data) {
              throw new Error("Failed to fetch video metadata");
            }
          }
          break;
        }

        case URLType.RSSFeed:
          // Fetch RSS feed metadata
          data = await fetchFeed(url);
          if (!data) {
            throw new Error("Failed to fetch feed metadata");
          }
          break;

        case URLType.WebPage:
          // Fetch web page metadata via backend
          try {
            const response = await fetch("/api/article/preview", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url }),
              signal,
            });
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            data = await response.json();
          } catch (httpError) {
            // Try Tauri backend if available
            if (isTauri()) {
              try {
                data = await invokeCommand<any>("fetch_web_page_preview", { url });
              } catch {
                throw new Error("Failed to fetch page preview");
              }
            } else {
              throw httpError;
            }
          }
          break;

        default:
          setState({ data: null, isLoading: false, error: null });
          return;
      }

      if (!signal.aborted) {
        setState({ data, isLoading: false, error: null });
      }
    } catch (error) {
      if (!signal.aborted) {
        const errorMessage = error instanceof Error
          ? error.message
          : "Failed to fetch metadata";
        setState({ data: null, isLoading: false, error: errorMessage });
      }
    }
  }, [url, urlType, enabled]);

  // Debounced fetch
  useEffect(() => {
    if (!enabled || !url) {
      setState({ data: null, isLoading: false, error: null });
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchMetadata();
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchMetadata, debounceMs, url, enabled]);

  return state;
}

/**
 * Hook for importing a URL
 */
export function useURLImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importURL = useCallback(async (
    urlType: URLType,
    url: string,
    options: {
      tags?: string[];
      collectionId?: string;
    } = {}
  ) => {
    setIsImporting(true);
    setError(null);

    try {
      let result;

      switch (urlType) {
        case URLType.YouTube: {
          result = await importYouTubeVideo(url, options.collectionId);
          await useDocumentStore.getState().loadDocuments();
          break;
        }

        case URLType.RSSFeed: {
          const feed = await fetchFeed(url);
          if (feed) {
            await subscribeToFeedAuto(feed);
            result = feed;
          } else {
            throw new Error("Failed to fetch RSS feed info");
          }
          break;
        }

        case URLType.WebPage: {
          const doc = await useDocumentStore.getState().importFromUrl(url);
          const updates: Partial<Document> = {};
          if (options.tags && options.tags.length > 0) {
            updates.tags = Array.from(new Set([...(doc.tags || []), ...options.tags]));
          }
          if (options.collectionId) {
            updates.collectionId = options.collectionId;
          }
          
          if (Object.keys(updates).length > 0) {
            await useDocumentStore.getState().updateDocumentOptimistic(doc.id, updates);
            result = { ...doc, ...updates };
          } else {
            result = doc;
          }
          break;
        }

        default:
          throw new Error("Unsupported URL type");
      }

      setIsImporting(false);
      return result;
    } catch (err) {
      setIsImporting(false);
      const errorMessage = err instanceof Error ? err.message : "Import failed";
      setError(errorMessage);
      throw err;
    }
  }, []);

  return {
    importURL,
    isImporting,
    error,
  };
}

/**
 * Hook for checking if a URL has already been imported
 */
export function useDuplicateCheck(urlType: URLType, url: string): DuplicateCheckResult {
  const documents = useDocumentStore((state) => state.documents);

  return useCallback(() => {
    if (!url || urlType === URLType.Unknown) {
      return { isDuplicate: false };
    }
    return checkForDuplicate(urlType, url, documents);
  }, [urlType, url, documents])();
}
