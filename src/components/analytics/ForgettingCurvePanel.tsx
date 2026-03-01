import { useMemo } from "react";

interface ForgettingCurvePanelProps {
  averageStabilityDays?: number;
}

function buildCurve(stabilityDays: number) {
  const points = [];
  for (let day = 0; day <= 90; day += 3) {
    const retention = Math.exp(-day / Math.max(1, stabilityDays));
    points.push({ day, retention });
  }
  return points;
}

export function ForgettingCurvePanel({ averageStabilityDays }: ForgettingCurvePanelProps) {
  const stability = Number.isFinite(averageStabilityDays) && (averageStabilityDays ?? 0) > 0
    ? (averageStabilityDays as number)
    : 10;
  const data = useMemo(() => buildCurve(stability), [stability]);

  return (
    <div className="p-4 bg-card border border-border rounded-lg">
      <h3 className="text-lg font-semibold text-foreground mb-2">Forgetting Curve</h3>
      <p className="text-xs text-muted-foreground mb-3">
        Aggregate projection using average stability ({stability.toFixed(1)} days).
      </p>
      <div className="space-y-2">
        {data.map((point) => (
          <div key={point.day} className="flex items-center gap-2">
            <div className="w-10 text-xs text-muted-foreground">{point.day}d</div>
            <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
              <div
                className="h-full bg-primary/70"
                style={{ width: `${Math.max(2, Math.round(point.retention * 100))}%` }}
              />
            </div>
            <div className="w-14 text-right text-xs text-foreground">
              {Math.round(point.retention * 100)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

