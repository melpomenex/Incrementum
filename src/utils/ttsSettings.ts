export const TTS_SETTINGS_SCHEMA_VERSION = 2;

export const FAL_BUILTIN_VOICES = [
  "Vivian",
  "Serena",
  "Uncle_Fu",
  "Dylan",
  "Eric",
  "Ryan",
  "Aiden",
  "Ono_Anna",
  "Sohee",
] as const;

export const GROQ_BUILTIN_VOICES = [
  "Fiora",
  "Arista",
  "Aster",
  "Puck",
  "Aoede",
  "Kore",
  "Leda",
  "Orpheus",
  "Angus",
  "Athena",
  "Helios",
  "Hera",
  "Luna",
  "Orion",
  "Perseus",
  "Stella",
] as const;

export const POCKET_BUILTIN_VOICES = [
  "alba",
  "marius",
  "javert",
  "jean",
  "fantine",
  "cosette",
  "eponine",
  "azelma",
] as const;

export type FalBuiltinVoice = (typeof FAL_BUILTIN_VOICES)[number];
export type GroqBuiltinVoice = (typeof GROQ_BUILTIN_VOICES)[number];
export type PocketBuiltinVoice = (typeof POCKET_BUILTIN_VOICES)[number];

export const FAL_LANGUAGES = [
  "Auto",
  "English",
  "Chinese",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Japanese",
  "Korean",
  "Portuguese",
  "Russian",
] as const;

export type FalLanguage = (typeof FAL_LANGUAGES)[number];

export type TTSProvider = "fal" | "groq" | "pocket";
export type TTSRequestMode = "direct" | "proxy";

export interface TTSPreset {
  id: string;
  name: string;
  description: string;
  prompt: string;
  temperature: number;
  topP: number;
  topK: number;
  repetitionPenalty: number;
  maxNewTokens: number;
  readonly: boolean;
}

export interface TTSVoiceProfile {
  id: string;
  provider: TTSProvider;
  name: string;
  kind: "builtin" | "cloned";
  voice?: FalBuiltinVoice | GroqBuiltinVoice | PocketBuiltinVoice;
  speakerEmbeddingUrl?: string;
  referenceText?: string;
  createdAt: string;
}

export interface TTSSettings {
  schemaVersion: number;
  enabled: boolean;
  provider: TTSProvider;
  requestMode: TTSRequestMode;
  apiKey: string;
  proxyUrl: string;
  modelId: string;
  cloneModelId: string;
  groqModelId: string;
  groqResponseFormat: "wav" | "mp3";
  language: FalLanguage;
  defaultVoiceId: string;
  defaultPresetId: string;
  voiceProfiles: TTSVoiceProfile[];
  presets: TTSPreset[];
  // Pocket TTS settings
  pocketSpeed: number; // 0.5 - 2.0
  pocketAvailable: boolean; // Runtime flag for sidecar availability
}

export const DEFAULT_TTS_PRESETS: TTSPreset[] = [
  {
    id: "balanced-default",
    name: "Balanced",
    description: "Natural cadence for most narration and review cards.",
    prompt: "Clear and natural narration.",
    temperature: 0.9,
    topP: 1,
    topK: 50,
    repetitionPenalty: 1.05,
    maxNewTokens: 200,
    readonly: true,
  },
  {
    id: "expressive-story",
    name: "Expressive",
    description: "More dynamic style for storytelling and engaging reads.",
    prompt: "Expressive voice with emotional range and emphasis.",
    temperature: 1,
    topP: 1,
    topK: 60,
    repetitionPenalty: 1.03,
    maxNewTokens: 240,
    readonly: true,
  },
  {
    id: "fast-review",
    name: "Fast",
    description: "Compact and efficient delivery for quick review sessions.",
    prompt: "Concise and steady speech with minimal pauses.",
    temperature: 0.8,
    topP: 0.95,
    topK: 40,
    repetitionPenalty: 1.08,
    maxNewTokens: 180,
    readonly: true,
  },
];

