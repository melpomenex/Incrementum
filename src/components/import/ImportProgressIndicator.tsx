/**
 * Import Progress Indicator
 * Shows detailed progress for document imports with percentage, status, and estimated time
 */

import {
  BookOpen,
  Check,
  CircleNotch,
  Globe,
  TextT,
  WarningCircle,
  YoutubeLogo,
} from "@phosphor-icons/react";

export type ImportType = "pdf" | "epub" | "youtube" | "web" | "arxiv" | "unknown";
export type ImportStatus = "pending" | "downloading" | "processing" | "extracting" | "complete" | "error";

interface ImportProgressIndicatorProps {
  fileName?: string;
  importType?: ImportType;
  current: number;
  total: number;
  status?: ImportStatus;
  statusMessage?: string;
  estimatedSecondsRemaining?: number;
  showPercentage?: boolean;
  compact?: boolean;
}

const importTypeConfig: Record<ImportType, { icon: typeof TextT; color: string; label: string }> = {
  pdf: { icon: TextT, color: "text-red-500", label: "PDF" },
  epub: { icon: BookOpen, color: "text-blue-500", label: "EPUB" },
  youtube: { icon: YoutubeLogo, color: "text-red-600", label: "YouTube" },
  web: { icon: Globe, color: "text-green-500", label: "Web" },
  arxiv: { icon: TextT, color: "text-orange-500", label: "ArXiv" },
  unknown: { icon: TextT, color: "text-muted-foreground", label: "Document" },
};

const statusConfig: Record<ImportStatus, { icon: typeof CircleNotch; color: string; label: string; animate?: boolean }> = {
  pending: { icon: CircleNotch, color: "text-muted-foreground", label: "Waiting", animate: true },
  downloading: { icon: CircleNotch, color: "text-blue-500", label: "Downloading", animate: true },
  processing: { icon: CircleNotch, color: "text-amber-500", label: "Processing", animate: true },
  extracting: { icon: CircleNotch, color: "text-purple-500", label: "Extracting text", animate: true },
  complete: { icon: Check, color: "text-green-500", label: "Complete" },
  error: { icon: WarningCircle, color: "text-red-500", label: "Error" },
};

export function ImportProgressIndicator({
  fileName,
  importType = "unknown",
  current,
  total,
  status = "processing",
  statusMessage,
  estimatedSecondsRemaining,
  showPercentage = true,
  compact = false,
}: ImportProgressIndicatorProps) {
  const typeConfig = importTypeConfig[importType];
  const statConfig = statusConfig[status];
  const TypeIcon = typeConfig.icon;
  const StatusIcon = statConfig.icon;
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
        <StatusIcon
          className={`w-5 h-5 ${statConfig.color} ${statConfig.animate ? "animate-spin" : ""}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground truncate">
              {fileName || "Importing..."}
            </span>
            {showPercentage && (
              <span className="text-muted-foreground ml-2">{percentage}%</span>
            )}
          </div>
          <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center`}>
          <TypeIcon className={`w-5 h-5 ${typeConfig.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">
              {fileName || `Importing ${typeConfig.label}`}
            </span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${statConfig.color} bg-current/10`}>
              {statConfig.label}
            </span>
          </div>
          {statusMessage && (
            <p className="text-xs text-muted-foreground mt-0.5">{statusMessage}</p>
          )}
        </div>
        <StatusIcon
          className={`w-5 h-5 ${statConfig.color} ${statConfig.animate ? "animate-spin" : ""}`}
        />
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {current} of {total} {total === 1 ? "item" : "items"}
          </span>
          {showPercentage && (
            <span className="font-medium text-foreground">{percentage}%</span>
          )}
        </div>

        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-300 rounded-full"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Estimated Time */}
        {estimatedSecondsRemaining && estimatedSecondsRemaining > 0 && status !== "complete" && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Estimated time remaining</span>
            <span>{formatTime(estimatedSecondsRemaining)}</span>
          </div>
        )}
      </div>

      {/* Status-specific messages */}
      {status === "downloading" && (
        <div className="mt-3 p-2 bg-blue-500/10 rounded-lg text-xs text-blue-600 dark:text-blue-400">
          Downloading content from the source. Please wait...
        </div>
      )}

      {status === "extracting" && (
        <div className="mt-3 p-2 bg-purple-500/10 rounded-lg text-xs text-purple-600 dark:text-purple-400">
          Extracting text and analyzing content. This may take a moment for large files.
        </div>
      )}

      {status === "complete" && (
        <div className="mt-3 p-2 bg-green-500/10 rounded-lg text-xs text-green-600 dark:text-green-400 flex items-center gap-2">
          <Check className="w-3 h-3" />
          Import completed successfully!
        </div>
      )}

      {status === "error" && (
        <div className="mt-3 p-2 bg-red-500/10 rounded-lg text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
          <WarningCircle className="w-3 h-3" />
          Import failed. Please try again.
        </div>
      )}
    </div>
  );
}

/**
 * Import Progress Overlay
 * Shows as a floating overlay during imports
 */
interface ImportProgressOverlayProps {
  imports: Array<{
    id: string;
    fileName?: string;
    importType: ImportType;
    current: number;
    total: number;
    status: ImportStatus;
    statusMessage?: string;
  }>;
  onClose?: () => void;
}

export function ImportProgressOverlay({ imports, onClose }: ImportProgressOverlayProps) {
  if (imports.length === 0) return null;

  const allComplete = imports.every((i) => i.status === "complete");
  const hasErrors = imports.some((i) => i.status === "error");

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 max-h-96 overflow-y-auto">
      <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="p-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CircleNotch className="w-4 h-4 text-primary animate-spin" />
            <span className="text-sm font-medium text-foreground">
              {allComplete ? "Imports Complete" : `Importing ${imports.length} item${imports.length > 1 ? "s" : ""}`}
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded transition-colors"
              aria-label="Close"
            >
              <span className="text-muted-foreground text-xs">✕</span>
            </button>
          )}
        </div>

        {/* Progress Items */}
        <div className="p-2 space-y-2">
          {imports.map((imp) => (
            <ImportProgressIndicator
              key={imp.id}
              fileName={imp.fileName}
              importType={imp.importType}
              current={imp.current}
              total={imp.total}
              status={imp.status}
              statusMessage={imp.statusMessage}
              compact
            />
          ))}
        </div>

        {/* Footer */}
        {allComplete && (
          <div className="p-2 border-t border-border bg-green-500/10">
            <p className="text-xs text-green-600 dark:text-green-400 text-center">
              All imports completed successfully!
            </p>
          </div>
        )}

        {hasErrors && !allComplete && (
          <div className="p-2 border-t border-border bg-red-500/10">
            <p className="text-xs text-red-600 dark:text-red-400 text-center">
              Some imports failed. Please check and retry.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ImportProgressIndicator;
