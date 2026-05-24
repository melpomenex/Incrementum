import { useEffect, useCallback } from "react";

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  description: string;
  handler: (event: KeyboardEvent) => void;
  disabled?: boolean;
}

export interface ShortcutGroup {
  name: string;
  shortcuts: KeyboardShortcut[];
}

const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

export function formatShortcut(shortcut: Omit<KeyboardShortcut, "handler" | "description">): string {
  const parts: string[] = [];

  if (shortcut.ctrlKey) parts.push(isMac ? "⌃" : "Ctrl");
  if (shortcut.metaKey) parts.push(isMac ? "⌘" : "Ctrl");
  if (shortcut.shiftKey) parts.push(isMac ? "⇧" : "Shift");
  if (shortcut.altKey) parts.push(isMac ? "⌥" : "Alt");
  parts.push(shortcut.key.toUpperCase());

  return parts.join(isMac ? "" : "+");
}

export function useKeyboardShortcuts(shortcutGroups: ShortcutGroup[]) {
  // Serialize shortcut definitions to a stable string for dependency comparison
  // to avoid re-registering listeners on every render when the array reference changes.
  const groupsKey = shortcutGroups
    .map((g) => g.shortcuts.map((s) => `${s.key}:${s.ctrlKey}:${s.metaKey}:${s.shiftKey}:${s.altKey}`).join(","))
    .join(";");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea, or contentEditable
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Find matching shortcut
      for (const group of shortcutGroups) {
        for (const shortcut of group.shortcuts) {
          if (shortcut.disabled) continue;

          const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
          // metaKey in a shortcut definition means "primary modifier" (Ctrl on Linux/Windows, Cmd on Mac)
          const primaryMod = event.metaKey || event.ctrlKey;
          const ctrlMatch = shortcut.ctrlKey ? event.ctrlKey === true : !shortcut.metaKey ? event.ctrlKey === false : true;
          const metaMatch = shortcut.metaKey ? primaryMod === true : event.metaKey === false;
          const shiftMatch = event.shiftKey === (shortcut.shiftKey || false);
          const altMatch = event.altKey === (shortcut.altKey || false);

          if (keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch) {
            event.preventDefault();
            event.stopPropagation();
            shortcut.handler(event);
            return;
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [groupsKey, shortcutGroups]);
}

export function useGlobalShortcuts() {
  // Navigation shortcuts
  const navigateToQueue = useCallback(() => {
    window.dispatchEvent(new CustomEvent("navigate", { detail: "/queue" }));
  }, []);

  const navigateToReview = useCallback(() => {
    window.dispatchEvent(new CustomEvent("navigate", { detail: "/review" }));
  }, []);

  const navigateToDocuments = useCallback(() => {
    window.dispatchEvent(new CustomEvent("navigate", { detail: "/documents" }));
  }, []);

  const navigateToAnalytics = useCallback(() => {
    window.dispatchEvent(new CustomEvent("navigate", { detail: "/analytics" }));
  }, []);

  const navigateToSettings = useCallback(() => {
    window.dispatchEvent(new CustomEvent("navigate", { detail: "/settings" }));
  }, []);

  // Command palette
  const openCommandPalette = useCallback(() => {
    window.dispatchEvent(new CustomEvent("command-palette-open"));
  }, []);

  const shortcuts: ShortcutGroup[] = [
    {
      name: "Navigation",
      shortcuts: [
        {
          key: "1",
          metaKey: true,
          description: "Navigate to Queue",
          handler: navigateToQueue,
        },
        {
          key: "2",
          metaKey: true,
          description: "Navigate to Review",
          handler: navigateToReview,
        },
        {
          key: "3",
          metaKey: true,
          description: "Navigate to Documents",
          handler: navigateToDocuments,
        },
        {
          key: "4",
          metaKey: true,
          description: "Navigate to Analytics",
          handler: navigateToAnalytics,
        },
        {
          key: ",",
          metaKey: true,
          description: "Navigate to Settings",
          handler: navigateToSettings,
        },
      ],
    },
    {
      name: "Commands",
      shortcuts: [
        {
          key: "k",
          metaKey: true,
          description: "Open command palette",
          handler: openCommandPalette,
        },
        {
          key: "p",
          metaKey: true,
          shiftKey: true,
          description: "Open command palette",
          handler: openCommandPalette,
        },
      ],
    },
  ];

  useKeyboardShortcuts(shortcuts);

  // Bridge native Tauri shortcuts/events to the DOM
  useEffect(() => {
    let unlistenPaletteOpen: (() => void) | null = null;
    let unlistenShortcutNative: (() => void) | null = null;

    const setupTauriShortcutListeners = async () => {
      try {
        const { isTauri, listen } = await import("../lib/tauri");
        if (!isTauri()) return;

        console.log("[Tauri Shortcut Bridge] Setting up event listeners");

        unlistenPaletteOpen = await listen<string>("command-palette-open", (event) => {
          console.log("[Tauri Shortcut Bridge] Received command-palette-open:", event.payload);
          window.dispatchEvent(new CustomEvent("command-palette-open"));
        });

        unlistenShortcutNative = await listen<string>("global-shortcut-native", (event) => {
          const key = event.payload;
          console.log("[Tauri Shortcut Bridge] Received global-shortcut-native:", key);
          switch (key) {
            case "KeyQ":
              window.dispatchEvent(new CustomEvent("navigate", { detail: "/queue" }));
              break;
            case "KeyR":
              window.dispatchEvent(new CustomEvent("navigate", { detail: "/review" }));
              break;
            case "KeyD":
              window.dispatchEvent(new CustomEvent("navigate", { detail: "/dashboard" }));
              break;
            case "Comma":
              window.dispatchEvent(new CustomEvent("navigate", { detail: "/settings" }));
              break;
            case "KeyO":
            case "KeyN":
              window.dispatchEvent(new CustomEvent("navigate", { detail: "/documents" }));
              window.setTimeout(() => {
                window.dispatchEvent(new CustomEvent("import-document"));
              }, 0);
              break;
            case "KeyB":
              window.dispatchEvent(new CustomEvent("toggle-sidebar"));
              break;
            case "KeyE":
              window.dispatchEvent(new CustomEvent("extract-text"));
              break;
            case "BracketLeft":
              window.dispatchEvent(new CustomEvent("document-prev"));
              break;
            case "BracketRight":
              window.dispatchEvent(new CustomEvent("document-next"));
              break;
          }
        });
      } catch (err) {
        console.error("Failed to setup Tauri shortcut event listeners:", err);
      }
    };

    setupTauriShortcutListeners();

    return () => {
      if (unlistenPaletteOpen) unlistenPaletteOpen();
      if (unlistenShortcutNative) unlistenShortcutNative();
    };
  }, []);

  return { shortcuts };
}
