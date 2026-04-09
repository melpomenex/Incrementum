import { useState } from "react";
import { MoreVertical, Play, Trash2, Calendar } from "lucide-react";
import type { QueueItem } from "../../types/queue";
import { useI18n } from "../../lib/i18n";

interface QueueContextMenuProps {
  item: QueueItem;
  onPostpone: (id: string, days: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onStartReview: (item: QueueItem) => void;
}

export function QueueContextMenu({ item, onPostpone, onDelete, onStartReview }: QueueContextMenuProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [showPostponeDialog, setShowPostponeDialog] = useState(false);

  const handlePostpone = async (days: number) => {
    try {
      await onPostpone(item.id, days);
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to postpone item:", error);
    }
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
          <MoreVertical className="w-4 h-4 text-muted-foreground" />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
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

              {item.itemType === "learning-item" && (
                <>
                  <button
                    onClick={() => {
                      setShowPostponeDialog(true);
                      setIsOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    {t("delete.postpone")}
                  </button>

                  <button
                    onClick={handleDelete}
                    className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t("common.delete")}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {showPostponeDialog && item.itemType === "learning-item" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-sm">
            <div className="p-4">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {t("delete.postponeItem")}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("delete.selectDays")}
              </p>

              <div className="grid grid-cols-3 gap-2">
                {[1, 3, 7, 14, 30].map((days) => (
                  <button
                    key={days}
                    onClick={() => {
                      handlePostpone(days);
                      setShowPostponeDialog(false);
                    }}
                    className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-md transition-colors"
                  >
                    {t("delete.day", { count: days })}
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowPostponeDialog(false)}
                  className="px-4 py-2 bg-card border border-border text-foreground rounded-md hover:bg-muted transition-colors"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
