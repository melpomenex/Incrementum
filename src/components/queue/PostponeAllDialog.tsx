import { useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { useQueueStore } from "../../stores/queueStore";
import type { PostponeStats } from "../../lib/postpone";

interface PostponeAllDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PostponeAllDialog({ isOpen, onClose }: PostponeAllDialogProps) {
  const { t } = useI18n();
  const postponeAllItems = useQueueStore((s) => s.postponeAllItems);
  const postponeLoading = useQueueStore((s) => s.postponeLoading);
  const postponeStats = useQueueStore((s) => s.postponeStats);
  const [confirmed, setConfirmed] = useState(false);

  if (!isOpen) return null;

  const handlePostpone = async () => {
    await postponeAllItems();
    setConfirmed(true);
  };

  const handleClose = () => {
    setConfirmed(false);
    useQueueStore.getState().postponeStats = null;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <CalendarClock className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">
              {confirmed
                ? t("postpone.postponeComplete")
                : t("postpone.postponeAllTitle")}
            </h3>
          </div>

          {!confirmed ? (
            <>
              <p className="text-sm text-muted-foreground mb-6">
                {t("postpone.postponeAllDescription")}
              </p>

              <div className="flex justify-end gap-2">
                <button
                  onClick={handleClose}
                  disabled={postponeLoading}
                  className="px-4 py-2 bg-card border border-border text-foreground rounded-md hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handlePostpone}
                  disabled={postponeLoading}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                >
                  {postponeLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t("postpone.postpone")}
                </button>
              </div>
            </>
          ) : (
            <>
              {postponeStats && (
                <PostponeSummary stats={postponeStats} />
              )}

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
                >
                  {t("common.ok")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PostponeSummary({ stats }: { stats: PostponeStats }) {
  const { t } = useI18n();

  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between text-foreground">
        <span>{t("postpone.itemsPostponed")}</span>
        <span className="font-medium">{stats.postponedCount}</span>
      </div>
      <div className="flex justify-between text-foreground">
        <span>{t("postpone.averageIncrease")}</span>
        <span className="font-medium">{t("postpone.days", { count: stats.averageIncrease })}</span>
      </div>
      {stats.skippedCount > 0 && (
        <div className="flex justify-between text-muted-foreground">
          <span>{t("postpone.itemsSkipped")}</span>
          <span>{stats.skippedCount}</span>
        </div>
      )}
    </div>
  );
}
