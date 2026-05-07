import { useEffect, useState, useCallback } from "react";
import { useSettingsStore } from "../../stores/settingsStore";
import { useAnalyticsStore } from "../../stores/analyticsStore";
import { SyncStatusIndicator } from "../sync/SyncStatusIndicator";
import { UserMenu } from "../auth/UserMenu";
import { Breadcrumb } from "../common/Breadcrumb";
import { Toast } from "../common/Toast";
import { ThemeBackdrop } from "../common/ThemeBackdrop";
import { OfflineIndicator, usePWAStatus } from "../pwa";
import { useI18n } from "../../lib/i18n";
import { isTauri } from "../../lib/tauri";
import {
  Home,
  BookOpen,
  Layers,
  BarChart3,
  Settings,
  Bell,
  Search,
  ChevronLeft,
  ChevronRight,
  Network,
  BookMarked,
  Menu,
  X,
  Download,
  Search as SearchIcon,
  Images,
  Headphones,
} from "lucide-react";

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
}

interface NavItemButtonProps {
  item: SidebarItem;
  isActive: boolean;
  isCollapsed?: boolean;
  orientation?: "vertical" | "horizontal";
  label: string;
  onClick: () => void;
  tutorialId?: string;
}

const sidebarItems: SidebarItem[] = [
  { id: "continue-reading", label: "nav.continue", icon: BookMarked },
  { id: "dashboard", label: "nav.dashboard", icon: Home },
  { id: "documents", label: "nav.documents", icon: BookOpen },
  { id: "image-registry", label: "nav.images", icon: Images },
  { id: "podcast", label: "podcastManager.podcasts", icon: Headphones },
  { id: "queue", label: "nav.queue", icon: Layers },
  { id: "knowledge-graph", label: "nav.graph", icon: Network },
  { id: "analytics", label: "nav.analytics", icon: BarChart3 },
  { id: "settings", label: "nav.settings", icon: Settings },
];

function NavItemButton({
  item,
  isActive,
  isCollapsed = false,
  orientation = "vertical",
  label,
  onClick,
  tutorialId,
}: NavItemButtonProps) {
  return (
    <button
      onClick={onClick}
      data-tutorial={tutorialId}
      data-nav-orientation={orientation}
      className={`app-nav-item w-full min-h-[44px] flex items-center gap-3 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset focus-visible:outline-none ${
        isActive ? "sidebar-item-active" : "sidebar-item hover:bg-sidebar-hover"
      } ${isCollapsed ? "justify-center px-3 py-3" : "px-4 py-3"}`}
      aria-current={isActive ? "page" : undefined}
      aria-label={`Navigate to ${label}`}
      title={isCollapsed ? label : undefined}
    >
      <span className="app-nav-item-background" aria-hidden="true" />
      <span className="app-nav-item-indicator" aria-hidden="true" />
      <span className="app-nav-item-content">
        <item.icon className="w-5 h-5 text-foreground flex-shrink-0" />
        {!isCollapsed && (
          <span className="text-sm font-medium text-foreground flex-1 text-left truncate">
            {label}
          </span>
        )}
        {!isCollapsed && item.count !== undefined && (
          <span className="text-xs text-foreground-muted">{item.count}</span>
        )}
      </span>
    </button>
  );
}

