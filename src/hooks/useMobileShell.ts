/**
 * Mobile-shell decision hook — the single source of truth for "should the UI
 * render its mobile form instead of the desktop tabbed interface?"
 *
 * Rules (confirmed):
 *  - Native phone build: always mobile shell (even rotated wide — a phone
 *    can't usefully run the desktop split-pane UI).  ← unreachable before;
 *    isTauri() gated the whole mobile shell off.
 *  - Native tablet build: mobile shell when the current viewport is narrow
 *    (< 1024px, e.g. portrait), desktop tabbed UI when wide (landscape).
 *  - Browser / PWA: mobile shell when viewport < 1024px, desktop otherwise.
 *
 * This replaces the broken `!isTauri() && isMobile` pattern that made the
 * mobile UI dormant inside the shipped native app. Every former mobile gate
 * should call this hook instead of combining `isTauri()` + `getDeviceInfo()`.
 */

import { useEffect, useState } from "react";
import { isNativePhone, getFormFactor, resetFormFactorCache } from "../lib/tauri";

function computeMobileShell(): boolean {
  // Native phone: always mobile, regardless of orientation/viewport.
  if (isNativePhone()) return true;
  // Native tablet or browser/PWA: viewport-driven.
  return getFormFactor() !== "desktop";
}

export function useMobileShell(): boolean {
  const [mobileShell, setMobileShell] = useState<boolean>(() => computeMobileShell());

  useEffect(() => {
    let rafId: number | null = null;

    const schedule = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        resetFormFactorCache();
        setMobileShell(computeMobileShell());
      });
    };

    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
    };
  }, []);

  return mobileShell;
}
