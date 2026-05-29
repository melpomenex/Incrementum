/**
 * TrainingMenu
 * Context menu on articles for like/dislike author, tag, title keyword
 */

import { useState, useEffect, useRef } from "react";
import { ThumbsUp, ThumbsDown, User, Hash, Type, ChevronRight, X } from "lucide-react";
import { useClassifiersStore } from "../../stores/classifiersStore";
import type { FeedItem } from "../../api/rss";

interface TrainingMenuProps {
  article: FeedItem;
  feedId: string;
  onClose: () => void;
  position?: { x: number; y: number };
}

export function TrainingMenu({ article, feedId, onClose, position }: TrainingMenuProps) {
  const { addClassifier } = useClassifiersStore();
  const [showSubmenu, setShowSubmenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [flipSubmenu, setFlipSubmenu] = useState(false);

  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    setFlipSubmenu(rect.right + 180 > window.innerWidth);
  }, []);

  const handleTrain = async (classifierType: string, value: string, sentiment: string) => {
    try {
      await addClassifier(feedId, classifierType, value, sentiment, "feed");
      onClose();
    } catch (err) {
      console.error("[TrainingMenu] Failed to train:", err);
    }
  };

  const items = [
    {
      label: "Like author",
      icon: <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" />,
      action: () => article.author && handleTrain("author", article.author, "like"),
      disabled: !article.author,
    },
    {
      label: "Dislike author",
      icon: <ThumbsDown className="w-3.5 h-3.5 text-red-500" />,
      action: () => article.author && handleTrain("author", article.author, "dislike"),
      disabled: !article.author,
    },
    {
      label: "Like keyword",
      icon: <Type className="w-3.5 h-3.5 text-emerald-500" />,
      submenu: "like-keyword",
    },
    {
      label: "Dislike keyword",
      icon: <Hash className="w-3.5 h-3.5 text-red-500" />,
      submenu: "dislike-keyword",
    },
    {
      label: "Like tag",
      icon: <User className="w-3.5 h-3.5 text-emerald-500" />,
      action: () => {
        const tag = article.categories?.[0];
        if (tag) handleTrain("tag", tag, "like");
      },
      disabled: !article.categories?.length,
    },
  ];

  const handleKeywordSubmit = (keyword: string, sentiment: string) => {
    if (keyword.trim()) {
      handleTrain("title", keyword.trim(), sentiment);
      setShowSubmenu(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={menuRef}
        className="absolute bg-card border border-border rounded-lg shadow-lg py-1 min-w-[180px] z-50"
        role="menu"
        style={position ? { left: position.x, top: position.y } : { right: 16, top: "50%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border">
          Train Intelligence
        </div>
        {items.map((item) => (
          <div key={item.label} className="relative">
            <button
              className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 ${
                item.disabled
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : "text-foreground hover:bg-muted/60"
              }`}
              disabled={item.disabled}
              onClick={() => {
                if (item.action) item.action();
                else if (item.submenu) {
                  setShowSubmenu(showSubmenu === item.submenu ? null : item.submenu);
                }
              }}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.submenu && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            </button>
            {item.submenu && showSubmenu === item.submenu && (
              <div className={`absolute top-0 bg-card border border-border rounded-lg shadow-lg p-2 min-w-[160px] z-50 ${flipSubmenu ? "right-full mr-1" : "left-full ml-1"}`}>
                <KeywordInput
                  sentiment={item.submenu.includes("like") ? "like" : "dislike"}
                  onSubmit={handleKeywordSubmit}
                  onCancel={() => setShowSubmenu(null)}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function KeywordInput({
  sentiment,
  onSubmit,
  onCancel,
}: {
  sentiment: string;
  onSubmit: (keyword: string, sentiment: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");

  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value, sentiment);
      }}
    >
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter keyword..."
        className="flex-1 px-2 py-1 text-sm bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <button type="submit" className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded">
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="p-1 text-muted-foreground hover:bg-muted/60 rounded"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </form>
  );
}
