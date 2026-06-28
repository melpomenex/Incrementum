import { useState } from "react";
import { Flask, Info } from "@phosphor-icons/react";
import { formatInterval, type LearningItem, type PreviewIntervals } from "../../api/review";
import { parseSm18State, sm18Retrievability, type SM18State } from "../../lib/sm18";
import { parseSm20State, sm20Retrievability, type SM20State } from "../../lib/sm20";
import { useSettingsStore } from "../../stores/settingsStore";

interface ReviewTransparencyPanelProps {
  card: LearningItem;
  previewIntervals: PreviewIntervals | null;
}

const ALGORITHM_LABELS: Record<string, string> = {
  fsrs: "FSRS-6 Transparency",
  sm18: "SuperMemo 18 Transparency",
  sm20: "SuperMemo 20 Transparency",
};

function getAlgorithmLabel(algorithmType?: string): string {
  return ALGORITHM_LABELS[algorithmType ?? ""] ?? "FSRS-6 Transparency";
}

export function ReviewTransparencyPanel({ card, previewIntervals }: ReviewTransparencyPanelProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [showSuspendNote, setShowSuspendNote] = useState(false);
  const { settings } = useSettingsStore();

  // The global setting determines which algorithm the next review will use (matches submitReview behavior).
  // Card's algorithm_type is only used to detect stored state for display purposes.
  const activeAlgorithm = settings.learning.algorithm;
  const hasSm18State = !!card.algorithm_state && card.algorithm_state.startsWith("{") && card.algorithm_state.includes('"stability"') && (card.algorithm_type === "sm18" || card.algorithm_state.includes('"repetition"'));
  const hasSm20State = !!card.algorithm_state && card.algorithm_type === "sm20";
  const sm18State: SM18State | null = hasSm18State ? parseSm18State(card.algorithm_state) : null;
  const sm20State: SM20State | null = hasSm20State ? parseSm20State(card.algorithm_state) : null;

  const stability = sm18State
    ? sm18State.stability
    : sm20State
    ? sm20State.stability
    : card.memory_state?.stability;
  const difficulty = sm18State
    ? sm18State.difficulty
    : sm20State
    ? sm20State.difficulty
    : card.memory_state?.difficulty;
  const retrievability = sm18State && sm18State.stability > 0
    ? sm18Retrievability(sm18State.stability, sm18State.elapsed)
    : sm20State && sm20State.stability > 0
    ? sm20Retrievability(
        sm20State.stability,
        card.last_review_date
          ? (Date.now() - new Date(card.last_review_date).getTime()) / (86400 * 1000)
          : 0
      )
    : (card.memory_state as any)?.retrievability;

  return (
    <div className="bg-card border border-border rounded-lg p-3 md:p-4 space-y-2 md:space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Flask className="w-4 h-4" />
          {getAlgorithmLabel(activeAlgorithm)}
        </div>
        <button
          onClick={() => setShowRaw((prev) => !prev)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {showRaw ? "Hide raw" : "Show raw"}
        </button>
      </div>

      <div className="text-xs text-muted-foreground">
        Stability {stability?.toFixed(2) ?? "n/a"} • Difficulty{" "}
        {difficulty?.toFixed(2) ?? "n/a"}
        {retrievability != null && (
          <> • Retrievability {(retrievability * 100).toFixed(1)}%</>
        )}
      </div>

      {sm18State && (
        <div className="text-xs text-muted-foreground">
          Reps {sm18State.repetition} • Lapses {sm18State.lapses}
        </div>
      )}
      {sm20State && (
        <div className="text-xs text-muted-foreground">
          Reps {sm20State.repetition} • Lapses {sm20State.lapses}
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Info className="w-3 h-3" />
          Simulated next intervals
        </div>
        {previewIntervals ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {([
              ["again", "Again"],
              ["hard", "Hard"],
              ["good", "Good"],
              ["easy", "Easy"],
            ] as const).map(([key, label]) => (
              <div key={key} className="bg-muted/50 rounded-md p-1.5 md:p-2">
                <div className="text-muted-foreground">{label}</div>
                <div className="text-foreground font-semibold">
                  {formatInterval(previewIntervals[key])}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No preview available.</div>
        )}
        <button
          onClick={() => setShowSuspendNote((prev) => !prev)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {showSuspendNote ? "Hide suspend simulation" : "Simulate suspension"}
        </button>
        {showSuspendNote && (
          <div className="text-[11px] text-muted-foreground">
            Suspension pauses scheduling; the next review is deferred until you unsuspend the card.
          </div>
        )}
      </div>

      {showRaw && (
        <pre className="text-[10px] whitespace-pre-wrap bg-background border border-border rounded p-2">
{JSON.stringify(card, null, 2)}
        </pre>
      )}
    </div>
  );
}
