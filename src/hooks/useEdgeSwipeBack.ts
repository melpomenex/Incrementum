import { useEffect, useRef } from "react";

/**
 * useEdgeSwipeBack
 *
 * Detects an iOS/Android-style system "back" gesture: a touch that starts at
 * the left edge of the screen and is dragged rightward.
 *
 * Coexists with vertical scrolling and inner swipe gestures (e.g.
 * SwipeableItem's left/right actions) because:
 *   - It only engages when the touch ORIGINATES within `edgeWidth` px of the
 *     left screen edge. Inner swipes start mid-screen and are ignored here.
 *   - It only `preventDefault`s during an actively-recognized edge gesture, so
 *     normal scrolling elsewhere is unaffected.
 *
 * @param onBack   Fired when a valid edge-back gesture completes.
 * @param options  Tunables (defaults chosen to match OS muscle memory).
 */
export interface EdgeSwipeBackOptions {
  /** Distance from the left edge (px) within which a touch counts as an edge start. */
  edgeWidth?: number;
  /** Minimum horizontal travel (px) required to trigger. */
  minDistance?: number;
  /** Disabled flag (e.g. off in fullscreen reading, off on desktop). */
  disabled?: boolean;
}

export function useEdgeSwipeBack(
  onBack: () => void,
  options: EdgeSwipeBackOptions = {}
) {
  const { edgeWidth = 24, minDistance = 60, disabled = false } = options;

  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

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
      if (t.clientX <= edgeWidth) {
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
      // Lock to "this is a horizontal gesture" once horizontal intent is clear.
      if (!horizontal && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        horizontal = true;
      }
      // Once committed horizontal, suppress the browser's default (e.g. text
      // selection, native back-swipe in some webviews) so the gesture feels
      // owned. Vertical movement is left untouched so scrolling still works.
      if (horizontal && dx > 0) {
        e.preventDefault();
      }
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      tracking = false;
      if (horizontal && dx >= minDistance && Math.abs(dx) > Math.abs(dy)) {
        onBackRef.current();
      }
      horizontal = false;
    };

    // Attach to window so the gesture works regardless of which child element
    // is under the finger at the edge. touchmove must be non-passive to allow
    // preventDefault during an active gesture.
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
