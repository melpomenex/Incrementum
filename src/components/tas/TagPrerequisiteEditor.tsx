// Tag-Aware Scheduling — Tag Prerequisite Editor

import React, { useEffect, useState } from "react";
import { useTASStore } from "../../stores/tasStore";
import type { Tag, TagStabilityStats } from "../../types/tas";

interface TagPrerequisiteEditorProps {
  /** Currently selected tag ID to edit prerequisites for */
  selectedTagId: string | null;
  /** Callback when prerequisites change */
  onPrerequisitesChanged?: () => void;
}

const TagPrerequisiteEditor: React.FC<TagPrerequisiteEditorProps> = ({
  selectedTagId,
  onPrerequisitesChanged,
}) => {
  const tags = useTASStore((s) => s.tags);
  const loadTags = useTASStore((s) => s.loadTags);
  const setPrerequisites = useTASStore((s) => s.setPrerequisites);
  const getStats = useTASStore((s) => s.getStats);
  const error = useTASStore((s) => s.error);
  const isLoading = useTASStore((s) => s.isLoading);

  const [selectedPrereqs, setSelectedPrereqs] = useState<string[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, TagStabilityStats>>({});
  const [localError, setLocalError] = useState<string | null>(null);

  const selectedTag = tags.find((t) => t.id === selectedTagId);

  useEffect(() => {
    loadTags();
  }, []);

  useEffect(() => {
    if (selectedTag) {
      setSelectedPrereqs(selectedTag.prerequisites);
      setLocalError(null);
    }
  }, [selectedTagId, selectedTag?.prerequisites]);

  // Load stats for all tags
  useEffect(() => {
    const loadStats = async () => {
      const map: Record<string, TagStabilityStats> = {};
      for (const tag of tags) {
        try {
          map[tag.id] = await getStats(tag.id);
        } catch {
          // Stats not available yet
        }
      }
      setStatsMap(map);
    };
    if (tags.length > 0) {
      loadStats();
    }
  }, [tags.length]);

  if (!selectedTag) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        Select a tag to edit its prerequisites.
      </div>
    );
  }

  const handleTogglePrereq = (prereqId: string) => {
    setSelectedPrereqs((prev) =>
      prev.includes(prereqId)
        ? prev.filter((id) => id !== prereqId)
        : [...prev, prereqId]
    );
  };

  const handleSave = async () => {
    if (!selectedTag) return;
    setLocalError(null);
    try {
      await setPrerequisites(selectedTag.id, selectedPrereqs);
      onPrerequisitesChanged?.();
    } catch (err) {
      setLocalError(String(err));
    }
  };

  const availableTags = tags.filter((t) => t.id !== selectedTagId);

  const stats = statsMap[selectedTag.id];
  const maturityPct = stats
    ? Math.round(stats.maturityRatio * 100)
    : null;

  return (
    <div className="space-y-4 p-4 bg-surface rounded-lg border border-border">
      <h4 className="text-base font-medium text-foreground">
        Prerequisites for{" "}
        <span className="text-primary">{selectedTag.name}</span>
      </h4>

      {/* Maturity Progress */}
      {maturityPct !== null && stats && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Maturity</span>
            <span>
              {stats.matureCount} / {stats.itemCount}
            </span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${maturityPct}%` }}
            />
          </div>
          {stats.itemCount === 0 && (
            <span className="text-xs text-muted-foreground italic">N/A</span>
          )}
        </div>
      )}

      {/* Prerequisite Selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground">
          Required Tags (items from these tags must be mature before this tag&apos;s items appear)
        </label>
        {availableTags.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No other tags available.
          </p>
        ) : (
          <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded p-2">
            {availableTags.map((tag) => {
              const isSelected = selectedPrereqs.includes(tag.id);
              const tagStats = statsMap[tag.id];
              const tagMaturity = tagStats
                ? Math.round(tagStats.maturityRatio * 100)
                : null;

              return (
                <label
                  key={tag.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${
                    isSelected
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleTogglePrereq(tag.id)}
                    className="rounded border-border"
                  />
                  <span className="flex-1">{tag.name}</span>
                  {tagMaturity !== null && (
                    <span className="text-xs text-muted-foreground">
                      {tagMaturity}% mature
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Error display */}
      {(localError || error) && (
        <div className="text-xs text-red-500 bg-red-500/10 rounded px-3 py-2">
          {localError || error}
        </div>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={isLoading}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {isLoading ? "Saving..." : "Save Prerequisites"}
      </button>
    </div>
  );
};

export default TagPrerequisiteEditor;
