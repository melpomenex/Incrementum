import { useState, useEffect } from "react";
import { X, FileText, ExternalLink, Clock, User, Rss, BookOpen } from "lucide-react";
import type { Feed, FeedItem } from "../../api/rss";

interface ArticleContextOverlayProps {
  feed: Feed;
  item: FeedItem;
  isOpen: boolean;
  onClose: () => void;
  onExpandFullContent?: () => void;
  onOpenOriginal?: () => void;
  hasFullContent: boolean;
  isFullContentExpanded: boolean;
}

/**
 * Calculate reading time in minutes
 */
function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}

/**
 * Article Context Overlay
 * Displays metadata about the current article in scroll mode
 */
export function ArticleContextOverlay({
  feed,
  item,
  isOpen,
  onClose,
  onExpandFullContent,
  onOpenOriginal,
  hasFullContent,
  isFullContentExpanded,
}: ArticleContextOverlayProps) {
  const [wordCount, setWordCount] = useState(0);
  const [readingTime, setReadingTime] = useState(0);

  // Calculate word count and reading time
  useEffect(() => {
    const content = item.fullContent || item.content || item.description || "";
    // Strip HTML tags
    const plainText = content.replace(/<[^>]+>/g, " ");
    const words = plainText.split(/\s+/).filter((w) => w.length > 0);
    const count = words.length;
    setWordCount(count);
    setReadingTime(calculateReadingTime(plainText));
  }, [item]);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "i") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-card border border-border rounded-2xl p-6 w-80 max-w-[90vw] shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Article Info</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feed source */}
        <div className="flex items-start gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
            {feed.imageUrl ? (
              <img src={feed.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Rss className="w-5 h-5 text-orange-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{feed.title}</p>
            <p className="text-xs text-muted-foreground">{feed.category || "Uncategorized"}</p>
          </div>
        </div>

        {/* Article title */}
        <h4 className="text-base font-medium text-foreground mb-4 line-clamp-2">{item.title}</h4>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-lg">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Published</p>
              <p className="text-xs font-medium truncate">
                {new Date(item.pubDate).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          {item.author && (
            <div className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-lg">
              <User className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Author</p>
                <p className="text-xs font-medium truncate">{item.author}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-lg">
            <BookOpen className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Words</p>
              <p className="text-xs font-medium">{wordCount.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-lg">
            <Clock className="w-4 h-4 text-blue-500" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Read time</p>
              <p className="text-xs font-medium">{readingTime} min</p>
            </div>
          </div>
        </div>

        {/* Full content indicator */}
        <div className="mb-4">
          <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <FileText
                className={`w-4 h-4 ${hasFullContent ? "text-blue-500" : "text-muted-foreground"}`}
              />
              <span className="text-sm">
                {hasFullContent ? "Full content available" : "Summary only"}
              </span>
            </div>
            {hasFullContent && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  isFullContentExpanded
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isFullContentExpanded ? "Expanded" : "Collapsed"}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {hasFullContent && onExpandFullContent && (
            <button
              onClick={() => {
                onExpandFullContent();
                onClose();
              }}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-colors ${
                isFullContentExpanded
                  ? "bg-muted text-foreground hover:bg-muted/80"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              }`}
            >
              <FileText className="w-4 h-4" />
              {isFullContentExpanded ? "Show Summary" : "Read Full Content"}
            </button>
          )}

          {onOpenOriginal && (
            <button
              onClick={() => {
                onOpenOriginal();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open Original
            </button>
          )}
        </div>

        {/* Footer hint */}
        <p className="mt-4 text-xs text-center text-muted-foreground">
          Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">i</kbd> or{" "}
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Esc</kbd> to close
        </p>
      </div>
    </div>
  );
}
