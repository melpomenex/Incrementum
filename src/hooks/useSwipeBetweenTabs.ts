import { useEffect, useRef } from "react";

/**
 * useSwipeBetweenTabs
 *
 * Cycles between adjacent bottom-nav tabs on a full-width (non-edge)
 * horizontal swipe: swipe left → next tab, swipe right → previous tab.
 *
 * Coexistence with other gestures:
 *   - Edge-origin touches are ignored (those belong to the edge-swipe
 *     back/forward gestures).
 *   - Touches that START on a `.swipeable-item` (a queue row) are ignored so
 *     the row's own left/right swipe actions (postpone / suspend) are not
 *     hijacked. Only swipes begun on non-row chrome (header, padding, empty
 *     space) cycle tabs.
 *   - Vertical-dominant motion is ignored (lets scrolling through).
 *
 * @param onCycle Called with "left" (→ next) or "right" (→ previous) when a
 *                qualifying swipe completes. The caller maps that to the
 *                adjacent tab in PRIMARY_NAV_TAB_TYPES order.
 */
export interface SwipeBetweenTabsOptions {
  /** Distance from either screen edge (px) that is treated as edge territory. */
  edgeWidth?: number;
  /** Minimum horizontal travel (px) to count as a tab-cycle swipe. */
  minDistance?: number;
  /** Disabled flag (e.g. off on desktop / in fullscreen reading). */
  disabled?: boolean;
}

export function useSwipeBetweenTabs(
  onCycle: (direction: "left" | "right") => void,
  options: SwipeBetweenTabsOptions = {}
) {
  const { edgeWidth = 32, minDistance = 100, disabled = false } = options;

  const onCycleRef = useRef(onCycle);
  onCycleRef.current = onCycle;

  useEffect(() => {
    if (disabled) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;
    let decided = false;
    let isHorizontal = false;

    const onStart = (e: TouchEvent) => {
      decided = false;
      isHorizontal = false;
      if (e.touches.length !== 1) {
        tracking = false;
        return;
      }
      const t = e.touches[0];
      const vw = window.innerWidth || document.documentElement.clientWidth;
      // Skip edge territory — owned by edge-swipe back/forward.
      if (t.clientX <= edgeWidth || t.clientX >= vw - edgeWidth) {
        tracking = false;
        return;
      }
      // Skip touches that begin on a swipeable queue row — the row owns its
      // own horizontal gestures (postpone / suspend).
      const target = e.target as HTMLElement | null;
      if (target && target.closest(".swipeable-item")) {
        tracking = false;
        return;
      }
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      if (!isHorizontal) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) >= minDistance && Math.abs(dx) > Math.abs(dy)) {
        onCycleRef.current(dx < 0 ? "left" : "right");
      }
    };

    // We attach a *passive* move listener purely to classify intent early; we
    // never preventDefault here so vertical scrolling and inner gestures are
    // never disturbed. Classification flips `isHorizontal` so onEnd can decide.
    const onMove = (e: TouchEvent) => {
      if (!tracking || decided) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) > 14 || Math.abs(dy) > 14) {
        decided = true;
        isHorizontal = Math.abs(dx) > Math.abs(dy);
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [edgeWidth, minDistance, disabled]);
}
