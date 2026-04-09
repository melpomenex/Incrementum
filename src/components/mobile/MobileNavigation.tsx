/**
 * Mobile Bottom Navigation
 *
 * Provides mobile-optimized bottom navigation with:
 * - Tab-based navigation
 * - Active state indicators
 * - Badge notifications
 * - Responsive icon sizing
 */

import { useEffect, useMemo, useState } from "react";
import {
  Home,
  FileText,
  Brain,
  Rss,
  Settings,
  BarChart3,
  X,
  Newspaper,
  Maximize2,
  Minimize2,
  Menu,
  Search,
  Download,
  BookOpen,
} from "lucide-react";
import { toggleFullscreen, isFullscreen, isFullscreenSupported, isPWA } from "../../lib/pwa";
import { useI18n } from "../../lib/i18n";
import { useTabsStore } from "../../stores";
import type { TabType } from "../../stores/tabsStore";
import { usePWAStatus } from "../pwa";
import {
  DashboardTab,
  QueueTab,
  ReviewTab,
  DocumentsTab,
  AnalyticsTab,
  SettingsTab,
  RSSReader,
  NewsletterDirectoryTab,
} from "../tabs/TabRegistry";

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  tabType: TabType;
  tabTitle: string;
  tabIcon: string;
  tabContent: React.ComponentType;
  closable: boolean;
  badge?: "review" | "rss";
}

// Primary nav items shown on mobile bottom nav
const primaryNavItems: NavItem[] = [
  {
    id: "dashboard",
    label: "Home",
    icon: Home,
    tabType: "dashboard",
    tabTitle: "Dashboard",
    tabIcon: "📊",
    tabContent: DashboardTab,
    closable: false,
  },
  {
    id: "queue",
    label: "Queue",
    icon: FileText,
    tabType: "queue",
    tabTitle: "Queue",
    tabIcon: "📚",
    tabContent: QueueTab,
    closable: true,
    badge: "review",
  },
  {
    id: "review",
    label: "Review",
    icon: Brain,
    tabType: "review",
    tabTitle: "Review",
    tabIcon: "🧠",
    tabContent: ReviewTab,
    closable: true,
  },
  {
    id: "documents",
    label: "Library",
    icon: BookOpen,
    tabType: "documents",
    tabTitle: "Documents",
    tabIcon: "📂",
    tabContent: DocumentsTab,
    closable: true,
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    tabType: "settings",
    tabTitle: "Settings",
    tabIcon: "⚙️",
    tabContent: SettingsTab,
    closable: true,
  },
];

// All nav items for reference (used by more menu)
const allNavItems: NavItem[] = [
  ...primaryNavItems,
  {
    id: "rss",
    label: "RSS",
    icon: Rss,
    tabType: "rss",
    tabTitle: "RSS Feeds",
    tabIcon: "📰",
    tabContent: RSSReader,
    closable: true,
    badge: "rss",
  },
  {
    id: "newsletter",
    label: "Newsletters",
    icon: Newspaper,
    tabType: "newsletter",
    tabTitle: "Newsletter Directory",
    tabIcon: "📬",
    tabContent: NewsletterDirectoryTab,
    closable: true,
  },
  {
    id: "analytics",
    label: "Stats",
    icon: BarChart3,
    tabType: "analytics",
    tabTitle: "Statistics",
    tabIcon: "📈",
    tabContent: AnalyticsTab,
    closable: true,
  },
];

interface MobileNavigationProps {
  dueCount?: number;
  unreadCount?: number;
  hidden?: boolean;
}

