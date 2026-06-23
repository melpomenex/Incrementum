/**
 * Type-safe wrapper for Tauri invoke commands
 *
 * This wrapper lazy-loads the Tauri API to allow the app to run in browser
 * environments (for development/demo purposes) even though full functionality
 * requires the Tauri desktop environment.
 */

import { browserInvoke } from './browser-backend.js';

let tauriInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;
let tauriDialogOpen: ((options: unknown) => Promise<string | string[] | null>) | null = null;
let tauriEventListen: (<T>(event: string, handler: (event: T) => void) => Promise<() => void>) | null = null;
let tauriConvertFileSrc: ((path: string, protocol?: string) => string) | null = null;

function coerceError(err: unknown, context?: string): Error {
  if (err instanceof Error) return err;
  if (typeof err === "string") return new Error(context ? `${context}: ${err}` : err);
  try {
    const json = JSON.stringify(err);
    return new Error(context ? `${context}: ${json}` : json);
  } catch {
    return new Error(context ? `${context}: ${String(err)}` : String(err));
  }
}

/**
 * Check if running in Tauri environment
 */
export function isTauri(): boolean {
  return (
    "__TAURI_INTERNALS__" in window ||
    "__TAURI__" in window ||
    /Tauri/i.test(navigator.userAgent)
  );
}

export type Platform = 'mac' | 'windows' | 'linux' | 'unknown';

let _cachedPlatform: Platform | null = null;

/**
 * Detect the current OS platform.
 * Uses navigator.platform with navigator.userAgent fallback.
 */
export function getPlatform(): Platform {
  if (_cachedPlatform) return _cachedPlatform;

  const platform = (navigator.platform || '').toUpperCase();
  const ua = navigator.userAgent;

  if (platform.includes('MAC') || /Mac OS X/i.test(ua)) {
    _cachedPlatform = 'mac';
  } else if (platform.includes('WIN') || /Windows/i.test(ua)) {
    _cachedPlatform = 'windows';
  } else if (platform.includes('LINUX') || /Linux/i.test(ua)) {
    _cachedPlatform = 'linux';
  } else {
    _cachedPlatform = 'unknown';
  }

  return _cachedPlatform;
}

/**
 * Check if running on macOS
 */
export function isMac(): boolean {
  return getPlatform() === 'mac';
}

// ─────────────────────────────────────────────────────────────────────────────
// Native mobile detection (Android / iOS Tauri builds)
//
// tauri-plugin-os injects `window.__TAURI_OS_PLUGIN_INTERNALS__` synchronously
// at compile time with `platform` and `os_type` pre-populated. This lets us
// detect native mobile builds WITHOUT an async IPC call, so the mobile UI
// shell decision is race-free and available before React mounts.
//
// This replaces the old broken gate (`!isTauri() && isMobile`) which made the
// mobile UI unreachable inside the actual native Android/iOS webview (where
// isTauri() is true). See MobileLayoutWrapper.tsx and QueueTab.tsx.
// ─────────────────────────────────────────────────────────────────────────────

type OsPluginInternals = {
  platform?: string; // 'android' | 'ios' | 'macos' | 'windows' | 'linux' | ...
  os_type?: string; // 'android' | 'ios' | 'macos' | 'windows' | 'linux'
};

type WindowWithOsInternals = Window & {
  __TAURI_OS_PLUGIN_INTERNALS__?: OsPluginInternals;
};

/** Exact native platform from tauri-plugin-os, or null if not a Tauri build. */
export function nativePlatform(): string | null {
  if (!isTauri()) return null;
  const internals = (window as WindowWithOsInternals).__TAURI_OS_PLUGIN_INTERNALS__;
  return internals?.platform ?? internals?.os_type ?? null;
}

/**
 * True inside the native Android or iOS Tauri webview (not desktop, not browser).
 * Synchronous — safe to call during module evaluation or first render.
 */
export function isNativeMobile(): boolean {
  const p = nativePlatform();
  return p === 'android' || p === 'ios';
}

/** Visual form factor, derived from the native platform + viewport. */
export type FormFactor = 'phone' | 'tablet' | 'desktop';

let _cachedFormFactor: FormFactor | null = null;
let _cachedNativePhone: boolean | null = null;

/**
 * On a native mobile build, true if the device is a phone (shorter physical
 * screen edge < 600px) rather than a tablet. Phones always get the mobile
 * shell, even rotated to a wide landscape viewport; tablets use the viewport
 * rule (mobile shell only when narrow).
 *
 * Returns false outside native mobile builds. Memoized; reset via
 * {@link resetFormFactorCache}.
 */
export function isNativePhone(): boolean {
  if (_cachedNativePhone !== null) return _cachedNativePhone;
  _cachedNativePhone =
    isNativeMobile() &&
    Math.min(window.screen.width, window.screen.height) < 600;
  return _cachedNativePhone;
}

