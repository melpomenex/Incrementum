/**
 * ManageTrainingView
 * Consolidated view of all intelligence classifiers grouped by folder,
 * with filter/search/inline-edit/bulk-save
 */

import { useState, useMemo, useEffect } from "react";
import { Search, ThumbsUp, ThumbsDown, X, Save, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useClassifiersStore } from "../../stores/classifiersStore";
import type { RssClassifier, ClassifierUpdate } from "../../api/rss-classifiers";

interface ManageTrainingViewProps {
  onClose: () => void;
}

export function ManageTrainingView({ onClose }: ManageTrainingViewProps) {
  const { classifiers, isLoading, loadClassifiers, removeClassifier, updateClassifiersBatch } =
    useClassifiersStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterSentiment, _setFilterSentiment] = useState<string | null>(null);
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, string>>(new Map());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["liked", "disliked"]));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void loadClassifiers();
  }, [loadClassifiers]);

  const filtered = useMemo(() => {
    let result = classifiers;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.value.toLowerCase().includes(q) ||
          c.classifier_type.toLowerCase().includes(q) ||
          c.feed_id.toLowerCase().includes(q)
      );
    }
    if (filterType) result = result.filter((c) => c.classifier_type === filterType);
    if (filterSentiment) result = result.filter((c) => c.sentiment === filterSentiment);
    return result;
  }, [classifiers, searchQuery, filterType, filterSentiment]);

  const liked = useMemo(() => filtered.filter((c) => c.sentiment === "like"), [filtered]);
  const disliked = useMemo(() => filtered.filter((c) => c.sentiment === "dislike"), [filtered]);

  const toggleSentiment = (id: string, currentSentiment: string) => {
    const newSentiment = currentSentiment === "like" ? "dislike" : "like";
    setEditingIds((prev) => new Set(prev).add(id));
    setPendingUpdates((prev) => new Map(prev).set(id, newSentiment));
  };

  const handleBulkSave = async () => {
    if (pendingUpdates.size === 0) return;
    setIsSaving(true);
    try {
      const updates: ClassifierUpdate[] = Array.from(pendingUpdates.entries()).map(
        ([id, sentiment]) => ({ id, sentiment })
      );
      await updateClassifiersBatch(updates);
      setEditingIds(new Set());
      setPendingUpdates(new Map());
    } catch (err) {
      console.error("[ManageTraining] Failed to save:", err);
    }
    setIsSaving(false);
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const types = ["author", "title", "tag", "feed"];

  const renderClassifier = (c: RssClassifier) => {
    const isEditing = editingIds.has(c.id);
    return (
      <div key={c.id} className="group flex items-center gap-2 px-3 py-1.5 hover:bg-muted/40 rounded text-sm">
        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
          {c.classifier_type}
        </span>
        <span className="flex-1 truncate">{c.value}</span>
        <span className="text-xs text-muted-foreground">{c.scope}</span>
        <button
          onClick={() => toggleSentiment(c.id, c.sentiment)}
          className={`p-1 rounded transition-colors ${isEditing ? "ring-1 ring-primary" : ""}`}
          title={c.sentiment === "like" ? "Switch to dislike" : "Switch to like"}
        >
          {c.sentiment === "like" ? (
            <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <ThumbsDown className="w-3.5 h-3.5 text-red-500" />
          )}
        </button>
        <button
          onClick={() => void removeClassifier(c.id)}
          className="p-1 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Manage Training</h2>
        <div className="flex items-center gap-2">
          {pendingUpdates.size > 0 && (
            <span className="text-xs text-amber-600">{pendingUpdates.size} pending</span>
          )}
          <button
            onClick={() => void handleBulkSave()}
            disabled={pendingUpdates.size === 0 || isSaving}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5 inline mr-1" />
            Save
          </button>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search classifiers..."
            className="w-full pl-7 pr-2 py-1 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex gap-1">
          {types.map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(filterType === type ? null : type)}
              className={`px-2 py-1 text-xs rounded-md capitalize ${
                filterType === type
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Classifier list */}
      <div className="flex-1 overflow-auto px-4 py-2">
        {isLoading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Loading...</div>
        ) : (
          <>
            {/* Liked */}
            <ClassifierGroup
              label="Liked"
              count={liked.length}
              isExpanded={expandedGroups.has("liked")}
              onToggle={() => toggleGroup("liked")}
              color="text-emerald-500"
              icon={<ThumbsUp className="w-4 h-4" />}
            >
              {liked.map(renderClassifier)}
            </ClassifierGroup>

            {/* Disliked */}
            <ClassifierGroup
              label="Disliked"
              count={disliked.length}
              isExpanded={expandedGroups.has("disliked")}
              onToggle={() => toggleGroup("disliked")}
              color="text-red-500"
              icon={<ThumbsDown className="w-4 h-4" />}
            >
              {disliked.map(renderClassifier)}
            </ClassifierGroup>

            {filtered.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No classifiers found
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ClassifierGroup({
  label,
  count,
  isExpanded,
  onToggle,
  color,
  icon,
  children,
}: {
  label: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  color: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2">
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 px-2 py-1.5 text-sm font-medium ${color} hover:bg-muted/40 rounded w-full text-left`}
      >
        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {icon}
        <span>{label}</span>
        <span className="text-xs text-muted-foreground">{count}</span>
      </button>
      {isExpanded && <div className="ml-4 mt-1">{children}</div>}
    </div>
  );
}
