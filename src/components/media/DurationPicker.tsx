/**
 * DurationPicker
 * Date/duration picker for "mark older/newer than" actions
 */

import { useState } from "react";

interface DurationPickerProps {
  onSelect: (date: string) => void;
  onCancel: () => void;
  mode: "before" | "after";
}

const PRESETS = [
  { label: "1 hour", hours: 1 },
  { label: "6 hours", hours: 6 },
  { label: "12 hours", hours: 12 },
  { label: "1 day", hours: 24 },
  { label: "2 days", hours: 48 },
  { label: "1 week", hours: 168 },
  { label: "2 weeks", hours: 336 },
  { label: "1 month", hours: 720 },
];

export function DurationPicker({ onSelect, onCancel, mode }: DurationPickerProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="bg-card border border-border rounded-lg shadow-lg p-3 w-48 z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Mark as read {mode === "before" ? "older than" : "newer than"}:
        </p>
        <div className="space-y-0.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.hours}
              onClick={() => {
                const date = new Date(Date.now() - preset.hours * 3600000).toISOString();
                onSelect(date);
              }}
              className="w-full px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted/60 rounded transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
