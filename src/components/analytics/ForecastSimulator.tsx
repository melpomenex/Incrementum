import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { ChartLineUp, Sparkle } from "@phosphor-icons/react";
import { simulateReviewForecast, type SimulatedForecast } from "../../api/algorithm";

const HORIZON_OPTIONS = [30, 60, 90, 180] as const;

/**
 * What-if simulator: "if I add N new cards/day, what will my daily review
 * load look like over the next horizon?" Stacks the real baseline forecast
 * against projected reviews from the hypothetical add rate.
 *
 * Read-only on the backend (the simulator never mutates scheduling data).
 */
export function ForecastSimulator() {
  const [addRate, setAddRate] = useState(10);
  const [horizon, setHorizon] = useState<(typeof HORIZON_OPTIONS)[number]>(90);
  const [data, setData] = useState<SimulatedForecast | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    const handle = setTimeout(() => {
      simulateReviewForecast(addRate, horizon)
        .then((result) => {
          if (!cancelled) setData(result);
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Failed to simulate forecast");
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, 250); // debounce slider drags
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [addRate, horizon]);

  const chartData = useMemo(() => {
    if (!data) return [];
    // Downsample for readability on long horizons.
    const step = horizon >= 180 ? 3 : horizon >= 90 ? 2 : 1;
    return data.points
      .filter((_, i) => i % step === 0)
      .map((p) => ({
        date: p.date.slice(5), // MM-DD
        baseline: p.baseline_due,
        added: p.added_reviews,
      }));
  }, [data, horizon]);

  return (
    <div className="bg-card rounded-lg p-6 border">
      <div className="flex items-center gap-2 mb-4">
        <ChartLineUp className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Forecast Simulator</h3>
        <span className="text-xs text-muted-foreground ml-2">
          What if you add new cards each day?
        </span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-6 mb-6">
        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
          <label className="text-sm text-muted-foreground whitespace-nowrap">
            New cards / day:
          </label>
          <input
            type="range"
            min={0}
            max={50}
            value={addRate}
            onChange={(e) => setAddRate(Number(e.target.value))}
            className="flex-1 accent-primary"
          />
          <span className="text-sm font-semibold w-10 text-right">{addRate}</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Horizon:</label>
          <div className="flex gap-1">
            {HORIZON_OPTIONS.map((h) => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  horizon === h
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {h}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Callouts */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Callout label="Total reviews" value={data.total_simulated.toLocaleString()} />
          <Callout
            label="Baseline (current)"
            value={data.total_baseline.toLocaleString()}
            tone="muted"
          />
          <Callout
            label="Added by new cards"
            value={`+${data.total_new_reviews.toLocaleString()}`}
            tone="accent"
          />
          <Callout
            label="Peak day"
            value={data.peak_count > 0 ? `${data.peak_count} on ${data.peak_day.slice(5)}` : "—"}
            tone={data.peak_count > 150 ? "warn" : "default"}
          />
        </div>
      )}

      {/* Chart */}
      <div className="h-64">
        {error ? (
          <div className="flex items-center justify-center h-full text-sm text-destructive">
            {error}
          </div>
        ) : isLoading && !data ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            <Sparkle className="w-4 h-4 mr-2 animate-pulse" /> Simulating…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} width={36} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                dataKey="baseline"
                stackId="a"
                fill="hsl(var(--chart-2, #22c55e))"
                name="Baseline due"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="added"
                stackId="a"
                fill="hsl(var(--primary))"
                name="Projected from new cards"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Projection uses a simplified interval-growth model (×2.5 per review). Treat as a planning
        aid, not an exact FSRS prediction.
      </p>
    </div>
  );
}

function Callout({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "muted" | "accent" | "warn";
}) {
  const toneClass =
    tone === "muted"
      ? "text-muted-foreground"
      : tone === "accent"
        ? "text-primary"
        : tone === "warn"
          ? "text-orange-500"
          : "text-foreground";
  return (
    <div className="rounded-lg border bg-background/50 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}
