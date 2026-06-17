/**
 * ShareWithComment
 * Share dialog with optional comment input
 */

import { useState } from "react";
import { ChatCircle, ShareNetwork, X } from "@phosphor-icons/react";
import { useAnnotationsStore } from "../../stores/annotationsStore";
import type { FeedItem } from "../../api/rss";

interface ShareWithCommentProps {
  article: FeedItem;
  onClose: () => void;
}

export function ShareWithComment({ article, onClose }: ShareWithCommentProps) {
  const { addNote } = useAnnotationsStore();
  const [comment, setComment] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    setIsSharing(true);
    try {
      if (comment.trim()) {
        await addNote(article.id, `[Shared] ${comment.trim()}`);
      }
      // Web Share API if available
      if (navigator.share) {
        await navigator.share({
          title: article.title,
          url: article.link,
          text: comment.trim() || undefined,
        });
      } else {
        await navigator.clipboard.writeText(article.link);
      }
      onClose();
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("[Share] Failed:", err);
      }
    }
    setIsSharing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ShareNetwork className="w-4 h-4" />
            Share Story
          </h3>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4">
          <p className="text-sm text-foreground font-medium line-clamp-2 mb-3">{article.title}</p>
          <div className="flex items-start gap-2 mb-4">
            <ChatCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
            <textarea
              autoFocus
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment (optional)..."
              rows={3}
              className="flex-1 text-sm bg-background border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleShare()}
              disabled={isSharing}
              className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
            >
              <ShareNetwork className="w-3.5 h-3.5" />
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
