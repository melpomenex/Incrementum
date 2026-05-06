import { useState } from "react";
import { useTabsStore } from "../stores";
import { useDocumentStore } from "../stores";
import { useUIStore } from "../stores";
import { useSettingsStore } from "../stores";
import { captureAndSaveScreenshot } from "../utils/screenshotCaptureFlow";
import { useI18n } from "../lib/i18n";
import {
  ReviewTab,
  DashboardTab,
  ContinueReadingTab,
  SettingsTab,
  DocumentViewer,
  WebBrowserTab,
  RSSReader,
  DocumentQATab,
  NotebookLMTab,
} from "./tabs/TabRegistry";
import { WebArticleImportDialog } from "./import/WebArticleImportDialog";
import { KnowledgeGraphPage } from "../pages/KnowledgeGraphPage";
import { KnowledgeSpherePage } from "../pages/KnowledgeSpherePage";
import { useQueueStore } from "../stores/queueStore";
import { useReviewStore } from "../stores/reviewStore";
import { useToast } from "./common/Toast";
import type { QueueItem } from "../types/queue";

import {
  FileUp,
  Link,
  BookMarked,
  BookOpen,
  Dices,
  Brain,
  Rss,
  LayoutDashboard,
  Network,
  Orbit,
  Compass,
  BotMessageSquare,
  Camera,
  Settings,
  Command,
  FileText,
  Newspaper,
  Monitor,
  MessageSquare,
  Sparkles,
} from "lucide-react";

export type ToolbarPosition = "top" | "left" | "right";

interface ToolbarButton {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut: string;
  action: () => void;
  backgroundAction?: () => void; // Action for middle-click (open in background)
  disabled?: boolean;
  group: number;
}

interface ToolbarButtonProps {
  button: ToolbarButton;
  orientation?: "horizontal" | "vertical";
}

function ToolbarButtonItem({ button, orientation = "horizontal" }: ToolbarButtonProps) {
  const Icon = button.icon;

  const handleAuxClick = (e: React.MouseEvent) => {
    // Middle-click (button 1)
    if (e.button === 1 && button.backgroundAction) {
      e.preventDefault();
      e.stopPropagation();
      button.backgroundAction();
    }
  };

  const isVertical = orientation === "vertical";

  return (
    <button
      onClick={button.action}
      onAuxClick={handleAuxClick}
      disabled={button.disabled}
      title={`${button.label} (${button.shortcut})`}
      data-toolbar-orientation={orientation}
      className={`
        toolbar-button relative rounded transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${button.disabled ? "text-muted-foreground" : "text-foreground"}
        ${isVertical ? "p-2.5 w-full flex justify-center" : "p-2"}
      `}
      aria-label={button.label}
    >
      <span className="toolbar-button-background" aria-hidden="true" />
      <span className="toolbar-button-indicator" aria-hidden="true" />
      <span className="toolbar-button-content">
        <Icon className={isVertical ? "w-5 h-5" : "w-5 h-5"} />
      </span>
      <span className="sr-only">{button.label}</span>
    </button>
  );
}

interface ToolbarProps {
  position?: ToolbarPosition;
}