export function makeDefaultTTSVoiceProfiles(): TTSVoiceProfile[] {
  const falVoices = FAL_BUILTIN_VOICES.map((voice) => ({
    id: `fal-builtin-${voice}`,
    provider: "fal" as const,
    name: voice.replace(/_/g, " "),
    kind: "builtin" as const,
    voice,
    createdAt: new Date(0).toISOString(),
  }));

  const groqVoices = GROQ_BUILTIN_VOICES.map((voice) => ({
    id: `groq-builtin-${voice.toLowerCase()}`,
    provider: "groq" as const,
    name: voice,
    kind: "builtin" as const,
    voice,
    createdAt: new Date(0).toISOString(),
  }));

  const pocketVoices = POCKET_BUILTIN_VOICES.map((voice) => ({
    id: `pocket-builtin-${voice}`,
    provider: "pocket" as const,
    name: voice.charAt(0).toUpperCase() + voice.slice(1), // Capitalize
    kind: "builtin" as const,
    voice,
    createdAt: new Date(0).toISOString(),
  }));

  return [...falVoices, ...groqVoices, ...pocketVoices];
}

function defaultVoiceIdForProvider(provider: TTSProvider): string {
  switch (provider) {
    case "groq":
      return "groq-builtin-fiora";
    case "pocket":
      return "pocket-builtin-alba";
    default:
      return "fal-builtin-Vivian";
  }
}

