/**
 * OCR Settings
 * Configure Optical Character Recognition providers and options
 */

import { useEffect, useState } from "react";
import { ScanText, Languages, Cloud, Server, Eye, Zap, FileText, Brain, Cpu } from "lucide-react";
import { isTauri, listen } from "../../lib/tauri";
import { useI18n } from "../../lib/i18n";
import {
  downloadOllamaInstaller,
  getGLMRuntimeStatus,
  GLMRuntimeStatus,
  openInstaller,
  pullOllamaModel,
  startOllamaRuntime,
  stopOllamaRuntime,
} from "../../api/ocrCommands";

interface OCRSettingsProps {
  settings: {
    provider: "tesseract" | "google" | "aws" | "azure" | "marker" | "nougat" | "glm";
    language: string;
    autoOCR: boolean;
    googleProjectId?: string;
    googleLocation?: string;
    googleProcessorId?: string;
    googleCredentialsPath?: string;
    awsRegion?: string;
    awsAccessKey?: string;
    awsSecretKey?: string;
    azureEndpoint?: string;
    azureApiKey?: string;
    glmEndpoint?: string;
    glmModel?: string;
    glmApiKey?: string;
    glmBackend?: "ollama" | "vllm";
    glmOllamaPath?: string;
    preferLocal: boolean;
    mathOcrEnabled: boolean;
    mathOcrCommand?: string;
    mathOcrModelDir?: string;
    keyPhraseExtraction: boolean;
    autoExtractOnLoad: boolean;
  };
  onUpdateSettings: (updates: Partial<OCRSettingsProps["settings"]>) => void;
}

