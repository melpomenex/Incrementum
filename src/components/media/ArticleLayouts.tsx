/**
 * MagazineLayout
 * 2-column masonry grid with large cards, thumbnails, excerpts
 */

import { formatFeedDate } from "../../api/rss";
import { ExternalLink, Star, StarOff } from "lucide-react";
import type { FeedItem, Feed } from "../../api/rss";
import { IntelligenceIndicator } from "./IntelligenceIndicator";

interface ArticleLayoutProps {
  items: Array<{ feed: Feed; item: FeedItem }>;
  onSelect: (feed: Feed, item: FeedItem) => void;
  onToggleFavorite: (feed: Feed, item: FeedItem) => void;
}

export function MagazineLayout({ items, onSelect, onToggleFavorite }: ArticleLayoutProps) {
  return (
    <div className="columns-1 md:columns-2 gap-4 p-4 space-y-4">
      {items.map(({ feed, item }) => (
        <article
          key={item.id}
          onClick={() => onSelect(feed, item)}
          className="break-inside-avoid bg-card border border-border/50 rounded-xl overflow-hidden hover:border-border cursor-pointer transition-all group"
        >
          {/* Thumbnail */}
          {item.thumbnail && (
            <div className="aspect-video overflow-hidden">
              <img
                src={item.thumbnail}
                alt=""
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          )}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-muted-foreground">{feed.title}</span>
              <IntelligenceIndicator score={item.intelligenceScore} />
            </div>
            <h3 className="text-base font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
              {item.title}
            </h3>
            {(item.fullContent || item.description) && (
              <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                {item.fullContent
                  ? item.fullContent.replace(/<[^>]+>/g, "").slice(0, 200)
                  : item.description.replace(/<[^>]+>/g, "").slice(0, 200)}
              </p>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatFeedDate(item.pubDate)}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(feed, item);
                  }}
                  className="p-1 hover:bg-muted/60 rounded"
                >
                  {item.favorite ? (
                    <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                  ) : (
                    <StarOff className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

/**
 * GridLayout
 * 3-4 column uniform grid with thumbnail cards
 */

export function GridLayout({
  items,
  onSelect,
  columnCount = 3,
}: {
  items: Array<{ feed: Feed; item: FeedItem }>;
  onSelect: (feed: Feed, item: FeedItem) => void;
  columnCount?: number;
}) {
  const colsClass = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
    5: "grid-cols-5",
    6: "grid-cols-6",
  }[columnCount] || "grid-cols-3";

  return (
    <div className={`grid ${colsClass} gap-3 p-4`}>
      {items.map(({ feed, item }) => (
        <article
          key={item.id}
          onClick={() => onSelect(feed, item)}
          className="bg-card border border-border/50 rounded-lg overflow-hidden hover:border-border cursor-pointer transition-all group"
        >
          {item.thumbnail ? (
            <div className="aspect-video overflow-hidden">
              <img
                src={item.thumbnail}
                alt=""
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          ) : (
            <div className="aspect-video bg-muted/50 flex items-center justify-center">
              <span className="text-xs text-muted-foreground">{feed.title}</span>
            </div>
          )}
          <div className="p-2.5">
            <h4 className="text-xs font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
              {item.title}
            </h4>
            <p className="text-[10px] text-muted-foreground mt-1">{formatFeedDate(item.pubDate)}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
