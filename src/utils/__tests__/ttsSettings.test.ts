import { describe, expect, it } from "vitest";
import {
  createDefaultTTSSettings,
  sanitizeTTSSettings,
  validateTTSConfiguration,
} from "../ttsSettings";

describe("ttsSettings", () => {
  it("returns defaults for invalid persisted payloads", () => {
    const settings = sanitizeTTSSettings(null);
    const defaults = createDefaultTTSSettings();

    expect(settings.defaultPresetId).toBe(defaults.defaultPresetId);
    expect(settings.voiceProfiles.length).toBeGreaterThan(0);
  });

  it("merges custom cloned voices while preserving built-ins", () => {
    const settings = sanitizeTTSSettings({
      enabled: true,
      voiceProfiles: [
        {
          id: "cloned-1",
          name: "Narrator",
          kind: "cloned",
          speakerEmbeddingUrl: "https://cdn.fal.ai/sample.bin",
          createdAt: new Date().toISOString(),
        },
      ],
      defaultVoiceId: "cloned-1",
    });

    expect(settings.voiceProfiles.some((voice) => voice.id === "cloned-1")).toBe(true);
    expect(settings.voiceProfiles.some((voice) => voice.kind === "builtin")).toBe(true);
    expect(settings.defaultVoiceId).toBe("cloned-1");
  });

  it("validates direct and proxy configuration", () => {
    const defaults = createDefaultTTSSettings();
    expect(validateTTSConfiguration({ ...defaults, enabled: false }).valid).toBe(true);

    const directInvalid = validateTTSConfiguration({
      ...defaults,
      enabled: true,
      requestMode: "direct",
      apiKey: "",
    });
    expect(directInvalid.valid).toBe(false);

    const proxyValid = validateTTSConfiguration({
      ...defaults,
      enabled: true,
      requestMode: "proxy",
      proxyUrl: "https://proxy.example.com/fal",
    });
    expect(proxyValid.valid).toBe(true);
  });
});
