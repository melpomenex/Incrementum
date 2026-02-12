/**
 * File Sync Status Indicator Component
 */

import { Cloud, Check, Download, Clock, AlertCircle, Loader2 } from "lucide-react";
import { FileSyncStatus } from "../../lib/useFileSync";

interface FileSyncStatusIndicatorProps {
  status: FileSyncStatus;
  progress?: number;
  error?: string;
  size?: "sm" | "md";
  showLabel?: boolean;
  onDownloadClick?: () => void;
}

const statusConfig: Record<
  FileSyncStatus,
  {
    icon: typeof Check;
    color: string;
    label: string;
    bgColor: string;
  }
> = {
  synced: {
    icon: Check,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    label: "Synced",
  },
  available: {
    icon: Download,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    label: "Available",
  },
  waiting: {
    icon: Clock,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    label: "Waiting",
  },
  downloading: {
    icon: Loader2,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    label: "Downloading",
  },
  error: {
    icon: AlertCircle,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    label: "Error",
  },
};

export function FileSyncStatusIndicator({
  status,
  progress,
  error,
  size = "md",
  showLabel = false,
  onDownloadClick,
}: FileSyncStatusIndicatorProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const iconSize = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (status === "available" && onDownloadClick) {
      onDownloadClick();
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${config.bgColor} ${
        status === "available" && onDownloadClick ? "cursor-pointer hover:opacity-80" : ""
      }`}
      onClick={handleClick}
      title={error || config.label}
    >
      <Icon
        className={`${iconSize} ${config.color} ${status === "downloading" ? "animate-spin" : ""}`}
      />

      {status === "downloading" && progress !== undefined && (
        <span className={`${textSize} ${config.color}`}>{Math.round(progress * 100)}%</span>
      )}

      {showLabel && status !== "downloading" && (
        <span className={`${textSize} ${config.color}`}>{config.label}</span>
      )}

      {status === "waiting" && (
        <span className={`${textSize} text-muted-foreground`}>for device</span>
      )}
    </div>
  );
}

/**
 * Detailed file sync status with more information
 */
interface FileSyncStatusDetailProps {
  status: FileSyncStatus;
  progress?: number;
  error?: string;
  filename?: string;
  onDownloadClick?: () => void;
  onRetryClick?: () => void;
}

export function FileSyncStatusDetail({
  status,
  progress,
  error,
  filename,
  onDownloadClick,
  onRetryClick,
}: FileSyncStatusDetailProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${config.bgColor}`}>
      <Icon
        className={`w-5 h-5 ${config.color} ${status === "downloading" ? "animate-spin" : ""}`}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`font-medium ${config.color}`}>{config.label}</span>
          {filename && (
            <span className="text-sm text-muted-foreground truncate ml-2">{filename}</span>
          )}
        </div>

        {status === "downloading" && progress !== undefined && (
          <div className="mt-2">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground mt-1">
              {Math.round(progress * 100)}% complete
            </span>
          </div>
        )}

        {status === "waiting" && (
          <p className="text-xs text-muted-foreground mt-1">
            Waiting for a device with this file to come online
          </p>
        )}

        {status === "available" && (
          <p className="text-xs text-muted-foreground mt-1">
            Ready to download from another device
          </p>
        )}

        {status === "error" && error && (
          <p className="text-xs text-red-500 mt-1">{error}</p>
        )}
      </div>

      {status === "available" && onDownloadClick && (
        <button
          onClick={onDownloadClick}
          className="px-3 py-1.5 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
        >
          Download
        </button>
      )}

      {status === "error" && onRetryClick && (
        <button
          onClick={onRetryClick}
          className="px-3 py-1.5 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * Sync files panel for settings page
 */
interface SyncFilesPanelProps {
  files: Array<{
    id: string;
    filename: string;
    sizeBytes: number;
    status: FileSyncStatus;
    progress?: number;
    error?: string;
  }>;
  onDownloadClick?: (fileId: string) => void;
  onRetryClick?: (fileId: string) => void;
}

export function SyncFilesPanel({ files, onDownloadClick, onRetryClick }: SyncFilesPanelProps) {
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Cloud className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No files in sync manifest</p>
        <p className="text-xs mt-1">Import files on any device to see them here</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border"
        >
          <FileSyncStatusIndicator
            status={file.status}
            progress={file.progress}
            error={file.error}
            size="sm"
          />

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.filename}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(file.sizeBytes)}</p>
          </div>

          {file.status === "available" && onDownloadClick && (
            <button
              onClick={() => onDownloadClick(file.id)}
              className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90"
            >
              Download
            </button>
          )}

          {file.status === "error" && onRetryClick && (
            <button
              onClick={() => onRetryClick(file.id)}
              className="px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:opacity-90"
            >
              Retry
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
