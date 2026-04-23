import { useEffect, useState, useCallback } from "react";
import { NewMainLayout, MainContent } from "./components/layout/NewMainLayout";
import { useAnalyticsStore } from "./stores/analyticsStore";
import { useDocumentStore } from "./stores/documentStore";
import { invokeCommand } from "./lib/tauri";
import * as syncClient from "./lib/sync-client";
import { LoginModal } from "./components/auth/LoginModal";
import { WelcomeScreen } from "./components/onboarding/WelcomeScreen";
import { SignupPrompt } from "./components/onboarding/SignupPrompt";
import { InteractiveTutorial } from "./components/onboarding/InteractiveTutorial";
import { KeyboardShortcutsHelp } from "./components/common/KeyboardShortcutsHelp";
import { hasImportedDemoContent, markDemoContentImported } from "./utils/demoContent";
import { useToast } from "./components/common/Toast";
import { initializeNotifications } from "./utils/notificationService";
import { registerOpenDocumentCallback } from "./lib/videoTranscriptionQueue";
import { HAPTIC_FEEDBACK_CSS } from "./hooks/useHapticFeedback";

// PWA Components
import { PWAInstallPrompt, UpdateNotification } from "./components/pwa";
import { QuickReviewWidget, InlineQuickReview, FloatingReviewButton } from "./components/review/QuickReviewWidget";
import { ShortcutTooltip } from "./components/common/ShortcutTooltip";
import { ClipboardQuickAddWatcher } from "./components/common/ClipboardQuickAddWatcher";

// Page components
import { DocumentsPage } from "./pages/DocumentsPage";
import { QueuePage } from "./pages/QueuePage";
import { QueueScrollPage } from "./pages/QueueScrollPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ContinueReadingPage } from "./pages/ContinueReadingPage";
import { KnowledgeGraphPage } from "./pages/KnowledgeGraphPage";
import { ImageRegistryPage } from "./pages/ImageRegistryPage";
import { CommandCenter } from "./components/search/CommandCenter";
import { useI18n } from "./lib/i18n";

// Storage keys
const ONBOARDING_COMPLETE_KEY = 'incrementum_onboarding_complete';
const TUTORIAL_COMPLETE_KEY = 'incrementum_tutorial_complete';

type OnboardingStep = 'welcome' | 'tutorial' | 'signup' | null;
type AppPage =
  | "continue-reading"
  | "dashboard"
  | "documents"
  | "image-registry"
  | "queue"
  | "queue-scroll"
  | "analytics"
  | "knowledge-graph"
  | "settings";

interface ActivityDataPoint {
  date: string;
  reviews_count: number;
  time_spent_minutes: number;
}

type DevHelpers = {
  resetOnboarding: () => void;
  showTutorial: () => void;
  showSignupPrompt: () => void;
  completeOnboarding: () => void;
  getAuthState: () => {
    isAuthenticated: boolean;
    user: ReturnType<typeof syncClient.getUser>;
    hasToken: boolean;
  };
};

function normalizePathToPage(path?: string): AppPage | null {
  if (!path) return null;
  switch (path) {
    case "/":
    case "/dashboard":
      return "dashboard";
    case "/continue-reading":
      return "continue-reading";
    case "/documents":
      return "documents";
    case "/image-registry":
      return "image-registry";
    case "/queue":
      return "queue";
    case "/queue-scroll":
      return "queue-scroll";
    case "/analytics":
      return "analytics";
    case "/knowledge-graph":
      return "knowledge-graph";
    case "/settings":
      return "settings";
    default:
      return null;
  }
}

function isAppPage(page: string): page is AppPage {
  return [
    "continue-reading",
    "dashboard",
    "documents",
    "image-registry",
    "queue",
    "queue-scroll",
    "analytics",
    "knowledge-graph",
    "settings",
  ].includes(page);
}

