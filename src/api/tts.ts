import type { Settings } from "../stores/settingsStore";
import {
  getVoicesForProvider,
  type TTSPreset,
  type TTSProvider,
  type TTSSettings,
  type TTSVoiceProfile,
} from "../utils/ttsSettings";
import { makeCacheKey, getCachedAudio, setCachedAudio } from "../utils/ttsCache";

const DEFAULT_FAL_BASE_URL = "https://fal.run";
const DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const MAX_RETRIES = 2;

export class TTSServiceError extends Error {
  code: "validation" | "auth" | "rate_limit" | "network" | "provider";
  recoverable: boolean;

  constructor(
    message: string,
    code: TTSServiceError["code"] = "provider",
    recoverable = false
  ) {
    super(message);
    this.name = "TTSServiceError";
    this.code = code;
    this.recoverable = recoverable;
  }
}

export interface CloneVoiceRequest {
  voiceName: string;
  sampleFile: File;
  sampleText?: string;
}

export interface CloneVoiceResult {
  profile: TTSVoiceProfile;
  rawOutput: Record<string, unknown>;
}

export interface GenerateSpeechRequest {
  text: string;
  voiceId?: string;
  presetId?: string;
}

export interface GenerateSpeechResult {
  audioUrl: string;
  durationSec?: number;
  rawOutput: Record<string, unknown>;
}

export function getTTSSettingsFromStore(settings: Settings): TTSSettings {
  return settings.tts;
}

function getBaseUrl(tts: TTSSettings): string {
  if (tts.requestMode === "proxy" && tts.proxyUrl.trim()) {
    return tts.proxyUrl.trim().replace(/\/$/, "");
  }
  return tts.provider === "groq" ? DEFAULT_GROQ_BASE_URL : DEFAULT_FAL_BASE_URL;
}

function getProviderApiKey(settings: Settings, tts: TTSSettings): string {
  if (tts.provider === "fal") {
    return tts.apiKey.trim();
  }
  return tts.apiKey.trim() || settings.audioTranscription?.groq?.apiKey?.trim() || "";
}

function getHeaders(settings: Settings, tts: TTSSettings): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (tts.requestMode === "direct") {
    const key = getProviderApiKey(settings, tts);
    if (!key) {
      throw new TTSServiceError(
        tts.provider === "groq"
          ? "Groq API key is required. Add it in Audio Transcription settings or TTS settings."
          : "Fal API key is required for direct mode.",
        "validation"
      );
    }

    headers.Authorization = `Bearer ${key}`;
    if (tts.provider === "fal") {
      headers.Authorization = `Key ${key}`;
    }
  }

  return headers;
}

function resolvePreset(tts: TTSSettings, presetId?: string): TTSPreset {
  const id = presetId || tts.defaultPresetId;
  const found = tts.presets.find((preset) => preset.id === id);
  return found || tts.presets[0];
}

function resolveVoice(tts: TTSSettings, voiceId?: string): TTSVoiceProfile {
  const providerVoices = getVoicesForProvider(tts);
  const id = voiceId || tts.defaultVoiceId;
  const found = providerVoices.find((voice) => voice.id === id);
  return found || providerVoices[0] || tts.voiceProfiles[0];
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toServiceError(provider: TTSProvider, status: number, message?: string): TTSServiceError {
  const providerName = provider === "groq" ? "Groq" : "Fal";

  if (status === 401 || status === 403) {
    return new TTSServiceError(
      `${providerName} authentication failed. Check your API key or proxy credentials.`,
      "auth",
      false
    );
  }

  if (status === 429) {
    return new TTSServiceError(
      `${providerName} rate limit reached. Retry in a few seconds.`,
      "rate_limit",
      true
    );
  }

  if (status >= 500) {
    return new TTSServiceError(
      message || `${providerName} is temporarily unavailable.`,
      "provider",
      true
    );
  }

  return new TTSServiceError(message || "TTS request failed.", "provider", false);
}

async function runWithRetry<T>(operation: () => Promise<T>): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= MAX_RETRIES) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      attempt += 1;
      const retryable =
        error instanceof TTSServiceError &&
        error.recoverable &&
        attempt <= MAX_RETRIES;
      if (!retryable) {
        break;
      }
      await wait(200 * attempt);
    }
  }

  if (lastError instanceof TTSServiceError) {
    throw lastError;
  }

  throw new TTSServiceError("Network error while contacting TTS provider.", "network", true);
}

