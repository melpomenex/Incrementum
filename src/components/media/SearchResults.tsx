/**
 * SearchResults
 * FTS5 search results with highlighted snippets, source feed, date
 */

import { Clock, Rss } from "@phosphor-icons/react";
import type { RssSearchResult } from "../../api/rss-search";
import { formatFeedDate } from "../../api/rss";
import { sanitizeHtml } from "../common/RichContentRenderer";

interface SearchResultsProps {
  results: RssSearchResult[];
  query: string;
  onSelect?: (result: RssSearchResult) => void;
  isLoading?: boolean;
}

export function SearchResults({ results, query, onSelect, isLoading }: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">Searching...</div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No results for "{query}"</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground mb-2">{results.length} result{results.length !== 1 ? "s" : ""}</p>
      {results.map((result) => (
        <button
          key={result.id}
          onClick={() => onSelect?.(result)}
          className="w-full text-left px-3 py-2 hover:bg-muted/50 rounded transition-colors group"
        >
          <h4 className="text-sm font-medium text-foreground group-hover:text-primary line-clamp-1">
            {result.title}
          </h4>
          {result.snippet && (
            <p
              className="text-xs text-muted-foreground line-clamp-2 mt-0.5"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(result.snippet) }}
            />
          )}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
            {result.feed_title && (
              <span className="flex items-center gap-1">
                <Rss className="w-2.5 h-2.5" />
                {result.feed_title}
              </span>
            )}
            {result.author && <span>· {result.author}</span>}
            {result.published_date && (
              <span className="flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {formatFeedDate(result.published_date)}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
