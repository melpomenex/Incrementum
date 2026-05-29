import { useState, useEffect } from "react";
import {
  BookOpen,
  Brain,
  Globe,
  FolderOpen,
  Check,
  X,
  RefreshCw,
  Download,
  Upload,
  Server,
  Plug,
  ListVideo,
  Cookie,
  Trash2,
  AlertCircle,
  Info,
  Sparkles,
} from "lucide-react";
import { YouTubePlaylistManager } from "../media/YouTubePlaylistManager";
import { NotebookLMWorkspace } from "./NotebookLMWorkspace";
import {
  getIntegrationSettings,
  updateObsidianConfig,
  updateAnkiConfig,
  testAnkiConnection,
  getAnkiDecks,
  getAnkiModels,
  syncFlashcardsToAnki,
  syncToObsidian,
  syncFromObsidian,
  startBrowserSyncServer,
  stopBrowserSyncServer,
  getBrowserSyncServerStatus,
  getBrowserSyncConfig,
  setBrowserSyncConfig,
  type ObsidianConfig,
  type AnkiConfig,
} from "../../api/integrations";
import { openFolderPicker } from "../../lib/tauri";
import {
  getStoredYouTubeCookies,
  storeYouTubeCookies,
  clearYouTubeCookies,
  parseCookiesFromString,
  testYouTubeCookies,
  validateYouTubeCookies,
  type YouTubeCookie,
} from "../../utils/youtubeCookies";
import { useI18n } from "../../lib/i18n";

type IntegrationType =
  | "obsidian"
  | "anki"
  | "extension"
  | "youtube"
  | "youtube-cookies"
  | "notebooklm";

