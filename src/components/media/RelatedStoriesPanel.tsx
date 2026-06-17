/**
 * RelatedStoriesPanel
 * Slide-out panel showing related articles when clicking "Related" pill
 */

import { ArrowSquareOut, X } from "@phosphor-icons/react";
import type { RssStoryCluster } from "../../api/rss-clusters";

interface RelatedStoriesPanelProps {
  clusters: RssStoryCluster[];
  articles: Map<string, { title: string; feed_id: string; published_date?: string; link?: string }>;
  onSelectArticle?: (articleId: string) => void;
  onClose: () => void;
}

export function RelatedStoriesPanel({
  clusters,
  articles,
  onSelectArticle,
  onClose,
}: RelatedStoriesPanelProps) {
  return (
    <div className="h-full flex flex-col bg-card border-l border-border/70">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Related Stories ({clusters.length})
        </h3>
        <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-2">
        {clusters.map((cluster) => {
          const article = articles.get(cluster.article_id);
          if (!article) return null;
          return (
            <div
              key={cluster.id}
              className={`p-2 rounded border transition-colors ${
                cluster.cluster_type === "duplicate"
                  ? "border-amber-300 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-900/10"
                  : "border-blue-300 dark:border-blue-700/50 bg-blue-50/50 dark:bg-blue-900/10"
              }`}
            >
              <button
                onClick={() => onSelectArticle?.(cluster.article_id)}
                className="w-full text-left"
              >
                <h4 className="text-sm font-medium text-foreground line-clamp-2 hover:text-primary transition-colors">
                  {article.title}
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    cluster.cluster_type === "duplicate"
                      ? "bg-amber-200 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300"
                      : "bg-blue-200 dark:bg-blue-800/50 text-blue-700 dark:text-blue-300"
                  }`}>
                    {cluster.cluster_type}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {(cluster.similarity_score * 100).toFixed(0)}% match
                  </span>
                </div>
              </button>
              {article.link && (
                <a
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1 text-[10px] text-muted-foreground hover:text-primary"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ArrowSquareOut className="w-2.5 h-2.5" />
                  Open
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
