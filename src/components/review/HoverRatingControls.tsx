import { useState, useEffect, useCallback } from "react";
import { cn } from "../../utils";
import { submitReview, previewReviewIntervals, type ReviewRating, type PreviewIntervals, RATING_LABELS, formatInterval } from "../../api/review";
import { useSettingsStore } from "../../stores/settingsStore";
import { getDeviceInfo } from "../../lib/pwa";

export interface HoverRatingControlsProps {
  itemId?: string | null;
  documentId?: string;
  onRatingSubmitted?: (rating: ReviewRating) => void;
  disabled?: boolean;
  forceVisible?: boolean;
  context: "review" | "document";
  previewIntervals?: PreviewIntervals | null;
  className?: string;
  position?: "fixed" | "absolute";
  disableBackdropBlur?: boolean;
  /** Use compact floating button mode instead of hover zone (recommended for mobile EPUB) */
  compactMode?: boolean;
}

// Rating colors from the plan
const RATING_COLORS: Record<ReviewRating, { bg: string; hover: string; text: string }> = {
  1: { bg: "#B00020", hover: "#8B0018", text: "text-white" },     // Again - red
  2: { bg: "#F57C00", hover: "#C56300", text: "text-white" },     // Hard - orange
  3: { bg: "#388E3C", hover: "#2C702F", text: "text-white" },     // Good - green
  4: { bg: "#1976D2", hover: "#1464B8", text: "text-white" },     // Easy - blue
};

const RATING_SHORTCUTS: Record<ReviewRating, string> = {
  1: "1",
  2: "2",
  3: "3",
  4: "4",
};

