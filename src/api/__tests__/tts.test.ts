import { beforeEach, describe, expect, it, vi } from "vitest";
import { cloneVoice, generateSpeech, TTSServiceError } from "../tts";
import { defaultSettings } from "../../stores/settingsStore";
import { createDefaultTTSSettings } from "../../utils/ttsSettings";

vi.mock("../../utils/ttsCache", () => ({
  makeCacheKey: vi.fn(() => "test:cache:key"),
  getCachedAudio: vi.fn(() => Promise.resolve(null)),
  setCachedAudio: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../lib/tauri", () => ({
  isTauri: () => false,
}));

function makeSettings() {
  return {
    ...defaultSettings,
    tts: {
      ...createDefaultTTSSettings(),
      enabled: true,
      apiKey: "test-key",
      voiceProfiles: createDefaultTTSSettings().voiceProfiles,
      presets: createDefaultTTSSettings().presets,
    },
  };
}

describe("tts api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("generates speech and returns playable URL", async () => {
    const mockCacheResponse = {
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    } as Response;

    const fetchMock = vi
      .spyOn(globalThis, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { audio: { url: "https://cdn.fal.ai/audio.mp3" } } }),
      } as Response)
      .mockResolvedValue(mockCacheResponse);

    const result = await generateSpeech(makeSettings(), {
      text: "Hello from tests",
    });

    expect(result.audioUrl).toBe("https://cdn.fal.ai/audio.mp3");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries transient rate-limit failures", async () => {
    const mockCacheResponse = {
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    } as Response;

    const fetchMock = vi
      .spyOn(globalThis, "fetch" as any)
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: "Too many requests" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { audio_url: "https://cdn.fal.ai/retry.mp3" } }),
      } as Response)
      .mockResolvedValue(mockCacheResponse);

    const result = await generateSpeech(makeSettings(), {
      text: "Retry sample",
    });

    expect(result.audioUrl).toContain("retry.mp3");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("creates voice profile from clone output", async () => {
    vi.spyOn(globalThis, "fetch" as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { speaker_file: { url: "https://cdn.fal.ai/voice.spk" } } }),
    } as Response);

    const file = new File([new Uint8Array([1, 2, 3])], "voice.wav", { type: "audio/wav" });
    const result = await cloneVoice(makeSettings(), {
      voiceName: "My Clone",
      sampleFile: file,
      sampleText: "sample",
    });

    expect(result.profile.kind).toBe("cloned");
    expect(result.profile.speakerEmbeddingUrl).toContain("voice.spk");
  });

  it("throws auth-specific errors", async () => {
    vi.spyOn(globalThis, "fetch" as any).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Unauthorized" }),
    } as Response);

    await expect(
      generateSpeech(makeSettings(), { text: "Auth failure" })
    ).rejects.toMatchObject({
      code: "auth",
    } as Partial<TTSServiceError>);
  });

  it("uses Groq transcription API key fallback when TTS key is empty", async () => {
    const createObjectUrlMock = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:groq-audio");
    const fetchMock = vi.spyOn(globalThis, "fetch" as any).mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    } as Response);

    const settings = makeSettings();
    settings.tts.provider = "groq";
    settings.tts.apiKey = "";
    settings.tts.groqModelId = "playai-tts";
    settings.audioTranscription.groq.apiKey = "gsk-test-from-transcription";

    const result = await generateSpeech(settings, {
      text: "Groq fallback key test",
    });

    expect(result.audioUrl).toBe("blob:groq-audio");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.groq.com/openai/v1/audio/speech",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer gsk-test-from-transcription",
        }),
      })
    );

    createObjectUrlMock.mockRestore();
  });
});