export function NewMainLayout({
  children,
  activeItem,
  onPageChange,
  isAuthenticated,
  user,
  onLoginClick,
  onLogout,
}: {
  children: React.ReactNode;
  activeItem: string;
  onPageChange: (page: string) => void;
  isAuthenticated?: boolean;
  user?: { id: string; email: string } | null;
  onLoginClick?: () => void;
  onLogout?: () => void;
}) {
  const settingsTheme = useSettingsStore((state) => state.settings.appearance?.theme || "system");
  const dashboardStats = useAnalyticsStore((state) => state.dashboardStats);
  const { t } = useI18n();

  // Sidebar state for mobile responsiveness
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isReaderFocusMode, setIsReaderFocusMode] = useState(false);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    const isDark =
      settingsTheme === "dark" ||
      (settingsTheme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [settingsTheme]);

  // Handle keyboard shortcuts for sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle sidebar with Ctrl+B
      if (e.ctrlKey && e.key === "b") {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleReaderFocusMode = (event: Event) => {
      const customEvent = event as CustomEvent<{ active?: boolean }>;
      setIsReaderFocusMode(!!customEvent.detail?.active);
    };

    window.addEventListener("incrementum-reader-focus-mode-change", handleReaderFocusMode as EventListener);
    return () => {
      window.removeEventListener("incrementum-reader-focus-mode-change", handleReaderFocusMode as EventListener);
    };
  }, []);

  // Close mobile sidebar when page changes
  const handlePageChange = useCallback((page: string) => {
    onPageChange(page);
    setIsSidebarOpen(false);
  }, [onPageChange]);

  return (
    <div className="app-shell relative isolate flex flex-col w-full bg-cream">
      <ThemeBackdrop />

      {/* Toast Notifications */}
      <Toast />

      {/* Top Header Bar */}
      {!isReaderFocusMode && (
        <TopHeaderBar
          isAuthenticated={isAuthenticated}
          user={user}
          onLoginClick={onLoginClick}
          onLogout={onLogout}
          onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen}
        />
      )}

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* Mobile Sidebar Overlay */}
        {!isReaderFocusMode && isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden animate-glass-fade-in"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Left Sidebar */}
        {!isReaderFocusMode && (
            <LeftSidebar
              activeItem={activeItem}
              setActiveItem={handlePageChange}
              t={t}
              stats={dashboardStats}
            isOpen={isSidebarOpen}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            onClose={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-auto main-content">
          {children}
        </main>
      </div>

      {!isReaderFocusMode && (
        <MobileBottomBar
          activeItem={activeItem}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}

interface MobileBottomBarProps {
  activeItem: string;
  onPageChange: (page: string) => void;
}

const mobilePrimaryItems = [
  { id: "dashboard", label: "nav.dashboard", icon: Home },
  { id: "documents", label: "nav.documents", icon: BookOpen },
  { id: "image-registry", label: "nav.images", icon: Images },
  { id: "queue", label: "nav.queue", icon: Layers },
  { id: "settings", label: "nav.settings", icon: Settings },
] as const;

const mobileSecondaryItems = [
  { id: "continue-reading", label: "nav.continue", icon: BookMarked },
  { id: "image-registry", label: "nav.images", icon: Images },
  { id: "knowledge-graph", label: "nav.graph", icon: Network },
  { id: "analytics", label: "nav.analytics", icon: BarChart3 },
] as const;

function MobileBottomBar({ activeItem, onPageChange }: MobileBottomBarProps) {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [showIosInstallHelp, setShowIosInstallHelp] = useState(false);
  const { canInstall, install, isStandalone } = usePWAStatus();
  const { t } = useI18n();

  const isIOSDevice =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);
  const showInstallCta = !isTauri() && !isStandalone && (canInstall || isIOSDevice);
  const moreActive = mobileSecondaryItems.some((item) => item.id === activeItem);

  const handleInstall = async () => {
    if (isIOSDevice) {
      setShowIosInstallHelp((prev) => !prev);
      return;
    }

    await install();
    setIsMoreMenuOpen(false);
  };

  return (
    <>
      <nav
        className="mobile-pwa-bottom-bar lg:hidden"
        aria-label="Primary navigation"
      >
        <div className="mobile-pwa-bottom-bar-shell">
          {mobilePrimaryItems.map((item) => {
            const active = activeItem === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  onPageChange(item.id);
                }}
                className={`mobile-pwa-nav-item ${active ? "mobile-pwa-nav-item-active" : ""}`}
                aria-current={active ? "page" : undefined}
                aria-label={t(item.label)}
              >
                <span className="mobile-pwa-nav-item-background" aria-hidden="true" />
                <span className="mobile-pwa-nav-item-indicator" aria-hidden="true" />
                <span className="mobile-pwa-nav-item-content">
                  <item.icon className="w-5 h-5" />
                  <span className="mobile-pwa-nav-label">{t(item.label)}</span>
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setIsMoreMenuOpen(true)}
            className={`mobile-pwa-nav-item ${moreActive || isMoreMenuOpen ? "mobile-pwa-nav-item-active" : ""}`}
            aria-expanded={isMoreMenuOpen}
            aria-label={t("nav.more")}
          >
            <span className="mobile-pwa-nav-item-background" aria-hidden="true" />
            <span className="mobile-pwa-nav-item-indicator" aria-hidden="true" />
            <span className="mobile-pwa-nav-item-content">
              <Menu className="w-5 h-5" />
              <span className="mobile-pwa-nav-label">{t("nav.more")}</span>
            </span>
          </button>
        </div>
      </nav>

      {isMoreMenuOpen && (
        <div
          className="mobile-pwa-sheet-overlay lg:hidden"
          onClick={() => {
            setIsMoreMenuOpen(false);
            setShowIosInstallHelp(false);
          }}
        >
          <div
            className="mobile-pwa-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mobile-pwa-sheet-header">
              <div>
                <p className="mobile-pwa-sheet-eyebrow">{t("nav.more")}</p>
                <h2 className="mobile-pwa-sheet-title">{t("nav.more")}</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  setShowIosInstallHelp(false);
                }}
                className="mobile-pwa-sheet-close"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mobile-pwa-sheet-section">
              {mobileSecondaryItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onPageChange(item.id);
                    setIsMoreMenuOpen(false);
                    setShowIosInstallHelp(false);
                  }}
                  className={`mobile-pwa-sheet-item ${activeItem === item.id ? "mobile-pwa-sheet-item-active" : ""}`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="flex-1 text-left">{t(item.label)}</span>
                </button>
              ))}
            </div>

            <div className="mobile-pwa-sheet-section">
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("command-palette-open"));
                  setIsMoreMenuOpen(false);
                  setShowIosInstallHelp(false);
                }}
                className="mobile-pwa-sheet-item"
              >
                <SearchIcon className="w-5 h-5" />
                <span className="flex-1 text-left">Search</span>
              </button>

              {showInstallCta && (
                <button
                  type="button"
                  onClick={handleInstall}
                  className="mobile-pwa-sheet-item"
                >
                  <Download className="w-5 h-5" />
                  <span className="flex-1 text-left">
                    {isIOSDevice ? "Add to Home Screen" : "Install App"}
                  </span>
                </button>
              )}
            </div>

            {showInstallCta && isIOSDevice && showIosInstallHelp && (
              <div className="mobile-pwa-install-tip">
                <p className="mobile-pwa-install-tip-title">Add this app to your home screen</p>
                <p className="mobile-pwa-install-tip-copy">
                  Open the browser share menu, then choose <strong>Add to Home Screen</strong>.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

interface TopHeaderBarProps {
  isAuthenticated?: boolean;
  user?: { id: string; email: string; subscriptionTier?: string } | null;
  onLoginClick?: () => void;
  onLogout?: () => void;
  onMenuClick?: () => void;
  isSidebarOpen?: boolean;
}

function TopHeaderBar({
  isAuthenticated,
  user,
  onLoginClick,
  onLogout,
  onMenuClick,
  isSidebarOpen,
}: TopHeaderBarProps) {
  const topSafeInset = "env(safe-area-inset-top, 0px)";

  const handleOpenSettings = () => {
    window.dispatchEvent(new CustomEvent('navigate-to-settings'));
  };

  return (
    <header
      className="glass-panel-light flex items-center justify-between px-3 flex-shrink-0 tauri-drag-region relative z-50"
      style={{
        height: `calc(3rem + ${topSafeInset})`,
        paddingTop: topSafeInset,
      }}
      data-tauri-drag-region
    >
      {/* Left side - navigation icons */}
      <div className="flex items-center gap-1">
        {/* Mobile menu button */}
        <button
          className="p-2.5 min-w-[44px] min-h-[44px] hover:bg-muted rounded transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none lg:hidden"
          title="Toggle menu"
          aria-label="Toggle menu"
          onClick={onMenuClick}
        >
          {isSidebarOpen ? (
            <X className="w-4 h-4 text-foreground-secondary" />
          ) : (
            <Menu className="w-4 h-4 text-foreground-secondary" />
          )}
        </button>
        <button
          className="p-2.5 min-w-[44px] min-h-[44px] hover:bg-muted rounded transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          title="Back"
          aria-label="Go back"
          onClick={() => window.history.back()}
        >
          <ChevronLeft className="w-4 h-4 text-foreground-secondary" />
        </button>
        <button
          className="p-2.5 min-w-[44px] min-h-[44px] hover:bg-muted rounded transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          title="Forward"
          aria-label="Go forward"
          onClick={() => window.history.forward()}
        >
          <ChevronRight className="w-4 h-4 text-foreground-secondary" />
        </button>
        <div className="h-4 w-px bg-border mx-1" />
        <button
          className="p-2.5 min-w-[44px] min-h-[44px] hover:bg-muted rounded transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          title="Home"
          aria-label="Go to dashboard"
          onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: '/dashboard' }))}
        >
          <Home className="w-4 h-4 text-foreground-secondary" />
        </button>
        <div className="ml-2 hidden sm:block">
          <Breadcrumb
            onNavigate={(path) => window.dispatchEvent(new CustomEvent('navigate', { detail: path }))}
          />
        </div>
      </div>

      {/* Right side - actions */}
      <div className="flex items-center gap-1">
        <OfflineIndicator showLabel={false} />
        <SyncStatusIndicator
          isAuthenticated={isAuthenticated}
          onLoginClick={onLoginClick}
        />
        <button
          className="p-2.5 min-w-[44px] min-h-[44px] hover:bg-muted rounded transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          title="Search (Ctrl+K)"
          aria-label="Open search (Ctrl+K)"
          onClick={() => window.dispatchEvent(new CustomEvent('command-palette-open'))}
        >
          <Search className="w-4 h-4 text-foreground-secondary" />
        </button>
        <button
          className="p-2.5 min-w-[44px] min-h-[44px] hover:bg-muted rounded transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          title="Notifications"
          aria-label="View notifications"
          onClick={() => window.dispatchEvent(new CustomEvent('show-notifications'))}
        >
          <Bell className="w-4 h-4 text-foreground-secondary" />
        </button>
        <div className="h-4 w-px bg-border mx-1" />
        {isAuthenticated && user ? (
          <UserMenu
            user={user}
            onLogout={onLogout}
            onOpenSettings={handleOpenSettings}
          />
        ) : (
          onLoginClick && (
            <button
              onClick={onLoginClick}
              className="px-4 py-2 min-h-[44px] text-sm glass-button text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              aria-label="Sign in to your account"
            >
              Sign in
            </button>
          )
        )}
      </div>
    </header>
  );
}

