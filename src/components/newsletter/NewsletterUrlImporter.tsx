/**
 * Smart Newsletter URL Importer
 * 
 * Provides an impeccable UX for importing newsletters by URL.
 * Features:
 * - Real-time platform detection
 * - Visual preview before subscription
 * - Smart error handling with suggestions
 * - Progress indicators
 * - One-click subscribe
 */

import { useState, useEffect, useRef } from "react";
import {
  Link2,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Rss,
  ExternalLink,
  X,
  Sparkles,
  Clock,
  FileText,
  Newspaper,
} from "lucide-react";
import {
  discoverNewsletterFeedUrl,
  fetchFeed,
  subscribeToFeedAuto,
  type Feed,
  type NewsletterFeedResult,
} from "../../api/rss";

// Platform configurations for UI
const PLATFORM_CONFIG: Record<string, { 
  name: string; 
  icon: string; 
  color: string;
  bgColor: string;
}> = {
  substack: {
    name: "Substack",
    icon: "📰",
    color: "text-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
  },
  beehiiv: {
    name: "Beehiiv",
    icon: "🐝",
    color: "text-yellow-600",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
  },
  ghost: {
    name: "Ghost",
    icon: "👻",
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
  },
  buttondown: {
    name: "Buttondown",
    icon: "🔘",
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
  },
  medium: {
    name: "Medium",
    icon: "📄",
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/30",
  },
  wordpress: {
    name: "WordPress",
    icon: "📝",
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
  },
  rss: {
    name: "RSS Feed",
    icon: "📡",
    color: "text-gray-600",
    bgColor: "bg-gray-50 dark:bg-gray-950/30",
  },
  default: {
    name: "Newsletter",
    icon: "📧",
    color: "text-primary",
    bgColor: "bg-muted",
  },
};

type ImportState =
  | { status: "idle" }
  | { status: "detecting"; url: string; progress: number }
  | { status: "preview"; feed: Feed; platform: NewsletterFeedResult; }
  | { status: "subscribing" }
  | { status: "success"; feed: Feed }
  | { status: "error"; error: string; suggestions?: string[] };

interface NewsletterUrlImporterProps {
  onSuccess?: (feed: Feed) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}

