import { ReviewQueueView } from "../components/review/ReviewQueueView";
import { useReviewStore, useTabsStore } from "../stores";
import { DocumentViewer, ReviewTab } from "../components/tabs/TabRegistry";
import type { QueueItem } from "../types/queue";
import { QueueScrollPage } from "./QueueScrollPage";
import { Brain, Stack, TextT } from "@phosphor-icons/react";
import { useI18n } from "../lib/i18n";

export function QueuePage() {
  const { t } = useI18n();
  const { addTab } = useTabsStore();

  const handleStartReview = (itemId?: string) => {
    if (itemId) {
      void useReviewStore.getState().startReviewAtItem(itemId);
    }
    addTab({
      title: t("review.title"),
      icon: <Brain className="w-4 h-4" />,
      type: "review",
      content: ReviewTab,
      closable: true,
    });
  };

  const handleOpenDocument = (item: QueueItem) => {
    addTab({
      title: item.documentTitle,
      icon: <TextT className="w-4 h-4 text-muted-foreground" />,
      type: "document-viewer",
      content: DocumentViewer,
      closable: true,
      data: { documentId: item.documentId },
    });
  };

  const handleOpenScrollMode = () => {
    addTab({
      title: t("queue.scrollMode"),
      icon: <Stack className="w-4 h-4" />,
      type: "queue-scroll",
      content: QueueScrollPage,
      closable: true,
    });
  };

  return (
    <ReviewQueueView
      onStartReview={handleStartReview}
      onOpenDocument={handleOpenDocument}
      onOpenScrollMode={handleOpenScrollMode}
    />
  );
}
