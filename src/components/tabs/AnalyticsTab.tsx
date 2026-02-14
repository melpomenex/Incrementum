import { useEffect, useMemo } from "react";
import { useTabsStore } from "../../stores";
import { useAnalyticsStore } from "../../stores/analyticsStore";
import { ReviewTab, DocumentsTab } from "./TabRegistry";
import { StatCard } from "../../components/analytics/StatCard";
import { StudyStreak } from "../../components/analytics/StudyStreak";
import { ActivityChart } from "../../components/analytics/ActivityChart";
import { CategoryBreakdown } from "../../components/analytics/CategoryBreakdown";
import { DashboardProgressRings } from "../../components/analytics/ProgressRings";
import { ReviewHeatmap } from "../../components/analytics/ReviewHeatmap";
import {
  BookOpen,
  Clock,
  Brain,
  CheckCircle2,
  FileText,
  Sparkles,
  Loader2,
  TrendingUp,
  Library,
} from "lucide-react";

export function AnalyticsTab() {
  const { addTab } = useTabsStore();
  const {
    dashboardStats,
    memoryStats,
    activityData,
    categoryStats,
    isLoading,
    error,
    loadAll,
  } = useAnalyticsStore();
  const formatPercent = (value?: number, digits = 1) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    return `${value.toFixed(digits)}%`;
  };
  const formatNumber = (value?: number, digits = 2) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    return value.toFixed(digits);
  };

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const reviewHeatmapData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const day of activityData || []) {
      if (day?.date) {
        map[day.date] = day.reviews_count || 0;
      }
    }
    return map;
  }, [activityData]);

  const weeklyProgress = useMemo(() => {
    return (activityData || []).slice(-7).reduce((sum, day) => sum + (day.reviews_count || 0), 0);
  }, [activityData]);

  if (isLoading && !dashboardStats) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading analytics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg">
        Failed to load analytics: {error}
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Track your learning progress and performance
        </p>
      </div>

      {/* Study Streak */}
      {dashboardStats && (
        <StudyStreak streak={dashboardStats.study_streak} />
      )}

      {/* Stats Grid */}
      {dashboardStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Cards Due Today"
            value={dashboardStats.cards_due_today}
            icon={Clock}
            color="orange"
            description="Ready to review"
          />
          <StatCard
            title="Total Cards"
            value={dashboardStats.total_cards}
            icon={Brain}
            color="blue"
            description={
              memoryStats
                ? `${memoryStats.new_cards} new, ${memoryStats.young_cards} learning`
                : undefined
            }
          />
          <StatCard
            title="Cards Learned"
            value={dashboardStats.cards_learned}
            icon={CheckCircle2}
            color="green"
            description="Reviewed at least once"
          />
          <StatCard
            title="Retention Rate"
            value={formatPercent(dashboardStats.retention_rate, 1)}
            icon={TrendingUp}
            color="purple"
            description="Average across all cards"
          />
        </div>
      )}

      {/* Documents and Extracts */}
      {dashboardStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard
            title="Documents"
            value={dashboardStats.total_documents}
            icon={BookOpen}
            color="blue"
          />
          <StatCard
            title="Extracts"
            value={dashboardStats.total_extracts}
            icon={FileText}
            color="green"
          />
        </div>
      )}

      {/* Smart Analytics Overview */}
      {dashboardStats && (
        <DashboardProgressRings
          dailyGoal={Math.max(1, dashboardStats.daily_goal || 20)}
          dailyProgress={dashboardStats.reviews_today || dashboardStats.cards_reviewed_today || 0}
          weeklyGoal={Math.max(7, (dashboardStats.daily_goal || 20) * 7)}
          weeklyProgress={weeklyProgress}
          streakDays={dashboardStats.study_streak || 0}
          longestStreak={Math.max(1, dashboardStats.study_streak || 0)}
        />
      )}

      {/* Memory Stats */}
      {memoryStats && (
        <div className="p-4 bg-card border border-border rounded-lg">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Memory Statistics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold text-foreground">
                {memoryStats.mature_cards}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Mature Cards</p>
              <p className="text-xs text-muted-foreground">
                Interval ≥ 21 days
              </p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold text-foreground">
                {memoryStats.young_cards}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Young Cards</p>
              <p className="text-xs text-muted-foreground">
                Learning but not mature
              </p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold text-foreground">
                {memoryStats.new_cards}
              </p>
              <p className="text-sm text-muted-foreground mt-1">New Cards</p>
              <p className="text-xs text-muted-foreground">Never reviewed</p>
            </div>
          </div>

          {/* FSRS metrics */}
          {Number.isFinite(memoryStats.average_stability) && memoryStats.average_stability > 0 && (
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">
                  {formatNumber(memoryStats.average_stability, 2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Avg Stability (days)
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">
                  {formatNumber(memoryStats.average_difficulty, 2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Avg Difficulty (1-10)
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Activity Chart */}
      <div className="p-4 bg-card border border-border rounded-lg">
        <ActivityChart data={activityData} />
      </div>

      {/* Review Heatmap */}
      <div className="p-4 bg-card border border-border rounded-lg">
        <ReviewHeatmap data={reviewHeatmapData} months={12} />
      </div>

      {/* Category Breakdown */}
      <div className="p-4 bg-card border border-border rounded-lg">
        <CategoryBreakdown categories={categoryStats} />
      </div>

      {/* Quick Actions */}
      <div className="p-4 bg-card border border-border rounded-lg">
        <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => addTab({
              title: "Review",
              icon: <Brain className="w-4 h-4" />,
              type: "review",
              content: ReviewTab,
              closable: true,
            })}
            className="flex items-center gap-3 p-3 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg transition-colors text-left"
          >
            <Sparkles className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium text-foreground">Start Review</p>
              <p className="text-sm text-muted-foreground">
                {dashboardStats?.cards_due_today || 0} cards due
              </p>
            </div>
          </button>
          <button
            onClick={() => addTab({
              title: "Documents",
              icon: <Library className="w-4 h-4" />,
              type: "documents",
              content: DocumentsTab,
              closable: true,
            })}
            className="flex items-center gap-3 p-3 bg-muted hover:bg-muted/80 border border-border rounded-lg transition-colors text-left"
          >
            <BookOpen className="w-5 h-5 text-foreground" />
            <div>
              <p className="font-medium text-foreground">Browse Documents</p>
              <p className="text-sm text-muted-foreground">
                {dashboardStats?.total_documents || 0} documents
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
