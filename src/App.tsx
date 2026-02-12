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
import { Breadcrumb } from "./components/common/Breadcrumb";
import { useToast } from "./components/common/Toast";
import { initializeNotifications } from "./utils/notificationService";
import { registerOpenDocumentCallback } from "./lib/videoTranscriptionQueue";

// PWA Components
import { PWAInstallPrompt, UpdateNotification } from "./components/pwa";
import { QuickReviewWidget, InlineQuickReview, FloatingReviewButton } from "./components/review/QuickReviewWidget";
import { ShortcutTooltip, ShortcutButton } from "./components/common/ShortcutTooltip";

// Page components
import { DocumentsPage } from "./pages/DocumentsPage";
import { QueuePage } from "./pages/QueuePage";
import { QueueScrollPage } from "./pages/QueueScrollPage";
import { ReviewPage } from "./pages/ReviewPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ContinueReadingPage } from "./pages/ContinueReadingPage";
import { AIWorkflowsPage } from "./pages/AIWorkflowsPage";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { KnowledgeGraphPage } from "./pages/KnowledgeGraphPage";
import { SearchPage } from "./pages/SearchPage";
import { CommandCenter } from "./components/search/CommandCenter";

// Storage keys
const ONBOARDING_COMPLETE_KEY = 'incrementum_onboarding_complete';
const TUTORIAL_COMPLETE_KEY = 'incrementum_tutorial_complete';

type OnboardingStep = 'welcome' | 'tutorial' | 'signup' | null;

function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [activeTab, setActiveTab] = useState("review");
  const loadAll = useAnalyticsStore((state) => state.loadAll);
  const loadDocuments = useDocumentStore((state) => state.loadDocuments);

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

  const handleLogin = async (email: string, password: string) => {
    await syncClient.login(email, password);
    setIsAuthenticated(true);
    setUser(syncClient.getUser());
    // Migrate any local demo data to the account
    await syncClient.migrateDemoDataToAccount();
  };

  const handleRegister = async (email: string, password: string) => {
    await syncClient.register(email, password);
    setIsAuthenticated(true);
    setUser(syncClient.getUser());
    // Migrate any local demo data to the account
    await syncClient.migrateDemoDataToAccount();
  };

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
    const unsubscribe = syncClient.subscribeSyncState((syncState) => {
      // Sync state updates could trigger UI changes here
      console.log('Sync state updated:', syncState);
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

  // Keyboard shortcut to show help
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Show shortcuts help on '?' key (but not when typing in inputs)
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        setShowShortcutsHelp(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Developer helper: expose functions to window for debugging
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as any).__incrementumDev = {
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

  const handleSkipOnboarding = () => {
    setOnboardingStep(null);
  };

  const handleImportDemoContent = async () => {
    // Mark demo content as imported to prevent showing again
    if (!hasImportedDemoContent()) {
      markDemoContentImported();
      toast.show("Demo content ready!", "You can find sample documents in your library. Start reviewing to see sample flashcards!");
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
        return <DashboardPage onNavigate={setCurrentPage} />;
      case "documents":
        return <DocumentsPage />;
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
        return <DashboardPage onNavigate={setCurrentPage} />;
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
          onPageChange={setCurrentPage}
          isAuthenticated={isAuthenticated}
          user={user}
          onLoginClick={() => setShowLoginModal(true)}
          onLogout={handleLogout}
        >
          {renderPage()}
        </NewMainLayout>
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
          onPageChange={setCurrentPage}
          isAuthenticated={isAuthenticated}
          user={user}
          onLoginClick={() => setShowLoginModal(true)}
          onLogout={handleLogout}
        >
          {renderPage()}
        </NewMainLayout>
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
          onPageChange={setCurrentPage}
          isAuthenticated={isAuthenticated}
          user={user}
          onLoginClick={() => setShowLoginModal(true)}
          onLogout={handleLogout}
        >
          {renderPage()}
        </NewMainLayout>
      </>
    );
  }

  return (
    <>
      <CommandCenter />
      <NewMainLayout
        activeItem={currentPage}
        onPageChange={setCurrentPage}
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
        onInstall={() => toast.show("App installed!", "Incrementum is now available offline.")}
        onDismiss={() => console.log("[PWA] Install prompt dismissed")}
      />
      <UpdateNotification className="fixed top-4 right-4 z-50 max-w-sm" />
      {/* Floating review button for mobile */}
      <FloatingReviewButton
        dueCount={dashboardStats?.cards_due_today || 0}
        onClick={() => setCurrentPage("queue")}
      />
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
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("review");

  useEffect(() => {
    loadRecentActivity();
  }, []);

  const loadRecentActivity = async () => {
    try {
      const activity = await invokeCommand<any[]>("get_activity_data", { days: 7 });
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
    back: doc.extracted_text?.slice(0, 200) || "No content available",
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
              <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ShortcutTooltip label="Import Document" shortcut="mod+o">
                  <button
                    onClick={() => onNavigate("documents")}
                    className="w-full p-4 bg-card border border-border rounded-lg hover:shadow-md hover:border-primary/30 transition-all text-left"
                  >
                    <div className="text-2xl mb-2">📄</div>
                    <div className="text-sm font-medium text-foreground">Import</div>
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
                    <div className="text-sm font-medium text-foreground">Queue</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {dashboardStats?.cards_due_today || 0} due
                    </div>
                  </button>
                </ShortcutTooltip>
                <ShortcutTooltip label="Start Review" shortcut="r">
                  <button
                    onClick={() => setActiveTab("review")}
                    className="w-full p-4 bg-card border border-border rounded-lg hover:shadow-md hover:border-primary/30 transition-all text-left"
                  >
                    <div className="text-2xl mb-2">🎴</div>
                    <div className="text-sm font-medium text-foreground">Review</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Flashcards
                    </div>
                  </button>
                </ShortcutTooltip>
                <ShortcutTooltip label="View Statistics" shortcut="g a">
                  <button
                    onClick={() => onNavigate("analytics")}
                    className="w-full p-4 bg-card border border-border rounded-lg hover:shadow-md hover:border-primary/30 transition-all text-left"
                  >
                    <div className="text-2xl mb-2">📊</div>
                    <div className="text-sm font-medium text-foreground">Stats</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Progress
                    </div>
                  </button>
                </ShortcutTooltip>
              </div>
            </div>

            {/* Recent Activity */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
              {recentActivity.length === 0 ? (
                <div className="p-6 bg-card border border-border rounded-lg text-center text-muted-foreground">
                  No recent activity. Start by importing a document!
                </div>
              ) : (
                <div className="bg-card border border-border rounded-lg divide-y divide-border">
                  {recentActivity.map((activity, index) => (
                    <div key={index} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <div>
                          <div className="text-sm text-foreground">
                            {activity.reviews_count} reviews completed
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
                  Welcome to Incrementum!
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Your incremental reading and spaced repetition companion.
                  Import your first document to get started.
                </p>
                <button
                  onClick={() => onNavigate("documents")}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
                >
                  Import Your First Document
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
