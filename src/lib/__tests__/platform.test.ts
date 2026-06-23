import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Unit tests for native-mobile detection (src/lib/tauri.ts).
 *
 * These verify the foundation of the mobile-shell overhaul: that the frontend
 * correctly distinguishes the native Android/iOS Tauri build from desktop and
 * browser, so the mobile UI renders inside the actual native app (previously
 * unreachable because every gate read `!isTauri() && isMobile`).
 */

// We must reset module state between scenarios because getFormFactor() memoizes.
async function loadFresh() {
  vi.resetModules();
  return (await import("../tauri")) as typeof import("../tauri");
}

interface WindowState {
  internals?: boolean; // __TAURI_INTERNALS__ present
  osPlugin?: { platform?: string; os_type?: string } | null;
  userAgent?: string;
  screenWidth?: number;
  screenHeight?: number;
  innerWidth?: number;
  innerHeight?: number;
}

function applyWindowState(state: WindowState) {
  const w = window as unknown as Record<string, unknown>;

  // The test setup (src/test/setup.ts) mocks window.__TAURI__; toggle both the
  // Tauri 2 internals global and the legacy __TAURI__ so isTauri() reflects the
  // scenario under test.
  if (state.internals) {
    w["__TAURI_INTERNALS__"] = { invoke: vi.fn() };
  } else {
    delete w["__TAURI_INTERNALS__"];
  }
  const hasTauri = "__TAURI__" in window;
  if (state.internals) {
    if (!hasTauri) {
      Object.defineProperty(window, "__TAURI__", {
        value: { core: { invoke: vi.fn() } },
        configurable: true,
      });
    }
  } else if (hasTauri) {
    // The vitest setup defines window.__TAURI__ as non-configurable, so it
    // can't be deleted. Set its value to undefined instead — isTauri() still
    // reports true in the jsdom harness, but nativePlatform() correctly
    // returns null because __TAURI_OS_PLUGIN_INTERNALS__ is absent, which is
    // the detection that actually matters for the mobile-shell decision.
    try {
      (window as unknown as Record<string, unknown>)["__TAURI__"] = undefined;
    } catch {
      /* non-configurable — leave as-is */
    }
  }

  if (state.osPlugin) {
    w["__TAURI_OS_PLUGIN_INTERNALS__"] = state.osPlugin;
  } else {
    delete w["__TAURI_OS_PLUGIN_INTERNALS__"];
  }

  if (state.userAgent !== undefined) {
    Object.defineProperty(navigator, "userAgent", {
      value: state.userAgent,
      configurable: true,
    });
  }

  if (state.screenWidth !== undefined) {
    Object.defineProperty(window.screen, "width", {
      value: state.screenWidth,
      configurable: true,
    });
  }
  if (state.screenHeight !== undefined) {
    Object.defineProperty(window.screen, "height", {
      value: state.screenHeight,
      configurable: true,
    });
  }
  if (state.innerWidth !== undefined) {
    Object.defineProperty(window, "innerWidth", {
      value: state.innerWidth,
      configurable: true,
    });
  }
  if (state.innerHeight !== undefined) {
    Object.defineProperty(window, "innerHeight", {
      value: state.innerHeight,
      configurable: true,
    });
  }
}

