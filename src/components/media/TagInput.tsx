/**
 * TagInput
 * Autocomplete input with pill display for adding/removing tags on articles
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, X } from "@phosphor-icons/react";
import { useTagsStore } from "../../stores/tagsStore";
import type { RssTag } from "../../api/rss-tags";

interface TagInputProps {
  articleId: string;
  selectedTags?: RssTag[];
  onTagAdd?: (tag: RssTag) => void;
  onTagRemove?: (tagId: string) => void;
}

export function TagInput({ articleId, selectedTags = [], onTagAdd, onTagRemove }: TagInputProps) {
  const { tags, tagArticle, untagArticle, createAndTag } = useTagsStore();
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const availableTags = tags.filter(
    (t) => !selectedTags.find((st) => st.id === t.id) &&
    input && t.name.toLowerCase().includes(input.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && e.target instanceof Node && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAdd = useCallback(
    async (tag: RssTag) => {
      await tagArticle(articleId, tag.id);
      onTagAdd?.(tag);
      setInput("");
      setShowSuggestions(false);
    },
    [articleId, tagArticle, onTagAdd]
  );

  const handleCreateAndAdd = useCallback(
    async (name: string) => {
      try {
        const tag = await createAndTag(articleId, name);
        onTagAdd?.(tag);
        setInput("");
        setShowSuggestions(false);
      } catch (err) {
        console.error("[TagInput] Failed to create tag:", err);
      }
    },
    [articleId, createAndTag, onTagAdd]
  );

  const handleRemove = useCallback(
    async (tagId: string) => {
      await untagArticle(articleId, tagId);
      onTagRemove?.(tagId);
    },
    [articleId, untagArticle, onTagRemove]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      const existing = tags.find((t) => t.name.toLowerCase() === input.trim().toLowerCase());
      if (existing) {
        void handleAdd(existing);
      } else {
        void handleCreateAndAdd(input.trim());
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap items-center gap-1 px-2 py-1 border border-border rounded-md bg-background min-h-[32px]">
        {selectedTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded-full"
          >
            {tag.name}
            <button
              onClick={() => void handleRemove(tag.id)}
              className="hover:text-red-500 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={selectedTags.length === 0 ? "Add tags..." : ""}
          className="flex-1 min-w-[80px] px-1 py-0.5 text-sm bg-transparent focus:outline-none"
        />
      </div>

      {showSuggestions && availableTags.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[160px] bg-card border border-border rounded-lg shadow-lg py-1 z-20 max-h-40 overflow-auto">
          {availableTags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => void handleAdd(tag)}
              className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted/60 flex items-center gap-2"
            >
              <Plus className="w-3 h-3 text-muted-foreground" />
              {tag.name}
              {tag.article_count != null && (
                <span className="text-xs text-muted-foreground ml-auto">{tag.article_count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {showSuggestions && input.trim() && availableTags.length === 0 && (
        <div className="absolute top-full left-0 mt-1 w-full bg-card border border-border rounded-lg shadow-lg py-1 z-20">
          <button
            onClick={() => void handleCreateAndAdd(input.trim())}
            className="w-full px-3 py-1.5 text-left text-sm text-primary hover:bg-muted/60 flex items-center gap-2"
          >
            <Plus className="w-3 h-3" />
            Create "{input.trim()}"
          </button>
        </div>
      )}
    </div>
  );
}
