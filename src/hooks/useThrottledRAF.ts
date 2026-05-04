/**
 * Throttled requestAnimationFrame hook.
 *
 * Provides a timestamp-gated RAF loop that limits execution to a target FPS.
 * The RAF callback still fires (keeping the loop alive), but the render function
 * only executes when enough time has elapsed.
 *
 * Design decision D1: No external dependency. Five lines of code solve it.
 */

import { useRef, useCallback, useEffect } from "react";

export interface ThrottledRAFOptions {
  /** Target frames per second (default 30) */
  fps?: number;
  /** Whether the loop is currently paused */
  paused?: boolean;
}

/**
 * Returns a stable `frame` callback to register the RAF ID and a `start`/`stop` pair.
 *
 * Usage:
 * ```tsx
 * const { frame } = useThrottledRAF(30);
 *
 * // Inside animation function:
 * const draw = () => {
 *   // ... render work ...
 *   frame(requestAnimationFrame(draw));
 * };
 * draw();
 * ```
 */
export function useThrottledRAF(fps: number, paused: boolean = false) {
  const lastTimeRef = useRef(0);
  const frameIntervalRef = useRef(1000 / fps);
  const pendingRAFRef = useRef<number | null>(null);

  frameIntervalRef.current = 1000 / fps;

  // Cancel any pending RAF when paused changes to true or on unmount
  useEffect(() => {
    if (paused && pendingRAFRef.current !== null) {
      cancelAnimationFrame(pendingRAFRef.current);
      pendingRAFRef.current = null;
    }
    return () => {
      if (pendingRAFRef.current !== null) {
        cancelAnimationFrame(pendingRAFRef.current);
        pendingRAFRef.current = null;
      }
    };
  }, [paused]);

  /**
   * Wrap a RAF loop's draw function so it only fires at the target FPS.
   * Returns the throttled version — call it inside your RAF loop.
   *
   * @param drawFn The expensive render function to throttle
   * @returns An object with `start()`, `stop()`, and `frame(id)` for cleanup
   */
  const throttle = useCallback(
    (drawFn: (timestamp: number, delta: number) => void) => {
      let active = true;

      const loop = (timestamp: number) => {
        if (!active || paused) return;

        const elapsed = timestamp - lastTimeRef.current;
        if (elapsed >= frameIntervalRef.current) {
          // Align to frame interval to prevent drift
          lastTimeRef.current = timestamp - (elapsed % frameIntervalRef.current);
          drawFn(timestamp, elapsed);
        }

        pendingRAFRef.current = requestAnimationFrame(loop);
      };

      return {
        start() {
          active = true;
          lastTimeRef.current = 0; // Reset to start immediately
          pendingRAFRef.current = requestAnimationFrame(loop);
        },
        stop() {
          active = false;
          if (pendingRAFRef.current !== null) {
            cancelAnimationFrame(pendingRAFRef.current);
            pendingRAFRef.current = null;
          }
        },
      };
    },
    [paused]
  );

  return throttle;
}

/**
 * Check if a given timestamp should trigger a frame at the target FPS.
 * Stateless version for use inside existing RAF loops.
 */
export function shouldFrame(
  timestamp: number,
  lastTimeRef: { current: number },
  fps: number
): boolean {
  const interval = 1000 / fps;
  const elapsed = timestamp - lastTimeRef.current;
  if (elapsed >= interval) {
    lastTimeRef.current = timestamp - (elapsed % interval);
    return true;
  }
  return false;
}
