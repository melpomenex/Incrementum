import { useEffect } from "react";
import { useAnalyticsStore } from "../stores/analyticsStore";
import { StatCard } from "../components/analytics/StatCard";
import { StudyStreak } from "../components/analytics/StudyStreak";
import { ActivityChart } from "../components/analytics/ActivityChart";
import { CategoryBreakdown } from "../components/analytics/CategoryBreakdown";
import { useI18n } from "../lib/i18n";
import {
  BookOpen,
  Clock,
  Brain,
  CheckCircle2,
  FileText,
  Sparkles,
  Loader2,
  TrendingUp,
} from "lucide-react";

export function Dashboard() {
  const {
    dashboardStats,
    memoryStats,
    activityData,
    categoryStats,
    isLoading,
    error,
    loadAll,
  } = useAnalyticsStore();
  const { t } = useI18n();

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (isLoading && !dashboardStats) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg">
        {t("dashboard.failedLoadAnalytics")}: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t("nav.dashboard")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("dashboard.welcomeBody")}
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
            title={t("dashboard.cardsDueToday")}
            value={dashboardStats.cards_due_today}
            icon={Clock}
            color="orange"
            description={t("dashboard.readyToReview")}
          />
          <StatCard
            title={t("dashboard.totalCards")}
            value={dashboardStats.total_cards}
            icon={Brain}
            color="blue"
            description={
              memoryStats
                ? `${memoryStats.new_cards} ${t("analytics.new")}, ${memoryStats.young_cards} ${t("analytics.learning")}`
                : undefined
            }
          />
          <StatCard
            title={t("dashboard.cardsLearned")}
            value={dashboardStats.cards_learned}
            icon={CheckCircle2}
            color="green"
            description={t("dashboard.reviewedAtLeastOnce")}
          />
          <StatCard
            title={t("dashboard.retentionRate")}
            value={`${dashboardStats.retention_rate.toFixed(1)}%`}
            icon={TrendingUp}
            color="purple"
            description={t("dashboard.averageRetention")}
          />
        </div>
      )}

      {/* Documents and Extracts */}
      {dashboardStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard
            title={t("dashboard.documents")}
            value={dashboardStats.total_documents}
            icon={BookOpen}
            color="blue"
          />
          <StatCard
            title={t("dashboard.extracts")}
            value={dashboardStats.total_extracts}
            icon={FileText}
            color="green"
          />
        </div>
      )}

      {/* Memory Stats */}
      {memoryStats && (
        <div className="p-4 bg-card border border-border rounded-lg">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            {t("dashboard.memoryStatistics")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold text-foreground">
                {memoryStats.mature_cards}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{t("dashboard.matureCards")}</p>
              <p className="text-xs text-muted-foreground">
                {t("dashboard.matureCardsDesc")}
              </p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold text-foreground">
                {memoryStats.young_cards}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{t("dashboard.youngCards")}</p>
              <p className="text-xs text-muted-foreground">
                {t("dashboard.youngCardsDesc")}
              </p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold text-foreground">
                {memoryStats.new_cards}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{t("dashboard.newCards")}</p>
              <p className="text-xs text-muted-foreground">{t("dashboard.newCardsDesc")}</p>
            </div>
          </div>

          {/* FSRS metrics */}
          {memoryStats.average_stability > 0 && (
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">
                  {memoryStats.average_stability.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.avgStability")}
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">
                  {memoryStats.average_difficulty.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.avgDifficulty")}
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

      {/* Category Breakdown */}
      <div className="p-4 bg-card border border-border rounded-lg">
        <CategoryBreakdown categories={categoryStats} />
      </div>

      {/* Quick Actions */}
      <div className="p-4 bg-card border border-border rounded-lg">
        <h3 className="text-lg font-semibold text-foreground mb-4">{t("dashboard.quickActions")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <a
            href="/review"
            className="flex items-center gap-3 p-3 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg transition-colors"
          >
            <Sparkles className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium text-foreground">{t("dashboard.startReview")}</p>
              <p className="text-sm text-muted-foreground">
                {dashboardStats?.cards_due_today || 0} {t("dashboard.cardsDue")}
              </p>
            </div>
          </a>
          <a
            href="/documents"
            className="flex items-center gap-3 p-3 bg-muted hover:bg-muted/80 border border-border rounded-lg transition-colors"
          >
            <BookOpen className="w-5 h-5 text-foreground" />
            <div>
              <p className="font-medium text-foreground">{t("dashboard.browseDocumentsLabel")}</p>
              <p className="text-sm text-muted-foreground">
                {dashboardStats?.total_documents || 0} {t("dashboard.documentsLabel")}
              </p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
