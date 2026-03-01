import { useEffect, useState, useCallback } from "react";
import { useSettingsStore } from "../../stores/settingsStore";
import { useAnalyticsStore } from "../../stores/analyticsStore";
import { SyncStatusIndicator } from "../sync/SyncStatusIndicator";
import { UserMenu } from "../auth/UserMenu";
import { Breadcrumb } from "../common/Breadcrumb";
import { Toast } from "../common/Toast";
import { OfflineIndicator } from "../pwa";
import { useI18n } from "../../lib/i18n";
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
} from "lucide-react";

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
}

const sidebarItems: SidebarItem[] = [
  { id: "continue-reading", label: "nav.continue", icon: BookMarked },
  { id: "dashboard", label: "nav.dashboard", icon: Home },
  { id: "documents", label: "nav.documents", icon: BookOpen },
  { id: "queue", label: "nav.queue", icon: Layers },
  { id: "knowledge-graph", label: "nav.graph", icon: Network },
  { id: "analytics", label: "nav.analytics", icon: BarChart3 },
  { id: "settings", label: "nav.settings", icon: Settings },
];

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
    <div className="app-shell flex flex-col w-full bg-cream">
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
      <div className="flex flex-1 overflow-hidden relative">
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
    </div>
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
            <button
              key={item.id}
              onClick={() => setActiveItem(item.id)}
              data-tutorial={item.id === 'queue' ? 'queue-nav' : item.id === 'analytics' ? 'analytics-nav' : item.id === 'documents' ? 'document-list' : undefined}
              className={`w-full px-4 py-3 min-h-[44px] flex items-center gap-3 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset focus-visible:outline-none ${
                activeItem === item.id ? "sidebar-item-active" : "sidebar-item hover:bg-sidebar-hover"
              } ${isCollapsed ? "justify-center" : ""}`}
              aria-current={activeItem === item.id ? "page" : undefined}
              aria-label={`Navigate to ${t(item.label)}`}
              title={isCollapsed ? t(item.label) : undefined}
            >
              <item.icon className="w-5 h-5 text-foreground flex-shrink-0" />
              {!isCollapsed && (
                <span className="text-sm font-medium text-foreground flex-1 text-left truncate">
                  {t(item.label)}
                </span>
              )}
              {!isCollapsed && item.count !== undefined && (
                <span className="text-xs text-foreground-muted">{item.count}</span>
              )}
            </button>
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
            <button
              key={item.id}
              onClick={() => {
                setActiveItem(item.id);
                onClose();
              }}
              className={`w-full px-4 py-3 min-h-[44px] flex items-center gap-3 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset focus-visible:outline-none ${
                activeItem === item.id ? "sidebar-item-active" : "sidebar-item hover:bg-sidebar-hover"
              }`}
              aria-current={activeItem === item.id ? "page" : undefined}
              aria-label={`Navigate to ${t(item.label)}`}
            >
              <item.icon className="w-5 h-5 text-foreground" />
              <span className="text-sm font-medium text-foreground flex-1 text-left">
                {t(item.label)}
              </span>
              {item.count !== undefined && (
                <span className="text-xs text-foreground-muted">{item.count}</span>
              )}
            </button>
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
  const tabs = [
    { id: "import", label: "Import" },
    { id: "review", label: "Start Review Process" },
    { id: "queue", label: "View Queue" },
    { id: "reports", label: "Reports" },
    { id: "statistics", label: "Statistics" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Stats Bar */}
      {showStatsBar && stats && (
        <div className="h-16 glass-panel-light flex items-center px-6 flex-shrink-0">
          <div className="flex gap-8">
            <div>
              <div className="stats-number">{stats.total}</div>
              <div className="text-xs text-foreground-secondary">Total Items</div>
            </div>
            <div>
              <div className="stats-number">{stats.due}</div>
              <div className="text-xs text-foreground-secondary">Due Today</div>
            </div>
            <div>
              <div className="stats-number">{stats.new}</div>
              <div className="text-xs text-foreground-secondary">New Items</div>
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
                {tab.label}
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
          {stats?.total || 0} items total
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
