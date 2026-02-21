/**
 * Offline-First Indicators
 * Shows cloud/download icons to indicate content availability offline
 */

import { useState, useEffect, useCallback } from "react";
import {
  Cloud,
  CloudDownload,
  CloudCheck,
  WifiOff,
  Download,
  Check,
  AlertCircle,
  RefreshCcw,
  Loader2,
} from "lucide-react";

interface OfflineStatus {
  isOnline: boolean;
  hasPendingSync: boolean;
  lastSyncTime: Date | null;
  pendingChanges: number;
}

/**
 * Hook to track online/offline status and sync state
 */
export function useOfflineStatus() {
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: navigator.onLine,
    hasPendingSync: false,
    lastSyncTime: null,
    pendingChanges: 0,
  });

  useEffect(() => {
    const handleOnline = () => {
      setStatus((prev) => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setStatus((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Check for pending sync data in localStorage
    const checkPendingSync = () => {
      const pendingData = localStorage.getItem("pending-sync");
      if (pendingData) {
        try {
          const parsed = JSON.parse(pendingData);
          setStatus((prev) => ({
            ...prev,
            hasPendingSync: true,
            pendingChanges: parsed.length,
          }));
        } catch {
          // Invalid data, ignore
        }
      }
    };

    checkPendingSync();
    const interval = setInterval(checkPendingSync, 30000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  const markSynced = useCallback(() => {
    localStorage.removeItem("pending-sync");
    setStatus((prev) => ({
      ...prev,
      hasPendingSync: false,
      pendingChanges: 0,
      lastSyncTime: new Date(),
    }));
  }, []);

  return { ...status, markSynced };
}

/**
 * Compact offline status indicator for header/navbar
 */
interface OfflineIndicatorProps {
  className?: string;
  showLabel?: boolean;
}

export function OfflineIndicator({
  className = "",
  showLabel = false,
}: OfflineIndicatorProps) {
  const { isOnline, hasPendingSync, pendingChanges } = useOfflineStatus();

  if (isOnline && !hasPendingSync) {
    return null; // Don't show anything when online and synced
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
        isOnline
          ? "bg-amber-500/10 text-amber-600"
          : "bg-red-500/10 text-red-600"
      } ${className}`}
    >
      {isOnline ? (
        <>
          <CloudDownload className="w-3.5 h-3.5" />
          {showLabel && <span>Pending sync</span>}
          {pendingChanges > 0 && (
            <span className="font-medium">{pendingChanges}</span>
          )}
        </>
      ) : (
        <>
          <WifiOff className="w-3.5 h-3.5" />
          {showLabel && <span>Offline</span>}
        </>
      )}
    </div>
  );
}

/**
 * Content availability indicator
 * Shows if content is available offline
 */
interface ContentAvailabilityProps {
  isDownloaded: boolean;
  isDownloading?: boolean;
  size?: "sm" | "md" | "lg";
  onDownload?: () => void;
  className?: string;
}

export function ContentAvailability({
  isDownloaded,
  isDownloading = false,
  size = "md",
  onDownload,
  className = "",
}: ContentAvailabilityProps) {
  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const iconSize = sizeClasses[size];

  if (isDownloading) {
    return (
      <div
        className={`inline-flex items-center gap-1 text-primary ${className}`}
        title="Downloading..."
      >
        <Loader2 className={`${iconSize} animate-spin`} />
      </div>
    );
  }

  if (isDownloaded) {
    return (
      <div
        className={`inline-flex items-center gap-1 text-green-600 ${className}`}
        title="Available offline"
      >
        <Check className={iconSize} />
      </div>
    );
  }

  if (onDownload) {
    return (
      <button
        onClick={onDownload}
        className={`inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors ${className}`}
        title="Download for offline"
      >
        <Download className={iconSize} />
      </button>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1 text-muted-foreground ${className}`}
      title="Online only"
    >
      <Cloud className={iconSize} />
    </div>
  );
}

/**
 * Full offline banner for settings or status pages
 */
interface OfflineBannerProps {
  onSync?: () => void;
  className?: string;
}

export function OfflineBanner({ onSync, className = "" }: OfflineBannerProps) {
  const { isOnline, hasPendingSync, pendingChanges, markSynced } = useOfflineStatus();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    if (!isOnline || !onSync) return;

    setIsSyncing(true);
    try {
      await onSync();
      markSynced();
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOnline) {
    return (
      <div
        className={`flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl ${className}`}
      >
        <div className="p-2 bg-red-500/20 rounded-lg">
          <WifiOff className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-600">You're offline</h3>
          <p className="text-xs text-red-500/80">
            Some features may be limited. Your changes will sync when you're back online.
          </p>
        </div>
      </div>
    );
  }

  if (hasPendingSync) {
    return (
      <div
        className={`flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl ${className}`}
      >
        <div className="p-2 bg-amber-500/20 rounded-lg">
          <CloudDownload className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-amber-600">
            {pendingChanges} changes pending sync
          </h3>
          <p className="text-xs text-amber-500/80">
            Sync now to update your data across devices.
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-600 rounded-lg text-sm font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-50"
        >
          {isSyncing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCcw className="w-4 h-4" />
          )}
          Sync
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl ${className}`}
    >
      <div className="p-2 bg-green-500/20 rounded-lg">
        <CloudCheck className="w-5 h-5 text-green-600" />
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-medium text-green-600">All synced</h3>
        <p className="text-xs text-green-500/80">
          Your data is up to date and available offline.
        </p>
      </div>
    </div>
  );
}

/**
 * Document list item offline badge
 */
interface OfflineBadgeProps {
  isAvailable: boolean;
  isPending?: boolean;
  className?: string;
}

export function OfflineBadge({
  isAvailable,
  isPending = false,
  className = "",
}: OfflineBadgeProps) {
  if (isPending) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 text-amber-600 rounded text-[10px] font-medium ${className}`}
      >
        <CloudDownload className="w-2.5 h-2.5" />
        Syncing
      </span>
    );
  }

  if (isAvailable) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 text-green-600 rounded text-[10px] font-medium ${className}`}
        title="Available offline"
      >
        <Check className="w-2.5 h-2.5" />
        Offline
      </span>
    );
  }

  return null;
}

/**
 * Storage usage indicator for offline content
 */
interface StorageUsageProps {
  usedBytes: number;
  totalBytes: number;
  className?: string;
}

export function StorageUsage({
  usedBytes,
  totalBytes,
  className = "",
}: StorageUsageProps) {
  const percentage = Math.min((usedBytes / totalBytes) * 100, 100);
  const usedMB = (usedBytes / (1024 * 1024)).toFixed(1);
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(0);

  const getColorClass = () => {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 70) return "bg-amber-500";
    return "bg-primary";
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Offline storage</span>
        <span className="text-foreground font-medium">
          {usedMB} / {totalMB} MB
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${getColorClass()} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {percentage >= 90 && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Storage almost full. Remove some offline content.
        </p>
      )}
    </div>
  );
}

/**
 * Service Worker registration status
 */
export function useServiceWorkerStatus() {
  const [isRegistered, setIsRegistered] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        setIsRegistered(true);
        setRegistration(reg);
      });

      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          setIsRegistered(true);
          setRegistration(reg);

          // Check for updates
          reg.addEventListener("updatefound", () => {
            setHasUpdate(true);
          });
        }
      });
    }
  }, []);

  const update = useCallback(async () => {
    if (registration) {
      await registration.update();
      setHasUpdate(false);
      window.location.reload();
    }
  }, [registration]);

  return { isRegistered, hasUpdate, update };
}

/**
 * Update available notification
 */
interface UpdateNotificationProps {
  className?: string;
}

export function UpdateNotification({
  className = "",
}: UpdateNotificationProps) {
  const { hasUpdate, update } = useServiceWorkerStatus();

  if (!hasUpdate) return null;

  return (
    <div
      className={`flex items-center gap-3 p-4 bg-primary/10 border border-primary/20 rounded-xl ${className}`}
    >
      <div className="p-2 bg-primary/20 rounded-lg">
        <RefreshCcw className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-medium text-foreground">Update available</h3>
        <p className="text-xs text-muted-foreground">
          A new version is ready to install.
        </p>
      </div>
      <button
        onClick={update}
        className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Update
      </button>
    </div>
  );
}

export default OfflineIndicator;