/**
 * Classify the current device as phone / tablet / desktop.
 *
 * - Native mobile build (android/ios): phone if the shorter screen edge is
 *   < 600px (Material phone/tablet breakpoint), else tablet. This is what
 *   triggers the mobile shell on phones AND small tablets in portrait.
 * - Browser/PWA: phone/tablet if viewport < 1024px (by the same 600 rule),
 *   desktop otherwise. Large tablets in landscape keep desktop chrome.
 *
 * Synchronous and memoized; call {@link resetFormFactorCache} on orientation
 * change (the {@link useFormFactor} hook handles this reactively).
 */
export function getFormFactor(): FormFactor {
  if (_cachedFormFactor) return _cachedFormFactor;

  if (isNativeMobile()) {
    // On a phone or small tablet the shorter screen edge is < 600 CSS px.
    const minEdge = Math.min(window.screen.width, window.screen.height);
    _cachedFormFactor = minEdge < 600 ? 'phone' : 'tablet';
    return _cachedFormFactor;
  }

  // Browser / PWA / desktop-native: viewport-driven.
  const minViewport = Math.min(window.innerWidth, window.innerHeight);
  if (window.innerWidth >= 1024 && minViewport >= 600) {
    _cachedFormFactor = 'desktop';
  } else if (minViewport < 600) {
    _cachedFormFactor = 'phone';
  } else {
    _cachedFormFactor = 'tablet';
  }
  return _cachedFormFactor;
}

/** Drop the memoized form factor so the next read recomputes (orientation change). */
export function resetFormFactorCache(): void {
  _cachedFormFactor = null;
  _cachedNativePhone = null;
}

/**
 * Check if running in PWA mode
 */
export function isPWA(): boolean {
  return !isTauri() && (window.matchMedia('(display-mode: standalone)').matches ||
    // @ts-expect-error - iOS Safari specific
    window.navigator.standalone === true);
}

/**
 * Lazy load the Tauri API only when running in Tauri environment
 */
async function loadTauriAPI(): Promise<void> {
  if (tauriInvoke !== null || !isTauri()) {
    return;
  }

  try {
    const coreModule = await import("@tauri-apps/api/core");
    tauriInvoke = coreModule.invoke;
    tauriConvertFileSrc = coreModule.convertFileSrc;
  } catch (error) {
    console.error("Failed to load Tauri API:", error);
    throw new Error("Tauri API not available");
  }
}

/**
 * Lazy load the Tauri dialog plugin API
 */
async function loadTauriDialogAPI(): Promise<void> {
  if (tauriDialogOpen !== null || !isTauri()) {
    return;
  }

  try {
    const dialogModule = await import("@tauri-apps/plugin-dialog");
    tauriDialogOpen = dialogModule.open;
  } catch (error) {
    console.error("Failed to load Tauri dialog API:", error);
    throw new Error("Tauri dialog API not available");
  }
}

/**
 * Lazy load the Tauri event API
 */
async function loadTauriEventAPI(): Promise<void> {
  if (tauriEventListen !== null || !isTauri()) {
    return;
  }

  try {
    const eventModule = await import("@tauri-apps/api/event");
    tauriEventListen = eventModule.listen as typeof tauriEventListen;
  } catch (error) {
    console.error("Failed to load Tauri event API:", error);
    throw new Error("Tauri event API not available");
  }
}

/**
 * Type-safe wrapper for Tauri invoke commands
 * Falls back to browser backend (IndexedDB) in browser/PWA environments
 */
export async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) {
    await loadTauriAPI();
    if (!tauriInvoke) {
      throw new Error("Failed to load Tauri invoke API");
    }
    try {
      return await tauriInvoke(command, args) as T;
    } catch (error) {
      console.error(`Tauri command "${command}" failed:`, error);
      throw coerceError(error);
    }
  } else {
    // Browser/PWA environment - use IndexedDB backend
    return browserInvoke<T>(command, args);
  }
}

/**
 * Convert a local file path to a Tauri-safe URL.
 */
export async function convertFileSrc(path: string, protocol?: string): Promise<string> {
  if (!isTauri()) {
    throw new Error("convertFileSrc is only available in the Tauri desktop app");
  }
  await loadTauriAPI();
  if (!tauriConvertFileSrc) {
    throw new Error("Failed to load Tauri convertFileSrc API");
  }
  return tauriConvertFileSrc(path, protocol);
}

/**
 * Open file picker dialog
 * Falls back to HTML5 File API in browser environments
 */
export async function openFilePicker(options?: {
  title?: string;
  multiple?: boolean;
  filters?: Array<{ name: string; extensions: string[] }>;
}): Promise<string[] | null> {
  // Native Android/iOS: the Tauri dialog plugin returns content:// URIs that
  // the Rust import backend can't read (it expects filesystem paths and calls
  // std::fs::canonicalize). The WebView's <input type=file> is wired to the
  // native SAF file chooser by wry and returns real File objects, which we
  // store as browser-file:// virtual paths. The import path then routes those
  // through the in-browser backend (see api/documents.ts importDocument).
  if (isTauri() && !isNativeMobile()) {
    const dialogOptions = {
      title: options?.title ?? "Select Files",
      multiple: options?.multiple ?? false,
      filters: options?.filters,
    };

    let selected: string | string[] | null = null;
    try {
      await loadTauriDialogAPI();
      if (!tauriDialogOpen) {
        throw new Error("Failed to load Tauri dialog API");
      }
      selected = await tauriDialogOpen(dialogOptions);
    } catch (error) {
      // Some desktop builds can fail to load the JS plugin module chunk.
      // Fall back to invoking the dialog plugin command directly.
      console.warn("[Tauri] Dialog plugin import failed, using invoke fallback:", error);
      selected = await invokeCommand<string | string[] | null>("plugin:dialog|open", {
        options: dialogOptions,
      });
    }

    if (selected === null) return null;
    return Array.isArray(selected) ? selected : [selected];
  } else {
    // Browser environment - use HTML5 File API
    return browserOpenFilePicker(options);
  }
}

