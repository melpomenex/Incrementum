/**
 * PWA Install Prompt Component
 * Shows "Add to Home Screen" banner for mobile users
 * Detects if running as PWA
 */

import { useState, useEffect, useCallback } from "react";
import {
  Download,
  X,
  Share,
  Plus,
  Smartphone,
  Check,
  Info,
} from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PWAInstallPromptProps {
  onInstall?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function PWAInstallPrompt({
  onInstall,
  onDismiss,
  className = "",
}: PWAInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running as PWA
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Check if already dismissed
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      // Show again after 7 days
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // Listen for beforeinstallprompt event (non-iOS)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Show prompt after a delay
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // For iOS, show the prompt after delay
    if (isIOSDevice && !standalone) {
      setTimeout(() => {
        setShowPrompt(true);
      }, 5000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        onInstall?.();
      }

      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
    onDismiss?.();
  };

  // Don't show if already installed
  if (isStandalone || !showPrompt) {
    return null;
  }

  return (
    <div className={`fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm ${className}`}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/10 to-primary/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-xl">
              <Smartphone className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Install App</h3>
              <p className="text-xs text-muted-foreground">Add to home screen</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-muted-foreground mb-4">
            Install Incrementum for a better experience with offline access and faster loading.
          </p>

          {isIOS ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                To install on iOS:
              </p>
              <ol className="text-xs text-muted-foreground space-y-2">
                <li className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold">1</span>
                  <span>Tap the Share button</span>
                  <Share className="w-4 h-4 text-primary" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold">2</span>
                  <span>Scroll down and tap "Add to Home Screen"</span>
                  <Plus className="w-4 h-4 text-primary" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold">3</span>
                  <span>Tap "Add" in the top right corner</span>
                </li>
              </ol>
            </div>
          ) : (
            <button
              onClick={handleInstall}
              className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
            >
              <Download className="w-5 h-5" />
              Install Now
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-muted/30 border-t border-border">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Info className="w-3 h-3" />
            Free • No app store needed
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to detect PWA status
 */
export function usePWAStatus() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Check if running as PWA
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for app installed
    const handleAppInstalled = () => {
      setCanInstall(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    setDeferredPrompt(null);
    setCanInstall(false);

    return outcome === "accepted";
  }, [deferredPrompt]);

  return {
    isStandalone,
    canInstall,
    install,
  };
}

/**
 * Compact PWA status indicator
 */
export function PWAStatusBadge({ className = "" }: { className?: string }) {
  const { isStandalone, canInstall } = usePWAStatus();

  if (isStandalone) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 bg-green-500/10 text-green-600 rounded-full text-xs ${className}`}>
        <Check className="w-3 h-3" />
        <span>Installed</span>
      </div>
    );
  }

  if (canInstall) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs ${className}`}>
        <Download className="w-3 h-3" />
        <span>Install available</span>
      </div>
    );
  }

  return null;
}

export default PWAInstallPrompt;
