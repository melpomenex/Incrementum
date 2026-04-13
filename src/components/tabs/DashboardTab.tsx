import { useEffect, useMemo, useState } from "react";
import { useTabsStore } from "../../stores";
import { useDocumentStore } from "../../stores/documentStore";
import type { TabType } from "../../stores/tabsStore";
import { useI18n } from "../../lib/i18n";
import {
  QueueTab,
  ReviewTab,
  DocumentsTab,
  AnalyticsTab,
  SettingsTab,
  RSSReader,
} from "./TabRegistry";
import { getDashboardStats, type DashboardStats } from "../../api/analytics";
import { QuickReviewWidget } from "../review/QuickReviewWidget";
import {
  BookOpen,
  Brain,
  Files,
  BarChart3,
  Settings,
  Rss,
  TrendingUp,
  Target,
  Zap,
  ChevronRight,
} from "lucide-react";

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  tabType: TabType;
  tabTitle: string;
  tabIcon: string;
  content: React.ComponentType;
  closable: boolean;
  primary?: boolean;
}

export function DashboardTab() {
  const { t } = useI18n();
  const { addTab, tabs } = useTabsStore();
  const documents = useDocumentStore((state) => state.documents);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (error) {
      console.error("Failed to load dashboard stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions: QuickAction[] = [
    {
      id: "queue",
      title: t("dashboard.readingQueue"),
      description: t("dashboard.continueReading"),
      icon: BookOpen,
      iconBg: "bg-blue-500/10 text-blue-500",
      tabType: "queue",
      tabTitle: "Queue",
      tabIcon: "📚",
      content: QueueTab,
      closable: true,
      primary: true,
    },
    {
      id: "review",
      title: t("dashboard.flashcards"),
      description: t("dashboard.reviewDueCards"),
      icon: Brain,
      iconBg: "bg-purple-500/10 text-purple-500",
      tabType: "review",
      tabTitle: "Review",
      tabIcon: "🎴",
      content: ReviewTab,
      closable: true,
      primary: true,
    },
    {
      id: "documents",
      title: t("dashboard.library"),
      description: t("dashboard.browseDocuments"),
      icon: Files,
      iconBg: "bg-green-500/10 text-green-500",
      tabType: "documents",
      tabTitle: "Documents",
      tabIcon: "📄",
      content: DocumentsTab,
      closable: true,
    },
    {
      id: "rss",
      title: t("dashboard.rssFeeds"),
      description: t("dashboard.latestArticles"),
      icon: Rss,
      iconBg: "bg-orange-500/10 text-orange-500",
      tabType: "rss",
      tabTitle: "RSS Feeds",
      tabIcon: "📰",
      content: RSSReader,
      closable: true,
    },
    {
      id: "analytics",
      title: t("dashboard.analytics"),
      description: t("dashboard.trackProgress"),
      icon: BarChart3,
      iconBg: "bg-cyan-500/10 text-cyan-500",
      tabType: "analytics",
      tabTitle: "Analytics",
      tabIcon: "📊",
      content: AnalyticsTab,
      closable: true,
    },
    {
      id: "settings",
      title: t("nav.settings"),
      description: t("dashboard.appPreferences"),
      icon: Settings,
      iconBg: "bg-slate-500/10 text-slate-500",
      tabType: "settings",
      tabTitle: "Settings",
      tabIcon: "⚙️",
      content: SettingsTab,
      closable: true,
    },
  ];

  const openTab = (action: QuickAction) => {
    const existing = tabs.find((tab) => tab.type === action.tabType);
    if (existing) {
      // Tab already exists, just activate it
      return;
    }

    addTab({
      title: action.tabTitle,
      icon: action.tabIcon,
      type: action.tabType,
      content: action.content,
      closable: action.closable,
    });
  };

  const openSyncSettings = () => {
    localStorage.setItem("incrementum_settings_initial_tab", "sync");
    const existing = tabs.find((tab) => tab.type === "settings");
    if (existing) {
      return;
    }

    addTab({
      title: "Settings",
      icon: <Settings className="w-4 h-4" />,
      type: "settings",
      content: SettingsTab,
      closable: true,
    });
  };

  const quickReviewCards = useMemo(
    () =>
      documents.slice(0, 10).map((doc) => ({
        id: doc.id,
        front: doc.title || "Untitled",
        back: doc.content?.slice(0, 220) || t("dashboardTab.noExtractedContent"),
        documentTitle: doc.title || t("dashboardTab.untitled"),
      })),
    [documents]
  );

  const handleQuickRate = async (
    _cardId: string,
    _rating: "again" | "hard" | "good" | "easy"
  ) => {
    // Placeholder until dashboard quick-review is wired to review queue ratings.
  };

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-2">
            {t("dashboard.welcomeBack")}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {t("dashboard.companion")}
          </p>
        </div>

        {/* Quick Actions Grid - 2 columns mobile, 3 columns tablet+, adaptive rows */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => openTab(action)}
                className="group relative flex flex-col items-start p-4 md:p-5 bg-card hover:bg-accent border border-border rounded-xl transition-all duration-200 hover:shadow-md active:scale-[0.98] text-left"
              >
                <div
                  className={`${action.iconBg} p-2.5 md:p-3 rounded-lg mb-3 transition-transform group-hover:scale-110`}
                >
                  <Icon className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <h3 className="font-semibold text-sm md:text-base text-foreground mb-0.5">
                  {action.title}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {action.description}
                </p>
                {action.primary && stats && (
                  <div className="absolute top-3 right-3 md:top-4 md:right-4">
                    <div className="flex items-center gap-1 text-xs font-medium text-primary">
                      {action.id === "queue" && (stats.due_documents || stats.cards_due_today || 0) > 0 && (
                        <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          {(stats.due_documents || stats.cards_due_today || 0)} {t("dashboard.due")}
                        </span>
                      )}
                      {action.id === "review" && stats.cards_due_today > 0 && (
                        <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          {stats.cards_due_today} {t("dashboard.due")}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Main Stats Card */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4 md:p-6">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-lg md:text-xl font-semibold text-foreground">
                  {t("dashboard.yourProgress")}
                </h2>
              </div>
              <button
                onClick={() => openTab(quickActions.find(a => a.id === "analytics")!)}
                className="text-xs md:text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
              >
                {t("dashboard.viewAll")}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 md:gap-6">
              <div className="text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                  <Files className="w-4 h-4 text-muted-foreground" />
                  <span className="text-2xl md:text-3xl font-bold text-foreground">
                    {isLoading ? (
                      <span className="animate-pulse">...</span>
                    ) : (
                      stats?.total_documents ?? 0
                    )}
                  </span>
                </div>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {t("dashboard.documents")}
                </p>
              </div>

              <div className="text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                  <Target className="w-4 h-4 text-muted-foreground" />
                  <span className="text-2xl md:text-3xl font-bold text-foreground">
                    {isLoading ? (
                      <span className="animate-pulse">...</span>
                    ) : (
                      stats?.cards_due_today ?? 0
                    )}
                  </span>
                </div>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {t("layout.dueToday")}
                </p>
              </div>

              <div className="text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                  <Zap className="w-4 h-4 text-muted-foreground" />
                  <span className="text-2xl md:text-3xl font-bold text-foreground">
                    {isLoading ? (
                      <span className="animate-pulse">...</span>
                    ) : (
                      stats?.cards_learned ?? 0
                    )}
                  </span>
                </div>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {t("dashboard.cardsLearned")}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-border">
              <div className="flex items-center justify-between text-xs md:text-sm mb-2">
                <span className="text-muted-foreground">{t("dashboard.dailyGoalProgress")}</span>
                <span className="font-medium text-foreground">
                  {Math.min(
                    100,
                    Math.round(
                      ((stats?.reviews_today || stats?.cards_reviewed_today || 0) /
                        Math.max(1, stats?.daily_goal || 20)) *
                        100
                    )
                  )}
                  %
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        ((stats?.reviews_today || stats?.cards_reviewed_today || 0) /
                          Math.max(1, stats?.daily_goal || 20)) *
                          100
                      )
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Sync Card */}
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-4 md:p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <svg
                  className="w-5 h-5 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v4m0 0l-2-2m2 2l2-2M8 8h8v8H8V8zm0 8l2 2m-2-2l2 2m4-2l-2 2m2-2l-2 2"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-foreground">{t("dashboard.deviceSync")}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t("dashboard.syncDescription")}
            </p>
            <button
              onClick={openSyncSettings}
              className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {t("dashboard.setupSync")}
            </button>
          </div>
        </div>

        {/* Tips Section */}
        <div className="mt-6 md:mt-8 p-4 md:p-5 bg-muted/50 border border-border rounded-xl">
          <h3 className="font-medium text-sm text-foreground mb-2">
            💡 {t("dashboard.quickTip")}
          </h3>
          <p className="text-xs md:text-sm text-muted-foreground">
            {t("dashboard.commandPaletteHint")}
          </p>
        </div>

        {/* Quick Review */}
        <div className="mt-6 md:mt-8">
          <QuickReviewWidget
            cards={quickReviewCards}
            onRate={handleQuickRate}
            onExpand={() => {
              const reviewAction = quickActions.find((action) => action.id === "review");
              if (reviewAction) openTab(reviewAction);
            }}
            maxCards={5}
          />
        </div>
      </div>
    </div>
  );
}
