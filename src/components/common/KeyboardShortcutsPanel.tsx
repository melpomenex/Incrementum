/**
 * Keyboard Shortcuts Panel
 * Shows relevant keyboard shortcuts at the bottom of each view
 */

import { useState, type ComponentType } from "react";
import {
  Keyboard,
  X,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  Search,
  FilePlus,
  RotateCcw,
  ListOrdered,
  GitBranch,
  PanelLeft,
  HelpCircle,
  Command,
} from "lucide-react";

// lucide-react doesn't export Escape
function EscapeIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6L6 18M6 6l12 12"/></svg>;
}
const Escape = EscapeIcon;
import { useI18n } from "../../lib/i18n";

export interface ShortcutItem {
  keys: string[];
  label: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
}

export interface ShortcutsContext {
  view: "documents" | "review" | "queue" | "graph" | "settings" | "global";
}

function getContextShortcuts(t: (key: string) => string): Record<string, ShortcutItem[]> {
  return {
    global: [
      { keys: ["⌘/Ctrl", "K"], label: t("keyboardShortcutsPanel.commandPalette"), icon: Command },
      { keys: ["/"], label: t("keyboardShortcutsPanel.focusSearch"), icon: Search },
      { keys: ["?"], label: t("keyboardShortcutsPanel.showShortcuts"), icon: HelpCircle },
      { keys: ["B"], label: t("keyboardShortcutsPanel.toggleSidebar"), icon: PanelLeft },
    ],
    documents: [
      { keys: ["J", "↓"], label: t("keyboardShortcutsPanel.moveDown"), icon: ArrowDown },
      { keys: ["K", "↑"], label: t("keyboardShortcutsPanel.moveUp"), icon: ArrowUp },
      { keys: ["Enter"], label: t("keyboardShortcutsPanel.openDocument"), icon: CornerDownLeft },
      { keys: ["N"], label: t("keyboardShortcutsPanel.newDocument"), icon: FilePlus },
      { keys: ["Esc"], label: t("keyboardShortcutsPanel.deselect"), icon: Escape },
    ],
    review: [
      { keys: ["Space"], label: t("keyboardShortcutsPanel.showAnswer"), icon: CornerDownLeft },
      { keys: ["1-4"], label: t("keyboardShortcutsPanel.rateCard"), icon: Keyboard },
      { keys: ["Esc"], label: t("keyboardShortcutsPanel.exitReview"), icon: Escape },
      { keys: ["T"], label: t("keyboardShortcutsPanel.toggleTts"), icon: Keyboard },
    ],
    queue: [
      { keys: ["J", "↓"], label: t("keyboardShortcutsPanel.moveDown"), icon: ArrowDown },
      { keys: ["K", "↑"], label: t("keyboardShortcutsPanel.moveUp"), icon: ArrowUp },
      { keys: ["Enter"], label: t("keyboardShortcutsPanel.openItem"), icon: CornerDownLeft },
      { keys: ["R"], label: t("keyboardShortcutsPanel.startReview"), icon: RotateCcw },
    ],
    graph: [
      { keys: ["Scroll"], label: t("keyboardShortcutsPanel.zoom"), icon: Keyboard },
      { keys: ["Drag"], label: t("keyboardShortcutsPanel.pan"), icon: Keyboard },
      { keys: ["Esc"], label: t("keyboardShortcutsPanel.resetView"), icon: Escape },
    ],
    settings: [
      { keys: ["Tab"], label: t("keyboardShortcutsPanel.nextField"), icon: Keyboard },
      { keys: ["Esc"], label: t("keyboardShortcutsPanel.close"), icon: Escape },
    ],
  };
}

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
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const contextShortcuts = getContextShortcuts(t);
  const contextLabels: Record<ShortcutsContext["view"], string> = {
    documents: t("keyboardShortcutsPanel.documents"),
    review: t("keyboardShortcutsPanel.review"),
    queue: t("keyboardShortcutsPanel.queue"),
    graph: t("keyboardShortcutsPanel.graph"),
    settings: t("keyboardShortcutsPanel.settings"),
    global: t("keyboardShortcutsPanel.global"),
  };

  // Combine global shortcuts with context-specific ones
  const shortcuts = [...contextShortcuts.global, ...(contextShortcuts[context] || [])];

  if (isDismissed) {
    return showToggle ? (
      <button
        onClick={() => setIsDismissed(false)}
        className={`fixed bottom-4 right-4 p-2 bg-card border border-border rounded-lg shadow-lg hover:bg-muted transition-colors ${className}`}
        title={t("keyboardShortcutsPanel.showKeyboardShortcuts")}
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
            {t("keyboardShortcutsPanel.moreCount", { count: shortcuts.length - 3 })}
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
            title={t("keyboardShortcutsPanel.viewAllShortcuts")}
          >
            <Keyboard className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 hover:bg-muted rounded transition-colors"
            title={t("keyboardShortcutsPanel.hidePanel")}
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
            {t("keyboardShortcutsPanel.title")}
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
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">{t("keyboardShortcutsPanel.global")}</h4>
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
                {contextLabels[context]}
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
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">{t("keyboardShortcutsPanel.quickActions")}</h4>
            <div className="space-y-2">
              <ShortcutRow shortcut={{ keys: ["N"], label: t("keyboardShortcutsPanel.newDocument"), icon: FilePlus }} />
              <ShortcutRow shortcut={{ keys: ["R"], label: t("keyboardShortcutsPanel.startReview"), icon: RotateCcw }} />
              <ShortcutRow shortcut={{ keys: ["Q"], label: t("keyboardShortcutsPanel.openQueue"), icon: ListOrdered }} />
              <ShortcutRow shortcut={{ keys: ["G"], label: t("keyboardShortcutsPanel.goToGraph"), icon: GitBranch }} />
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">{t("keyboardShortcutsPanel.navigation")}</h4>
            <div className="space-y-2">
              <ShortcutRow shortcut={{ keys: ["J", "↓"], label: t("keyboardShortcutsPanel.moveDown"), icon: ArrowDown }} />
              <ShortcutRow shortcut={{ keys: ["K", "↑"], label: t("keyboardShortcutsPanel.moveUp"), icon: ArrowUp }} />
              <ShortcutRow shortcut={{ keys: ["Enter"], label: t("keyboardShortcutsPanel.openSelect"), icon: CornerDownLeft }} />
              <ShortcutRow shortcut={{ keys: ["Esc"], label: t("keyboardShortcutsPanel.closeCancel"), icon: Escape }} />
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
  const { t } = useI18n();
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-card border border-border rounded-xl shadow-xl p-4 max-w-xs animate-glass-scale-in">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Keyboard className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-medium text-foreground mb-1">
            {t("keyboardShortcutsPanel.title")}
          </h4>
          <p className="text-xs text-muted-foreground mb-3">
            {t("keyboardShortcutsPanel.hintBodyPrefix")} <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">?</kbd> {t("keyboardShortcutsPanel.hintBodyMiddle")}{" "}
            <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">J/K</kbd> {t("keyboardShortcutsPanel.hintBodySuffix")}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenFull}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              {t("keyboardShortcutsPanel.viewShortcuts")}
            </button>
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              {t("keyboardShortcutsPanel.gotIt")}
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