async function invokeFalModel(
  settings: Settings,
  tts: TTSSettings,
  modelId: string,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const baseUrl = getBaseUrl(tts);
  const url = `${baseUrl}/${modelId}`;

  return runWithRetry(async () => {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: getHeaders(settings, tts),
        body: JSON.stringify({ input }),
      });
    } catch (error) {
      throw new TTSServiceError(
        error instanceof Error ? error.message : "Network error",
        "network",
        true
      );
    }

    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }

    if (!response.ok) {
      const providerMessage =
        typeof json === "object" &&
        json !== null &&
        "error" in json &&
        typeof (json as { error?: unknown }).error === "string"
          ? (json as { error: string }).error
          : undefined;
      throw toServiceError(tts.provider, response.status, providerMessage);
    }

    if (!json || typeof json !== "object") {
      throw new TTSServiceError("Provider returned an invalid response.", "provider", true);
    }

    if ("data" in json && typeof (json as { data?: unknown }).data === "object") {
      return (json as { data: Record<string, unknown> }).data;
    }

    return json as Record<string, unknown>;
  });
}

async function invokeGroqSpeech(
  settings: Settings,
  tts: TTSSettings,
  input: Record<string, unknown>
): Promise<GenerateSpeechResult> {
  const baseUrl = getBaseUrl(tts);
  const url = `${baseUrl}/audio/speech`;

  return runWithRetry(async () => {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: getHeaders(settings, tts),
        body: JSON.stringify(input),
      });
    } catch (error) {
      throw new TTSServiceError(
        error instanceof Error ? error.message : "Network error",
        "network",
        true
      );
    }

    if (!response.ok) {
      let message: string | undefined;
      try {
        const json = await response.json();
        if (json && typeof json === "object" && "error" in json) {
          const errorObj = (json as { error?: { message?: string } }).error;
          message = errorObj?.message;
        }
      } catch {
        // ignore
      }
      throw toServiceError("groq", response.status, message);
    }

    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength) {
      throw new TTSServiceError("Groq returned empty audio response.", "provider", true);
    }

    const format = tts.groqResponseFormat === "wav" ? "wav" : "mpeg";
    const blob = new Blob([buffer], { type: `audio/${format}` });
    const audioUrl = URL.createObjectURL(blob);

    return {
      audioUrl,
      rawOutput: {
        provider: "groq",
        model: tts.groqModelId,
      },
    };
  });
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new TTSServiceError("Failed to read voice sample file.", "validation"));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new TTSServiceError("Voice sample conversion failed.", "validation"));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function findSpeakerEmbeddingUrl(output: Record<string, unknown>): string | undefined {
  const outputAny = output as {
    speaker_file?: { url?: string };
    speaker_file_url?: string;
    speaker_embedding_url?: string;
  };

  return (
    outputAny.speaker_file?.url ||
    outputAny.speaker_file_url ||
    outputAny.speaker_embedding_url
  );
}

function findAudioUrl(output: Record<string, unknown>): string | undefined {
  const outputAny = output as {
    audio?: { url?: string };
    audio_url?: string;
    file?: { url?: string };
  };

  return outputAny.audio?.url || outputAny.audio_url || outputAny.file?.url;
}

export async function cloneVoice(
  settings: Settings,
  request: CloneVoiceRequest
): Promise<CloneVoiceResult> {
  const tts = getTTSSettingsFromStore(settings);
  if (tts.provider !== "fal") {
    throw new TTSServiceError("Voice cloning is currently available for Fal provider only.", "validation");
  }

  if (!request.voiceName.trim()) {
    throw new TTSServiceError("Voice name is required.", "validation");
  }

  const audioUrl = await fileToDataUrl(request.sampleFile);
  const output = await invokeFalModel(settings, tts, tts.cloneModelId, {
    audio_url: audioUrl,
    text: request.sampleText?.trim() || "This is a voice cloning sample.",
    language: tts.language,
  });

  const speakerEmbeddingUrl = findSpeakerEmbeddingUrl(output);
  if (!speakerEmbeddingUrl) {
    throw new TTSServiceError(
      "Voice cloning response did not include a reusable speaker embedding URL.",
      "provider",
      true
    );
  }

  const profile: TTSVoiceProfile = {
    id: `fal-cloned-${Date.now()}`,
    provider: "fal",
    name: request.voiceName.trim(),
    kind: "cloned",
    speakerEmbeddingUrl,
    referenceText: request.sampleText?.trim() || "",
    createdAt: new Date().toISOString(),
  };

  return {
    profile,
    rawOutput: output,
  };
}