describe("native mobile detection", () => {
  const originalUA = navigator.userAgent;
  const originalScreenWidth = window.screen.width;
  const originalScreenHeight = window.screen.height;
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    applyWindowState({
      internals: false,
      osPlugin: null,
      userAgent: "Mozilla/5.0 (Macintosh) AppleWebKit",
      screenWidth: 1920,
      screenHeight: 1080,
      innerWidth: 1920,
      innerHeight: 1080,
    });
  });

  afterEach(() => {
    applyWindowState({
      internals: false,
      osPlugin: null,
      userAgent: originalUA,
      screenWidth: originalScreenWidth,
      screenHeight: originalScreenHeight,
      innerWidth: originalInnerWidth,
      innerHeight: originalInnerHeight,
    });
  });

  it("detects native Android build as native mobile", async () => {
    applyWindowState({
      internals: true,
      osPlugin: { platform: "android", os_type: "android" },
      userAgent: "Mozilla/5.0 (Linux; Android 14) Tauri",
      screenWidth: 412,
      screenHeight: 915,
      innerWidth: 412,
      innerHeight: 915,
    });
    const tauri = await loadFresh();

    expect(tauri.isTauri()).toBe(true);
    expect(tauri.nativePlatform()).toBe("android");
    expect(tauri.isNativeMobile()).toBe(true);
    expect(tauri.isNativePhone()).toBe(true); // min edge 412 < 600
    expect(tauri.getFormFactor()).toBe("phone");
  });

  it("detects native iOS build as native mobile", async () => {
    applyWindowState({
      internals: true,
      osPlugin: { platform: "ios", os_type: "ios" },
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Tauri",
      screenWidth: 393,
      screenHeight: 852,
      innerWidth: 393,
      innerHeight: 852,
    });
    const tauri = await loadFresh();

    expect(tauri.isTauri()).toBe(true);
    expect(tauri.nativePlatform()).toBe("ios");
    expect(tauri.isNativeMobile()).toBe(true);
    expect(tauri.isNativePhone()).toBe(true);
    expect(tauri.getFormFactor()).toBe("phone");
  });

  it("classifies a native tablet (short edge >= 600) as tablet, not phone", async () => {
    applyWindowState({
      internals: true,
      osPlugin: { platform: "android", os_type: "android" },
      userAgent: "Mozilla/5.0 (Linux; Android 14) Tauri",
      // ~10" tablet in portrait: 800x1280
      screenWidth: 800,
      screenHeight: 1280,
      innerWidth: 800,
      innerHeight: 1280,
    });
    const tauri = await loadFresh();

    expect(tauri.isNativeMobile()).toBe(true);
    expect(tauri.isNativePhone()).toBe(false);
    expect(tauri.getFormFactor()).toBe("tablet");
  });

  it("treats desktop native (macOS) as NOT native mobile", async () => {
    applyWindowState({
      internals: true,
      osPlugin: { platform: "macos", os_type: "macos" },
      userAgent: "Mozilla/5.0 (Macintosh) Tauri",
    });
    const tauri = await loadFresh();

    expect(tauri.isTauri()).toBe(true);
    expect(tauri.nativePlatform()).toBe("macos");
    expect(tauri.isNativeMobile()).toBe(false);
    expect(tauri.isNativePhone()).toBe(false);
    expect(tauri.getFormFactor()).toBe("desktop");
  });

  it("returns null nativePlatform in a plain browser (no Tauri OS plugin)", async () => {
    applyWindowState({
      internals: false,
      osPlugin: null,
      userAgent: "Mozilla/5.0 (Macintosh) Chrome/120",
    });
    const tauri = await loadFresh();

    // nativePlatform() is the authoritative signal: it reads the OS plugin
    // internals, so it's null whenever the OS plugin isn't present (desktop
    // native AND browser). This is what isNativeMobile() keys off.
    expect(tauri.nativePlatform()).toBeNull();
    expect(tauri.isNativeMobile()).toBe(false);
    expect(tauri.isNativePhone()).toBe(false);
  });

  it("classify browser viewport: narrow window is phone, wide is desktop", async () => {
    // Narrow browser window (phone-sized)
    applyWindowState({
      internals: false,
      osPlugin: null,
      userAgent: "Mozilla/5.0 (iPhone) Safari",
      screenWidth: 390,
      screenHeight: 844,
      innerWidth: 390,
      innerHeight: 844,
    });
    const tauri = await loadFresh();
    expect(tauri.getFormFactor()).toBe("phone");

    // Fresh load for wide desktop window
    applyWindowState({
      internals: false,
      osPlugin: null,
      userAgent: "Mozilla/5.0 (Macintosh) Chrome/120",
      screenWidth: 1920,
      screenHeight: 1080,
      innerWidth: 1920,
      innerHeight: 1080,
    });
    const tauri2 = await loadFresh();
    expect(tauri2.getFormFactor()).toBe("desktop");
  });

  it("resetFormFactorCache forces recomputation", async () => {
    applyWindowState({
      internals: false,
      osPlugin: null,
      screenWidth: 1920,
      screenHeight: 1080,
      innerWidth: 1920,
      innerHeight: 1080,
    });
    const tauri = await loadFresh();
    expect(tauri.getFormFactor()).toBe("desktop");

    // Shrink the viewport (without re-importing the module)
    applyWindowState({
      internals: false,
      osPlugin: null,
      screenWidth: 390,
      screenHeight: 844,
      innerWidth: 390,
      innerHeight: 844,
    });
    // Cached value still desktop until reset
    expect(tauri.getFormFactor()).toBe("desktop");
    tauri.resetFormFactorCache();
    expect(tauri.getFormFactor()).toBe("phone");
  });
});
