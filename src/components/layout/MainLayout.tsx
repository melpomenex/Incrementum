import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useTabsStore, normalizePane, useDocumentStore, useSettingsStore, useUIStore, type TabType } from "../../stores";
import { useVimModeStore } from "../../stores/vimModeStore";
import { useI18n } from "../../lib/i18n";
import { useGlobalShortcuts } from "../../hooks/useKeyboardShortcuts";
import { useShortcut } from "../common/KeyboardShortcuts";
import { VimiumNavigationProvider, useVimiumEnabled, type VimiumCommand } from "../common/VimiumNavigation";
import { Toolbar } from "../Toolbar";
import { Tabs } from "../common/Tabs";
import { DashboardTab, QueueTab, QueueScrollPage, DocumentsTab, ReviewTab, AnalyticsTab, SettingsTab, WebBrowserTab, RssTab, PodcastTab, KnowledgeSphereTab, KnowledgeNetworkTab, NewsletterDirectoryTab, DocumentQATab, NotebookLMTab, ImageRegistryTab } from "../tabs/TabRegistry";
import { CommandCenter } from "../search/CommandCenter";
import { captureAndSaveScreenshot } from "../../utils/screenshotCaptureFlow";
import { useToast } from "../common/Toast";
import { MobileLayoutWrapper } from "../mobile/MobileLayoutWrapper";
import { ThemeBackdrop } from "../common/ThemeBackdrop";
import { KeyboardShortcutsHelp } from "../common/KeyboardShortcutsHelp";
import { ImageSaveOverlay } from "../viewer/ImageSaveOverlay";
import { PasteExtractDialog } from "../extracts/PasteExtractDialog";
import {
  LayoutDashboard,
  ListTodo,
  Monitor,
} from "lucide-react";

const TAB_TYPE_ALIASES: Record<string, TabType> = {
  dash: "dashboard", dashboard: "dashboard", home: "dashboard",
  docs: "documents", documents: "documents", doc: "documents",
  queue: "queue", q: "queue",
  "queue-scroll": "queue-scroll", qs: "queue-scroll", scroll: "queue-scroll", "scroll-mode": "queue-scroll", "optimal-queue": "queue-scroll",
  rev: "review", review: "review",
  anal: "analytics", analytics: "analytics", stats: "analytics",
  set: "settings", settings: "settings",
  rss: "rss", feeds: "rss",
  news: "newsletter", newsletter: "newsletter",
  pod: "podcast", podcast: "podcast", podcasts: "podcast",
  ks: "knowledge-sphere", sphere: "knowledge-sphere", "knowledge-sphere": "knowledge-sphere",
  kn: "knowledge-network", network: "knowledge-network", "knowledge-network": "knowledge-network",
  qa: "doc-qa", "doc-qa": "doc-qa",
  nb: "notebooklm", notebook: "notebooklm", notebooklm: "notebooklm",
  img: "image-registry", images: "image-registry", "image-registry": "image-registry",
  web: "web-browser", browser: "web-browser", "web-browser": "web-browser",
};

const TAB_TYPE_ICONS: Record<string, string> = {
  dashboard: "📊", documents: "📂", queue: "📚", "queue-scroll": "📜", review: "🧠",
  analytics: "📈", settings: "⚙️", rss: "📡", newsletter: "📰",
  podcast: "🎙️", "knowledge-sphere": "🌐", "knowledge-network": "🕸️",
  "doc-qa": "💬", notebooklm: "🤖", "image-registry": "🖼️",
  "web-browser": "🌐",
};

function resolveTabType(input: string): TabType | null {
  return TAB_TYPE_ALIASES[input.toLowerCase()] ?? null;
}

function getActiveTabPane() {
  const paneIds = useTabsStore.getState().getTabPaneIds();
  if (paneIds.length === 0) return null;
  const pane = useTabsStore.getState().findPaneById(paneIds[0]);
  if (!pane || pane.type !== "tabs") return null;
  return pane;
}

