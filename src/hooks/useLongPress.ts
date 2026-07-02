import { useRef, useCallback, useEffect } from "react";

/**
 * Detects a long-press on touch devices and fires `onLongPress` at the touch
 * coordinates. Returns spreadable handlers (`onTouchStart`, `onTouchMove`,
 * `onTouchEnd`, `onContextMenu`) that are safe to merge onto any element.
 *
 * On desktop (mouse), long-press is irrelevant — `onContextMenu` (right-click)
 * already opens context menus — so the touch logic is skipped when there's no
 * touch input. This keeps the hook cheap on desktop and avoids interfering with
 * normal clicks.
 *
 * The press threshold is 500ms (matches the Android platform convention). If the
 * user moves their finger >10px or the touch ends before the threshold, no
 * long-press fires (so scrolling a list never triggers it).
 *
 * Usage:
 *   const longPress = useLongPress((pos) => openMenu(pos, items));
 *   <div {...longPress}>...</div>
 */
export function useLongPress(
  onLongPress: (position: { x: number; y: number }) => void,
  options?: { threshold?: number; moveTolerance?: number },
): {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
  /** True if the long-press fired during the most recent touch. Handy to
   *  suppress a click that would otherwise immediately follow the press. */
  didFire: () => boolean;
} {
  const threshold = options?.threshold ?? 500;
  const moveTolerance = options?.moveTolerance ?? 10;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const triggeredRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      startPosRef.current = { x: touch.clientX, y: touch.clientY };
      triggeredRef.current = false;
      clear();
      timerRef.current = setTimeout(() => {
        if (startPosRef.current && !triggeredRef.current) {
          triggeredRef.current = true;
          // Use a haptic cue if available (Android Chrome WebView supports it).
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            try { navigator.vibrate(15); } catch { /* ignore */ }
          }
          onLongPress({ x: startPosRef.current.x, y: startPosRef.current.y });
        }
      }, threshold);
    },
    [threshold, onLongPress, clear],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!startPosRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = touch.clientX - startPosRef.current.x;
      const dy = touch.clientY - startPosRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > moveTolerance) {
        clear(); // user is scrolling, cancel the long-press
      }
    },
    [moveTolerance, clear],
  );

  const onTouchEnd = useCallback(() => {
    clear();
  }, [clear]);

  // Clean up on unmount.
  useEffect(() => clear, [clear]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel: onTouchEnd,
    didFire: () => triggeredRef.current,
  };
}
