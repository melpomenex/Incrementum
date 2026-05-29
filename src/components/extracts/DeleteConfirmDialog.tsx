import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { deleteExtract, Extract } from "../../api/extracts";
import { useI18n } from "../../lib/i18n";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";

interface DeleteConfirmDialogProps {
  extract: Extract | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (extractId: string) => void;
}

export function DeleteConfirmDialog({
  extract,
  isOpen,
  onClose,
  onDelete,
}: DeleteConfirmDialogProps) {
  const { t } = useI18n();
  const { delete: deleteHaptic } = useHapticFeedback();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!extract) return;

    deleteHaptic();
    setIsDeleting(true);
    setError(null);

    try {
      await deleteExtract(extract.id);
      onDelete?.(extract.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("extracts.failedToDelete"));
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !extract) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h2 className="text-lg font-semibold text-foreground">
              {t("extracts.deleteTitle")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-foreground mb-4">
            {t("extracts.deleteConfirm")}
          </p>

          {/* Extract Preview */}
          <div className="p-3 bg-muted/30 border border-border rounded-md mb-4">
            <div className="text-sm text-muted-foreground mb-1">
              {extract.category && (
                <span className="inline-block px-2 py-0.5 bg-primary/10 text-primary rounded text-xs mr-2">
                  {extract.category}
                </span>
              )}
              {extract.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-block px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs mr-1"
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="text-sm text-foreground line-clamp-3">
              {extract.content}
            </p>
          </div>

          {/* Warning */}
          <div className="p-3 bg-destructive/10 border border-destructive rounded-md">
            <p className="text-sm text-destructive">
              <strong>{t("extracts.warning")}:</strong> {t("extracts.deleteWarning")}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive text-destructive rounded-md text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 bg-card border border-border text-foreground rounded-md hover:bg-muted transition-colors disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-opacity disabled:opacity-50"
          >
            {isDeleting ? t("extracts.deleting") : t("extracts.deleteTitle")}
          </button>
        </div>
      </div>
    </div>
  );
}
