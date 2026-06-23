import { ReviewQueueView } from "../review/ReviewQueueView";
import { MobileQueueView } from "../mobile/MobileQueueView";
import { useReviewStore, useTabsStore } from "../../stores";
import type { QueueItem } from "../../types/queue";
import { ReviewTab, DocumentViewer } from "./TabRegistry";
import { QueueScrollPage } from "../../pages/QueueScrollPage";
import { usePaneId } from "../common/Tabs";
import { useMobileShell } from "../../hooks/useMobileShell";
import { Brain, Stack, TextT } from "@phosphor-icons/react";

export function QueueTab() {
  const { addTab } = useTabsStore();
  const paneId = usePaneId();
  const isMobile = useMobileShell();

  const handleStartReview = (itemId?: string) => {
    if (itemId) {
      void useReviewStore.getState().startReviewAtItem(itemId);
    }
    addTab({
      title: "Review",
      icon: <Brain className="w-4 h-4" />,
      type: "review",
      content: ReviewTab,
      closable: true,
    }, paneId);
  };

  const handleOpenDocument = (item: QueueItem) => {
    addTab({
      title: item.documentTitle,
      icon: <TextT className="w-4 h-4 text-muted-foreground" />,
      type: "document-viewer",
      content: DocumentViewer,
      closable: true,
      data: { documentId: item.documentId },
    }, paneId);
  };

  const handleOpenScrollMode = () => {
    addTab({
      title: "Scroll Mode",
      icon: <Stack className="w-4 h-4" />,
      type: "queue-scroll",
      content: QueueScrollPage,
      closable: true,
    }, paneId);
  };

  // Use mobile-optimized view on mobile devices
  if (isMobile) {
    return (
      <MobileQueueView
        onStartReview={handleStartReview}
        onOpenDocument={handleOpenDocument}
        onOpenScrollMode={handleOpenScrollMode}
      />
    );
  }

  return (
    <ReviewQueueView
      onStartReview={handleStartReview}
      onOpenDocument={handleOpenDocument}
      onOpenScrollMode={handleOpenScrollMode}
    />
  );
}
