import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Loader2,
  Mic,
  Play,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Volume2,
} from "lucide-react";
import { cloneVoice, generateSpeech, TTSServiceError } from "../../api/tts";
import { useSettingsStore } from "../../stores/settingsStore";
import {
  FAL_LANGUAGES,
  createDefaultTTSSettings,
  getVoicesForProvider,
  validateTTSConfiguration,
  type TTSPreset,
  type TTSVoiceProfile,
} from "../../utils/ttsSettings";
import { cn } from "../../utils";

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
    setOperationMessage("Provider settings saved.");
  };

  const resetTTSSettings = () => {
    updateSettings({ tts: createDefaultTTSSettings() });
    setOperationState("idle");
    setOperationMessage("");
    setGeneratedAudioUrl("");
  };

  const validateVoiceFile = async (file: File): Promise<string | null> => {
    if (!ACCEPTED_AUDIO_TYPES.includes(file.type)) {
      return "Unsupported audio format. Use MP3, WAV, M4A, OGG, or WebM.";
    }

    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_SAMPLE_FILE_SIZE_MB) {
      return `Audio sample must be ${MAX_SAMPLE_FILE_SIZE_MB}MB or smaller.`;
    }

    try {
      const duration = await getAudioDuration(file);
      if (duration > MAX_SAMPLE_DURATION_SECONDS) {
        return `Audio sample must be ${MAX_SAMPLE_DURATION_SECONDS} seconds or shorter.`;
      }
    } catch {
      return "Unable to read audio metadata. Try another file.";
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
      setOperationMessage("Select an audio sample before cloning.");
      return;
    }

    if (!voiceName.trim()) {
      setOperationState("error");
      setOperationMessage("Voice name is required.");
      return;
    }

    if (voiceValidationError) {
      setOperationState("error");
      setOperationMessage(voiceValidationError);
      return;
    }

    setOperationState("uploading");
    setOperationMessage("Uploading sample clip...");

    try {
      setOperationState("cloning");
      setOperationMessage("Creating cloned voice profile...");
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
      setOperationMessage("Enter text to generate speech.");
      return;
    }

    setOperationState("generating");
    setOperationMessage("Generating speech audio...");

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
      setOperationMessage("Speech generation succeeded.");
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
      setOperationMessage("Preset name is required.");
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

  const setProvider = (provider: "fal" | "groq") => {
    const latestTts = useSettingsStore.getState().settings.tts ?? createDefaultTTSSettings();
    const voices = getVoicesForProvider(latestTts, provider);
    updateTTS({
      provider,
      requestMode: provider === "groq" ? "direct" : latestTts.requestMode,
      defaultVoiceId: voices[0]?.id || latestTts.defaultVoiceId,
    });
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Volume2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-foreground">Text To Speech</h4>
              <p className="text-sm text-muted-foreground">
                Provider-backed speech generation with built-in and custom voices.
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
            <span className="font-medium text-foreground">Provider</span>
            <select
              value={tts.provider}
              onChange={(e) => setProvider(e.target.value as "fal" | "groq")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            >
              <option value="fal">Fal.ai</option>
              <option value="groq">Groq</option>
            </select>
          </label>

          {isGroqProvider ? (
            <div className="space-y-1 text-sm">
              <span className="font-medium text-foreground">Request Mode</span>
              <div className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-foreground">
                Direct (client to Groq)
              </div>
            </div>
          ) : (
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">Request Mode</span>
              <select
                value={tts.requestMode}
                onChange={(e) => updateTTS({ requestMode: e.target.value as "direct" | "proxy" })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="direct">Direct (client to Fal.ai)</option>
                <option value="proxy">Proxy (server gateway)</option>
              </select>
            </label>
          )}

          {!isGroqProvider && (
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">Language</span>
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
        </div>

        {!ttsConfigValidation.valid && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {ttsConfigValidation.error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-foreground">{tts.provider === "groq" ? "Groq API Key" : "Fal API Key"}</span>
            <input
              type="password"
              value={apiKeyInput}
              placeholder={tts.provider === "groq" ? "gsk_..." : "Key ..."}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
            <span className="text-xs text-muted-foreground">
              {tts.provider === "groq"
                ? "If empty, TTS reuses your Audio Transcription Groq API key."
                : "Required in direct mode."}
            </span>
          </label>

          {!isGroqProvider && (
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">Proxy URL</span>
              <input
                type="text"
                value={proxyUrlInput}
                placeholder="https://your-proxy.example.com/tts"
                onChange={(e) => setProxyUrlInput(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              />
              <span className="text-xs text-muted-foreground">Used when request mode is proxy.</span>
            </label>
          )}
        </div>

        {tts.provider === "fal" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">TTS Model ID</span>
              <input
                type="text"
                value={modelIdInput}
                onChange={(e) => setModelIdInput(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">Clone Model ID</span>
              <input
                type="text"
                value={cloneModelIdInput}
                onChange={(e) => setCloneModelIdInput(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">Groq TTS Model</span>
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
              <span className="font-medium text-foreground">Response Format</span>
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
            Groq TTS supports free-tier usage up to account limits, then paid usage if enabled on your Groq account.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={saveProviderSettings}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Save className="h-4 w-4" />
            Save Provider Settings
          </button>
          <button
            onClick={resetTTSSettings}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Reset To Defaults
          </button>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-base font-semibold text-foreground">Voice Profiles</h4>
            <p className="text-sm text-muted-foreground">
              Select voices for the active provider.
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
                    {voice.kind === "builtin" ? "Built-in voice" : "Cloned voice"}
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
                    {tts.defaultVoiceId === voice.id ? "Default" : "Set Default"}
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
            <h5 className="font-medium text-foreground">Create Cloned Voice</h5>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">Voice Name</span>
              <input
                type="text"
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                placeholder="My Narration Voice"
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">Audio Sample</span>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => handleVoiceFileSelect(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>
          </div>

          <label className="mt-3 block space-y-1 text-sm">
            <span className="font-medium text-foreground">Sample Transcript (optional)</span>
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
            Clone Voice
          </button>
        </div>
        )}
      </section>

      {!isGroqProvider && (
      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <h4 className="text-base font-semibold text-foreground">Presets</h4>
        <p className="text-sm text-muted-foreground">
          Choose a default preset and create custom presets for generation style.
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
                    {tts.defaultPresetId === preset.id ? "Default" : "Set Default"}
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
          <h5 className="mb-2 font-medium text-foreground">Add Custom Preset</h5>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              type="text"
              value={customPresetForm.name}
              onChange={(e) => setCustomPresetForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Preset name"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={customPresetForm.prompt}
              onChange={(e) => setCustomPresetForm((prev) => ({ ...prev, prompt: e.target.value }))}
              placeholder="Prompt style"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="text-xs">Temperature
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
            <label className="text-xs">Top P
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
            <label className="text-xs">Max Tokens
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
            Add Preset
          </button>
        </div>
      </section>
      )}

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <h4 className="text-base font-semibold text-foreground">
          {isGroqProvider ? "Test Groq TTS" : "Generate Speech"}
        </h4>
        <p className="text-sm text-muted-foreground">
          {isGroqProvider
            ? "Quickly test your configured Groq voices and audio output."
            : "Generate speech using saved defaults or temporary per-request overrides."}
        </p>

        <textarea
          rows={3}
          value={generateText}
          onChange={(e) => setGenerateText(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2"
        />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-foreground">Voice Override</span>
            <select
              value={overrideVoiceId}
              onChange={(e) => setOverrideVoiceId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            >
              <option value="default">Use default ({defaultVoice?.name || "none"})</option>
              {providerVoices.map((voice) => (
                <option key={voice.id} value={voice.id}>{voice.name}</option>
              ))}
            </select>
          </label>

          {!isGroqProvider && (
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">Preset Override</span>
              <select
                value={overridePresetId}
                onChange={(e) => setOverridePresetId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="default">Use default ({defaultPreset?.name || "none"})</option>
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
            {isGroqProvider ? "Generate Groq Audio" : "Generate Audio"}
          </button>

          {isGroqProvider && (
            <button
              onClick={() => void handleGroqTest()}
              disabled={operationState === "generating"}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-60"
            >
              <Volume2 className="h-4 w-4" />
              Test Groq TTS
            </button>
          )}
        </div>

        {operationState === "error" && (
          <button
            onClick={() => void handleGenerateSpeech()}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Retry Generation
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
