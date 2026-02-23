import { useState } from "react";
import { invokeCommand as invoke } from "../lib/tauri";
import { useTabsStore } from "../stores";
import { NotebookLMTab } from "../components/tabs/TabRegistry";
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
      alert("Please enter your Obsidian vault path");
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
      alert("Please enter your Obsidian vault path");
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
        <h1 className="text-xl font-semibold text-foreground mb-1">Integrations</h1>
        <p className="text-sm text-foreground-secondary">
          Connect Incrementum with external tools and services.
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
                    <h3 className="text-lg font-semibold text-foreground">NotebookLM</h3>
                    <p className="text-sm text-foreground-secondary mt-1">
                      Research, generate artifacts, and sync study content into Incrementum decks.
                      Chat with your sources, create flashcards, quizzes, audio overviews, and more.
                    </p>
                  </div>
                  <button
                    onClick={handleOpenNotebookLM}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Open NotebookLM
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Chat with sources
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Generate flashcards
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    Create audio overviews
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
                <h3 className="text-lg font-semibold text-foreground">Obsidian</h3>
                <p className="text-sm text-foreground-secondary mt-1 mb-4">
                  Sync your documents and flashcards to Obsidian for advanced note-taking.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Vault Path
                    </label>
                    <input
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
                          Exporting...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Export to Obsidian
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
                          Syncing...
                        </>
                      ) : (
                        <>
                          <LinkIcon className="w-4 h-4" />
                          Sync
                        </>
                      )}
                    </button>
                  </div>
                  {obsidianStatus === "success" && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <Check className="w-4 h-4" />
                      Sync completed successfully
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
                <h3 className="text-lg font-semibold text-foreground">Anki</h3>
                <p className="text-sm text-foreground-secondary mt-1 mb-4">
                  Sync your flashcards to Anki for cross-platform spaced repetition.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Anki Profile
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
                          Testing...
                        </>
                      ) : (
                        "Test Connection"
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
                          Syncing...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Sync to Anki
                        </>
                      )}
                    </button>
                  </div>
                  {ankiStatus === "success" && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <Check className="w-4 h-4" />
                      Sync completed successfully
                    </div>
                  )}
                  {ankiStatus === "connected" && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <Check className="w-4 h-4" />
                      Anki connection successful
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
                <h3 className="text-lg font-semibold text-foreground">Browser Extension</h3>
                <p className="text-sm text-foreground-secondary mt-1">
                  Install the browser extension to quickly save content from the web.
                </p>
                <button className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity">
                  Install Extension
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