export function MainLayout() {
  const tabs = useTabsStore((state) => state.tabs);
  const rawRootPane = useTabsStore((state) => state.rootPane);
  const rootPane = normalizePane(rawRootPane);
  const addTab = useTabsStore((state) => state.addTab);
  const loadTabs = useTabsStore((state) => state.loadTabs);
  const setActiveTab = useTabsStore((state) => state.setActiveTab);
  const updateTab = useTabsStore((state) => state.updateTab);
  const closeTab = useTabsStore((state) => state.closeTab);
  const reopenLastClosedTab = useTabsStore((state) => state.reopenLastClosedTab);
  const loadDocuments = useDocumentStore((state) => state.loadDocuments);
  const initializedRef = useRef(false);
  const { t } = useI18n();
  const toast = useToast();
  const [vimiumEnabled] = useVimiumEnabled();
  const documentsLoadedRef = useRef(false);
  const [activePaneTabId, setActivePaneTabId] = useState<string | null>(null);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);

  const toolbarPosition = useSettingsStore((state) => state.settings.interface.toolbarPosition);

  // Find the first tab pane and its active tab for keyboard navigation
  useEffect(() => {
    const findFirstTabPane = (pane: typeof rootPane): typeof rootPane | null => {
      if (pane.type === "tabs") return pane;
      if (pane.type === "split") {
        for (const child of pane.children) {
          const found = findFirstTabPane(child);
          if (found) return found;
        }
      }
      return null;
    };

    const firstPane = findFirstTabPane(rootPane);
    if (firstPane && firstPane.type === "tabs") {
      setActivePaneTabId(firstPane.activeTabId);
    }
  }, [rootPane]);

  useGlobalShortcuts();
  /* useShortcut("gen.screenshot", (event) => {
    const target = event.target as HTMLElement;
    const isInput =
      target?.tagName === "INPUT" ||
      target?.tagName === "TEXTAREA" ||
      target?.isContentEditable;
    if (isInput) return;
    void captureAndSaveScreenshot()
      .then((asset) => {
        if (asset) {
          toast.success(
            t("imageRegistry.assetsAdded"),
            t("imageRegistry.assetsAddedDesc", { count: 1 })
          );
        }
      })
      .catch((error) => {
        console.error("Failed to capture screenshot:", error);
        toast.error(
          t("toolbar.screenshotFailed"),
          error instanceof Error ? error.message : undefined
        );
      });
  }); */

  useShortcut("gen.help", () => {
    setIsShortcutsHelpOpen((prev) => !prev);
  });

  useShortcut("gen.settings", () => {
    openTabByType("settings");
  });

  useShortcut("review.start", () => {
    openTabByType("review");
  });

  useShortcut("edit.new-document", () => {
    openTabByType("documents");
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("import-document"));
    }, 100);
  });

  useShortcut("doc.import", () => {
    openTabByType("documents");
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("import-document"));
    }, 100);
  });

  useShortcut("edit.new-flashcard", () => {
    openTabByType("review");
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("open-flashcard-studio"));
    }, 100);
  });

  useShortcut("gen.quit", () => {
    window.close();
  });

  useEffect(() => {
    const handleShowHelp = () => {
      setIsShortcutsHelpOpen(true);
    };

    const handleToggleTheme = () => {
      const settings = useSettingsStore.getState().settings;
      const next = settings.appearance.theme === "dark" ? "light" : "dark";
      useSettingsStore.getState().updateSettingsCategory("appearance", { theme: next });
    };

    window.addEventListener("show-shortcuts-help", handleShowHelp);
    window.addEventListener("toggle-theme", handleToggleTheme);
    return () => {
      window.removeEventListener("show-shortcuts-help", handleShowHelp);
      window.removeEventListener("toggle-theme", handleToggleTheme);
    };
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initTabs = async () => {
      // If no tabs exist, try restoring from saved session
      if (tabs.length === 0) {
        // loadTabs() will restore the session if restoreSession is enabled
        const restored = await loadTabs();

        // If still no tabs after loading, create defaults
        if (!restored && useTabsStore.getState().tabs.length === 0) {
          // Add Dashboard tab (non-closable)
          addTab({
            title: "Dashboard",
            icon: <LayoutDashboard className="w-4 h-4" />,
            type: "dashboard",
            content: DashboardTab,
            closable: false,
          });

          // Add Queue tab (closable)
          addTab({
            title: "Queue",
            icon: <ListTodo className="w-4 h-4" />,
            type: "queue",
            content: QueueTab,
            closable: true,
          });
        }
      }
    };

    void initTabs();
  }, []);

  useEffect(() => {
    if (documentsLoadedRef.current) return;
    documentsLoadedRef.current = true;
    void loadDocuments();
  }, [loadDocuments]);

  // Auto-save session on background/close
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        useTabsStore.getState().saveTabs();
      }
    };
    const handleBeforeUnload = () => {
      useTabsStore.getState().saveTabs();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const resolveUrl = (inputUrl: string) => {
    if (!inputUrl.trim()) return "";
    if (inputUrl.startsWith("http://") || inputUrl.startsWith("https://")) {
      return inputUrl;
    }
    if (inputUrl.includes(" ")) {
      return `https://www.google.com/search?q=${encodeURIComponent(inputUrl)}`;
    }
    return `https://${inputUrl}`;
  };

  const openWebUrl = (inputUrl: string, newTab: boolean) => {
    const formatted = resolveUrl(inputUrl);
    if (!formatted) return;

    if (!newTab && activePaneTabId) {
      const activeTab = tabs.find((tab) => tab.id === activePaneTabId);
      if (activeTab?.type === "web-browser") {
        updateTab(activeTab.id, {
          data: { ...activeTab.data, initialUrl: formatted },
        });
        return;
      }
    }

    addTab({
      title: "Web Browser",
      icon: <Monitor className="w-4 h-4" />,
      type: "web-browser",
      content: WebBrowserTab,
      closable: true,
      data: { initialUrl: formatted },
    });
  };

  const openTabByType = useCallback((type: TabType) => {
    const tabConfig: Record<string, { title: string; content: React.ComponentType; closable: boolean }> = {
      dashboard: { title: "Dashboard", content: DashboardTab, closable: false },
      documents: { title: "Documents", content: DocumentsTab, closable: true },
      queue: { title: "Queue", content: QueueTab, closable: true },
      "queue-scroll": { title: "Scroll Mode", content: QueueScrollPage, closable: true },
      review: { title: "Review", content: ReviewTab, closable: true },
      analytics: { title: "Statistics", content: AnalyticsTab, closable: true },
      settings: { title: "Settings", content: SettingsTab, closable: true },
      rss: { title: "RSS", content: RssTab, closable: true },
      newsletter: { title: "Newsletters", content: NewsletterDirectoryTab, closable: true },
      podcast: { title: "Podcasts", content: PodcastTab, closable: true },
      "knowledge-sphere": { title: "Knowledge Sphere", content: KnowledgeSphereTab, closable: true },
      "knowledge-network": { title: "Knowledge Network", content: KnowledgeNetworkTab, closable: true },
      "doc-qa": { title: "Document Q&A", content: DocumentQATab, closable: true },
      notebooklm: { title: "NotebookLM", content: NotebookLMTab, closable: true },
      "image-registry": { title: "Images", content: ImageRegistryTab, closable: true },
    };
    const config = tabConfig[type];
    if (!config) return;
    addTab({
      title: config.title,
      icon: TAB_TYPE_ICONS[type] ?? "📋",
      type,
      content: config.content,
      closable: config.closable,
    });
  }, [addTab]);

  useEffect(() => {
    const handleNavigate = (e: CustomEvent<string>) => {
      const path = e.detail;
      const cleanPath = path.replace(/^\//, "");
      const tabType = resolveTabType(cleanPath);
      if (tabType) {
        openTabByType(tabType);
      }
    };

    window.addEventListener("navigate" as any, handleNavigate);
    return () => window.removeEventListener("navigate" as any, handleNavigate);
  }, [openTabByType]);

  const vimiumCommands = useMemo<VimiumCommand[]>(() => {
    const cmds: VimiumCommand[] = [
      {
        id: "vimium-open",
        name: "open",
        description: t("toolbar.openUrl"),
        action: (args) => openWebUrl(args.join(" "), false),
        aliases: ["o"],
      },
      {
        id: "vimium-tab",
        name: "tab",
        description: t("toolbar.openUrlNewTab"),
        action: (args) => openWebUrl(args.join(" "), true),
        aliases: ["t"],
      },
      {
        id: "vimium-dashboard",
        name: "dashboard",
        description: t("toolbar.goToDashboard"),
        action: () => openTabByType("dashboard"),
      },
      {
        id: "vimium-documents",
        name: "documents",
        description: t("toolbar.goToDocuments"),
        action: () => openTabByType("documents"),
      },
      {
        id: "vimium-queue",
        name: "queue",
        description: t("toolbar.goToQueue"),
        action: () => openTabByType("queue"),
      },
      {
        id: "vimium-review",
        name: "review",
        description: t("toolbar.startReviewCmd"),
        action: () => openTabByType("review"),
      },
      {
        id: "vimium-analytics",
        name: "analytics",
        description: t("toolbar.openStats"),
        action: () => openTabByType("analytics"),
      },
      {
        id: "vimium-settings",
        name: "settings",
        description: t("toolbar.openSettings"),
        action: () => openTabByType("settings"),
      },
      {
        id: "vimium-close-tab",
        name: "close-tab",
        description: t("toolbar.closeTab"),
        action: () => {
          if (activePaneTabId) closeTab(activePaneTabId);
        },
        aliases: ["close"],
      },
      {
        id: "vimium-restore-tab",
        name: "restore-tab",
        description: t("toolbar.reopenClosedTab"),
        action: () => reopenLastClosedTab(),
        aliases: ["reopen"],
      },
      {
        id: "vimium-next-tab",
        name: "next-tab",
        description: t("toolbar.switchNextTab"),
        action: () => {
          const pane = getActiveTabPane();
          if (!pane) return;
          const currentIndex = pane.tabIds.findIndex((id) => id === pane.activeTabId);
          const nextIndex = (currentIndex + 1) % pane.tabIds.length;
          if (pane.tabIds[nextIndex]) setActiveTab(pane.id, pane.tabIds[nextIndex]);
        },
      },
      {
        id: "vimium-prev-tab",
        name: "prev-tab",
        description: t("toolbar.switchPrevTab"),
        action: () => {
          const pane = getActiveTabPane();
          if (!pane) return;
          const currentIndex = pane.tabIds.findIndex((id) => id === pane.activeTabId);
          const prevIndex = currentIndex <= 0 ? pane.tabIds.length - 1 : currentIndex - 1;
          if (pane.tabIds[prevIndex]) setActiveTab(pane.id, pane.tabIds[prevIndex]);
        },
        aliases: ["previous-tab"],
      },

      {
        id: "vimium-split",
        name: "split",
        description: t("vimium.cmd.split"),
        action: (args) => {
          const pane = getActiveTabPane();
          if (!pane || !activePaneTabId) return;
          if (args.length > 0) {
            const tabType = resolveTabType(args[0]);
            if (tabType) {
              openTabByType(tabType);
              const newTabs = useTabsStore.getState().tabs;
              const newTab = newTabs[newTabs.length - 1];
              if (newTab) {
                useTabsStore.getState().spawnTabInSplit(pane.id, newTab.id, "horizontal", "after");
              }
            }
          } else {
            useTabsStore.getState().spawnTabInSplit(pane.id, activePaneTabId, "horizontal", "after");
          }
        },
        aliases: ["sp", "spl"],
      },
      {
        id: "vimium-vsplit",
        name: "vsplit",
        description: t("vimium.cmd.vsplit"),
        action: (args) => {
          const pane = getActiveTabPane();
          if (!pane || !activePaneTabId) return;
          if (args.length > 0) {
            const tabType = resolveTabType(args[0]);
            if (tabType) {
              openTabByType(tabType);
              const newTabs = useTabsStore.getState().tabs;
              const newTab = newTabs[newTabs.length - 1];
              if (newTab) {
                useTabsStore.getState().spawnTabInSplit(pane.id, newTab.id, "vertical", "after");
              }
            }
          } else {
            useTabsStore.getState().spawnTabInSplit(pane.id, activePaneTabId, "vertical", "after");
          }
        },
        aliases: ["vsp", "vs"],
      },
      {
        id: "vimium-only",
        name: "only",
        description: t("vimium.cmd.only"),
        action: () => {
          const { rootPane, collapseSplit } = useTabsStore.getState();
          if (rootPane.type !== "split") return;
          // Walk the tree and collapse all splits except the one containing the active pane
          const paneIds = useTabsStore.getState().getTabPaneIds();
          const activePaneId = paneIds[0];
          if (!activePaneId) return;
          // Recursively collapse from the root until only a single tab pane remains
          const collapseAllOthers = (pane: typeof rootPane): void => {
            if (pane.type !== "split") return;
            // Find which child contains the active pane
            const childWithActive = pane.children.find((child) => {
              if (child.id === activePaneId) return true;
              if (child.type === "split") {
                return !!useTabsStore.getState().findPaneById(activePaneId);
              }
              return false;
            });
            const childToRemove = pane.children.find((c) => c !== childWithActive);
            if (childToRemove) {
              collapseSplit(pane.id, childToRemove.id);
            }
            const newRoot = useTabsStore.getState().rootPane;
            if (newRoot.type === "split") collapseAllOthers(newRoot);
          };
          collapseAllOthers(rootPane);
        },
        aliases: ["on"],
      },
      {
        id: "vimium-swap",
        name: "swap",
        description: t("vimium.cmd.swap"),
        action: () => {
          const { rootPane } = useTabsStore.getState();
          if (rootPane.type !== "split" || rootPane.children.length < 2) return;
          // Swap first two children at the root level
          const paneIds = useTabsStore.getState().getTabPaneIds();
          if (paneIds.length < 2) return;
          // Use set to swap children order in the root split
          useTabsStore.setState((state) => {
            if (state.rootPane.type !== "split") return state;
            const children = [...state.rootPane.children];
            if (children.length >= 2) {
              [children[0], children[1]] = [children[1], children[0]];
            }
            return { rootPane: { ...state.rootPane, children } };
          });
          setTimeout(() => useTabsStore.getState().saveTabs(), 0);
        },
        aliases: ["sw"],
      },

      {
        id: "vimium-tabnew",
        name: "tabnew",
        description: t("vimium.cmd.tabnew"),
        action: (args) => {
          if (args.length > 0) {
            const tabType = resolveTabType(args[0]);
            if (tabType) {
              openTabByType(tabType);
            }
          } else {
            openTabByType("dashboard");
          }
        },
        aliases: ["tabn", "tn"],
      },
      {
        id: "vimium-tabclose",
        name: "tabclose",
        description: t("vimium.cmd.tabclose"),
        action: () => {
          if (activePaneTabId) closeTab(activePaneTabId);
        },
        aliases: ["tabc", "tc"],
      },
      {
        id: "vimium-tabonly",
        name: "tabonly",
        description: t("vimium.cmd.tabonly"),
        action: () => {
          if (activePaneTabId) {
            useTabsStore.getState().closeOtherTabs(activePaneTabId);
          }
        },
        aliases: ["tabo", "to"],
      },
      {
        id: "vimium-tabmove",
        name: "tabmove",
        description: t("vimium.cmd.tabmove"),
        action: (args) => {
          const pane = getActiveTabPane();
          if (!pane || !pane.activeTabId) return;
          const currentIdx = pane.tabIds.indexOf(pane.activeTabId);
          if (currentIdx === -1) return;
          let targetIdx: number;
          if (args.length === 0 || args[0] === "") {
            targetIdx = Math.min(currentIdx + 1, pane.tabIds.length - 1);
          } else if (args[0] === "$") {
            targetIdx = pane.tabIds.length - 1;
          } else {
            targetIdx = parseInt(args[0], 10);
            if (isNaN(targetIdx)) return;
            targetIdx = Math.max(0, Math.min(targetIdx, pane.tabIds.length - 1));
          }
          if (targetIdx !== currentIdx) {
            useTabsStore.getState().moveTab(currentIdx, targetIdx, pane.id);
          }
        },
        aliases: ["tabm", "tm"],
      },
      {
        id: "vimium-tabclose-right",
        name: "tabclose-right",
        description: t("vimium.cmd.tabcloseRight"),
        action: () => {
          if (activePaneTabId) {
            useTabsStore.getState().closeTabsToRight(activePaneTabId);
          }
        },
        aliases: ["tcr"],
      },
      {
        id: "vimium-tabreopen",
        name: "tabreopen",
        description: t("vimium.cmd.tabreopen"),
        action: () => reopenLastClosedTab(),
        aliases: ["topen"],
      },

      {
        id: "vimium-edit",
        name: "edit",
        description: t("vimium.cmd.edit"),
        action: (args) => {
          const query = args.join(" ");
          const store = useUIStore.getState();
          store.setCommandPaletteQuery(query);
          store.setCommandPaletteOpen(true);
        },
        aliases: ["e"],
      },
      {
        id: "vimium-bdelete",
        name: "bdelete",
        description: t("vimium.cmd.bdelete"),
        action: (args) => {
          if (args.length > 0) {
            const tabType = resolveTabType(args[0]);
            if (tabType) {
              const tab = useTabsStore.getState().tabs.find((t) => t.type === tabType);
              if (tab) closeTab(tab.id);
            }
          } else if (activePaneTabId) {
            closeTab(activePaneTabId);
          }
        },
        aliases: ["bd", "bclose"],
      },
      {
        id: "vimium-buffers",
        name: "buffers",
        description: t("vimium.cmd.buffers"),
        action: () => {
          // Show tabs via command palette with a special filter
          const store = useUIStore.getState();
          store.setCommandPaletteQuery("");
          store.setCommandPaletteOpen(true);
        },
        aliases: ["ls", "files"],
      },

      {
        id: "vimium-jump",
        name: "jump",
        description: t("vimium.cmd.jump"),
        action: (args) => {
          if (args.length === 0) return;
          const tabType = resolveTabType(args[0]);
          if (tabType) {
            const pane = getActiveTabPane();
            if (pane) {
              const existingTab = useTabsStore.getState().tabs.find((t) => t.type === tabType);
              if (existingTab && pane.tabIds.includes(existingTab.id)) {
                setActiveTab(pane.id, existingTab.id);
                return;
              }
            }
            openTabByType(tabType);
          }
        },
        aliases: ["j", "cd"],
      },
      {
        id: "vimium-recent",
        name: "recent",
        description: t("vimium.cmd.recent"),
        action: (args) => {
          if (args.length > 0) {
            // Open command palette with recent filter
            const store = useUIStore.getState();
            store.setCommandPaletteQuery("");
            store.setCommandPaletteOpen(true);
          } else {
            const store = useUIStore.getState();
            store.setCommandPaletteQuery("");
            store.setCommandPaletteOpen(true);
          }
        },
        aliases: ["r", "history"],
      },
      {
        id: "vimium-focus",
        name: "focus",
        description: t("vimium.cmd.focus"),
        action: (args) => {
          const paneIds = useTabsStore.getState().getTabPaneIds();
          if (paneIds.length <= 1) return;
          const currentPaneId = paneIds[0];

          if (args.length > 0) {
            const dir = args[0].toLowerCase();
            const rootPane = useTabsStore.getState().rootPane;
            if (rootPane.type !== "split") return;
            // Find current pane index and navigate directionally
            const currentIdx = rootPane.children.findIndex((c) => c.id === currentPaneId);
            if (currentIdx === -1) return;
            let targetIdx = -1;
            if ((dir === "right" || dir === "down") && currentIdx < rootPane.children.length - 1) {
              targetIdx = currentIdx + 1;
            } else if ((dir === "left" || dir === "up") && currentIdx > 0) {
              targetIdx = currentIdx - 1;
            }
            if (targetIdx >= 0 && rootPane.children[targetIdx]?.type === "tabs") {
              const targetPane = rootPane.children[targetIdx] as import("../../stores/tabsStore").TabPane;
              if (targetPane.activeTabId) {
                setActiveTab(targetPane.id, targetPane.activeTabId);
              }
            }
          } else {
            // Cycle to next pane
            const rootPane = useTabsStore.getState().rootPane;
            if (rootPane.type !== "split") return;
            const currentIdx = rootPane.children.findIndex((c) => c.id === currentPaneId);
            const nextIdx = (currentIdx + 1) % rootPane.children.length;
            const nextPane = rootPane.children[nextIdx];
            if (nextPane?.type === "tabs" && nextPane.activeTabId) {
              setActiveTab(nextPane.id, nextPane.activeTabId);
            }
          }
        },
        aliases: ["fo"],
      },
      {
        id: "vimium-zen",
        name: "zen",
        description: t("vimium.cmd.zen"),
        action: () => {
          const el = document.querySelector(".app-shell");
          if (!el) return;
          el.toggleAttribute("data-zen");
        },
        aliases: ["z"],
      },

      {
        id: "vimium-qall",
        name: "qall",
        description: t("vimium.cmd.qall"),
        action: () => {
          useTabsStore.getState().closeAllTabs();
          openTabByType("dashboard");
        },
        aliases: ["qa", "q"],
      },
      {
        id: "vimium-wqall",
        name: "wqall",
        description: t("vimium.cmd.wqall"),
        action: () => {
          useTabsStore.getState().saveTabs();
          useTabsStore.getState().closeAllTabs();
          openTabByType("dashboard");
        },
        aliases: ["wqa", "xall", "xa"],
      },
      {
        id: "vimium-reload",
        name: "reload",
        description: t("vimium.cmd.reload"),
        action: () => window.location.reload(),
        aliases: ["rld"],
      },
      {
        id: "vimium-theme",
        name: "theme",
        description: t("vimium.cmd.theme"),
        action: (args) => {
          const settings = useSettingsStore.getState().settings;
          if (args.length > 0) {
            const val = args[0].toLowerCase();
            if (val === "light" || val === "dark" || val === "system") {
              useSettingsStore.getState().updateSettingsCategory("appearance", { theme: val });
            }
          } else {
            const next = settings.appearance.theme === "dark" ? "light" : "dark";
            useSettingsStore.getState().updateSettingsCategory("appearance", { theme: next });
          }
        },
        aliases: ["th"],
      },
      // --- Capture commands (extract / flashcard / highlight) ---
      {
        id: "vimium-extract",
        name: "extract",
        description: "Create an instant extract from the current selection",
        action: () => { window.dispatchEvent(new CustomEvent("vimium:extract")); },
        aliases: ["ex"],
        requiresSelection: true,
      },
      {
        id: "vimium-extract-dialog",
        name: "extract-dialog",
        description: "Open the extract dialog for the current selection",
        action: () => { window.dispatchEvent(new CustomEvent("vimium:extract-dialog")); },
        aliases: ["exd"],
        requiresSelection: true,
      },
      {
        id: "vimium-flashcard",
        name: "flashcard",
        description: "Create a flashcard from the current selection (default type)",
        action: () => { window.dispatchEvent(new CustomEvent("vimium:flashcard")); },
        aliases: ["fc"],
        requiresSelection: true,
      },
      {
        id: "vimium-cloze",
        name: "cloze",
        description: "Create a cloze flashcard from the current selection",
        action: () => { window.dispatchEvent(new CustomEvent("vimium:flashcard", { detail: { cardType: "cloze" } })); },
        aliases: ["cl"],
        requiresSelection: true,
        cardType: "cloze",
      },
      {
        id: "vimium-qa",
        name: "qa",
        description: "Create a Q&A flashcard from the current selection",
        action: () => { window.dispatchEvent(new CustomEvent("vimium:flashcard", { detail: { cardType: "qa" } })); },
        requiresSelection: true,
        cardType: "qa",
      },
      {
        id: "vimium-mchoice",
        name: "mchoice",
        description: "Create a multiple-choice flashcard from the current selection",
        action: () => { window.dispatchEvent(new CustomEvent("vimium:flashcard", { detail: { cardType: "multiple-choice" } })); },
        aliases: ["mc"],
        requiresSelection: true,
        cardType: "multiple-choice",
      },
      {
        id: "vimium-extract2card",
        name: "extract2card",
        description: "Extract the selection then generate flashcards from it",
        action: () => { window.dispatchEvent(new CustomEvent("vimium:extract2card")); },
        aliases: ["e2c"],
        requiresSelection: true,
      },
      {
        id: "vimium-highlight",
        name: "highlight",
        description: "Highlight the current selection (optionally with a named color)",
        action: (args) => { window.dispatchEvent(new CustomEvent("vimium:highlight", { detail: { color: args[0] } })); },
        aliases: ["hl"],
        requiresSelection: true,
      },
      {
        id: "vimium-deck",
        name: "deck",
        description: "Set the deck tag for the next created flashcard (usage: :deck <name>)",
        action: (args) => {
          const tag = args.join(" ").trim();
          if (tag) {
            useVimModeStore.getState().setNextDeckTag(tag);
          }
        },
      },
    ];
    return cmds;
  }, [addTab, openWebUrl, activePaneTabId, closeTab, reopenLastClosedTab, setActiveTab]);

  const vimiumActions = useMemo(() => ({
    goBack: () => window.history.back(),
    goForward: () => window.history.forward(),
    reload: () => window.location.reload(),
    openUrl: openWebUrl,
    nextTab: () => {
      // Find first tab pane and cycle through its tabs
      const paneIds = useTabsStore.getState().getTabPaneIds();
      if (paneIds.length === 0) return;
      const firstPane = useTabsStore.getState().findPaneById(paneIds[0]);
      if (firstPane && firstPane.type === "tabs") {
        const currentIndex = firstPane.tabIds.findIndex((id) => id === firstPane.activeTabId);
        const nextIndex = (currentIndex + 1) % firstPane.tabIds.length;
        if (firstPane.tabIds[nextIndex]) {
          setActiveTab(firstPane.id, firstPane.tabIds[nextIndex]);
        }
      }
    },
    previousTab: () => {
      // Find first tab pane and cycle through its tabs
      const paneIds = useTabsStore.getState().getTabPaneIds();
      if (paneIds.length === 0) return;
      const firstPane = useTabsStore.getState().findPaneById(paneIds[0]);
      if (firstPane && firstPane.type === "tabs") {
        const currentIndex = firstPane.tabIds.findIndex((id) => id === firstPane.activeTabId);
        const prevIndex = currentIndex <= 0 ? firstPane.tabIds.length - 1 : currentIndex - 1;
        if (firstPane.tabIds[prevIndex]) {
          setActiveTab(firstPane.id, firstPane.tabIds[prevIndex]);
        }
      }
    },
    firstTab: () => {
      // Find first tab pane and select its first tab
      const paneIds = useTabsStore.getState().getTabPaneIds();
      if (paneIds.length === 0) return;
      const firstPane = useTabsStore.getState().findPaneById(paneIds[0]);
      if (firstPane && firstPane.type === "tabs" && firstPane.tabIds.length > 0) {
        setActiveTab(firstPane.id, firstPane.tabIds[0]);
      }
    },
    lastTab: () => {
      // Find first tab pane and select its last tab
      const paneIds = useTabsStore.getState().getTabPaneIds();
      if (paneIds.length === 0) return;
      const firstPane = useTabsStore.getState().findPaneById(paneIds[0]);
      if (firstPane && firstPane.type === "tabs" && firstPane.tabIds.length > 0) {
        setActiveTab(firstPane.id, firstPane.tabIds[firstPane.tabIds.length - 1]);
      }
    },
    closeTab: () => {
      if (activePaneTabId) closeTab(activePaneTabId);
    },
    restoreTab: () => reopenLastClosedTab(),
  }), [activePaneTabId, closeTab, reopenLastClosedTab, setActiveTab]);

  const renderLayout = () => {
    // Toolbar on the left
    if (toolbarPosition === "left") {
      return (
        <div className="app-shell relative isolate flex w-full overflow-hidden bg-background">
          <ThemeBackdrop />

          <div className="relative z-10 flex w-full overflow-hidden">
            {/* Toolbar - Left side - Hidden on mobile */}
            <div className="flex-shrink-0 hidden md:block h-full">
              <Toolbar position="left" />
            </div>

            {/* Tabbed Interface - takes remaining space */}
            <div className="flex-1 min-w-0 h-full" data-vimium-scroll>
              <Tabs />
            </div>

            {/* Global Command Center */}
            <CommandCenter />
          </div>
        </div>
      );
    }

    // Toolbar on the right
    if (toolbarPosition === "right") {
      return (
        <div className="app-shell relative isolate flex w-full overflow-hidden bg-background">
          <ThemeBackdrop />

          <div className="relative z-10 flex w-full overflow-hidden">
            {/* Tabbed Interface - takes remaining space */}
            <div className="flex-1 min-w-0 h-full" data-vimium-scroll>
              <Tabs />
            </div>

            {/* Toolbar - Right side - Hidden on mobile */}
            <div className="flex-shrink-0 hidden md:block h-full">
              <Toolbar position="right" />
            </div>

            {/* Global Command Center */}
            <CommandCenter />
          </div>
        </div>
      );
    }

    // Default: Toolbar on top
    return (
      <div className="app-shell relative isolate flex flex-col w-full overflow-hidden bg-background">
        <ThemeBackdrop />

        <div className="relative z-10 flex flex-1 min-h-0 flex-col">
          {/* Toolbar - Fixed at top - Hidden on mobile */}
          <div className="flex-shrink-0 hidden md:block">
            <Toolbar position="top" />
          </div>

          {/* Tabbed Interface - Below toolbar - must grow to fill remaining height */}
          <div className="flex-1 min-h-0 h-full" data-vimium-scroll>
            <Tabs />
          </div>

          {/* Global Command Center */}
          <CommandCenter />
        </div>
      </div>
    );
  };

  return (
    <MobileLayoutWrapper>
      <VimiumNavigationProvider
        enabled={vimiumEnabled}
        commands={vimiumCommands}
        actions={vimiumActions}
      >
        {renderLayout()}
        <KeyboardShortcutsHelp
          isOpen={isShortcutsHelpOpen}
          onClose={() => setIsShortcutsHelpOpen(false)}
        />
        <PasteExtractDialog
          isOpen={useUIStore((s) => s.pasteExtractDialogOpen)}
          onClose={() => useUIStore.getState().setPasteExtractDialogOpen(false)}
        />
        <ImageSaveOverlay />
      </VimiumNavigationProvider>
    </MobileLayoutWrapper>
  );
}