import { storeBrowserFile } from './browser-file-store';

/**
 * Open file picker using HTML5 File API
 */
function browserOpenFilePicker(options?: {
  multiple?: boolean;
  filters?: Array<{ name: string; extensions: string[] }>;
}): Promise<string[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = options?.multiple ?? false;

    if (options?.filters?.length) {
      const extensions = options.filters.flatMap(f => f.extensions.map(ext => `.${ext}`));
      input.accept = extensions.join(',');
    }

    input.onchange = () => {
      if (input.files && input.files.length > 0) {
        // Store files in a global map for later retrieval
        const paths: string[] = [];
        for (let i = 0; i < input.files.length; i++) {
          const file = input.files[i];
          const virtualPath = storeBrowserFile(file);
          paths.push(virtualPath);
        }
        resolve(paths);
      } else {
        resolve(null);
      }
    };

    input.oncancel = () => resolve(null);
    input.click();
  });
}

/**
 * Open folder picker dialog
 * Falls back to mock implementation in browser environments
 */
export async function openFolderPicker(options?: {
  title?: string;
}): Promise<string | null> {
  if (isTauri()) {
    const dialogOptions = {
      title: options?.title ?? "Select Folder",
      directory: true,
    };

    try {
      await loadTauriDialogAPI();
      if (!tauriDialogOpen) {
        throw new Error("Failed to load Tauri dialog API");
      }
      return (await tauriDialogOpen(dialogOptions) as unknown) as Promise<string | null>;
    } catch (error) {
      console.warn("[Tauri] Folder dialog plugin import failed, using invoke fallback:", error);
      return await invokeCommand<string | null>("plugin:dialog|open", {
        options: dialogOptions,
      });
    }
  } else {
    console.warn("[Browser Mock] Folder picker not available in browser.");
    return Promise.resolve(null);
  }
}

/**
 * Open URL in external browser
 * Uses Tauri opener plugin if available, otherwise falls back to window.open
 */
export async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
    } catch (error) {
      console.error("Failed to open URL with Tauri opener, falling back to window.open:", error);
      window.open(url, "_blank");
    }
  } else {
    window.open(url, "_blank");
  }
}

/**
 * Open URL in a new Tauri Webview window
 * This creates a separate window with a native webview, which can handle YouTube embeds better
 * than iframe embeds in the main app
 */
export async function openInWebviewWindow(
  url: string,
  options: { title?: string; width?: number; height?: number } = {}
): Promise<void> {
  if (!isTauri()) {
    // Fallback to regular window.open in browser
    window.open(url, "_blank", `width=${options.width || 1200},height=${options.height || 800}`);
    return;
  }

  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const windowLabel = `youtube-player-${Date.now()}`;
    
    const webview = new WebviewWindow(windowLabel, {
      url,
      title: options.title || "YouTube Player",
      width: options.width || 1200,
      height: options.height || 800,
      center: true,
      resizable: true,
      minimizable: true,
      maximizable: true,
      closable: true,
      // Enable all features needed for YouTube
      transparent: false,
      decorations: true,
      alwaysOnTop: false,
    });

    // Note: once() returns a Promise that resolves to an unlisten function
    // We don't need to clean these up as they fire only once and the window
    // manages its own lifecycle, but we should handle promise rejections
    void webview.once("tauri://created", () => {
    }).catch(() => { /* ignore */ });

    void webview.once("tauri://error", (event: unknown) => {
      console.error("Failed to create YouTube player window:", event);
      openExternal(url);
    }).catch(() => { /* ignore */ });
  } catch (error) {
    console.error("Failed to create webview window:", error);
    openExternal(url);
  }
}

/**
 * Type alias for unlisten function
 */
export type UnlistenFn = () => void;

/**
 * Listen to Tauri events
 * Falls back to mock implementation in browser environments
 */
export async function listen<T>(
  event: string,
  handler: (event: { payload: T }) => void
): Promise<UnlistenFn> {
  if (isTauri()) {
    await loadTauriEventAPI();
    if (!tauriEventListen) {
      throw new Error("Failed to load Tauri event API");
    }
    return await tauriEventListen(event, handler);
  } else {
    // Browser environment - return a no-op unlisten function
    console.warn(`[Browser Mock] Event listener for "${event}" not available in browser.`);
    return () => { };
  }
}
