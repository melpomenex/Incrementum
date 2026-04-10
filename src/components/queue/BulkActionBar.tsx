import { Loader2, Pause, Play, Trash2, X } from "lucide-react";
import { useI18n } from "../../lib/i18n";

interface BulkActionBarProps {
  selectedCount: number;
  isLoading: boolean;
  onSuspend: () => void;
  onUnsuspend: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
}

export function BulkActionBar({
  selectedCount,
  isLoading,
  onSuspend,
  onUnsuspend,
  onDelete,
  onClearSelection,
}: BulkActionBarProps) {
  const { t } = useI18n();
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="sticky top-0 z-10 p-4 bg-primary/10 border border-primary/30 rounded-lg mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">
            {t("queue.selectedCount", { count: selectedCount })}
          </span>

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t("common.processing")}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSuspend}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-50 text-sm"
            title={t("bulkAction.suspendSelected")}
          >
            <Pause className="w-3.5 h-3.5" />
            {t("queue.suspend")}
          </button>

          <button
            onClick={onUnsuspend}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-50 text-sm"
            title={t("bulkAction.unsuspendSelected")}
          >
            <Play className="w-3.5 h-3.5" />
            {t("queue.unsuspend")}
          </button>

          <button
            onClick={onDelete}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive border border-destructive/30 rounded-md hover:bg-destructive/20 transition-colors disabled:opacity-50 text-sm"
            title={t("bulkAction.deleteSelected")}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t("common.delete")}
          </button>

          <button
            onClick={onClearSelection}
            disabled={isLoading}
            className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-50"
            title={t("bulkAction.clearSelection")}
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
