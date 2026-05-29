import { useRef, useCallback, useEffect, useState } from "react";
import { supportsHaptics } from "../utils/soundService";

export interface SwipeActions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

export interface SwipeGestureOptions {
  threshold?: number; // Minimum distance in px to trigger action
  velocityThreshold?: number; // Minimum velocity in px/ms
  disabled?: boolean;
  preventDefaultOnSwipe?: boolean;
}

export interface SwipeGestureState {
  offsetX: number;
  offsetY: number;
  isDragging: boolean;
  direction: "left" | "right" | "up" | "down" | null;
  progress: number; // 0 to 1 for action reveal
}

const SWIPE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 0.3;
const SNAP_BACK_DURATION = 300;

export function useSwipeGestures(
  actions: SwipeActions,
  options: SwipeGestureOptions = {}
) {
  const {
    threshold = SWIPE_THRESHOLD,
    velocityThreshold = VELOCITY_THRESHOLD,
    disabled = false,
    preventDefaultOnSwipe = true,
  } = options;

  const [state, setState] = useState<SwipeGestureState>({
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    direction: null,
    progress: 0,
  });

  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);
  const currentX = useRef(0);
  const currentY = useRef(0);
  const elementRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Determine if swipe is horizontal or vertical based on primary direction
  const getSwipeDirection = useCallback((dx: number, dy: number) => {
    return Math.abs(dx) > Math.abs(dy)
      ? dx > 0 ? "right" : "left"
      : dy > 0 ? "down" : "up";
  }, []);

  // Trigger the appropriate action
  const triggerAction = useCallback(
    (direction: "left" | "right" | "up" | "down", velocity: number) => {
      if (velocity < velocityThreshold) {
        return false;
      }

      switch (direction) {
        case "left":
          actions.onSwipeLeft?.();
          return true;
        case "right":
          actions.onSwipeRight?.();
          return true;
        case "up":
          actions.onSwipeUp?.();
          return true;
        case "down":
          actions.onSwipeDown?.();
          return true;
      }
      return false;
    },
    [actions, velocityThreshold]
  );

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled) return;

      const touch = e.touches[0];
      startX.current = touch.clientX;
      startY.current = touch.clientY;
      currentX.current = touch.clientX;
      currentY.current = touch.clientY;
      startTime.current = Date.now();

      setState({
        offsetX: 0,
        offsetY: 0,
        isDragging: true,
        direction: null,
        progress: 0,
      });

      // Cancel any pending animation
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    },
    [disabled]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!state.isDragging || disabled) return;

      const touch = e.touches[0];
      const dx = touch.clientX - startX.current;
      const dy = touch.clientY - startY.current;
      const direction = getSwipeDirection(dx, dy);

      currentX.current = touch.clientX;
      currentY.current = touch.clientY;

      // Calculate progress (0 to 1) based on threshold
      const distance = direction === "left" || direction === "right"
        ? Math.abs(dx)
        : Math.abs(dy);
      const progress = Math.min(distance / threshold, 1);

      setState({
        offsetX: dx,
        offsetY: dy,
        isDragging: true,
        direction,
        progress,
      });

      // Prevent default scroll if needed and we're swiping horizontally
      if (preventDefaultOnSwipe && (direction === "left" || direction === "right")) {
        e.preventDefault();
      }
    },
    [state.isDragging, disabled, threshold, getSwipeDirection, preventDefaultOnSwipe]
  );

  const handleTouchEnd = useCallback(
    () => {
      if (!state.isDragging || disabled) return;

      const endTime = Date.now();
      const dt = endTime - startTime.current;
      const dx = currentX.current - startX.current;
      const dy = currentY.current - startY.current;

      const distance = Math.sqrt(dx * dx + dy * dy);
      const velocity = distance / dt;
      const direction = getSwipeDirection(dx, dy);

      const actionTriggered = triggerAction(
        direction,
        velocity
      );

      if (!actionTriggered) {
        // Snap back animation
        const startTime = performance.now();
        const startOffsetX = state.offsetX;
        const startOffsetY = state.offsetY;

        const animate = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / SNAP_BACK_DURATION, 1);
          const easeOut = 1 - Math.pow(1 - progress, 3); // Cubic ease out

          setState({
            offsetX: startOffsetX * (1 - easeOut),
            offsetY: startOffsetY * (1 - easeOut),
            isDragging: progress < 1,
            direction: state.direction,
            progress: state.progress * (1 - easeOut),
          });

          if (progress < 1) {
            rafRef.current = requestAnimationFrame(animate);
          } else {
            setState({
              offsetX: 0,
              offsetY: 0,
              isDragging: false,
              direction: null,
              progress: 0,
            });
          }
        };

        rafRef.current = requestAnimationFrame(animate);
      } else {
        // Reset state after action
        setState({
          offsetX: 0,
          offsetY: 0,
          isDragging: false,
          direction: null,
          progress: 0,
        });
      }
    },
    [state, disabled, triggerAction, getSwipeDirection]
  );

  // Attach event listeners to element
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener("touchstart", handleTouchStart, { passive: !preventDefaultOnSwipe });
    element.addEventListener("touchmove", handleTouchMove, { passive: !preventDefaultOnSwipe });
    element.addEventListener("touchend", handleTouchEnd);
    element.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
      element.removeEventListener("touchcancel", handleTouchEnd);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, preventDefaultOnSwipe]);

  // Haptic feedback utility
  const triggerHaptic = useCallback(() => {
    if (supportsHaptics()) {
      navigator.vibrate(10); // Light tap
    }
  }, []);

  return {
    state,
    elementRef,
    triggerHaptic,
    reset: () => setState({
      offsetX: 0,
      offsetY: 0,
      isDragging: false,
      direction: null,
      progress: 0,
    }),
  };
}