export function NewsletterUrlImporter({ 
  onSuccess, 
  onCancel,
  autoFocus = true 
}: NewsletterUrlImporterProps) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<ImportState>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (!url.trim() || !isValidUrl(url)) {
      setState({ status: "idle" });
      return;
    }

    const timeoutId = setTimeout(() => {
      handleDetect(url);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [url]);

  const isValidUrl = (str: string): boolean => {
    try {
      new URL(str.startsWith("http") ? str : `https://${str}`);
      return true;
    } catch {
      return false;
    }
  };

  const normalizeUrl = (input: string): string => {
    let normalized = input.trim();
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = `https://${normalized}`;
    }
    return normalized;
  };

  const handleDetect = async (inputUrl: string) => {
    const normalizedUrl = normalizeUrl(inputUrl);
    
    setState({ status: "detecting", url: normalizedUrl, progress: 0 });

    try {
      setState(prev => prev.status === "detecting" ? { ...prev, progress: 30 } : prev);
      
      const discovery = await discoverNewsletterFeedUrl(normalizedUrl);
      
      if (!discovery) {
        setState({
          status: "error",
          error: "Could not find an RSS feed for this URL",
          suggestions: [
            "Try the direct RSS feed URL (usually ends in /feed or /rss)",
            "Check if the site has a 'Subscribe' section with RSS link",
            "Some newsletters require email subscription only",
          ],
        });
        return;
      }

      setState(prev => prev.status === "detecting" ? { ...prev, progress: 60 } : prev);
      
      const feed = await fetchFeed(discovery.feedUrl);
      
      if (!feed) {
        setState({
          status: "error",
          error: "Found feed URL but couldn't fetch content",
          suggestions: [
            "The feed might be temporarily unavailable",
            "Try again in a few moments",
          ],
        });
        return;
      }

      setState(prev => prev.status === "detecting" ? { ...prev, progress: 100 } : prev);
      
      // Small delay for smooth transition
      await new Promise(resolve => setTimeout(resolve, 200));
      
      setState({
        status: "preview",
        feed,
        platform: discovery,
      });

    } catch (error) {
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error occurred",
        suggestions: [
          "Check your internet connection",
          "Verify the URL is correct",
          "Try again later",
        ],
      });
    }
  };

  const handleSubscribe = async () => {
    if (state.status !== "preview") return;

    setState({ status: "subscribing" });

    try {
      await subscribeToFeedAuto(state.feed);
      setState({ status: "success", feed: state.feed });
      onSuccess?.(state.feed);
    } catch (error) {
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "Failed to subscribe",
      });
    }
  };

  const handleReset = () => {
    setUrl("");
    setState({ status: "idle" });
    inputRef.current?.focus();
  };

  const getPlatformConfig = (platform: string) => {
    const key = platform.toLowerCase().replace(/\s+/g, "");
    return PLATFORM_CONFIG[key] || PLATFORM_CONFIG.default;
  };

  const formatRelativeDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* URL Input Section */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Link2 className="w-5 h-5" />
        </div>
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste newsletter URL (e.g., https://www.rohan-paul.com/)"
          className="w-full pl-12 pr-12 py-4 bg-background border border-border/70 rounded-xl text-foreground text-base focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary transition-all"
          disabled={state.status === "detecting" || state.status === "subscribing"}
        />
        {url && (
          <button
            onClick={handleReset}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* State-based Content */}
      <div className="mt-4">
        {/* Idle State - Help Text */}
        {state.status === "idle" && (
          <div className="text-center py-8 text-muted-foreground">
            <div className="flex justify-center gap-2 mb-3">
              <span className="px-3 py-1 bg-muted rounded-full text-sm">Substack</span>
              <span className="px-3 py-1 bg-muted rounded-full text-sm">Beehiiv</span>
              <span className="px-3 py-1 bg-muted rounded-full text-sm">Ghost</span>
              <span className="px-3 py-1 bg-muted rounded-full text-sm">+ more</span>
            </div>
            <p className="text-sm">
              Paste any newsletter URL and we'll automatically detect the RSS feed
            </p>
          </div>
        )}

        {/* Detecting State */}
        {state.status === "detecting" && (
          <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <span className="font-medium">Analyzing URL...</span>
            </div>
            <div className="space-y-2">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Validating URL</span>
                <span>{state.progress}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Preview State */}
        {state.status === "preview" && (
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            {/* Platform Badge */}
            <div className={`px-4 py-2 ${getPlatformConfig(state.platform.platform).bgColor} border-b border-border/50`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{getPlatformConfig(state.platform.platform).icon}</span>
                <span className={`text-sm font-medium ${getPlatformConfig(state.platform.platform).color}`}>
                  {getPlatformConfig(state.platform.platform).name} Newsletter Detected
                </span>
                {state.platform.confidence === "high" && (
                  <span className="ml-auto flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified
                  </span>
                )}
              </div>
            </div>

            {/* Feed Header */}
            <div className="p-5">
              <div className="flex gap-4">
                {/* Feed Image */}
                <div className="flex-shrink-0">
                  {state.feed.imageUrl ? (
                    <img
                      src={state.feed.imageUrl}
                      alt={state.feed.title}
                      className="w-16 h-16 rounded-lg object-cover border border-border"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-border">
                      <Newspaper className="w-8 h-8 text-primary/60" />
                    </div>
                  )}
                </div>

                {/* Feed Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg text-foreground truncate">
                    {state.feed.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {state.feed.description || "No description available"}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      {state.feed.items.length} articles
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Last updated {formatRelativeDate(state.feed.lastUpdated)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Articles Preview */}
              {state.feed.items.length > 0 && (
                <div className="mt-5 pt-4 border-t border-border/50">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Recent Articles
                  </h4>
                  <div className="space-y-2">
                    {state.feed.items.slice(0, 3).map((item, idx) => (
                      <div 
                        key={item.id}
                        className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {item.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatRelativeDate(item.pubDate)}
                            {item.author && ` • ${item.author}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 mt-5 pt-4 border-t border-border/50">
                <button
                  onClick={handleSubscribe}
                  className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Rss className="w-4 h-4" />
                  Subscribe to Feed
                </button>
                <a
                  href={state.feed.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-muted text-foreground font-medium rounded-lg hover:bg-muted/80 transition-colors flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Visit
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Subscribing State */}
        {state.status === "subscribing" && (
          <div className="bg-primary/5 rounded-xl p-8 border border-primary/20 text-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
            <p className="font-medium text-foreground">Subscribing...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Adding to your RSS Reader
            </p>
          </div>
        )}

        {/* Success State */}
        {state.status === "success" && (
          <div className="bg-green-500/10 rounded-xl p-8 border border-green-500/30 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="font-semibold text-lg text-foreground">
              Successfully Subscribed!
            </h3>
            <p className="text-muted-foreground mt-1">
              "{state.feed.title}" has been added to your feeds
            </p>
            <div className="flex justify-center gap-3 mt-5">
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
              >
                Add Another
              </button>
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        )}

        {/* Error State */}
        {state.status === "error" && (
          <div className="bg-destructive/10 rounded-xl p-5 border border-destructive/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-destructive">Import Failed</h4>
                <p className="text-sm text-muted-foreground mt-1">{state.error}</p>
                
                {state.suggestions && state.suggestions.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-foreground mb-2">Suggestions:</p>
                    <ul className="space-y-1.5">
                      {state.suggestions.map((suggestion, idx) => (
                        <li 
                          key={idx}
                          className="text-sm text-muted-foreground flex items-start gap-2"
                        >
                          <span className="text-primary">•</span>
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleDetect(url)}
                    className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors flex items-center gap-1.5"
                  >
                    <Search className="w-3.5 h-3.5" />
                    Try Again
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Standalone component for inline use in NewsletterDirectory
export function NewsletterUrlImportButton({ onSuccess }: { onSuccess?: (feed: Feed) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
      >
        <Link2 className="w-4 h-4" />
        Add by URL
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Link2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">Import Newsletter</h2>
                  <p className="text-sm text-muted-foreground">
                    Paste a URL to subscribe
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <NewsletterUrlImporter
              onSuccess={(feed) => {
                onSuccess?.(feed);
                setIsOpen(false);
              }}
              onCancel={() => setIsOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}

export default NewsletterUrlImporter;
