import { useState } from "react";
import {
  Calendar,
  CircleNotch,
  DotsThreeVertical,
  Play,
  Trash,
} from "@phosphor-icons/react";
import type { QueueItem } from "../../types/queue";
import { useI18n } from "../../lib/i18n";
import { useQueueStore } from "../../stores/queueStore";

interface QueueContextMenuProps {
  item: QueueItem;
  onDelete: (id: string) => Promise<void>;
  onStartReview: (item: QueueItem) => void;
}

export function QueueContextMenu({ item, onDelete, onStartReview }: QueueContextMenuProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [showPostponeConfirm, setShowPostponeConfirm] = useState(false);
  const [postponeResult, setPostponeResult] = useState<{ increase: number; newInterval: number } | null>(null);
  const [postponeLoading, setPostponeLoading] = useState(false);
  const postponeItemSmart = useQueueStore((s) => s.postponeItemSmart);

  const canPostpone = item.itemType === "learning-item" || item.itemType === "document";

  const handleSmartPostpone = async () => {
    setPostponeLoading(true);
    try {
      const result = await postponeItemSmart(item);
      setPostponeResult(result);
      setShowPostponeConfirm(true);
    } catch (error) {
      console.error("Failed to compute postpone:", error);
    } finally {
      setPostponeLoading(false);
      setIsOpen(false);
    }
  };

  const confirmPostpone = () => {
    setShowPostponeConfirm(false);
    setPostponeResult(null);
  };

  const handleDelete = async () => {
    if (confirm(t("delete.deleteQueueItemConfirm", { title: item.documentTitle }))) {
      try {
        await onDelete(item.id);
        setIsOpen(false);
      } catch (error) {
        console.error("Failed to delete item:", error);
      }
    }
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 rounded hover:bg-muted transition-colors"
          title={t("delete.moreOptions")}
        >
          <DotsThreeVertical className="w-4 h-4 text-muted-foreground" />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
              onKeyDown={(e) => { if (e.key === 'Escape') setIsOpen(false); }}
              role="button"
              tabIndex={-1}
            />
            <div className="absolute right-0 z-20 w-48 bg-card border border-border rounded-lg shadow-lg py-1">
              <button
                onClick={() => {
                  onStartReview(item);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                {t("delete.startReview")}
              </button>

              {canPostpone && (
                <button
                  onClick={handleSmartPostpone}
                  disabled={postponeLoading}
                  className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {postponeLoading ? (
                    <CircleNotch className="w-4 h-4 animate-spin" />
                  ) : (
                    <Calendar className="w-4 h-4" />
                  )}
                  {t("delete.postpone")}
                </button>
              )}

              <button
                onClick={handleDelete}
                className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2"
              >
                <Trash className="w-4 h-4" />
                {t("common.delete")}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Postpone confirmation dialog */}
      {showPostponeConfirm && postponeResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-sm">
            <div className="p-4">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {t("postpone.itemPostponed")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("postpone.itemPostponedDescription", {
                  days: postponeResult.increase,
                  newInterval: postponeResult.newInterval,
                })}
              </p>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={confirmPostpone}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
                >
                  {t("common.ok")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
