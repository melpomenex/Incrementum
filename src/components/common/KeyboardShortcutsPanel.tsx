/**
 * Keyboard Shortcuts Panel
 * Shows relevant keyboard shortcuts at the bottom of each view
 */

import { useState } from "react";
import {
  Keyboard,
  X,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  Escape,
  Search,
  FilePlus,
  RotateCcw,
  ListOrdered,
  GitBranch,
  PanelLeft,
  HelpCircle,
  Command,
} from "lucide-react";

export interface ShortcutItem {
  keys: string[];
  label: string;
  icon?: typeof Keyboard;
}

export interface ShortcutsContext {
  view: "documents" | "review" | "queue" | "graph" | "settings" | "global";
}

// Define shortcuts for each context
const contextShortcuts: Record<string, ShortcutItem[]> = {
  global: [
    { keys: ["⌘/Ctrl", "K"], label: "Command palette", icon: Command },
    { keys: ["/"], label: "Focus search", icon: Search },
    { keys: ["?"], label: "Show shortcuts", icon: HelpCircle },
    { keys: ["B"], label: "Toggle sidebar", icon: PanelLeft },
  ],
  documents: [
    { keys: ["J", "↓"], label: "Move down", icon: ArrowDown },
    { keys: ["K", "↑"], label: "Move up", icon: ArrowUp },
    { keys: ["Enter"], label: "Open document", icon: CornerDownLeft },
    { keys: ["N"], label: "New document", icon: FilePlus },
    { keys: ["Esc"], label: "Deselect", icon: Escape },
  ],
  review: [
    { keys: ["Space"], label: "Show answer", icon: CornerDownLeft },
    { keys: ["1-4"], label: "Rate card", icon: Keyboard },
    { keys: ["Esc"], label: "Exit review", icon: Escape },
    { keys: ["T"], label: "Toggle TTS", icon: Keyboard },
  ],
  queue: [
    { keys: ["J", "↓"], label: "Move down", icon: ArrowDown },
    { keys: ["K", "↑"], label: "Move up", icon: ArrowUp },
    { keys: ["Enter"], label: "Open item", icon: CornerDownLeft },
    { keys: ["R"], label: "Start review", icon: RotateCcw },
  ],
  graph: [
    { keys: ["Scroll"], label: "Zoom", icon: Keyboard },
    { keys: ["Drag"], label: "Pan", icon: Keyboard },
    { keys: ["Esc"], label: "Reset view", icon: Escape },
  ],
  settings: [
    { keys: ["Tab"], label: "Next field", icon: Keyboard },
    { keys: ["Esc"], label: "Close", icon: Escape },
  ],
};

interface KeyboardShortcutsPanelProps {
  context: ShortcutsContext["view"];
  className?: string;
  compact?: boolean;
  showToggle?: boolean;
}

