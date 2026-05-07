import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAnalyticsStore } from "../stores/analyticsStore";
import { invokeCommand } from "../lib/tauri";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  BarChart3,
  Activity,
  Download,
} from "lucide-react";
import { useI18n } from "../lib/i18n";

export function AnalyticsPage() {
  const { dashboardStats, activityData, categoryStats, loadAll } =
    useAnalyticsStore(useShallow(s => ({
      dashboardStats: s.dashboardStats,
      activityData: s.activityData,
      categoryStats: s.categoryStats,
      loadAll: s.loadAll,
    })));
  const [timeRange, setTimeRange] = useState<string>("7d");
  const { t } = useI18n();

  useEffect(() => {
    loadAll();
  }, [loadAll, timeRange]);

  const exportStats = async () => {
    try {
      await invokeCommand("export_analytics", { timeRange });
      alert(`${t("analytics.title")} ${t("common.export").toLowerCase()}ed successfully!`);
    } catch (error) {
      console.error("Failed to export:", error);
    }
  };

  return (
    <div className="h-full flex flex-col bg-cream">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{t("analytics.title")}</h1>
            <p className="text-sm text-foreground-secondary">
              {t("analytics.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-1.5 bg-background border border-border rounded text-sm"
            >
              <option value="7d">{t("analyticsLegacy.last7Days")}</option>
              <option value="30d">{t("analyticsLegacy.last30Days")}</option>
              <option value="90d">{t("analyticsLegacy.last90Days")}</option>
              <option value="365d">{t("analyticsLegacy.lastYear")}</option>
              <option value="all">{t("analyticsLegacy.allTime")}</option>
            </select>
            <button
              onClick={exportStats}
              className="px-3 py-1.5 bg-background border border-border rounded text-sm hover:bg-muted flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              {t("common.export")}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              label={t("analytics.totalCards")}
              value={dashboardStats?.total_cards || 0}
              icon={<BarChart3 className="w-5 h-5" />}
              trend={
                activityData && activityData.length > 1
                  ? ((activityData[activityData.length - 1]?.cards_learned || 0) -
                    (activityData[activityData.length - 2]?.cards_learned || 0))
                  : 0
              }
            />
            <StatCard
              label={t("analytics.cardsLearned")}
              value={dashboardStats?.cards_learned || 0}
              icon={<TrendingUp className="w-5 h-5" />}
            />
            <StatCard
              label={t("layout.dueToday")}
              value={dashboardStats?.cards_due_today || 0}
              icon={<Calendar className="w-5 h-5" />}
            />
            <StatCard
              label={t("analytics.retentionRate")}
              value={`${Math.round(
                ((dashboardStats?.retention_rate || 0) /
                  Math.max(1, dashboardStats?.total_cards || 0)) *
                100
              )}%`}
              icon={<Activity className="w-5 h-5" />}
            />
          </div>

          {/* Memory States */}
          <div className="bg-card border border-border rounded p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {t("analytics.memoryStates")}
            </h3>
            <div className="grid grid-cols-5 gap-4">
              {memoryStates.map((state) => (
                <div key={state.name} className="text-center">
                  <div
                    className="h-24 rounded flex items-end justify-center pb-2"
                    style={{ backgroundColor: state.color + "20" }}
                  >
                    <div
                      className="w-full rounded-t"
                      style={{
                        backgroundColor: state.color,
                        height: `${(state.count /
                          Math.max(1, dashboardStats?.total_cards || 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="mt-2 text-sm font-medium text-foreground">
                    {t(state.name)}
                  </div>
                  <div className="text-xs text-foreground-secondary">
                    {state.count}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Chart */}
          <div className="bg-card border border-border rounded p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {t("analytics.reviewActivity")}
            </h3>
            <div className="h-48 flex items-end gap-1">
              {activityData?.map((day: any, index: number) => (
                <div
                  key={index}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <div
                    className="w-full bg-primary-300 rounded-t hover:opacity-80 transition-opacity cursor-pointer"
                    style={{
                      height: `${Math.max(
                        5,
                        (day.reviews_count /
                          Math.max(...activityData.map((d: any) => d.reviews_count))) *
                        100
                      )}%`,
                    }}
                    title={`${day.reviews_count} reviews`}
                  />
                  <span className="text-xs text-foreground-secondary">
                    {new Date(day.date).toLocaleDateString("en-US", {
                      weekday: "short",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Category Breakdown */}
          {categoryStats && categoryStats.length > 0 && (
            <div className="bg-card border border-border rounded p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">
              {t("analytics.categoryBreakdown")}
              </h3>
              <div className="space-y-3">
                {categoryStats.map((cat: any) => (
                  <div
                    key={cat.category}
                    className="flex items-center gap-3"
                  >
                    <div className="w-32 text-sm text-foreground truncate">
                      {cat.category}
                    </div>
                    <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-300 transition-all"
                        style={{
                          width: `${(cat.count /
                            Math.max(...categoryStats.map((c: any) => c.count))) *
                            100}%`,
                        }}
                      />
                    </div>
                    <div className="w-12 text-sm text-foreground text-right">
                      {cat.count}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  trend,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: number;
}) {
  const { t } = useI18n();

  return (
    <div className="bg-card border border-border rounded p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-foreground-secondary">{label}</span>
        <div className="text-primary-300">{icon}</div>
      </div>
      <div className="text-2xl font-bold text-foreground mb-1">{value}</div>
      {trend !== undefined && (
        <div className="flex items-center gap-1 text-xs">
          {trend >= 0 ? (
            <TrendingUp className="w-3 h-3 text-green-500" />
          ) : (
            <TrendingDown className="w-3 h-3 text-red-500" />
          )}
          <span
            className={
              trend >= 0 ? "text-green-500" : "text-red-500"
            }
          >
            {Math.abs(trend)}
          </span>
          <span className="text-foreground-secondary">{t("analyticsLegacy.vsLastPeriod")}</span>
        </div>
      )}
    </div>
  );
}

const memoryStates = [
  { name: "analyticsLegacy.stateNew", count: 0, color: "#3b82f6" },
  { name: "analyticsLegacy.stateLearning", count: 0, color: "#f59e0b" },
  { name: "analyticsLegacy.stateYoung", count: 0, color: "#10b981" },
  { name: "analyticsLegacy.stateMature", count: 0, color: "#8b5cf6" },
  { name: "analyticsLegacy.stateRelearning", count: 0, color: "#ef4444" },
];
