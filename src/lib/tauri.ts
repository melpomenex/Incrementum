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
    "__TAURI__" in window ||
    "__TAURI_INTERNALS__" in window ||
    /Tauri/i.test(navigator.userAgent)
  );
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
    tauriEventListen = eventModule.listen;
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
  if (isTauri()) {
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

    // Build accept attribute from filters
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
      return await tauriDialogOpen(dialogOptions) as Promise<string | null>;
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

    // Handle window creation events
    // Note: once() returns a Promise that resolves to an unlisten function
    // We don't need to clean these up as they fire only once and the window
    // manages its own lifecycle, but we should handle promise rejections
    void webview.once("tauri://created", () => {
      console.log("YouTube player window created successfully");
    }).catch(() => { /* ignore */ });

    void webview.once("tauri://error", (event: unknown) => {
      console.error("Failed to create YouTube player window:", event);
      // Fallback to browser
      openExternal(url);
    }).catch(() => { /* ignore */ });
  } catch (error) {
    console.error("Failed to create webview window:", error);
    // Fallback to browser
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