export function createDefaultTTSSettings(): TTSSettings {
  return {
    schemaVersion: TTS_SETTINGS_SCHEMA_VERSION,
    enabled: false,
    provider: "fal",
    requestMode: "direct",
    apiKey: "",
    proxyUrl: "",
    modelId: "fal-ai/qwen-3-tts/text-to-speech/1.7b",
    cloneModelId: "fal-ai/qwen-3-tts/clone-voice/1.7b",
    groqModelId: "playai-tts",
    groqResponseFormat: "mp3",
    language: "Auto",
    defaultVoiceId: defaultVoiceIdForProvider("fal"),
    defaultPresetId: DEFAULT_TTS_PRESETS[0].id,
    voiceProfiles: makeDefaultTTSVoiceProfiles(),
    presets: DEFAULT_TTS_PRESETS,
    // Pocket TTS defaults
    pocketSpeed: 1.0,
    pocketAvailable: false,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function asNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeVoiceProfiles(
  persisted: unknown,
  defaults: TTSVoiceProfile[]
): TTSVoiceProfile[] {
  const base = new Map(defaults.map((profile) => [profile.id, profile]));
  if (!Array.isArray(persisted)) {
    return [...base.values()];
  }

  for (const item of persisted) {
    if (!isObject(item)) continue;
    const kind = item.kind === "cloned" ? "cloned" : item.kind === "builtin" ? "builtin" : null;
    if (!kind) continue;

    const provider: TTSProvider =
      item.provider === "groq" ? "groq" :
      item.provider === "pocket" ? "pocket" : "fal";
    const id = asNonEmptyString(item.id, "");
    const name = asNonEmptyString(item.name, "");
    if (!id || !name) continue;

    const profile: TTSVoiceProfile = {
      id,
      provider,
      name,
      kind,
      createdAt: asString(item.createdAt, new Date().toISOString()),
    };

    if (kind === "builtin") {
      if (typeof item.voice === "string") {
        if (provider === "fal" && (FAL_BUILTIN_VOICES as readonly string[]).includes(item.voice)) {
          profile.voice = item.voice as FalBuiltinVoice;
        } else if (provider === "groq" && (GROQ_BUILTIN_VOICES as readonly string[]).includes(item.voice)) {
          profile.voice = item.voice as GroqBuiltinVoice;
        } else if (provider === "pocket" && (POCKET_BUILTIN_VOICES as readonly string[]).includes(item.voice)) {
          profile.voice = item.voice as PocketBuiltinVoice;
        } else {
          continue;
        }
      } else {
        continue;
      }
    }

    if (kind === "cloned") {
      profile.provider = "fal";
      profile.speakerEmbeddingUrl = asString(item.speakerEmbeddingUrl, "");
      profile.referenceText = asString(item.referenceText, "");
      if (!profile.speakerEmbeddingUrl) continue;
    }

    base.set(profile.id, profile);
  }

  return [...base.values()];
}

function normalizePresets(persisted: unknown, defaults: TTSPreset[]): TTSPreset[] {
  if (!Array.isArray(persisted)) return defaults;
  const out: TTSPreset[] = [];

  for (const item of persisted) {
    if (!isObject(item)) continue;
    const id = asNonEmptyString(item.id, "");
    const name = asNonEmptyString(item.name, "");
    if (!id || !name) continue;

    out.push({
      id,
      name,
      description: asString(item.description, ""),
      prompt: asString(item.prompt, ""),
      temperature: clampNumber(item.temperature, 0.9, 0.1, 2),
      topP: clampNumber(item.topP, 1, 0.1, 1),
      topK: Math.round(clampNumber(item.topK, 50, 1, 200)),
      repetitionPenalty: clampNumber(item.repetitionPenalty, 1.05, 0.9, 2),
      maxNewTokens: Math.round(clampNumber(item.maxNewTokens, 200, 20, 1000)),
      readonly: Boolean(item.readonly),
    });
  }

  if (out.length === 0) return defaults;

  const byId = new Map(out.map((preset) => [preset.id, preset]));
  for (const preset of defaults) {
    if (!byId.has(preset.id)) {
      byId.set(preset.id, preset);
    }
  }

  return [...byId.values()];
}

export function sanitizeTTSSettings(input: unknown): TTSSettings {
  const defaults = createDefaultTTSSettings();
  if (!isObject(input)) return defaults;

  const voiceProfiles = normalizeVoiceProfiles(input.voiceProfiles, defaults.voiceProfiles);
  const presets = normalizePresets(input.presets, defaults.presets);

  let provider: TTSProvider = "fal";
  if (input.provider === "groq") {
    provider = "groq";
  } else if (input.provider === "pocket") {
    provider = "pocket";
  }

  const defaultVoiceIdRaw = asString(input.defaultVoiceId, defaultVoiceIdForProvider(provider));
  const defaultPresetIdRaw = asString(input.defaultPresetId, defaults.defaultPresetId);

  const providerVoices = voiceProfiles.filter((voice) => voice.provider === provider);
  const providerFallbackVoiceId = providerVoices[0]?.id || defaultVoiceIdForProvider(provider);
  const defaultVoiceId =
    providerVoices.some((profile) => profile.id === defaultVoiceIdRaw)
      ? defaultVoiceIdRaw
      : providerFallbackVoiceId;

  const defaultPresetId =
    presets.some((preset) => preset.id === defaultPresetIdRaw)
      ? defaultPresetIdRaw
      : defaults.defaultPresetId;

  const requestMode: TTSRequestMode = input.requestMode === "proxy" ? "proxy" : "direct";
  const language =
    typeof input.language === "string" && (FAL_LANGUAGES as readonly string[]).includes(input.language)
      ? (input.language as FalLanguage)
      : defaults.language;

  const groqResponseFormat = input.groqResponseFormat === "wav" ? "wav" : "mp3";

  // Pocket TTS settings
  const pocketSpeed = clampNumber(input.pocketSpeed, 1.0, 0.5, 2.0);
  const pocketAvailable = Boolean(input.pocketAvailable);

  return {
    schemaVersion: TTS_SETTINGS_SCHEMA_VERSION,
    enabled: Boolean(input.enabled),
    provider,
    requestMode,
    apiKey: asString(input.apiKey),
    proxyUrl: asString(input.proxyUrl),
    modelId: asNonEmptyString(input.modelId, defaults.modelId),
    cloneModelId: asNonEmptyString(input.cloneModelId, defaults.cloneModelId),
    groqModelId: asNonEmptyString(input.groqModelId, defaults.groqModelId),
    groqResponseFormat,
    language,
    defaultVoiceId,
    defaultPresetId,
    voiceProfiles,
    presets,
    pocketSpeed,
    pocketAvailable,
  };
}

export function getVoicesForProvider(settings: TTSSettings, provider: TTSProvider = settings.provider): TTSVoiceProfile[] {
  return settings.voiceProfiles.filter((voice) => voice.provider === provider);
}

export function validateTTSConfiguration(settings: TTSSettings): { valid: boolean; error?: string } {
  if (!settings.enabled) {
    return { valid: true };
  }

  // Pocket TTS requires no API key - it's local
  if (settings.provider === "pocket") {
    // Pocket TTS is always valid when enabled (sidecar check happens at runtime)
    return { valid: true };
  }

  if (settings.requestMode === "proxy" && !settings.proxyUrl.trim()) {
    return { valid: false, error: "Proxy URL is required for proxy mode." };
  }

  if (settings.requestMode === "direct" && settings.provider === "fal" && !settings.apiKey.trim()) {
    return { valid: false, error: "Fal API key is required for direct Fal mode." };
  }

  // Groq direct mode can reuse the existing Groq transcription key if TTS key is blank.
  return { valid: true };
}
