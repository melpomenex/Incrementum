import { CalendarHeart, CircleNotch } from "@phosphor-icons/react";
import { useI18n } from "../../lib/i18n";
import { useQueueStore } from "../../stores/queueStore";

export function AutoPostponePrompt() {
  const { t } = useI18n();
  const showAutoPostponePrompt = useQueueStore((s) => s.showAutoPostponePrompt);
  const postponeAllItems = useQueueStore((s) => s.postponeAllItems);
  const postponeLoading = useQueueStore((s) => s.postponeLoading);
  const postponeStats = useQueueStore((s) => s.postponeStats);
  const dismissAutoPostponePrompt = useQueueStore((s) => s.dismissAutoPostponePrompt);
  const overdue = useQueueStore((s) => s.stats?.overdue ?? 0);

  if (!showAutoPostponePrompt) return null;

  const handlePostpone = async () => {
    await postponeAllItems();
  };

  const handleReviewNow = () => {
    dismissAutoPostponePrompt();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <CalendarHeart className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">
              {postponeStats
                ? t("postpone.postponeComplete")
                : t("postpone.autoPostponeTitle")}
            </h3>
          </div>

          {!postponeStats ? (
            <>
              <p className="text-sm text-muted-foreground mb-6">
                {t("postpone.autoPostponeDescription", { count: overdue })}
              </p>

              <div className="flex justify-end gap-2">
                <button
                  onClick={handleReviewNow}
                  disabled={postponeLoading}
                  className="px-4 py-2 bg-card border border-border text-foreground rounded-md hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {t("postpone.reviewNow")}
                </button>
                <button
                  onClick={handlePostpone}
                  disabled={postponeLoading}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                >
                  {postponeLoading && <CircleNotch className="w-4 h-4 animate-spin" />}
                  {t("postpone.postpone")}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-foreground">
                  <span>{t("postpone.itemsPostponed")}</span>
                  <span className="font-medium">{postponeStats.postponedCount}</span>
                </div>
                <div className="flex justify-between text-foreground">
                  <span>{t("postpone.averageIncrease")}</span>
                  <span className="font-medium">
                    {t("postpone.days", { count: postponeStats.averageIncrease })}
                  </span>
                </div>
                {postponeStats.skippedCount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("postpone.itemsSkipped")}</span>
                    <span>{postponeStats.skippedCount}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={dismissAutoPostponePrompt}
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