export function OCRSettings({ settings, onUpdateSettings }: OCRSettingsProps) {
  const { t } = useI18n();

  const OCR_PROVIDERS = [
    {
      id: "tesseract",
      name: t("ocrSettings.tesseract"),
      description: t("ocrSettings.tesseractDesc"),
      icon: Server,
      isCloud: false,
    },
    {
      id: "glm",
      name: t("ocrSettings.glmOcr"),
      description: t("ocrSettings.glmOcrProviderDesc"),
      icon: Cpu,
      isCloud: false,
      badge: t("ocrSettings.glmBadge"),
    },
    {
      id: "google",
      name: t("ocrSettings.googleDocAi"),
      description: t("ocrSettings.googleDocAiProviderDesc"),
      icon: Cloud,
      isCloud: true,
    },
    {
      id: "aws",
      name: t("ocrSettings.awsTextract"),
      description: t("ocrSettings.awsTextractProviderDesc"),
      icon: Cloud,
      isCloud: true,
    },
    {
      id: "azure",
      name: t("ocrSettings.azureVision"),
      description: t("ocrSettings.azureVisionProviderDesc"),
      icon: Cloud,
      isCloud: true,
    },
    {
      id: "marker",
      name: t("ocrSettings.marker"),
      description: t("ocrSettings.markerDesc"),
      icon: FileText,
      isCloud: false,
    },
    {
      id: "nougat",
      name: t("ocrSettings.nougat"),
      description: t("ocrSettings.nougatDesc"),
      icon: Brain,
      isCloud: false,
    },
  ];

  const MATH_OCR_MODELS = [
    { id: "pix2tex", name: t("ocrSettings.mathModelPix2tex") },
    { id: "nougat", name: t("ocrSettings.mathModelNougat") },
    { id: "latex-ocr", name: t("ocrSettings.mathModelLatexOcr") },
  ];

  const SUPPORTED_LANGUAGES = [
    { code: "eng", name: t("ocrSettings.langEng") },
    { code: "spa", name: t("ocrSettings.langSpa") },
    { code: "fra", name: t("ocrSettings.langFra") },
    { code: "deu", name: t("ocrSettings.langDeu") },
    { code: "ita", name: t("ocrSettings.langIta") },
    { code: "por", name: t("ocrSettings.langPor") },
    { code: "rus", name: t("ocrSettings.langRus") },
    { code: "chi_sim", name: t("ocrSettings.langChiSim") },
    { code: "chi_tra", name: t("ocrSettings.langChiTra") },
    { code: "jpn", name: t("ocrSettings.langJpn") },
    { code: "kor", name: t("ocrSettings.langKor") },
    { code: "ara", name: t("ocrSettings.langAra") },
    { code: "hin", name: t("ocrSettings.langHin") },
  ];

  const selectedProvider = OCR_PROVIDERS.find((p) => p.id === settings.provider);
  const ProviderIcon = selectedProvider?.icon || ScanText;
  const [runtimeStatus, setRuntimeStatus] = useState<GLMRuntimeStatus | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [installerPath, setInstallerPath] = useState<string | null>(null);
  const [isStartingRuntime, setIsStartingRuntime] = useState(false);
  const [isStoppingRuntime, setIsStoppingRuntime] = useState(false);
  const [isDownloadingInstaller, setIsDownloadingInstaller] = useState(false);
  const [isPullingModel, setIsPullingModel] = useState(false);
  const runtimeDisabled = !isTauri();

  const glmBackend = settings.glmBackend || "ollama";
  const defaultOllamaEndpoint = "http://localhost:11434/v1";
  const defaultVllmEndpoint = "http://localhost:8080/v1";
  const resolvedGlmEndpoint =
    settings.glmEndpoint || (glmBackend === "ollama" ? defaultOllamaEndpoint : defaultVllmEndpoint);

  const refreshRuntimeStatus = async () => {
    if (!isTauri() || settings.provider !== "glm") return;
    try {
      const status = await getGLMRuntimeStatus({
        backend: glmBackend,
        endpoint: resolvedGlmEndpoint,
        ollama_path: settings.glmOllamaPath,
      });
      setRuntimeStatus(status);
      setRuntimeError(null);
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : t("ocrSettings.runtimeStatusFailed"));
    }
  };

  useEffect(() => {
    refreshRuntimeStatus();
  }, [settings.provider, glmBackend, resolvedGlmEndpoint, settings.glmOllamaPath]);

  useEffect(() => {
    if (!isTauri()) return;
    let unlistenProgress: (() => void) | null = null;
    let unlistenComplete: (() => void) | null = null;
    let mounted = true;

    listen<{ id: string; progress: number }>("glm-ocr://download-progress", (event) => {
      if (event.payload.id === "ollama") {
        setDownloadProgress(event.payload.progress);
        setIsDownloadingInstaller(true);
      }
    }).then((unlisten) => {
      if (mounted) {
        unlistenProgress = unlisten;
      } else {
        try { unlisten(); } catch { /* ignore */ }
      }
    }).catch(() => {
      // Ignore errors if component unmounted
    });

    listen<{ id: string; path: string }>("glm-ocr://download-complete", (event) => {
      if (event.payload.id === "ollama") {
        setInstallerPath(event.payload.path);
        setIsDownloadingInstaller(false);
        setDownloadProgress(null);
      }
    }).then((unlisten) => {
      if (mounted) {
        unlistenComplete = unlisten;
      } else {
        try { unlisten(); } catch { /* ignore */ }
      }
    }).catch(() => {
      // Ignore errors if component unmounted
    });

    return () => {
      mounted = false;
      try {
        unlistenProgress?.();
      } catch {
        // Ignore errors during cleanup
      }
      try {
        unlistenComplete?.();
      } catch {
        // Ignore errors during cleanup
      }
    };
  }, []);

  const handleBackendChange = (backend: "ollama" | "vllm") => {
    const nextEndpoint = backend === "ollama" ? defaultOllamaEndpoint : defaultVllmEndpoint;
    const shouldReplace =
      !settings.glmEndpoint ||
      settings.glmEndpoint === defaultOllamaEndpoint ||
      settings.glmEndpoint === defaultVllmEndpoint;
    onUpdateSettings({
      glmBackend: backend,
      glmEndpoint: shouldReplace ? nextEndpoint : settings.glmEndpoint,
    });
  };

  const handleDownloadOllama = async () => {
    if (runtimeDisabled) {
      setRuntimeError(t("ocrSettings.desktopOnly"));
      return;
    }
    setIsDownloadingInstaller(true);
    try {
      const path = await downloadOllamaInstaller();
      setInstallerPath(path);
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : t("ocrSettings.downloadFailed"));
    } finally {
      setIsDownloadingInstaller(false);
    }
  };

  const handleOpenInstaller = async () => {
    if (runtimeDisabled) {
      setRuntimeError(t("ocrSettings.desktopOnly"));
      return;
    }
    if (!installerPath) return;
    try {
      await openInstaller(installerPath);
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : t("ocrSettings.openInstallerFailed"));
    }
  };

  const handleStartRuntime = async () => {
    if (runtimeDisabled) {
      setRuntimeError(t("ocrSettings.desktopOnly"));
      return;
    }
    setIsStartingRuntime(true);
    try {
      await startOllamaRuntime({
        endpoint: resolvedGlmEndpoint,
        ollama_path: settings.glmOllamaPath,
      });
      await refreshRuntimeStatus();
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : t("ocrSettings.startFailed"));
    } finally {
      setIsStartingRuntime(false);
    }
  };

  const handleStopRuntime = async () => {
    if (runtimeDisabled) {
      setRuntimeError(t("ocrSettings.desktopOnly"));
      return;
    }
    setIsStoppingRuntime(true);
    try {
      await stopOllamaRuntime();
      await refreshRuntimeStatus();
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : t("ocrSettings.stopFailed"));
    } finally {
      setIsStoppingRuntime(false);
    }
  };

  const handlePullModel = async () => {
    if (runtimeDisabled) {
      setRuntimeError(t("ocrSettings.desktopOnly"));
      return;
    }
    if (!settings.glmModel) {
      setRuntimeError(t("ocrSettings.setModelFirst"));
      return;
    }
    setIsPullingModel(true);
    try {
      await pullOllamaModel({
        model: settings.glmModel,
        ollama_path: settings.glmOllamaPath,
      });
      await refreshRuntimeStatus();
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : t("ocrSettings.pullFailed"));
    } finally {
      setIsPullingModel(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <ScanText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">{t("ocrSettings.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("ocrSettings.desc")}</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Auto-OCR Toggle */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm font-medium text-foreground">{t("ocrSettings.autoOcr")}</div>
                <div className="text-xs text-muted-foreground mt-1">{t("ocrSettings.autoOcrDesc")}</div>
              </div>
            </div>
            <button
              onClick={() => onUpdateSettings({ autoOCR: !settings.autoOCR })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.autoOCR ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.autoOCR ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Provider Selection */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-3 mb-4">
            <ProviderIcon className="w-5 h-5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium text-foreground">{t("ocrSettings.provider")}</div>
              <div className="text-xs text-muted-foreground">{t("ocrSettings.selectProvider")}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {OCR_PROVIDERS.map((provider) => {
              const Icon = provider.icon;
              return (
                <button
                  key={provider.id}
                  onClick={() => onUpdateSettings({ provider: provider.id as any })}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    settings.provider === provider.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{provider.name}</span>
                    {provider.badge && (
                      <span className="ml-auto text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {provider.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{provider.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Language Selection */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <Languages className="w-5 h-5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium text-foreground">{t("ocrSettings.language")}</div>
              <div className="text-xs text-muted-foreground">{t("ocrSettings.primaryLanguage")}</div>
            </div>
          </div>
          <select
            value={settings.language || "eng"}
            onChange={(e) => onUpdateSettings({ language: e.target.value })}
            disabled={!settings.autoOCR}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        {/* Google Document AI Configuration */}
        {settings.provider === "google" && (
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <Cloud className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium text-foreground">{t("ocrSettings.googleDocAi")}</div>
                <div className="text-xs text-muted-foreground">{t("ocrSettings.googleDocAiDesc")}</div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("ocrSettings.projectId")}</label>
                <input
                  type="text"
                  value={settings.googleProjectId || ""}
                  onChange={(e) => onUpdateSettings({ googleProjectId: e.target.value })}
                  placeholder="your-project-id"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("ocrSettings.location")}</label>
                <input
                  type="text"
                  value={settings.googleLocation || "us"}
                  onChange={(e) => onUpdateSettings({ googleLocation: e.target.value })}
                  placeholder="us"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("ocrSettings.processorId")}</label>
                <input
                  type="text"
                  value={settings.googleProcessorId || ""}
                  onChange={(e) => onUpdateSettings({ googleProcessorId: e.target.value })}
                  placeholder="your-processor-id"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("ocrSettings.credentialsPath")}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.googleCredentialsPath || ""}
                    onChange={(e) => onUpdateSettings({ googleCredentialsPath: e.target.value })}
                    placeholder="/path/to/credentials.json"
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    onClick={() => {
                      (window as any).api?.file?.openFileDialog?.({
                        filters: [{ name: "JSON", extensions: ["json"] }],
                      })?.then((path: string) => {
                        if (path) onUpdateSettings({ googleCredentialsPath: path });
                      });
                    }}
                    className="px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm transition-colors"
                  >
                    {t("ocrSettings.browse")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AWS Textract Configuration */}
        {settings.provider === "aws" && (
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <Cloud className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium text-foreground">{t("ocrSettings.awsTextract")}</div>
                <div className="text-xs text-muted-foreground">{t("ocrSettings.awsTextractDesc")}</div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("ocrSettings.awsRegion")}</label>
                <select
                  value={settings.awsRegion || "us-east-1"}
                  onChange={(e) => onUpdateSettings({ awsRegion: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="us-east-1">us-east-1</option>
                  <option value="us-west-2">us-west-2</option>
                  <option value="eu-west-1">eu-west-1</option>
                  <option value="ap-southeast-1">ap-southeast-1</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("ocrSettings.accessKeyId")}</label>
                <input
                  type="password"
                  value={settings.awsAccessKey || ""}
                  onChange={(e) => onUpdateSettings({ awsAccessKey: e.target.value })}
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("ocrSettings.secretAccessKey")}</label>
                <input
                  type="password"
                  value={settings.awsSecretKey || ""}
                  onChange={(e) => onUpdateSettings({ awsSecretKey: e.target.value })}
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        )}

        {/* Azure Computer Vision Configuration */}
        {settings.provider === "azure" && (
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <Cloud className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium text-foreground">{t("ocrSettings.azureVision")}</div>
                <div className="text-xs text-muted-foreground">{t("ocrSettings.azureVisionDesc")}</div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("ocrSettings.endpoint")}</label>
                <input
                  type="text"
                  value={settings.azureEndpoint || ""}
                  onChange={(e) => onUpdateSettings({ azureEndpoint: e.target.value })}
                  placeholder="https://your-resource.cognitiveservices.azure.com"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("ocrSettings.apiKey")}</label>
                <input
                  type="password"
                  value={settings.azureApiKey || ""}
                  onChange={(e) => onUpdateSettings({ azureApiKey: e.target.value })}
                  placeholder="your-api-key"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        )}

        {/* GLM-OCR Configuration */}
        {settings.provider === "glm" && (
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <Cpu className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium text-foreground">{t("ocrSettings.glmOcr")}</div>
                <div className="text-xs text-muted-foreground">{t("ocrSettings.glmOcrDesc")}</div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("ocrSettings.endpoint")}</label>
                <input
                  type="text"
                  value={settings.glmEndpoint || ""}
                  onChange={(e) => onUpdateSettings({ glmEndpoint: e.target.value })}
                  placeholder={glmBackend === "ollama" ? defaultOllamaEndpoint : defaultVllmEndpoint}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("ocrSettings.model")}</label>
                <input
                  type="text"
                  value={settings.glmModel || ""}
                  onChange={(e) => onUpdateSettings({ glmModel: e.target.value })}
                  placeholder={glmBackend === "ollama" ? "llava:7b" : "glm-4v"}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {glmBackend === "ollama" && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {t("ocrSettings.suggestedModels")}:{" "}
                    <button
                      onClick={() => onUpdateSettings({ glmModel: "llava:7b" })}
                      className="text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid"
                    >
                      llava:7b
                    </button>
                    {" · "}
                    <button
                      onClick={() => onUpdateSettings({ glmModel: "qwen2-vl:2b" })}
                      className="text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid"
                    >
                      qwen2-vl:2b
                    </button>
                    {" · "}
                    <button
                      onClick={() => onUpdateSettings({ glmModel: "qwen2-vl:7b" })}
                      className="text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid"
                    >
                      qwen2-vl:7b
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("ocrSettings.apiKeyOptional")}</label>
                <input
                  type="password"
                  value={settings.glmApiKey || ""}
                  onChange={(e) => onUpdateSettings({ glmApiKey: e.target.value })}
                  placeholder="your-api-key"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        )}

        {/* GLM-OCR Runtime Setup */}
        {settings.provider === "glm" && (
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <Cpu className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium text-foreground">{t("ocrSettings.glmRuntime")}</div>
                <div className="text-xs text-muted-foreground">{t("ocrSettings.glmRuntimeDesc")}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => handleBackendChange("ollama")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  glmBackend === "ollama"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("ocrSettings.ollamaCpu")}
              </button>
              <button
                onClick={() => handleBackendChange("vllm")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  glmBackend === "vllm"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("ocrSettings.llamaCppVllm")}
              </button>
            </div>

            {glmBackend === "ollama" ? (
              <div className="space-y-4">
                {runtimeDisabled && (
                  <div className="text-xs text-muted-foreground">
                    {t("ocrSettings.desktopOnly")}
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-xs text-muted-foreground">
                    {t("ocrSettings.status")}:{" "}
                    <span className="text-foreground font-medium">
                      {runtimeStatus?.running ? t("ocrSettings.running") : t("ocrSettings.stopped")}
                    </span>
                    {" · "}
                    <span className="text-foreground font-medium">
                      {runtimeStatus?.installed ? t("ocrSettings.installed") : t("ocrSettings.notInstalled")}
                    </span>
                  </div>
                  <button
                    onClick={refreshRuntimeStatus}
                    className="px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-md text-xs transition-colors"
                  >
                    {t("ocrSettings.refresh")}
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {t("ocrSettings.ollamaBinaryPath")}
                  </label>
                  <input
                    type="text"
                    value={settings.glmOllamaPath || ""}
                    onChange={(e) => onUpdateSettings({ glmOllamaPath: e.target.value })}
                    placeholder="/usr/local/bin/ollama"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleDownloadOllama}
                    disabled={runtimeDisabled || isDownloadingInstaller}
                    className="px-3 py-2 bg-muted hover:bg-muted/80 rounded-md text-xs transition-colors disabled:opacity-50"
                  >
                    {isDownloadingInstaller ? t("ocrSettings.downloading") : t("ocrSettings.downloadOllama")}
                  </button>
                  {installerPath && (
                    <button
                      onClick={handleOpenInstaller}
                      disabled={runtimeDisabled}
                      className="px-3 py-2 bg-muted hover:bg-muted/80 rounded-md text-xs transition-colors"
                    >
                      {t("ocrSettings.openInstaller")}
                    </button>
                  )}
                  <button
                    onClick={handleStartRuntime}
                    disabled={runtimeDisabled || !runtimeStatus?.installed || isStartingRuntime}
                    className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-xs transition-colors disabled:opacity-50"
                  >
                    {isStartingRuntime ? t("ocrSettings.starting") : t("ocrSettings.startRuntime")}
                  </button>
                  <button
                    onClick={handleStopRuntime}
                    disabled={runtimeDisabled || !runtimeStatus?.running || isStoppingRuntime}
                    className="px-3 py-2 bg-muted hover:bg-muted/80 rounded-md text-xs transition-colors disabled:opacity-50"
                  >
                    {isStoppingRuntime ? t("ocrSettings.stopping") : t("ocrSettings.stopRuntime")}
                  </button>
                  <button
                    onClick={handlePullModel}
                    disabled={runtimeDisabled || !settings.glmModel || isPullingModel}
                    className="px-3 py-2 bg-muted hover:bg-muted/80 rounded-md text-xs transition-colors disabled:opacity-50"
                  >
                    {isPullingModel ? t("ocrSettings.pulling") : t("ocrSettings.pullModel")}
                  </button>
                </div>

                {downloadProgress !== null && (
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, downloadProgress))}%` }}
                    />
                  </div>
                )}

                {runtimeStatus?.models_dir && (
                  <div className="text-xs text-muted-foreground">
                    {t("ocrSettings.modelsDir")}: <span className="text-foreground">{runtimeStatus.models_dir}</span>
                  </div>
                )}

                {runtimeError && (
                  <div className="text-xs text-destructive">{runtimeError}</div>
                )}

                <div className="text-xs text-muted-foreground">
                  {t("ocrSettings.linuxSudoHint")}
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-muted-foreground">
                <div>{t("ocrSettings.vllmIntro")}</div>
                <div className="rounded-md bg-muted/40 p-3">
                  <div className="font-medium text-foreground mb-1">{t("ocrSettings.llamaCppTitle")}</div>
                  <pre className="whitespace-pre-wrap text-xs text-foreground">
                    {`git clone https://github.com/ggml-org/llama.cpp.git
cd llama.cpp && cmake -B build && cmake --build build -j$(nproc)
# Download a GGUF model, then start the server:
./build/bin/llama-server -m models/YOUR-MODEL.gguf --port 8080 --host 0.0.0.0 -c 16384 -t $(nproc)`}
                  </pre>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <div className="font-medium text-foreground mb-1">{t("ocrSettings.vllmTitle")}</div>
                  <pre className="whitespace-pre-wrap text-xs text-foreground">
                    {`pip install -U vllm
vllm serve zai-org/GLM-OCR --allowed-local-media-path / --port 8080`}
                  </pre>
                </div>
                <div>{t("ocrSettings.serverStarted")}</div>
                <a
                  href="https://github.com/zai-org/GLM-OCR#deployment"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline decoration-dotted underline-offset-4 hover:decoration-solid"
                >
                  {t("ocrSettings.deploymentDocs")}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Local OCR Options */}
        {(settings.provider === "tesseract" || settings.provider === "marker" || settings.provider === "nougat" || settings.provider === "glm") && (
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <Server className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium text-foreground">{t("ocrSettings.localProcessing")}</div>
                <div className="text-xs text-muted-foreground">{t("ocrSettings.localProcessingDesc")}</div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{t("ocrSettings.preferLocal")}</p>
                <p className="text-xs text-muted-foreground">{t("ocrSettings.preferLocalDesc")}</p>
              </div>
              <button
                onClick={() => onUpdateSettings({ preferLocal: !settings.preferLocal })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.preferLocal ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.preferLocal ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Math OCR Configuration */}
        {(settings.provider === "nougat" || settings.mathOcrEnabled) && (
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Brain className="w-5 h-5 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium text-foreground">{t("ocrSettings.mathOcr")}</div>
                  <div className="text-xs text-muted-foreground">{t("ocrSettings.mathOcrDesc")}</div>
                </div>
              </div>
              <button
                onClick={() => onUpdateSettings({ mathOcrEnabled: !settings.mathOcrEnabled })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.mathOcrEnabled ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.mathOcrEnabled ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>

            {settings.mathOcrEnabled && (
              <div className="space-y-3 pt-3 border-t border-border">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">{t("ocrSettings.ocrModel")}</label>
                  <select
                    value={settings.mathOcrCommand || "nougat"}
                    onChange={(e) => onUpdateSettings({ mathOcrCommand: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {MATH_OCR_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">{t("ocrSettings.modelDirOptional")}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={settings.mathOcrModelDir || ""}
                      onChange={(e) => onUpdateSettings({ mathOcrModelDir: e.target.value })}
                      placeholder="/path/to/models"
                      className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      onClick={() => {
                        (window as any).api?.file?.openFileDialog?.({
                          directory: true,
                        })?.then((path: string) => {
                          if (path) onUpdateSettings({ mathOcrModelDir: path });
                        });
                      }}
                      className="px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm transition-colors"
                    >
                      {t("ocrSettings.browse")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Key Phrase Extraction */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <Eye className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm font-medium text-foreground">{t("ocrSettings.keyPhrase")}</div>
                <div className="text-xs text-muted-foreground mt-1">{t("ocrSettings.keyPhraseDesc")}</div>
              </div>
            </div>
            <button
              onClick={() => onUpdateSettings({ keyPhraseExtraction: !settings.keyPhraseExtraction })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.keyPhraseExtraction ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.keyPhraseExtraction ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Auto-Extract on Document Load */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm font-medium text-foreground">{t("ocrSettings.autoExtractOnLoad")}</div>
                <div className="text-xs text-muted-foreground mt-1">{t("ocrSettings.autoExtractOnLoadDesc")}</div>
              </div>
            </div>
            <button
              onClick={() => onUpdateSettings({ autoExtractOnLoad: !settings.autoExtractOnLoad })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.autoExtractOnLoad ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.autoExtractOnLoad ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <p className="text-sm text-primary">
            <strong>{t("ocrSettings.note")}</strong> {t("ocrSettings.noteDesc")}
          </p>
        </div>
      </div>
    </div>
  );
}