function App() {
  const [currentPage, setCurrentPage] = useState<AppPage>("dashboard");
  const loadAll = useAnalyticsStore((state) => state.loadAll);
  const loadDocuments = useDocumentStore((state) => state.loadDocuments);
  const dashboardStats = useAnalyticsStore((state) => state.dashboardStats);

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(syncClient.isAuthenticated());
  const [user, setUser] = useState(syncClient.getUser());
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Onboarding state
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(() => {
    const hasCompletedOnboarding = localStorage.getItem(ONBOARDING_COMPLETE_KEY);
    const hasCompletedTutorial = localStorage.getItem(TUTORIAL_COMPLETE_KEY);
    if (hasCompletedOnboarding) return null;
    if (hasCompletedTutorial === 'skipped' || hasCompletedTutorial === 'true') return 'signup';
    return 'welcome';
  });

  // Keyboard shortcuts help state
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const toast = useToast();
  const handlePageChange = useCallback((page: string) => {
    if (isAppPage(page)) {
      setCurrentPage(page);
    }
  }, []);

  const handleNavigate = useCallback((page: string) => {
    if (isAppPage(page)) {
      setCurrentPage(page);
    }
  }, []);

  const handleLogout = () => {
    syncClient.logout();
    setIsAuthenticated(false);
    setUser(null);
  };

  const handleAuthenticated = () => {
    setIsAuthenticated(true);
    setUser(syncClient.getUser());
  };

  useEffect(() => {
    loadAll();
    loadDocuments();
    setIsAuthenticated(syncClient.isAuthenticated());
    setUser(syncClient.getUser());

    // Subscribe to sync state changes
    const unsubscribe = syncClient.subscribeSyncState(() => {
      // Reserved for future UI updates.
    });

    // Initialize notifications
    initializeNotifications();

    // Register callback for transcription completion toasts
    const unregisterCallback = registerOpenDocumentCallback((documentId: string) => {
      // Navigate to documents page and open the transcribed document
      setCurrentPage("documents");
      // Find and set the document
      const doc = useDocumentStore.getState().documents.find(d => d.id === documentId);
      if (doc) {
        useDocumentStore.getState().setCurrentDocument(doc);
      }
    });

    return () => {
      unsubscribe();
      unregisterCallback();
    };
  }, [loadAll, loadDocuments]);

  // Capture-phase handler: preventDefault() early so webkit2gtk/GTK doesn't
  // intercept shortcuts like Ctrl+Q (quit), Ctrl+N (new window), Ctrl+P (print).
  useEffect(() => {
    const captureShortcuts = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (["k", "p", ",", "d", "q", "r", "o", "n", "/"].includes(key)) {
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", captureShortcuts, true);
    return () => document.removeEventListener("keydown", captureShortcuts, true);
  }, []);

  // Tauri-level global shortcut handler: receives shortcuts registered at the
  // native level (lib.rs) which fire BEFORE webkit2gtk can intercept them.
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen<string>("global-shortcut", (event) => {
          const key = event.payload;
          console.debug("[global-shortcut] received:", key);
          switch (key) {
            case "KeyQ":
              setCurrentPage("queue");
              break;
            case "KeyR":
              setCurrentPage("queue");
              window.setTimeout(() => {
                window.dispatchEvent(new CustomEvent("start-review-session"));
              }, 0);
              break;
            case "KeyD":
              setCurrentPage("dashboard");
              break;
            case "KeyK":
            case "KeyP":
              window.dispatchEvent(new CustomEvent("command-palette-open"));
              break;
            case "Comma":
              setCurrentPage("settings");
              break;
            case "KeyO":
            case "KeyN":
              setCurrentPage("documents");
              window.setTimeout(() => {
                window.dispatchEvent(new CustomEvent("import-document"));
              }, 0);
              break;
            case "Slash":
              setShowShortcutsHelp(true);
              break;
          }
        });
      } catch {
        // Not running in Tauri (PWA mode) — JS handler is the fallback
      }
    })();
    return () => { unlisten?.(); };
  }, []);

  // Direct Ctrl+K / Ctrl+P handler as fallback for Linux AppImage where
  // WebKitGTK may consume the keydown before the JS handler or global-shortcut plugin can catch it.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "k" && e.key !== "K" && e.key !== "p" && e.key !== "P") return;
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent("command-palette-open"));
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  // Keyboard shortcut to show help
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (isTyping) {
        return;
      }

      if (mod) {
        const key = e.key.toLowerCase();
        if (key === "k" || key === "p") {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("command-palette-open"));
          return;
        }
        if (key === ",") {
          e.preventDefault();
          setCurrentPage("settings");
          return;
        }
        if (key === "d") {
          e.preventDefault();
          setCurrentPage("dashboard");
          return;
        }
        if (key === "q") {
          e.preventDefault();
          setCurrentPage("queue");
          return;
        }
        if (key === "r") {
          e.preventDefault();
          setCurrentPage("queue");
          window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent("start-review-session"));
          }, 0);
          return;
        }
        if (key === "o" || key === "n") {
          e.preventDefault();
          setCurrentPage("documents");
          window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent("import-document"));
          }, 0);
          return;
        }
        if (e.key === "/") {
          e.preventDefault();
          setShowShortcutsHelp(true);
          return;
        }
      }

      // Show shortcuts help on '?' key (but not when typing in inputs)
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        if (isTyping) {
          return;
        }
        e.preventDefault();
        setShowShortcutsHelp(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleNavigate = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      const next = normalizePathToPage(customEvent.detail);
      if (next) {
        setCurrentPage(next);
      }
    };
    const handleNavigateToSettings = () => setCurrentPage("settings");
    const handleShowShortcuts = () => setShowShortcutsHelp(true);

    window.addEventListener("navigate", handleNavigate as EventListener);
    window.addEventListener("navigate-to-settings", handleNavigateToSettings as EventListener);
    window.addEventListener("show-shortcuts-help", handleShowShortcuts as EventListener);

    return () => {
      window.removeEventListener("navigate", handleNavigate as EventListener);
      window.removeEventListener("navigate-to-settings", handleNavigateToSettings as EventListener);
      window.removeEventListener("show-shortcuts-help", handleShowShortcuts as EventListener);
    };
  }, []);

  // Developer helper: expose functions to window for debugging
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as Window & { __incrementumDev?: DevHelpers }).__incrementumDev = {
        resetOnboarding: () => {
          localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
          localStorage.removeItem(TUTORIAL_COMPLETE_KEY);
          setOnboardingStep('welcome');
          console.log('[Dev] Onboarding reset - refresh to see welcome screen');
        },
        showTutorial: () => {
          setOnboardingStep('tutorial');
        },
        showSignupPrompt: () => {
          setOnboardingStep('signup');
        },
        completeOnboarding: () => {
          localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
          localStorage.setItem(TUTORIAL_COMPLETE_KEY, 'true');
          setOnboardingStep(null);
        },
        getAuthState: () => ({
          isAuthenticated,
          user,
          hasToken: !!syncClient.getAuthToken(),
        }),
      };
      console.log('[Dev] __incrementumDev available in window');
    }
  }, [isAuthenticated, user]);

  const handleCompleteOnboarding = () => {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    setOnboardingStep(null);
  };

  const handleWelcomeComplete = () => {
    setOnboardingStep('tutorial');
  };

  const handleTutorialComplete = () => {
    localStorage.setItem(TUTORIAL_COMPLETE_KEY, 'true');
    setOnboardingStep('signup');
  };

  const handleTutorialSkip = () => {
    localStorage.setItem(TUTORIAL_COMPLETE_KEY, 'skipped');
    setOnboardingStep('signup');
  };

  const handleImportDemoContent = async () => {
    // Mark demo content as imported to prevent showing again
    if (!hasImportedDemoContent()) {
      markDemoContentImported();
      toast.success("Demo content ready!", "You can find sample documents in your library. Start reviewing to see sample flashcards!");
      // Navigate to documents page to show the imported content
      setCurrentPage("documents");
    }
  };

  const handleSignupFromOnboarding = () => {
    setShowLoginModal(true);
  };

  const renderPage = () => {
    switch (currentPage) {
      case "continue-reading":
        return <ContinueReadingPage />;
      case "dashboard":
        return <DashboardPage onNavigate={handleNavigate} />;
      case "documents":
        return <DocumentsPage />;
      case "image-registry":
        return <ImageRegistryPage />;
      case "queue":
        return <QueuePage />;
      case "queue-scroll":
        return <QueueScrollPage />;
      case "analytics":
        return <AnalyticsPage />;
      case "knowledge-graph":
        return <KnowledgeGraphPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <DashboardPage onNavigate={handleNavigate} />;
    }
  };

  // Full-screen pages without layout
  if (currentPage === "queue-scroll") {
    return <QueueScrollPage />;
  }

  // Show onboarding screens
  if (onboardingStep === 'welcome') {
    return (
      <>
        <WelcomeScreen
          onComplete={handleWelcomeComplete}
          onImportDemo={handleImportDemoContent}
        />
        {/* Show app behind the onboarding overlay */}
        <NewMainLayout
          activeItem={currentPage}
          onPageChange={handlePageChange}
          isAuthenticated={isAuthenticated}
          user={user}
          onLoginClick={() => setShowLoginModal(true)}
          onLogout={handleLogout}
        >
          {renderPage()}
        </NewMainLayout>
        <ClipboardQuickAddWatcher />
      </>
    );
  }

  if (onboardingStep === 'tutorial') {
    return (
      <>
        <InteractiveTutorial
          onComplete={handleTutorialComplete}
          onSkip={handleTutorialSkip}
        />
        <NewMainLayout
          activeItem={currentPage}
          onPageChange={handlePageChange}
          isAuthenticated={isAuthenticated}
          user={user}
          onLoginClick={() => setShowLoginModal(true)}
          onLogout={handleLogout}
        >
          {renderPage()}
        </NewMainLayout>
        <ClipboardQuickAddWatcher />
      </>
    );
  }

  if (onboardingStep === 'signup') {
    return (
      <>
        <SignupPrompt
          onSignup={handleSignupFromOnboarding}
          onContinueDemo={handleCompleteOnboarding}
        />
        <NewMainLayout
          activeItem={currentPage}
          onPageChange={handlePageChange}
          isAuthenticated={isAuthenticated}
          user={user}
          onLoginClick={() => setShowLoginModal(true)}
          onLogout={handleLogout}
        >
          {renderPage()}
        </NewMainLayout>
        <ClipboardQuickAddWatcher />
      </>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: HAPTIC_FEEDBACK_CSS }} />
      <CommandCenter />
      <NewMainLayout
        activeItem={currentPage}
        onPageChange={handlePageChange}
        isAuthenticated={isAuthenticated}
        user={user}
        onLoginClick={() => setShowLoginModal(true)}
        onLogout={handleLogout}
      >
        {renderPage()}
      </NewMainLayout>
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onAuthenticated={handleAuthenticated}
      />
      <KeyboardShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
      {/* PWA Components */}
      <PWAInstallPrompt
        onInstall={() => toast.success("App installed!", "Incrementum is now available offline.")}
        onDismiss={() => console.log("[PWA] Install prompt dismissed")}
      />
      <UpdateNotification className="fixed top-4 right-4 z-50 max-w-sm" />
      {/* Floating review button for mobile */}
      <FloatingReviewButton
        dueCount={dashboardStats?.cards_due_today || 0}
        onClick={() => setCurrentPage("queue")}
      />
      <ClipboardQuickAddWatcher />
    </>
  );
}

