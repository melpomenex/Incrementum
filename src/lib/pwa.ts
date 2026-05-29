/**
 * Progressive Web App (PWA) utilities
 *
 * Provides service worker registration, offline detection,
 * and PWA-specific functionality.
 */

import { useState, useEffect } from 'react';
import { isTauri } from './tauri';

type NavigatorWithStandalone = Navigator & { standalone?: boolean };
type DocumentWithFullscreen = Document & {
  webkitFullscreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
};
type HTMLElementWithFullscreen = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};
type WindowWithMSStream = Window & { MSStream?: unknown };

/**
 * Check if running in PWA mode (installed as app)
 */
export function isPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.matchMedia('(display-mode: fullscreen)').matches ||
         (window.navigator as NavigatorWithStandalone).standalone === true;
}

/**
 * Check if currently in fullscreen mode
 */
export function isFullscreen(): boolean {
  const doc = document as DocumentWithFullscreen;
  return !!(
    document.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.msFullscreenElement
  );
}

/**
 * Request fullscreen mode
 * Returns true if successful, false if not supported or failed
 */
export async function enterFullscreen(): Promise<boolean> {
  const doc = document as DocumentWithFullscreen;
  const el = doc.documentElement as HTMLElementWithFullscreen;
  
  if (isFullscreen()) return true;
  
  // Try standard fullscreen API
  if (document.documentElement.requestFullscreen) {
    try {
      await document.documentElement.requestFullscreen();
      return true;
    } catch (error) {
      console.warn('[PWA] Failed to enter fullscreen:', error);
    }
  }
  
  // Try webkit prefix (iOS Safari)
  if (el.webkitRequestFullscreen) {
    try {
      await el.webkitRequestFullscreen();
      return true;
    } catch (error) {
      console.warn('[PWA] Failed to enter webkit fullscreen:', error);
    }
  }
  
  // Try ms prefix (IE/Edge legacy)
  if (el.msRequestFullscreen) {
    try {
      await el.msRequestFullscreen();
      return true;
    } catch (error) {
      console.warn('[PWA] Failed to enter MS fullscreen:', error);
    }
  }
  
  return false;
}

/**
 * Exit fullscreen mode
 */
export async function exitFullscreen(): Promise<boolean> {
  const doc = document as DocumentWithFullscreen;
  
  if (!isFullscreen()) return true;
  
  if (document.exitFullscreen) {
    try {
      await document.exitFullscreen();
      return true;
    } catch (error) {
      console.warn('[PWA] Failed to exit fullscreen:', error);
    }
  }
  
  if (doc.webkitExitFullscreen) {
    try {
      await doc.webkitExitFullscreen();
      return true;
    } catch (error) {
      console.warn('[PWA] Failed to exit webkit fullscreen:', error);
    }
  }
  
  if (doc.msExitFullscreen) {
    try {
      await doc.msExitFullscreen();
      return true;
    } catch (error) {
      console.warn('[PWA] Failed to exit MS fullscreen:', error);
    }
  }
  
  return false;
}

/**
 * Toggle fullscreen mode
 */
export async function toggleFullscreen(): Promise<boolean> {
  if (isFullscreen()) {
    return exitFullscreen();
  } else {
    return enterFullscreen();
  }
}

/**
 * Check if fullscreen API is supported
 */
export function isFullscreenSupported(): boolean {
  const doc = document as DocumentWithFullscreen;
  const el = doc.documentElement as HTMLElementWithFullscreen;
  return !!(
    document.documentElement.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.msRequestFullscreen
  );
}

/**
 * Check if currently online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Register the service worker
 */
export async function registerServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service workers not supported');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      type: 'classic'
    });

    if (registration.waiting) {
      registration.waiting.postMessage({ action: 'skipWaiting' });
    }

    const logInstallingWorker = () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
          installingWorker.postMessage({ action: 'skipWaiting' });
        }
      });
    };

    registration.addEventListener('updatefound', logInstallingWorker);
    logInstallingWorker();

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    }, { once: true });

    return true;
  } catch (error) {
    console.error('[PWA] Service worker registration failed:', error);
    return false;
  }
}

