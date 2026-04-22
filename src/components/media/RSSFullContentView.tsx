import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import {
  fetchArticleFullContent,
  getArticleFullContent,
  isContentStale,
  type FeedItem,
  type FullContentResponse,
} from "../../api/rss";

interface RSSFullContentViewProps {
  item: FeedItem;
}

/**
 * Safely render HTML content with XSS protection
 */
function SafeHTML({ html }: { html: string }) {
  // Sanitize HTML by removing dangerous elements
  const sanitizeHtml = (input: string): string => {
    const temp = document.createElement("div");
    temp.innerHTML = input;

    // Remove script tags and event handlers
    const scripts = temp.querySelectorAll("script");
    scripts.forEach((el) => el.remove());

    // Remove inline event handlers and javascript: URLs
    const allElements = temp.querySelectorAll("*");
    allElements.forEach((el) => {
      // Remove event handlers
      const attributes = Array.from(el.attributes);
      attributes.forEach((attr) => {
        if (attr.name.startsWith("on") || attr.value.toLowerCase().startsWith("javascript:")) {
          el.removeAttribute(attr.name);
        }
      });

      // Validate link hrefs
      if (el.tagName === "A") {
        const href = el.getAttribute("href");
        if (href) {
          // Only allow http/https links
          if (!href.startsWith("http://") && !href.startsWith("https://")) {
            el.removeAttribute("href");
          } else {
            // Add target and rel for external links
            el.setAttribute("target", "_blank");
            el.setAttribute("rel", "noopener noreferrer");
          }
        }
      }

      // Validate image sources
      if (el.tagName === "IMG") {
        const src = el.getAttribute("src");
        if (src) {
          // Only allow http/https data URLs for images
          if (
            !src.startsWith("http://") &&
            !src.startsWith("https://") &&
            !src.startsWith("data:")
          ) {
            el.remove();
          }
        }
      }
    });

    return temp.innerHTML;
  };

  const sanitized = sanitizeHtml(html);

  return (
    <div
      className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-img:rounded-lg prose-img:shadow-md prose-p:leading-relaxed prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}

/**
 * RSS Full Content View Component
 * Displays extracted full article content with fetching, caching, and error states
 */
export function RSSFullContentView({ item }: RSSFullContentViewProps) {
  const [content, setContent] = useState<string | null>(item.fullContent || null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(item.fullContentFetchedAt || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  // Check for cached content on mount
  useEffect(() => {
    const loadCachedContent = async () => {
      if (!content && !item.fullContent) {
        const cached = await getArticleFullContent(item.id);
        if (cached?.content) {
          setContent(cached.content);
          setFetchedAt(cached.fetchedAt || null);
        }
      }
    };
    loadCachedContent();
  }, [item.id, content, item.fullContent]);

  // Check if content is stale
  useEffect(() => {
    if (fetchedAt) {
      setIsStale(isContentStale(fetchedAt));
    }
  }, [fetchedAt]);

  // Fetch full content
  const handleFetchContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result: FullContentResponse = await fetchArticleFullContent(item.id, item.link);

      if (result.success && result.fullContent) {
        setContent(result.fullContent);
        setFetchedAt(result.fetchedAt);
        setIsStale(false);
      } else {
        setError(result.error || "Failed to fetch content");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [item.id, item.link]);

  // Refresh stale content
  const handleRefresh = useCallback(async () => {
    await handleFetchContent();
  }, [handleFetchContent]);

  // Open original article in new tab
  const handleOpenOriginal = useCallback(() => {
    window.open(item.link, "_blank", "noopener,noreferrer");
  }, [item.link]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Fetching full article content...</p>
      </div>
    );
  }

  // Render error state with retry option
  if (error && !content) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4 p-6">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <div className="text-center">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
            Failed to load full content
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{error}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleFetchContent}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
          <button
            onClick={handleOpenOriginal}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            Open Original
          </button>
        </div>
      </div>
    );
  }

  // Render content or fallback to summary
  return (
    <div className="h-full flex flex-col">
      {/* Header with actions */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {content && (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Full content
                {isStale && <span className="ml-1 text-amber-500">(stale)</span>}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {content && isStale && (
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          )}
          {!content && !error && (
            <button
              onClick={handleFetchContent}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Fetch Full Content
            </button>
          )}
          <button
            onClick={handleOpenOriginal}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Open Original
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-4">
        {content ? (
          <SafeHTML html={content} />
        ) : (
          <div className="prose prose-slate dark:prose-invert max-w-none">
            {/* Show original RSS content as fallback */}
            <div
              dangerouslySetInnerHTML={{
                __html: item.content || item.description || "",
              }}
            />
            {!item.content && !item.description && (
              <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No content available. Click "Fetch Full Content" to load the complete article.
                </p>
                <button
                  onClick={handleFetchContent}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  Fetch Full Content
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
