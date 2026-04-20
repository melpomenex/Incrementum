/**
 * KeyboardShortcutPreferences
 * Edit keyboard shortcut bindings with conflict detection and reset to defaults
 */

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useKeyboardShortcutsStore } from "../../stores/keyboardShortcutsStore";

interface KeyboardShortcutPreferencesProps {
  onClose: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  navigation: "Navigation",
  article: "Article Actions",
  feed: "Feed Actions",
  view: "View",
  training: "Intelligence Training",
  search: "Search",
};

export function KeyboardShortcutPreferences({ onClose }: KeyboardShortcutPreferencesProps) {
  const { shortcuts, updateShortcut, resetToDefaults } = useKeyboardShortcutsStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingKeys, setPendingKeys] = useState("");
  const [conflict, setConflict] = useState<string | null>(null);

  const handleEditStart = (id: string) => {
    setEditingId(id);
    setPendingKeys("");
    setConflict(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
    if (e.shiftKey) parts.push("Shift");
    if (e.altKey) parts.push("Alt");
    if (!["Control", "Shift", "Alt", "Meta", "Escape"].includes(e.key)) {
      parts.push(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    }
    const combo = parts.join("+");

    if (e.key === "Escape") {
      setEditingId(null);
      return;
    }

    setPendingKeys(combo);

    // Check for conflicts
    const existing = shortcuts.find(
      (s) => s.keys === combo && s.id !== editingId
    );
    setConflict(existing ? `"${combo}" is already used for "${existing.description}"` : null);
  };

  const handleSave = () => {
    if (editingId && pendingKeys && !conflict) {
      updateShortcut(editingId, pendingKeys);
      setEditingId(null);
    }
  };

  const grouped = shortcuts.reduce<Record<string, typeof shortcuts>>((acc, sc) => {
    (acc[sc.category] ??= []).push(sc);
    return acc;
  }, {});

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Keyboard Shortcuts</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={resetToDefaults}
            className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Reset defaults
          </button>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        {Object.entries(grouped).map(([category, categoryShortcuts]) => (
          <div key={category}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {CATEGORY_LABELS[category] || category}
            </h3>
            <div className="space-y-1">
              {categoryShortcuts.map((sc) => (
                <div
                  key={sc.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/30"
                >
                  <span className="text-sm text-foreground">{sc.description}</span>
                  {editingId === sc.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        onKeyDown={handleKeyDown}
                        placeholder="Press keys..."
                        className="w-24 px-2 py-1 text-xs font-mono bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-center"
                        value={pendingKeys}
                        readOnly
                      />
                      {conflict && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-600">
                          <AlertTriangle className="w-3 h-3" />
                        </span>
                      )}
                      <button
                        onClick={handleSave}
                        disabled={!!conflict || !pendingKeys}
                        className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEditStart(sc.id)}
                      className="px-2 py-0.5 text-xs font-mono bg-muted border border-border rounded text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
                    >
                      {sc.keys}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