export function HoverRatingControls({
  itemId,
  documentId: _documentId,
  onRatingSubmitted,
  disabled = false,
  forceVisible = false,
  context,
  previewIntervals: initialPreviewIntervals = null,
  className,
  position = "fixed",
  disableBackdropBlur = false,
  compactMode = false,
}: HoverRatingControlsProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewIntervals, setPreviewIntervals] = useState<PreviewIntervals | null>(initialPreviewIntervals);
  const [hoverZoneActive, setHoverZoneActive] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Detect mobile for padding adjustment
  const deviceInfo = getDeviceInfo();
  const isMobile = deviceInfo.isMobile || deviceInfo.isTablet;

  // Load preview intervals when itemId changes
  useEffect(() => {
    if (itemId && context === "review") {
      const settings = useSettingsStore.getState().settings;
      previewReviewIntervals(itemId, settings.learning.algorithm)
        .then(setPreviewIntervals)
        .catch((err) => console.error("Failed to load preview intervals:", err));
    }
  }, [itemId, context]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (disabled || !isVisible && !forceVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle 1-4 keys
      if (e.key >= "1" && e.key <= "4") {
        const rating = parseInt(e.key) as ReviewRating;
        handleRating(rating);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, isVisible, forceVisible]);

  const handleRating = useCallback(async (rating: ReviewRating) => {
    if (disabled || isSubmitting) return;
    if (context === "review" && !itemId) return;

    setIsSubmitting(true);
    try {
      // In document context, we still submit but might not have a learning item
      if (context === "review") {
        await submitReview(itemId, rating, 0);
      }

      onRatingSubmitted?.(rating);
    } catch (error) {
      console.error("Failed to submit rating:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [disabled, isSubmitting, itemId, context, onRatingSubmitted]);

  const positionClass = position === "absolute" ? "absolute" : "fixed";

  // Compact mode: floating button that expands into rating panel
  if (compactMode) {
    return (
      <div className={cn(`${positionClass} bottom-20 right-4 z-50`, className)}>
        {/* Floating rating button */}
        {!isExpanded ? (
          <button
            onClick={() => setIsExpanded(true)}
            disabled={disabled}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full shadow-lg",
              "bg-primary text-primary-foreground",
              "transition-all duration-200 active:scale-95",
              "hover:shadow-xl",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <span className="text-sm font-medium">Rate</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
        ) : (
          /* Expanded rating panel */
          <div
            className={cn(
              "bg-card border border-border rounded-2xl shadow-2xl p-3",
              "transition-all duration-200"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground">Rate this document</span>
              <button
                onClick={() => setIsExpanded(false)}
                className="ml-auto p-1 rounded-full hover:bg-muted"
                aria-label="Close"
              >
                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-2">
              {(Object.keys(RATING_LABELS) as unknown as ReviewRating[]).slice(0, 4).map((rating) => {
                const colors = RATING_COLORS[rating];
                const label = RATING_LABELS[rating];

                return (
                  <button
                    key={rating}
                    onClick={() => {
                      handleRating(rating);
                      setIsExpanded(false);
                    }}
                    disabled={disabled || isSubmitting}
                    className={cn(
                      "flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg flex-1",
                      "transition-all duration-150 active:scale-95",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "hover:shadow-md",
                      colors.text
                    )}
                    style={{
                      backgroundColor: colors.bg,
                    }}
                    title={label}
                  >
                    <span className="text-sm font-bold">{label}</span>
                  </button>
                );
              })}
              {isSubmitting && (
                <div className="flex items-center justify-center px-3">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Original hover-based mode
  return (
    <div
      className={cn(
        `${positionClass} bottom-0 left-0 right-0 z-50 pointer-events-none`,
        className
      )}
      onMouseEnter={() => setHoverZoneActive(true)}
      onMouseLeave={() => setHoverZoneActive(false)}
    >
      {/* Large invisible hover zone */}
      <div
        className="h-32 w-full pointer-events-auto"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      />

      {/* Rating controls */}
      <div
        className={cn(
          `${positionClass} bottom-0 left-0 right-0 border-t border-border`,
          disableBackdropBlur ? "bg-card" : "bg-card/95 backdrop-blur-sm",
          "transition-all duration-200 ease-out pointer-events-auto",
          (isVisible || forceVisible || hoverZoneActive)
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4",
          // Add padding for mobile bottom nav (approximately 70px + safe area)
          isMobile && "pb-[calc(70px+env(safe-area-inset-bottom,0px))]"
        )}
        style={{ zIndex: 50 }}
      >
        <div className={cn("max-w-4xl mx-auto p-4", isMobile && "pb-2")}>
          <div className="flex items-center justify-center gap-3">
            {(Object.keys(RATING_LABELS) as unknown as ReviewRating[]).map((rating) => {
              const colors = RATING_COLORS[rating];
              const label = RATING_LABELS[rating];
              const shortcut = RATING_SHORTCUTS[rating];
              const interval = previewIntervals?.[rating === 1 ? "again" : rating === 2 ? "hard" : rating === 3 ? "good" : "easy"];

              return (
                <button
                  key={rating}
                  onClick={() => handleRating(rating)}
                  disabled={disabled || isSubmitting}
                  className={cn(
                    "flex flex-col items-center gap-1 px-6 py-3 rounded-lg",
                    "transition-all duration-150 active:scale-95",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "hover:shadow-md hover:-translate-y-0.5",
                    colors.text
                  )}
                  style={{
                    backgroundColor: colors.bg,
                  }}
                  onMouseEnter={(e) => {
                    if (!disabled && !isSubmitting) {
                      e.currentTarget.style.backgroundColor = colors.hover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = colors.bg;
                  }}
                  title={`${label} (${shortcut})`}
                >
                  <span className="text-lg font-bold">{label}</span>
                  <span className="text-xs opacity-80">[{shortcut}]</span>
                  {context === "review" && interval !== undefined && (
                    <span className="text-xs opacity-70">
                      {formatInterval(interval)}
                    </span>
                  )}
                </button>
              );
            })}

            {isSubmitting && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground ml-4">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Submitting...
              </div>
            )}
          </div>

          {/* Help text */}
          <div className="text-center mt-2 text-xs text-muted-foreground">
            Press 1-4 to rate • Hover near bottom to show controls
          </div>
        </div>
      </div>
    </div>
  );
}
