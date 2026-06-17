/**
 * Settings page - Main settings UI with search functionality
 */

import { useState, useMemo, useEffect } from "react";
import {
  ArrowLeft,
  ArrowsClockwise,
  Bell,
  BookOpen,
  BookOpenText,
  Brain,
  CaretRight,
  Cloud,
  FolderOpen,
  GraduationCap,
  Keyboard,
  MagnifyingGlass,
  Microphone,
  Palette,
  Plug,
  Rss,
  Gear as SettingsIcon,
  Shield,
  Sliders,
  SpeakerHigh,
  X,
} from "@phosphor-icons/react";
import { KeyboardShortcutSettings } from "./KeyboardShortcutsSettings";
import { AISettings as AIProviderSettings } from "./AIProviderSettings";
import { ImportExportSettings as ImportExportSettingsComponent } from "./ImportExportSettings";
import { SyncSettings as SyncSettingsOriginal } from "./SyncSettings";
import { LearningSettings } from "./LearningSettings";
import { DocumentsSettings } from "./DocumentsSettings";
import { RSSSettings } from "./RSSSettings";
import { CloudStorageSettings } from "./CloudStorageSettings";
import { ThemePicker } from "./ThemePicker";
import { IntegrationSettings } from "./IntegrationSettings";
import { HandbookSettings } from "./HandbookSettings";
import { NotificationSettings } from "./NotificationSettings";
import { AudioTranscriptionSettings } from "./AudioTranscriptionSettings";
import { TTSSettings } from "./TTSSettings";
import { SmartQueuesSettings } from "./SmartQueuesSettings";
import { useToast } from "../common/Toast";
import { cn } from "../../utils";
import { getDeviceInfo } from "../../lib/pwa";
import { isTauri } from "../../lib/tauri";
import { checkForUpdates, type UpdateInfo } from "../../utils/updateChecker";
import { useSettingsStore } from "../../stores";
import { UpdateAvailableDialog } from "./UpdateAvailableDialog";
import { loadGoogleFont } from "../../utils/fonts";
import { useI18n } from "../../lib/i18n";

/**
 * Settings tab
 */
export enum SettingsTab {
  General = "general",
  Appearance = "appearance",
  Learning = "learning",
  Documents = "documents",
  RSS = "rss",
  Shortcuts = "shortcuts",
  AI = "ai",
  AudioTranscription = "audio-transcription",
  TTS = "tts",
  Sync = "sync",
  Integrations = "integrations",
  CloudStorage = "cloud-storage",
  ImportExport = "import-export",
  Notifications = "notifications",
  Privacy = "privacy",
  Handbook = "handbook",
}

/**
 * Settings tab config with keywords for search
 */
interface SettingsTabConfig {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
  keywords: string[];
  description: string;
}

