import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  Loader2,
  Mic,
  Play,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Volume2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cloneVoice, generateSpeech, TTSServiceError } from "../../api/tts";
import { checkPocketTTSAvailable } from "../../api/pocketTts";
import { useSettingsStore } from "../../stores/settingsStore";
import {
  FAL_LANGUAGES,
  createDefaultTTSSettings,
  getVoicesForProvider,
  validateTTSConfiguration,
  type TTSPreset,
  type TTSVoiceProfile,
  type TTSProvider,
} from "../../utils/ttsSettings";
import { cn } from "../../utils";
import { isTauri } from "../../lib/tauri";
import { useI18n } from "../../lib/i18n";

const MAX_SAMPLE_FILE_SIZE_MB = 12;
const MAX_SAMPLE_DURATION_SECONDS = 45;
const ACCEPTED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/flac",
  "audio/mp4",
  "audio/x-m4a",
];

type LifecycleState = "idle" | "uploading" | "cloning" | "generating" | "success" | "error";

function makeCustomPreset(input: {
  name: string;
  prompt: string;
  temperature: number;
  topP: number;
  topK: number;
  repetitionPenalty: number;
  maxNewTokens: number;
}): TTSPreset {
  return {
    id: `custom-${Date.now()}`,
    name: input.name,
    description: "User preset",
    prompt: input.prompt,
    temperature: input.temperature,
    topP: input.topP,
    topK: input.topK,
    repetitionPenalty: input.repetitionPenalty,
    maxNewTokens: input.maxNewTokens,
    readonly: false,
  };
}

async function getAudioDuration(file: File): Promise<number> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      audio.onloadedmetadata = () => resolve();
      audio.onerror = () => reject(new Error("Failed to read audio metadata."));
    });

    if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
      throw new Error("Invalid audio duration.");
    }

    return audio.duration;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof TTSServiceError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unexpected error while processing TTS request.";
}

