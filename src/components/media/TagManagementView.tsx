/**
 * TagManagementView
 * Rename and merge tags
 */

import { useState, useEffect } from "react";
import { Tag, Pencil, GitMerge, Trash2, X, Search } from "lucide-react";
import { useTagsStore } from "../../stores/tagsStore";
import type { RssTag } from "../../api/rss-tags";

interface TagManagementViewProps {
  onClose: () => void;
}

export function TagManagementView({ onClose }: TagManagementViewProps) {
  const { tags, loadTags, renameTag, mergeTags, deleteTag } = useTagsStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [mergeSource, setMergeSource] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  const filtered = searchQuery
    ? tags.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : tags;

  const handleRename = async (tag: RssTag) => {
    if (renameValue.trim() && renameValue !== tag.name) {
      await renameTag(tag.id, renameValue.trim());
      setRenamingId(null);
    }
  };

  const handleMerge = async (sourceId: string, targetId: string) => {
    if (sourceId !== targetId) {
      await mergeTags(sourceId, targetId);
      setMergeSource(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Tag Management</h2>
          <span className="text-xs text-muted-foreground">({tags.length} tags)</span>
        </div>
        <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tags..."
            className="w-full pl-7 pr-2 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-1">
        {filtered.length === 0 ? (
          <p className="text-center py-8 text-sm text-muted-foreground">No tags found</p>
        ) : (
          filtered.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-2 px-3 py-2 rounded hover:bg-muted/40 group"
            >
              {renamingId === tag.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleRename(tag);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  className="flex-1 px-2 py-0.5 text-sm bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                />
              ) : (
                <>
                  <span className="text-sm text-foreground flex-1">{tag.name}</span>
                  {tag.article_count != null && (
                    <span className="text-xs text-muted-foreground">{tag.article_count}</span>
                  )}
                </>
              )}

              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {renamingId === tag.id ? (
                  <>
                    <button
                      onClick={() => void handleRename(tag)}
                      className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded text-xs"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setRenamingId(null)}
                      className="p-1 text-muted-foreground hover:bg-muted/60 rounded text-xs"
                    >
                      Cancel
                    </button>
                  </>
                ) : mergeSource === tag.id ? (
                  <span className="text-xs text-muted-foreground">Pick target...</span>
                ) : confirmDelete === tag.id ? (
                  <>
                    <button
                      onClick={() => { void deleteTag(tag.id); setConfirmDelete(null); }}
                      className="p-1 text-red-500 hover:bg-red-500/10 rounded text-xs"
                    >
                      Confirm
                    </button>
                    <button onClick={() => setConfirmDelete(null)} className="p-1 text-muted-foreground hover:bg-muted/60 rounded text-xs">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setRenamingId(tag.id); setRenameValue(tag.name); }}
                      className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setMergeSource(tag.id)}
                      className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded"
                      title="Merge into another tag"
                    >
                      <GitMerge className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(tag.id)}
                      className="p-1 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {mergeSource && (
        <div className="px-4 py-2 border-t border-border bg-muted/30">
          <p className="text-xs text-muted-foreground mb-1">
            Select target tag to merge "{tags.find((t) => t.id === mergeSource)?.name}" into:
          </p>
          <div className="flex flex-wrap gap-1">
            {tags
              .filter((t) => t.id !== mergeSource)
              .map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => void handleMerge(mergeSource!, tag.id)}
                  className="px-2 py-1 text-xs bg-card border border-border rounded hover:bg-muted/60"
                >
                  {tag.name}
                </button>
              ))}
          </div>
          <button
            onClick={() => setMergeSource(null)}
            className="mt-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
