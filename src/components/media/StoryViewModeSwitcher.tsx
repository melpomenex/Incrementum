/**
 * StoryViewModeSwitcher
 * Toolbar buttons/dropdown for Feed/Original/Text/Story view modes
 */

import {
  ArrowSquareOut,
  BookOpen,
  Newspaper,
  TextT,
} from "@phosphor-icons/react";

export type StoryViewMode = "feed" | "original" | "text" | "story";

interface StoryViewModeSwitcherProps {
  currentMode: StoryViewMode;
  onModeChange: (mode: StoryViewMode) => void;
  compact?: boolean;
}

const modes: { id: StoryViewMode; label: string; icon: React.ReactNode }[] = [
  { id: "feed", label: "Feed", icon: <Newspaper className="w-3.5 h-3.5" /> },
  { id: "original", label: "Original", icon: <ArrowSquareOut className="w-3.5 h-3.5" /> },
  { id: "text", label: "Text", icon: <TextT className="w-3.5 h-3.5" /> },
  { id: "story", label: "Story", icon: <BookOpen className="w-3.5 h-3.5" /> },
];

export function StoryViewModeSwitcher({ currentMode, onModeChange, compact }: StoryViewModeSwitcherProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-0.5 bg-muted/60 rounded-lg p-0.5">
        {modes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => onModeChange(mode.id)}
            className={`p-1.5 rounded-md transition-colors ${
              currentMode === mode.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
            }`}
            title={mode.label}
          >
            {mode.icon}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-0.5">
      {modes.map((mode) => (
        <button
          key={mode.id}
          onClick={() => onModeChange(mode.id)}
          className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            currentMode === mode.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
          }`}
        >
          {mode.icon}
          {mode.label}
        </button>
      ))}
    </div>
  );
}