interface LeftSidebarProps {
  activeItem: string;
  setActiveItem: (item: string) => void;
  t: (key: string) => string;
  stats: any;
  isOpen: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onClose: () => void;
}

function LeftSidebar({ activeItem, setActiveItem, t, stats, isOpen, isCollapsed, onToggleCollapse, onClose }: LeftSidebarProps) {
  const sidebarWidth = isCollapsed ? "w-16" : "w-64";
  const mobileSidebarTop = "calc(3rem + env(safe-area-inset-top, 0px))";

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col sidebar-section flex-shrink-0 transition-all duration-300 ease-out ${sidebarWidth} relative`}
      >
        {/* Sidebar Items */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {sidebarItems.map((item) => (
            <NavItemButton
              key={item.id}
              item={item}
              isActive={activeItem === item.id}
              isCollapsed={isCollapsed}
              label={t(item.label)}
              onClick={() => setActiveItem(item.id)}
              tutorialId={item.id === 'queue' ? 'queue-nav' : item.id === 'analytics' ? 'analytics-nav' : item.id === 'documents' ? 'document-list' : undefined}
            />
          ))}
        </div>

        {/* Collapse Toggle Button */}
        <button
          onClick={onToggleCollapse}
          className="absolute top-1/2 -right-3 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center shadow-sm hover:bg-muted transition-colors z-10"
          title={isCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-3 h-3 text-foreground-secondary" />
          ) : (
            <ChevronLeft className="w-3 h-3 text-foreground-secondary" />
          )}
        </button>

        {/* Bottom Stats Panel */}
        {!isCollapsed && (
          <div className="glass-card-enhanced m-2 p-3 flex-shrink-0">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-foreground">
                  {stats?.total_cards || 0}
                </div>
                <div className="text-[10px] text-foreground-secondary uppercase">
                  Total
                </div>
              </div>
              <div>
                <div className="text-lg font-bold text-foreground">
                  {stats?.cards_learned || 0}
                </div>
                <div className="text-[10px] text-foreground-secondary uppercase">
                  Learned
                </div>
              </div>
              <div>
                <div className="text-lg font-bold text-foreground">
                  {stats?.cards_due_today || 0}
                </div>
                <div className="text-[10px] text-foreground-secondary uppercase">
                  Due
                </div>
              </div>
              <div>
                <div className="text-lg font-bold text-foreground">0</div>
                <div className="text-[10px] text-foreground-secondary uppercase">
                  New
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Sidebar (Slide-in) */}
      <aside
        className={`fixed left-0 bottom-0 w-64 sidebar-section z-50 lg:hidden transform transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ top: mobileSidebarTop }}
      >
        {/* Sidebar Items */}
        <div className="flex-1 overflow-y-auto">
          {sidebarItems.map((item) => (
            <NavItemButton
              key={item.id}
              item={item}
              isActive={activeItem === item.id}
              label={t(item.label)}
              onClick={() => {
                setActiveItem(item.id);
                onClose();
              }}
            />
          ))}
        </div>

        {/* Bottom Stats Panel */}
        <div className="glass-card-enhanced m-2 p-3 flex-shrink-0">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-lg font-bold text-foreground">
                {stats?.total_cards || 0}
              </div>
              <div className="text-[10px] text-foreground-secondary uppercase">
                Total
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-foreground">
                {stats?.cards_learned || 0}
              </div>
              <div className="text-[10px] text-foreground-secondary uppercase">
                Learned
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-foreground">
                {stats?.cards_due_today || 0}
              </div>
              <div className="text-[10px] text-foreground-secondary uppercase">
                Due
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-foreground">0</div>
              <div className="text-[10px] text-foreground-secondary uppercase">
                New
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

