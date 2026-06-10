/**
 * KeyboardHelpOverlay
 * Modal showing all keyboard shortcuts organized by category
 */

import { useEffect } from "react";
import { X, Keyboard } from "lucide-react";
import { useKeyboardShortcutsStore, type KeyboardShortcut } from "../../stores/keyboardShortcutsStore";
import { useI18n } from "../../lib/i18n";

interface KeyboardHelpOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardHelpOverlay({ isOpen, onClose }: KeyboardHelpOverlayProps) {
  const { t } = useI18n();
  const { shortcuts } = useKeyboardShortcutsStore();

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const grouped = shortcuts.reduce<Record<string, KeyboardShortcut[]>>((acc, sc) => {
    (acc[sc.category] ??= []).push(sc);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{t("shortcut.title")}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-auto max-h-[60vh] p-5 space-y-5">
          {Object.entries(grouped).map(([category, categoryShortcuts]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {t(`shortcut.category.${category}`) || category}
              </h3>
              <div className="space-y-1">
                {categoryShortcuts.map((sc) => (
                  <div key={sc.id} className="flex items-center justify-between py-1">
                    <span className="text-sm text-foreground">{t(`shortcut.desc.${sc.id}`) || sc.description}</span>
                    <kbd className="px-2 py-0.5 text-xs font-mono bg-muted border border-border rounded text-muted-foreground">
                      {sc.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
