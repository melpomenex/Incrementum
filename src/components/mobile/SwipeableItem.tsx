/**
 * SwipeableItem - A wrapper component that provides swipe gesture actions
 *
 * Features:
 * - Horizontal swipe actions (left/right)
 * - Progressive visual feedback with color-coded backgrounds
 * - Snap-back animation for cancelled swipes
 * - Haptic feedback on action completion
 * - Configurable actions with icons and colors
 */

import { ReactNode, useRef, useEffect } from "react";
import { useSwipeGestures, type SwipeGestureOptions } from "../../hooks/useSwipeGestures";
import { cn } from "../../utils";

export interface SwipeAction {
  icon: ReactNode;
  label: string;
  color: string;
  bgColor: string;
}

interface SwipeableItemProps {
  children: ReactNode;
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeComplete?: (direction: "left" | "right") => void;
  disabled?: boolean;
  threshold?: number;
  className?: string;
}

const DEFAULT_ACTION: SwipeAction = {
  icon: null,
  label: "",
  color: "#6366f1",
  bgColor: "rgba(99, 102, 241, 0.1)",
};

export function SwipeableItem({
  children,
  leftAction,
  rightAction,
  onSwipeLeft,
  onSwipeRight,
  onSwipeComplete,
  disabled = false,
  threshold = 80,
  className,
}: SwipeableItemProps) {
  const { state, elementRef, triggerHaptic } = useSwipeGestures(
    {
      onSwipeLeft: () => {
        if (!disabled && onSwipeLeft) {
          triggerHaptic();
          onSwipeLeft();
          onSwipeComplete?.("left");
        }
      },
      onSwipeRight: () => {
        if (!disabled && onSwipeRight) {
          triggerHaptic();
          onSwipeRight();
          onSwipeComplete?.("right");
        }
      },
    },
    {
      threshold,
      disabled,
      preventDefaultOnSwipe: true,
    }
  );

  const itemRef = useRef<HTMLDivElement>(null);

  // Sync refs
  useEffect(() => {
    if (elementRef.current !== itemRef.current) {
      (elementRef as React.RefObject<HTMLDivElement>).current = itemRef.current;
    }
  }, [elementRef]);

  // Calculate which action is being revealed
  const revealingAction =
    state.direction === "left" && leftAction
      ? leftAction
      : state.direction === "right" && rightAction
        ? rightAction
        : null;

  // Calculate background style based on swipe progress
  const getBackgroundStyle = () => {
    if (!revealingAction || !state.isDragging) return {};

    const progress = Math.min(state.progress, 1);
    const opacity = progress * 0.8;
    const isLeft = state.direction === "left";

    return {
      position: "absolute" as const,
      top: 0,
      [isLeft ? "left" : "right"]: 0,
      width: `${Math.abs(state.offsetX)}px`,
      height: "100%",
      backgroundColor: revealingAction.bgColor,
      opacity,
      display: "flex",
      alignItems: "center",
      justifyContent: isLeft ? "flex-start" : "flex-end",
      padding: "0 16px",
      transition: "none",
      pointerEvents: "none" as const,
    };
  };

  // Calculate icon transform based on progress
  const getIconStyle = () => {
    if (!revealingAction || !state.isDragging) return {};

    const progress = Math.min(state.progress, 1);
    return {
      transform: `scale(${0.5 + progress * 0.5})`,
      opacity: progress,
      color: revealingAction.color,
    };
  };

  return (
    <div
      ref={itemRef}
      className={cn(
        "swipeable-item",
        "relative",
        "overflow-hidden",
        "touch-action-none",
        disabled && "pointer-events-none opacity-50",
        className
      )}
      style={{
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {/* Left Action Background */}
      {leftAction && state.direction === "left" && state.isDragging && (
        <div style={getBackgroundStyle()}>
          <div
            className="flex items-center gap-2"
            style={getIconStyle()}
          >
            <span className="text-sm font-medium">{leftAction.label}</span>
            {leftAction.icon}
          </div>
        </div>
      )}

      {/* Right Action Background */}
      {rightAction && state.direction === "right" && state.isDragging && (
        <div style={getBackgroundStyle()}>
          <div
            className="flex items-center gap-2"
            style={getIconStyle()}
          >
            {rightAction.icon}
            <span className="text-sm font-medium">{rightAction.label}</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div
        className="relative z-10 transition-transform duration-200 ease-out"
        style={{
          transform: `translateX(${state.offsetX}px)`,
        }}
      >
        {children}
      </div>

      {/* Action Indicator Line */}
      {revealingAction && state.isDragging && (
        <div
          className={cn(
            "absolute top-0 bottom-0 w-1",
            "transition-opacity duration-150",
            state.direction === "left" ? "left-0" : "right-0"
          )}
          style={{
            backgroundColor: revealingAction.color,
            opacity: state.progress * 0.8,
          }}
        />
      )}
    </div>
  );
}

/**
 * Predefined action configurations for common use cases
 */
export const SwipeActions = {
  markRead: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    label: "Mark as Read",
    color: "#22c55e",
    bgColor: "rgba(34, 197, 94, 0.15)",
  } as SwipeAction,

  favorite: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    label: "Favorite",
    color: "#eab308",
    bgColor: "rgba(234, 179, 8, 0.15)",
  } as SwipeAction,

  archive: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="21 8 21 21 3 21 3 8" />
        <rect x="1" y="3" width="22" height="5" />
        <line x1="10" y1="12" x2="14" y2="12" />
      </svg>
    ),
    label: "Archive",
    color: "#6366f1",
    bgColor: "rgba(99, 102, 241, 0.15)",
  } as SwipeAction,

  delete: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </svg>
    ),
    label: "Delete",
    color: "#ef4444",
    bgColor: "rgba(239, 68, 68, 0.15)",
  } as SwipeAction,
};
