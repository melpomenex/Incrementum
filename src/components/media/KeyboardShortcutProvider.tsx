/**
 * KeyboardShortcutProvider
 * Document-level keydown listener with action dispatch for RSS reader
 */

import { useEffect, useCallback, useRef } from "react";
import { useKeyboardShortcutsStore } from "../../stores/keyboardShortcutsStore";

interface KeyboardShortcutProviderProps {
  onAction: (action: string) => void;
  enabled?: boolean;
}

export function KeyboardShortcutProvider({ onAction, enabled = true }: KeyboardShortcutProviderProps) {
  const { shortcuts } = useKeyboardShortcutsStore();
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Don't capture when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        // Allow Escape and specific shortcuts even in inputs
        if (e.key !== "Escape") return;
      }

      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
      if (e.shiftKey) parts.push("Shift");
      if (e.altKey) parts.push("Alt");
      if (!["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
        parts.push(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      }
      const combo = parts.join("+");

      // Find matching shortcut
      const shortcut = shortcuts.find((s) => s.keys === combo);
      if (shortcut) {
        e.preventDefault();
        e.stopPropagation();
        onActionRef.current(shortcut.action);
      } else if (combo === "ArrowDown" || combo === "j") {
        e.preventDefault();
        e.stopPropagation();
        onActionRef.current("nextArticle");
      } else if (combo === "ArrowUp" || combo === "k") {
        e.preventDefault();
        e.stopPropagation();
        onActionRef.current("prevArticle");
      } else if (combo === "Shift+?" || combo === "?") {
        e.preventDefault();
        e.stopPropagation();
        onActionRef.current("showHelp");
      }
    },
    [enabled, shortcuts]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [handleKeyDown]);

  return null; // This is a provider component with no UI
}