export const SETTINGS_TABS: SettingsTabConfig[] = [
  {
    id: SettingsTab.General,
    label: "settings.general",
    icon: Sliders,
    keywords: ["language", "startup", "default", "view", "auto-save", "backup", "data", "storage"],
    description: "Basic application settings, language, and data management",
  },
  {
    id: SettingsTab.Appearance,
    label: "settings.appearance",
    icon: Palette,
    keywords: [
      "theme",
      "color",
      "font",
      "size",
      "typography",
      "dark mode",
      "light mode",
      "display",
      "compact",
    ],
    description: "Customize the look and feel of the app",
  },
  {
    id: SettingsTab.Learning,
    label: "settings.learning",
    icon: GraduationCap,
    keywords: [
      "algorithm",
      "fsrs",
      "interval",
      "review",
      "flashcard",
      "retention",
      "difficulty",
      "scheduler",
    ],
    description: "Learning algorithm and review settings",
  },
  {
    id: SettingsTab.Documents,
    label: "settings.documents",
    icon: BookOpen,
    keywords: ["import", "pdf", "epub", "reading", "extract", "annotation", "highlight", "tas", "tag", "scheduling", "prerequisite", "interference", "jitter", "maturity", "coherence"],
    description: "Document import and reading preferences",
  },
  {
    id: SettingsTab.RSS,
    label: "settings.rss",
    icon: Rss,
    keywords: ["rss", "feed", "article", "retention", "cleanup", "keep", "subscription", "queue"],
    description: "RSS feed subscription, retention policies and Smart Queue settings",
  },
  {
    id: SettingsTab.Shortcuts,
    label: "settings.shortcuts",
    icon: Keyboard,
    keywords: ["keyboard", "hotkey", "keybinding", "shortcut", "command", "vim"],
    description: "Keyboard shortcuts and keybindings",
  },
  {
    id: SettingsTab.AI,
    label: "settings.ai",
    icon: Brain,
    keywords: [
      "openai",
      "anthropic",
      "ollama",
      "llm",
      "model",
      "token",
      "api key",
      "assistant",
      "flashcard generation",
    ],
    description: "AI provider settings and API keys",
  },
  {
    id: SettingsTab.AudioTranscription,
    label: "settings.audioTranscription",
    icon: Microphone,
    keywords: [
      "audio",
      "transcription",
      "whisper",
      "speech",
      "speech to text",
      "model",
      "download",
      "offline",
    ],
    description: "Download Whisper models for local transcription",
  },
  {
    id: SettingsTab.TTS,
    label: "settings.tts",
    icon: SpeakerHigh,
    keywords: ["tts", "text to speech", "fal", "voice clone", "speech synthesis", "audio output"],
    description: "Configure Fal.ai voices, cloning, and generation presets",
  },
  {
    id: SettingsTab.Sync,
    label: "settings.sync",
    icon: ArrowsClockwise,
    keywords: ["synchronization", "backup", "cloud", "export", "import", "data transfer"],
    description: "Data synchronization settings",
  },
  {
    id: SettingsTab.Integrations,
    label: "settings.integrations",
    icon: Plug,
    keywords: ["obsidian", "anki", "third-party", "extension", "browser", "plugin"],
    description: "Third-party app integrations",
  },
  {
    id: SettingsTab.CloudStorage,
    label: "settings.cloudStorage",
    icon: Cloud,
    keywords: ["google drive", "dropbox", "onedrive", "backup", "cloud", "storage", "oauth"],
    description: "Cloud storage providers and backups",
  },
  {
    id: SettingsTab.ImportExport,
    label: "settings.importExport",
    icon: FolderOpen,
    keywords: ["data", "backup", "migration", "json", "csv", "archive", "transfer"],
    description: "Import and export your data",
  },
  {
    id: SettingsTab.Notifications,
    label: "settings.notifications",
    icon: Bell,
    keywords: ["reminder", "alert", "study", "due", "email", "push", "sound"],
    description: "Notification and reminder settings",
  },
  {
    id: SettingsTab.Privacy,
    label: "settings.privacy",
    icon: Shield,
    keywords: ["security", "password", "encryption", "private", "data protection", "gdpr"],
    description: "Privacy and security settings",
  },
  {
    id: SettingsTab.Handbook,
    label: "settings.handbook",
    icon: BookOpenText,
    keywords: ["guide", "help", "tutorial", "documentation", "manual", "how to", "learn"],
    description: "User guide and documentation",
  },
];

function SettingsMenuItem({
  icon: Icon,
  label,
  description,
  isActive,
  isMobile,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  description?: string;
  isActive: boolean;
  isMobile: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "settings-menu-item w-full text-left text-foreground",
        isActive && "settings-menu-item-active"
      )}
    >
      <span className="settings-menu-item-background" aria-hidden="true" />
      <span className="settings-menu-item-indicator" aria-hidden="true" />
      <span className="settings-menu-item-content">
        <Icon className={cn("w-4 h-4 flex-shrink-0", description && "mt-0.5")} />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium">{label}</span>
          {description && (
            <span
              className={cn(
                "block text-xs mt-0.5 line-clamp-1",
                isActive ? "text-primary-foreground/80" : "text-muted-foreground"
              )}
            >
              {description}
            </span>
          )}
        </span>
        {isMobile && !description && (
          <CaretRight
            className={cn(
              "w-4 h-4 ml-auto",
              isActive ? "opacity-100" : "opacity-40"
            )}
          />
        )}
      </span>
    </button>
  );
}

