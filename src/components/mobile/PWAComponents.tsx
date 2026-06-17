/**
 * Mobile PWA Components
 *
 * PWA-specific components including:
 * - Install prompt
 * - Offline indicator
 * - Mobile navigation
 * - Settings panel
 */

import { useState, useEffect } from "react";
import {
  ArrowsClockwise,
  Download,
  WifiSlash,
  X,
} from "@phosphor-icons/react";
import { useI18n } from "../../lib/i18n";
import { isOnline, listenNetworkChanges } from "../../lib/pwa";
import { isTauri } from "../../lib/tauri";

/**
 * PWA Install Prompt Component
 *
 * Shows an install prompt when the app meets installability criteria
 * and the user hasn't installed it yet.
 */
export function PWAInstallPrompt() {
  const { t } = useI18n();
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    if (isTauri()) return;

    const isInstalled =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isInstalled) {
      return;
    }

    // Listen for beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    const handleInstalled = () => {
      setDeferredPrompt(null);
      setShowPrompt(false);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="pwa-install-prompt">
      <button
        onClick={handleInstall}
        className="pwa-install-btn"
      >
        <Download className="w-5 h-5 mr-2" />
        {t("pwa.installApp")}
      </button>
      <button
        onClick={handleDismiss}
        className="pwa-dismiss-btn"
        aria-label={t("pwa.dismiss")}
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

/**
 * Offline Indicator Component
 *
 * Shows an offline banner when connection is lost
 */
export function OfflineIndicator() {
  const { t } = useI18n();
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    const unsubscribe = listenNetworkChanges(setOnline);
    return unsubscribe;
  }, []);

  if (online) return null;

  return (
    <div className="offline-indicator">
      <WifiSlash className="w-4 h-4 mr-2" />
      <span className="offline-text">{t("pwa.offlineMessage")}</span>
      <button
        onClick={() => window.location.reload()}
        className="offline-retry-btn"
      >
        <ArrowsClockwise className="w-4 h-4 mr-2" />
        {t("pwa.retry")}
      </button>
    </div>
  );
}