/**
 * Get current service worker version
 */
export async function getServiceWorkerVersion(): Promise<string | null> {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    return null;
  }

  try {
    // Send message to service worker to get version
    const messageChannel = new MessageChannel();
    const versionPromise = new Promise<string>((resolve) => {
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.version);
      };
    });

    navigator.serviceWorker.controller.postMessage({
      action: 'get-version'
    }, [messageChannel.port2]);

    return await versionPromise;
  } catch {
    return null;
  }
}

/**
 * Trigger service worker update
 */
export async function updateServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const registration = await navigator.serviceWorker.getRegistration();
  if (registration) {
    await registration.update();
  }
}

/**
 * Cache specific documents for offline reading
 */
export async function cacheDocumentsForOffline(documentIds: string[]): Promise<void> {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    console.warn('[PWA] Service worker not active');
    return;
  }

  navigator.serviceWorker.controller.postMessage({
    action: 'cache-documents',
    data: { documentIds }
  });
}

/**
 * Clear all PWA caches
 */
export async function clearPWACache(): Promise<void> {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    console.warn('[PWA] Service worker not active');
    return;
  }

  navigator.serviceWorker.controller.postMessage({
    action: 'clear-cache'
  });
}

/**
 * Request PWA installation prompt (works in some browsers)
 */
export function promptInstall(): void {
  // Some browsers support deferred prompts
  // This would be called after user interaction
}

/**
 * Listen for online/offline events
 */
export function listenNetworkChanges(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Add to home screen prompt helper
 */
export function showAddToHomeScreenPrompt(): void {
  // Detect iOS Safari standalone mode
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) &&
               !(window as WindowWithMSStream).MSStream;

  if (isIOS && !isPWA()) {
    // Show iOS specific instructions
  }
}

/**
 * Get device information for PWA optimization
 */
export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isPWA: boolean;
  isOnline: boolean;
  pixelRatio: number;
  screenWidth: number;
  screenHeight: number;
}

export function getDeviceInfo(): DeviceInfo {
  const width = window.screen.width;
  const height = window.screen.height;
  const pixelRatio = window.devicePixelRatio || 1;

  // Mobile detection
  const isMobile = width < 768 ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Tablet detection
  const isTablet = !isMobile && width < 1024;

  return {
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
    isPWA: isPWA(),
    isOnline: isOnline(),
    pixelRatio,
    screenWidth: width,
    screenHeight: height
  };
}

/**
 * Register PWA on app mount
 */
export function initializePWA(): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (import.meta.env.DEV) {
    return;
  }

  const shouldEnablePWA = !isTauri() && (import.meta.env.MODE === 'pwa' || import.meta.env.PROD);
  if (!shouldEnablePWA) {
    return;
  }

  registerServiceWorker().then((registered) => {
    if (registered) {
    }
  });

  if ('serviceWorker' in navigator) {
    const refreshRegistration = () => {
      try {
        navigator.serviceWorker.getRegistration().then((registration) => {
          registration?.update().catch((error) => {
            console.warn('[PWA] Failed to refresh service worker registration:', error);
          });
        }).catch((error) => {
          // Document may be in invalid state after backgrounding (Chrome memory reclaim)
          console.warn('[PWA] Cannot refresh registration (page may need reload):', error?.message);
        });
      } catch (error) {
        // Synchronous InvalidStateError — navigator.serviceWorker itself is dead
        console.warn('[PWA] Service worker API unavailable (page may need reload):', (error as Error)?.message);
      }
    };

    window.addEventListener('focus', refreshRegistration);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        refreshRegistration();
      }
    });
  }

}

/**
 * Hook for using PWA status in components
 */
export function usePWAStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const pwa = isPWA();

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    online,
    pwa,
    device: getDeviceInfo()
  };
}
