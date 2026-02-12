/**
 * Keyboard Navigation Hook
 * Provides vim-style navigation for lists and general keyboard shortcuts
 */

import { useEffect, useCallback, useRef, useState } from "react";

export interface KeyboardNavigationConfig {
  // List navigation
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onSelect?: () => void;
  onOpen?: () => void;
  onClose?: () => void;

  // Quick actions
  onFocusSearch?: () => void;
  onNewDocument?: () => void;
  onStartReview?: () => void;
  onOpenQueue?: () => void;
  onOpenGraph?: () => void;
  onToggleSidebar?: () => void;
  onShowHelp?: () => void;
  onOpenCommandPalette?: () => void;

  // Configuration
  enabled?: boolean;
  enableVimNavigation?: boolean;
  preventDefaultForVim?: boolean;
}

interface UseKeyboardNavigationReturn {
  // For tracking which item is focused
  focusedIndex: number;
  setFocusedIndex: (index: number) => void;
  resetFocus: () => void;
}

export function useKeyboardNavigation(
  config: KeyboardNavigationConfig,
  deps: React.DependencyList = []
): UseKeyboardNavigationReturn {
  const {
    onMoveUp,
    onMoveDown,
    onSelect,
    onOpen,
    onClose,
    onFocusSearch,
    onNewDocument,
    onStartReview,
    onOpenQueue,
    onOpenGraph,
    onToggleSidebar,
    onShowHelp,
    onOpenCommandPalette,
    enabled = true,
    enableVimNavigation = true,
    preventDefaultForVim = true,
  } = config;

  const [focusedIndex, setFocusedIndex] = useState(0);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabledRef.current) return;

      // Ignore if typing in an input or textarea
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      // Allow escape and some global shortcuts even in inputs
      const isGlobalShortcut = e.key === "Escape" || (e.metaKey || e.ctrlKey);

      if (isInput && !isGlobalShortcut) {
        // Only allow / to focus search even in inputs
        if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          onFocusSearch?.();
        }
        return;
      }

      // Vim-style navigation
      if (enableVimNavigation) {
        switch (e.key.toLowerCase()) {
          case "j":
            if (!e.metaKey && !e.ctrlKey && !e.altKey) {
              if (preventDefaultForVim) e.preventDefault();
              onMoveDown?.();
              return;
            }
            break;
          case "k":
            if (!e.metaKey && !e.ctrlKey && !e.altKey) {
              if (preventDefaultForVim) e.preventDefault();
              onMoveUp?.();
              return;
            }
            break;
          case "/":
            if (!e.metaKey && !e.ctrlKey && !e.altKey) {
              e.preventDefault();
              onFocusSearch?.();
              return;
            }
            break;
          case "?":
            if (!e.metaKey && !e.ctrlKey && !e.altKey) {
              e.preventDefault();
              onShowHelp?.();
              return;
            }
            break;
          case "enter":
            if (!e.metaKey && !e.ctrlKey && !e.altKey) {
              // Don't prevent default for Enter - let it work normally
              onOpen?.() || onSelect?.();
              return;
            }
            break;
          case "escape":
            onClose?.();
            return;
          case "n":
            if (!e.metaKey && !e.ctrlKey && !e.altKey) {
              if (preventDefaultForVim) e.preventDefault();
              onNewDocument?.();
              return;
            }
            break;
          case "r":
            if (!e.metaKey && !e.ctrlKey && !e.altKey) {
              if (preventDefaultForVim) e.preventDefault();
              onStartReview?.();
              return;
            }
            break;
          case "q":
            if (!e.metaKey && !e.ctrlKey && !e.altKey) {
              if (preventDefaultForVim) e.preventDefault();
              onOpenQueue?.();
              return;
            }
            break;
          case "g":
            if (!e.metaKey && !e.ctrlKey && !e.altKey) {
              if (preventDefaultForVim) e.preventDefault();
              onOpenGraph?.();
              return;
            }
            break;
          case "b":
            if (!e.metaKey && !e.ctrlKey && !e.altKey) {
              if (preventDefaultForVim) e.preventDefault();
              onToggleSidebar?.();
              return;
            }
            break;
        }
      }

      // Standard arrow key navigation
      switch (e.key) {
        case "ArrowUp":
          if (!e.metaKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            onMoveUp?.();
            return;
          }
          break;
        case "ArrowDown":
          if (!e.metaKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            onMoveDown?.();
            return;
          }
          break;
        case "k":
          // Cmd+K for command palette
          if ((e.metaKey || e.ctrlKey) && !e.altKey) {
            e.preventDefault();
            onOpenCommandPalette?.();
            return;
          }
          break;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      onMoveUp,
      onMoveDown,
      onSelect,
      onOpen,
      onClose,
      onFocusSearch,
      onNewDocument,
      onStartReview,
      onOpenQueue,
      onOpenGraph,
      onToggleSidebar,
      onShowHelp,
      onOpenCommandPalette,
      enableVimNavigation,
      preventDefaultForVim,
      ...deps,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const resetFocus = useCallback(() => {
    setFocusedIndex(0);
  }, []);

  return {
    focusedIndex,
    setFocusedIndex,
    resetFocus,
  };
}

/**
 * Hook for list navigation with index tracking
 */
export function useListKeyboardNavigation<T>(
  items: T[],
  config: {
    onSelect?: (item: T, index: number) => void;
    onOpen?: (item: T, index: number) => void;
    enabled?: boolean;
  } = {}
) {
  const { onSelect, onOpen, enabled = true } = config;
  const [focusedIndex, setFocusedIndex] = useState(0);

  const handleMoveUp = useCallback(() => {
    setFocusedIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleMoveDown = useCallback(() => {
    setFocusedIndex((prev) => Math.min(items.length - 1, prev + 1));
  }, [items.length]);

  const handleSelect = useCallback(() => {
    const item = items[focusedIndex];
    if (item) {
      onSelect?.(item, focusedIndex);
    }
  }, [items, focusedIndex, onSelect]);

  const handleOpen = useCallback(() => {
    const item = items[focusedIndex];
    if (item) {
      onOpen?.(item, focusedIndex);
    }
  }, [items, focusedIndex, onOpen]);

  // Reset focused index when items change
  useEffect(() => {
    setFocusedIndex((prev) => Math.min(prev, Math.max(0, items.length - 1)));
  }, [items.length]);

  useKeyboardNavigation({
    onMoveUp: handleMoveUp,
    onMoveDown: handleMoveDown,
    onSelect: handleSelect,
    onOpen: handleOpen,
    enabled,
  });

  return {
    focusedIndex,
    setFocusedIndex,
    focusedItem: items[focusedIndex],
  };
}

/**
 * Global keyboard shortcuts that work everywhere
 */
export function useGlobalShortcuts(callbacks: {
  onCommandPalette?: () => void;
  onSearch?: () => void;
  onHelp?: () => void;
  enabled?: boolean;
}) {
  const { onCommandPalette, onSearch, onHelp, enabled = true } = callbacks;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      // Cmd/Ctrl + K for command palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onCommandPalette?.();
        return;
      }

      // / to focus search (only when not in input)
      if (!isInput && e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onSearch?.();
        return;
      }

      // ? to show help (only when not in input)
      if (!isInput && e.key === "?" && e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onHelp?.();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onCommandPalette, onSearch, onHelp]);
}

export default useKeyboardNavigation;
