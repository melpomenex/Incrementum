import { useEffect, useRef } from "react";

/**
 * useEdgeSwipeForward
 *
 * Symmetric counterpart to useEdgeSwipeBack: a touch that starts at the RIGHT
 * edge of the screen and is dragged leftward triggers `onForward`.
 *
 * Same coexistence rules: edge-origin only, horizontal-locked, and
 * preventDefault only during an actively-recognized gesture.
 *
 * @param onForward Fired when a valid edge-forward gesture completes.
 */
export interface EdgeSwipeForwardOptions {
  /** Distance from the right edge (px) within which a touch counts as an edge start. */
  edgeWidth?: number;
  /** Minimum horizontal travel (px, leftward) required to trigger. */
  minDistance?: number;
  /** Disabled flag. */
  disabled?: boolean;
}

export function useEdgeSwipeForward(
  onForward: () => void,
  options: EdgeSwipeForwardOptions = {}
) {
  const { edgeWidth = 24, minDistance = 60, disabled = false } = options;

  const onForwardRef = useRef(onForward);
  onForwardRef.current = onForward;

  useEffect(() => {
    if (disabled) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;
    let horizontal = false;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        tracking = false;
        return;
      }
      const t = e.touches[0];
      const vw = window.innerWidth || document.documentElement.clientWidth;
      if (t.clientX >= vw - edgeWidth) {
        startX = t.clientX;
        startY = t.clientY;
        tracking = true;
        horizontal = false;
      } else {
        tracking = false;
      }
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (!horizontal && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        horizontal = true;
      }
      if (horizontal && dx < 0) {
        e.preventDefault();
      }
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      tracking = false;
      // Leftward travel → dx is negative.
      if (horizontal && -dx >= minDistance && Math.abs(dx) > Math.abs(dy)) {
        onForwardRef.current();
      }
      horizontal = false;
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
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