async function cacheAudio(tts: TTSSettings, cacheKey: string, audioUrl: string, durationSec?: number): Promise<void> {
  try {
    const response = await fetch(audioUrl);
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      await setCachedAudio(cacheKey, arrayBuffer, durationSec ?? 0);
    }
  } catch {
    // Cache write failure is non-critical
  }
}

export async function generateSpeech(
  settings: Settings,
  request: GenerateSpeechRequest
): Promise<GenerateSpeechResult> {
  const tts = getTTSSettingsFromStore(settings);
  if (!request.text.trim()) {
    throw new TTSServiceError("Text is required for speech generation.", "validation");
  }

  const preset = resolvePreset(tts, request.presetId);
  const voice = resolveVoice(tts, request.voiceId);

  // Determine the actual voice identifier used for API calls
  let voiceIdForCache: string;
  let speedForCache: number;
  if (tts.provider === "pocket") {
    voiceIdForCache = typeof voice.voice === "string" ? voice.voice : "alba";
    speedForCache = tts.pocketSpeed ?? 1.0;
  } else if (tts.provider === "groq") {
    voiceIdForCache = typeof voice.voice === "string" ? voice.voice.toLowerCase() : "fiora";
    speedForCache = Math.max(0.5, Math.min(2, 1 + (preset.temperature - 0.9) * 0.4));
  } else {
    voiceIdForCache = typeof voice.voice === "string" ? voice.voice : voice.id;
    speedForCache = 1.0;
  }

  const cacheKey = makeCacheKey(tts.provider, voiceIdForCache, speedForCache, request.text);

  try {
    const cached = await getCachedAudio(cacheKey);
    if (cached) {
      const mimeType = tts.provider === "groq" && tts.groqResponseFormat === "wav" ? "audio/wav" : "audio/mpeg";
      const blob = new Blob([cached.audioData], { type: mimeType });
      const audioUrl = URL.createObjectURL(blob);
      return {
        audioUrl,
        durationSec: cached.durationSec,
        rawOutput: { provider: tts.provider, fromCache: true },
      };
    }
  } catch {
    // Cache unavailable, proceed with generation
  }

  // Pocket TTS - local sidecar
  if (tts.provider === "pocket") {
    const { generatePocketSpeech } = await import("./pocketTts");
    const pocketVoice = voiceIdForCache;
    const speed = speedForCache;

    const result = await generatePocketSpeech({
      text: request.text,
      voice: pocketVoice,
      speed,
    });

    void cacheAudio(tts, cacheKey, result.audioUrl, result.durationSec);

    return {
      audioUrl: result.audioUrl,
      durationSec: result.durationSec,
      rawOutput: { provider: "pocket", voice: pocketVoice },
    };
  }

  if (tts.provider === "groq") {
    const groqVoice = voiceIdForCache;
    const speed = speedForCache;

    const result = await invokeGroqSpeech(settings, tts, {
      model: tts.groqModelId,
      voice: groqVoice,
      input: request.text,
      response_format: tts.groqResponseFormat,
      speed,
    });

    void cacheAudio(tts, cacheKey, result.audioUrl, result.durationSec);

    return result;
  }

  const input: Record<string, unknown> = {
    text: request.text,
    prompt: preset.prompt,
    temperature: preset.temperature,
    top_p: preset.topP,
    top_k: preset.topK,
    repetition_penalty: preset.repetitionPenalty,
    max_new_tokens: preset.maxNewTokens,
    language: tts.language,
  };

  if (voice.kind === "builtin" && voice.voice) {
    input.voice = voice.voice;
  }

  if (voice.kind === "cloned" && voice.speakerEmbeddingUrl) {
    input.speaker_file_url = voice.speakerEmbeddingUrl;
  }

  const output = await invokeFalModel(settings, tts, tts.modelId, input);
  const audioUrl = findAudioUrl(output);

  if (!audioUrl) {
    throw new TTSServiceError("TTS response did not include playable audio output.", "provider", true);
  }

  const durationSec =
    typeof (output as { duration?: unknown }).duration === "number"
      ? ((output as { duration: number }).duration)
      : undefined;

  void cacheAudio(tts, cacheKey, audioUrl, durationSec);

  return {
    audioUrl,
    durationSec,
    rawOutput: output,
  };
}
