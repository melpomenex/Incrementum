/**
 * StoryView
 * Single-article focused reading with minimal chrome, next/prev navigation
 */

import { useCallback } from "react";
import { ChevronLeft, ChevronRight, Star, ExternalLink, Clock, User } from "lucide-react";
import type { FeedItem, Feed } from "../../api/rss";
import { formatFeedDate } from "../../api/rss";
import { openExternal } from "../../lib/tauri";
import { sanitizeHtml } from "../common/RichContentRenderer";
import { IntelligenceIndicator } from "./IntelligenceIndicator";

interface StoryViewProps {
  item: FeedItem;
  feed: Feed;
  items: FeedItem[];
  onSelectItem: (item: FeedItem) => void;
  onToggleFavorite: (feed: Feed, item: FeedItem) => void;
}

export function StoryView({ item, feed, items, onSelectItem, onToggleFavorite }: StoryViewProps) {
  const currentIndex = items.findIndex((i) => i.id === item.id);
  const hasNext = currentIndex < items.length - 1;
  const hasPrev = currentIndex > 0;

  const goNext = useCallback(() => {
    if (hasNext) onSelectItem(items[currentIndex + 1]);
  }, [hasNext, currentIndex, items, onSelectItem]);

  const goPrev = useCallback(() => {
    if (hasPrev) onSelectItem(items[currentIndex - 1]);
  }, [hasPrev, currentIndex, items, onSelectItem]);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Minimal toolbar */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-border/50">
        <button
          onClick={goPrev}
          disabled={!hasPrev}
          className="p-2 text-muted-foreground hover:text-foreground rounded-lg disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{currentIndex + 1} / {items.length}</span>
        </div>
        <button
          onClick={goNext}
          disabled={!hasNext}
          className="p-2 text-muted-foreground hover:text-foreground rounded-lg disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Article content */}
      <div className="flex-1 overflow-auto">
        <article className="max-w-2xl mx-auto px-8 py-10">
          <header className="mb-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <span className="font-medium">{feed.title}</span>
              <IntelligenceIndicator />
            </div>
            <h1 className="text-2xl font-bold text-foreground leading-tight mb-4">{item.title}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {item.author && (
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  {item.author}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatFeedDate(item.pubDate)}
              </span>
            </div>
          </header>

          {/* Content */}
          <div
            className="prose prose-sm dark:prose-invert max-w-none leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(item.fullContent || item.description || item.content),
            }}
          />

          {/* Actions */}
          <div className="flex items-center gap-2 mt-8 pt-6 border-t border-border/50">
            <button
              onClick={() => onToggleFavorite(feed, item)}
              className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5 transition-colors ${
                item.favorite
                  ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <Star className={`w-4 h-4 ${item.favorite ? "fill-yellow-500" : ""}`} />
              {item.favorite ? "Saved" : "Save"}
            </button>
            <a
              href={item.link}
              onClick={(e) => {
                e.preventDefault();
                void openExternal(item.link);
              }}
              className="px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Original
            </a>
          </div>
        </article>
      </div>
    </div>
  );
}
