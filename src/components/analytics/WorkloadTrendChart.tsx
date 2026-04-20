import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useI18n } from "../../lib/i18n";
import { type WorkloadDay } from "../../api/analytics";

interface WorkloadTrendChartProps {
  workloadData: WorkloadDay[];
}

export function WorkloadTrendChart({ workloadData }: WorkloadTrendChartProps) {
  const { t } = useI18n();

  const data = useMemo(() => {
    return workloadData.map((d) => ({
      date: d.date.slice(5), // "MM-DD"
      [t("calendar.actualReviews")]: d.reviewed_count,
      [t("calendar.projectedDue")]: d.due_count,
    }));
  }, [workloadData, t]);

  if (data.length === 0) return null;

  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium text-muted-foreground">{t("calendar.workloadTrend")}</h4>
      <ResponsiveContainer width="100%" height={100}>
        <AreaChart data={data} margin={{ top: 2, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="fillDue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fillReviewed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-2, #22c55e))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--chart-2, #22c55e))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
            tickFormatter={(v: string) => v.slice(3)}
          />
          <YAxis tick={{ fontSize: 10 }} width={30} />
          <Tooltip
            contentStyle={{
              fontSize: "11px",
              borderRadius: "6px",
              border: "1px solid hsl(var(--border))",
              backgroundColor: "hsl(var(--popover))",
            }}
          />
          <Area
            type="monotone"
            dataKey={t("calendar.projectedDue")}
            stroke="hsl(var(--primary))"
            fill="url(#fillDue)"
            strokeWidth={1.5}
            dot={false}
          />
          <Area
            type="monotone"
            dataKey={t("calendar.actualReviews")}
            stroke="hsl(var(--chart-2, #22c55e))"
            fill="url(#fillReviewed)"
            strokeWidth={1.5}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
