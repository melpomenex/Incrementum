/**
 * Content Similarity Suggestions
 * "You might also like" based on shared tags and categories
 */

import { useMemo } from "react";
import {
  Sparkles,
  FileText,
  BookOpen,
  Youtube,
  Globe,
  ChevronRight,
  Tag,
} from "lucide-react";

interface ContentItem {
  id: string;
  title: string;
  tags?: string[];
  category?: string;
  fileType?: string;
  date_created?: string;
  thumbnailUrl?: string;
}

interface SimilarityScore {
  item: ContentItem;
  score: number;
  matchedTags: string[];
}

interface SimilarContentProps {
  currentItem: ContentItem;
  allItems: ContentItem[];
  maxSuggestions?: number;
  onItemSelect: (item: ContentItem) => void;
  className?: string;
}

// Calculate similarity score based on shared tags
function calculateSimilarity(item1: ContentItem, item2: ContentItem): SimilarityScore | null {
  if (item1.id === item2.id) return null;

  const tags1 = new Set(item1.tags || []);
  const tags2 = new Set(item2.tags || []);

  // Find matching tags
  const matchedTags = [...tags1].filter((tag) => tags2.has(tag));

  if (matchedTags.length === 0) return null;

  // Calculate Jaccard similarity
  const union = new Set([...tags1, ...tags2]);
  const score = matchedTags.length / union.size;

  // Boost score if same category
  const categoryBoost = item1.category && item1.category === item2.category ? 0.1 : 0;

  return {
    item: item2,
    score: score + categoryBoost,
    matchedTags,
  };
}

function getTypeIcon(fileType?: string) {
  switch (fileType?.toLowerCase()) {
    case "pdf":
      return FileText;
    case "epub":
      return BookOpen;
    case "youtube":
      return Youtube;
    case "web":
    case "html":
      return Globe;
    default:
      return FileText;
  }
}

function getTypeColor(fileType?: string) {
  switch (fileType?.toLowerCase()) {
    case "pdf":
      return "text-red-500";
    case "epub":
      return "text-blue-500";
    case "youtube":
      return "text-red-600";
    case "web":
    case "html":
      return "text-green-500";
    default:
      return "text-muted-foreground";
  }
}

export function SimilarContent({
  currentItem,
  allItems,
  maxSuggestions = 5,
  onItemSelect,
  className = "",
}: SimilarContentProps) {
  const suggestions = useMemo(() => {
    const scores: SimilarityScore[] = [];

    for (const item of allItems) {
      const similarity = calculateSimilarity(currentItem, item);
      if (similarity && similarity.score > 0.1) {
        scores.push(similarity);
      }
    }

    // Sort by score and return top suggestions
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions);
  }, [currentItem, allItems, maxSuggestions]);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-medium text-foreground">You might also like</h3>
      </div>

      <div className="space-y-2">
        {suggestions.map((suggestion) => {
          const Icon = getTypeIcon(suggestion.item.fileType);
          const iconColor = getTypeColor(suggestion.item.fileType);

          return (
            <button
              key={suggestion.item.id}
              onClick={() => onItemSelect(suggestion.item)}
              className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:border-primary/30 hover:shadow-sm transition-all text-left"
            >
              {/* Thumbnail or icon */}
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                {suggestion.item.thumbnailUrl ? (
                  <img
                    src={suggestion.item.thumbnailUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Icon className={`w-5 h-5 ${iconColor}`} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {suggestion.item.title}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {suggestion.matchedTags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                    >
                      <Tag className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Compact inline suggestions
 */
interface SimilarContentInlineProps {
  currentItem: ContentItem;
  allItems: ContentItem[];
  maxSuggestions?: number;
  onItemSelect: (item: ContentItem) => void;
  className?: string;
}

export function SimilarContentInline({
  currentItem,
  allItems,
  maxSuggestions = 3,
  onItemSelect,
  className = "",
}: SimilarContentInlineProps) {
  const suggestions = useMemo(() => {
    const scores: SimilarityScore[] = [];

    for (const item of allItems) {
      const similarity = calculateSimilarity(currentItem, item);
      if (similarity && similarity.score > 0.15) {
        scores.push(similarity);
      }
    }

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions);
  }, [currentItem, allItems, maxSuggestions]);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className={`${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-medium text-muted-foreground">
          Related content
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => {
          const Icon = getTypeIcon(suggestion.item.fileType);

          return (
            <button
              key={suggestion.item.id}
              onClick={() => onItemSelect(suggestion.item)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/50 border border-border rounded-lg hover:bg-muted transition-colors text-xs"
            >
              <Icon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-foreground truncate max-w-[150px]">
                {suggestion.item.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Hook to get similar content
 */
export function useSimilarContent(
  currentItem: ContentItem | null,
  allItems: ContentItem[],
  maxSuggestions: number = 5
): SimilarityScore[] {
  return useMemo(() => {
    if (!currentItem) return [];

    const scores: SimilarityScore[] = [];

    for (const item of allItems) {
      const similarity = calculateSimilarity(currentItem, item);
      if (similarity && similarity.score > 0.1) {
        scores.push(similarity);
      }
    }

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions);
  }, [currentItem, allItems, maxSuggestions]);
}

export default SimilarContent;
