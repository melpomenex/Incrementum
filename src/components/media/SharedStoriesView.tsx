/**
 * SharedStoriesView
 * View all shared stories with comments
 */

import { useState, useEffect, useCallback } from "react";
import { Share2, ExternalLink, MessageSquare, Loader2 } from "lucide-react";
import { useAnnotationsStore } from "../../stores/annotationsStore";
import { openExternal } from "../../lib/tauri";

interface SharedStoriesViewProps {
  onClose?: () => void;
}

interface SharedStory {
  article_id: string;
  title: string;
  link?: string;
  comment?: string;
  shared_at: string;
}

export function SharedStoriesView({ onClose }: SharedStoriesViewProps) {
  const { annotationsByArticle, isLoading } = useAnnotationsStore();
  const [sharedStories, setSharedStories] = useState<SharedStory[]>([]);

  // Note: In a full implementation, we'd have a dedicated endpoint for shared stories.
  // For now, we show annotations that start with [Shared]
  useEffect(() => {
    const stories: SharedStory[] = [];
    for (const [, annotations] of annotationsByArticle) {
      const shared = annotations.filter((a) => a.annotation_type === "note" && a.content.startsWith("[Shared]"));
      for (const s of shared) {
        stories.push({
          article_id: s.article_id,
          title: s.content.replace("[Shared]", "").trim(),
          shared_at: s.created_at,
        });
      }
    }
    setSharedStories(stories.sort((a, b) => b.shared_at.localeCompare(a.shared_at)));
  }, [annotationsByArticle]);

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Share2 className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Shared Stories</h2>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded">
            ×
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {sharedStories.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Share2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No shared stories yet</p>
          </div>
        ) : (
          sharedStories.map((story) => (
            <div
              key={`${story.article_id}-${story.shared_at}`}
              className="p-3 border border-border/50 rounded-lg hover:border-border transition-colors"
            >
              <h4 className="text-sm font-medium text-foreground line-clamp-2">{story.title || "Untitled"}</h4>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                <MessageSquare className="w-3 h-3" />
                <span>Shared {new Date(story.shared_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
