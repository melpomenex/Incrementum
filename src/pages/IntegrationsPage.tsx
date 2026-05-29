import { useState } from "react";
import { invokeCommand as invoke } from "../lib/tauri";
import { useTabsStore } from "../stores";
import { NotebookLMTab } from "../components/tabs/TabRegistry";
import { useI18n } from "../lib/i18n";
import {
  Link as LinkIcon,
  Download,
  Upload,
  Loader2,
  Check,
  AlertCircle,
  Brain,
  Gem,
  Layers,
  Sparkles,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

export function IntegrationsPage() {
  const { t } = useI18n();
  const addTab = useTabsStore((state) => state.addTab);
  const [obsidianVault, setObsidianVault] = useState("");
  const [obsidianStatus, setObsidianStatus] = useState<string>("");
  const [ankiProfile, setAnkiProfile] = useState("");
  const [ankiStatus, setAnkiStatus] = useState<string>("");

  const handleOpenNotebookLM = () => {
    addTab({
      title: "NotebookLM",
      icon: <Sparkles className="w-4 h-4" />,
      type: "notebooklm",
      content: NotebookLMTab,
      closable: true,
    });
  };

  const handleObsidianExport = async () => {
    if (!obsidianVault) {
      alert(t("integrations.obsidianVaultRequired"));
      return;
    }

    setObsidianStatus("exporting");

    try {
      await invoke("sync_to_obsidian", {
        config: {
          vaultPath: obsidianVault,
          notesFolder: "Incrementum",
          attachmentsFolder: "Incrementum Assets",
        },
      });
      setObsidianStatus("success");
      setTimeout(() => setObsidianStatus(""), 3000);
    } catch (error: any) {
      setObsidianStatus(`error: ${error}`);
    }
  };

  const handleObsidianSync = async () => {
    if (!obsidianVault) {
      alert(t("integrations.obsidianVaultRequired"));
      return;
    }

    setObsidianStatus("syncing");

    try {
      await invoke("sync_to_obsidian", {
        config: {
          vaultPath: obsidianVault,
          notesFolder: "Incrementum",
          attachmentsFolder: "Incrementum Assets",
        },
      });
      setObsidianStatus("success");
      setTimeout(() => setObsidianStatus(""), 3000);
    } catch (error: any) {
      setObsidianStatus(`error: ${error}`);
    }
  };

  const handleAnkiSync = async () => {
    setAnkiStatus("syncing");
    try {
      await invoke("sync_flashcards_to_anki", { profile: ankiProfile || "User 1" });
      setAnkiStatus("success");
      setTimeout(() => setAnkiStatus(""), 3000);
    } catch (error: any) {
      setAnkiStatus(`error: ${error}`);
    }
  };

  const handleTestAnki = async () => {
    setAnkiStatus("testing");
    try {
      await invoke("test_anki_connection");
      setAnkiStatus("connected");
      setTimeout(() => setAnkiStatus(""), 3000);
    } catch (error: any) {
      setAnkiStatus(`error: ${error}`);
    }
  };

  return (
    <div className="h-full flex flex-col bg-cream">
      <div className="p-4 border-b border-border bg-card">
        <h1 className="text-xl font-semibold text-foreground mb-1">{t("integrations.title")}</h1>
        <p className="text-sm text-foreground-secondary">
          {t("integrations.subtitle")}
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* NotebookLM Card */}
          <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{t("integrations.notebooklm")}</h3>
                    <p className="text-sm text-foreground-secondary mt-1">
                      {t("integrations.notebooklmDesc")}
                    </p>
                  </div>
                  <button
                    onClick={handleOpenNotebookLM}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    {t("integrations.openNotebooklm")}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {t("integrations.chatWithSources")}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    {t("integrations.generateFlashcards")}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    {t("integrations.createAudioOverviews")}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Obsidian Card */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-950 rounded-xl flex items-center justify-center">
                <Gem className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground">{t("integrations.obsidian")}</h3>
                <p className="text-sm text-foreground-secondary mt-1 mb-4">
                  {t("integrations.obsidianDesc")}
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {t("integrations.vaultPath")}
                    </label>
                    <input
                      aria-label="API key"
              type="text"
                      value={obsidianVault}
                      onChange={(e) => setObsidianVault(e.target.value)}
                      placeholder="/Users/yourname/Obsidian/MyVault"
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleObsidianExport}
                      disabled={obsidianStatus === "exporting" || !obsidianVault}
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                    >
                      {obsidianStatus === "exporting" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t("integrations.exporting")}
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          {t("integrations.exportToObsidian")}
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleObsidianSync}
                      disabled={obsidianStatus === "syncing" || !obsidianVault}
                      className="px-4 py-2 bg-background border border-border rounded-lg hover:bg-muted disabled:opacity-50 flex items-center gap-2"
                    >
                      {obsidianStatus === "syncing" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t("integrations.syncing")}
                        </>
                      ) : (
                        <>
                          <LinkIcon className="w-4 h-4" />
                          {t("integrations.sync")}
                        </>
                      )}
                    </button>
                  </div>
                  {obsidianStatus === "success" && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <Check className="w-4 h-4" />
                      {t("integrations.syncComplete")}
                    </div>
                  )}
                  {obsidianStatus?.startsWith("error") && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="w-4 h-4" />
                      {obsidianStatus.replace("error: ", "")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Anki Card */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-950 rounded-xl flex items-center justify-center">
                <Layers className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground">{t("integrations.anki")}</h3>
                <p className="text-sm text-foreground-secondary mt-1 mb-4">
                  {t("integrations.ankiDesc")}
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {t("integrations.ankiProfile")}
                    </label>
                    <input
                      type="text"
                      value={ankiProfile}
                      onChange={(e) => setAnkiProfile(e.target.value)}
                      placeholder="User 1"
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleTestAnki}
                      disabled={ankiStatus === "testing"}
                      className="px-4 py-2 bg-background border border-border rounded-lg hover:bg-muted disabled:opacity-50 flex items-center gap-2"
                    >
                      {ankiStatus === "testing" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t("integrations.testing")}
                        </>
                      ) : (
                        t("integrations.testConnection")
                      )}
                    </button>
                    <button
                      onClick={handleAnkiSync}
                      disabled={ankiStatus === "syncing"}
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                    >
                      {ankiStatus === "syncing" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t("integrations.syncing")}
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          {t("integrations.syncToAnki")}
                        </>
                      )}
                    </button>
                  </div>
                  {ankiStatus === "success" && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <Check className="w-4 h-4" />
                      {t("integrations.syncComplete")}
                    </div>
                  )}
                  {ankiStatus === "connected" && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <Check className="w-4 h-4" />
                      {t("integrations.ankiSuccess")}
                    </div>
                  )}
                  {ankiStatus?.startsWith("error") && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="w-4 h-4" />
                      {ankiStatus.replace("error: ", "")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Browser Extension Card */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-950 rounded-xl flex items-center justify-center">
                <ExternalLink className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground">{t("integrations.browserExtension")}</h3>
                <p className="text-sm text-foreground-secondary mt-1">
                  {t("integrations.browserExtensionDesc")}
                </p>
                <button className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity">
                  {t("integrations.installExtension")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
