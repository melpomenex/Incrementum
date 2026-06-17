import { Sparkle } from "@phosphor-icons/react";
import { cn } from "../../../utils";

interface SummaryBadgeProps {
  /** Whether the badge is visible */
  isVisible: boolean;
  /** Callback when badge is clicked */
  onClick: () => void;
  /** Optional className for styling */
  className?: string;
}

/**
 * Inline badge component shown when a summary is available but panel is closed
 */
export function SummaryBadge({ isVisible, onClick, className }: SummaryBadgeProps) {
  if (!isVisible) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs",
        "bg-primary/10 text-primary hover:bg-primary/20",
        "rounded-full transition-colors animate-in fade-in slide-in-from-top-2",
        className
      )}
    >
      <Sparkle className="w-3 h-3" />
      <span>AI Summary</span>
    </button>
  );
}
