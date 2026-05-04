import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useI18n } from "../../lib/i18n";
import type { ForecastPoint } from "../../api/analytics";

interface SpreadPreviewChartProps {
  /** Current forecast data (before) */
  beforeData: ForecastPoint[];
  /** Projected daily distribution from spread (after) */
  afterData: Map<string, number>;
  /** Source date(s) being spread */
  sourceDate: string;
  /** Horizon in days */
  horizonDays: number;
}

export function SpreadPreviewChart({
  beforeData,
  afterData,
  sourceDate,
  horizonDays,
}: SpreadPreviewChartProps) {
  const { t } = useI18n();

  const chartData = useMemo(() => {
    // Only show first 14 days (or horizon if smaller) for readability
    const showDays = Math.min(horizonDays, 14);
    const data: Array<{
      date: string;
      label: string;
      before: number;
      after: number;
      isSource: boolean;
    }> = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < showDays; i++) {
      const d = new Date(today.getTime() + i * 86400000);
      const dateStr = d.toISOString().split("T")[0];
      const dayLabel = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      const beforePoint = beforeData.find((p) => p.date === dateStr);
      const before = beforePoint?.due_total ?? 0;
      const after = (afterData.get(dateStr) ?? 0) + (dateStr === sourceDate ? 0 : before);

      // The "after" for the source date should be (original - items moved out + items moved in)
      // For simplicity, after = before for non-source, and after = after_from_spread for source
      let afterVal: number;
      if (dateStr === sourceDate) {
        // Source date: subtract items that were moved, add any that landed here
        const sourceBefore = before;
        const spreadLanding = afterData.get(dateStr) ?? 0;
        afterVal = spreadLanding; // Only the items that landed back (should be 0 typically)
      } else {
        // Other dates: original + items spread here
        const spreadLanding = afterData.get(dateStr) ?? 0;
        afterVal = before + spreadLanding;
      }

      data.push({
        date: dateStr,
        label: dayLabel,
        before,
        after: afterVal,
        isSource: dateStr === sourceDate,
      });
    }

    return data;
  }, [beforeData, afterData, sourceDate, horizonDays]);

  if (chartData.length === 0) return null;

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={40}
          />
          <YAxis tick={{ fontSize: 10 }} width={40} />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              backgroundColor: "hsl(var(--popover))",
            }}
            formatter={(value: number, name: string) => [
              value,
              name === "before" ? t("schedule.before") : t("schedule.after"),
            ]}
          />
          <Bar
            dataKey="before"
            fill="hsl(0, 70%, 55%)"
            radius={[2, 2, 0, 0]}
            opacity={0.6}
          />
          <Bar
            dataKey="after"
            fill="hsl(210, 70%, 55%)"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
