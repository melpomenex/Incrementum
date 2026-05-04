import { ReviewQueueView } from "../review/ReviewQueueView";
import { MobileQueueView } from "../mobile/MobileQueueView";
import { ScheduleView } from "../schedule/ScheduleView";
import { MobileScheduleView } from "../schedule/MobileScheduleView";
import { useReviewStore, useTabsStore } from "../../stores";
import type { QueueItem } from "../../types/queue";
import { ReviewTab, DocumentViewer } from "./TabRegistry";
import { QueueScrollPage } from "../../pages/QueueScrollPage";
import { usePaneId } from "../common/Tabs";
import { getDeviceInfo } from "../../lib/pwa";
import { isTauri } from "../../lib/tauri";
import { Brain, FileText, Layers, CalendarDays } from "lucide-react";

export function QueueTab() {
  const { addTab } = useTabsStore();
  const paneId = usePaneId();
  const deviceInfo = getDeviceInfo();
  const isMobile = !isTauri() && (deviceInfo.isMobile || deviceInfo.isTablet);

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
      icon: <FileText className="w-4 h-4 text-muted-foreground" />,
      type: "document-viewer",
      content: DocumentViewer,
      closable: true,
      data: { documentId: item.documentId },
    }, paneId);
  };

  const handleOpenScrollMode = () => {
    addTab({
      title: "Scroll Mode",
      icon: <Layers className="w-4 h-4" />,
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
