/**
 * Document Priority Control
 * 
 * Allows users to set the priority of a document, which affects:
 * 1. How often it appears in the queue (higher = more frequent)
 * 2. How "Hard" ratings are handled (high priority = shorter max interval)
 * 
 * UI/UX Principles:
 * - Clean, unobtrusive design
 * - Clear visual feedback
 * - Preset buttons for quick selection
 * - Slider for fine-tuning
 * - Immediate save on interaction
 */

import { useState, useCallback } from "react";
import { cn } from "../../utils";
import { Flag, ChevronUp, ChevronDown } from "lucide-react";
import { updateDocumentPriority } from "../../api/documents";
import { useI18n } from "../../lib/i18n";

interface PriorityControlProps {
  documentId: string;
  prioritySlider?: number; // 0-100
  priorityRating?: number; // 1-5
  onPriorityChange?: (slider: number, rating: number) => void;
  className?: string;
  variant?: "compact" | "full";
}

// Priority presets with labels and colors
const PRIORITY_PRESETS = [
  { value: 10, labelKey: "priority.lowest", descKey: "priority.lowestDesc", color: "#6B7280" },
  { value: 30, labelKey: "priority.low", descKey: "priority.lowDesc", color: "#9CA3AF" },
  { value: 50, labelKey: "priority.normal", descKey: "priority.normalDesc", color: "#3B82F6" },
  { value: 70, labelKey: "priority.high", descKey: "priority.highDesc", color: "#F59E0B" },
  { value: 90, labelKey: "priority.highest", descKey: "priority.highestDesc", color: "#EF4444" },
];

function getPriorityInfo(slider: number) {
  if (slider >= 81) return PRIORITY_PRESETS[4];
  if (slider >= 61) return PRIORITY_PRESETS[3];
  if (slider >= 41) return PRIORITY_PRESETS[2];
  if (slider >= 21) return PRIORITY_PRESETS[1];
  return PRIORITY_PRESETS[0];
}

function sliderToRating(slider: number): number {
  // Convert 0-100 slider to 1-5 rating
  if (slider >= 81) return 5;
  if (slider >= 61) return 4;
  if (slider >= 41) return 3;
  if (slider >= 21) return 2;
  return 1;
}

export function PriorityControl({
  documentId,
  prioritySlider = 50,
  priorityRating: _priorityRating = 3,
  onPriorityChange,
  className,
  variant = "compact",
}: PriorityControlProps) {
  const [slider, setSlider] = useState(prioritySlider);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useI18n();

  const currentInfo = getPriorityInfo(slider);

  const handleSliderChange = useCallback(async (newSlider: number) => {
    setSlider(newSlider);
    const newRating = sliderToRating(newSlider);
    
    setIsSaving(true);
    try {
      await updateDocumentPriority(documentId, newRating, newSlider);
      onPriorityChange?.(newSlider, newRating);
    } catch (error) {
      console.error("Failed to update priority:", error);
      // Could show toast here
    } finally {
      setIsSaving(false);
    }
  }, [documentId, onPriorityChange]);

  const handlePresetClick = useCallback((presetValue: number) => {
    handleSliderChange(presetValue);
    if (variant === "compact") {
      setIsExpanded(false);
    }
  }, [handleSliderChange, variant]);

  if (variant === "compact") {
    return (
      <div className={cn("relative", className)}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
            "bg-muted hover:bg-muted/80 border border-border",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isExpanded && "bg-muted/80 ring-1 ring-border"
          )}
          title={`Priority: ${t(currentInfo.labelKey)} - ${t(currentInfo.descKey)}`}
        >
          <Flag
            className="h-4 w-4"
            style={{ color: currentInfo.color }}
            fill={currentInfo.color}
          />
          <span className="text-foreground">{t(currentInfo.labelKey)}</span>
          {isExpanded ? (
            <ChevronUp className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          )}
        </button>

        {isExpanded && (
          <>
            <div 
              className="fixed inset-0 z-40"
              role="presentation"
              onClick={() => setIsExpanded(false)}
            />
            <div className="absolute top-full right-0 mt-2 w-64 bg-popover border border-border rounded-lg shadow-lg z-50 p-3 animate-in fade-in zoom-in-95 duration-100">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t("priority.setTitle")}</span>
                  {isSaving && (
                    <span className="text-xs text-muted-foreground">{t("priority.saving")}</span>
                  )}
                </div>
                
                {/* Preset buttons */}
                <div className="grid grid-cols-5 gap-1">
                  {PRIORITY_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => handlePresetClick(preset.value)}
                      className={cn(
                        "flex flex-col items-center gap-1 p-2 rounded-md transition-all",
                        "bg-muted hover:bg-muted/70 border border-border",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        slider === preset.value && "bg-primary/10 ring-1 ring-primary/30"
                      )}
                      title={t(preset.descKey)}
                    >
                      <Flag
                        className="h-4 w-4"
                        style={{ color: preset.color }}
                        fill={preset.color}
                      />
                      <span className="text-[10px] text-muted-foreground leading-none">
                        {t(preset.labelKey)}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Fine-tune slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t("priority.fineTune")}</span>
                    <span className="font-medium" style={{ color: currentInfo.color }}>
                      {slider}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={slider}
                    onChange={(e) => handleSliderChange(parseInt(e.target.value))}
                    aria-label={t("priority.fineTune")}
                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    style={{ accentColor: currentInfo.color }}
                  />
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground text-center">
                  {t(currentInfo.descKey)}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Flag className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{t("priority.readingPriority")}</span>
        {isSaving && (
          <span className="text-xs text-muted-foreground ml-auto">{t("priority.saving")}</span>
        )}
      </div>

      {/* Preset buttons */}
      <div className="flex gap-2">
        {PRIORITY_PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => handlePresetClick(preset.value)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
              "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              slider === preset.value 
                ? "border-ring bg-muted" 
                : "border-border bg-card"
            )}
          >
            <Flag 
              className="h-4 w-4" 
              style={{ color: preset.color }}
              fill={preset.color}
            />
            <span className="text-xs font-medium">{t(preset.labelKey)}</span>
          </button>
        ))}
      </div>

      {/* Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("priority.adjust")}</span>
          <span className="font-medium" style={{ color: currentInfo.color }}>
            {slider}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={slider}
          onChange={(e) => handleSliderChange(parseInt(e.target.value))}
          aria-label={t("priority.adjust")}
          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
          style={{ accentColor: currentInfo.color }}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {t(currentInfo.descKey)}. {t("priority.higherPriorityNote")}
      </p>
    </div>
  );
}
