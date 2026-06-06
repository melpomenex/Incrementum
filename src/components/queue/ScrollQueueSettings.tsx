import React from "react";
import { X } from "lucide-react";
import { cn } from "../../utils";

interface ScrollQueueSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  flashcardPercentage: number;
  extractsCountAsFlashcards: boolean;
  autoProceed: boolean;
  onUpdateSetting: (key: string, value: number | boolean) => void;
}

export const ScrollQueueSettings = React.memo(function ScrollQueueSettings({
  isOpen,
  onClose,
  flashcardPercentage,
  extractsCountAsFlashcards,
  autoProceed,
  onUpdateSetting,
}: ScrollQueueSettingsProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm pointer-events-auto">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">Queue Settings</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label htmlFor="flashcard-pct" className="text-sm font-medium text-foreground">Flashcard Percentage</label>
              <span className="text-sm font-mono text-primary">{flashcardPercentage}%</span>
            </div>
            <input
              id="flashcard-pct"
              type="range"
              min="0"
              max="100"
              step="5"
              value={flashcardPercentage}
              onChange={(e) => onUpdateSetting("flashcardPercentage", parseInt(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Percentage of the queue that should be flashcards and extracts.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="extracts-toggle" className="text-sm font-medium text-foreground">Extracts count as flashcards</label>
              <p className="text-xs text-muted-foreground mt-1">
                Include extracts in the flashcard percentage calculation
              </p>
            </div>
            <button
              id="extracts-toggle"
              onClick={() => onUpdateSetting("extractsCountAsFlashcards", !extractsCountAsFlashcards)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                extractsCountAsFlashcards ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  extractsCountAsFlashcards ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="auto-proceed-toggle" className="text-sm font-medium text-foreground">Auto-proceed to next item</label>
              <p className="text-xs text-muted-foreground mt-1">
                Automatically navigate to the next item when a video or audio ends
              </p>
            </div>
            <button
              id="auto-proceed-toggle"
              onClick={() => onUpdateSetting("autoProceed", !autoProceed)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                autoProceed ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  autoProceed ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
});