export function MobileNavigation({
  dueCount = 0,
  unreadCount = 0,
  hidden = false,
}: MobileNavigationProps) {
  const { t } = useI18n();
  const { tabs, rootPane, addTab, setActiveTab } = useTabsStore();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [fullscreenState, setFullscreenState] = useState(isFullscreen());
  const [showIosInstallHelp, setShowIosInstallHelp] = useState(false);
  const { canInstall, install, isStandalone } = usePWAStatus();
  const isIOSDevice =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);
  const showInstallCta = !isStandalone && (canInstall || isIOSDevice);
  
  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreenState(isFullscreen());
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);
  
  // Handle fullscreen toggle
  const handleFullscreenToggle = async () => {
    await toggleFullscreen();
    setFullscreenState(isFullscreen());
    setShowMoreMenu(false);
  };
  
  // Show fullscreen option only when:
  // 1. Fullscreen API is supported
  // 2. Not in PWA fullscreen mode already (manifest display: fullscreen)
  const showFullscreenOption = isFullscreenSupported() && !isPWA();
  
  // Get active tab ID from the first tab pane
  const activeTabId = useMemo(() => {
    const findFirstTabPane = (pane: typeof rootPane): { type: "tabs"; id: string; tabIds: string[]; activeTabId: string | null } | null => {
      if (pane.type === "tabs") return pane;
      if (pane.type === "split") {
        for (const child of pane.children) {
          const found = findFirstTabPane(child);
          if (found) return found;
        }
      }
      return null;
    };
    const firstPane = findFirstTabPane(rootPane);
    return firstPane?.activeTabId ?? null;
  }, [rootPane]);
  
  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? null,
    [tabs, activeTabId]
  );

  const moreItems = useMemo(
    () => allNavItems.filter((item) => !primaryNavItems.find((primary) => primary.id === item.id)),
    []
  );
  const moreMenuActive = moreItems.some((item) => item.tabType === activeTab?.type);

  const openTab = (item: NavItem) => {
    const existing = tabs.find((tab) => tab.type === item.tabType);
    if (existing) {
      // Find the pane containing this tab and activate it
      const findPaneContainingTab = (pane: typeof rootPane): { type: "tabs"; id: string; tabIds: string[]; activeTabId: string | null } | null => {
        if (pane.type === "tabs" && pane.tabIds.includes(existing.id)) return pane;
        if (pane.type === "split") {
          for (const child of pane.children) {
            const found = findPaneContainingTab(child);
            if (found) return found;
          }
        }
        return null;
      };
      const pane = findPaneContainingTab(rootPane);
      if (pane) {
        setActiveTab(pane.id, existing.id);
      }
      return;
    }

    addTab({
      title: item.tabTitle,
      icon: item.tabIcon,
      type: item.tabType,
      content: item.tabContent,
      closable: item.closable,
    });
  };

  const handleInstall = async () => {
    if (isIOSDevice) {
      setShowIosInstallHelp((prev) => !prev);
      return;
    }

    await install();
    setShowMoreMenu(false);
  };

  return (
    <>
    <nav className={`mobile-bottom-nav ${hidden ? "hidden" : ""}`} aria-hidden={hidden}>
      {primaryNavItems.map((item) => {
        const active = activeTab?.type === item.tabType;
        const badge =
          item.badge === "review"
            ? dueCount
            : item.badge === "rss"
            ? unreadCount
            : 0;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              openTab(item);
              setShowMoreMenu(false);
              setShowIosInstallHelp(false);
            }}
            className={`mobile-nav-item ${active ? 'active' : ''}`}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
          >
            <span className="mobile-nav-item-background" aria-hidden="true" />
            <div className="mobile-nav-icon">
              <item.icon className="w-6 h-6" />
              {badge > 0 && (
                <span className="mobile-nav-badge">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </div>
            <span className="mobile-nav-label">{item.label}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => {
          setShowMoreMenu(true);
          setShowIosInstallHelp(false);
        }}
        className={`mobile-nav-item ${showMoreMenu || moreMenuActive ? 'active' : ''}`}
        aria-label="More sections and actions"
        aria-expanded={showMoreMenu}
      >
        <span className="mobile-nav-item-background" aria-hidden="true" />
        <div className="mobile-nav-icon">
          <Menu className="w-6 h-6" />
        </div>
        <span className="mobile-nav-label">{t("nav.more")}</span>
      </button>
    </nav>

      {/* More Menu Overlay */}
      {showMoreMenu && (
        <div 
          className="mobile-more-overlay"
          onClick={() => {
            setShowMoreMenu(false);
            setShowIosInstallHelp(false);
          }}
        >
          <div 
            className="mobile-more-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-more-header">
              <div>
                <p className="mobile-more-eyebrow">{t("nav.more")}</p>
                <h3 className="mobile-more-title">{t("mobileNav.sectionsAndActions")}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowMoreMenu(false);
                  setShowIosInstallHelp(false);
                }}
                className="mobile-more-close"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mobile-more-section">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const badge =
                  item.badge === "review"
                    ? dueCount
                    : item.badge === "rss"
                    ? unreadCount
                    : 0;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      openTab(item);
                      setShowMoreMenu(false);
                      setShowIosInstallHelp(false);
                    }}
                    className={`mobile-more-item ${activeTab?.type === item.tabType ? "mobile-more-item-active" : ""}`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {badge > 0 && (
                      <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full">
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mobile-more-section">
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("command-palette-open"));
                  setShowMoreMenu(false);
                  setShowIosInstallHelp(false);
                }}
                className="mobile-more-item"
              >
                <Search className="w-5 h-5" />
                <span className="flex-1 text-left">Search</span>
              </button>

              {showInstallCta && (
                <button
                  type="button"
                  onClick={handleInstall}
                  className="mobile-more-item"
                >
                  <Download className="w-5 h-5" />
                  <span className="flex-1 text-left">
                    {isIOSDevice ? t("mobileNav.addHomeScreen") : t("mobileNav.installApp")}
                  </span>
                </button>
              )}

              {showFullscreenOption && (
                <button
                  onClick={handleFullscreenToggle}
                  className="mobile-more-item"
                >
                  {fullscreenState ? (
                    <>
                      <Minimize2 className="w-5 h-5" />
                      <span className="flex-1 text-left">{t("mobileNav.exitFullscreen")}</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-5 h-5" />
                      <span className="flex-1 text-left">{t("mobileNav.enterFullscreen")}</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {showInstallCta && isIOSDevice && showIosInstallHelp && (
              <div className="mobile-more-tip">
                <p className="mobile-more-tip-title">{t("mobileNav.addToHomeScreenTip")}</p>
                <p className="mobile-more-tip-copy" dangerouslySetInnerHTML={{ __html: t("mobileNav.addToHomeScreenDesc") }} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Mobile settings panel with PWA-specific options
 */
export function MobileSettingsPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState({
    autoSync: true,
    offlineMode: true,
    notifications: true,
    vibration: true,
    fontSize: "medium",
  });

  if (!isOpen) return null;

  return (
    <div className="mobile-settings-panel" onClick={onClose}>
      <div className="mobile-settings-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="mobile-settings-header">
          <h2 className="mobile-settings-title">Settings</h2>
          <button
            onClick={onClose}
            className="mobile-settings-close"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PWA Status */}
        <div className="mobile-settings-section">
          <h3 className="mobile-settings-section-title">App Status</h3>
          <PWastatusIndicator />
        </div>

        {/* Sync Settings */}
        <div className="mobile-settings-section">
          <h3 className="mobile-settings-section-title">Sync & Offline</h3>
          <ToggleSetting
            label="Auto-sync content"
            checked={settings.autoSync}
            onChange={(checked) => setSettings({ ...settings, autoSync: checked })}
          />
          <ToggleSetting
            label="Offline reading mode"
            description="Download content for offline access"
            checked={settings.offlineMode}
            onChange={(checked) => setSettings({ ...settings, offlineMode: checked })}
          />
        </div>

        {/* Reading Settings */}
        <div className="mobile-settings-section">
          <h3 className="mobile-settings-section-title">Reading</h3>
          <SelectSetting
            label="Font size"
            value={settings.fontSize}
            options={[
              { value: "small", label: "Small" },
              { value: "medium", label: "Medium" },
              { value: "large", label: "Large" },
            ]}
            onChange={(value) => setSettings({ ...settings, fontSize: value })}
          />
        </div>

        {/* Interface Settings */}
        <div className="mobile-settings-section">
          <h3 className="mobile-settings-section-title">Interface</h3>
          <ToggleSetting
            label="Notifications"
            description="Learning reminders and updates"
            checked={settings.notifications}
            onChange={(checked) => setSettings({ ...settings, notifications: checked })}
          />
          <ToggleSetting
            label="Vibration feedback"
            checked={settings.vibration}
            onChange={(checked) => setSettings({ ...settings, vibration: checked })}
          />
        </div>

        {/* Cache Management */}
        <div className="mobile-settings-section">
          <h3 className="mobile-settings-section-title">Storage</h3>
          <ButtonSetting
            label="Clear offline data"
            description="Free up storage used by offline content"
            onClick={() => {
              // Implement clear cache
              console.log("Clearing offline data");
            }}
          />
          <ButtonSetting
            label="Download for offline"
            description="Download current document for offline reading"
            onClick={() => {
              // Implement offline download
              console.log("Downloading for offline");
            }}
          />
        </div>

        {/* Save button */}
        <div className="mobile-settings-footer">
          <button
            onClick={() => {
              // Save settings
              console.log("Saving settings:", settings);
              onClose();
            }}
            className="mobile-settings-save"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * PWA Status indicator
 */
export function PWastatusIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Check PWA status
    const checkPWA = () => {
      setIsPWA(
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true
      );
    };

    checkPWA();
    window.matchMedia("(display-mode: standalone)").addEventListener("change", checkPWA);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div className="pwa-status">
      <div className={`pwa-status-item ${isPWA ? "installed" : ""}`}>
        <span className="pwa-status-dot" />
        <span className="text-xs text-muted-foreground">
          {isPWA ? "Installed as app" : "Install as app"}
        </span>
      </div>
      <div className={`pwa-status-item ${isOnline ? "online" : "offline"}`}>
        <span className="pwa-status-dot" />
        <span className="text-xs text-muted-foreground">
          {isOnline ? "Online" : "Offline"}
        </span>
      </div>
    </div>
  );
}

/**
 * Toggle setting component
 */
function ToggleSetting({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="toggle-setting">
      <div className="toggle-setting-info">
        <span className="toggle-setting-label">{label}</span>
        {description && (
          <span className="toggle-setting-desc">{description}</span>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`toggle-switch ${checked ? "on" : "off"}`}
        role="switch"
        aria-checked={checked}
        tabIndex={0}
      >
        <span className="toggle-slider" />
      </button>
    </div>
  );
}

/**
 * Select setting component
 */
function SelectSetting({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="select-setting">
      <label className="select-setting-label">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="select-setting-select"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Button setting component
 */
function ButtonSetting({
  label,
  description,
  onClick,
}: {
  label: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="button-setting"
    >
      <div className="button-setting-info">
        <span className="button-setting-label">{label}</span>
        {description && (
          <span className="button-setting-desc">{description}</span>
        )}
      </div>
    </button>
  );
}