export function KeyboardShortcutsPanel({
  context,
  className = "",
  compact = false,
  showToggle = true,
}: KeyboardShortcutsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Combine global shortcuts with context-specific ones
  const shortcuts = [...contextShortcuts.global, ...(contextShortcuts[context] || [])];

  if (isDismissed) {
    return showToggle ? (
      <button
        onClick={() => setIsDismissed(false)}
        className={`fixed bottom-4 right-4 p-2 bg-card border border-border rounded-lg shadow-lg hover:bg-muted transition-colors ${className}`}
        title="Show keyboard shortcuts"
      >
        <Keyboard className="w-4 h-4 text-muted-foreground" />
      </button>
    ) : null;
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`}>
        {shortcuts.slice(0, 3).map((shortcut, index) => (
          <div key={index} className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">
              {shortcut.keys[0]}
            </kbd>
            <span>{shortcut.label}</span>
            {index < 2 && shortcuts.length > 1 && <span className="mx-1">•</span>}
          </div>
        ))}
        {shortcuts.length > 3 && (
          <button
            onClick={() => setIsExpanded(true)}
            className="text-primary hover:underline"
          >
            +{shortcuts.length - 3} more
          </button>
        )}
      </div>
    );
  }

  if (!isExpanded) {
    return (
      <div
        className={`flex items-center justify-between py-2 px-4 bg-card/80 backdrop-blur-sm border-t border-border ${className}`}
      >
        <div className="flex items-center gap-4 text-xs text-muted-foreground overflow-x-auto">
          {shortcuts.slice(0, 5).map((shortcut, index) => (
            <div key={index} className="flex items-center gap-1.5 whitespace-nowrap">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">
                {shortcut.keys.join(" / ")}
              </kbd>
              <span>{shortcut.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(true)}
            className="p-1.5 hover:bg-muted rounded transition-colors"
            title="View all shortcuts"
          >
            <Keyboard className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 hover:bg-muted rounded transition-colors"
            title="Hide panel"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  }

  // Expanded view - shows all shortcuts in a modal-like overlay
  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 ${className}`}>
      <div className="bg-card border-t border-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Keyboard className="w-4 h-4" />
            Keyboard Shortcuts
          </h3>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1.5 hover:bg-muted rounded transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Shortcuts Grid */}
        <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-64 overflow-y-auto">
          {/* Global shortcuts */}
          <div>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Global</h4>
            <div className="space-y-2">
              {contextShortcuts.global.map((shortcut, index) => (
                <ShortcutRow key={index} shortcut={shortcut} />
              ))}
            </div>
          </div>

          {/* Context-specific shortcuts */}
          {contextShortcuts[context] && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 capitalize">
                {context}
              </h4>
              <div className="space-y-2">
                {contextShortcuts[context].map((shortcut, index) => (
                  <ShortcutRow key={index} shortcut={shortcut} />
                ))}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Quick Actions</h4>
            <div className="space-y-2">
              <ShortcutRow shortcut={{ keys: ["N"], label: "New document", icon: FilePlus }} />
              <ShortcutRow shortcut={{ keys: ["R"], label: "Start review", icon: RotateCcw }} />
              <ShortcutRow shortcut={{ keys: ["Q"], label: "Open queue", icon: ListOrdered }} />
              <ShortcutRow shortcut={{ keys: ["G"], label: "Go to graph", icon: GitBranch }} />
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Navigation</h4>
            <div className="space-y-2">
              <ShortcutRow shortcut={{ keys: ["J", "↓"], label: "Move down", icon: ArrowDown }} />
              <ShortcutRow shortcut={{ keys: ["K", "↑"], label: "Move up", icon: ArrowUp }} />
              <ShortcutRow shortcut={{ keys: ["Enter"], label: "Open/Select", icon: CornerDownLeft }} />
              <ShortcutRow shortcut={{ keys: ["Esc"], label: "Close/Cancel", icon: Escape }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShortcutRow({ shortcut }: { shortcut: ShortcutItem }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {shortcut.keys.map((key, index) => (
          <span key={index}>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono min-w-[20px] text-center inline-block">
              {key}
            </kbd>
            {index < shortcut.keys.length - 1 && (
              <span className="text-muted-foreground mx-0.5">/</span>
            )}
          </span>
        ))}
      </div>
      <span className="text-xs text-muted-foreground truncate">{shortcut.label}</span>
    </div>
  );
}

/**
 * Floating shortcuts hint that shows on first visit
 */
export function ShortcutsHint({
  onDismiss,
  onOpenFull,
}: {
  onDismiss: () => void;
  onOpenFull: () => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-card border border-border rounded-xl shadow-xl p-4 max-w-xs animate-glass-scale-in">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Keyboard className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-medium text-foreground mb-1">
            Keyboard Shortcuts
          </h4>
          <p className="text-xs text-muted-foreground mb-3">
            Press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">?</kbd> anytime to see all shortcuts, or use{" "}
            <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">J/K</kbd> to navigate.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenFull}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              View Shortcuts
            </button>
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 hover:bg-muted rounded transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

/**
 * Hook to track if user has seen shortcuts hint
 */
export function useShortcutsHint() {
  const STORAGE_KEY = "incrementum_shortcuts_hint_seen";
  const [shouldShow, setShouldShow] = useState(() => {
    return !localStorage.getItem(STORAGE_KEY);
  });

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setShouldShow(false);
  };

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setShouldShow(true);
  };

  return { shouldShow, dismiss, reset };
}

export default KeyboardShortcutsPanel;
