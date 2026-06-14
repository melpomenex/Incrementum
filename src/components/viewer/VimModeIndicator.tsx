import { useVimModeStore, type VimMode, type VimOperator } from "../../stores/vimModeStore";

const MODE_LABELS: Record<Exclude<VimMode, "inactive">, string> = {
  normal: "-- NORMAL --",
  visual: "-- VISUAL --",
  "visual-line": "-- VISUAL LINE --",
};

const OPERATOR_LABELS: Record<VimOperator, string> = {
  d: "-- OPERATOR (extract) --",
  c: "-- OPERATOR (change) --",
  y: "-- OPERATOR (yank) --",
};

export function VimModeIndicator() {
  const mode = useVimModeStore((s) => s.mode);
  const pendingSequence = useVimModeStore((s) => s.pendingSequence);
  const pendingOperator = useVimModeStore((s) => s.pendingOperator);

  if (mode === "inactive") return null;

  // Operator-pending takes precedence in the indicator.
  let display: string;
  if (pendingOperator) {
    display = OPERATOR_LABELS[pendingOperator];
    if (pendingSequence) {
      display += ` [${pendingOperator}${pendingSequence}...]`;
    }
  } else {
    const label = MODE_LABELS[mode];
    display = pendingSequence ? `${label} [${pendingSequence}...]` : label;
  }

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