export function IntegrationSettings() {
  const { t } = useI18n();
  const [settings, setSettings] = useState(getIntegrationSettings());
  const [activeTab, setActiveTab] = useState<IntegrationType>("obsidian");

  // Obsidian state
  const [obsidianVault, setObsidianVault] = useState("");
  const [obsidianNotes, setObsidianNotes] = useState("Incrementum");
  const [obsidianAttachments, setObsidianAttachments] = useState("Incrementum Assets");
  const [obsidianDataview, setObsidianDataview] = useState("");

  // Anki state
  const [ankiUrl, setAnkiUrl] = useState("http://localhost:8765");
  const [ankiDeck, setAnkiDeck] = useState("Incrementum");
  const [ankiModel, setAnkiModel] = useState("Basic");
  const [ankiConnected, setAnkiConnected] = useState(false);
  const [ankiDecks, setAnkiDecks] = useState<string[]>([]);
  const [ankiModels, setAnkiModels] = useState<string[]>([]);

  // Extension state
  const [extensionPort, setExtensionPort] = useState(8766);
  const [extensionAutoStart, setExtensionAutoStart] = useState(false);
  const [extensionStatus, setExtensionStatus] = useState<{
    running: boolean;
    port: number;
    connections: number;
  }>({ running: false, port: 8766, connections: 0 });

  // YouTube Cookies state
  const [youtubeCookies, setYoutubeCookies] = useState<YouTubeCookie[]>([]);
  const [cookieInput, setCookieInput] = useState("");
  const [cookieTestStatus, setCookieTestStatus] = useState<{
    status: "idle" | "testing" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });
  const [showCookieInput, setShowCookieInput] = useState(false);

  // Operation status
  const [isOperating, setIsOperating] = useState(false);
  const [operationResult, setOperationResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    const loaded = getIntegrationSettings();
    setSettings(loaded);

    if (loaded.obsidian) {
      setObsidianVault(loaded.obsidian.vaultPath);
      setObsidianNotes(loaded.obsidian.notesFolder);
      setObsidianAttachments(loaded.obsidian.attachmentsFolder);
      setObsidianDataview(loaded.obsidian.dataviewFolder || "");
    }

    if (loaded.anki) {
      setAnkiUrl(loaded.anki.url);
      setAnkiDeck(loaded.anki.deckName);
      setAnkiModel(loaded.anki.modelName);
    }

    setExtensionPort(loaded.extensionPort);
  }, []);

  useEffect(() => {
    const loadBrowserSyncConfig = async () => {
      try {
        const config = await getBrowserSyncConfig();
        setExtensionPort(config.port);
        setExtensionAutoStart(config.autoStart);
      } catch {
        // Ignore errors
      }
    };
    loadBrowserSyncConfig();
  }, []);

  useEffect(() => {
    loadExtensionStatus();
    const interval = setInterval(loadExtensionStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setYoutubeCookies(getStoredYouTubeCookies());
  }, []);

  const loadExtensionStatus = async () => {
    try {
      const status = await getBrowserSyncServerStatus(extensionPort);
      setExtensionStatus(status);
    } catch {
      // Ignore errors
    }
  };

  const handleSaveObsidian = () => {
    const config: ObsidianConfig = {
      vaultPath: obsidianVault,
      notesFolder: obsidianNotes,
      attachmentsFolder: obsidianAttachments,
      dataviewFolder: obsidianDataview || undefined,
    };
    updateObsidianConfig(config);
    showResult(true, t("integrations.obsidianConfigurationSaved"));
  };

  // Test Anki connection
  const handleTestAnki = async () => {
    setIsOperating(true);
    try {
      const connected = await testAnkiConnection(ankiUrl);
      setAnkiConnected(connected);

      if (connected) {
        const [decks, models] = await Promise.all([
          getAnkiDecks(ankiUrl),
          getAnkiModels(ankiUrl),
        ]);
        setAnkiDecks(decks);
        setAnkiModels(models);
        showResult(true, t("integrations.connectedToAnki"));
      } else {
        showResult(false, t("integrations.failedConnectToAnki"));
      }
    } catch {
      setAnkiConnected(false);
      showResult(false, t("integrations.failedTestAnkiConnection"));
    } finally {
      setIsOperating(false);
    }
  };

  const handleSaveAnki = () => {
    const config: AnkiConfig = {
      url: ankiUrl,
      deckName: ankiDeck,
      modelName: ankiModel,
    };
    updateAnkiConfig(config);
    showResult(true, t("integrations.ankiConfigurationSaved"));
  };

  // Toggle extension server
  const handleToggleExtension = async () => {
    setIsOperating(true);
    try {
      if (extensionStatus.running) {
        await stopBrowserSyncServer();
        showResult(true, t("integrations.extensionServerStopped"));
      } else {
        await startBrowserSyncServer(extensionPort);
        showResult(true, t("integrations.extensionServerStarted"));
      }
      loadExtensionStatus();
    } catch {
      showResult(false, t("integrations.failedToggleExtensionServer"));
    } finally {
      setIsOperating(false);
    }
  };

  const handleExtensionConfigChange = async (port?: number, autoStart?: boolean) => {
    try {
      await setBrowserSyncConfig({
        host: "127.0.0.1",
        port: port ?? extensionPort,
        autoStart: autoStart ?? extensionAutoStart,
      });
      if (autoStart !== undefined) {
        setExtensionAutoStart(autoStart);
      }
    } catch {
      // Ignore errors
    }
  };

  // YouTube Cookies handlers
  const handleSaveCookies = () => {
    if (!cookieInput.trim()) {
      showResult(false, t("integrations.pleaseEnterCookies"));
      return;
    }

    try {
      const parsed = parseCookiesFromString(cookieInput);
      if (parsed.length === 0) {
        showResult(false, t("integrations.noValidCookiesFound"));
        return;
      }

      const validation = validateYouTubeCookies(parsed);
      storeYouTubeCookies(parsed);
      setYoutubeCookies(parsed);
      setCookieInput("");
      setShowCookieInput(false);

      if (validation.valid) {
        showResult(
          true,
          `Saved ${parsed.length} cookies. ${validation.hasAuth ? "Authentication cookies detected!" : ""}`
        );
      } else {
        showResult(
          true,
          `Saved ${parsed.length} cookies. Warning: Missing recommended cookies: ${validation.missing.join(", ")}`
        );
      }
    } catch (error) {
      showResult(false, error instanceof Error ? error.message : t("integrations.failedParseCookies"));
    }
  };

  const handleTestCookies = async () => {
    if (youtubeCookies.length === 0) {
      showResult(false, t("integrations.noCookiesToTest"));
      return;
    }

    setCookieTestStatus({ status: "testing", message: t("integrations.testingCookies") });

    const result = await testYouTubeCookies(youtubeCookies);

    if (result.success) {
      setCookieTestStatus({ status: "success", message: result.message });
      showResult(true, result.message);
    } else {
      setCookieTestStatus({ status: "error", message: result.message });
      showResult(false, result.message);
    }

    setTimeout(() => {
      setCookieTestStatus({ status: "idle", message: "" });
    }, 5000);
  };

  const handleClearCookies = () => {
    clearYouTubeCookies();
    setYoutubeCookies([]);
    setCookieTestStatus({ status: "idle", message: "" });
    showResult(true, t("integrations.cookiesCleared"));
  };

  const showResult = (success: boolean, message: string) => {
    setOperationResult({ success, message });
    setTimeout(() => setOperationResult(null), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Plug className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-bold text-foreground">{t("integrations.title")}</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("obsidian")}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            activeTab === "obsidian"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:opacity-90"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          {t("integrations.obsidian")}
        </button>
        <button
          onClick={() => setActiveTab("anki")}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            activeTab === "anki"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:opacity-90"
          }`}
        >
          <Brain className="w-4 h-4" />
          {t("integrations.anki")}
        </button>
        <button
          onClick={() => setActiveTab("extension")}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            activeTab === "extension"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:opacity-90"
          }`}
        >
          <Globe className="w-4 h-4" />
          {t("integrations.browserExtension")}
        </button>
        <button
          onClick={() => setActiveTab("notebooklm")}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            activeTab === "notebooklm"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:opacity-90"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          {t("integrations.notebooklm")}
        </button>
        <button
          onClick={() => setActiveTab("youtube")}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            activeTab === "youtube"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:opacity-90"
          }`}
        >
          <ListVideo className="w-4 h-4" />
          {t("integrations.youtubePlaylists")}
        </button>
        <button
          onClick={() => setActiveTab("youtube-cookies")}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            activeTab === "youtube-cookies"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:opacity-90"
          }`}
        >
          <Cookie className="w-4 h-4" />
          {t("integrations.youtubeCookies")}
        </button>
      </div>

      {/* Result notification */}
      {operationResult && (
        <div
          className={`p-4 rounded-lg flex items-center gap-2 ${
            operationResult.success
              ? "bg-green-500/10 text-green-500 border border-green-500/20"
              : "bg-destructive/10 text-destructive border border-destructive/20"
          }`}
        >
          {operationResult.success ? (
            <Check className="w-4 h-4" />
          ) : (
            <X className="w-4 h-4" />
          )}
          <span>{operationResult.message}</span>
        </div>
      )}

      {/* Obsidian Settings */}
      {activeTab === "obsidian" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <BookOpen className="w-5 h-5 text-purple-500" />
              <h3 className="text-lg font-semibold text-foreground">{t("integrations.obsidianIntegration")}</h3>
            </div>

            <div className="space-y-4">
              {/* Vault path */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t("integrations.vaultPath")}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={obsidianVault}
                    onChange={(e) => setObsidianVault(e.target.value)}
                    placeholder="/home/user/Documents/ObsidianVault"
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    onClick={async () => {
                      try {
                        const folder = await openFolderPicker({
                          title: t("integrations.selectObsidianVaultFolder"),
                        });
                        if (folder) {
                          setObsidianVault(folder);
                        }
                      } catch (error) {
                        console.error("Failed to open folder picker:", error);
                        showResult(false, t("integrations.failedOpenFolderPicker"));
                      }
                    }}
                    className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 flex items-center gap-2"
                  >
                    <FolderOpen className="w-4 h-4" />
                    {t("integrations.browse")}
                  </button>
                </div>
              </div>

              {/* Notes folder */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t("integrations.notesFolder")}
                </label>
                <input
                  type="text"
                  value={obsidianNotes}
                  onChange={(e) => setObsidianNotes(e.target.value)}
                  placeholder="Incrementum"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Attachments folder */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t("integrations.attachmentsFolder")}
                </label>
                <input
                  type="text"
                  value={obsidianAttachments}
                  onChange={(e) => setObsidianAttachments(e.target.value)}
                  placeholder="Incrementum Assets"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Dataview folder */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t("integrations.dataviewFolderOptional")}
                </label>
                <input
                  type="text"
                  value={obsidianDataview}
                  onChange={(e) => setObsidianDataview(e.target.value)}
                  placeholder="Dataview"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Save button */}
              <button
                onClick={handleSaveObsidian}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
              >
                {t("integrations.saveObsidianConfiguration")}
              </button>
            </div>
          </div>

          {/* AI Conversation Export Info */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h4 className="font-semibold text-foreground mb-2">{t("integrations.aiConversationExport")}</h4>
            <p className="text-sm text-muted-foreground mb-4">
              {t("integrations.aiConversationExportDesc")}
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="w-4 h-4 text-blue-500" />
              <span>{t("integrations.conversationsExportedAsMarkdown")}</span>
            </div>
          </div>

          {/* Sync actions */}
          {settings.obsidian && (
            <div className="bg-card border border-border rounded-lg p-6">
              <h4 className="font-semibold text-foreground mb-4">{t("integrations.syncActions")}</h4>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setIsOperating(true);
                    try {
                      await syncToObsidian(settings.obsidian);
                      showResult(true, t("integrations.syncedToObsidian"));
                    } catch {
                      showResult(false, t("integrations.failedSyncToObsidian"));
                    } finally {
                      setIsOperating(false);
                    }
                  }}
                  disabled={isOperating}
                  className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {t("integrations.syncAllToObsidian")}
                </button>
                <button
                  onClick={async () => {
                    setIsOperating(true);
                    try {
                      await syncFromObsidian(settings.obsidian);
                      showResult(true, t("integrations.syncedFromObsidian"));
                    } catch {
                      showResult(false, t("integrations.failedSyncFromObsidian"));
                    } finally {
                      setIsOperating(false);
                    }
                  }}
                  disabled={isOperating}
                  className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {t("integrations.syncFromObsidian")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Anki Settings */}
      {activeTab === "anki" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Brain className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-semibold text-foreground">{t("integrations.ankiIntegration")}</h3>
              {ankiConnected && (
                <span className="ml-auto px-2 py-1 bg-green-500/20 text-green-500 text-xs rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  {t("common.connected")}
                </span>
              )}
            </div>

            <div className="space-y-4">
              {/* Anki URL */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t("integrations.ankiConnectUrl")}
                </label>
                <input
                  type="text"
                  value={ankiUrl}
                  onChange={(e) => setAnkiUrl(e.target.value)}
                  placeholder="http://localhost:8765"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Test connection */}
              <button
                onClick={handleTestAnki}
                disabled={isOperating}
                className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isOperating ? "animate-spin" : ""}`} />
                {t("integrations.testConnection")}
              </button>

              {/* Deck selection */}
              {ankiConnected && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {t("integrations.targetDeck")}
                    </label>
                    <select
                      value={ankiDeck}
                      onChange={(e) => setAnkiDeck(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {ankiDecks.map((deck) => (
                        <option key={deck} value={deck}>
                          {deck}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Model selection */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {t("integrations.cardModel")}
                    </label>
                    <select
                      value={ankiModel}
                      onChange={(e) => setAnkiModel(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {ankiModels.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Save button */}
                  <button
                    onClick={handleSaveAnki}
                    className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                  >
                    {t("integrations.saveAnkiConfiguration")}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Sync actions */}
          {settings.anki && ankiConnected && (
            <div className="bg-card border border-border rounded-lg p-6">
              <h4 className="font-semibold text-foreground mb-4">{t("integrations.syncActions")}</h4>
              <p className="text-sm text-muted-foreground mb-4">
                {t("integrations.syncFlashcardsFromIncrementumToAnki")}
              </p>
              <button
                onClick={async () => {
                  setIsOperating(true);
                  try {
                    const result = await syncFlashcardsToAnki([], settings.anki);
                    showResult(
                      true,
                      `Synced ${result.added} cards to Anki${result.failed > 0 ? ` (${result.failed} failed)` : ""}`
                    );
                  } catch {
                    showResult(false, t("integrations.failedSyncToAnki"));
                  } finally {
                    setIsOperating(false);
                  }
                }}
                disabled={isOperating}
                className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {t("integrations.syncFlashcardsToAnki")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Browser Extension Settings */}
      {activeTab === "extension" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Globe className="w-5 h-5 text-green-500" />
              <h3 className="text-lg font-semibold text-foreground">{t("integrations.browserExtensionServer")}</h3>
              {extensionStatus.running && (
                <span className="ml-auto px-2 py-1 bg-green-500/20 text-green-500 text-xs rounded-full flex items-center gap-1">
                  <Server className="w-3 h-3" />
                  {t("integrations.running")}
                </span>
              )}
            </div>

            <div className="space-y-4">
              {/* Port */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t("integrations.httpServerPort")}
                </label>
                <input
                  type="number"
                  value={extensionPort}
                  onChange={(e) => setExtensionPort(parseInt(e.target.value) || 8766)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("integrations.defaultPortHint")}
                </p>
              </div>

              {/* Auto-start toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    {t("integrations.autoStartOnAppLaunch")}
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("integrations.autoStartDesc")}
                  </p>
                </div>
                <button
                  onClick={() => handleExtensionConfigChange(undefined, !extensionAutoStart)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    extensionAutoStart ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      extensionAutoStart ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Status info */}
              {extensionStatus.running && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("integrations.status")}</span>
                    <span className="text-green-500">{t("integrations.running")}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("integrations.port")}</span>
                    <span className="text-foreground">{extensionStatus.port}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("integrations.connections")}</span>
                    <span className="text-foreground">{extensionStatus.connections}</span>
                  </div>
                </div>
              )}

              {/* Toggle button */}
              <button
                onClick={handleToggleExtension}
                disabled={isOperating}
                className={`w-full px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 ${
                  extensionStatus.running
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                <Server className="w-4 h-4" />
                {extensionStatus.running ? t("integrations.stopServer") : t("integrations.startServer")}
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <p className="text-sm text-muted-foreground">
              {t("integrations.browserExtensionInfo", { port: extensionPort })}
            </p>
          </div>
        </div>
      )}

      {/* YouTube Playlist Settings */}
      {activeTab === "youtube" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-6">
            <YouTubePlaylistManager />
          </div>
        </div>
      )}

      {/* NotebookLM Settings */}
      {activeTab === "notebooklm" && <NotebookLMWorkspace />}

      {/* YouTube Cookies Settings */}
      {activeTab === "youtube-cookies" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Cookie className="w-5 h-5 text-red-500" />
              <h3 className="text-lg font-semibold text-foreground">{t("integrations.youtubeAuthCookies")}</h3>
              {youtubeCookies.length > 0 && (
                <span className="ml-auto px-2 py-1 bg-green-500/20 text-green-500 text-xs rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  {t("integrations.cookiesCount", { count: youtubeCookies.length })}
                </span>
              )}
            </div>

            <div className="space-y-4">
              {/* Info banner */}
              <div className="p-4 bg-muted/30 rounded-lg flex gap-3">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">{t("integrations.whyUploadCookies")}</p>
                  <p>
                    {t("integrations.whyUploadCookiesDesc")}
                  </p>
                </div>
              </div>

              {/* Cookie status */}
              {youtubeCookies.length > 0 ? (
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">{t("integrations.cookiesStored")}</span>
                    <span className="text-sm text-green-500">{t("integrations.cookiesCount", { count: youtubeCookies.length })}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleTestCookies}
                      disabled={cookieTestStatus.status === "testing"}
                      className="flex-1 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                    >
                      <RefreshCw className={`w-4 h-4 ${cookieTestStatus.status === "testing" ? "animate-spin" : ""}`} />
                      {cookieTestStatus.status === "testing" ? t("integrations.testingCookies") : t("integrations.testCookies")}
                    </button>
                    <button
                      onClick={handleClearCookies}
                      className="px-3 py-2 bg-destructive/20 text-destructive rounded-lg hover:opacity-90 flex items-center justify-center gap-2 text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t("common.clear")}
                    </button>
                  </div>
                  {cookieTestStatus.status !== "idle" && (
                    <div className={`mt-2 text-sm flex items-center gap-2 ${
                      cookieTestStatus.status === "success" ? "text-green-500" :
                      cookieTestStatus.status === "error" ? "text-destructive" :
                      "text-muted-foreground"
                    }`}>
                      {cookieTestStatus.status === "success" && <Check className="w-4 h-4" />}
                      {cookieTestStatus.status === "error" && <X className="w-4 h-4" />}
                      {cookieTestStatus.message}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{t("integrations.noCookiesStored")}</span>
                  </div>
                </div>
              )}

              {/* Cookie input area */}
              {!showCookieInput ? (
                <button
                  onClick={() => setShowCookieInput(true)}
                  className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {t("integrations.uploadCookies")}
                </button>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {t("integrations.pasteYoutubeCookies")}
                    </label>
                    <textarea
                      value={cookieInput}
                      onChange={(e) => setCookieInput(e.target.value)}
                      placeholder='[{"name": "VISITOR_INFO1_LIVE", "value": "...", "domain": ".youtube.com"}, ...]'
                      rows={6}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveCookies}
                      className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                    >
                      {t("integrations.saveCookies")}
                    </button>
                    <button
                      onClick={() => {
                        setShowCookieInput(false);
                        setCookieInput("");
                      }}
                      className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90"
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <p className="text-sm font-medium text-foreground mb-2">{t("integrations.howToGetCookies")}</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>{t("integrations.cookieInstruction1")}</li>
                  <li>{t("integrations.cookieInstruction2")}</li>
                  <li>{t("integrations.cookieInstruction3")}</li>
                  <li>{t("integrations.cookieInstruction4")}</li>
                </ol>
                <p className="text-xs text-muted-foreground mt-3">
                  {t("integrations.cookieImportantNote")}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
