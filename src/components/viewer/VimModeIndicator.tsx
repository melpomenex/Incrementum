import { useVimModeStore, type VimMode } from "../../stores/vimModeStore";

const MODE_LABELS: Record<Exclude<VimMode, "inactive">, string> = {
  normal: "-- NORMAL --",
  visual: "-- VISUAL --",
  "visual-line": "-- VISUAL LINE --",
};

export function VimModeIndicator() {
  const mode = useVimModeStore((s) => s.mode);
  const pendingSequence = useVimModeStore((s) => s.pendingSequence);

  if (mode === "inactive") return null;

  const label = MODE_LABELS[mode];
  const display = pendingSequence ? `${label} [${pendingSequence}...]` : label;

  return (
    <div
      className="vim-mode-indicator"
      role="status"
      aria-live="polite"
    >
      {display}
    </div>
  );
}
