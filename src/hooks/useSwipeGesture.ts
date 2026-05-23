/**
 * Swipe Gesture Hook
 * Detects swipe gestures for mobile/tablet review
 * Left = Again, Right = Easy, Up = Good, Down = Hard
 */

import { useRef, useCallback, useState, useEffect } from "react";

export type SwipeDirection = "left" | "right" | "up" | "down" | null;

interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  preventDefaultTouch?: boolean;
}

interface SwipeGestureState {
  direction: SwipeDirection;
  isSwiping: boolean;
  deltaX: number;
  deltaY: number;
}

interface UseSwipeGestureReturn {
  ref: React.RefObject<HTMLDivElement | null>;
  direction: SwipeDirection;
  isSwiping: boolean;
  deltaX: number;
  deltaY: number;
  reset: () => void;
}

export function useSwipeGesture(options: SwipeGestureOptions = {}): UseSwipeGestureReturn {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 100,
    preventDefaultTouch = false,
  } = options;

  const ref = useRef<HTMLDivElement | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const latestDelta = useRef({ deltaX: 0, deltaY: 0 });
  const [state, setState] = useState<SwipeGestureState>({
    direction: null,
    isSwiping: false,
    deltaX: 0,
    deltaY: 0,
  });

  const reset = useCallback(() => {
    setState({
      direction: null,
      isSwiping: false,
      deltaX: 0,
      deltaY: 0,
    });
    touchStart.current = null;
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStart.current = { x: touch.clientX, y: touch.clientY };
      setState((prev) => ({ ...prev, isSwiping: true }));
    },
    []
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!touchStart.current) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStart.current.x;
      const deltaY = touch.clientY - touchStart.current.y;

      // Determine direction based on delta
      let direction: SwipeDirection = null;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX > threshold || absY > threshold) {
        if (absX > absY) {
          direction = deltaX > 0 ? "right" : "left";
        } else {
          direction = deltaY > 0 ? "down" : "up";
        }
      }

      latestDelta.current = { deltaX, deltaY };

      setState((prev) => ({
        ...prev,
        deltaX,
        deltaY,
        direction,
      }));

      if (preventDefaultTouch && (absX > 10 || absY > 10)) {
        e.preventDefault();
      }
    },
    [threshold, preventDefaultTouch]
  );

  const handleTouchEnd = useCallback(() => {
    if (!touchStart.current) return;

    const { deltaX, deltaY } = latestDelta.current;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Only trigger if swipe is significant
    if (absX > threshold || absY > threshold) {
      if (absX > absY) {
        if (deltaX > 0) {
          onSwipeRight?.();
        } else {
          onSwipeLeft?.();
        }
      } else {
        if (deltaY > 0) {
          onSwipeDown?.();
        } else {
          onSwipeUp?.();
        }
      }
    }

    reset();
  }, [threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, reset]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: !preventDefaultTouch });
    element.addEventListener("touchend", handleTouchEnd);

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, preventDefaultTouch]);

  return {
    ref,
    direction: state.direction,
    isSwiping: state.isSwiping,
    deltaX: state.deltaX,
    deltaY: state.deltaY,
    reset,
  };
}

/**
 * Get swipe indicator style based on direction
 */
export function getSwipeIndicatorStyle(
  direction: SwipeDirection,
  deltaX: number,
  deltaY: number
): {
  opacity: number;
  backgroundColor: string;
  transform: string;
} {
  if (!direction) {
    return {
      opacity: 0,
      backgroundColor: "transparent",
      transform: "translate(-50%, -50%)",
    };
  }

  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  const maxDelta = Math.max(absX, absY);
  const opacity = Math.min(1, maxDelta / 150);

  const styles: Record<string, { color: string; transform: string }> = {
    left: {
      color: "rgba(239, 68, 68, 0.3)", // red
      transform: `translateX(${Math.min(50, -absX / 3)}px)`,
    },
    right: {
      color: "rgba(34, 197, 94, 0.3)", // green
      transform: `translateX(${Math.min(50, absX / 3)}px)`,
    },
    up: {
      color: "rgba(59, 130, 246, 0.3)", // blue
      transform: `translateY(${Math.min(50, -absY / 3)}px)`,
    },
    down: {
      color: "rgba(249, 115, 22, 0.3)", // orange
      transform: `translateY(${Math.min(50, absY / 3)}px)`,
    },
  };

  const style = styles[direction] || styles.left;

  return {
    opacity,
    backgroundColor: style.color,
    transform: style.transform,
  };
}

/**
 * Swipe Rating Labels
 */
export const SWIPE_RATINGS = {
  left: { rating: 1, label: "Again", color: "bg-red-500" },
  right: { rating: 4, label: "Easy", color: "bg-green-500" },
  up: { rating: 3, label: "Good", color: "bg-blue-500" },
  down: { rating: 2, label: "Hard", color: "bg-orange-500" },
} as const;

export default useSwipeGesture;