/**
 * Settings page component
 */
export function SettingsPage() {
  const [activeTab, setActiveTab] = useState(SettingsTab.General);
  const [hasChanges, setHasChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(true);

  const deviceInfo = getDeviceInfo();
  const isMobile = deviceInfo.isMobile || deviceInfo.isTablet;
  const initialTabKey = "incrementum_settings_initial_tab";
  const { t } = useI18n();

  useEffect(() => {
    const initial = localStorage.getItem(initialTabKey) as SettingsTab | null;
    if (initial && Object.values(SettingsTab).includes(initial)) {
      setActiveTab(initial);
      localStorage.removeItem(initialTabKey);
      if (isMobile) {
        setShowMobileMenu(false);
      }
    }
  }, [isMobile]);

  // Group filtered results by relevance for search display
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;

    const query = searchQuery.toLowerCase();
    return SETTINGS_TABS.map((tab) => {
      let score = 0;
      if (tab.label.toLowerCase().includes(query)) score += 3;
      if (tab.keywords.some((k) => k.toLowerCase().includes(query))) score += 2;
      if (tab.description.toLowerCase().includes(query)) score += 1;
      return { ...tab, score };
    })
      .filter((tab) => tab.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [searchQuery]);

  const handleTabChange = (tab: SettingsTab) => {
    if (hasChanges) {
      const confirm = window.confirm(
        "You have unsaved changes. Are you sure you want to switch tabs?"
      );
      if (!confirm) return;
    }
    setActiveTab(tab);
    setHasChanges(false);
    if (isMobile) {
      setShowMobileMenu(false);
    }
  };

  const handleSave = () => {
    setHasChanges(false);
  };

  const handleReset = () => {
    const confirm = window.confirm("Are you sure you want to reset all settings to default?");
    if (confirm) {
      setHasChanges(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  // Mobile back button handler
  const handleMobileBack = () => {
    setShowMobileMenu(true);
  };

  // Current tab config
  const currentTabConfig = SETTINGS_TABS.find((t) => t.id === activeTab);

  return (
    <div className="flex h-full bg-background">
      {/* Sidebar / Mobile Menu */}
      <div
        className={cn(
          "flex-shrink-0 border-r border-border bg-muted/30 text-foreground",
          isMobile ? (showMobileMenu ? "w-full" : "hidden") : "w-64"
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon className="w-5 h-5" />
            <h1 className="text-lg font-semibold">{t("settings.title")}</h1>
          </div>

          {/* MagnifyingGlass Bar */}
          <div
            className={cn(
              "relative transition-all",
              isSearchFocused && "ring-2 ring-primary rounded-lg"
            )}
          >
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              placeholder={t("settings.searchPlaceholder")}
              className="w-full pl-9 pr-8 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-2 space-y-1 overflow-y-auto" style={{ maxHeight: "calc(100% - 140px)" }}>
          {searchQuery ? (
            // MagnifyingGlass Results
            searchResults && searchResults.length > 0 ? (
              <>
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("settings.searchResults")}
                </div>
                {searchResults.map((tab) => {
                  return (
                    <SettingsMenuItem
                      key={tab.id}
                      icon={tab.icon}
                      label={t(tab.label)}
                      description={tab.description}
                      isActive={activeTab === tab.id}
                      isMobile={isMobile}
                      onClick={() => handleTabChange(tab.id)}
                    />
                  );
                })}
              </>
            ) : (
              <div className="px-3 py-8 text-center text-muted-foreground">
                <MagnifyingGlass className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t("settings.noSettingsFound", { query: searchQuery })}</p>
                <p className="text-xs mt-1 opacity-70">{t("settings.tryDifferentKeywords")}</p>
              </div>
            )
          ) : (
            SETTINGS_TABS.map((tab) => {
              return (
                <SettingsMenuItem
                  key={tab.id}
                  icon={tab.icon}
                  label={t(tab.label)}
                  isActive={activeTab === tab.id}
                  isMobile={isMobile}
                  onClick={() => handleTabChange(tab.id)}
                />
              );
            })
          )}
        </nav>
      </div>

      {/* Main content */}
      <div
        className={cn(
          "flex-1 flex flex-col overflow-hidden",
          isMobile && showMobileMenu ? "hidden" : "flex"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-border gap-3">
          <div className="flex items-center gap-3">
            {/* Mobile Back Button */}
            {isMobile && (
                <button
                  onClick={handleMobileBack}
                  className="p-2 -ml-2 rounded-full hover:bg-muted"
                  aria-label={t("settings.backToMenu")}
                >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-foreground flex items-center gap-2">
                {currentTabConfig && (
                  <currentTabConfig.icon className="w-5 h-5 text-muted-foreground" />
                )}
                {currentTabConfig ? t(currentTabConfig.label) : ""}
              </h2>
              {!isMobile && currentTabConfig && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {currentTabConfig.description}
                </p>
              )}
            </div>
          </div>

          {hasChanges && (
            <div className="flex items-center gap-2">
              <span className="hidden md:inline text-sm text-muted-foreground">
                {t("settings.unsavedChanges")}
              </span>
              <button
                onClick={handleSave}
                className="px-4 py-2 md:py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors min-h-[44px] text-sm font-medium"
              >
                {t("common.save")}
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {activeTab === SettingsTab.General && (
            <GeneralSettings onChange={() => setHasChanges(true)} />
          )}
          {activeTab === SettingsTab.Appearance && (
            <AppearanceSettings onChange={() => setHasChanges(true)} />
          )}
           {activeTab === SettingsTab.Learning && <LearningSettings />}
          {activeTab === SettingsTab.Documents && <DocumentsSettings />}
          {activeTab === SettingsTab.RSS && <RSSSettings />}
          {activeTab === SettingsTab.Shortcuts && (
            <ShortcutSettings onChange={() => setHasChanges(true)} />
          )}
          {activeTab === SettingsTab.AI && <AISettings onChange={() => setHasChanges(true)} />}
          {activeTab === SettingsTab.AudioTranscription && <AudioTranscriptionSettings />}
          {activeTab === SettingsTab.TTS && <TTSSettings />}
          {activeTab === SettingsTab.Sync && <SyncSettings onChange={() => setHasChanges(true)} />}
          {activeTab === SettingsTab.Integrations && <IntegrationSettings />}
          {activeTab === SettingsTab.CloudStorage && (
            <CloudStorageSettings onChange={() => setHasChanges(true)} />
          )}
          {activeTab === SettingsTab.ImportExport && (
            <ImportExportSettings onChange={() => setHasChanges(true)} />
          )}
          {activeTab === SettingsTab.Notifications && (
            <NotificationSettings onChange={() => setHasChanges(true)} />
          )}
          {activeTab === SettingsTab.Privacy && (
            <PrivacySettings onChange={() => setHasChanges(true)} />
          )}
          {activeTab === SettingsTab.Handbook && <HandbookSettings />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-t border-border bg-muted/30">
          <button
            onClick={handleReset}
            className="text-sm text-muted-foreground hover:text-destructive transition-colors"
          >
            Reset to defaults
          </button>
          <p className="text-xs text-muted-foreground">Changes are saved automatically</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Settings section wrapper
 */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

/**
 * Settings row component - Mobile optimized
 */
export function SettingsRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between py-4 border-b border-border last:border-0 gap-3 sm:gap-4">
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </div>
      <div className="sm:ml-4 flex-shrink-0">{children}</div>
    </div>
  );
}

/**
 * General Settings Component
 */
function GeneralSettings({ onChange }: { onChange: () => void }) {
  const general = useSettingsStore((state) => state.settings.general);
  const updateSettingsCategory = useSettingsStore((state) => state.updateSettingsCategory);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [dataLocation, setDataLocation] = useState<string | null>(null);
  const [isOpeningDataFolder, setIsOpeningDataFolder] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const isDesktop = isTauri();
  const toast = useToast();
  const { t } = useI18n();

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdates(true);
    try {
      const result = await checkForUpdates(true);
      if (result) {
        setUpdateInfo(result);
      } else {
        toast.success("You're on the latest version");
      }
    } catch {
      toast.error("Update check failed", "Could not reach GitHub. Please try again later.");
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  useEffect(() => {
    if (!isDesktop) return;
    let cancelled = false;

    (async () => {
      const { getVersion } = await import("@tauri-apps/api/app");
      const version = await getVersion();
      if (!cancelled) {
        setAppVersion(version);
      }
    })().catch((error) => {
      console.warn("Failed to load app version:", error);
    });

    (async () => {
      const { appDataDir } = await import("@tauri-apps/api/path");
      const path = await appDataDir();
      if (!cancelled) {
        setDataLocation(path);
      }
    })().catch((error) => {
      console.warn("Failed to load app data directory:", error);
    });

    return () => {
      cancelled = true;
    };
  }, [isDesktop]);

  const handleOpenDataFolder = async () => {
    if (!isDesktop) return;

    setIsOpeningDataFolder(true);
    try {
      const resolvedPath = dataLocation ?? (await (await import("@tauri-apps/api/path")).appDataDir());
      const { openPath } = await import("@tauri-apps/plugin-opener");
      await openPath(resolvedPath);
      setDataLocation(resolvedPath);
    } catch (error) {
      console.error("Failed to open data folder:", error);
      toast.error("Failed to open folder", error instanceof Error ? error.message : String(error));
    } finally {
      setIsOpeningDataFolder(false);
    }
  };

  return (
    <>
      <SettingsSection title={t("settings.application")} description={t("settings.applicationDesc")}>
        <SettingsRow label={t("settings.language")} description={t("settings.languageHelp")}>
          <select
            className="w-full sm:w-auto px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm min-h-[44px]"
            value={general.language}
            onChange={(e) => {
              updateSettingsCategory("general", { language: e.target.value });
              onChange();
            }}
          >
            <option value="en">English</option>
            <option value="zh">中文</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="ja">日本語</option>
          </select>
        </SettingsRow>

        <SettingsRow label={t("settings.defaultView")} description={t("settings.defaultViewDesc")}>
          <select
            className="w-full sm:w-auto px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm min-h-[44px]"
            onChange={onChange}
            defaultValue="queue"
          >
            <option value="queue">Queue</option>
            <option value="review">Review</option>
            <option value="documents">Documents</option>
            <option value="analytics">Analytics</option>
          </select>
        </SettingsRow>

        <SettingsRow
          label={t("settings.autoSaveInterval")}
          description={t("settings.autoSaveIntervalDesc")}
        >
          <select
            className="w-full sm:w-auto px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm min-h-[44px]"
            onChange={onChange}
            defaultValue="30"
          >
            <option value="5">5 seconds</option>
            <option value="15">15 seconds</option>
            <option value="30">30 seconds</option>
            <option value="60">1 minute</option>
            <option value="300">5 minutes</option>
          </select>
        </SettingsRow>

        <SettingsRow
          label={t("settings.restoreSession")}
          description={t("settings.restoreSessionDesc")}
        >
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={general.restoreSession}
              onChange={(e) => {
                updateSettingsCategory("general", { restoreSession: e.target.checked });
                onChange();
              }}
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </SettingsRow>

        {isDesktop && (
          <SettingsRow label="App Version" description="Version of the desktop application">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{appVersion ?? "Loading..."}</span>
              <button
                type="button"
                onClick={handleCheckForUpdates}
                disabled={isCheckingUpdates}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  "bg-background border border-border hover:bg-muted",
                  "disabled:opacity-60 disabled:cursor-not-allowed"
                )}
              >
                <ArrowsClockwise className={cn("w-3.5 h-3.5", isCheckingUpdates && "animate-spin")} />
                {isCheckingUpdates ? "Checking..." : "Check for Updates"}
              </button>
            </div>
          </SettingsRow>
        )}
        {updateInfo && (
          <UpdateAvailableDialog update={updateInfo} onClose={() => setUpdateInfo(null)} />
        )}
      </SettingsSection>

      <SettingsSection title={t("settings.data")} description={t("settings.dataDesc")}>
        <SettingsRow label={t("settings.dataLocation")} description={t("settings.dataLocationDesc")}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenDataFolder}
              disabled={isOpeningDataFolder}
              className="w-full sm:w-auto px-4 py-2.5 bg-background border border-border rounded-lg hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium min-h-[44px]"
            >
              {isOpeningDataFolder ? "Opening..." : t("settings.openFolder")}
            </button>
            {dataLocation && (
              <span className="hidden lg:block text-xs text-muted-foreground truncate max-w-[28rem]" title={dataLocation}>
                {dataLocation}
              </span>
            )}
          </div>
        </SettingsRow>

        <SettingsRow
          label="Backup on Exit"
          description="Create automatic backup when closing the app"
        >
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" onChange={onChange} defaultChecked />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </SettingsRow>

        <SettingsRow label="Max Backups" description="Maximum number of backups to keep">
          <input
            type="number"
            min="1"
            max="100"
            defaultValue="10"
            onChange={onChange}
            className="w-full sm:w-24 px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm min-h-[44px]"
          />
        </SettingsRow>
      </SettingsSection>
    </>
  );
}

/**
 * Maps font family name to CSS font-family value
 */
function getFontFamilyCSS(fontFamily: string): string {
  const systemFonts: Record<string, string> = {
    "system-ui": 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    serif: 'Georgia, "Times New Roman", Times, serif',
    "sans-serif": 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    monospace:
      '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  };

  if (systemFonts[fontFamily]) {
    return systemFonts[fontFamily];
  }

  // For Google Fonts, use the font name directly with fallbacks
  return `"${fontFamily}", system-ui, sans-serif`;
}

/**
 * Apply font family to document
 */
function applyFontFamily(fontFamily: string): void {
  const root = document.documentElement;
  const cssValue = getFontFamilyCSS(fontFamily);
  root.style.setProperty("--font-family", cssValue);
  root.style.setProperty("--font-family-sans", cssValue);
}

/**
 * Appearance Settings Component
 */
function AppearanceSettings({ onChange }: { onChange: () => void }) {
  const { settings, updateSettingsCategory } = useSettingsStore();
  const { toolbarPosition, splitViewSpawn } = settings.interface;

  // Apply font family when it changes
  useEffect(() => {
    applyFontFamily(settings.appearance.fontFamily);
    loadGoogleFont(settings.appearance.fontFamily);
  }, [settings.appearance.fontFamily]);

  const handleToolbarPositionChange = (value: "top" | "left" | "right") => {
    updateSettingsCategory("interface", { toolbarPosition: value });
    onChange();
  };

  const handleSplitViewSpawnChange = (updates: Partial<typeof splitViewSpawn>) => {
    updateSettingsCategory("interface", { splitViewSpawn: { ...splitViewSpawn, ...updates } });
    onChange();
  };

  return (
    <>
      <SettingsSection title="Theme" description="Customize the look and feel">
        <ThemePicker />
      </SettingsSection>

      <SettingsSection
        title="Animated Backdrop"
        description="Adjust the particle animations for animated themes"
      >
        <SettingsRow label="Particle Density" description="How many particles appear on screen">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0.25"
              max="8"
              step="0.25"
              value={settings.interface.animationFrequency}
              onChange={(e) => {
                updateSettingsCategory("interface", {
                  animationFrequency: parseFloat(e.target.value),
                });
                onChange();
              }}
              className="w-32"
            />
            <input
              type="number"
              min="0.25"
              max="8"
              step="0.25"
              value={settings.interface.animationFrequency}
              onChange={(e) => {
                const value = Math.min(8, Math.max(0.25, parseFloat(e.target.value) || 0.25));
                updateSettingsCategory("interface", { animationFrequency: value });
                onChange();
              }}
              className="w-20 px-2 py-1 rounded border bg-input text-sm"
            />
            <span className="text-sm text-muted-foreground w-12">
              {Math.round(settings.interface.animationFrequency * 100)}%
            </span>
          </div>
        </SettingsRow>

        <SettingsRow label="Brightness" description="How strongly the particles glow and accumulate">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={settings.interface.animationBrightness}
              onChange={(e) => {
                updateSettingsCategory("interface", {
                  animationBrightness: parseInt(e.target.value, 10),
                });
                onChange();
              }}
              className="w-32"
            />
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              value={settings.interface.animationBrightness}
              onChange={(e) => {
                const value = Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1));
                updateSettingsCategory("interface", { animationBrightness: value });
                onChange();
              }}
              className="w-20 px-2 py-1 rounded border bg-input text-sm"
            />
            <span className="text-sm text-muted-foreground w-12">
              {(settings.interface.animationBrightness / 10).toFixed(1)}x
            </span>
          </div>
        </SettingsRow>

        <div className="text-xs text-muted-foreground">
          Extreme values are now allowed. High density and brightness can noticeably increase GPU usage.
        </div>
      </SettingsSection>

      <SettingsSection title="Typography" description="Font settings">
        <SettingsRow label="Font Family" description="Choose your preferred font">
          <select
            className="w-full sm:w-auto px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm min-h-[44px]"
            value={settings.appearance.fontFamily}
            onChange={(e) => {
              updateSettingsCategory("appearance", { fontFamily: e.target.value });
              onChange();
            }}
          >
            <optgroup label="Sans Serif">
              <option value="Inter">Inter</option>
              <option value="Outfit">Outfit</option>
              <option value="Nunito">Nunito</option>
              <option value="Poppins">Poppins</option>
              <option value="Open Sans">Open Sans</option>
              <option value="Lato">Lato</option>
              <option value="Rubik">Rubik</option>
              <option value="Lexend">Lexend</option>
              <option value="Sora">Sora</option>
              <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
              <option value="DM Sans">DM Sans</option>
              <option value="Manrope">Manrope</option>
              <option value="Space Grotesk">Space Grotesk</option>
              <option value="Raleway">Raleway</option>
              <option value="Josefin Sans">Josefin Sans</option>
              <option value="Quicksand">Quicksand</option>
              <option value="Montserrat">Montserrat</option>
              <option value="Work Sans">Work Sans</option>
              <option value="Barlow">Barlow</option>
              <option value="Mulish">Mulish</option>
              <option value="Karla">Karla</option>
              <option value="Urbanist">Urbanist</option>
              <option value="Albert Sans">Albert Sans</option>
              <option value="Figtree">Figtree</option>
              <option value="Syne">Syne</option>
            </optgroup>
            <optgroup label="Serif">
              <option value="Merriweather">Merriweather</option>
              <option value="Playfair Display">Playfair Display</option>
              <option value="Lora">Lora</option>
              <option value="Crimson Text">Crimson Text</option>
              <option value="Bitter">Bitter</option>
            </optgroup>
            <optgroup label="Monospace">
              <option value="JetBrains Mono">JetBrains Mono</option>
              <option value="Fira Code">Fira Code</option>
              <option value="Source Code Pro">Source Code Pro</option>
              <option value="IBM Plex Mono">IBM Plex Mono</option>
              <option value="Roboto Mono">Roboto Mono</option>
              <option value="Ubuntu Mono">Ubuntu Mono</option>
              <option value="Inconsolata">Inconsolata</option>
              <option value="Space Mono">Space Mono</option>
              <option value="Courier Prime">Courier Prime</option>
              <option value="DM Mono">DM Mono</option>
              <option value="Anonymous Pro">Anonymous Pro</option>
              <option value="PT Mono">PT Mono</option>
              <option value="Overpass Mono">Overpass Mono</option>
              <option value="Noto Sans Mono">Noto Sans Mono</option>
              <option value="Victor Mono">Victor Mono</option>
              <option value="Red Hat Mono">Red Hat Mono</option>
              <option value="Martian Mono">Martian Mono</option>
              <option value="Oxygen Mono">Oxygen Mono</option>
              <option value="Share Tech Mono">Share Tech Mono</option>
              <option value="Azeret Mono">Azeret Mono</option>
              <option value="Spline Sans Mono">Spline Sans Mono</option>
              <option value="Xanh Mono">Xanh Mono</option>
              <option value="Cutive Mono">Cutive Mono</option>
              <option value="B612 Mono">B612 Mono</option>
              <option value="Nova Mono">Nova Mono</option>
              <option value="Syne Mono">Syne Mono</option>
              <option value="Nanum Gothic Coding">Nanum Gothic Coding</option>
              <option value="Cousine">Cousine</option>
              <option value="Chivo Mono">Chivo Mono</option>
              <option value="Fira Mono">Fira Mono</option>
            </optgroup>
            <optgroup label="Display / Decorative">
              <option value="Comic Neue">Comic Neue</option>
              <option value="Major Mono Display">Major Mono Display</option>
            </optgroup>
            <optgroup label="System">
              <option value="system-ui">System UI</option>
              <option value="serif">System Serif</option>
              <option value="sans-serif">System Sans</option>
              <option value="monospace">System Mono</option>
            </optgroup>
          </select>
        </SettingsRow>

        <SettingsRow label="Font Size" description="Base font size for the interface">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="12"
              max="20"
              value={settings.appearance.fontSize}
              onChange={(e) => {
                updateSettingsCategory("appearance", { fontSize: parseInt(e.target.value, 10) });
                onChange();
              }}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground w-12">
              {settings.appearance.fontSize}px
            </span>
          </div>
        </SettingsRow>

        <SettingsRow label="Line Height" description="Line height for text content">
          <select
            className="w-full sm:w-auto px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm min-h-[44px]"
            onChange={onChange}
            defaultValue="1.5"
          >
            <option value="1.25">Compact</option>
            <option value="1.5">Normal</option>
            <option value="1.75">Relaxed</option>
            <option value="2">Loose</option>
          </select>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Display" description="Display preferences">
        <SettingsRow
          label="Toolbar Position"
          description="Position of the main toolbar (desktop only)"
        >
          <select
            className="w-full sm:w-auto px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm min-h-[44px]"
            value={toolbarPosition}
            onChange={(e) =>
              handleToolbarPositionChange(e.target.value as "top" | "left" | "right")
            }
          >
            <option value="top">Top</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </SettingsRow>

        <SettingsRow
          label="Split View Spawn Gesture"
          description="Mouse gesture to duplicate the active tab into a vertical split"
        >
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <select
              className="w-full sm:w-auto px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm min-h-[44px]"
              value={splitViewSpawn.button}
              onChange={(e) =>
                handleSplitViewSpawnChange({ button: Number(e.target.value) as 0 | 1 | 2 })
              }
            >
              <option value={1}>Middle Click (Wheel)</option>
              <option value={2}>Right Click</option>
              <option value={0}>Left Click</option>
            </select>

            <select
              className="w-full sm:w-auto px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm min-h-[44px]"
              value={splitViewSpawn.modifier}
              onChange={(e) =>
                handleSplitViewSpawnChange({
                  modifier: e.target.value as "none" | "ctrl" | "alt" | "shift" | "meta",
                })
              }
            >
              <option value="none">No Modifier</option>
              <option value="ctrl">Ctrl</option>
              <option value="alt">Alt</option>
              <option value="shift">Shift</option>
              <option value="meta">Meta</option>
            </select>
          </div>
        </SettingsRow>

        <SettingsRow label="Compact Mode" description="Reduce spacing and padding for more content">
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" onChange={onChange} />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </SettingsRow>

        <SettingsRow label="Sidebar Width" description="Width of the navigation sidebar">
          <select
            className="w-full sm:w-auto px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm min-h-[44px]"
            onChange={onChange}
            defaultValue="medium"
          >
            <option value="narrow">Narrow</option>
            <option value="medium">Medium</option>
            <option value="wide">Wide</option>
          </select>
        </SettingsRow>
      </SettingsSection>
    </>
  );
}

// Wrapper components for settings
function ShortcutSettings({ onChange }: { onChange: () => void }) {
  return <KeyboardShortcutSettings onChange={onChange} />;
}

function AISettings({ onChange }: { onChange: () => void }) {
  return <AIProviderSettings onChange={onChange} />;
}

function SyncSettings({ onChange: _onChange }: { onChange: () => void }) {
  return <SyncSettingsOriginal />;
}

function ImportExportSettings({ onChange }: { onChange: () => void }) {
  return <ImportExportSettingsComponent onChange={onChange} />;
}

function PrivacySettings({ onChange: _onChange }: { onChange: () => void }) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
      <p>Privacy settings coming soon</p>
    </div>
  );
}
