/**
 * Confirmation Dialog Component
 * Used for destructive actions like delete, bulk delete, etc.
 */

import { useState } from "react";
import {
  Check,
  Trash,
  Warning,
  X,
} from "@phosphor-icons/react";
import { useI18n } from "../../lib/i18n";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";

export type ConfirmDialogVariant = "danger" | "warning" | "info";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  details?: string[];
  itemName?: string;
  itemCount?: number;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "warning",
  details,
  itemName = "item",
  itemCount = 1,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const { delete: deleteHaptic } = useHapticFeedback();

  if (!isOpen) return null;

  const variantConfig = {
    danger: {
      iconBg: "bg-red-500/20",
      iconColor: "text-red-500",
      confirmBg: "bg-red-500 hover:bg-red-600",
      borderColor: "border-red-500/30",
    },
    warning: {
      iconBg: "bg-amber-500/20",
      iconColor: "text-amber-500",
      confirmBg: "bg-amber-500 hover:bg-amber-600 text-white",
      borderColor: "border-amber-500/30",
    },
    info: {
      iconBg: "bg-blue-500/20",
      iconColor: "text-blue-500",
      confirmBg: "bg-primary hover:bg-primary/90",
      borderColor: "border-primary/30",
    },
  };

  const config = variantConfig[variant];

  const Icon = variant === "danger" ? Trash : variant === "warning" ? Warning : Check;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className={`bg-card border ${config.borderColor} rounded-2xl shadow-2xl max-w-md w-full animate-glass-scale-in`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        {/* Header */}
        <div className="relative p-6 border-b border-border">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-muted rounded-full transition-colors"
            aria-label={t("common.close")}
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>

          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 ${config.iconBg} rounded-xl flex items-center justify-center`}>
              <Icon className={`w-6 h-6 ${config.iconColor}`} />
            </div>
            <div>
              <h2 id="confirm-title" className="text-xl font-bold text-foreground">
                {title}
              </h2>
              {itemCount > 1 && (
                <p className="text-sm text-muted-foreground">
                  {t("confirm.itemsSelected", { count: itemCount })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p id="confirm-message" className="text-muted-foreground mb-4">
            {message}
          </p>

          {/* Details list */}
          {details && details.length > 0 && (
            <div className="bg-muted/30 rounded-lg p-3 mb-4 max-h-40 overflow-y-auto">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                {t("confirm.itemsAffectedLabel", { itemName })}:
              </p>
              <ul className="space-y-1">
                {details.slice(0, 10).map((detail, index) => (
                  <li key={index} className="text-sm text-foreground truncate">
                    • {detail}
                  </li>
                ))}
                {details.length > 10 && (
                  <li className="text-sm text-muted-foreground">
                    {t("confirm.andMore", { count: details.length - 10 })}
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Warning message for destructive actions */}
          {variant === "danger" && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <Warning className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">
                {t("confirm.dangerWarning", { target: itemCount > 1 ? t("confirm.allSelectedItems") : t("confirm.thisItem") })}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 min-h-[44px] border border-border rounded-lg text-foreground hover:bg-muted transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              if (variant === "danger") deleteHaptic();
              onConfirm();
              onClose();
            }}
            className={`flex-1 px-4 py-2.5 min-h-[44px] ${config.confirmBg} text-primary-foreground rounded-lg transition-colors flex items-center justify-center gap-2`}
          >
            {variant === "danger" && <Trash className="w-4 h-4" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for managing confirmation dialogs
 */
export function useConfirmDialog() {
  const [state, setState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: ConfirmDialogVariant;
    confirmLabel?: string;
    details?: string[];
    itemName?: string;
    itemCount?: number;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    variant: "warning",
  });

  const confirm = (
    options: {
      title: string;
      message: string;
      onConfirm: () => void;
      variant?: ConfirmDialogVariant;
      confirmLabel?: string;
      details?: string[];
      itemName?: string;
      itemCount?: number;
    }
  ) => {
    setState({
      isOpen: true,
      title: options.title,
      message: options.message,
      onConfirm: options.onConfirm,
      variant: options.variant || "warning",
      confirmLabel: options.confirmLabel,
      details: options.details,
      itemName: options.itemName,
      itemCount: options.itemCount,
    });
  };

  const close = () => {
    setState((prev) => ({ ...prev, isOpen: false }));
  };

  return {
    isOpen: state.isOpen,
    title: state.title,
    message: state.message,
    onConfirm: state.onConfirm,
    variant: state.variant,
    confirmLabel: state.confirmLabel,
    details: state.details,
    itemName: state.itemName,
    itemCount: state.itemCount,
    confirm,
    close,
  };
}

export default ConfirmDialog;
