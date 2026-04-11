import { useState } from "react";
import { APP_VERSION } from "../utils/constants";
import { useSettingsStore } from "../stores/settingsStore";
import { useCollectionStore } from "../stores/collectionStore";
import { UserProfilePanel } from "../components/settings/UserProfilePanel";
import { AISettings } from "../components/settings/AISettings";
import { SyncSettings } from "../components/settings/SyncSettings";
import { IntegrationSettings } from "../components/settings/IntegrationSettings";
import { AudioTranscriptionSettings } from "../components/settings/AudioTranscriptionSettings";
import { SmartQueuesSettings } from "../components/settings/SmartQueuesSettings";
import { TTSSettings } from "../components/settings/TTSSettings";
import { useI18n } from "../lib/i18n";

type SettingsTab = "profile" | "general" | "ai" | "sync" | "integrations" | "audio-transcription" | "tts" | "smart-queues" | "about";

const LOCALE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
  { value: "es", label: "Español" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "ja", label: "日本語" },
] as const;

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const { t } = useI18n();

  const tabs = [
    { id: "profile" as const, label: t("settings.profile"), icon: "👤" },
    { id: "general" as const, label: t("settings.general"), icon: "⚙️" },
    { id: "ai" as const, label: t("settings.ai"), icon: "🤖" },
    { id: "sync" as const, label: t("settings.sync"), icon: "☁️" },
    { id: "integrations" as const, label: t("settings.integrations"), icon: "🔗" },
    { id: "audio-transcription" as const, label: t("settings.audioTranscription"), icon: "🎤" },
    { id: "tts" as const, label: t("settings.tts"), icon: "🗣️" },
    { id: "smart-queues" as const, label: t("settings.smartQueues"), icon: "🧠" },
    { id: "about" as const, label: t("settings.about"), icon: "ℹ️" },
  ];

  return (
    <div className="h-full flex bg-cream">
      {/* Settings Sidebar */}
      <div className="w-56 border-r border-border bg-card">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{t("settings.title")}</h2>
        </div>
        <div className="p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full px-3 py-2 rounded text-left flex items-center gap-2 mb-1 transition-colors ${
                activeTab === tab.id
                  ? "bg-primary-100 text-primary-700"
                  : "hover:bg-muted"
              }`}
            >
              <span>{tab.icon}</span>
              <span className="text-sm">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "profile" && (
          <div className="p-6 max-w-2xl">
            <h3 className="text-lg font-semibold text-foreground mb-4">{t("settings.userProfile")}</h3>
            <UserProfilePanel />
          </div>
        )}
        {activeTab === "general" && <GeneralSettings />}
        {activeTab === "ai" && <AISettings />}
        {activeTab === "sync" && <SyncSettings />}
        {activeTab === "integrations" && <IntegrationSettings />}
        {activeTab === "audio-transcription" && <AudioTranscriptionTab />}
        {activeTab === "tts" && <TTSTab />}
        {activeTab === "smart-queues" && <SmartQueuesTab />}
        {activeTab === "about" && <AboutSettings />}
      </div>
    </div>
  );
}

function GeneralSettings() {
  const { settings, updateSettings } = useSettingsStore();
  const { t } = useI18n();
  const collections = useCollectionStore((state) => state.collections);
  const activeCollectionId = useCollectionStore((state) => state.activeCollectionId);
  const setActiveCollectionId = useCollectionStore((state) => state.setActiveCollectionId);
  const createCollection = useCollectionStore((state) => state.createCollection);
  const renameCollection = useCollectionStore((state) => state.renameCollection);
  const removeCollection = useCollectionStore((state) => state.removeCollection);
  const [newCollectionName, setNewCollectionName] = useState("");

  return (
    <div className="p-6 max-w-2xl">
      <h3 className="text-lg font-semibold text-foreground mb-4">{t("settings.generalSettings")}</h3>

      <div className="space-y-6">
        {/* Collections */}
        <div className="bg-card border border-border rounded p-4">
          <h4 className="text-sm font-medium text-foreground mb-3">{t("settings.collections")}</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-foreground">{t("settings.activeCollection")}</div>
                <div className="text-xs text-foreground-secondary">
                  {t("settings.scopeQueue")}
                </div>
              </div>
              <select
                value={activeCollectionId ?? ""}
                onChange={(e) => setActiveCollectionId(e.target.value || null)}
                className="px-3 py-1.5 bg-background border border-border rounded text-sm min-w-[200px]"
              >
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder={t("settings.newCollectionName")}
                className="flex-1 px-3 py-1.5 bg-background border border-border rounded text-sm"
              />
              <button
                onClick={() => {
                  if (!newCollectionName.trim()) return;
                  createCollection(newCollectionName);
                  setNewCollectionName("");
                }}
                className="px-3 py-1.5 bg-primary-100 text-primary-700 rounded text-sm hover:opacity-90 transition-opacity"
              >
                {t("common.create")}
              </button>
            </div>

            {activeCollectionId && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const nextName = window.prompt(`${t("common.rename")}:`, "");
                    if (nextName) {
                      renameCollection(activeCollectionId, nextName);
                    }
                  }}
                  className="px-3 py-1.5 bg-muted text-foreground rounded text-sm hover:bg-muted/80 transition-colors"
                >
                  {t("settings.renamedActive")}
                </button>
                {collections.length > 1 && (
                  <button
                    onClick={() => removeCollection(activeCollectionId)}
                    className="px-3 py-1.5 bg-destructive/10 text-destructive rounded text-sm hover:bg-destructive/20 transition-colors"
                  >
                    {t("settings.deleteActive")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Appearance */}
        <div className="bg-card border border-border rounded p-4">
          <h4 className="text-sm font-medium text-foreground mb-3">{t("settings.appearance")}</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-foreground">{t("settings.language")}</div>
                <div className="text-xs text-foreground-secondary">
                  {t("settings.languageHelp")}
                </div>
              </div>
              <select
                value={settings.general.language}
                onChange={(e) =>
                  updateSettings({ general: { ...settings.general, language: e.target.value } })
                }
                className="px-3 py-1.5 bg-background border border-border rounded text-sm min-w-[140px]"
              >
                {LOCALE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-foreground">{t("settings.theme")}</div>
                <div className="text-xs text-foreground-secondary">
                  {t("settings.themeDesc")}
                </div>
              </div>
              <select
                value={settings.theme}
                onChange={(e) => updateSettings({ theme: e.target.value as any })}
                className="px-3 py-1.5 bg-background border border-border rounded text-sm"
              >
                <option value="light">{t("settingsLegacy.light")}</option>
                <option value="dark">{t("settingsLegacy.dark")}</option>
                <option value="system">{t("settingsLegacy.system")}</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-foreground">{t("settings.fontSize")}</div>
                <div className="text-xs text-foreground-secondary">
                  {t("settings.fontSizeDesc")}
                </div>
              </div>
              <input
                type="number"
                min="10"
                max="20"
                value={settings.fontSize}
                onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
                className="w-16 px-2 py-1 bg-background border border-border rounded text-sm text-center"
              />
            </div>
          </div>
        </div>

        {/* Review Settings */}
        <div className="bg-card border border-border rounded p-4">
          <h4 className="text-sm font-medium text-foreground mb-3">{t("settings.reviewSettings")}</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-foreground">{t("settings.algorithm")}</div>
                <div className="text-xs text-foreground-secondary">
                  {t("settings.algorithmDesc")}
                </div>
              </div>
              <select
                value={settings.learning.algorithm}
                onChange={(e) => updateSettings({ learning: { ...settings.learning, algorithm: e.target.value as any } })}
                className="px-3 py-1.5 bg-background border border-border rounded text-sm"
              >
                <option value="fsrs">{t("settings.fsrs6Recommended")}</option>
                <option value="sm18">{t("settingsLegacy.supermemo18")}</option>
                <option value="sm20">SuperMemo 20</option>
                <option value="sm15">{t("settingsLegacy.supermemo15")}</option>
                <option value="sm8">{t("settingsLegacy.supermemo8")}</option>
                <option value="sm5">{t("settingsLegacy.supermemo5")}</option>
                <option value="sm2">{t("settingsLegacy.supermemo2")}</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-foreground">{t("settings.newCardsPerDay")}</div>
                <div className="text-xs text-foreground-secondary">
                  {t("settings.newCardsPerDayDesc")}
                </div>
              </div>
              <input
                type="number"
                min="0"
                max="100"
                value={settings.newCardsPerDay}
                onChange={(e) =>
                  updateSettings({ newCardsPerDay: Number(e.target.value) })
                }
                className="w-16 px-2 py-1 bg-background border border-border rounded text-sm text-center"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-foreground">{t("settings.reviewsPerDay")}</div>
                <div className="text-xs text-foreground-secondary">
                  {t("settings.reviewsPerDayDesc")}
                </div>
              </div>
              <input
                type="number"
                min="0"
                max="500"
                value={settings.reviewsPerDay}
                onChange={(e) =>
                  updateSettings({ reviewsPerDay: Number(e.target.value) })
                }
                className="w-16 px-2 py-1 bg-background border border-border rounded text-sm text-center"
              />
            </div>
          </div>
        </div>

        {/* Import Settings */}
        <div className="bg-card border border-border rounded p-4">
          <h4 className="text-sm font-medium text-foreground mb-3">{t("settings.importSettings")}</h4>
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <div>
                <div className="text-sm text-foreground">{t("settings.autoImport")}</div>
                <div className="text-xs text-foreground-secondary">
                  {t("settings.autoImportDesc")}
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.autoImport}
                onChange={(e) => updateSettings({ autoImport: e.target.checked })}
                className="rounded"
              />
            </label>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-foreground">{t("settings.defaultCategory")}</div>
                <div className="text-xs text-foreground-secondary">
                  {t("settings.defaultCategoryDesc")}
                </div>
              </div>
              <input
                type="text"
                value={settings.defaultCategory}
                onChange={(e) =>
                  updateSettings({ defaultCategory: e.target.value })
                }
                className="w-40 px-2 py-1 bg-background border border-border rounded text-sm"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AboutSettings() {
  const { t } = useI18n();

  return (
    <div className="p-6 max-w-2xl">
      <h3 className="text-lg font-semibold text-foreground mb-4">{t("settings.aboutIncrementum")}</h3>

      <div className="bg-card border border-border rounded p-6 text-center">
        <div className="text-5xl mb-4">📚</div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Incrementum</h2>
        <p className="text-sm text-foreground-secondary mb-4">
          {t("settings.version")} {APP_VERSION}
        </p>
        <p className="text-sm text-foreground mb-6 max-w-md">
          {t("settings.aboutDesc")}
        </p>
        <div className="flex justify-center gap-4 text-sm">
          <a
            href="https://github.com/incrementum"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:underline"
          >
            {t("settings.github")}
          </a>
          <a
            href="https://docs.incrementum.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:underline"
          >
            {t("settings.documentation")}
          </a>
          <a
            href="https://discord.gg/incrementum"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:underline"
          >
            {t("settings.discord")}
          </a>
        </div>
      </div>
    </div>
  );
}

function AudioTranscriptionTab() {
  return <AudioTranscriptionSettings />;
}

function TTSTab() {
  return (
    <div className="p-6 max-w-4xl">
      <TTSSettings />
    </div>
  );
}

function SmartQueuesTab() {
  const { settings, updateSettings } = useSettingsStore();

  const handleUpdateSettings = (updates: Partial<typeof settings.smartQueue>) => {
    updateSettings({ smartQueue: { ...settings.smartQueue, ...updates } });
  };

  return (
    <SmartQueuesSettings
      settings={settings.smartQueue}
      onUpdateSettings={handleUpdateSettings}
    />
  );
}
