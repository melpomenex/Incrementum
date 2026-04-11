/**
 * Keyboard Shortcuts Help Overlay
 * Shows all available keyboard shortcuts
 */

import { useEffect, useCallback } from "react";
import { X, Command, CornerDownLeft, ArrowUp, ArrowDown } from "lucide-react";
import { useI18n } from "../../lib/i18n";

interface ShortcutGroup {
  name: string;
  shortcuts: {
    keys: string[];
    description: string;
  }[];
}

function getShortcutGroups(t: (key: string) => string): ShortcutGroup[] {
  return [
    {
      name: t("keyboardShortcutsHelp.global"),
      shortcuts: [
        { keys: ["Ctrl/⌘", "K"], description: t("keyboardShortcutsHelp.openCommandPalette") },
        { keys: ["Ctrl/⌘", "P"], description: t("keyboardShortcutsHelp.quickNavigation") },
        { keys: ["Ctrl/⌘", ","], description: t("keyboardShortcutsHelp.openSettings") },
        { keys: ["Ctrl/⌘", "D"], description: t("keyboardShortcutsHelp.goToDashboard") },
        { keys: ["Ctrl/⌘", "Q"], description: t("keyboardShortcutsHelp.goToQueue") },
        { keys: ["Ctrl/⌘", "R"], description: t("keyboardShortcutsHelp.startReview") },
        { keys: ["Ctrl/⌘", "O"], description: t("keyboardShortcutsHelp.openDocumentImport") },
        { keys: ["Ctrl/⌘", "N"], description: t("keyboardShortcutsHelp.newItem") },
        { keys: ["Ctrl/⌘", "/"], description: t("keyboardShortcutsHelp.showKeyboardShortcuts") },
        { keys: ["?"], description: t("keyboardShortcutsHelp.showThisHelp") },
      ],
    },
    {
      name: t("keyboardShortcutsHelp.review"),
      shortcuts: [
        { keys: ["Space"], description: t("keyboardShortcutsHelp.showAnswer") },
        { keys: ["1"], description: t("keyboardShortcutsHelp.rateAgain") },
        { keys: ["2"], description: t("keyboardShortcutsHelp.rateHard") },
        { keys: ["3"], description: t("keyboardShortcutsHelp.rateGood") },
        { keys: ["4"], description: t("keyboardShortcutsHelp.rateEasy") },
        { keys: ["Ctrl/⌘", "Enter"], description: t("keyboardShortcutsHelp.showAnswerAlternative") },
        { keys: ["Ctrl/⌘", "1/2/3/4"], description: t("keyboardShortcutsHelp.rateWithoutShowingAnswer") },
        { keys: ["Esc"], description: t("keyboardShortcutsHelp.endSession") },
        { keys: ["Ctrl/⌘", "E"], description: t("keyboardShortcutsHelp.editCurrentCard") },
        { keys: ["Ctrl/⌘", "D"], description: t("keyboardShortcutsHelp.deleteCurrentCard") },
        { keys: ["Ctrl/⌘", "S"], description: t("keyboardShortcutsHelp.suspendCard") },
        { keys: ["Ctrl/⌘", "H"], description: t("keyboardShortcutsHelp.cardHistory") },
      ],
    },
    {
      name: t("keyboardShortcutsHelp.queue"),
      shortcuts: [
        { keys: ["Ctrl/⌘", "F"], description: t("keyboardShortcutsHelp.focusSearch") },
        { keys: ["Ctrl/⌘", "A"], description: t("keyboardShortcutsHelp.selectAll") },
        { keys: ["Delete"], description: t("keyboardShortcutsHelp.deleteSelected") },
        { keys: ["Ctrl/⌘", "Click"], description: t("keyboardShortcutsHelp.multiSelect") },
        { keys: ["Shift", "Click"], description: t("keyboardShortcutsHelp.rangeSelect") },
      ],
    },
    {
      name: t("keyboardShortcutsHelp.documentViewer"),
      shortcuts: [
        { keys: ["Ctrl/⌘", "F"], description: t("keyboardShortcutsHelp.searchInDocument") },
        { keys: ["Ctrl/⌘", "C"], description: t("keyboardShortcutsHelp.copySelectedText") },
        { keys: ["Ctrl/⌘", "E"], description: t("keyboardShortcutsHelp.createExtractFromSelection") },
        { keys: ["Ctrl/⌘", "H"], description: t("keyboardShortcutsHelp.highlightSelection") },
        { keys: ["Ctrl/⌘", "+"], description: t("keyboardShortcutsHelp.zoomIn") },
        { keys: ["Ctrl/⌘", "-"], description: t("keyboardShortcutsHelp.zoomOut") },
        { keys: ["Ctrl/⌘", "0"], description: t("keyboardShortcutsHelp.resetZoom") },
        { keys: ["F11"], description: t("keyboardShortcutsHelp.fullScreen") },
      ],
    },
  ];
}

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  const { t } = useI18n();
  const shortcutGroups = getShortcutGroups(t);
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
      if (e.key === "?" && !isOpen) {
        // Don't open if typing in an input
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
        onClose(); // Toggle off if already listening
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-3xl max-h-[85vh] bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Command className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2
                id="shortcuts-title"
                className="text-lg font-semibold text-foreground"
              >
                {t("keyboardShortcutsHelp.title")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("keyboardShortcutsHelp.subtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 min-w-[44px] min-h-[44px] hover:bg-muted rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            aria-label={t("keyboardShortcutsHelp.closeHelp")}
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 max-h-[calc(85vh-80px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {shortcutGroups.map((group) => (
              <div
                key={group.name}
                className="bg-muted/30 rounded-xl p-4 border border-border/50"
              >
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
                  {group.name}
                </h3>
                <div className="space-y-3">
                  {group.shortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-4"
                    >
                      <span className="text-sm text-muted-foreground">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {shortcut.keys.map((key, keyIndex) => (
                          <span key={keyIndex} className="flex items-center">
                            {key === "↑" ? (
                              <ArrowUp className="w-3.5 h-3.5" />
                            ) : key === "↓" ? (
                              <ArrowDown className="w-3.5 h-3.5" />
                            ) : key === "Enter" ? (
                              <CornerDownLeft className="w-3.5 h-3.5" />
                            ) : (
                              <kbd className="px-2 py-1 text-xs font-medium bg-background border border-border rounded-md min-w-[24px] text-center">
                                {key}
                              </kbd>
                            )}
                            {keyIndex < shortcut.keys.length - 1 && (
                              <span className="mx-1 text-muted-foreground">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Pro tip */}
          <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-xl">
            <p className="text-sm text-primary">
              <strong>{t("keyboardShortcutsHelp.proTipLabel")}</strong> {t("keyboardShortcutsHelp.proTipBody")}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-muted/30">
          <p className="text-xs text-center text-muted-foreground">
            {t("keyboardShortcutsHelp.pressEscToClose")}
          </p>
        </div>
      </div>
    </div>
  );
}

export default KeyboardShortcutsHelp;
