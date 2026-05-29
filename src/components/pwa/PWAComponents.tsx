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

const INSTALL_DISMISSED_KEY = "pwa-install-dismissed";
const INSTALL_DISMISS_MS = 3 * 24 * 60 * 60 * 1000;

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (window.navigator as unknown as { standalone: boolean }).standalone === true;
}

function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isMobileBrowser() {
  return window.matchMedia("(max-width: 768px)").matches ||
    window.matchMedia("(pointer: coarse)").matches;
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
  const [isMobile, setIsMobile] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  useEffect(() => {
    const standalone = isStandaloneMode();
    const ios = isIOSDevice();
    const mobile = isMobileBrowser();

    setIsStandalone(standalone);
    setIsIOS(ios);
    setIsMobile(mobile);

    const dismissed = localStorage.getItem(INSTALL_DISMISSED_KEY);
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      if (Date.now() - dismissedTime < INSTALL_DISMISS_MS) {
        return;
      }
    }

    if (standalone || !mobile) {
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowPrompt(false);
      setShowIosInstructions(false);
      onInstall?.();
    };

    const handleViewportChange = () => {
      setIsStandalone(isStandaloneMode());
      setIsMobile(isMobileBrowser());
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.matchMedia("(display-mode: standalone)").addEventListener("change", handleViewportChange);
    window.matchMedia("(max-width: 768px)").addEventListener("change", handleViewportChange);

    let showTimer: number | null = null;
    if (ios) {
      showTimer = window.setTimeout(() => {
        setShowPrompt(true);
      }, 1200);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.matchMedia("(display-mode: standalone)").removeEventListener("change", handleViewportChange);
      window.matchMedia("(max-width: 768px)").removeEventListener("change", handleViewportChange);
      if (showTimer) {
        window.clearTimeout(showTimer);
      }
    };
  }, [onInstall]);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIosInstructions((prev) => !prev);
      return;
    }

    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome !== "accepted") {
      setShowPrompt(false);
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIosInstructions(false);
    localStorage.setItem(INSTALL_DISMISSED_KEY, Date.now().toString());
    onDismiss?.();
  };

  const canShowPrompt = !isStandalone && isMobile && (isIOS || !!deferredPrompt);

  if (!canShowPrompt || !showPrompt) {
    return null;
  }

  return (
    <div
      className={`fixed left-3 right-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] z-50 sm:left-4 sm:right-4 md:left-auto md:right-4 md:max-w-sm ${className}`}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/10 to-primary/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-xl">
              <Smartphone className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Install Incrementum</h3>
              <p className="text-xs text-muted-foreground">Use it like an app on your phone</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 hover:bg-muted rounded-full transition-colors"
            aria-label="Dismiss install prompt"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-muted-foreground mb-4">
            Add Incrementum to your home screen for a faster launch, full-screen reading, and offline access.
          </p>

          <button
            type="button"
            onClick={handleInstall}
            className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
          >
            {isIOS ? <Share className="w-5 h-5" /> : <Download className="w-5 h-5" />}
            {isIOS ? "How to add on iPhone" : "Install on this phone"}
          </button>

          {isIOS && showIosInstructions ? (
            <div className="space-y-3">
              <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                On iPhone or iPad
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
          ) : null}
        </div>

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
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const standalone = isStandaloneMode();
    setIsStandalone(standalone);
    setIsIOS(isIOSDevice());

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setCanInstall(false);
      setDeferredPrompt(null);
      setIsStandalone(true);
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
    canInstall: canInstall || (isIOS && !isStandalone),
    install,
    isIOS,
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
