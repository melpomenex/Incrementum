/**
 * ReadStoriesView
 * Browse previously read articles with pagination
 */

import { useState, useEffect, useCallback } from "react";
import { Clock, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { getReadArticlesAuto } from "../../api/rss-folders";

interface ReadStoriesViewProps {
  onBack?: () => void;
}

export function ReadStoriesView({ onBack }: ReadStoriesViewProps) {
  const [articles, setArticles] = useState<any[]>([]);
  const [_isLoading, setIsLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const pageSize = 30;

  const loadArticles = useCallback(async (reset = false) => {
    setIsLoading(true);
    try {
      const newArticles = await getReadArticlesAuto(pageSize, reset ? 0 : offset);
      setArticles(reset ? newArticles : (prev) => [...prev, ...newArticles]);
    } catch (err) {
      console.error("[ReadStories] Failed:", err);
    }
    setIsLoading(false);
  }, [offset]);

  useEffect(() => {
    void loadArticles(true);
  }, []);

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Read Stories</h2>
        </div>
        {onBack && (
          <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground rounded">
            ×
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {articles.length === 0 && !isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No read stories yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {articles.map((article) => (
              <div
                key={article.id}
                className="px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <h4 className="text-sm font-medium text-foreground line-clamp-2">{article.title}</h4>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                  {article.author && <span>{article.author}</span>}
                  {article.published_date && (
                    <span>{new Date(article.published_date).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        <div className="flex justify-center gap-2 py-4">
          <button
            onClick={() => { setOffset((o) => Math.max(0, o - pageSize)); void loadArticles(); }}
            disabled={offset === 0}
            className="px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-lg disabled:opacity-50 flex items-center gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Previous
          </button>
          <button
            onClick={() => { setOffset((o) => o + pageSize); void loadArticles(); }}
            disabled={articles.length < pageSize}
            className="px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-lg disabled:opacity-50 flex items-center gap-1"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