// Export content wrapper for main content area with stats bar and tabs
interface MainContentProps {
  children: React.ReactNode;
  showStatsBar?: boolean;
  stats?: {
    total: number;
    due: number;
    new: number;
  };
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function MainContent({
  children,
  showStatsBar = true,
  stats,
  activeTab,
  onTabChange,
}: MainContentProps) {
  const { t } = useI18n();
  const tabs = [
    { id: "import", label: "dashboard.import" },
    { id: "review", label: "layout.startReviewProcess" },
    { id: "queue", label: "layout.viewQueue" },
    { id: "reports", label: "layout.reports" },
    { id: "statistics", label: "layout.statistics" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Stats Bar */}
      {showStatsBar && stats && (
        <div className="h-16 glass-panel-light flex items-center px-6 flex-shrink-0">
          <div className="flex gap-8">
            <div>
              <div className="stats-number">{stats.total}</div>
              <div className="text-xs text-foreground-secondary">{t("layout.totalItems")}</div>
            </div>
            <div>
              <div className="stats-number">{stats.due}</div>
              <div className="text-xs text-foreground-secondary">{t("layout.dueToday")}</div>
            </div>
            <div>
              <div className="stats-number">{stats.new}</div>
              <div className="text-xs text-foreground-secondary">{t("layout.newItems")}</div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      {activeTab && onTabChange && (
        <div className="px-6 pt-4 pb-3 flex-shrink-0">
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`tab-button whitespace-nowrap ${
                  activeTab === tab.id ? "tab-button-active" : ""
                }`}
              >
                {t(tab.label)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {children}
      </div>

      {/* Bottom Bar */}
      <div className="h-8 glass-panel-light flex items-center justify-between px-3 flex-shrink-0">
        <div className="text-xs text-foreground-secondary">
          {t("layout.itemsTotal", { count: stats?.total || 0 })}
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1 hover:bg-muted rounded text-foreground-secondary">
            <ChevronLeft className="w-3 h-3" />
          </button>
          <span className="text-xs text-foreground-secondary">1</span>
          <button className="p-1 hover:bg-muted rounded text-foreground-secondary">
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