export function Toolbar({ position = "top" }: ToolbarProps) {
  const addTab = useTabsStore((state) => state.addTab);
  const addTabInBackground = useTabsStore((state) => state.addTabInBackground);
  const openFilePickerAndImport = useDocumentStore((state) => state.openFilePickerAndImport);
  const loadDocuments = useDocumentStore((state) => state.loadDocuments);
  const setCommandPaletteOpen = useUIStore((state) => state.setCommandPaletteOpen);
  const queueFilterMode = useQueueStore((state) => state.queueFilterMode);
  const toast = useToast();
  const { t } = useI18n();

  const isVertical = position === "left" || position === "right";
  const [showUrlImportDialog, setShowUrlImportDialog] = useState(false);

  // Import File button
  const handleImportFile = async () => {
    const imported = await openFilePickerAndImport();
    if (imported.length > 0) {
      addTab({
        title: imported[0].title,
        icon: <FileText className="w-4 h-4 text-muted-foreground" />,
        type: "document-viewer",
        content: DocumentViewer,
        closable: true,
        data: { documentId: imported[0].id },
      });
    }
  };

  // Import URL button
  const handleImportUrl = () => {
    setShowUrlImportDialog(true);
  };

  // Read Next button
  const handleReadNext = async () => {
    try {
      const { loadQueue, loadDueDocumentsOnly, loadDueQueueItems } = useQueueStore.getState();
      switch (queueFilterMode) {
        case "due-today":
          await loadDueDocumentsOnly();
          break;
        case "due-all":
          await loadDueQueueItems();
          break;
        case "all-items":
        case "new-only":
        default:
          await loadQueue();
          break;
      }
      const { filteredItems, items } = useQueueStore.getState();
      const queueItems = filteredItems.length > 0 ? filteredItems : items;
      const nextItem = queueItems[0];
      if (!nextItem) {
        toast.info(t("toolbar.noItemsReady"), t("toolbar.noItemAvailable"));
        return;
      }
      await openQueueItem(nextItem);
    } catch (error) {
      toast.error(t("toolbar.readNextFailed"), error instanceof Error ? error.message : t("toolbar.couldNotOpenNext"));
    }
  };

  // Random Item button
  const handleRandomItem = async () => {
    try {
      const { loadQueue, loadDueDocumentsOnly, loadDueQueueItems } = useQueueStore.getState();
      switch (queueFilterMode) {
        case "due-today":
          await loadDueDocumentsOnly();
          break;
        case "due-all":
          await loadDueQueueItems();
          break;
        case "all-items":
        case "new-only":
        default:
          await loadQueue();
          break;
      }
      const { filteredItems, items } = useQueueStore.getState();
      const queueItems = filteredItems.length > 0 ? filteredItems : items;
      if (queueItems.length === 0) {
        toast.info(t("toolbar.noItemsReady"), t("toolbar.noItemAvailable"));
        return;
      }
      const randomItem = queueItems[Math.floor(Math.random() * queueItems.length)];
      await openQueueItem(randomItem);
    } catch (error) {
      toast.error(t("toolbar.randomItemFailed"), error instanceof Error ? error.message : t("toolbar.couldNotOpenRandom"));
    }
  };

  // Start Review button
  const handleStartReview = () => {
    addTab({
      title: "Review",
      icon: <Brain className="w-4 h-4" />,
      type: "review",
      content: ReviewTab,
      closable: true,
    });
  };

  const handleStartReviewBackground = () => {
    addTabInBackground({
      title: "Review",
      icon: "🎴",
      type: "review",
      content: ReviewTab,
      closable: true,
    });
  };

  // RSS button
  const handleRss = () => {
    addTab({
      title: "RSS Feeds",
      icon: <Newspaper className="w-4 h-4" />,
      type: "rss",
      content: RSSReader,
      closable: true,
    });
  };

  // Dashboard button
  const handleDashboard = () => {
    addTab({
      title: "Dashboard",
      icon: <LayoutDashboard className="w-4 h-4" />,
      type: "dashboard",
      content: DashboardTab,
      closable: false,
    });
  };

  const handleContinueReading = () => {
    addTab({
      title: "Continue Reading",
      icon: <BookMarked className="w-4 h-4" />,
      type: "continue-reading",
      content: ContinueReadingTab,
      closable: true,
    });
  };

  // Dashboard is already the default tab, so middle-click doesn't make much sense
  // But we'll still add the handler for consistency

  // Knowledge Graph button
  const handleKnowledgeGraph = () => {
    addTab({
      title: "Knowledge Network",
      icon: <Network className="w-4 h-4" />,
      type: "knowledge-network",
      content: KnowledgeGraphPage,
      closable: true,
    });
  };

  const handleKnowledgeGraphBackground = () => {
    addTabInBackground({
      title: "Knowledge Network",
      icon: "🕸️",
      type: "knowledge-network",
      content: KnowledgeGraphPage,
      closable: true,
    });
  };

  // Knowledge Sphere button (3D)
  const handleKnowledgeSphere = () => {
    addTab({
      title: "Knowledge Sphere",
      icon: <Orbit className="w-4 h-4" />,
      type: "knowledge-sphere",
      content: KnowledgeSpherePage,
      closable: true,
    });
  };

  const handleKnowledgeSphereBackground = () => {
    addTabInBackground({
      title: "Knowledge Sphere",
      icon: "🌐",
      type: "knowledge-sphere",
      content: KnowledgeSpherePage,
      closable: true,
    });
  };

  // Web Browser button
  const handleWebBrowser = () => {
    addTab({
      title: "Web Browser",
      icon: <Monitor className="w-4 h-4" />,
      type: "web-browser",
      content: WebBrowserTab,
      closable: true,
    });
  };

  const handleWebBrowserBackground = () => {
    addTabInBackground({
      title: "Web Browser",
      icon: "🌐",
      type: "web-browser",
      content: WebBrowserTab,
      closable: true,
    });
  };

  // Doc Q&A button
  const handleDocQA = () => {
    addTab({
      title: "Document Q&A",
      icon: <MessageSquare className="w-4 h-4" />,
      type: "doc-qa",
      content: DocumentQATab,
      closable: true,
    });
  };

  const handleDocQABackground = () => {
    addTabInBackground({
      title: "Document Q&A",
      icon: "🤖",
      type: "doc-qa",
      content: DocumentQATab,
      closable: true,
    });
  };

  // NotebookLM button
  const handleNotebookLM = () => {
    addTab({
      title: "NotebookLM",
      icon: <Sparkles className="w-4 h-4" />,
      type: "notebooklm",
      content: NotebookLMTab,
      closable: true,
    });
  };

  const handleNotebookLMBackground = () => {
    addTabInBackground({
      title: "NotebookLM",
      icon: "✨",
      type: "notebooklm",
      content: NotebookLMTab,
      closable: true,
    });
  };

  // Screenshot button
  const handleScreenshot = () => {
    void captureAndSaveScreenshot()
      .then(async () => {
        await loadDocuments();
      })
      .catch((error) => {
        console.error("Failed to capture screenshot:", error);
        alert(t("toolbar.screenshotFailed"));
      });
  };

  // Settings button
  const handleSettings = () => {
    addTab({
      title: "Settings",
      icon: <Settings className="w-4 h-4" />,
      type: "settings",
      content: SettingsTab,
      closable: true,
    });
  };

  const handleSettingsBackground = () => {
    addTabInBackground({
      title: "Settings",
      icon: "⚙️",
      type: "settings",
      content: SettingsTab,
      closable: true,
    });
  };

  // Command Palette button
  const handleCommandPalette = () => {
    setCommandPaletteOpen(true);
  };

  const openQueueItem = async (item: QueueItem) => {
    if (item.itemType === "document") {
      addTab({
        title: item.documentTitle,
        icon: <FileText className="w-4 h-4 text-muted-foreground" />,
        type: "document-viewer",
        content: DocumentViewer,
        closable: true,
        data: { documentId: item.documentId },
      });
      return;
    }

    if (item.itemType === "extract") {
      addTab({
        title: item.documentTitle,
        icon: <FileText className="w-4 h-4 text-muted-foreground" />,
        type: "document-viewer",
        content: DocumentViewer,
        closable: true,
        data: { documentId: item.documentId, initialViewMode: "extracts" },
      });
      return;
    }

    if (item.itemType === "learning-item") {
      addTab({
        title: "Review",
        icon: <Brain className="w-4 h-4" />,
        type: "review",
        content: ReviewTab,
        closable: true,
      });
      const { startReviewAtItem } = useReviewStore.getState();
      if (item.learningItemId || item.id) {
        await startReviewAtItem(item.learningItemId || item.id);
      }
      return;
    }

    if (item.documentId) {
      addTab({
        title: item.documentTitle,
        icon: <FileText className="w-4 h-4 text-muted-foreground" />,
        type: "document-viewer",
        content: DocumentViewer,
        closable: true,
        data: { documentId: item.documentId },
      });
      return;
    }

    console.warn("Unsupported queue item type for toolbar open:", item.itemType, item);
  };

  const buttons: ToolbarButton[] = [
    // Group 1: File Operations
    {
      id: "import-file",
      icon: FileUp,
      label: t("toolbar.importFile"),
      shortcut: "Ctrl+O",
      action: handleImportFile,
      group: 1,
    },
    {
      id: "import-url",
      icon: Link,
      label: t("toolbar.importUrl"),
      shortcut: "Ctrl+Shift+O",
      action: handleImportUrl,
      group: 1,
    },
    {
      id: "read-next",
      icon: BookMarked,
      label: t("toolbar.readNext"),
      shortcut: "",
      action: handleReadNext,
      group: 1,
    },
    {
      id: "random-item",
      icon: Dices,
      label: t("toolbar.randomItem"),
      shortcut: "",
      action: handleRandomItem,
      group: 1,
    },
    {
      id: "start-review",
      icon: Brain,
      label: t("toolbar.startReview"),
      shortcut: "",
      action: handleStartReview,
      backgroundAction: handleStartReviewBackground,
      group: 1,
    },
    // Group 2: RSS
    {
      id: "rss",
      icon: Rss,
      label: t("toolbar.rssFeeds"),
      shortcut: "",
      action: handleRss,
      group: 2,
    },
    // Group 3: Navigation
    {
      id: "dashboard",
      icon: LayoutDashboard,
      label: t("toolbar.dashboard"),
      shortcut: "Ctrl+1",
      action: handleDashboard,
      group: 3,
    },
    {
      id: "continue-reading",
      icon: BookOpen,
      label: t("toolbar.continueReading"),
      shortcut: "Ctrl+2",
      action: handleContinueReading,
      group: 3,
    },
    {
      id: "knowledge-graph",
      icon: Network,
      label: t("toolbar.knowledgeGraph"),
      shortcut: "Ctrl+4",
      action: handleKnowledgeGraph,
      backgroundAction: handleKnowledgeGraphBackground,
      group: 3,
    },
    {
      id: "knowledge-sphere",
      icon: Orbit,
      label: t("toolbar.knowledgeSphere"),
      shortcut: "Ctrl+5",
      action: handleKnowledgeSphere,
      backgroundAction: handleKnowledgeSphereBackground,
      group: 3,
    },
    {
      id: "web-browser",
      icon: Compass,
      label: t("toolbar.webBrowser"),
      shortcut: "Ctrl+6",
      action: handleWebBrowser,
      backgroundAction: handleWebBrowserBackground,
      group: 3,
    },
    {
      id: "doc-qa",
      icon: BotMessageSquare,
      label: t("toolbar.documentQA"),
      shortcut: "",
      action: handleDocQA,
      backgroundAction: handleDocQABackground,
      group: 3,
    },
    {
      id: "notebooklm",
      icon: Sparkles,
      label: t("toolbar.notebooklm"),
      shortcut: "",
      action: handleNotebookLM,
      backgroundAction: handleNotebookLMBackground,
      group: 3,
    },
    {
      id: "screenshot",
      icon: Camera,
      label: t("toolbar.screenshot"),
      shortcut: "Ctrl+Shift+S",
      action: handleScreenshot,
      group: 3,
    },
    // Group 4: Settings & Tools
    {
      id: "settings",
      icon: Settings,
      label: t("toolbar.settings"),
      shortcut: "Ctrl+,",
      action: handleSettings,
      backgroundAction: handleSettingsBackground,
      group: 4,
    },
    {
      id: "command-palette",
      icon: Command,
      label: t("toolbar.commandPalette"),
      shortcut: "Ctrl+K",
      action: handleCommandPalette,
      group: 4,
    },
  ];

  // Get unique group numbers
  const groups = Array.from(new Set(buttons.map((b) => b.group))).sort();

  const toolbarContent = isVertical ? (
    <div className={`h-full bg-card ${position === "left" ? "border-r border-border" : "border-l border-border"} flex flex-col`}>
      <div className="flex-1 overflow-y-auto py-2 px-1">
        <div className="flex flex-col gap-1">
          {groups.map((group, groupIndex) => (
            <div key={group} className="flex flex-col">
              {buttons
                .filter((b) => b.group === group)
                .map((button) => (
                  <ToolbarButtonItem key={button.id} button={button} orientation="vertical" />
                ))}
              {groupIndex < groups.length - 1 && (
                <div className="w-6 h-px bg-border mx-auto my-1" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  ) : (
    <div className="sticky top-0 z-40 bg-card border-b border-border">
      <div className="flex items-center px-2 py-1 gap-1">
        {groups.map((group, groupIndex) => (
          <div key={group} className="flex items-center gap-1">
            {buttons
              .filter((b) => b.group === group)
              .map((button) => (
                <ToolbarButtonItem key={button.id} button={button} />
              ))}
            {groupIndex < groups.length - 1 && (
              <div className="w-px h-6 bg-border mx-1" />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {toolbarContent}
      <WebArticleImportDialog
        isOpen={showUrlImportDialog}
        onClose={() => setShowUrlImportDialog(false)}
        onOpenDocument={(doc) => {
          addTab({
            title: doc.title,
            icon: <FileText className="w-4 h-4 text-muted-foreground" />,
            type: "document-viewer",
            content: DocumentViewer,
            closable: true,
            data: { documentId: doc.id },
          });
        }}
      />
    </>
  );
}

export function ToolbarWithSettings() {
  const toolbarPosition = useSettingsStore((state) => state.settings.interface.toolbarPosition);
  return <Toolbar position={toolbarPosition} />;
}
