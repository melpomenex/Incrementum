/**
 * Smart Collections Component
 * Pre-defined collections: Forgotten cards, High priority, Recently added
 */

import { useState, useMemo } from "react";
import {
  AlertTriangle,
  Clock,
  Sparkles,
  BookOpen,
  Target,
  TrendingUp,
  RefreshCcw,
  Flame,
  ChevronRight,
} from "lucide-react";

export interface SmartCollection {
  id: string;
  name: string;
  description: string;
  icon: typeof AlertTriangle;
  color: string;
  bgColor: string;
  count: number;
  filter: (item: any) => boolean;
}

interface SmartCollectionsProps {
  cards: any[]; // Learning items
  onSelectCollection: (collectionId: string, filteredItems: any[]) => void;
  selectedCollectionId?: string;
  className?: string;
}

// Collection definitions
export function getSmartCollections(cards: any[]): SmartCollection[] {
  return [
    {
      id: "forgotten",
      name: "Forgotten Cards",
      description: "Cards you've struggled with (failed 3+ times)",
      icon: AlertTriangle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      count: cards.filter((c) => (c.lapse_count || 0) >= 3).length,
      filter: (item) => (item.lapse_count || 0) >= 3,
    },
    {
      id: "due-today",
      name: "Due Today",
      description: "Cards scheduled for review today",
      icon: Clock,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      count: cards.filter((c) => {
        if (!c.due_date) return false;
        const due = new Date(c.due_date);
        const today = new Date();
        return due.toDateString() === today.toDateString();
      }).length,
      filter: (item) => {
        if (!item.due_date) return false;
        const due = new Date(item.due_date);
        const today = new Date();
        return due.toDateString() === today.toDateString();
      },
    },
    {
      id: "high-priority",
      name: "High Priority",
      description: "Cards from high-priority documents",
      icon: Target,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      count: cards.filter((c) => c.priority === "high" || c.priority >= 4).length,
      filter: (item) => item.priority === "high" || item.priority >= 4,
    },
    {
      id: "recently-added",
      name: "Recently Added",
      description: "Cards created in the last 7 days",
      icon: Sparkles,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      count: cards.filter((c) => {
        if (!c.date_created) return false;
        const created = new Date(c.date_created);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return created >= weekAgo;
      }).length,
      filter: (item) => {
        if (!item.date_created) return false;
        const created = new Date(item.date_created);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return created >= weekAgo;
      },
    },
    {
      id: "new-cards",
      name: "New Cards",
      description: "Cards you haven't reviewed yet",
      icon: BookOpen,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      count: cards.filter((c) => c.state === "new" || c.review_count === 0).length,
      filter: (item) => item.state === "new" || item.review_count === 0,
    },
    {
      id: "mature",
      name: "Mature Cards",
      description: "Well-learned cards with long intervals",
      icon: TrendingUp,
      color: "text-teal-500",
      bgColor: "bg-teal-500/10",
      count: cards.filter((c) => c.interval >= 21).length,
      filter: (item) => item.interval >= 21,
    },
    {
      id: "relearning",
      name: "Relearning",
      description: "Cards currently being relearned after lapses",
      icon: RefreshCcw,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      count: cards.filter((c) => c.state === "relearning").length,
      filter: (item) => item.state === "relearning",
    },
    {
      id: "streak-makers",
      name: "Streak Makers",
      description: "Cards with perfect review streaks",
      icon: Flame,
      color: "text-pink-500",
      bgColor: "bg-pink-500/10",
      count: cards.filter((c) => (c.success_streak || 0) >= 5).length,
      filter: (item) => (item.success_streak || 0) >= 5,
    },
  ];
}

export function SmartCollections({
  cards,
  onSelectCollection,
  selectedCollectionId,
  className = "",
}: SmartCollectionsProps) {
  const collections = useMemo(() => getSmartCollections(cards), [cards]);

  const handleSelect = (collection: SmartCollection) => {
    const filteredItems = cards.filter(collection.filter);
    onSelectCollection(collection.id, filteredItems);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        Smart Collections
      </h3>

      <div className="space-y-1.5">
        {collections.map((collection) => {
          const Icon = collection.icon;
          const isSelected = selectedCollectionId === collection.id;

          return (
            <button
              key={collection.id}
              onClick={() => handleSelect(collection)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                isSelected
                  ? `${collection.bgColor} border border-current/30`
                  : "hover:bg-muted/50 border border-transparent"
              }`}
            >
              <div className={`p-2 rounded-lg ${collection.bgColor}`}>
                <Icon className={`w-4 h-4 ${collection.color}`} />
              </div>

              <div className="flex-1 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {collection.name}
                  </span>
                  <span className={`text-xs font-medium ${collection.color}`}>
                    {collection.count}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {collection.description}
                </p>
              </div>

              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Compact smart collections for sidebar
 */
export function SmartCollectionsCompact({
  cards,
  onSelectCollection,
  selectedCollectionId,
  className = "",
}: SmartCollectionsProps) {
  const collections = useMemo(() => getSmartCollections(cards), [cards]);
  const [isExpanded, setIsExpanded] = useState(false);

  const visibleCollections = isExpanded ? collections : collections.slice(0, 4);

  return (
    <div className={`${className}`}>
      <div className="space-y-1">
        {visibleCollections.map((collection) => {
          const Icon = collection.icon;
          const isSelected = selectedCollectionId === collection.id;

          return (
            <button
              key={collection.id}
              onClick={() => {
                const filteredItems = cards.filter(collection.filter);
                onSelectCollection(collection.id, filteredItems);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                isSelected
                  ? `${collection.bgColor} ${collection.color}`
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="flex-1 text-left truncate">{collection.name}</span>
              <span className="text-xs opacity-70">{collection.count}</span>
            </button>
          );
        })}
      </div>

      {collections.length > 4 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full mt-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? "Show less" : `+${collections.length - 4} more collections`}
        </button>
      )}
    </div>
  );
}

/**
 * Hook to get filtered items for a smart collection
 */
export function useSmartCollection(cards: any[], collectionId: string | null) {
  return useMemo(() => {
    if (!collectionId) return cards;

    const collections = getSmartCollections(cards);
    const collection = collections.find((c) => c.id === collectionId);

    if (!collection) return cards;
    return cards.filter(collection.filter);
  }, [cards, collectionId]);
}

export default SmartCollections;