// Dashboard Page with real stats
interface DashboardPageProps {
  onNavigate: (page: string) => void;
}

function DashboardPage({ onNavigate }: DashboardPageProps) {
  const dashboardStats = useAnalyticsStore((state) => state.dashboardStats);
  const documents = useDocumentStore((state) => state.documents);
  const [recentActivity, setRecentActivity] = useState<ActivityDataPoint[]>([]);
  const [activeTab, setActiveTab] = useState("review");
  const { t } = useI18n();

  useEffect(() => {
    loadRecentActivity();
  }, []);

  const loadRecentActivity = async () => {
    try {
      const activity = await invokeCommand<ActivityDataPoint[]>("get_activity_data", { days: 7 });
      if (activity && Array.isArray(activity)) {
        setRecentActivity(activity.slice(-5).reverse());
      } else {
        setRecentActivity([]);
      }
    } catch (error) {
      console.error("Failed to load recent activity:", error);
      setRecentActivity([]);
    }
  };

  // Convert cards for quick review widget
  const reviewCards = documents.slice(0, 10).map(doc => ({
    id: doc.id,
    front: doc.title || "Untitled",
    back: doc.content?.slice(0, 200) || "",
    documentTitle: doc.title,
  }));

  const handleRateCard = async (cardId: string, rating: "again" | "hard" | "good" | "easy") => {
    console.log(`[Dashboard] Rated card ${cardId} as ${rating}`);
    // The actual rating would be handled by the review system
  };

  return (
    <MainContent
      showStatsBar={true}
      stats={{
        total: dashboardStats?.total_cards || 0,
        due: dashboardStats?.cards_due_today || 0,
        new: dashboardStats?.cards_learned || 0,
      }}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Actions */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">{t("dashboard.quickActions")}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ShortcutTooltip label="Import Document" shortcut="mod+o">
                  <button
                    onClick={() => onNavigate("documents")}
                    className="w-full p-4 bg-card border border-border rounded-lg hover:shadow-md hover:border-primary/30 transition-all text-left"
                  >
                    <div className="text-2xl mb-2">📄</div>
                    <div className="text-sm font-medium text-foreground">{t("dashboard.import")}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      PDF, EPUB, or MD
                    </div>
                  </button>
                </ShortcutTooltip>
                <ShortcutTooltip label="View Queue" shortcut="q">
                  <button
                    onClick={() => onNavigate("queue")}
                    className="w-full p-4 bg-card border border-border rounded-lg hover:shadow-md hover:border-primary/30 transition-all text-left"
                  >
                    <div className="text-2xl mb-2">📚</div>
                    <div className="text-sm font-medium text-foreground">{t("nav.queue")}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {t("dashboard.due", { count: dashboardStats?.cards_due_today || 0 })}
                    </div>
                  </button>
                </ShortcutTooltip>
                <ShortcutTooltip label="Start Review" shortcut="r">
                  <button
                    onClick={() => setActiveTab("review")}
                    className="w-full p-4 bg-card border border-border rounded-lg hover:shadow-md hover:border-primary/30 transition-all text-left"
                  >
                    <div className="text-2xl mb-2">🎴</div>
                    <div className="text-sm font-medium text-foreground">{t("dashboard.review")}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {t("dashboard.flashcards")}
                    </div>
                  </button>
                </ShortcutTooltip>
                <ShortcutTooltip label="View Statistics" shortcut="g a">
                  <button
                    onClick={() => onNavigate("analytics")}
                    className="w-full p-4 bg-card border border-border rounded-lg hover:shadow-md hover:border-primary/30 transition-all text-left"
                  >
                    <div className="text-2xl mb-2">📊</div>
                    <div className="text-sm font-medium text-foreground">{t("dashboard.stats")}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {t("dashboard.progress")}
                    </div>
                  </button>
                </ShortcutTooltip>
              </div>
            </div>

            {/* Recent Activity */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">{t("dashboard.recentActivity")}</h2>
              {recentActivity.length === 0 ? (
                <div className="p-6 bg-card border border-border rounded-lg text-center text-muted-foreground">
                  {t("dashboard.noRecentActivity")}
                </div>
              ) : (
                <div className="bg-card border border-border rounded-lg divide-y divide-border">
                  {recentActivity.map((activity, index) => (
                    <div key={index} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <div>
                          <div className="text-sm text-foreground">
                            {t("dashboard.reviewsCompleted", { count: activity.reviews_count })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(activity.date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {activity.time_spent_minutes} min
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Welcome Message for New Users */}
            {dashboardStats?.total_cards === 0 && (
              <div className="p-6 bg-card border border-border rounded-lg text-center">
                <div className="text-4xl mb-3">👋</div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t("dashboard.welcome")}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("dashboard.welcomeBody")}
                </p>
                <button
                  onClick={() => onNavigate("documents")}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
                >
                  {t("dashboard.importFirst")}
                </button>
              </div>
            )}
          </div>

          {/* Sidebar - Quick Review Widget */}
          <div className="space-y-6">
            <QuickReviewWidget
              cards={reviewCards}
              onRate={handleRateCard}
              onExpand={() => onNavigate("queue")}
              maxCards={5}
              className="sticky top-4"
            />

            {/* Quick Stats */}
            {(dashboardStats?.cards_due_today || 0) > 0 && (
              <InlineQuickReview
                dueCount={dashboardStats?.cards_due_today || 0}
                onStartReview={() => onNavigate("queue")}
              />
            )}
          </div>
        </div>
      </div>
    </MainContent>
  );
}

export default App;
