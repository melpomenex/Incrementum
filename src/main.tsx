// Early error handler - must be first
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    const root = document.getElementById('root');

    // Chromium sometimes emits this as an "error" event even though it's a benign
    // ResizeObserver warning. Our early handler is intentionally aggressive for
    // startup failures, so we must ignore it to avoid nuking the UI.
    const message = e.message || "";
    if (
      message.includes("ResizeObserver loop limit exceeded") ||
      message.includes("ResizeObserver loop completed with undelivered notifications")
    ) {
      e.preventDefault();
      e.stopImmediatePropagation?.();
      return;
    }

    // Only replace the app UI during initial bootstrap. After React mounts,
    // log the error but don't clobber the DOM.
    const isMounted = root?.getAttribute("data-incrementum-mounted") === "true";
    console.error("[Global Error]", e.error ?? message);
    if (root && !isMounted) {
      root.innerHTML = '<div style="padding:20px;background:#000;color:#fff;font-family:monospace;"><h2>Startup Error</h2><pre style="white-space:pre-wrap;">' + e.message + '\n' + (e.error?.stack || '') + '</pre></div>';
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason?.message || String(reason);
    if (message.includes("TextDecoder") && message.includes("encoded data was not valid")) {
      event.preventDefault();
      console.error('[Yjs] Decode failure detected. Clearing persistence and reloading.', reason);
      const resetKey = "incrementum_yjs_reset_at";
      if (!sessionStorage.getItem(resetKey)) {
        sessionStorage.setItem(resetKey, new Date().toISOString());
        import("./lib/yjsSync")
          .then(({ getYjsSync }) => getYjsSync().persistence.clearData())
          .catch((error) => console.error('[Yjs] Failed to clear persistence:', error))
          .finally(() => window.location.reload());
      }
    }
  });
}

import React, { Suspense, useEffect } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./styles/mobile.css";
import { HashRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./contexts/ThemeContext";
import { initializePWA } from "./lib/pwa";
import { isTauri } from "./lib/tauri";
import { initLocalStorageSync } from "./lib/localStorageSync";

// Mobile PWA Components
import { MobileLayoutWrapper } from "./components/mobile/MobileLayoutWrapper";

// Layout
import { MainLayout } from "./components/layout/MainLayout";
import { DevPerformanceMonitor } from "./components/common/PerformanceMonitor";
import { Analytics } from "@vercel/analytics/react";

// Auth callback route
import AuthCallback from "./routes/auth-callback";
import ScreenshotOverlay from "./routes/screenshot-overlay";

// Loading fallback component
function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0a', color: '#fff' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #333', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
        <p style={{ marginTop: 16, fontSize: 14 }}>Loading...</p>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/**
 * Cache keys for consistent query invalidation
 */
export const queryKeys = {
  queue: ["queue"] as const,
  queueStats: ["queue", "stats"] as const,
  documents: ["documents"] as const,
  document: (id: string) => ["documents", id] as const,
  extracts: (documentId: string) => ["extracts", documentId] as const,
  learningItems: (documentId: string) => ["learning-items", documentId] as const,
  review: ["review"] as const,
  analytics: (timeRange?: string) => ["analytics", timeRange] as const,
  categories: ["categories"] as const,
  settings: ["settings"] as const,
};

// Create query client for API calls with enhanced caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
    },
  },
});

// Error boundary for catching React errors
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('React error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0a', color: '#fff', flexDirection: 'column' }}>
          <h1>Something went wrong</h1>
          <p style={{ color: '#f00' }}>{this.state.error?.message}</p>
          <pre style={{ background: '#111', padding: 16, borderRadius: 8, marginTop: 16, fontSize: 12 }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

console.log('[main.tsx] Starting Incrementum app...');

// Initialize PWA (works in both Tauri and Web)
initializePWA();

// Initialize localStorage -> Yjs sync (shared state across devices).
initLocalStorageSync();

// Dev/Tauri: ensure no service worker or cache is present to avoid stale assets.
if ((import.meta.env.DEV || isTauri()) && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}

if ((import.meta.env.DEV || isTauri()) && "caches" in window) {
  caches.keys().then((keys) => {
    keys.forEach((key) => caches.delete(key));
  });
}

// Initialize demo content for web/PWA (only in browser mode, not Tauri)
if (!(window as any).__TAURI__) {
  import('./lib/demoContent').then(({ checkAndImportDemoContent }) => {
    checkAndImportDemoContent(null, null).catch((error) => {
      console.log('[Demo Content] Auto-import check failed or skipped:', error);
    });
  }).catch(() => {
    // Module may not be available in all build configurations
    console.log('[Demo Content] Module not available');
  });

  // Initialize browser extension bridge for PWA mode
  import('./lib/extension-bridge').then(({ initExtensionBridge }) => {
    initExtensionBridge();
    console.log('[Extension Bridge] Initialized for PWA mode');
  }).catch((error) => {
    console.log('[Extension Bridge] Module not available:', error);
  });
}

const rootEl = document.getElementById("root") as HTMLElement;
const reactRoot = ReactDOM.createRoot(rootEl);
reactRoot.render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <HashRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* OAuth callback route - must be before catch-all */}
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/screenshot-overlay" element={<ScreenshotOverlay />} />
              {/* Catch-all route - MainLayout handles tab-based navigation internally */}
              <Route path="*" element={<MainLayout />} />
            </Routes>
          </Suspense>
          <DevPerformanceMonitor />
          {/* Only load Vercel Analytics in web/PWA mode, not in Tauri desktop */}
          {!isTauri() && <Analytics />}
        </HashRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

// Mark as mounted so the early error handler doesn't replace the UI for
// runtime errors (it should only do that for bootstrap failures).
requestAnimationFrame(() => {
  rootEl?.setAttribute("data-incrementum-mounted", "true");
});
