import { useEffect, useState } from "react";
import {
  Brain,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import { useTabsStore } from "../../stores";
import { NotebookLMTab } from "../tabs/TabRegistry";
import {
  notebooklmConnect,
  notebooklmDisconnect,
  notebooklmHealth,
  notebooklmSetSettings,
  type NotebookLMHealth,
} from "../../api/integrations";
import { useSettingsStore } from "../../stores/settingsStore";
import { useI18n } from "../../lib/i18n";

export function NotebookLMWorkspace() {
  const addTab = useTabsStore((state) => state.addTab);
  const { t } = useI18n();
  const { settings: _settings, updateSettingsCategory } = useSettingsStore();
  const [health, setHealth] = useState<NotebookLMHealth | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [provider, setProvider] = useState<"mock" | "cli">("cli");

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    setIsChecking(true);
    try {
      const h = await notebooklmHealth();
      setHealth(h);
    } catch {
      setHealth({ connected: false, provider: "cli", message: "Not connected" });
    } finally {
      setIsChecking(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await notebooklmConnect({ provider });
      await notebooklmSetSettings({ enabled: true, provider });
      updateSettingsCategory("features", { notebooklmEnabled: true });
      await checkHealth();
    } catch (error: any) {
      setHealth({
        connected: false,
        provider,
        message: error.message || "Failed to connect",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await notebooklmDisconnect();
      await checkHealth();
    } catch {
      console.error("Failed to disconnect:", error);
    }
  };

  const handleOpenNotebookLM = () => {
    addTab({
      title: "NotebookLM",
      icon: <Sparkles className="w-4 h-4" />,
      type: "notebooklm",
      content: NotebookLMTab,
      closable: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">{t("notebooklm.title")}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Connect to NotebookLM to research, generate study materials, and sync content.
            </p>

            {isChecking ? (
              <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking connection...
              </div>
            ) : health?.connected ? (
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Check className="w-4 h-4" />
                  <span>{t("common.connected")}</span>
                  <span className="text-muted-foreground">• {health.message}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleOpenNotebookLM}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Open NotebookLM Workspace
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="px-4 py-2 bg-background border border-border rounded-lg hover:bg-muted transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <AlertCircle className="w-4 h-4" />
                  <span>{t("notebooklm.notConnected")}</span>
                </div>
                
                <div className="p-4 bg-muted rounded-lg">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Provider
                  </label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as "mock" | "cli")}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 mb-3"
                  >
                    <option value="cli">CLI (notebooklm command)</option>
                    <option value="mock">Mock (for testing)</option>
                  </select>
                  <p className="text-xs text-muted-foreground mb-3">
                    Requires the notebooklm-py CLI to be installed and authenticated.{" "}
                    <a
                      href="https://github.com/teng-lin/notebooklm-py"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Learn more
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                  <button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Connect to NotebookLM
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Features Overview */}
      {health?.connected && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-950 rounded-lg flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h4 className="font-medium text-foreground mb-1">{t("notebooklm.chatWithSources")}</h4>
            <p className="text-sm text-muted-foreground">
              Ask questions about your imported sources and get AI-powered answers.
            </p>
          </div>
          
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-950 rounded-lg flex items-center justify-center mb-3">
              <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h4 className="font-medium text-foreground mb-1">{t("notebooklm.generateArtifacts")}</h4>
            <p className="text-sm text-muted-foreground">
              Create flashcards, quizzes, audio overviews, and study guides.
            </p>
          </div>
          
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-950 rounded-lg flex items-center justify-center mb-3">
              <ExternalLink className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h4 className="font-medium text-foreground mb-1">{t("notebooklm.syncToIncrementum")}</h4>
            <p className="text-sm text-muted-foreground">
              Import generated flashcards and quizzes directly into your decks.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