export function TTSSettings() {
  const { t } = useI18n();
  const { settings, updateSettings } = useSettingsStore();
  const tts = settings.tts ?? createDefaultTTSSettings();

  const [apiKeyInput, setApiKeyInput] = useState(tts.apiKey);
  const [proxyUrlInput, setProxyUrlInput] = useState(tts.proxyUrl);
  const [modelIdInput, setModelIdInput] = useState(tts.modelId);
  const [cloneModelIdInput, setCloneModelIdInput] = useState(tts.cloneModelId);
  const [groqModelIdInput, setGroqModelIdInput] = useState(tts.groqModelId);

  const [voiceName, setVoiceName] = useState("");
  const [voiceSampleText, setVoiceSampleText] = useState("This is my voice cloning sample.");
  const [voiceSampleFile, setVoiceSampleFile] = useState<File | null>(null);
  const [voiceValidationError, setVoiceValidationError] = useState<string | null>(null);

  const [operationState, setOperationState] = useState<LifecycleState>("idle");
  const [operationMessage, setOperationMessage] = useState<string>("");
  const [generateText, setGenerateText] = useState("Welcome to Incrementum. This is your configured text to speech output.");
  const [overrideVoiceId, setOverrideVoiceId] = useState("default");
  const [overridePresetId, setOverridePresetId] = useState("default");
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string>("");

  const [customPresetForm, setCustomPresetForm] = useState({
    name: "",
    prompt: "",
    temperature: 0.9,
    topP: 1,
    topK: 50,
    repetitionPenalty: 1.05,
    maxNewTokens: 220,
  });

  useEffect(() => {
    setApiKeyInput(tts.apiKey);
    setProxyUrlInput(tts.proxyUrl);
    setModelIdInput(tts.modelId);
    setCloneModelIdInput(tts.cloneModelId);
    setGroqModelIdInput(tts.groqModelId);
  }, [tts.apiKey, tts.proxyUrl, tts.modelId, tts.cloneModelId, tts.groqModelId]);

  const providerVoices = useMemo(
    () => getVoicesForProvider(tts),
    [tts]
  );
  const isGroqProvider = tts.provider === "groq";

  const defaultVoice = useMemo(
    () => providerVoices.find((voice) => voice.id === tts.defaultVoiceId),
    [providerVoices, tts.defaultVoiceId]
  );

  const defaultPreset = useMemo(
    () => tts.presets.find((preset) => preset.id === tts.defaultPresetId),
    [tts.presets, tts.defaultPresetId]
  );
  const ttsConfigValidation = useMemo(() => validateTTSConfiguration(tts), [tts]);

  const updateTTS = (updates: Partial<typeof tts>) => {
    const latestTts = useSettingsStore.getState().settings.tts ?? createDefaultTTSSettings();
    updateSettings({
      tts: {
        ...latestTts,
        ...updates,
      },
    });
  };

  const saveProviderSettings = () => {
    const latestTts = useSettingsStore.getState().settings.tts ?? createDefaultTTSSettings();
    const savingGroqProvider = latestTts.provider === "groq";
    updateTTS({
      apiKey: apiKeyInput.trim(),
      proxyUrl: savingGroqProvider ? "" : proxyUrlInput.trim(),
      modelId: modelIdInput.trim() || latestTts.modelId,
      cloneModelId: cloneModelIdInput.trim() || latestTts.cloneModelId,
      groqModelId: groqModelIdInput.trim() || latestTts.groqModelId,
    });
    setOperationState("success");
    setOperationMessage(t("settings.ttsProviderSettingsSaved"));
  };

  const resetTTSSettings = () => {
    updateSettings({ tts: createDefaultTTSSettings() });
    setOperationState("idle");
    setOperationMessage("");
    setGeneratedAudioUrl("");
  };

  const validateVoiceFile = async (file: File): Promise<string | null> => {
    if (!ACCEPTED_AUDIO_TYPES.includes(file.type)) {
      return t("settings.ttsUnsupportedAudioFormat");
    }

    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_SAMPLE_FILE_SIZE_MB) {
      return t("settings.ttsAudioSampleMaxSize", { max: MAX_SAMPLE_FILE_SIZE_MB });
    }

    try {
      const duration = await getAudioDuration(file);
      if (duration > MAX_SAMPLE_DURATION_SECONDS) {
        return t("settings.ttsAudioSampleMaxDuration", { max: MAX_SAMPLE_DURATION_SECONDS });
      }
    } catch {
      return t("settings.ttsAudioMetadataReadFailed");
    }

    return null;
  };

  const handleVoiceFileSelect = async (file: File | null) => {
    setVoiceSampleFile(file);
    if (!file) {
      setVoiceValidationError(null);
      return;
    }

    const validationError = await validateVoiceFile(file);
    setVoiceValidationError(validationError);
  };

  const handleCloneVoice = async () => {
    if (!voiceSampleFile) {
      setOperationState("error");
      setOperationMessage(t("settings.ttsSelectAudioSample"));
      return;
    }

    if (!voiceName.trim()) {
      setOperationState("error");
      setOperationMessage(t("settings.ttsVoiceNameRequired"));
      return;
    }

    if (voiceValidationError) {
      setOperationState("error");
      setOperationMessage(voiceValidationError);
      return;
    }

    setOperationState("uploading");
    setOperationMessage(t("settings.ttsUploadingSample"));

    try {
      setOperationState("cloning");
      setOperationMessage(t("settings.ttsCreatingClonedVoice"));
      const result = await cloneVoice(settings, {
        voiceName,
        sampleFile: voiceSampleFile,
        sampleText: voiceSampleText,
      });

      const mergedVoices: TTSVoiceProfile[] = [
        ...tts.voiceProfiles,
        result.profile,
      ];

      updateTTS({
        voiceProfiles: mergedVoices,
        defaultVoiceId: tts.defaultVoiceId || result.profile.id,
      });

      setVoiceName("");
      setVoiceSampleText("This is my voice cloning sample.");
      setVoiceSampleFile(null);
      setVoiceValidationError(null);
      setOperationState("success");
      setOperationMessage(`Created cloned voice: ${result.profile.name}`);
    } catch (error) {
      setOperationState("error");
      setOperationMessage(getErrorMessage(error));
    }
  };

  const handleGenerateSpeech = async (textOverride?: string) => {
    const text = textOverride ?? generateText;
    if (!text.trim()) {
      setOperationState("error");
      setOperationMessage(t("settings.ttsEnterTextToGenerate"));
      return;
    }

    setOperationState("generating");
    setOperationMessage(t("settings.ttsGeneratingSpeech"));

    try {
      const latestSettings = useSettingsStore.getState().settings;
      const runtimeSettings = isGroqProvider
        ? {
            ...latestSettings,
            tts: {
              ...latestSettings.tts,
              provider: "groq" as const,
              requestMode: "direct" as const,
              proxyUrl: "",
            },
          }
        : latestSettings;

      const result = await generateSpeech(runtimeSettings, {
        text,
        voiceId: overrideVoiceId === "default" ? undefined : overrideVoiceId,
        presetId: overridePresetId === "default" ? undefined : overridePresetId,
      });
      setGeneratedAudioUrl(result.audioUrl);
      setOperationState("success");
      setOperationMessage(t("settings.ttsGenerationSucceeded"));
    } catch (error) {
      setOperationState("error");
      setOperationMessage(getErrorMessage(error));
    }
  };

  const handleGroqTest = async () => {
    const testText = generateText.trim() || "This is a Groq TTS test in Incrementum.";
    if (!generateText.trim()) {
      setGenerateText(testText);
    }
    await handleGenerateSpeech(testText);
  };

  const addCustomPreset = () => {
    if (!customPresetForm.name.trim()) {
      setOperationState("error");
      setOperationMessage(t("settings.ttsPresetNameRequired"));
      return;
    }

    const preset = makeCustomPreset({
      ...customPresetForm,
      name: customPresetForm.name.trim(),
      prompt: customPresetForm.prompt.trim(),
    });

    updateTTS({
      presets: [...tts.presets, preset],
      defaultPresetId: tts.defaultPresetId || preset.id,
    });

    setCustomPresetForm((prev) => ({ ...prev, name: "", prompt: "" }));
    setOperationState("success");
    setOperationMessage(`Added preset: ${preset.name}`);
  };

  const deletePreset = (presetId: string) => {
    const preset = tts.presets.find((item) => item.id === presetId);
    if (!preset || preset.readonly) return;

    const nextPresets = tts.presets.filter((item) => item.id !== presetId);
    const nextDefault =
      tts.defaultPresetId === presetId
        ? nextPresets[0]?.id ?? createDefaultTTSSettings().defaultPresetId
        : tts.defaultPresetId;

    updateTTS({ presets: nextPresets, defaultPresetId: nextDefault });
  };

  const removeClonedVoice = (voiceId: string) => {
    const voice = tts.voiceProfiles.find((item) => item.id === voiceId);
    if (!voice || voice.kind !== "cloned") return;

    const nextVoices = tts.voiceProfiles.filter((item) => item.id !== voiceId);
    const fallbackVoiceId =
      nextVoices.find((item) => item.kind === "builtin")?.id ||
      createDefaultTTSSettings().defaultVoiceId;

    updateTTS({
      voiceProfiles: nextVoices,
      defaultVoiceId: tts.defaultVoiceId === voiceId ? fallbackVoiceId : tts.defaultVoiceId,
    });
  };

  const setProvider = (provider: TTSProvider) => {
    const latestTts = useSettingsStore.getState().settings.tts ?? createDefaultTTSSettings();
    const voices = getVoicesForProvider(latestTts, provider);
    updateTTS({
      provider,
      requestMode: provider === "groq" || provider === "pocket" ? "direct" : latestTts.requestMode,
      defaultVoiceId: voices[0]?.id || latestTts.defaultVoiceId,
    });
  };

  // Pocket TTS status
  const [pocketStatus, setPocketStatus] = useState<{
    available: boolean;
    downloading: boolean;
    downloadProgress: number;
    error?: string;
  }>({ available: false, downloading: false, downloadProgress: 0 });

  // Check Pocket TTS availability on mount
  useEffect(() => {
    if (!isTauri()) {
      setPocketStatus({ available: false, downloading: false, downloadProgress: 0 });
      return;
    }

    checkPocketTTSAvailable().then((status) => {
      setPocketStatus({
        available: status.available,
        downloading: status.downloading,
        downloadProgress: status.downloadProgress ?? 0,
        error: status.error,
      });
    });
  }, []);

  const handleDownloadPocketTTS = async () => {
    if (!isTauri()) return;

    setPocketStatus((prev) => ({ ...prev, downloading: true, downloadProgress: 0, error: undefined }));

    try {
      // Pocket TTS downloads models automatically on first use
      // We trigger a short synthesis to force model download
      const { generatePocketSpeech } = await import("../../api/pocketTts");

      setPocketStatus((prev) => ({ ...prev, downloadProgress: 50 }));

      await generatePocketSpeech({
        text: "Download complete.",
        voice: "alba",
      });

      setPocketStatus({
        available: true,
        downloading: false,
        downloadProgress: 100,
        error: undefined,
      });
    } catch (error) {
      setPocketStatus((prev) => ({
        ...prev,
        downloading: false,
        error: error instanceof Error ? error.message : t("settings.ttsFailedInitPocketTts"),
      }));
    }
  };

  const isPocketProvider = tts.provider === "pocket";
  const showPocketOption = isTauri();

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Volume2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-foreground">{t("settings.ttsTitle")}</h4>
              <p className="text-sm text-muted-foreground">
                {t("settings.ttsDescription")}
              </p>
            </div>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={tts.enabled}
              onChange={(e) => updateTTS({ enabled: e.target.checked })}
            />
            <div className="h-6 w-11 rounded-full bg-muted peer-checked:bg-primary peer-focus:ring-2 peer-focus:ring-primary/30" />
            <div className="absolute left-[2px] top-[2px] h-5 w-5 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-foreground">{t("settings.ttsProvider")}</span>
            <select
              value={tts.provider}
              onChange={(e) => setProvider(e.target.value as TTSProvider)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            >
              <option value="fal">{t("settings.ttsProviderFalCloud")}</option>
              <option value="groq">{t("settings.ttsProviderGroqCloud")}</option>
              {showPocketOption && <option value="pocket">{t("settings.ttsProviderPocketLocal")}</option>}
            </select>
            {!showPocketOption && (
              <span className="text-xs text-muted-foreground">{t("settings.ttsPocketRequiresDesktop")}</span>
            )}
          </label>

          {isGroqProvider ? (
            <div className="space-y-1 text-sm">
              <span className="font-medium text-foreground">{t("settings.ttsRequestMode")}</span>
              <div className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-foreground">
                {t("settings.ttsDirectToGroq")}
              </div>
            </div>
          ) : isPocketProvider ? (
            <div className="space-y-1 text-sm">
              <span className="font-medium text-foreground">{t("settings.ttsRequestMode")}</span>
              <div className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-foreground">
                {t("settings.ttsLocalOffline")}
              </div>
            </div>
          ) : (
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">{t("settings.ttsRequestMode")}</span>
              <select
                value={tts.requestMode}
                onChange={(e) => updateTTS({ requestMode: e.target.value as "direct" | "proxy" })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="direct">{t("settings.ttsDirectToFal")}</option>
                <option value="proxy">{t("settings.ttsProxyServer")}</option>
              </select>
            </label>
          )}

          {!isGroqProvider && !isPocketProvider && (
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">{t("settings.ttsLanguage")}</span>
              <select
                value={tts.language}
                onChange={(e) => updateTTS({ language: e.target.value as typeof tts.language })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                {FAL_LANGUAGES.map((language) => (
                  <option key={language} value={language}>{language}</option>
                ))}
              </select>
            </label>
          )}

          {isPocketProvider && (
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">{t("settings.ttsSpeed")}</span>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={tts.pocketSpeed ?? 1.0}
                onChange={(e) => updateTTS({ pocketSpeed: parseFloat(e.target.value) })}
                className="w-full"
              />
              <span className="text-xs text-muted-foreground">{(tts.pocketSpeed ?? 1.0).toFixed(1)}x</span>
            </label>
          )}
        </div>

        {/* Pocket TTS Status Panel */}
        {isPocketProvider && (
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {pocketStatus.available ? (
                  <WifiOff className="h-4 w-4 text-green-600" />
                ) : (
                  <Wifi className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-medium text-foreground">
                  {pocketStatus.available
                    ? t("settings.ttsPocketReady")
                    : pocketStatus.downloading
                      ? t("settings.ttsDownloadingModel")
                      : t("settings.ttsPocketNotInstalled")}
                </span>
              </div>
              {!pocketStatus.available && !pocketStatus.downloading && (
                <button
                  onClick={handleDownloadPocketTTS}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                >
                  <Download className="h-4 w-4" />
                  {t("settings.ttsDownload")}
                </button>
              )}
            </div>
            {pocketStatus.downloading && (
              <div className="mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${pocketStatus.downloadProgress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("settings.ttsDownloaded", { percent: pocketStatus.downloadProgress.toFixed(0) })}
                </p>
              </div>
            )}
            {pocketStatus.error && (
              <p className="mt-2 text-xs text-destructive">{pocketStatus.error}</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {t("settings.ttsPocketOfflineNote")}
            </p>
          </div>
        )}

        {!ttsConfigValidation.valid && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {ttsConfigValidation.error}
          </div>
        )}

        {/* API Key section - not needed for Pocket TTS */}
        {!isPocketProvider && (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-foreground">{tts.provider === "groq" ? t("settings.ttsGroqApiKey") : t("settings.ttsFalApiKey")}</span>
            <input
              type="password"
              value={apiKeyInput}
              placeholder={tts.provider === "groq" ? "gsk_..." : "Key ..."}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
            <span className="text-xs text-muted-foreground">
              {tts.provider === "groq"
                ? t("settings.ttsGroqApiKeyHint")
                : t("settings.ttsFalApiKeyHint")}
            </span>
          </label>

          {!isGroqProvider && (
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">{t("settings.ttsProxyUrl")}</span>
              <input
                type="text"
                value={proxyUrlInput}
                placeholder="https://your-proxy.example.com/tts"
                onChange={(e) => setProxyUrlInput(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              />
              <span className="text-xs text-muted-foreground">{t("settings.ttsProxyUrlHint")}</span>
            </label>
          )}
        </div>
        )}

        {/* Fal-specific model settings */}
        {tts.provider === "fal" && (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">{t("settings.ttsModelId")}</span>
              <input
                type="text"
                value={modelIdInput}
                onChange={(e) => setModelIdInput(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">{t("settings.ttsCloneModelId")}</span>
              <input
                type="text"
                value={cloneModelIdInput}
                onChange={(e) => setCloneModelIdInput(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>
          </div>
        )}

        {/* Groq-specific model settings */}
        {tts.provider === "groq" && (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">{t("settings.ttsGroqTtsModel")}</span>
              <select
                value={groqModelIdInput}
                onChange={(e) => setGroqModelIdInput(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="playai-tts">playai-tts</option>
                <option value="playai-tts-arabic">playai-tts-arabic</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">{t("settings.ttsResponseFormat")}</span>
              <select
                value={tts.groqResponseFormat}
                onChange={(e) => updateTTS({ groqResponseFormat: e.target.value as "wav" | "mp3" })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="mp3">mp3</option>
                <option value="wav">wav</option>
              </select>
            </label>
          </div>
        )}

        {tts.provider === "groq" && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {t("settings.ttsGroqTierNote")}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={saveProviderSettings}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Save className="h-4 w-4" />
            {t("settings.ttsSaveProviderSettings")}
          </button>
          <button
            onClick={resetTTSSettings}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm"
          >
            <RefreshCw className="h-4 w-4" />
            {t("settings.ttsResetToDefaults")}
          </button>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-base font-semibold text-foreground">{t("settings.ttsVoiceProfiles")}</h4>
            <p className="text-sm text-muted-foreground">
              {t("settings.ttsVoiceProfilesDesc")}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {providerVoices.map((voice) => (
            <div key={voice.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{voice.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {voice.kind === "builtin" ? t("settings.ttsBuiltInVoice") : t("settings.ttsClonedVoice")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateTTS({ defaultVoiceId: voice.id })}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs",
                      tts.defaultVoiceId === voice.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border"
                    )}
                  >
                    {tts.defaultVoiceId === voice.id ? t("settings.ttsDefault") : t("settings.ttsSetDefault")}
                  </button>
                  {voice.kind === "cloned" && tts.provider === "fal" && (
                    <button
                      onClick={() => removeClonedVoice(voice.id)}
                      className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {tts.provider === "fal" && (
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Mic className="h-4 w-4 text-primary" />
            <h5 className="font-medium text-foreground">{t("settings.ttsCreateClonedVoice")}</h5>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">{t("settings.ttsVoiceName")}</span>
              <input
                type="text"
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                placeholder="My Narration Voice"
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">{t("settings.ttsAudioSample")}</span>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => handleVoiceFileSelect(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>
          </div>

          <label className="mt-3 block space-y-1 text-sm">
            <span className="font-medium text-foreground">{t("settings.ttsSampleTranscript")}</span>
            <textarea
              rows={2}
              value={voiceSampleText}
              onChange={(e) => setVoiceSampleText(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>

          {voiceValidationError && (
            <p className="mt-2 text-xs text-destructive">{voiceValidationError}</p>
          )}

          <button
            onClick={handleCloneVoice}
            disabled={operationState === "uploading" || operationState === "cloning"}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {(operationState === "uploading" || operationState === "cloning") ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {t("settings.ttsCloneVoice")}
          </button>
        </div>
        )}
      </section>

      {!isGroqProvider && (
      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <h4 className="text-base font-semibold text-foreground">{t("settings.ttsPresets")}</h4>
        <p className="text-sm text-muted-foreground">
          {t("settings.ttsPresetsDesc")}
        </p>

        <div className="grid gap-3">
          {tts.presets.map((preset) => (
            <div key={preset.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{preset.name}</p>
                  <p className="text-xs text-muted-foreground">{preset.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    temp {preset.temperature.toFixed(2)} • top_p {preset.topP.toFixed(2)} • top_k {preset.topK}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateTTS({ defaultPresetId: preset.id })}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs",
                      tts.defaultPresetId === preset.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border"
                    )}
                  >
                    {tts.defaultPresetId === preset.id ? t("settings.ttsDefault") : t("settings.ttsSetDefault")}
                  </button>
                  {!preset.readonly && (
                    <button
                      onClick={() => deletePreset(preset.id)}
                      className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <h5 className="mb-2 font-medium text-foreground">{t("settings.ttsAddCustomPreset")}</h5>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              type="text"
              value={customPresetForm.name}
              onChange={(e) => setCustomPresetForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder={t("settings.ttsPresetNamePlaceholder")}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={customPresetForm.prompt}
              onChange={(e) => setCustomPresetForm((prev) => ({ ...prev, prompt: e.target.value }))}
              placeholder={t("settings.ttsPromptStylePlaceholder")}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="text-xs">{t("settings.ttsTemperature")}
              <input
                type="number"
                min={0.1}
                max={2}
                step={0.05}
                value={customPresetForm.temperature}
                onChange={(e) => setCustomPresetForm((prev) => ({ ...prev, temperature: Number(e.target.value) || 0.9 }))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs">{t("settings.ttsTopP")}
              <input
                type="number"
                min={0.1}
                max={1}
                step={0.05}
                value={customPresetForm.topP}
                onChange={(e) => setCustomPresetForm((prev) => ({ ...prev, topP: Number(e.target.value) || 1 }))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs">{t("settings.ttsMaxTokens")}
              <input
                type="number"
                min={20}
                max={1000}
                step={10}
                value={customPresetForm.maxNewTokens}
                onChange={(e) => setCustomPresetForm((prev) => ({ ...prev, maxNewTokens: Number(e.target.value) || 220 }))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <button
            onClick={addCustomPreset}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
          >
            <Plus className="h-4 w-4" />
            {t("settings.ttsAddPreset")}
          </button>
        </div>
      </section>
      )}

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <h4 className="text-base font-semibold text-foreground">
          {isGroqProvider ? t("settings.ttsTestGroqTts") : t("settings.ttsGenerateSpeech")}
        </h4>
        <p className="text-sm text-muted-foreground">
          {isGroqProvider
            ? t("settings.ttsTestGroqTtsDesc")
            : t("settings.ttsGenerateSpeechDesc")}
        </p>

        <textarea
          rows={3}
          value={generateText}
          onChange={(e) => setGenerateText(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2"
        />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-foreground">{t("settings.ttsVoiceOverride")}</span>
            <select
              value={overrideVoiceId}
              onChange={(e) => setOverrideVoiceId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            >
              <option value="default">{t("settings.ttsUseDefault", { name: defaultVoice?.name || "none" })}</option>
              {providerVoices.map((voice) => (
                <option key={voice.id} value={voice.id}>{voice.name}</option>
              ))}
            </select>
          </label>

          {!isGroqProvider && (
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">{t("settings.ttsPresetOverride")}</span>
              <select
                value={overridePresetId}
                onChange={(e) => setOverridePresetId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="default">{t("settings.ttsUseDefault", { name: defaultPreset?.name || "none" })}</option>
                {tts.presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void handleGenerateSpeech()}
            disabled={operationState === "generating"}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {operationState === "generating" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isGroqProvider ? t("settings.ttsGenerateGroqAudio") : t("settings.ttsGenerateAudio")}
          </button>

          {isGroqProvider && (
            <button
              onClick={() => void handleGroqTest()}
              disabled={operationState === "generating"}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-60"
            >
              <Volume2 className="h-4 w-4" />
              {t("settings.ttsTestGroqTts")}
            </button>
          )}
        </div>

        {operationState === "error" && (
          <button
            onClick={() => void handleGenerateSpeech()}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
          >
            <RefreshCw className="h-4 w-4" />
            {t("settings.ttsRetryGeneration")}
          </button>
        )}

        {generatedAudioUrl && (
          <audio controls src={generatedAudioUrl} className="w-full" />
        )}
      </section>

      {operationMessage && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
            operationState === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-primary/30 bg-primary/10 text-foreground"
          )}
        >
          {operationState === "error" ? (
            <AlertCircle className="mt-0.5 h-4 w-4" />
          ) : operationState === "success" ? (
            <Check className="mt-0.5 h-4 w-4 text-primary" />
          ) : (
            <Loader2 className="mt-0.5 h-4 w-4 animate-spin" />
          )}
          <span>{operationMessage}</span>
        </div>
      )}
    </div>
  );
}
