/**
 * Offline-First Indicators
 * Shows cloud/download icons to indicate content availability offline
 */

import { useState, useEffect, useCallback } from "react";
import {
  ArrowsCounterClockwise,
  Check,
  CircleNotch,
  Cloud,
  CloudArrowDown,
  CloudCheck,
  Download,
  WarningCircle,
  WifiSlash,
} from "@phosphor-icons/react";
import { t } from "../../lib/i18n";

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
          <CloudArrowDown className="w-3.5 h-3.5" />
          {showLabel && <span>{t("offline.pendingSync")}</span>}
          {pendingChanges > 0 && (
            <span className="font-medium">{pendingChanges}</span>
          )}
        </>
      ) : (
        <>
          <WifiSlash className="w-3.5 h-3.5" />
          {showLabel && <span>{t("offline.offline")}</span>}
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
        title={t("offline.downloading")}
      >
        <CircleNotch className={`${iconSize} animate-spin`} />
      </div>
    );
  }

  if (isDownloaded) {
    return (
      <div
        className={`inline-flex items-center gap-1 text-green-600 ${className}`}
        title={t("offline.availableOffline")}
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
        title={t("offline.downloadForOffline")}
      >
        <Download className={iconSize} />
      </button>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1 text-muted-foreground ${className}`}
      title={t("offline.onlineOnly")}
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
          <WifiSlash className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-600">{t("offline.youreOffline")}</h3>
          <p className="text-xs text-red-500/80">
            {t("offline.offlineDescription")}
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
          <CloudArrowDown className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-amber-600">
            {t("offline.changesPendingSync", { count: pendingChanges })}
          </h3>
          <p className="text-xs text-amber-500/80">
            {t("offline.syncNowDescription")}
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-600 rounded-lg text-sm font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-50"
        >
          {isSyncing ? (
            <CircleNotch className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowsCounterClockwise className="w-4 h-4" />
          )}
          {t("offline.sync")}
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
        <h3 className="text-sm font-medium text-green-600">{t("offline.allSynced")}</h3>
        <p className="text-xs text-green-500/80">
          {t("offline.allSyncedDescription")}
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
        <CloudArrowDown className="w-2.5 h-2.5" />
        {t("offline.syncing")}
      </span>
    );
  }

  if (isAvailable) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 text-green-600 rounded text-[10px] font-medium ${className}`}
        title={t("offline.availableOffline")}
      >
        <Check className="w-2.5 h-2.5" />
        {t("offline.offline")}
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
        <span className="text-muted-foreground">{t("offline.offlineStorage")}</span>
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
          <WarningCircle className="w-3 h-3" />
          {t("offline.storageAlmostFull")}
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
    if (!("serviceWorker" in navigator)) {
      return;
    }

    let disposed = false;

    const attachRegistration = (reg: ServiceWorkerRegistration | null) => {
      if (!reg || disposed) return;

      setIsRegistered(true);
      setRegistration(reg);
      setHasUpdate(Boolean(reg.waiting));

      const handleUpdateFound = () => {
        const installingWorker = reg.installing;
        if (!installingWorker) return;

        installingWorker.addEventListener("statechange", () => {
          if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
            setHasUpdate(true);
          }
        });
      };

      reg.addEventListener("updatefound", handleUpdateFound);

      return () => {
        reg.removeEventListener("updatefound", handleUpdateFound);
      };
    };

    let detachRegistrationListener: (() => void) | undefined;

    const tryReady = () => {
      try {
        navigator.serviceWorker.ready.then((reg) => {
          if (disposed) return;
          detachRegistrationListener = attachRegistration(reg);
        }).catch(() => {
          // Document may be in invalid state after backgrounding
        });
      } catch {
      /* Service worker check may fail */ }
    };

    const tryGetRegistration = () => {
      try {
        navigator.serviceWorker.getRegistration().then((reg) => {
          if (disposed || !reg) return;
          detachRegistrationListener?.();
          detachRegistrationListener = attachRegistration(reg);
        }).catch(() => {
          // Document may be in invalid state after backgrounding
        });
      } catch {
      /* Cache status check may fail */ }
    };

    tryReady();
    tryGetRegistration();

    return () => {
      disposed = true;
      detachRegistrationListener?.();
    };
  }, []);

  const update = useCallback(async () => {
    if (!registration) {
      return;
    }

    try {
      await registration.update();
    } catch (error) {
      console.warn('[PWA] Cannot update service worker:', (error as Error)?.message);
      window.location.reload();
      return;
    }

    const waitingWorker = registration.waiting;
    if (waitingWorker) {
      await new Promise<void>((resolve) => {
        let reloaded = false;

        const handleControllerChange = () => {
          if (reloaded) return;
          reloaded = true;
          navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
          setHasUpdate(false);
          window.location.reload();
          resolve();
        };

        try {
          navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
        } catch {
          // navigator.serviceWorker may be invalid
        }
        waitingWorker.postMessage({ action: "skipWaiting" });

        window.setTimeout(() => {
          if (reloaded) return;
          try {
            navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
          } catch { /* non-critical */ }
          setHasUpdate(false);
          window.location.reload();
          resolve();
        }, 4000);
      });
      return;
    }

    window.location.reload();
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
        <ArrowsCounterClockwise className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-medium text-foreground">{t("offline.updateAvailable")}</h3>
        <p className="text-xs text-muted-foreground">
          {t("offline.updateReady")}
        </p>
      </div>
      <button
        onClick={update}
        className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        {t("offline.update")}
      </button>
    </div>
  );
}

export default OfflineIndicator;
