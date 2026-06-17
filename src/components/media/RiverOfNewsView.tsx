/**
 * RiverOfNewsView
 * Merged chronological stream from all feeds in a folder
 */

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  CircleNotch,
  Clock,
  Rss,
} from "@phosphor-icons/react";
import { getRiverOfNewsAuto } from "../../api/rss-folders";

interface RiverOfNewsViewProps {
  folderId: string;
  folderName: string;
  feeds: any[];
  onSelectArticle?: (item: any) => void;
  onBack?: () => void;
}

export function RiverOfNewsView({ folderId, folderName, feeds: _feeds, onSelectArticle, onBack }: RiverOfNewsViewProps) {
  const [articles, setArticles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const items = await getRiverOfNewsAuto(folderId, 100);
        setArticles(items);
      } catch (err) {
        console.error("[RiverOfNews] Failed:", err);
      }
      setIsLoading(false);
    };
    void load();
  }, [folderId]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return `${Math.floor(diff / 60000)}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground rounded">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <Clock className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">River of News</h2>
          <span className="text-xs text-muted-foreground">({folderName})</span>
        </div>
        <span className="text-xs text-muted-foreground">{articles.length} articles</span>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <CircleNotch className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Rss className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No unread articles in this folder</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {articles.map((article) => (
              <div
                key={article.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectArticle?.(article)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSelectArticle?.(article); }}
                className="px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
              >
                <div className="flex items-start gap-2">
                  <div className="h-2 w-2 rounded-full bg-orange-500 mt-1.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-medium text-foreground line-clamp-2">{article.title}</h4>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                      {article.feed_title && <span>{article.feed_title}</span>}
                      <span>{formatDate(article.published_date)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
